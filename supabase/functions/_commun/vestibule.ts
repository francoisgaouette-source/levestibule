// Outils communs aux fonctions du Vestibule : réponses, coût des appels à Claude, extraction des messages de l'école.
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

export const admin = () =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
export const commeUsager = (req: Request) =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } }, auth: { persistSession: false },
  });

// Prix en $ US par million de jetons : entrée, sortie, écriture en cache, lecture en cache
const PRIX: Record<string, number[]> = {
  "claude-haiku-5-5": [0.10, 0.50, 0.125, 0.01],
  "claude-sonnet-5-5": [2, 10, 2.5, 0.10],
  "claude-opus-5-5": [4, 20, 5, 0.20],
};
// deno-lint-ignore no-explicit-any
export async function noterCout(fonction: string, foyer_id: string | null, modele: string, u: any) {
  try {
    const p = PRIX[modele] || PRIX["claude-sonnet-5-5"];
    const e = u?.input_tokens || 0, s = u?.output_tokens || 0, ce = u?.cache_creation_input_tokens || 0, cl = u?.cache_read_input_tokens || 0;
    await admin().from("couts_ia").insert({ app: "vestibule", fonction, foyer_id, modele, entree: e, sortie: s, cache_ecrit: ce, cache_lu: cl, recherches: 0,
      cout_usd: (e * p[0] + s * p[1] + ce * p[2] + cl * p[3]) / 1e6 });
  } catch { /* la mesure ne bloque jamais la réponse */ }
}

export type Piece = { type: "image" | "pdf"; media: string; data: string }; // data en base64
export type Trouve = { genre: string; titre: string; jour: string; heure: string; enfant: string; question: string; achat: boolean };

const GENRES = ["activite", "apporter", "formulaire", "payer", "conge"];

// Aujourd'hui dans le fuseau du foyer (AAAA-MM-JJ)
export function aujourdhui(fuseau: string, decalage = 0) {
  const d = new Date(Date.now() + decalage * 864e5);
  return new Intl.DateTimeFormat("en-CA", { timeZone: fuseau || "America/Toronto", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

// Demande à Claude ce qui compte dans un contenu scolaire. Le texte n'est jamais conservé.
export async function extraire(o: { texte: string; pieces?: Piece[]; enfants: string[]; fuseau: string; foyer_id: string; fonction: string }): Promise<Trouve[]> {
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) throw new Error("La clé ANTHROPIC_API_KEY n'est pas configurée dans Supabase.");
  const modele = Deno.env.get("MODEL_EXTRACTION") || "claude-haiku-5-5";
  const jour = aujourdhui(o.fuseau);
  const consigne =
`Tu aides des parents occupés au Québec à ne rien manquer de l'école de leurs enfants.
Aujourd'hui : ${jour}. Enfants de la famille : ${o.enfants.join(", ") || "inconnus"}.
Dans le contenu ci-dessous (courriel, message Mozaïk ou Clic école, groupe de la classe, photo d'une feuille, calendrier scolaire), retiens SEULEMENT ce qui a une date ou demande une action des parents. Ignore les infolettres, les salutations et ce qui est déjà passé.
Genres :
- activite : sortie, spectacle, photo scolaire, sortie hâtive, réunion de parents (mets l'heure si elle compte, ex. fin des cours à 14 h 30);
- apporter : un objet à mettre dans le sac un jour précis;
- formulaire : à signer ou remettre avant une date;
- payer : un paiement avant une date;
- conge : journée pédagogique, congé, semaine de relâche (un élément par jour);
- achat : une chose à acheter avant une date (carton, costume…) : mets "achat": true.
Réponds uniquement avec un objet JSON :
{"elements":[{"genre":"activite|apporter|formulaire|payer|conge","achat":false,"titre":"court et clair en français","jour":"AAAA-MM-JJ","heure":"HH:MM ou vide","enfant":"prénom parmi ceux de la famille si c'est clair, sinon vide","question":"pour une sortie ou un spectacle seulement : une question chaleureuse à poser à l'enfant le soir même, sinon vide"}]}
Une date sans année : la prochaine occurrence. Sans date précise, ne garde pas l'élément. Rien d'utile : {"elements":[]}.`;
  // deno-lint-ignore no-explicit-any
  const contenu: any[] = [];
  for (const p of (o.pieces || []).slice(0, 3)) {
    if (p.type === "image") contenu.push({ type: "image", source: { type: "base64", media_type: p.media, data: p.data } });
    else contenu.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: p.data } });
  }
  contenu.push({ type: "text", text: consigne + "\n\nCONTENU :\n" + (o.texte || "(voir les pièces jointes)").slice(0, 20000) });
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: modele, max_tokens: 1500, messages: [{ role: "user", content: contenu }] }),
  });
  const out = await res.json();
  if (!res.ok) throw new Error("Claude n'a pas répondu : " + (out?.error?.message || res.status));
  await noterCout(o.fonction, o.foyer_id, modele, out.usage);
  const texte = (out.content || []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("");
  const m = texte.match(/\{[\s\S]*\}/);
  // deno-lint-ignore no-explicit-any
  let r: any = {};
  try { r = m ? JSON.parse(m[0]) : {}; } catch { r = {}; }
  // deno-lint-ignore no-explicit-any
  return (Array.isArray(r.elements) ? r.elements : []).map((x: any) => ({
    genre: GENRES.includes(x.genre) ? x.genre : "activite",
    achat: x.achat === true,
    titre: String(x.titre || "").trim().slice(0, 160),
    jour: /^\d{4}-\d{2}-\d{2}$/.test(x.jour || "") ? x.jour : "",
    heure: /^\d{2}:\d{2}$/.test(x.heure || "") ? x.heure : "",
    enfant: String(x.enfant || "").slice(0, 40),
    question: String(x.question || "").slice(0, 200),
  })).filter((x: Trouve) => x.titre && x.jour && x.jour >= jour);
}

// Range ce qui a été trouvé : éléments de l'école (sans doublon) et achats. Retourne le nombre ajouté.
export async function ranger(sb: SupabaseClient, foyer_id: string, trouves: Trouve[], source: string) {
  let n = 0;
  for (const t of trouves) {
    if (t.achat) {
      const { error } = await sb.from("achats").insert({ foyer_id, texte: t.titre, pour: t.jour });
      if (!error) n++;
      continue;
    }
    const { error } = await sb.from("elements").insert({
      foyer_id, genre: t.genre, titre: t.titre, jour: t.jour, heure: t.heure || null, enfant: t.enfant, question: t.question, source: source.slice(0, 120),
    });
    if (!error) n++; // un doublon (même titre, même jour) est refusé par la base : on l'ignore
  }
  return n;
}

// Le foyer est-il actif (essai en cours ou payé)?
export const actif = (f: { essai_fin?: string | null; paye_jusqua?: string | null }) =>
  (f.essai_fin ? new Date(f.essai_fin).getTime() > Date.now() : false) || (f.paye_jusqua ? new Date(f.paye_jusqua).getTime() > Date.now() : false);
