// Le Vestibule (HoldingAI) : une minute entre le travail et la maison, avec Lucie.
// Sans Supabase configuré (config.js), l'app tourne en mode démo, avec des données d'exemple gardées sur l'appareil.
// Compte HoldingAI obligatoire (compte.js). Essai de 30 jours, puis 19,99 $ par année pour le foyer.
(function () {
  "use strict";
  const cfg = window.VESTIBULE_CONFIG || {};
  const DEMO = !cfg.supabaseUrl;
  const sb = DEMO ? null : window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, { accessToken: async () => (await HoldingAI.jeton()) || null });
  const $app = document.getElementById("app");

  // ---------- outils
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const iso = (d) => { const z = new Date(d.getTime() - d.getTimezoneOffset() * 6e4); return z.toISOString().slice(0, 10); };
  const plus = (s, n) => { const d = new Date(s + "T12:00:00"); d.setDate(d.getDate() + n); return iso(d); };
  let AUJ = iso(new Date()), DEMAIN = plus(AUJ, 1);
  const fmt = (s) => s ? new Date(s + "T12:00:00").toLocaleDateString("fr-CA", { weekday: "short", day: "numeric", month: "short" }) : "Sans date";
  const dans = (s) => Math.round((new Date(s + "T12:00:00") - new Date(AUJ + "T12:00:00")) / 864e5);
  const hm = (t) => (t || "").slice(0, 5);
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));
  const LUCIE = `<svg class="lucie" viewBox="0 0 64 64" aria-hidden="true"><path d="M9 36C9 19 19 8 32 8s23 11 23 28v16H9z" fill="#7a3b2e"/><circle cx="32" cy="35" r="17" fill="#f2c49b"/><path d="M15 31c2-11 9-16 17-16s15 5 17 14c-7-1-13-5-16-10-4 7-11 11-18 12z" fill="#7a3b2e"/><circle cx="26" cy="36" r="2.1" fill="#191714"/><circle cx="38" cy="36" r="2.1" fill="#191714"/><path d="M27 44q5 4 10 0" fill="none" stroke="#191714" stroke-width="2.2" stroke-linecap="round"/><circle cx="21" cy="42" r="2.6" fill="#e8462a" opacity=".3"/><circle cx="43" cy="42" r="2.6" fill="#e8462a" opacity=".3"/><path d="M17 58q15-9 30 0v6H17z" fill="#f0725c"/></svg>`;
  let prenomCompte = "";
  const GENRE = { activite: "Activité", apporter: "À apporter", formulaire: "Formulaire", payer: "À payer", conge: "Congé" };
  const fuseauAppareil = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Toronto"; } catch (e) { return "America/Toronto"; } };
  let toastT = null;
  function toast(m) { const t = document.getElementById("toast"); t.textContent = m; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 3800); }
  async function copier(txt) { try { await navigator.clipboard.writeText(txt); toast("Copié."); } catch (e) { toast("Sélectionnez le texte pour le copier."); } }

  // ---------- état
  // S : foyer, moi (fiche membre), membres, enfants, elements, achats, gens, depots, moments, prives
  let S = null, onglet = (location.hash || "#ce-soir").slice(1), occupe = "", statut = "", brouillon = "", cal = null, calErr = "";
  const ONGLETS = [["ce-soir", "Ce soir"], ["ecole", "École"], ["acheter", "À acheter"], ["gens", "Gens"], ["reglages", "Réglages"]];

  // =====================================================================
  // Données : Supabase, ou mode démo (localStorage)
  // =====================================================================
  function exemple() {
    const d = (n) => plus(AUJ, n), moi = uid(), alex = uid();
    return {
      demo: true,
      foyer: { id: "demo", nom: "Notre famille", code_courriel: "a1b2c3d4", jeton_calendrier: "0".repeat(32), fuseau: fuseauAppareil(), expediteurs: "", confirmation_gmail: null, dernier_courriel: null },
      moi: null,
      membres: [{ id: moi, prenom: "", role: "proprio", user_id: "moi", fin_travail: "17:30", rappel_soir: true, rappel_matin: true }, { id: alex, prenom: "Alex", telephone: "+15145550002", role: "membre", user_id: "alex" }],
      enfants: [{ id: uid(), prenom: "Léa", ordre: 1 }, { id: uid(), prenom: "Hugo", ordre: 2 }],
      elements: [
        { id: uid(), genre: "activite", titre: "Sortie au Musée des sciences", jour: d(0), heure: null, enfant: "Léa", question: "Qu'est-ce que tu as préféré au musée?", source: "Courriel : Sortie de fin d'étape", responsable: null, fait: false, planifie: false },
        { id: uid(), genre: "apporter", titre: "Jour de bibliothèque : rapporter le livre", jour: d(1), heure: null, enfant: "Léa", question: "", source: "Courriel : Horaire de la semaine", responsable: null, fait: false, planifie: false },
        { id: uid(), genre: "apporter", titre: "Éducation physique : vêtements de sport", jour: d(1), heure: null, enfant: "Hugo", question: "", source: "Photo", responsable: alex, fait: false, planifie: false },
        { id: uid(), genre: "formulaire", titre: "Formulaire de la journée pizza à remettre", jour: d(2), heure: null, enfant: "Hugo", question: "", source: "Message collé", responsable: null, fait: false, planifie: false },
        { id: uid(), genre: "activite", titre: "Sortie hâtive : fin des cours à 14 h 30", jour: d(3), heure: "14:30", enfant: "Hugo", question: "", source: "Courriel : Horaire de la semaine", responsable: null, fait: false, planifie: false },
        { id: uid(), genre: "activite", titre: "Photo scolaire", jour: d(6), heure: null, enfant: "Léa", question: "Comment ça s'est passé, la photo?", source: "Courriel : Photo scolaire", responsable: null, fait: false, planifie: false },
        { id: uid(), genre: "conge", titre: "Journée pédagogique", jour: d(12), heure: null, enfant: "", question: "", source: "Calendrier scolaire", responsable: null, fait: false, planifie: false },
      ],
      achats: [{ id: uid(), texte: "Carton à affiche", pour: d(2), fait: false }, { id: uid(), texte: "Costume pour le spectacle", pour: d(9), fait: false }],
      gens: [{ id: uid(), nom: "Papa", note: "Lui raconter le voyage", dernier: null }, { id: uid(), nom: "Marie", note: "Déménage le mois prochain : offrir un coup de main", dernier: null }],
      depots: [], moments: [], prives: { ical_url: "" },
    };
  }
  const demoSauver = () => { try { localStorage.setItem("vestibule.demo", JSON.stringify(Object.assign({}, S, { moi: null }))); } catch (e) {} };

  async function charger() {
    if (DEMO) {
      try { S = JSON.parse(localStorage.getItem("vestibule.demo") || "null"); } catch (e) { S = null; }
      if (!S) { S = exemple(); demoSauver(); }
      S.moi = S.membres.find((m) => m.user_id === "moi") || S.membres[0];
      return true;
    }
    await sb.rpc("lier_compte");
    const [f, ms, en, el, ac, ge, de, mo, pr] = await Promise.all([
      sb.from("foyers").select("*").limit(1).maybeSingle(),
      sb.from("membres").select("id, user_id, prenom, telephone, role, fin_travail, rappel_soir, rappel_matin").order("cree"),
      sb.from("enfants").select("*").order("ordre"),
      sb.from("elements").select("*").gte("jour", plus(AUJ, -1)).order("jour").limit(500),
      sb.from("achats").select("*").order("cree").limit(300),
      sb.from("gens").select("*").order("cree").limit(100),
      sb.from("depots").select("*").eq("fait", false).order("cree").limit(100),
      sb.from("moments").select("*").gte("jour", plus(AUJ, -14)),
      sb.from("prives").select("*").maybeSingle(),
    ]);
    if (!f.data) { S = null; return false; }
    const session = await HoldingAI.session();
    const membres = ms.data || [];
    S = { foyer: f.data, membres, moi: membres.find((m) => m.user_id === (session && session.uid)) || membres[0] || {},
      enfants: en.data || [], elements: el.data || [], achats: ac.data || [], gens: ge.data || [], depots: de.data || [], moments: mo.data || [], prives: pr.data || { ical_url: "" } };
    return true;
  }

  // Écritures : mise à jour immédiate de l'écran, puis la base
  const TABLES = { elements: 1, achats: 1, gens: 1, depots: 1, moments: 1, enfants: 1, membres: 1 };
  async function ajouter(table, row) {
    if (!TABLES[table] || !peutEcrire()) return;
    const r = Object.assign({ id: uid() }, row);
    S[table].push(r); rendre();
    if (DEMO) return demoSauver();
    const { data, error } = await sb.from(table).insert(row).select().single();
    if (error) { S[table] = S[table].filter((x) => x !== r); rendre(); return erreurBase(error); }
    Object.assign(r, data); rendre();
  }
  async function modifier(table, id, patch) {
    if (!peutEcrire()) return;
    const lst = table === "foyers" ? [S.foyer] : S[table], r = lst.find((x) => x.id === id); if (!r) return;
    const avant = Object.assign({}, r);
    Object.assign(r, patch); rendre();
    if (DEMO) return demoSauver();
    const { error } = await sb.from(table).update(patch).eq("id", id);
    if (error) { Object.assign(r, avant); rendre(); erreurBase(error); }
  }
  async function supprimer(table, id) {
    if (!peutEcrire()) return;
    const avant = S[table].slice();
    S[table] = S[table].filter((x) => x.id !== id); rendre();
    if (DEMO) return demoSauver();
    const { error } = await sb.from(table).delete().eq("id", id);
    if (error) { S[table] = avant; rendre(); erreurBase(error); }
  }
  function erreurBase(e) {
    const m = String((e && e.message) || "");
    toast(m.includes("limite_membres") ? "Quatre personnes au plus par foyer." : m.includes("cellulaire_invalide") ? "Ce numéro de cellulaire n'est pas valide."
      : m.includes("dernier_membre") ? "Le foyer doit garder au moins une personne." : m.includes("duplicate") ? "C'est déjà noté." : "Ça n'a pas été enregistré. Vérifiez la connexion et réessayez.");
  }

  // Temps réel : ce que le coparent ajoute arrive aussitôt
  let canal = null, rechargeT = null;
  function ecouter() {
    if (DEMO || canal) return;
    canal = sb.channel("vestibule");
    for (const t of ["elements", "achats", "gens", "membres", "foyers"]) {
      canal.on("postgres_changes", { event: "*", schema: "public", table: t }, () => { clearTimeout(rechargeT); rechargeT = setTimeout(async () => { if (!champActif()) { await charger(); rendre(); } }, 600); });
    }
    canal.subscribe();
  }
  const champActif = () => { const a = document.activeElement; return a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName); };

  // Fonctions serveur (Claude, calendrier, rappels). En démo, Claude passe par l'artefact si c'est offert.
  async function fonction(nom, corps) {
    if (!DEMO) {
      const { data, error } = await sb.functions.invoke(nom, { body: corps });
      if (error) { let d = null; try { d = await error.context.json(); } catch (e) {} throw new Error((d && d.erreur) || "Le service n'a pas répondu."); }
      return data;
    }
    if (nom === "extraire") return extraireDemo(corps);
    if (nom === "calendrier") return { evenements: null };
    throw new Error("Pas offert en mode démo.");
  }
  let sampleP = null;
  const sampleDemo = () => sampleP || (sampleP = (window.claude && window.claude.use ? window.claude.use("sample").catch(() => null) : Promise.resolve(null)));
  async function extraireDemo(c) {
    const sample = await sampleDemo();
    if (!sample) throw new Error("En mode démo, la lecture par Claude fonctionne seulement dans l'aperçu Claude. Une fois l'app branchée sur Supabase, elle fonctionne partout.");
    const p = "Tu aides des parents occupés au Québec à ne rien manquer de l'école. Aujourd'hui : " + AUJ + ". Enfants : " + S.enfants.map((e) => e.prenom).join(", ") +
      ".\nRetiens SEULEMENT ce qui a une date ou demande une action des parents. Réponds uniquement en JSON : {\"elements\":[{\"genre\":\"activite|apporter|formulaire|payer|conge\",\"achat\":false,\"titre\":\"court, en français\",\"jour\":\"AAAA-MM-JJ\",\"heure\":\"HH:MM ou vide\",\"enfant\":\"prénom ou vide\",\"question\":\"pour une sortie ou un spectacle : question à poser à l'enfant le soir même, sinon vide\"}]}\n\nCONTENU :\n" + (c.texte || "(voir l'image)");
    const opts = {};
    if (c.image) { const b = await (await fetch("data:" + (c.media_type || "image/jpeg") + ";base64," + c.image)).blob(); opts.images = [b]; }
    const r = await sample(p, opts), t = r.text || "", v = JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1));
    let n = 0;
    for (const x of v.elements || []) {
      if (!x.titre || !/^\d{4}-\d{2}-\d{2}$/.test(x.jour || "") || x.jour < AUJ) continue;
      if (x.achat) { S.achats.push({ id: uid(), texte: x.titre, pour: x.jour, fait: false }); n++; continue; }
      if (S.elements.some((e) => e.titre.toLowerCase() === x.titre.toLowerCase() && e.jour === x.jour)) continue;
      S.elements.push({ id: uid(), genre: GENRE[x.genre] ? x.genre : "activite", titre: x.titre, jour: x.jour, heure: /^\d{2}:\d{2}$/.test(x.heure || "") ? x.heure : null,
        enfant: x.enfant || "", question: x.question || "", source: c.image ? "Photo" : "Message collé", responsable: null, fait: false, planifie: false });
      n++;
    }
    demoSauver();
    return { ajoutes: n };
  }

  // =====================================================================
  // Logique du soir
  // =====================================================================
  const nomDe = (id) => { const m = S.membres.find((x) => x.id === id); return m ? (m.id === S.moi.id ? "Moi" : m.prenom || "Coparent") : ""; };
  const momentFait = (cle) => S.moments.some((m) => m.cle === cle && m.jour === AUJ);
  function moment() {
    const auj = S.elements.find((e) => e.jour === AUJ && e.question && !momentFait(e.id));
    if (auj) return { cle: auj.id, texte: auj.question.replace(/^./, (c) => c.toUpperCase()), pourquoi: "Aujourd'hui : " + auj.titre + (auj.enfant ? " (" + auj.enfant + ")" : "") + "." };
    const p = S.gens.filter((g) => g.note && !momentFait(g.id)).sort((a, b) => (a.dernier || "").localeCompare(b.dernier || ""))[0];
    if (p) return { cle: p.id, texte: p.nom + " : " + p.note, pourquoi: p.dernier ? "Dernier moment noté le " + fmt(p.dernier) + "." : "Vous l'avez noté, et ce n'est pas encore fait." };
    return null;
  }
  function conflits() {
    if (!cal || !cal.length) return [];
    const out = [];
    S.elements.filter((e) => e.jour === DEMAIN && e.heure && !e.fait).forEach((e) => {
      const [h, m] = hm(e.heure).split(":").map(Number), t = h * 60 + m;
      cal.filter((v) => !v.journee).forEach((v) => {
        const a = v.debut.split(":").map(Number), b = v.fin.split(":").map(Number), da = a[0] * 60 + a[1], db = b[0] * 60 + b[1];
        if (da <= t + 60 && db >= t - 60) out.push(e.titre + " : vous avez « " + v.titre + " » de " + v.debut + " à " + v.fin + ".");
      });
    });
    return out;
  }
  async function chargerCal() {
    if (DEMO || !(S.prives && S.prives.ical_url)) { cal = null; return; }
    try { const r = await fonction("calendrier", { action: "demain" }); cal = r.evenements; calErr = ""; }
    catch (e) { cal = null; calErr = e.message; }
    if (onglet === "ce-soir") rendre();
  }

  // =====================================================================
  // Écrans
  // =====================================================================
  // Forfait : essai de 30 jours, puis 19,99 $ par année pour le foyer (paiement sur le site, comme Le Commis)
  function etatForfait() {
    const f = S && S.foyer; if (!f || DEMO) return { actif: true, type: "demo" };
    const now = Date.now(), essai = f.essai_fin ? new Date(f.essai_fin).getTime() : 0, paye = f.paye_jusqua ? new Date(f.paye_jusqua).getTime() : 0;
    if (paye > now) return { actif: true, type: "paye", jusqua: f.paye_jusqua };
    if (essai > now) return { actif: true, type: "essai", jours: Math.max(1, Math.ceil((essai - now) / 864e5)) };
    return { actif: false, type: "termine" };
  }
  const estProprio = () => S && S.moi && S.moi.role === "proprio";
  const lienAchat = () => `${cfg.siteUrl || "https://levestibule.ai/"}achat?foyer=${encodeURIComponent(S.foyer.id)}&nom=${encodeURIComponent(S.foyer.nom || "")}`;
  function bandeauForfait() {
    const e = etatForfait(), proprio = estProprio(), nomProprio = ((S.membres.find((m) => m.role === "proprio") || {}).prenom) || "Le propriétaire du foyer";
    const acheter = proprio ? `<a class="btn small" href="${esc(lienAchat())}" target="_blank" rel="noopener">Acheter · ${esc(cfg.prix || "19,99 $ par année")}</a>` : `<span>${esc(nomProprio)} pourra acheter l'app.</span>`;
    if (e.type === "essai" && e.jours <= 7) return `<div class="bandeau"><span><b>Essai gratuit</b> : ${e.jours} jour${e.jours > 1 ? "s" : ""} restant${e.jours > 1 ? "s" : ""}.</span>${acheter}</div>`;
    if (e.type === "termine") return `<div class="bandeau fini"><span><b>L'essai gratuit est terminé.</b> Vos données sont gardées : vous pouvez les consulter, mais plus les modifier.</span>${acheter}</div>`;
    return "";
  }
  function blocForfait() {
    const e = etatForfait(), proprio = estProprio();
    if (e.type === "demo") return "";
    const btn = proprio ? `<div class="row"><a class="btn" href="${esc(lienAchat())}" target="_blank" rel="noopener">${e.type === "paye" ? "Renouveler" : "Acheter"} · ${esc(cfg.prix || "19,99 $ par année")}</a></div>` : "";
    return `<div class="card"><h2>Forfait</h2><p>${e.type === "paye" ? `Forfait actif jusqu'au ${esc(fmt(String(e.jusqua).slice(0, 10)))}.` : e.type === "essai" ? `Essai gratuit : <b>${e.jours} jour${e.jours > 1 ? "s" : ""}</b> restant${e.jours > 1 ? "s" : ""}. Tout est ouvert.` : "L'essai gratuit est terminé : lecture seule."}</p>
      <p class="muted">Un seul paiement pour 12 mois, fait par le propriétaire du foyer. Toute la famille en profite, jusqu'à 4 personnes. Sans renouvellement automatique.</p>${btn}</div>`;
  }
  // En lecture seule, on prévient au lieu d'écrire
  const peutEcrire = () => { if (etatForfait().actif) return true; toast("L'essai est terminé : le propriétaire du foyer peut acheter l'app pour continuer."); return false; };

  function ligne(e, avecDate) {
    return `<li class="${e.fait ? "done" : ""}"><button class="check${e.fait ? " on" : ""}" data-a="el-fait" data-id="${esc(e.id)}" aria-label="${e.fait ? "Remettre à faire" : "Marquer comme fait"}"></button><div class="grow"><div class="t">${esc(e.titre)}</div><div>` +
      `<span class="tag">${esc(GENRE[e.genre] || "Note")}</span>${e.enfant ? `<span class="tag">${esc(e.enfant)}</span>` : ""}${avecDate ? `<span class="tag">${esc(fmt(e.jour))}${e.heure ? " · " + esc(hm(e.heure)) : ""}</span>` : e.heure ? `<span class="tag">${esc(hm(e.heure))}</span>` : ""}` +
      `</div><div class="row"><button class="ghost small" data-a="el-qui" data-id="${esc(e.id)}">${esc(nomDe(e.responsable) || "Qui s'en occupe?")}</button>${e.source ? `<span class="muted">${esc(e.source)}</span>` : ""}</div></div>` +
      `<button class="icon" data-a="el-suppr" data-id="${esc(e.id)}" aria-label="Supprimer">×</button></li>`;
  }

  function vueSoir() {
    const dem = S.elements.filter((e) => e.jour === DEMAIN && e.genre !== "conge");
    const bientot = S.elements.filter((e) => (e.genre === "formulaire" || e.genre === "payer") && !e.fait && dans(e.jour) > 1 && dans(e.jour) <= 3);
    const ach = S.achats.filter((a) => !a.fait && a.pour && dans(a.pour) <= 3);
    const conges = S.elements.filter((e) => e.genre === "conge" && !e.planifie && dans(e.jour) >= 1 && dans(e.jour) <= 14);
    const cf = conflits(), m = moment(), dep = S.depots.filter((d) => !d.fait);
    const vide = !dem.length && !bientot.length && !ach.length && !conges.length && !cf.length;
    const micro = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
    return `<div class="card"><h2><span class="n">1</span>Déposer le travail</h2><p class="muted">Ce qui vous trotte dans la tête. Ça vous attendra demain matin.</p>
      <textarea id="depot" placeholder="Rappeler le fournisseur, finir la présentation…">${esc(brouillon)}</textarea>
      <div class="row">${micro ? `<button class="ghost" data-a="micro" id="micro">Dicter</button>` : ""}<button data-a="deposer">Déposer</button></div>
      ${micro ? "" : `<p class="muted" style="margin-top:8px">Astuce : le micro du clavier permet de dicter.</p>`}
      ${dep.length ? `<ul class="list" style="margin-top:10px">${dep.map((d) => `<li><button class="check" data-a="dep-fait" data-id="${esc(d.id)}" aria-label="Réglé"></button><div class="grow">${esc(d.texte)}<div class="muted">Déposé ${esc(d.jour === AUJ ? "aujourd'hui" : fmt(d.jour))}</div></div></li>`).join("")}</ul>` : ""}</div>
    <div class="card"><h2><span class="n">2</span>Demain à la maison</h2>
      ${cf.map((c) => `<p class="alerte">Conflit : ${esc(c)}</p>`).join("")}
      ${dem.length ? `<ul class="list">${dem.map((e) => ligne(e, false)).join("")}</ul>` : ""}
      ${bientot.length ? `<div class="date">BIENTÔT</div><ul class="list">${bientot.map((e) => ligne(e, true)).join("")}</ul>` : ""}
      ${ach.length ? `<div class="date">À ACHETER</div><ul class="list">${ach.map((a) => `<li><button class="check" data-a="ach-fait" data-id="${esc(a.id)}" aria-label="Acheté"></button><div class="grow"><div class="t">${esc(a.texte)}</div><span class="tag warn">Pour ${esc(fmt(a.pour))}</span></div></li>`).join("")}</ul>` : ""}
      ${conges.map((c) => `<div class="row" style="justify-content:space-between"><span><b>${esc(c.titre)}</b> dans ${dans(c.jour)} jours (${esc(fmt(c.jour))}). Rien de prévu pour les enfants?</span><button class="ghost small" data-a="conge-prevu" data-id="${esc(c.id)}">C'est prévu</button></div>`).join("")}
      ${vide ? `<p class="muted">Rien pour demain. Bonne soirée.</p>` : ""}
      ${cal ? `<p class="muted" style="margin-top:8px">Votre calendrier demain : ${cal.length ? esc(cal.filter((v) => !v.journee).slice(0, 4).map((v) => v.debut + " " + v.titre).join(", ") || "rien d'heure fixe") : "rien"}</p>` : calErr ? `<p class="muted">${esc(calErr)}</p>` : ""}</div>
    <div class="card"><h2><span class="n">3</span>Un moment ce soir</h2>
      ${m ? `<div class="moment">${LUCIE}<div><div class="qui">Lucie vous suggère</div>${esc(m.texte)}<div class="why">${esc(m.pourquoi)}</div></div></div><div class="row"><button data-a="m-fait" data-cle="${esc(m.cle)}">C'est fait</button><button class="ghost" data-a="m-pas" data-cle="${esc(m.cle)}">Pas ce soir</button></div>`
        : `<p class="muted">Ajoutez quelqu'un dans Gens, ou laissez l'école me donner des idées. — Lucie</p>`}</div>`;
  }

  function vueEcole() {
    const avenir = S.elements.filter((e) => e.genre !== "conge" && dans(e.jour) >= 0).sort((a, b) => (a.jour + (a.heure || "")).localeCompare(b.jour + (b.heure || "")));
    let jour = "", liste = "";
    for (const e of avenir) { if (e.jour !== jour) { liste += (jour ? "</ul>" : "") + `<div class="date">${esc(fmt(e.jour).toUpperCase())}</div><ul class="list">`; jour = e.jour; } liste += ligne(e, false); }
    if (jour) liste += "</ul>";
    const conges = S.elements.filter((e) => e.genre === "conge" && dans(e.jour) >= 0).sort((a, b) => a.jour.localeCompare(b.jour));
    const adr = `famille-${S.foyer.code_courriel}@${cfg.domaineCourriel || "levestibule.ai"}`;
    return `<div class="card"><h2>Ajouter des messages de l'école</h2><p class="muted">Claude en retire les dates et les choses à faire. Le texte des messages n'est pas conservé.</p>
      <div class="row"><label class="btn" style="margin:0">Photo ou capture<input type="file" accept="image/*" id="photo" hidden></label></div>
      <textarea id="coller" placeholder="Ou collez un message de Mozaïk, de Clic école ou du groupe de la classe" style="margin-top:10px"></textarea>
      <div class="row"><button class="ghost" data-a="extraire"${occupe ? " disabled" : ""}>Lire le message</button></div>
      <div class="status" aria-live="polite">${esc(occupe || statut)}</div>
      ${S.foyer.dernier_courriel ? `<p class="muted">Dernier courriel de l'école reçu : ${esc(new Date(S.foyer.dernier_courriel).toLocaleString("fr-CA", { dateStyle: "medium", timeStyle: "short" }))}.</p>`
        : `<p class="muted" style="margin-top:6px">Les courriels transférés à <b>${esc(adr)}</b> arrivent ici tout seuls. <button class="lien" data-a="aller" data-o="reglages">Comment faire</button></p>`}</div>
    <div class="card"><h2>À venir</h2>${liste || `<p class="muted">Rien à venir pour l'instant.</p>`}</div>
    <div class="card"><h2>Calendrier scolaire</h2>
      ${conges.length ? `<ul class="list">${conges.map((c) => `<li><div class="grow"><div class="t">${esc(c.titre)}</div><span class="tag">${esc(fmt(c.jour))}</span>${c.planifie ? `<span class="tag">Prévu</span>` : ""}</div><button class="icon" data-a="el-suppr" data-id="${esc(c.id)}" aria-label="Supprimer">×</button></li>`).join("")}</ul>` : `<p class="muted">Aucun congé noté.</p>`}
      <p class="muted" style="margin-top:8px">Collez le calendrier annuel de votre centre de services scolaire (journées pédagogiques et congés) dans la boîte ci-dessus, ou prenez-le en photo.</p></div>`;
  }

  function vueAchats() {
    const l = S.achats.slice().sort((a, b) => (a.fait - b.fait) || (a.pour || "9").localeCompare(b.pour || "9"));
    return `<div class="card"><h2>À acheter</h2><div class="row"><input id="ach-t" placeholder="Carton à affiche, costume…" maxlength="160"><input id="ach-d" type="date" style="flex:0 1 170px" aria-label="Pour quand"><button data-a="ach-ajout">Ajouter</button></div>
      <ul class="list" style="margin-top:8px">${l.map((a) => `<li class="${a.fait ? "done" : ""}"><button class="check${a.fait ? " on" : ""}" data-a="ach-fait" data-id="${esc(a.id)}" aria-label="Acheté"></button><div class="grow"><div class="t">${esc(a.texte)}</div>${a.pour ? `<span class="tag${dans(a.pour) <= 3 && !a.fait ? " warn" : ""}">Pour ${esc(fmt(a.pour))}</span>` : ""}</div><button class="icon" data-a="ach-suppr" data-id="${esc(a.id)}" aria-label="Supprimer">×</button></li>`).join("")}</ul>
      ${l.length ? "" : `<p class="muted">Rien à acheter.</p>`}</div>`;
  }

  function vueGens() {
    return `<div class="card"><h2>Les gens qui comptent</h2><p class="muted">Notez ce que vous voulez leur dire ou leur demander. Lucie vous le rappellera au bon moment.</p>
      <div class="row"><input id="g-n" placeholder="Nom" style="flex:0 1 140px" maxlength="60"><input id="g-t" placeholder="Lui demander comment s'est passée l'entrevue" maxlength="300"><button data-a="g-ajout">Ajouter</button></div>
      <ul class="list" style="margin-top:8px">${S.gens.map((g) => `<li><div class="grow"><div class="t">${esc(g.nom)}</div><div>${esc(g.note)}</div>${g.dernier ? `<div class="muted">Dernier moment : ${esc(fmt(g.dernier))}</div>` : ""}</div><button class="icon" data-a="g-suppr" data-id="${esc(g.id)}" aria-label="Supprimer">×</button></li>`).join("")}</ul></div>`;
  }

  function vueReglages() {
    const f = S.foyer, moi = S.moi, adr = `famille-${f.code_courriel}@${cfg.domaineCourriel || "levestibule.ai"}`;
    const exp = f.expediteurs.split(",").map((s) => s.trim()).filter(Boolean);
    const filtre = exp.length ? `from:(${exp.join(" OR ")})` : "";
    const lienCal = DEMO ? "" : `${cfg.supabaseUrl}/functions/v1/calendrier?jeton=${f.jeton_calendrier}`;
    return `<div class="card"><h2>Vous</h2>
      <label for="r-prenom">Votre prénom</label><input id="r-prenom" value="${esc(moi.prenom || "")}" maxlength="40">
      <label for="r-fin">Fin habituelle de votre journée de travail</label><input id="r-fin" type="time" value="${esc(hm(moi.fin_travail) || "17:30")}">
      <label class="inline"><input type="checkbox" id="r-soir"${moi.rappel_soir !== false ? " checked" : ""}> Rappel du soir à cette heure (lundi au vendredi)</label>
      <label class="inline"><input type="checkbox" id="r-matin"${moi.rappel_matin !== false ? " checked" : ""}> Rappel vers 7 h, seulement si quelque chose doit partir avec un enfant</label>
      <div class="row"><button data-a="r-moi">Enregistrer</button>${DEMO ? "" : `<button class="ghost" data-a="notif">Activer les notifications sur ce téléphone</button>`}</div>
      <p class="muted" id="notif-etat" style="margin-top:8px"></p></div>

    <div class="card"><h2>La famille</h2>
      <h3>Enfants</h3><ul class="list">${S.enfants.map((e) => `<li><div class="grow t">${esc(e.prenom)}</div><button class="icon" data-a="enf-suppr" data-id="${esc(e.id)}" aria-label="Retirer">×</button></li>`).join("")}</ul>
      <div class="row"><input id="enf-p" placeholder="Prénom" maxlength="40"><button class="ghost" data-a="enf-ajout">Ajouter</button></div>
      <h3>Coparent</h3><ul class="list">${S.membres.map((m) => `<li><div class="grow"><div class="t">${esc(m.id === moi.id ? (m.prenom || "Moi") + " (vous)" : m.prenom || "Coparent")}</div>${m.user_id ? "" : `<div class="muted">Invité : ${esc(m.telephone || "")}. Il se connecte avec son compte L’Établi, sur ce numéro.</div>`}</div>${m.id === moi.id ? "" : `<button class="icon" data-a="mem-suppr" data-id="${esc(m.id)}" aria-label="Retirer">×</button>`}</li>`).join("")}</ul>
      ${S.membres.length < 4 ? `<div class="row"><input id="mem-p" placeholder="Prénom" style="flex:0 1 140px" maxlength="40"><input id="mem-t" type="tel" placeholder="Cellulaire" autocomplete="off"><button class="ghost" data-a="mem-ajout">Inviter</button></div>` : ""}
      <p class="muted" style="margin-top:8px">Vous voyez tous les deux les mêmes éléments, et chacun peut en prendre un. Ce que vous déposez du travail reste à vous.</p></div>

    <div class="card"><h2>Les courriels de l'école</h2>
      <p>Votre adresse de transfert :</p><div class="adresse">${esc(adr)}</div><div class="row"><button class="ghost small" data-a="copier" data-t="${esc(adr)}">Copier l'adresse</button></div>
      <h3>Dans Gmail, une seule fois</h3>
      <ol class="etapes"><li>Ouvrez Gmail sur un ordinateur : Paramètres, <b>Voir tous les paramètres</b>, onglet <b>Transfert et POP/IMAP</b>, puis <b>Ajouter une adresse de transfert</b>. Collez l'adresse ci-dessus.</li>
        <li>Gmail envoie un code de confirmation à cette adresse. ${f.confirmation_gmail ? `Il est arrivé : <a class="btn small" href="${esc(/^https:\/\//.test(f.confirmation_gmail) ? f.confirmation_gmail : "#")}" target="_blank" rel="noopener">Confirmer le transfert</a>` : `Il apparaîtra ici dans une minute ou deux, avec un bouton pour confirmer.`}</li>
        <li>Créez un filtre avec les adresses de l'école, puis choisissez <b>Transférer à</b> votre adresse du Vestibule. Ne transférez pas tout votre courriel : seulement l'école.</li></ol>
      <label for="r-exp">Adresses de l'école (séparées par des virgules)</label><input id="r-exp" value="${esc(f.expediteurs)}" placeholder="ecole-du-quartier.qc.ca, enseignante@…">
      <div class="row"><button class="ghost small" data-a="r-exp">Enregistrer</button></div>
      ${filtre ? `<p style="margin-top:8px">Recherche à coller dans le filtre Gmail :</p><div class="adresse">${esc(filtre)}</div><div class="row"><button class="ghost small" data-a="copier" data-t="${esc(filtre)}">Copier la recherche</button></div>` : ""}
      <p class="muted" style="margin-top:8px">Avec Outlook ou une autre boîte, créez une règle de transfert vers la même adresse. Les messages de Mozaïk ou de Clic école qui n'arrivent pas par courriel : faites une capture et ajoutez-la dans l'onglet École.</p></div>

    <div class="card"><h2>Les calendriers</h2>
      <h3>Voir les conflits avec votre agenda</h3>
      <p class="muted">Google Agenda sur ordinateur : Paramètres, choisissez votre agenda, puis <b>Adresse secrète au format iCal</b>. Collez-la ici. Elle reste à vous : votre coparent ne la voit pas.</p>
      <div class="row"><input id="r-ical" type="url" value="${esc((S.prives && S.prives.ical_url) || "")}" placeholder="https://calendar.google.com/calendar/ical/…/basic.ics"><button class="ghost" data-a="r-ical">Enregistrer</button></div>
      ${lienCal ? `<h3>L'école dans votre agenda</h3><p class="muted">Abonnez-vous à ce lien (Google Agenda : Autres agendas, +, À partir de l'URL; iPhone : Réglages, Calendrier, Comptes, Ajouter un calendrier avec abonnement).</p>
        <div class="adresse">${esc(lienCal)}</div><div class="row"><button class="ghost small" data-a="copier" data-t="${esc(lienCal)}">Copier le lien</button></div>` : ""}</div>

    ${blocForfait()}
    <div class="card"><h2>${DEMO ? "Mode démo" : "Compte"}</h2>
      ${DEMO ? `<p class="muted">Les données d'exemple restent sur cet appareil.</p><div class="row"><button class="ghost" data-a="demo-vider">Tout effacer</button><button class="ghost" data-a="demo-exemple">Remettre l'exemple</button></div>`
        : `<p class="muted">Fuseau horaire : ${esc(f.fuseau)}</p><div class="row"><button class="ghost" type="button" data-hai-inviter>Inviter quelqu'un</button><button class="ghost" data-a="deconnexion">Se déconnecter</button><a class="btn ghost" href="${esc(HoldingAI.compteUrl)}" target="_blank" rel="noopener">Mon compte L’Établi</a></div>`}</div>`;
  }

  function vueAccueil(etat) {
    if (etat === "creer") return `<section class="accueil">${LUCIE}<h1>Bienvenue au vestibule.</h1><p class="grand">Je suis Lucie. Chaque soir, une minute entre le travail et la maison. Commençons par la famille : l'essai est gratuit pendant 30 jours.</p>
      <form id="f-foyer"><label for="c-prenom">Votre prénom</label><input id="c-prenom" required maxlength="40" autocomplete="given-name" value="${esc(prenomCompte)}">
      <label for="c-enf">Prénoms des enfants (séparés par des virgules)</label><input id="c-enf" placeholder="Léa, Hugo" maxlength="200">
      <div class="row"><button type="submit">C'est parti</button></div></form><p class="status">${esc(statut)}</p>
      <p class="muted">Votre coparent vous a invité? Connectez-vous avec le même cellulaire que celui qu'il a inscrit. <button class="lien" data-a="deconnexion">Changer de compte</button></p></section>`;
    return `<section class="accueil">${LUCIE}<h1>Le Vestibule</h1><p class="grand">Laissez le travail à la porte. L'école, le calendrier et les gens qui comptent, en une minute chaque soir, avec Lucie.</p>
      <div class="row"><button data-a="connexion">Continuer avec L’Établi</button></div><p class="status">${esc(statut)}</p>
      <p class="muted">Le même compte que vos autres apps de L’Établi.</p></section>`;
  }

  function rendre() {
    const h = new Date().getHours(), salut = h < 12 ? "Bon matin" : h < 17 ? "Bonjour" : "Bonsoir";
    if (!S || S.accueil) { $app.innerHTML = vueAccueil(S && S.accueil); brancher(); return; }
    const vues = { "ce-soir": vueSoir, ecole: vueEcole, acheter: vueAchats, gens: vueGens, reglages: vueReglages };
    if (!vues[onglet]) onglet = "ce-soir";
    const titre = onglet === "ce-soir" ? "Laissez le travail ici." : ONGLETS.find((o) => o[0] === onglet)[1];
    const prenom = S.moi && S.moi.prenom;
    $app.innerHTML = `<header class="hero">${DEMO ? "" : `<button type="button" class="hai-porte-btn" data-hai-porte aria-label="Mon compte (Albert, L’Établi)" title="Mon compte"></button>`}<p>${esc(salut + (prenom && prenom !== "Moi" ? ", " + prenom : ""))} · ${esc(fmt(AUJ))}</p><h1>${esc(titre)}</h1><p>${onglet === "ce-soir" ? "Une minute, puis la maison." : "Le Vestibule, avec Lucie"}</p>
      <svg viewBox="0 0 150 130" aria-hidden="true"><rect x="62" y="18" width="62" height="112" rx="4" fill="rgba(255,255,255,.12)"/><rect x="70" y="26" width="46" height="104" fill="#fbd9a8" class="lamp"/><path d="M70 26 L52 34 L52 130 L70 130 Z" fill="rgba(255,255,255,.22)"/><circle cx="57" cy="84" r="2.5" fill="#fff"/><path d="M116 130 L150 130 L150 96 Z" fill="rgba(251,217,168,.25)" class="lamp"/><circle cx="135" cy="22" r="6" fill="#f0725c"/></svg></header>
      ${DEMO ? `<div class="bandeau"><span>Mode démo : données d'exemple sur cet appareil.</span></div>` : bandeauForfait()}
      <main>${vues[onglet]()}</main>
      <nav class="onglets" aria-label="Onglets"><div class="in">${ONGLETS.map((o) => `<a href="#${o[0]}" class="${o[0] === onglet ? "on" : ""}"${o[0] === onglet ? ' aria-current="page"' : ""}>${o[1]}</a>`).join("")}</div></nav>`;
    brancher();
  }

  function brancher() {
    const ph = document.getElementById("photo"); if (ph) ph.onchange = surPhoto;
    const dp = document.getElementById("depot"); if (dp) dp.oninput = (e) => { brouillon = e.target.value; };
    const ff = document.getElementById("f-foyer"); if (ff) ff.onsubmit = creerFoyer;
    if (onglet === "reglages") etatNotif();
  }

  // =====================================================================
  // Actions
  // =====================================================================
  const val = (id) => ((document.getElementById(id) || {}).value || "").trim();
  async function lire(corps, source) {
    if (!peutEcrire()) return;
    occupe = source === "photo" ? "Claude lit l'image…" : "Claude lit le message…"; statut = ""; rendre();
    try {
      const r = await fonction("extraire", corps);
      occupe = ""; statut = r.ajoutes ? `${r.ajoutes} élément${r.ajoutes > 1 ? "s" : ""} ajouté${r.ajoutes > 1 ? "s" : ""}.` : "Rien de daté ou à faire dans ce message.";
      if (!DEMO) await charger();
    } catch (e) { occupe = ""; statut = e.message || "La lecture n'a pas fonctionné."; }
    rendre();
  }
  // Photo réduite (1600 px au plus) avant l'envoi
  async function surPhoto(ev) {
    const f = ev.target.files && ev.target.files[0]; if (!f) return;
    try {
      const img = await new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = URL.createObjectURL(f); });
      const k = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement("canvas"); c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      const data = c.toDataURL("image/jpeg", 0.85).split(",")[1];
      await lire({ image: data, media_type: "image/jpeg" }, "photo");
    } catch (e) { statut = "Cette image n'a pas pu être lue."; rendre(); }
  }
  let reco = null;
  function micro() {
    const R = window.SpeechRecognition || window.webkitSpeechRecognition; if (!R) return;
    if (reco) { reco.stop(); return; }
    reco = new R(); reco.lang = "fr-CA"; reco.interimResults = true; reco.continuous = true;
    const base = brouillon ? brouillon.trim() + " " : "";
    let fin = "";
    const mettre = (t) => { brouillon = t; const el = document.getElementById("depot"); if (el) el.value = t; };
    reco.onresult = (e) => { let inter = ""; for (let i = e.resultIndex; i < e.results.length; i++) { if (e.results[i].isFinal) fin += e.results[i][0].transcript + " "; else inter += e.results[i][0].transcript; } mettre(base + fin + inter); };
    reco.onend = () => { reco = null; const b = document.getElementById("micro"); if (b) b.textContent = "Dicter"; };
    reco.onerror = () => { toast("La dictée n'est pas disponible ici. Utilisez le micro du clavier."); };
    try { reco.start(); const b = document.getElementById("micro"); if (b) b.textContent = "Arrêter"; } catch (e) { reco = null; }
  }
  async function creerFoyer(e) {
    e.preventDefault();
    const prenom = val("c-prenom"), enfants = val("c-enf").split(",").map((s) => s.trim()).filter(Boolean);
    if (!prenom) return;
    statut = "Création de votre foyer…"; rendre();
    const { error } = await sb.rpc("creer_foyer", { p_prenom: prenom, p_enfants: enfants, p_fuseau: fuseauAppareil() });
    if (error) { statut = String(error.message || "").includes("deja_membre") ? "Vous faites déjà partie d'un foyer." : "Le foyer n'a pas pu être créé. Réessayez."; rendre(); return; }
    statut = ""; await demarrerSession(); location.hash = "#reglages";
  }

  // Notifications (Web Push), comme Le Commis
  const urlB64 = (b) => { const p = "=".repeat((4 - (b.length % 4)) % 4), s = atob((b + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from([...s].map((c) => c.charCodeAt(0))); };
  async function etatNotif() {
    const el = document.getElementById("notif-etat"); if (!el || DEMO) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      el.textContent = /iPhone|iPad/.test(navigator.userAgent) && !navigator.standalone ? "Sur iPhone, ajoutez d'abord l'app à l'écran d'accueil (Partager, Sur l'écran d'accueil), puis ouvrez-la depuis son icône." : "Ce navigateur ne permet pas les notifications. Utilisez l'app installée sur l'écran d'accueil.";
      return;
    }
    if (Notification.permission === "denied") { el.textContent = "Les notifications sont bloquées. Autorisez-les dans les réglages du téléphone."; return; }
    const reg = await navigator.serviceWorker.ready, sub = await reg.pushManager.getSubscription();
    el.textContent = sub ? "Notifications activées sur ce téléphone." : "Notifications pas encore activées sur ce téléphone.";
  }
  async function activerNotif() {
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) return etatNotif();
      if ((await Notification.requestPermission()) !== "granted") return etatNotif();
      const { cle } = await fonction("rappel", { action: "cle" });
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64(cle) });
      const j = sub.toJSON();
      const { error } = await sb.from("abonnements").upsert({ endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth }, { onConflict: "endpoint" });
      if (error) throw error;
      await fonction("rappel", { action: "test" });
      toast("Notifications activées : un essai vient d'être envoyé.");
    } catch (e) { toast("Les notifications n'ont pas pu être activées. Vérifiez que l'app est installée sur l'écran d'accueil."); }
    etatNotif();
  }

  document.addEventListener("click", async (ev) => {
    const b = ev.target.closest("[data-a]"); if (!b) return;
    const a = b.dataset.a, id = b.dataset.id;
    const el = () => S.elements.find((x) => x.id === id);
    switch (a) {
      case "connexion": b.disabled = true; try { await HoldingAI.connecter(); } catch (e) { statut = "La connexion n'a pas pu démarrer. Réessayez."; b.disabled = false; rendre(); } break;
      case "deconnexion": if (!DEMO) { HoldingAI.deconnexion(); location.reload(); } break;
      case "aller": location.hash = "#" + b.dataset.o; break;
      case "copier": copier(b.dataset.t); break;
      case "micro": micro(); break;
      case "deposer": { const t = val("depot"); if (!t) return; brouillon = ""; await ajouter("depots", { texte: t.slice(0, 2000), jour: AUJ, fait: false }); toast("Déposé. Ça vous attendra demain."); break; }
      case "dep-fait": modifier("depots", id, { fait: true }); break;
      case "el-fait": modifier("elements", id, { fait: !el().fait }); break;
      case "el-suppr": supprimer("elements", id); break;
      case "el-qui": { // personne → moi → l'autre parent → personne
        const ordre = [null, S.moi.id].concat(S.membres.filter((m) => m.id !== S.moi.id && m.user_id).map((m) => m.id));
        const i = ordre.indexOf(el().responsable || null); modifier("elements", id, { responsable: ordre[(i + 1) % ordre.length] }); break;
      }
      case "conge-prevu": modifier("elements", id, { planifie: true }); break;
      case "m-fait": case "m-pas": {
        const cle = b.dataset.cle; await ajouter("moments", { cle, jour: AUJ, fait: a === "m-fait" });
        const g = S.gens.find((x) => x.id === cle); if (g && a === "m-fait") modifier("gens", g.id, { dernier: AUJ });
        break;
      }
      case "ach-ajout": { const t = val("ach-t"); if (!t) return; ajouter("achats", { texte: t, pour: val("ach-d") || null, fait: false }); break; }
      case "ach-fait": { const x = S.achats.find((y) => y.id === id); modifier("achats", id, { fait: !x.fait }); break; }
      case "ach-suppr": supprimer("achats", id); break;
      case "g-ajout": { const n = val("g-n"), t = val("g-t"); if (!n) return; ajouter("gens", { nom: n, note: t, dernier: null }); break; }
      case "g-suppr": supprimer("gens", id); break;
      case "extraire": { const t = val("coller"); if (!t) return; lire({ texte: t.slice(0, 20000) }, "texte"); break; }
      case "r-moi": await modifier("membres", S.moi.id, { prenom: val("r-prenom"), fin_travail: val("r-fin") || "17:30", rappel_soir: document.getElementById("r-soir").checked, rappel_matin: document.getElementById("r-matin").checked });
        toast("Enregistré."); break;
      case "notif": activerNotif(); break;
      case "enf-ajout": { const p = val("enf-p"); if (!p) return; ajouter("enfants", { prenom: p, ordre: S.enfants.length + 1 }); break; }
      case "enf-suppr": supprimer("enfants", id); break;
      case "mem-ajout": { const p = val("mem-p"), t = val("mem-t"); if (!p || !t) return toast("Entrez le prénom et le cellulaire."); ajouter("membres", { prenom: p, telephone: t, foyer_id: S.foyer.id }); toast("Invité. Il se connecte avec son compte L’Établi, sur ce cellulaire."); break; }
      case "mem-suppr": supprimer("membres", id); break;
      case "r-exp": modifier("foyers", S.foyer.id, { expediteurs: val("r-exp") }); toast("Enregistré."); break;
      case "r-ical": {
        const u = val("r-ical");
        if (u && !/^https:\/\//.test(u.replace(/^webcal:/, "https:"))) return toast("L'adresse doit commencer par https://");
        S.prives.ical_url = u.replace(/^webcal:/, "https:") || null;
        if (DEMO) { demoSauver(); toast("Enregistré. Les conflits s'affichent une fois l'app en ligne."); break; }
        const { error } = await sb.from("prives").upsert({ ical_url: S.prives.ical_url, maj: new Date().toISOString() });
        if (error) { erreurBase(error); break; }
        toast("Enregistré."); chargerCal(); break;
      }
      case "demo-vider": S = exemple(); Object.assign(S, { elements: [], achats: [], gens: [], depots: [], moments: [] }); S.moi = S.membres[0]; demoSauver(); rendre(); break;
      case "demo-exemple": S = exemple(); S.moi = S.membres[0]; demoSauver(); location.hash = "#ce-soir"; rendre(); break;
    }
  });
  window.addEventListener("hashchange", () => { onglet = (location.hash || "#ce-soir").slice(1); statut = ""; rendre(); window.scrollTo(0, 0); });
  // Retour dans l'app le lendemain : les dates avancent
  document.addEventListener("visibilitychange", async () => {
    if (document.visibilityState !== "visible" || !S || S.accueil) return;
    const n = iso(new Date());
    if (n !== AUJ) { AUJ = n; DEMAIN = plus(AUJ, 1); if (!DEMO) await charger(); chargerCal(); }
    rendre();
  });

  // =====================================================================
  // Démarrage
  // =====================================================================
  async function demarrerSession() {
    const ok = await charger();
    if (!ok) { S = { accueil: "creer" }; rendre(); return; }
    rendre(); ecouter(); chargerCal();
  }
  (async () => {
    if (DEMO) { await charger(); rendre(); return; }
    const dep = await (window.VESTIBULE_DEMARRAGE || Promise.resolve({}));
    if (dep && dep.redirection) return; // on part chez Albert (compte HoldingAI) et on revient
    const s = await HoldingAI.session();
    if (!s) { S = null; statut = dep && dep.erreur ? "La connexion n'a pas fonctionné. Réessayez." : ""; rendre(); return; }
    prenomCompte = s.nom || "";
    await demarrerSession();
    if (new URLSearchParams(location.search).has("acheter") && S && S.foyer && estProprio()) { history.replaceState(null, "", location.pathname + location.hash); location.href = lienAchat(); }
  })();

  /* Mise à jour : quand une nouvelle version est publiée (VERSION dans sw.js), l'app propose « Mettre à jour ». */
  if ("serviceWorker" in navigator && location.protocol === "https:" && !DEMO) {
    navigator.serviceWorker.register("/sw.js").then((reg) => {
      const offrir = (w) => { const t = document.getElementById("maj"); t.hidden = false; document.getElementById("maj-btn").onclick = () => w.postMessage("activer"); };
      if (reg.waiting && navigator.serviceWorker.controller) offrir(reg.waiting);
      reg.addEventListener("updatefound", () => {
        const w = reg.installing;
        w && w.addEventListener("statechange", () => { if (w.state === "installed" && navigator.serviceWorker.controller) offrir(w); });
      });
      setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
      document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") reg.update().catch(() => {}); });
    }).catch(() => {});
    let recharge = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => { if (!recharge) { recharge = true; location.reload(); } });
  }
})();
