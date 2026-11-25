// Le Vestibule : reçoit les courriels de l'école (l'app et le site sont sur Cloudflare Pages).
// Tout ce qui arrive à @levestibule.ai passe ici (Email Routing, règle « catch-all »).
//   famille-<code>@levestibule.ai → fonction Supabase « courriel-ecole » (secret COURRIEL_SECRET), qui en retire les dates et les tâches.
//   Toute autre adresse (bonjour@…) → copie vers la boîte personnelle (secret COPIE_COURRIEL), si elle est réglée.
// Secrets du Worker : SUPABASE_URL (https://VOTRE-PROJET.supabase.co), COURRIEL_SECRET, COPIE_COURRIEL (facultatif).

const MAX_BRUT = 15 * 1024 * 1024; // au-delà, le message est refusé (pièces jointes trop lourdes)

async function lireBrut(flux, max) {
  const lecteur = flux.getReader(), morceaux = [];
  let n = 0;
  for (;;) {
    const { done, value } = await lecteur.read();
    if (done) break;
    n += value.length;
    if (n > max) { await lecteur.cancel().catch(() => {}); return null; }
    morceaux.push(value);
  }
  const tout = new Uint8Array(n); let o = 0;
  for (const m of morceaux) { tout.set(m, o); o += m.length; }
  return tout;
}

async function recevoir(message, env) {
  const a = String(message.to || "").toLowerCase();
  if (!/^famille-[a-z0-9]{8}@/.test(a)) {
    if (env.COPIE_COURRIEL) return message.forward(env.COPIE_COURRIEL);
    return message.setReject("Adresse inconnue");
  }
  const brut = await lireBrut(message.raw, MAX_BRUT);
  if (!brut) return message.setReject("Message trop volumineux");
  if (!env.SUPABASE_URL || !env.COURRIEL_SECRET) throw new Error("SUPABASE_URL ou COURRIEL_SECRET absent");
  const r = await fetch(`${env.SUPABASE_URL}/functions/v1/courriel-ecole`, {
    method: "POST", body: brut,
    headers: { "Content-Type": "message/rfc822", "X-Courriel-Secret": env.COURRIEL_SECRET,
      "X-Enveloppe-De": encodeURIComponent(message.from || ""), "X-Enveloppe-A": encodeURIComponent(a) },
  });
  // Erreur passagère : on lève une exception pour que le serveur expéditeur réessaie plus tard
  if (r.status >= 500) throw new Error("courriel-ecole " + r.status);
}

export default {
  async email(message, env) {
    await recevoir(message, env);
  },
};
