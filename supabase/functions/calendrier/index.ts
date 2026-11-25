// Calendriers du Vestibule.
//   GET  ?jeton=…                 : le calendrier de l'école du foyer (.ics), auquel on s'abonne dans Google Agenda ou Calendrier d'Apple
//   POST {"action":"demain"}      : les événements de demain dans le calendrier personnel de la personne
//                                   (son « adresse secrète au format iCal », gardée dans la table prives), pour repérer les conflits
// « Verify JWT » désactivé : le GET est protégé par le jeton secret du foyer, le POST par le jeton HoldingAI et la base.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { CORS, json, admin, commeUsager, aujourdhui } from "../_commun/vestibule.ts";

// ---------- Export .ics ----------
const ical = (s: string) => String(s || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const plier = (l: string) => { const o: string[] = []; let s = l; while (s.length > 74) { o.push(s.slice(0, 74)); s = " " + s.slice(74); } o.push(s); return o.join("\r\n"); };
const LIBELLE: Record<string, string> = { activite: "", apporter: "À apporter : ", formulaire: "Formulaire : ", payer: "À payer : ", conge: "" };

async function exporter(jeton: string) {
  const db = admin();
  const { data: f } = await db.from("foyers").select("id, fuseau").eq("jeton_calendrier", jeton).maybeSingle();
  if (!f) return new Response("Introuvable", { status: 404 });
  const debut = aujourdhui(f.fuseau, -30), fin = aujourdhui(f.fuseau, 180);
  const { data: el } = await db.from("elements").select("id, genre, titre, jour, heure, enfant, cree").eq("foyer_id", f.id).gte("jour", debut).lte("jour", fin).order("jour");
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//HoldingAI//Le Vestibule//FR", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "X-WR-CALNAME:École (Le Vestibule)", "X-WR-TIMEZONE:" + f.fuseau, "REFRESH-INTERVAL;VALUE=DURATION:PT6H", "X-PUBLISHED-TTL:PT6H"];
  for (const e of el || []) {
    const j = e.jour.replace(/-/g, "");
    const titre = (LIBELLE[e.genre] || "") + e.titre + (e.enfant ? ` (${e.enfant})` : "");
    L.push("BEGIN:VEVENT", `UID:${e.id}@levestibule`, `DTSTAMP:${stamp}`, plier("SUMMARY:" + ical(titre)));
    if (e.heure) {
      const [h, m] = e.heure.split(":"); const fin = String(Math.min(23, Number(h) + 1)).padStart(2, "0");
      L.push(`DTSTART;TZID=${f.fuseau}:${j}T${h}${m}00`, `DTEND;TZID=${f.fuseau}:${j}T${fin}${m}00`);
    } else {
      const d = new Date(e.jour + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + 1);
      L.push(`DTSTART;VALUE=DATE:${j}`, `DTEND;VALUE=DATE:${d.toISOString().slice(0, 10).replace(/-/g, "")}`, "TRANSP:TRANSPARENT");
    }
    L.push("END:VEVENT");
  }
  L.push("END:VCALENDAR");
  return new Response(L.join("\r\n") + "\r\n", { headers: { ...CORS, "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "max-age=900" } });
}

// ---------- Lecture d'un calendrier personnel (.ics) ----------
type Ev = { titre: string; debut: string; fin: string; journee: boolean };

// Décalage (ms) d'un fuseau à un instant donné
function decalage(fuseau: string, t: number) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: fuseau, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
    .formatToParts(new Date(t)).map((x) => [x.type, x.value]));
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - t;
}
function enInstant(v: string, tz: string | null, defaut: string) {
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!m) return null;
  const mur = Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
  if (!m[4]) return { t: mur, journee: true, date: `${m[1]}-${m[2]}-${m[3]}` };
  if (m[7]) return { t: mur, journee: false, date: "" };
  const fz = tz || defaut;
  let t = mur - decalage(fz, mur); t = mur - decalage(fz, t);
  return { t, journee: false, date: "" };
}
function dansFuseau(t: number, fuseau: string) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: fuseau, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
    .formatToParts(new Date(t)).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, heure: `${p.hour}:${p.minute}` };
}
const JOURS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
const jourDe = (d: string) => new Date(d + "T12:00:00Z");

// L'occurrence d'une règle de répétition tombe-t-elle à la date voulue?
function seRepete(rrule: string, debut: string, cible: string, exclus: Set<string>) {
  const r = Object.fromEntries(rrule.split(";").map((x) => x.split("=")));
  const freq = r.FREQ, inter = Math.max(1, Number(r.INTERVAL || 1)), compte = r.COUNT ? Number(r.COUNT) : 0;
  const jusqua = r.UNTIL ? `${r.UNTIL.slice(0, 4)}-${r.UNTIL.slice(4, 6)}-${r.UNTIL.slice(6, 8)}` : "9999-12-31";
  if (cible < debut || cible > jusqua) return false;
  const d0 = jourDe(debut);
  const parJour = r.BYDAY ? r.BYDAY.split(",").map((x: string) => x.replace(/^[+-]?\d+/, "")) : [JOURS[d0.getUTCDay()]];
  const lundi = (d: Date) => { const x = new Date(d); x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7)); return x; };
  const correspond = (d: Date) => {
    const ecart = Math.round((d.getTime() - d0.getTime()) / 864e5);
    if (freq === "DAILY") return ecart % inter === 0;
    if (freq === "WEEKLY") return parJour.includes(JOURS[d.getUTCDay()]) && Math.round((lundi(d).getTime() - lundi(d0).getTime()) / (7 * 864e5)) % inter === 0;
    if (freq === "MONTHLY") {
      const mois = (d.getUTCFullYear() - d0.getUTCFullYear()) * 12 + d.getUTCMonth() - d0.getUTCMonth();
      const jourMois = r.BYMONTHDAY ? r.BYMONTHDAY.split(",").map(Number) : [d0.getUTCDate()];
      return mois % inter === 0 && !r.BYDAY && jourMois.includes(d.getUTCDate());
    }
    if (freq === "YEARLY") return d.getUTCMonth() === d0.getUTCMonth() && d.getUTCDate() === d0.getUTCDate() && (d.getUTCFullYear() - d0.getUTCFullYear()) % inter === 0;
    return false;
  };
  const c = jourDe(cible);
  if (!correspond(c) || exclus.has(cible)) return false;
  if (!compte) return true;
  // Avec COUNT : on compte les occurrences jusqu'à la cible (borné à 3 ans)
  let n = 0;
  for (let d = new Date(d0), i = 0; d <= c && i < 1100; d.setUTCDate(d.getUTCDate() + 1), i++) if (correspond(d)) n++;
  return n <= compte;
}

function lireIcs(texte: string, cible: string, fuseau: string): Ev[] {
  const lignes = texte.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "").split(/\r?\n/);
  const evs: Record<string, string>[][] = [];
  let cur: Record<string, string>[] | null = null;
  for (const l of lignes) {
    if (l === "BEGIN:VEVENT") cur = [];
    else if (l === "END:VEVENT") { if (cur) evs.push(cur); cur = null; }
    else if (cur) { const i = l.indexOf(":"); if (i > 0) cur.push({ cle: l.slice(0, i), val: l.slice(i + 1) }); }
  }
  const prop = (e: Record<string, string>[], nom: string) => e.find((p) => p.cle === nom || p.cle.startsWith(nom + ";"));
  const tzDe = (p?: Record<string, string>) => (p?.cle.match(/TZID=([^;:]+)/) || [])[1] || null;
  const remplaces = new Map<string, Set<string>>(); // UID → dates remplacées par une exception
  for (const e of evs) {
    const rid = prop(e, "RECURRENCE-ID"), uid = prop(e, "UID")?.val;
    if (rid && uid) { const x = enInstant(rid.val, tzDe(rid), fuseau); if (x) { const d = x.journee ? x.date : dansFuseau(x.t, fuseau).date; (remplaces.get(uid) || remplaces.set(uid, new Set()).get(uid)!).add(d); } }
  }
  const out: Ev[] = [];
  for (const e of evs) {
    if ((prop(e, "STATUS")?.val || "").toUpperCase() === "CANCELLED") continue;
    if ((prop(e, "TRANSP")?.val || "").toUpperCase() === "TRANSPARENT") continue;
    const ds = prop(e, "DTSTART"); if (!ds) continue;
    const de = prop(e, "DTEND");
    const a = enInstant(ds.val, tzDe(ds), fuseau); if (!a) continue;
    const b = de ? enInstant(de.val, tzDe(de), fuseau) : null;
    const titre = (prop(e, "SUMMARY")?.val || "Événement").replace(/\\n/g, " ").replace(/\\([,;\\])/g, "$1").slice(0, 120);
    const dDebut = a.journee ? a.date : dansFuseau(a.t, fuseau).date;
    const rr = prop(e, "RRULE")?.val;
    let ok = false, debutT = a.t;
    if (rr && !prop(e, "RECURRENCE-ID")) {
      const exclus = new Set<string>(remplaces.get(prop(e, "UID")?.val || "") || []);
      for (const x of e.filter((p) => p.cle.startsWith("EXDATE"))) for (const v of x.val.split(",")) {
        const y = enInstant(v, tzDe(x), fuseau); if (y) exclus.add(y.journee ? y.date : dansFuseau(y.t, fuseau).date);
      }
      ok = seRepete(rr, dDebut, cible, exclus);
      if (ok) debutT = a.t + (jourDe(cible).getTime() - jourDe(dDebut).getTime());
    } else ok = dDebut === cible;
    if (!ok) continue;
    const duree = b ? b.t - a.t : 3600e3;
    out.push(a.journee
      ? { titre, debut: "", fin: "", journee: true }
      : { titre, debut: dansFuseau(debutT, fuseau).heure, fin: dansFuseau(debutT + duree, fuseau).heure, journee: false });
  }
  return out.sort((x, y) => x.debut.localeCompare(y.debut)).slice(0, 40);
}

async function demain(req: Request) {
  const sb = commeUsager(req);
  const { data: foyer } = await sb.from("foyers").select("fuseau").limit(1).maybeSingle();
  if (!foyer) return json({ erreur: "Accès réservé aux membres." }, 403);
  const { data: p } = await sb.from("prives").select("ical_url").maybeSingle();
  if (!p?.ical_url) return json({ evenements: null });
  let url: URL;
  try { url = new URL(p.ical_url.replace(/^webcal:/, "https:")); } catch { return json({ erreur: "Adresse du calendrier invalide." }, 400); }
  if (url.protocol !== "https:") return json({ erreur: "L'adresse doit commencer par https://" }, 400);
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(10000), headers: { Accept: "text/calendar" } });
    if (!r.ok) return json({ erreur: "Le calendrier n'a pas répondu (" + r.status + ")." }, 502);
    const texte = (await r.text()).slice(0, 5_000_000);
    if (!texte.includes("BEGIN:VCALENDAR")) return json({ erreur: "Cette adresse ne donne pas un calendrier iCal." }, 400);
    const cible = aujourdhui(foyer.fuseau, 1);
    return json({ jour: cible, evenements: lireIcs(texte, cible, foyer.fuseau) });
  } catch {
    return json({ erreur: "Le calendrier est injoignable pour le moment." }, 502);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const u = new URL(req.url);
  if (req.method === "GET") {
    const jeton = u.searchParams.get("jeton") || "";
    if (!/^[a-f0-9]{32}$/.test(jeton)) return new Response("Introuvable", { status: 404 });
    return exporter(jeton);
  }
  if (req.method !== "POST") return json({ erreur: "Méthode non permise" }, 405);
  let b: { action?: string } = {};
  try { b = await req.json(); } catch { /* vide */ }
  if (b.action === "demain") return demain(req);
  return json({ erreur: "Action inconnue" }, 400);
});

export { lireIcs }; // pour les tests
