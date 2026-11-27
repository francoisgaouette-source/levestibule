# Le Vestibule

Une minute entre le travail et la maison, avec **Charlotte**. Chaque soir : déposer le travail, voir ce qu'il faut pour demain à l'école, et penser à quelqu'un qui compte.

App de HoldingAI, avec le compte HoldingAI (obligatoire, comme toutes les apps HoldingAI). **Essai de 30 jours, puis 19,99 $ par année** pour le foyer (jusqu'à 4 personnes), comme Le Commis. Après l'essai, sans paiement : lecture seule.

- **levestibule.ai** : le site (accueil, comment ça marche, Charlotte, questions, prix et achat, confidentialité, conditions). www redirige vers levestibule.ai.
- **app.levestibule.ai** : l'app installable.
- **famille-<code>@levestibule.ai** : l'adresse de chaque famille, où un filtre Gmail ou Outlook transfère les courriels de l'école.

Un seul projet Cloudflare Pages sert le site et l'app : `functions/_middleware.js` envoie levestibule.ai vers `web/site/`. Les pages du site se génèrent avec `python3 tools/site.py`.
Un petit Worker (`worker/`, `wrangler.jsonc`) reçoit les courriels, parce que Pages ne peut pas en recevoir.

## Ce que fait l'app

| Onglet | Rôle |
|---|---|
| Ce soir | 1. Déposer le travail (écrit ou dicté, privé). 2. Demain à la maison : école, formulaires et paiements qui approchent, achats, congés à prévoir, conflits avec l'agenda. 3. Un moment proposé par Charlotte. |
| École | Ce qui vient des courriels transférés, d'une photo (feuille du sac à dos, capture de Mozaïk ou Clic école) ou d'un message collé. Chaque élément montre d'où il vient et qui s'en occupe. |
| À acheter, Gens | Achats avec date limite; les gens à qui penser. |
| Réglages | Prénom, heure de fin de journée, rappels, enfants, coparent (invité par cellulaire), transfert Gmail pas à pas (avec le lien de confirmation de Gmail), agenda personnel (adresse iCal), abonnement au calendrier de l'école, forfait. |

Rappels : notification à la fin de la journée de travail de chacun (lundi au vendredi, et le dimanche s'il y a quelque chose pour lundi), et vers 7 h seulement si quelque chose doit partir avec un enfant.

Le texte des courriels, messages et photos n'est jamais conservé : seuls les éléments trouvés (date, titre, enfant, provenance). L'app n'a aucun accès à la boîte courriel.

## Ce qu'il y a dedans

| Dossier | Rôle |
|---|---|
| `web/` | L'app : `index.html`, `app.js`, `style.css`, `config.js`, `compte.js` (compte HoldingAI obligatoire), `holdingai.js` (identique dans toutes les apps), `sw.js` (cache, mises à jour, notifications), `manifest.webmanifest`, `icons/`, `_headers` |
| `web/site/` | Le site, généré par `tools/site.py` |
| `functions/_middleware.js` | Cloudflare Pages : levestibule.ai → le site |
| `worker/`, `wrangler.jsonc` | Worker « levestibule-courriel » : reçoit les courriels de l'école |
| `supabase/migrations/` | Tables, sécurité (chaque foyer ne voit que lui; écriture pendant l'essai ou si payé), temps réel, rappels aux 15 minutes |
| `supabase/functions/` | `extraire` (photo ou message collé), `courriel-ecole`, `rappel` (notifications), `calendrier` (abonnement .ics et agenda personnel), `stripe-webhook`; `_commun/` |
| `tests/` | Test Playwright de l'app et du site (`python3 tests/demo.test.py`) |

Sans `supabaseUrl` dans `web/config.js`, l'app roule en mode démonstration (données d'exemple sur l'appareil, sans compte).

## En place

- Projet Supabase **Le Vestibule** (`jjvwwstovcrqodridfuu`, Canada) : tables, sécurité, temps réel et rappel aux 15 minutes installés; fonctions `extraire`, `courriel-ecole`, `rappel`, `calendrier` et `stripe-webhook` déployées (sans vérification JWT). Adresse et clé publique dans `web/config.js`. Secrets `ANTHROPIC_API_KEY` et `COURRIEL_SECRET` enregistrés.
- Connexion par compte HoldingAI : Third-Party Auth > Custom OIDC (émetteur `https://wwakxuzuhmdmweluafiz.supabase.co/auth/v1`) activé sur le projet Le Vestibule.
- En ligne : https://levestibule.ai (site) et https://app.levestibule.ai (app), Cloudflare Pages **le-vestibule** relié à ce dépôt (sortie `web`, sans build).
- Worker **levestibule-courriel** relié à ce dépôt (Workers Builds) ; `SUPABASE_URL` dans `wrangler.jsonc`. Email Routing de levestibule.ai actif : DNS en place, règle catch-all → ce Worker.
- App inscrite dans HoldingAI Compte (`le-vestibule`, personnage Charlotte, client OAuth public `7a34d46b-ee67-4e92-8b24-5e7f5124a77a`, retour https://app.levestibule.ai/).

À faire :

1. **Secret du Worker** `levestibule-courriel` : `COURRIEL_SECRET` (la même valeur que dans Supabase), dans Settings > Variables and Secrets, type Secret. Facultatif : `COPIE_COURRIEL`.
2. **Stripe** : lien de paiement à 19,99 $ (+ taxes), à mettre dans `STRIPE` de `tools/site.py` (puis `python3 tools/site.py` et push). Webhook : `https://jjvwwstovcrqodridfuu.supabase.co/functions/v1/stripe-webhook`, événement `checkout.session.completed`, secret `STRIPE_WEBHOOK_SECRET` dans Supabase.
3. Faire relire conditions et confidentialité.

## Mise en ligne (automatique, une fois branché)

Chaque `git push` sur `main` publie le site et l'app. Pour que les gens voient la mise à jour, changer `VERSION` dans `web/sw.js` : l'app affiche alors « Nouvelle version du Vestibule · Mettre à jour ».
Les fonctions se déploient à part (commande ci-dessus).

## Coûts

Une lecture de message, c'est un appel à Claude (`claude-haiku-5-5` par défaut, réglable avec `MODEL_EXTRACTION`) : une fraction de cent. Les coûts sont notés dans `couts_ia` (`app = 'vestibule'`) et les paiements dans `console_paiements`, pour la console HoldingAI.
