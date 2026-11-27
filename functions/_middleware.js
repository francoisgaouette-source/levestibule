// Un seul projet Cloudflare Pages (« le-vestibule ») sert deux choses :
// - levestibule.ai : le site (fichiers de web/site/)
// - app.levestibule.ai (et le-vestibule.pages.dev) : l'app (web/)
// www.levestibule.ai redirige vers levestibule.ai.
const PAGES = {
  "/": "/site/", "/comment-ca-marche": "/site/comment-ca-marche", "/charlotte": "/site/charlotte", "/lucie": "/site/charlotte", "/catherine": "/site/charlotte", "/questions": "/site/questions",
  "/achat": "/site/achat", "/confidentialite": "/site/confidentialite", "/conditions": "/site/conditions",
};
const FICHIERS = ["/site.css", "/favicon.png", "/robots.txt", "/sitemap.xml", "/charlotte.webp", "/charlotte-tete.webp"];
const SECURITE = { "X-Content-Type-Options": "nosniff", "Referrer-Policy": "strict-origin-when-cross-origin", "X-Frame-Options": "DENY" };

export async function onRequest({ request, env, next }) {
  const url = new URL(request.url);
  if (url.hostname === "www.levestibule.ai") {
    return Response.redirect(`https://levestibule.ai${url.pathname}${url.search}`, 301);
  }
  if (url.hostname !== "levestibule.ai") return next();

  const chemin = url.pathname.replace(/\.html$/, "").replace(/(.)\/$/, "$1");
  let cible = PAGES[chemin] || (FICHIERS.includes(chemin) ? "/site" + chemin : null);
  let statut = 200;
  if (!cible) { cible = "/site/404"; statut = 404; }
  let r = await env.ASSETS.fetch(new Request(new URL(cible, url.origin), { headers: request.headers }));
  // Pages peut répondre par une redirection (adresses « propres ») : on la suit une fois, côté serveur.
  if (r.status >= 300 && r.status < 400 && r.headers.get("Location")) {
    r = await env.ASSETS.fetch(new Request(new URL(r.headers.get("Location"), url.origin), { headers: request.headers }));
  }
  const h = new Headers(r.headers);
  for (const [k, v] of Object.entries(SECURITE)) h.set(k, v);
  if (statut === 404 || r.status >= 300) h.delete("Location");
  return new Response(r.body, { status: statut === 404 ? 404 : r.status, headers: h });
}
