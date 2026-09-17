// redirect-worker (syntaxe service-worker classique — compatible upload API mono-partie
// Content-Type: application/javascript ; la variante module exige un multipart metadata fragile).
// 301 apex + www.delegpharma.com -> https://app.delegpharma.com
// Zéro droit CF supplémentaire : le token a deja Workers Scripts Write + Workers Routes Write ;
// l'API Redirect Rules (/rulesets) exige un droit Rulesets que le token n'a pas (403 verifie 17/09).
// Branche par route Worker sur delegpharma.com/* et www.delegpharma.com/* (les A @/www sont proxied=true).
"use strict";
addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  const target = "https://app.delegpharma.com" + url.pathname + url.search;
  event.respondWith(Response.redirect(target, 301));
});
