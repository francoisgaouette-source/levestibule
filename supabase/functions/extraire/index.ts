// Lit un message collé ou une photo (feuille du sac à dos, capture de Mozaïk) et range ce qui compte.
// Appelée par l'app. « Verify JWT » désactivé (jeton HoldingAI) : l'appartenance au foyer est vérifiée dans la base.
// Secret requis : ANTHROPIC_API_KEY. Facultatif : MODEL_EXTRACTION (claude-haiku-5-5 par défaut).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { CORS, json, commeUsager, extraire, ranger, actif, type Piece } from "../_commun/vestibule.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ erreur: "Méthode non permise" }, 405);

  const sb = commeUsager(req);
  const { data: foyer } = await sb.from("foyers").select("id, fuseau, essai_fin, paye_jusqua").limit(1).maybeSingle();
  if (!foyer) return json({ erreur: "Accès réservé aux membres d'un foyer." }, 403);
  if (!actif(foyer)) return json({ erreur: "L'essai gratuit est terminé. Le propriétaire du foyer peut acheter l'app pour continuer." }, 402);

  let b: { texte?: string; image?: string; media_type?: string };
  try { b = await req.json(); } catch { return json({ erreur: "Requête invalide" }, 400); }
  const texte = String(b.texte || "").slice(0, 20000);
  const image = String(b.image || "").replace(/^data:[^,]+,/, "");
  if (!texte.trim() && !image) return json({ erreur: "Rien à lire." }, 400);
  if (image.length > 7_000_000) return json({ erreur: "Image trop lourde." }, 400);
  const media = ["image/jpeg", "image/png", "image/webp"].includes(b.media_type || "") ? b.media_type! : "image/jpeg";
  const pieces: Piece[] = image ? [{ type: "image", media, data: image }] : [];

  const { data: enfants } = await sb.from("enfants").select("prenom").order("ordre");
  try {
    const trouves = await extraire({ texte, pieces, enfants: (enfants || []).map((e) => e.prenom), fuseau: foyer.fuseau, foyer_id: foyer.id, fonction: image ? "photo" : "message-colle" });
    const n = await ranger(sb, foyer.id, trouves, image ? "Photo" : "Message collé");
    return json({ ajoutes: n, trouves: trouves.length });
  } catch (e) {
    return json({ erreur: "La lecture n'a pas fonctionné. Réessayez dans un moment.", detail: String((e as Error).message || e) }, 502);
  }
});
