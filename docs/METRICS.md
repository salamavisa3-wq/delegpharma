# DelegPharma — Metrics & baseline

Fichier de suivi du skill `saas-propulsion` (Phase 5). Chaque itération hebdo :
mettre à jour les mesures, comparer à la baseline, tester UNE hypothèse.

## Baseline — 2026-09-03 (audit live skills/audit skill saas-propulsion)

| Métrique | Baseline 03/09 | Note |
|---|---|---|
| URLs au sitemap | **123** | dynamique, 200 OK |
| Redirection www/apex → app.delegpharma.com | **301** | OK, HTTPS forcé |
| Healthcheck `/healthz` | **200** | OK |
| robots.txt | OK | Allow `/`, Disallow `/api/`, sitemap référencé |
| llms.txt | **200 + complet** | produit, prix réels 5/10/15k FCFA, pages clés |
| JSON-LD home | FAQPage, SoftwareApplication, AggregateOffer, Organization | prix réels, aucun chiffre inventé |
| JSON-LD pilier `/delegue-medical` + articles | FAQPage, BreadcrumbList, WebPage, WebSite | OK |
| H1 unique par page | OK (1 h1, contenu pertinent partout) | |
| Canonicaux | self-canonical sur routes réelles | OK |
| E-E-A-T articles | dates ✅ (17-08/21-08/17 août 2026), auteur « Par DelegPharma » | nommer une personne = renforcement possible |

## Checklist phases (skill saas-propulsion) — 03/09

- [x] **Phase 0** — repo propre, auto-deploy (render.yaml), 301, healthz, baseline capturée
- [x] **Phase 1** — robots, sitemap dynamique, canoniques, JSON-LD, SSR, llms.txt
- [x] **Phase 1 — résidu** : soft-404 corrigé 03/09 (voir Findings)
- [x] **Phase 2** — GSC SA attachée, IndexNow (clé 6d9b…2d25), auto-ping + batch historiques
- [~] **Phase 3** — 19 guides + hub carte sanitaire (14 régions) + tarifs ; **maillage home manquant**
- [x] **Phase 4** — llms.txt riche, schéma citable, dates/sources dans les articles
- [ ] **Phase 5** — ce fichier ; prochaine re-mesure : 2026-09-10

## Findings prioritaires (ordre d'impact)

### P1 — Soft-404 : URL inconnue → HTTP 200 sans canonical — ✅ CORRIGÉ 03/09
`/definitely-not-a-page` (URL inexistante) renvoyait **200** + shell SPA.
`/dashboard` renvoyait 200 avec canonical vers `/` (dilution).
Conséquence : crawl budget gaspillé, pages « vides » signalées 200 à Google.
**Fix livré** (commit `1573426`) : `matchPage()` exporté depuis `seo.js`, le catch-all
serveur renvoie **HTTP 404** sur tout chemin hors routes connues (`PAGES` + `/carte-sanitaire/*`),
tout en gardant le FALLBACK noindex + canonical home comme corps de 404 (utile, jamais indexé).
Ajout d'un vrai endpoint **`/healthz`** (JSON `{ok:true}`) pour que le healthcheck survienne
au durcissement.
**Vérifié live 03/09** : 13 routes réelles → 200, 5 chemins inconnus (`/definitely-not-a-page`,
`/dashboard`, `/espace-client`, `/foo/bar/baz`, `/carte-sanitaire-totalement-faux`) → **404**,
`/healthz` → 200 JSON, robots/sitemap/llms → 200.
Observation (hors périmètre) : `/api/bogus` → 401 (router `requireAuth` monté avant le
catch-all, comportement pré-existant ; `/api/` est disallow dans robots.txt, aucun impact SEO).

### P2 — Maillage : la home ne lie ni `/blog` ni `/delegue-medical`
La home SSR ne contient (ni nav ni header) **aucun lien** vers :
- `/blog` (listing 19 guides) — aucun lien interne détecté depuis les pages vérifiées (orphelin hors sitemap)
- `/delegue-medical` (page pilier FAQPage) — **0 lien depuis la home** (mais bien maillé depuis les sous-pages : 19 liens depuis /blog, + /tarifs /carte-sanitaire /inscription /laboratoires)

Conséquence : la page la plus forte du site ne transmet pas sa puissance vers ses deux hubs
de contenu ; `/blog` découvert uniquement via sitemap.
**Fix** : ajouter `/blog` et `/delegue-medical` dans la nav/footer SSR de la home.
Hypothèse à tester : *« un lien nav home → /delegue-medical + /blog accélère leur crawlabilité
et remonte le blog dans les SERPs métier. »*

### P3 — Hubs minces (observation, pas un fix immédiat)
`/laboratoires` ≈ 88 mots, `/carte-sanitaire` ≈ 171 mots. Ce sont des hubs de listes avec
liens vers sous-pages (données réelles) → acceptable, à étoffer si le temps le permet.

## Renforcement possible (non prioritaire)
- E-E-A-T : signer les articles par une personne physique (nom + bio) plutôt que « Par DelegPharma ».

## Prochaine itération (2026-09-10)
1. ~~Corriger P1 (soft-404)~~ ✅ fait 03/09 — `/definitely-not-a-page` → 404 vérifié.
2. **Corriger P2** (maillage home → `/blog` + `/delegue-medical`) — toujours ouvert.
3. E-E-A-T : signer les articles par une personne physique (renforcement nommé).
4. Re-mesurer : sitemap, liens internes home, indexation GSC.
