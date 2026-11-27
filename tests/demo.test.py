# Test de bout en bout du Vestibule en mode démonstration (sans Supabase), et des pages du site.
# Lancer : python3 tests/demo.test.py   (Playwright requis)
import http.server, threading, functools, os
from playwright.sync_api import sync_playwright
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'web')
OUT = os.path.dirname(os.path.abspath(__file__))
class Silencieux(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 8766), functools.partial(Silencieux, directory=ROOT))
threading.Thread(target=srv.serve_forever, daemon=True).start()
ok = True
def check(c, m):
    global ok
    print(('OK   ' if c else 'ÉCHEC ') + m); ok = ok and c
U = 'http://127.0.0.1:8766'
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 390, 'height': 844})
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    for motif in ['**/cdn.jsdelivr.net/**', '**/compte.letabli.ai/**', '**/fonts.googleapis.com/**']:
        pg.route(motif, lambda r: r.fulfill(body='', content_type='text/javascript'))
    # Mode démonstration : config.js sans Supabase
    pg.route(U + '/config.js', lambda r: r.fulfill(content_type='text/javascript', body='window.VESTIBULE_CONFIG={nom:"Le Vestibule",supabaseUrl:"",domaineCourriel:"levestibule.ai",siteUrl:"https://levestibule.ai/",prix:"19,99 $ par année"};window.APP_CONFIG={HOLDINGAI:{clientId:"",app:"le-vestibule"}};'))
    # En ligne, le site sert /site.css et /favicon.png à la racine (functions/_middleware.js)
    pg.route(U + '/site.css', lambda r: r.fulfill(path=os.path.join(ROOT, 'site', 'site.css'), content_type='text/css'))
    pg.goto(U + '/#ce-soir'); pg.wait_for_selector('.hero h1')
    check('Laissez le travail ici.' in pg.inner_text('.hero h1'), 'écran Ce soir')
    check('Catherine vous suggère' in pg.inner_text('.moment'), 'Catherine propose un moment')
    pg.screenshot(path=f'{OUT}/mobile-ce-soir.png', full_page=True)
    pg.fill('#depot', 'Rappeler le fournisseur'); pg.click('[data-a=deposer]')
    check('Rappeler le fournisseur' in pg.inner_text('main'), 'dépôt du travail')
    pg.locator('[data-a=el-qui]').first.click()
    check(pg.locator('[data-a=el-qui]').first.inner_text() == 'Moi', 'prendre un élément')
    pg.click('[data-a=m-fait]')
    check('Papa' in pg.inner_text('.moment') or 'Marie' in pg.inner_text('.moment'), 'moment suivant après « C\'est fait »')
    pg.goto(U + '/#ecole'); pg.wait_for_timeout(150)
    check('famille-a1b2c3d4@levestibule.ai' in pg.inner_text('main'), 'adresse de transfert de la famille')
    pg.goto(U + '/#acheter'); pg.wait_for_timeout(150)
    pg.fill('#ach-t', 'Colle en bâton'); pg.click('[data-a=ach-ajout]')
    check('Colle en bâton' in pg.inner_text('main'), 'achat ajouté')
    pg.goto(U + '/#gens'); pg.wait_for_timeout(150)
    pg.fill('#g-n', 'Sophie'); pg.fill('#g-t', 'Lui demander pour son entrevue'); pg.click('[data-a=g-ajout]')
    check('Sophie' in pg.inner_text('main'), 'personne ajoutée')
    pg.goto(U + '/#reglages'); pg.wait_for_timeout(150)
    pg.fill('#r-prenom', 'Francois'); pg.click('[data-a=r-moi]')
    pg.fill('#r-exp', 'ecole-des-pins.qc.ca, mme.tremblay@cssdm.gouv.qc.ca'); pg.click('[data-a=r-exp]'); pg.wait_for_timeout(150)
    check('from:(ecole-des-pins.qc.ca OR mme.tremblay@cssdm.gouv.qc.ca)' in pg.inner_text('main'), 'recherche du filtre Gmail')
    pg.screenshot(path=f'{OUT}/mobile-reglages.png', full_page=True)
    pg.reload(); pg.wait_for_selector('.hero')
    check('Francois' in pg.inner_text('.hero'), 'données gardées après rechargement')
    pg.set_viewport_size({'width': 360, 'height': 740}); pg.goto(U + '/#ce-soir'); pg.wait_for_timeout(150)
    check(pg.evaluate('document.documentElement.scrollWidth') <= 360, 'rien ne déborde à 360 px')
    # Site
    for nom in ['index', 'comment-ca-marche', 'catherine', 'questions', 'achat', 'confidentialite', 'conditions', '404']:
        pg.set_viewport_size({'width': 390, 'height': 844})
        pg.goto(f'{U}/site/{nom}.html'); pg.wait_for_timeout(80)
        check(pg.evaluate('document.documentElement.scrollWidth') <= 390 and len(pg.inner_text('main')) > 100, f'site : {nom}')
    pg.goto(U + '/site/achat.html'); check('Les ventes ouvrent bientôt' in pg.inner_text('main'), 'achat : ventes pas encore ouvertes')
    pg.set_viewport_size({'width': 1280, 'height': 900}); pg.goto(U + '/site/index.html'); pg.wait_for_timeout(100)
    pg.screenshot(path=f'{OUT}/site-accueil.png', full_page=True)
    check(not errs, 'aucune erreur JavaScript ' + (str(errs) if errs else ''))
    b.close()
srv.shutdown()
print('TOUT EST BON' if ok else 'IL Y A DES ÉCHECS')
