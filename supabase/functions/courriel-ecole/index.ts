// Reçoit les courriels de l'école transférés à famille-<code>@levestibule.ai (Cloudflare Email Routing → worker → ici).
// Protégée par le secret COURRIEL_SECRET (le même que dans le worker). « Verify JWT » désactivé.
// Le texte du courriel n'est jamais conservé : seuls les éléments trouvés sont rangés.
// Cas spécial : le courriel de confirmation de Gmail (transfert automatique) est noté pour que l'app affiche le lien.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import PostalMime from "npm:postal-mime@2.4.3";
import { json, admin, extraire, ranger, actif, type Piece } from "../_commun/vestibule.ts";

async function memeSecret(a: string | null, b: string | undefined) {
  if (!a || !b) return false;
  const h = async (x: string) => new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(x)));
  const [x, y] = await Promise.all([h(a), h(b)]);
  let d = 0; for (let i = 0; i < x.length; i++) d |= x[i] ^ y[i];
  return d === 0;
}
const b64 = (u: Uint8Array) => { let s = ""; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); };
const sansBalises = (h: string) => h.replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ").replace(/<br\s*\/?>|<\/(p|div|li|tr|h\d)>/gi, "\n")
  .replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"')
  .replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ erreur: "Méthode non permise" }, 405);
  if (!(await memeSecret(req.headers.get("X-Courriel-Secret"), Deno.env.get("COURRIEL_SECRET")))) return json({ erreur: "Refusé" }, 403);

  const a = decodeURIComponent(req.headers.get("X-Enveloppe-A") || "").toLowerCase();
  const code = (a.match(/^famille-([a-z0-9]{8})@/) || [])[1];
  if (!code) return json({ ok: true, ignore: "adresse inconnue" });
  const db = admin();
  const { data: foyer } = await db.from("foyers").select("id, fuseau, essai_fin, paye_jusqua").eq("code_courriel", code).maybeSingle();
  if (!foyer) return json({ ok: true, ignore: "foyer inconnu" });

  const brut = new Uint8Array(await req.arrayBuffer());
  // deno-lint-ignore no-explicit-any
  let m: any;
  try { m = await PostalMime.parse(brut); } catch { return json({ ok: true, ignore: "illisible" }); }
  const de = String(m.from?.address || decodeURIComponent(req.headers.get("X-Enveloppe-De") || "")).toLowerCase();
  const texte = (m.text && m.text.trim()) ? m.text : sansBalises(m.html || "");
  await db.from("foyers").update({ dernier_courriel: new Date().toISOString() }).eq("id", foyer.id);

  // Confirmation du transfert automatique de Gmail : on garde le lien pour l'afficher dans Réglages
  if (de.includes("forwarding-noreply@google.com")) {
    const lien = ((texte + " " + (m.html || "")).match(/https:\/\/(?:mail-settings\.google\.com|mail\.google\.com)\/[^\s"'<>]+/) || [])[0];
    if (lien) await db.from("foyers").update({ confirmation_gmail: lien.slice(0, 1000) }).eq("id", foyer.id);
    return json({ ok: true, confirmation: !!lien });
  }

  if (!actif(foyer)) return json({ ok: true, ignore: "essai terminé" });

  // Pièces jointes utiles : images et PDF (infolettre, calendrier), 3 au plus, 4 Mo chacune
  const pieces: Piece[] = [];
  // deno-lint-ignore no-explicit-any
  for (const p of (m.attachments || []) as any[]) {
    const type = String(p.mimeType || "").toLowerCase(), taille = p.content?.byteLength || 0;
    if (!taille || taille > 4_000_000 || pieces.length >= 3) continue;
    const u = p.content instanceof Uint8Array ? p.content : new Uint8Array(p.content);
    if (["image/jpeg", "image/png", "image/webp"].includes(type) && taille > 15_000) pieces.push({ type: "image", media: type, data: b64(u) });
    else if (type === "application/pdf") pieces.push({ type: "pdf", media: type, data: b64(u) });
  }
  if (!texte.trim() && !pieces.length) return json({ ok: true, ignore: "vide" });

  const { data: enfants } = await db.from("enfants").select("prenom").eq("foyer_id", foyer.id).order("ordre");
  const sujet = String(m.subject || "").slice(0, 80);
  try {
    const trouves = await extraire({
      texte: `De : ${de}\nObjet : ${sujet}\nDate : ${m.date || ""}\n\n${texte}`, pieces,
      enfants: (enfants || []).map((e) => e.prenom), fuseau: foyer.fuseau, foyer_id: foyer.id, fonction: "courriel",
    });
    const n = await ranger(db, foyer.id, trouves, "Courriel : " + (sujet || de));
    return json({ ok: true, ajoutes: n });
  } catch (e) {
    console.error("Extraction :", String((e as Error).message || e));
    return json({ ok: false }, 502);
  }
});
