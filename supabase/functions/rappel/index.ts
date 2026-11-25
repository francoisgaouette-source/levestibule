// Notifications du Vestibule (Web Push).
//   action "cle"     (app)  : clé publique pour s'abonner (créée au premier appel)
//   action "test"    (app)  : notification d'essai sur les appareils de la personne
//   action "envoyer" (cron, en-tête x-cron) : toutes les 15 minutes,
//      - le soir, à la fin de la journée de travail de chacun : « Le Vestibule », avec ce qu'il y a pour demain;
//      - le matin vers 7 h, seulement si quelque chose doit partir avec un enfant aujourd'hui.
// « Verify JWT » désactivé (jeton HoldingAI ou cron).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import webpush from "npm:web-push@3.6.7";
import { CORS, json, admin, commeUsager, aujourdhui, actif } from "../_commun/vestibule.ts";

const db = admin();

async function cles() {
  const { data } = await db.from("push_cles").select("nom, valeur").in("nom", ["vapid_public", "vapid_prive", "cron"]);
  const c = Object.fromEntries((data || []).map((r) => [r.nom, r.valeur]));
  if (!c.vapid_public || !c.vapid_prive) {
    const k = webpush.generateVAPIDKeys();
    await db.from("push_cles").upsert([{ nom: "vapid_public", valeur: k.publicKey }, { nom: "vapid_prive", valeur: k.privateKey }]);
    c.vapid_public = k.publicKey; c.vapid_prive = k.privateKey;
  }
  webpush.setVapidDetails("mailto:" + (Deno.env.get("COURRIEL_CONTACT") || "bonjour@holdingai.app"), c.vapid_public, c.vapid_prive);
  return c;
}

async function pousser(user_id: string, msg: { title: string; body: string; url: string }) {
  const { data: subs } = await db.from("abonnements").select("id, endpoint, p256dh, auth").eq("user_id", user_id);
  let ok = 0;
  for (const s of subs || []) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(msg), { TTL: 3600 });
      ok++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await db.from("abonnements").delete().eq("id", s.id); // appareil désabonné
    }
  }
  return ok;
}

// Heure locale HH:MM et jour de la semaine (0 = dimanche) dans le fuseau du foyer
function local(fuseau: string) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: fuseau, hour: "2-digit", minute: "2-digit", weekday: "short", hourCycle: "h23" })
    .formatToParts(new Date()).map((x) => [x.type, x.value]));
  return { minutes: Number(p.hour) * 60 + Number(p.minute), jour: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday) };
}
const enMinutes = (t: string) => { const [h, m] = String(t || "17:30").split(":").map(Number); return h * 60 + m; };
const pluriel = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 ? plusieurs : un}`;

async function dejaEnvoye(user_id: string, jour: string, genre: string) {
  const { error } = await db.from("envois").insert({ user_id, jour, genre });
  return !!error; // la clé primaire empêche un deuxième envoi le même jour
}

async function envoyer() {
  const { data: membres } = await db.from("membres").select("user_id, foyer_id, fin_travail, rappel_soir, rappel_matin, foyers(fuseau, essai_fin, paye_jusqua)").not("user_id", "is", null);
  const { data: abonnes } = await db.from("abonnements").select("user_id");
  const avecAppareil = new Set((abonnes || []).map((a) => a.user_id));
  let n = 0;
  for (const m of membres || []) {
    if (!avecAppareil.has(m.user_id)) continue;
    // deno-lint-ignore no-explicit-any
    if (!actif((m as any).foyers || {})) continue; // essai terminé sans paiement : plus de rappels
    // deno-lint-ignore no-explicit-any
    const fuseau = (m as any).foyers?.fuseau || "America/Toronto";
    const { minutes, jour: semaine } = local(fuseau);
    const auj = aujourdhui(fuseau), demain = aujourdhui(fuseau, 1);

    // Le soir : à la fin de la journée de travail, du lundi au vendredi, et le dimanche s'il y a de l'école le lendemain
    const fin = enMinutes(m.fin_travail);
    if (m.rappel_soir && minutes >= fin && minutes < fin + 15) {
      const { data: el } = await db.from("elements").select("titre").eq("foyer_id", m.foyer_id).eq("jour", demain).eq("fait", false).neq("genre", "conge");
      const dans3 = aujourdhui(fuseau, 3);
      const { data: ach } = await db.from("achats").select("texte").eq("foyer_id", m.foyer_id).eq("fait", false).lte("pour", dans3);
      const choses = (el || []).length + (ach || []).length;
      const semaineOk = semaine >= 1 && semaine <= 5 || (semaine === 0 && (el || []).length > 0);
      if (semaineOk && !(await dejaEnvoye(m.user_id, auj, "soir"))) {
        n += await pousser(m.user_id, {
          title: "Le Vestibule",
          body: choses ? `Lucie : demain, ${pluriel(choses, "chose", "choses")} à préparer. Une minute, puis la maison.` : "Lucie : une minute pour déposer le travail, puis la maison.",
          url: "./#ce-soir",
        });
      }
    }

    // Le matin, vers 7 h : seulement si quelque chose doit partir avec un enfant
    if (m.rappel_matin && minutes >= 420 && minutes < 435) {
      const { data: el } = await db.from("elements").select("titre, enfant").eq("foyer_id", m.foyer_id).eq("jour", auj).eq("fait", false).in("genre", ["apporter", "formulaire", "payer"]);
      if ((el || []).length && !(await dejaEnvoye(m.user_id, auj, "matin"))) {
        const liste = (el || []).slice(0, 3).map((e) => e.titre + (e.enfant ? ` (${e.enfant})` : "")).join(", ");
        n += await pousser(m.user_id, { title: "Ce matin", body: liste, url: "./#ce-soir" });
      }
    }
  }
  return n;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ erreur: "Méthode non permise" }, 405);
  let b: { action?: string } = {};
  try { b = await req.json(); } catch { /* vide */ }
  const c = await cles();

  if (b.action === "envoyer") {
    if (!c.cron || req.headers.get("x-cron") !== c.cron) return json({ erreur: "Refusé" }, 403);
    return json({ envoyees: await envoyer() });
  }

  // Actions de l'app : il faut être membre d'un foyer
  const sb = commeUsager(req);
  const { data: moi } = await sb.rpc("lier_compte");
  const { data: m } = await sb.from("membres").select("user_id").eq("id", moi || "").maybeSingle();
  if (!m?.user_id) return json({ erreur: "Accès réservé aux membres." }, 403);
  if (b.action === "cle") return json({ cle: c.vapid_public });
  if (b.action === "test") return json({ envoyees: await pousser(m.user_id, { title: "Le Vestibule", body: "C'est réglé : Lucie vous fera signe à la fin de votre journée.", url: "./#ce-soir" }) });
  return json({ erreur: "Action inconnue" }, 400);
});
