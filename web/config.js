// Réglages du Vestibule. Tant que supabaseUrl est vide, l'app roule en mode démonstration
// (données d'exemple gardées sur l'appareil, sans compte).
// Compte HoldingAI obligatoire, comme toutes les apps HoldingAI. Essai de 30 jours, puis 19,99 $ par année pour le foyer.
window.VESTIBULE_CONFIG = {
  nom: "Le Vestibule",
  personnage: "Lucie",
  supabaseUrl: "https://jjvwwstovcrqodridfuu.supabase.co", // projet Supabase « Le Vestibule »
  supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impqdnd3c3RvdmNycW9kcmlkZnV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTU2MzgzNzksImV4cCI6MjExMTIxNDM3OX0.3B9X-uQeAJDDBBoqjQyZEY_NQHwk8Po6BRKQXQOA74I", // clé publique : la sécurité vient des règles de la base
  domaineCourriel: "levestibule.ai", // adresses de transfert : famille-<code>@levestibule.ai
  siteUrl: "https://levestibule.ai/",
  prix: "19,99 $ par année"
};

// Compte HoldingAI (compte.letabli.ai) : client OAuth « Le Vestibule » dans le projet HoldingAI Compte
window.APP_CONFIG = { HOLDINGAI: { clientId: "7a34d46b-ee67-4e92-8b24-5e7f5124a77a", app: "le-vestibule", retour: "https://app.levestibule.ai/" } };
