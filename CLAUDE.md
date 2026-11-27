# Le Vestibule — consignes pour Claude Code

Le Vestibule (levestibule.ai) : une minute entre le travail et la maison, avec **Charlotte**. On dépose le travail, on voit ce qu'il faut pour l'école demain, on pense à quelqu'un qui compte. Le compte est obligatoire, avec un essai de 30 jours puis un abonnement annuel pour le foyer.

Lis le README avant tout changement important.

## Particularités de ce dépôt

- Un projet Cloudflare Pages sert le site et l'app (`functions/_middleware.js` envoie levestibule.ai vers `web/site/`). Un petit Worker (`worker/`, `wrangler.jsonc`) reçoit les courriels transférés.
- **Pages du site** : elles sont générées par `python3 tools/site.py`. Modifie ce script plutôt que les fichiers HTML de `web/site/` à la main, puis régénère.
- **Confidentialité** : le texte des courriels, des messages et des photos n'est jamais conservé, seulement les éléments trouvés. L'app n'a aucun accès à la boîte courriel. Garde ces promesses.
- **Mise à jour des téléphones** : après un changement de l'app, change `VERSION` dans `web/sw.js`.
- **Tests** : `python3 tests/demo.test.py` (Playwright). Lance-le avant de pousser.
- Les fonctions Supabase (`supabase/functions/`) se redéploient à part, après un changement.

## Avec qui tu travailles

- Francois, le propriétaire. Il n'est pas développeur : réponds-lui en français, en mots simples, avec le résultat d'abord et sans jargon inutile.
- Avant toute action difficile à défaire (base de données en production, tables du compte, DNS, suppression), explique ce que tu vas faire et attends son accord.

## Famille d'apps : L'Établi

Cette app fait partie de **L'Établi**, la maison qui regroupe les apps de Francois. L'ancien nom HoldingAI reste dans le code (`holdingai.js`, `HOLDINGAI`, projet Supabase « HoldingAI Compte ») : ces noms techniques ne changent pas, les gens ne les voient jamais.

- Noms officiels des apps : L'Échange, Le Gousset, Le Pourquoi, Le Commis, Le Fanion, Le Seuil, Le Plumeau, Le Vestibule, Le Tiroir, La Voûte, La Donne, La Nostalgie, L'Escale, Le Débours. Scotland Cup est un projet à part.
- Structure commune des adresses : `<domaine>` sert le site, `app.<domaine>` sert l'app, `www.<domaine>` renvoie vers `<domaine>`. Le compte commun est à `compte.letabli.ai`.
- Les domaines sont achetés et gérés dans Cloudflare. Un nouveau domaine doit être relié à l'app dans Cloudflare avant qu'on change une adresse dans le code ou dans le compte.
- Compte commun : projet Supabase « HoldingAI Compte » (`wwakxuzuhmdmweluafiz`), dépôt `holdingai-compte`. Le projet Supabase de chaque app accepte ses jetons (Third-Party Auth > Custom OIDC). Ne touche pas aux tables de ce projet sans l'accord de Francois.
- Vocabulaire dans les apps : on dit « votre compte », jamais « compte L'Établi ». Le bouton dit « Continuer ». L'Établi n'apparaît qu'en petit : « Un seul compte pour toutes les apps de L'Établi ».
- `holdingai.js` doit rester **identique** dans toutes les apps. Ne le modifie pas dans une seule app : un changement doit être reporté partout.

## Règles communes

- Le code, les noms de variables et les commentaires sont en français, comme dans le reste du dépôt.
- Ne commite jamais de secret. La clé publique Supabase peut être dans le code ; les clés secrètes (Anthropic, Stripe, Twilio, service_role) vivent seulement dans les secrets Supabase, Cloudflare ou GitHub.
- Tiens le README à jour quand tu changes l'architecture, la mise en ligne ou la liste « À faire ».
