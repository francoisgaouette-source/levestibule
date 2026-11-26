// Le Vestibule : compte HoldingAI obligatoire (norme commune à toutes les apps HoldingAI).
// Démarrage commun (holdingai.js) : retour de chez Philou, puis le compte suit. Sans session : barrière de Philou (porte.js).
// app.js attend window.VESTIBULE_DEMARRAGE pour savoir qui est connecté.
window.VESTIBULE_DEMARRAGE = (async () => {
  "use strict";
  const cfg = window.VESTIBULE_CONFIG || {};
  if (!cfg.supabaseUrl) return { session: null, demo: true }; // mode démonstration : pas de compte
  const dep = await HoldingAI.demarrer({ obligatoire: true });
  if (dep.redirection) return dep;
  window.HOLDINGAI_PORTE = {
    app: "le-vestibule", nomApp: "Le Vestibule", personnage: "Lucie",
    connecte: !!dep.session, prenom: dep.session ? dep.session.nom : "",
    surDeconnexion: () => { HoldingAI.deconnexion(); location.reload(); },
  };
  if (!dep.session) {
    window.HOLDINGAI_PORTE.barriere = true;
    if (window.HoldingAIPorte) HoldingAIPorte.barriere();
  }
  return dep;
})();
