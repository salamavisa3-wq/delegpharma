// redirect-worker (syntaxe service-worker classique — compatible upload API mono-partie
// Content-Type: application/javascript ; la variante module exige un multipart metadata fragile).
// 301 apex + www.delegpharma.com -> https://app.delegpharma.com
// Zéro droit CF supplémentaire : le token a deja Workers Scripts Write + Workers Routes Write ;
// l'API Redirect Rules (/rulesets) exige un droit Rulesets que le token n'a pas (403 verifie 17/09).
// Branche par route Worker sur delegpharma.com/* et www.delegpharma.com/* (les A @/www sont proxied=true).
"use strict";

// Pages de l'ancien WordPress (connues de Google) → page thématique équivalente de l'app.
// Sans cette table, le chemin préservé tombait en 301 → 404 sur l'app (erreurs GSC, 24/09).
const LEGACY = {
  "/contact": "/contact",
  "/espace-laboratoire": "/laboratoires",
  "/espace-manager": "/tarifs",
  "/campagnes": "/blog/objectifs-campagnes-chiffre-affaires-laboratoire",
  "/tournees": "/blog/tournees-terrain-delegue-medical",
  "/referentiel": "/carte-sanitaire",
  "/mes-visites": "/blog/crv-compte-rendu-de-visite-guide",
  "/nouvelle-visite": "/blog/crv-compte-rendu-de-visite-guide",
  "/espace-dm": "/delegue-medical",
};

addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  let target;
  if (LEGACY[path]) target = LEGACY[path];
  // Résidus WordPress (flux, login, xmlrpc, ?p=/?page_id=…) → accueil sans query.
  else if (/^\/(wp-|feed|comments|xmlrpc\.php|sample-page|author|category|tag)/.test(path) ||
           (path === "/" && /(^|&)(p|page_id|cat|s|feed)=/.test(url.search.slice(1)))) target = "/";
  else target = path + url.search;
  event.respondWith(Response.redirect("https://app.delegpharma.com" + target, 301));
});
