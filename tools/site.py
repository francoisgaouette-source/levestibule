# Génère les pages du site levestibule.ai (dossier web/site/).
# Lancer : python3 tools/site.py   — puis pousser sur GitHub.
import os, datetime

ICI = os.path.dirname(os.path.abspath(__file__))
SORTIE = os.path.join(ICI, '..', 'web', 'site')
APP = 'https://app.levestibule.ai'
COURRIEL = 'bonjour@levestibule.ai'
MAJ = '25 novembre 2026'
PRIX = '19,99 $'
STRIPE = ''  # lien de paiement Stripe (buy.stripe.com/…) : vide = « Les ventes ouvrent bientôt »

LUCIE = '''<img class="charlotte" src="/charlotte-tete.webp" alt="" width="320" height="320">'''

PORTE = '''<svg class="porte" viewBox="0 0 150 130" aria-hidden="true"><rect x="62" y="18" width="62" height="112" rx="4" fill="rgba(255,255,255,.12)"/><rect x="70" y="26" width="46" height="104" fill="#fbd9a8"/><path d="M70 26 L52 34 L52 130 L70 130 Z" fill="rgba(255,255,255,.22)"/><circle cx="57" cy="84" r="2.5" fill="#fff"/><circle cx="135" cy="22" r="6" fill="#f0725c"/></svg>'''

PAGES = [('/', 'Accueil'), ('/comment-ca-marche', 'Comment ça marche'), ('/charlotte', 'Charlotte'), ('/questions', 'Questions'), ('/achat', 'Prix')]

def page(chemin, titre, description, corps, script=''):
    nav = ''.join(f'<a href="{c}"{" aria-current=\"page\"" if c == chemin else ""}>{t}</a>' for c, t in PAGES[1:])
    return f'''<!DOCTYPE html>
<html lang="fr-CA">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{titre}</title>
<meta name="description" content="{description}">
<meta property="og:title" content="{titre}">
<meta property="og:description" content="{description}">
<meta property="og:type" content="website">
<meta property="og:url" content="https://levestibule.ai{chemin}">
<meta name="theme-color" content="#234e6b">
<link rel="icon" href="/favicon.png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/site.css">
</head>
<body>
<header class="nav"><div class="wrap">
  <a class="logo" href="/">{LUCIE}Le Vestibule</a>
  <nav class="liens" aria-label="Site">{nav}<a class="ouvrir" href="{APP}">Ouvrir l'app</a></nav>
</div></header>
<main>
{corps}
</main>
<footer><div class="wrap">
  <span>© {datetime.date.today().year} Le Vestibule, une app de L’Établi (Les Stratégies Vortex Inc.) · Fait au Québec</span>
  <nav aria-label="Pied de page"><a href="/questions">Questions</a><a href="/confidentialite">Confidentialité</a><a href="/conditions">Conditions</a><a href="mailto:{COURRIEL}">{COURRIEL}</a></nav>
</div></footer>
{script}
</body>
</html>
'''

ACCUEIL = f'''<section class="hero"><div class="wrap">
  <div>
    <h1>Laissez le travail à la porte.</h1>
    <p class="lead">Chaque soir, Charlotte vous accueille au vestibule : une minute pour déposer le travail, voir ce qu'il faut pour demain à l'école, et penser à quelqu'un qui compte.</p>
    <div class="actions"><a class="btn plein" href="{APP}">Essayer 30 jours gratuitement</a><a class="btn clair" href="/comment-ca-marche">Comment ça marche</a></div>
  </div>
  <div class="carte" aria-label="Exemple de soirée">
    <div class="carte-tete">{PORTE}<span>Ce soir · 17 h 30</span></div>
    <p class="etape"><b>1</b> Déposer le travail</p>
    <p class="note">« Rappeler le fournisseur demain matin. »</p>
    <p class="etape"><b>2</b> Demain à la maison</p>
    <ul><li>Jour de bibliothèque : rapporter le livre (Léa)</li><li>Vêtements d'éducation physique (Hugo)</li><li class="alerte">Sortie hâtive jeudi à 14 h 30 : vous avez un appel à 14 h</li></ul>
    <p class="etape"><b>3</b> Un moment ce soir</p>
    <div class="dit">{LUCIE}<div class="bulle"><small>Charlotte vous suggère</small>Aujourd'hui, c'était la sortie au musée. Demandez à Léa ce qu'elle a préféré.</div></div>
    <p class="exemple">Exemple</p>
  </div>
</div></section>

<section class="bande"><div class="wrap">
  <h2>Les courriels de l'école, enfin à leur place</h2>
  <div class="grille">
    <div class="bloc"><div class="num">L'école</div><h3>Rien à recopier</h3><p>Les courriels de l'école sont transférés à l'adresse de votre famille. Charlotte en retire les dates, les choses à apporter, les formulaires et les paiements.</p></div>
    <div class="bloc"><div class="num">Les photos</div><h3>La feuille du sac à dos</h3><p>Une photo de l'avis papier, ou une capture de Mozaïk ou de Clic école, et c'est noté.</p></div>
    <div class="bloc"><div class="num">L'agenda</div><h3>Les conflits, d'avance</h3><p>Une sortie hâtive pendant une réunion? Charlotte vous le dit la veille. Les congés et journées pédagogiques arrivent aussi d'avance.</p></div>
    <div class="bloc"><div class="num">À deux</div><h3>Le coparent voit tout</h3><p>Chacun peut prendre un élément : « je m'occupe du formulaire ». La charge mentale se partage enfin.</p></div>
  </div>
</div></section>

<section class="bande teinte"><div class="wrap">
  <div class="grille trois">
    <div><h2>Une minute, pas plus</h2><p>Un rappel à l'heure où vous quittez le travail, et un autre le matin seulement si quelque chose doit partir avec un enfant.</p></div>
    <div><h2>Les gens qui comptent</h2><p>Notez ce que vous voulez dire à votre père ou demander à une amie : Charlotte vous le rappelle au bon moment. Sans culpabilité si ce n'est pas ce soir.</p></div>
    <div><h2>Vos données restent à vous</h2><p>Le texte des courriels n'est pas conservé : seulement les dates et les choses à faire. Ce que vous déposez du travail reste privé, même pour le coparent.</p></div>
  </div>
</div></section>

<section class="bande"><div class="wrap narrow" style="text-align:center">
  <h2>30 jours gratuits, puis {PRIX} par année pour la famille</h2>
  <p>Jusqu'à 4 personnes dans le foyer. Un seul paiement, sans renouvellement automatique. Avec le compte L’Établi, le même que pour vos autres apps.</p>
  <p><a class="btn plein" href="{APP}">Commencer l'essai</a></p>
</div></section>'''

COMMENT = f'''<section class="bande"><div class="wrap narrow prose">
  <h1>Comment ça marche</h1>
  <p>Le Vestibule tient en un moment par jour : la fin de votre journée de travail. Voici comment le mettre en place, puis comment se passe un soir.</p>
  <div class="grille" style="margin:28px 0">
    <div class="bloc"><div class="num">1</div><h3>Créez votre foyer</h3><p>Connectez-vous avec votre compte L’Établi, entrez le prénom des enfants et l'heure où finit votre journée.</p></div>
    <div class="bloc"><div class="num">2</div><h3>Branchez l'école</h3><p>Dans Gmail ou Outlook, un filtre transfère les courriels de l'école à l'adresse de votre famille. L'app vous guide pas à pas.</p></div>
    <div class="bloc"><div class="num">3</div><h3>Invitez le coparent</h3><p>Avec son cellulaire. Vous voyez les mêmes éléments, et chacun peut en prendre un.</p></div>
    <div class="bloc"><div class="num">4</div><h3>Chaque soir, une minute</h3><p>Charlotte vous fait signe : déposer le travail, demain à la maison, un moment pour quelqu'un.</p></div>
  </div>
  <h2>Les messages qui n'arrivent pas par courriel</h2>
  <p>Bien des écoles du Québec passent par Mozaïk Portail ou Clic école. Faites une capture d'écran du message, ou prenez en photo la feuille du sac à dos, et ajoutez-la dans l'onglet École : Charlotte la lit de la même façon.</p>
  <h2>Votre agenda</h2>
  <p>Collez l'adresse secrète iCal de votre agenda (Google, Outlook ou Apple) pour que Charlotte repère les conflits avec l'école. Et abonnez-vous au calendrier de l'école de votre famille pour le voir dans votre propre agenda.</p>
  <h2>Installer l'app</h2>
  <p><strong>iPhone</strong> : ouvrez <a href="{APP}">app.levestibule.ai</a> dans Safari, touchez le bouton Partager, puis « Sur l'écran d'accueil ». Ouvrez l'app depuis son icône pour recevoir les rappels.</p>
  <p><strong>Android</strong> : ouvrez l'adresse dans Chrome, puis le menu ⋮ et « Installer l'application ».</p>
  <h2>Qui lit les messages de l'école?</h2>
  <p>Une intelligence artificielle (Claude, d'Anthropic) lit chaque message pour en retirer les dates et les choses à faire, puis le texte est oublié. Une lecture automatique peut se tromper : un coup d'œil au message original reste une bonne idée pour ce qui est important.</p>
  <p><a class="btn plein" href="{APP}">Ouvrir l'app</a></p>
</div></section>'''

LUCIE_PAGE = f'''<section class="bande"><div class="wrap">
  <div class="charlotte-grand"><img class="portrait" src="/charlotte.webp" alt="Charlotte, dessinée dans une cuisine, sourit et salue de la main." width="600" height="800"><div class="prose">
    <h1>Voici Charlotte</h1>
    <p>Charlotte est le personnage du Vestibule. Elle vous attend chaque soir à la porte, pendant que vous enlevez vos bottes : douce, attentive, et très bien organisée.</p>
    <p>Elle a lu les courriels de l'école pour vous, sait ce qui doit partir dans les sacs demain et se souvient que vous vouliez appeler votre père. Elle ne fait jamais la morale : si ce n'est pas ce soir, ce sera un autre soir.</p>
    <p>Charlotte fait partie de la famille des personnages de L’Établi, avec Simon du Pourquoi, LP du Tiroir, Colette du Plumeau et les autres.</p>
    <p><a class="btn plein" href="{APP}">Rencontrer Charlotte</a></p>
  </div></div>
</div></section>'''

QR = [
 ("Combien ça coûte?", f"L'essai est gratuit pendant 30 jours, avec tout ouvert. Ensuite, {PRIX} par année pour tout le foyer (jusqu'à 4 personnes), plus les taxes. Un seul paiement, fait par le propriétaire du foyer, sans renouvellement automatique. Après l'essai, sans paiement, vos données restent consultables, mais plus modifiables."),
 ("Faut-il un compte?", "Oui : le compte L’Établi, le même pour toutes les apps de L’Établi (Le Commis, Le Pourquoi…). Votre coparent utilise le sien."),
 ("L'app lit-elle toute ma boîte courriel?", "Non. Elle n'a aucun accès à votre boîte. Elle reçoit seulement les messages que votre filtre transfère à l'adresse de la famille : ceux de l'école."),
 ("Que gardez-vous des courriels?", "Seulement ce qui en a été retiré : la date, le titre, l'enfant concerné et d'où ça vient (par exemple « Courriel : Sortie au musée »). Le texte et les pièces jointes ne sont pas conservés."),
 ("Et Mozaïk ou Clic école?", "Si l'école vous écrit aussi par courriel, le filtre suffit. Sinon, faites une capture d'écran du message et ajoutez-la dans l'onglet École."),
 ("Mon coparent voit-il tout?", "Il voit l'école, les achats et les gens à qui penser. Ce que vous déposez du travail et l'adresse de votre agenda restent à vous seul."),
 ("Les rappels arrivent quand?", "Du lundi au vendredi, à l'heure où finit votre journée de travail (le dimanche aussi s'il y a quelque chose pour lundi). Le matin vers 7 h, seulement si quelque chose doit partir avec un enfant. Sur iPhone, ouvrez l'app depuis l'écran d'accueil pour les recevoir."),
 ("Et si Charlotte se trompe?", "Une lecture automatique peut mal comprendre une date. Chaque élément montre d'où il vient; vous pouvez le corriger, le cocher ou le supprimer en un geste."),
 ("Comment vous joindre?", f"Écrivez-nous à {COURRIEL}."),
]
QUESTIONS = '<section class="bande"><div class="wrap narrow"><h1>Questions</h1>' + ''.join(f'<details><summary>{q}</summary><p>{r}</p></details>' for q, r in QR) + f'<p style="margin-top:24px"><a class="btn plein" href="{APP}">Ouvrir l\'app</a></p></div></section>'

ACHAT = f'''<section class="bande"><div class="wrap">
  <h1>Le Vestibule pour votre famille</h1>
  <p class="lead">Un seul paiement pour 12 mois, fait par le propriétaire du foyer. Toute la famille en profite, jusqu'à 4 personnes.</p>
  <div class="achat">
    <div class="bloc">
      <h3>Ce qui est inclus</h3>
      <ul><li>Jusqu'à 4 personnes dans le foyer</li><li>Lecture des courriels, photos et captures de l'école</li><li>Rappels du soir et du matin</li><li>Conflits avec votre agenda, calendrier de l'école dans le vôtre</li><li>Charlotte, en français</li></ul>
      <h3>Comment ça marche</h3>
      <ol><li><b>Ouvrez cette page depuis l'app</b> : le bouton « Acheter » indique votre foyer.</li><li><b>Payez par carte</b> sur la page sécurisée de Stripe. Vous recevez un reçu par courriel.</li><li><b>Revenez dans l'app</b> : votre foyer est activé pour 12 mois, tout seul.</li></ol>
    </div>
    <div class="bloc commande">
      <h3>Forfait Famille</h3>
      <p class="prix"><span id="prix">{PRIX}</span> <small>par année, + TPS et TVQ</small></p>
      <p id="pour" hidden></p>
      <p id="bientot" hidden>Les ventes ouvrent bientôt. Votre essai de 30 jours continue d'ici là.</p>
      <label class="accord"><input type="checkbox" id="accord"> <span>J'ai lu et j'accepte les <a href="/conditions" target="_blank" rel="noopener">conditions d'utilisation</a>.</span></label>
      <a class="btn plein" id="payer" href="#" aria-disabled="true" rel="noopener">Payer par carte</a>
      <p class="petit">Paiement unique, sans renouvellement automatique. Paiement sécurisé par Stripe : nous ne voyons jamais votre numéro de carte.</p>
    </div>
  </div>
</div></section>'''
ACHAT_JS = f'''<script>
(function () {{
  var q = new URLSearchParams(location.search), foyer = q.get('foyer') || '', nom = q.get('nom') || '', lien = {STRIPE!r};
  var payer = document.getElementById('payer'), accord = document.getElementById('accord'), pour = document.getElementById('pour');
  if (nom) {{ pour.textContent = 'Pour le foyer « ' + nom + ' ».'; pour.hidden = false; }}
  if (!lien) {{ document.getElementById('bientot').hidden = false; accord.disabled = true; return; }}
  if (!/^[0-9a-f-]{{36}}$/i.test(foyer)) {{
    pour.textContent = 'Connectez-vous ou créez votre compte : on revient ensuite ici pour payer, au nom de votre foyer.'; pour.hidden = false;
    accord.closest('label').hidden = true; payer.textContent = 'Continuer'; payer.setAttribute('aria-disabled', 'false'); payer.href = '{APP}/?acheter'; return;
  }}
  var url = lien + (lien.indexOf('?') >= 0 ? '&' : '?') + 'client_reference_id=' + encodeURIComponent(foyer);
  accord.addEventListener('change', function () {{ payer.setAttribute('aria-disabled', String(!accord.checked)); payer.href = accord.checked ? url : '#'; }});
  payer.addEventListener('click', function (e) {{ if (payer.getAttribute('aria-disabled') === 'true') e.preventDefault(); }});
}})();
</script>'''

CONFID = f'''<section class="bande"><div class="wrap narrow prose">
  <h1>Confidentialité</h1>
  <p class="maj">Dernière mise à jour : {MAJ}</p>
  <p>Le Vestibule touche à la vie de famille. Nous gardons le moins possible, et seulement ce qui sert à l'app.</p>
  <h2>Ce que nous gardons</h2>
  <ul>
    <li><strong>Votre compte L’Établi</strong> : prénom et cellulaire, pour vous reconnaître et vous relier à votre foyer.</li>
    <li><strong>Le foyer</strong> : le prénom des enfants (aucune date de naissance, aucune école nommée), les membres invités par leur cellulaire, l'heure de fin de journée et vos choix de rappels.</li>
    <li><strong>Ce qui vient de l'école</strong> : pour chaque élément, la date, un titre court, le prénom de l'enfant s'il est indiqué, et sa provenance (« Courriel : Sortie au musée », « Photo »).</li>
    <li><strong>Vos notes</strong> : la liste d'achats, les gens à qui penser, et ce que vous déposez du travail (visible par vous seul).</li>
    <li><strong>L'adresse secrète de votre agenda</strong>, si vous la fournissez : visible par vous seul, utilisée pour lire les événements du lendemain.</li>
  </ul>
  <h2>Ce que nous ne gardons pas</h2>
  <ul><li>Le texte des courriels, des messages collés et des photos : ils sont lus une fois, puis oubliés.</li><li>Le contenu de votre agenda : seuls les événements du lendemain sont lus, au moment d'ouvrir l'app.</li><li>Aucun accès à votre boîte courriel : l'app reçoit seulement ce que votre filtre lui transfère.</li><li>Aucun témoin publicitaire.</li></ul>
  <h2>Nos fournisseurs</h2>
  <ul><li><strong>Anthropic</strong> (Claude) lit les messages de l'école pour en retirer les dates et les choses à faire. Les données envoyées ne servent pas à entraîner ses modèles.</li><li><strong>Supabase</strong> héberge la base de données au Canada.</li><li><strong>Cloudflare</strong> sert le site et l'app, et reçoit les courriels transférés.</li><li><strong>Stripe</strong> traite les paiements : nous ne voyons jamais votre numéro de carte.</li></ul>
  <p>Certains fournisseurs peuvent traiter des données hors du Québec. Nous leur transmettons seulement ce qui est décrit ici.</p>
  <h2>Vos droits</h2>
  <p>Vous pouvez consulter, corriger ou supprimer vos renseignements, et demander la suppression de votre foyer. Responsable de la protection des renseignements personnels (Loi 25) : écrivez à <a href="mailto:{COURRIEL}">{COURRIEL}</a>.</p>
</div></section>'''

COND = f'''<section class="bande"><div class="wrap narrow prose">
  <h1>Conditions d'utilisation</h1>
  <p class="maj">Dernière mise à jour : {MAJ}</p>
  <h2>Le service</h2>
  <p>Le Vestibule, une app de L’Établi (Les Stratégies Vortex Inc.), aide les familles à organiser la fin de la journée : messages de l'école, achats, rappels et notes personnelles. Il faut un compte L’Établi.</p>
  <h2>Essai et forfait</h2>
  <p>L'essai gratuit dure 30 jours. Le forfait coûte {PRIX} par année pour un foyer (jusqu'à 4 personnes), plus les taxes applicables. C'est un paiement unique pour 12 mois, sans renouvellement automatique. Après l'essai ou à la fin du forfait, les données restent consultables mais ne peuvent plus être modifiées.</p>
  <h2>Une aide, pas une garantie</h2>
  <p>Les éléments tirés des messages de l'école sont produits par une lecture automatique et peuvent contenir des erreurs ou des oublis. Le message original de l'école fait foi. Vérifiez ce qui est important (dates, paiements, autorisations).</p>
  <h2>Utilisation</h2>
  <p>Transférez seulement les messages de l'école de vos enfants. N'utilisez pas l'adresse de la famille pour d'autres courriels, et ne tentez pas de contourner la sécurité du service.</p>
  <h2>Responsabilité</h2>
  <p>Dans la mesure permise par la loi, L’Établi n'est pas responsable des dommages découlant d'un élément manqué ou mal lu. Ces conditions sont régies par les lois du Québec.</p>
  <h2>Nous joindre</h2>
  <p><a href="mailto:{COURRIEL}">{COURRIEL}</a></p>
</div></section>'''

INTROUVABLE = f'''<section class="bande"><div class="wrap narrow" style="text-align:center">
  <div style="width:110px;margin:0 auto 12px">{LUCIE}</div>
  <h1>Cette porte ne mène nulle part</h1>
  <p>La page a peut-être changé d'adresse. Charlotte vous attend quand même à l'entrée.</p>
  <p><a class="btn plein" href="{APP}">Ouvrir l'app</a> <a class="btn clair" href="/">Retour à l'accueil</a></p>
</div></section>'''

FICHIERS = {
  'index.html': page('/', "Le Vestibule : une minute entre le travail et la maison", "Chaque soir, Charlotte vous aide à déposer le travail, voir ce qu'il faut pour l'école demain et penser à quelqu'un qui compte. 30 jours gratuits.", ACCUEIL),
  'comment-ca-marche.html': page('/comment-ca-marche', "Comment ça marche · Le Vestibule", "Les courriels de l'école transférés, les photos du sac à dos, votre agenda et le coparent : la mise en place en quatre étapes.", COMMENT),
  'charlotte.html': page('/charlotte', "Charlotte · Le Vestibule", "Charlotte, celle qui vous attend chaque soir à la porte.", LUCIE_PAGE),
  'questions.html': page('/questions', "Questions · Le Vestibule", "Prix, compte, courriels de l'école, Mozaïk, coparent, rappels : les réponses aux questions fréquentes.", QUESTIONS),
  'achat.html': page('/achat', "Acheter · Le Vestibule", f"{PRIX} par année pour toute la famille, après 30 jours gratuits.", ACHAT, ACHAT_JS),
  'confidentialite.html': page('/confidentialite', "Confidentialité · Le Vestibule", "Le texte des courriels n'est pas conservé : ce que Le Vestibule garde, et ce qu'il ne garde pas.", CONFID),
  'conditions.html': page('/conditions', "Conditions · Le Vestibule", "Conditions d'utilisation du Vestibule.", COND),
  '404.html': page('/404', "Page introuvable · Le Vestibule", "Cette page n'existe pas.", INTROUVABLE),
}
os.makedirs(SORTIE, exist_ok=True)
for nom, html in FICHIERS.items():
    with open(os.path.join(SORTIE, nom), 'w', encoding='utf-8') as f:
        f.write(html)
with open(os.path.join(SORTIE, 'robots.txt'), 'w') as f:
    f.write('User-agent: *\nAllow: /\nSitemap: https://levestibule.ai/sitemap.xml\n')
with open(os.path.join(SORTIE, 'sitemap.xml'), 'w') as f:
    urls = ''.join(f'<url><loc>https://levestibule.ai{c if c != "/" else "/"}</loc></url>' for c in ['/', '/comment-ca-marche', '/charlotte', '/questions', '/achat', '/confidentialite', '/conditions'])
    f.write(f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{urls}</urlset>\n')
print('Site généré :', ', '.join(FICHIERS))
