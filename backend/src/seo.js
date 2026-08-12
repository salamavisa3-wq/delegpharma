// DelegPharma — SEO : head complet par route + SSR des pages publiques + robots/sitemap.
// Chargé par server.js. La SPA garde son hash-routing ; ici on pré-rend le contenu public
// (crawlers / pas de JS) et on injecte meta/canonical/OG/JSON-LD dans le shell.
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { all } from './db.js';
import { NATIONAL, REGION_INFO, DISTRICT_INFO } from './carte-sanitaire.js';
import { REGIONS as REGIONS_SEED } from './seed-data.js';

const here = dirname(fileURLToPath(import.meta.url));
const BASE = 'https://app.delegpharma.com';
const SHELL = readFileSync(resolve(here, '../../frontend/index.html'), 'utf8');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const toFr = (n) => Number(n).toLocaleString('fr-FR');
const jd = (o) => JSON.stringify(o).replace(/</g, '\\u003c'); // JSON-LD sûr dans <script>
// Slug d'URL : minuscules, sans accents, tirets (Kédougou → kedougou, Médina Yoro Foulah → medina-yoro-foulah).
const slugify = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// Tarifs réels (base seedée) mis en cache au démarrage ; fallback = valeurs officielles du seed.
let tarifsCache = null;
let laboratoiresCache = null;
async function warmTarifs() {
  try { tarifsCache = await all('SELECT id, nom, prix, duree_jours, fonctionnalites FROM formule ORDER BY prix'); }
  catch (e) { console.error('[seo] warmTarifs échoué (fallback statique) :', e.message); }
}
async function warmLaboratoires() {
  try { laboratoiresCache = await all('SELECT id, nom, agrement_arp, adresse, ville, telephone, email FROM laboratoire WHERE actif = 1 ORDER BY nom'); }
  catch (e) { console.error('[seo] warmLaboratoires échoué :', e.message); }
}
// Carte sanitaire : hiérarchie 14 régions > 79 districts (tables globales, non-tenant).
let carteCache = null; // { regions: [{ id, nom, districts: [{ id, nom }] }] }
async function warmCarteSanitaire() {
  try {
    const regions = await all('SELECT id, nom FROM region ORDER BY nom');
    const districts = await all('SELECT id, region_id, nom FROM district ORDER BY nom');
    const byRegion = new Map(regions.map((r) => [r.id, { ...r, districts: [] }]));
    for (const d of districts) byRegion.get(d.region_id)?.districts.push(d);
    carteCache = { regions: [...byRegion.values()] };
  } catch (e) { console.error('[seo] warmCarteSanitaire échoué (fallback seed) :', e.message); }
}
// Fallback statique (seed) si la base n'a pas pu être warmée.
function carteRegions() {
  if (carteCache) return carteCache.regions;
  return Object.entries(REGIONS_SEED).map(([nom, districts]) => ({ id: 0, nom, districts: districts.map((d) => ({ id: 0, nom: d })) }));
}
function tarifs() {
  return tarifsCache || [
    { id: 1, nom: 'Essentiel', prix: 5000, fonctionnalites: '["Rapports de visite","Fiche professionnel de santé","Tableau de bord personnel"]' },
    { id: 2, nom: 'Standard', prix: 10000, fonctionnalites: '["Tout Essentiel","Suivi des objectifs produit phare par zone","Exports (CSV/PDF)","Notifications de relance"]' },
    { id: 3, nom: 'Premium', prix: 15000, fonctionnalites: '["Tout Standard","Statistiques comparatives","Historique étendu","Support prioritaire"]' },
  ];
}

/* ---------- Contenu SSR (identique au rendu SPA pour éviter tout flicker) ---------- */

function landingBody() {
  const popM = (NATIONAL.population / 1000000).toFixed(1).replace('.', ',');
  return `
  <div class="hero">
    <h1><span>DelegPharma</span> — CRM du délégué médical</h1>
    <p>Planifiez vos tournées, suivez chaque professionnel de santé, rédigez vos comptes rendus de visite et pilotez vos campagnes — de Dakar à Kédougou.</p>
    <p style="margin-top:18px">
      <a class="primary" href="/inscription" style="display:inline-block;padding:11px 26px;font-size:15px;text-decoration:none">Créer un compte gratuit</a>
      <a class="primary" href="/login" style="display:inline-block;padding:11px 26px;font-size:15px;text-decoration:none">Se connecter</a>
      <a class="primary" href="/tarifs" style="display:inline-block;padding:11px 26px;font-size:15px;text-decoration:none">Voir les tarifs</a>
    </p>
  </div>
  <div class="features">
    <div class="feature"><div class="ico">🗺️</div><h3>Référentiel national</h3><p>14 régions médicales, 79 districts sanitaires, structures et professionnels de santé ciblés. <a href="/carte-sanitaire">Explorer la carte sanitaire →</a></p></div>
    <div class="feature"><div class="ico">📋</div><h3>Comptes rendus de visite</h3><p>CRV brouillon → soumis → validé, pièces jointes et PDF signé généré en une seconde.</p></div>
    <div class="feature"><div class="ico">🧭</div><h3>Tournées terrain</h3><p>Checklist des professionnels par district pour ne rater aucune visite.</p></div>
    <div class="feature"><div class="ico">📈</div><h3>Campagnes & couverture</h3><p>Objectifs validés, taux de couverture par produit, pilotage par laboratoire.</p></div>
  </div>
  <div class="stats" style="max-width:860px;margin:26px auto 6px">
    <div class="stat"><div class="n">14</div><div class="l">régions médicales</div></div>
    <div class="stat"><div class="n">79</div><div class="l">districts sanitaires</div></div>
    <div class="stat"><div class="n">3 915</div><div class="l">structures de santé</div></div>
    <div class="stat"><div class="n">34 388</div><div class="l">professionnels recensés</div></div>
    <div class="stat"><div class="n">${popM} M</div><div class="l">habitants couverts</div></div>
  </div>
  <p class="hint" style="text-align:center;margin:-2px 0 0">Référentiel officiel MSAS / ANSD — la maille exacte pour répartir votre force de vente. <a href="/carte-sanitaire">Explorer la carte sanitaire →</a></p>
  <div class="lab-band">
    <h2>Le CRM pensé pour les laboratoires pharmaceutiques</h2>
    <p class="hint">Pilotez vos délégués médicaux, vos objectifs produits et votre couverture territoriale — et développez le chiffre d'affaires de vos campagnes.</p>
    <div class="features" style="margin-top:16px">
      <div class="feature"><div class="ico">🎯</div><h3>Objectifs produits</h3><p>Objectifs par produit phare et par zone, taux de réalisation, campagnes mesurées sur le chiffre d'affaires.</p></div>
      <div class="feature"><div class="ico">🗺️</div><h3>Couverture sans doublon</h3><p>Force de vente répartie sur le référentiel officiel : chaque district a sa checklist, chaque zone est mesurée.</p></div>
      <div class="feature"><div class="ico">📊</div><h3>Terrain en temps réel</h3><p>CRV validés depuis le terrain, couverture par district, exports CSV/PDF — fini les CRV papier et les tableurs.</p></div>
    </div>
    <p style="text-align:center;margin-top:18px">
      <a class="primary" href="/inscription" style="display:inline-block;padding:11px 26px;font-size:15px;text-decoration:none">Équiper mon laboratoire</a>
      <a class="primary" href="/laboratoires" style="display:inline-block;padding:11px 26px;font-size:15px;text-decoration:none">Voir les laboratoires référencés</a>
    </p>
  </div>
  <div style="text-align:center;margin-top:30px">
    <a class="primary" href="/carte-sanitaire" style="display:inline-block;padding:11px 26px;font-size:15px;text-decoration:none">Explorer la carte sanitaire du Sénégal</a>
  </div>
  <footer style="max-width:860px;margin:34px auto 8px;text-align:center;font-size:13px;color:var(--mut)">
    <a href="/carte-sanitaire">Carte sanitaire</a> · <a href="/laboratoires">Laboratoires</a> · <a href="/tarifs">Tarifs</a> · <a href="/a-propos">À propos</a> · <a href="/login">Connexion</a> · <a href="/inscription">Compte gratuit</a>
  </footer>`;
}

function aProposBody() {
  return `
  <main style="max-width:860px;margin:0 auto;padding:28px 16px">
    ${publicHeader()}
    <nav class="breadcrumb"><a href="/">Accueil</a> › À propos</nav>
    <h1 style="font-size:28px;margin-bottom:12px">À propos de DelegPharma</h1>
    <p class="hint" style="margin-bottom:20px">Le CRM des délégués médicaux et des laboratoires pharmaceutiques du Sénégal, construit sur le référentiel officiel de la carte sanitaire.</p>
    <section style="margin-bottom:22px">
      <h2 style="font-size:19px;margin-bottom:10px">Un outil né du terrain</h2>
      <p style="line-height:1.7">DelegPharma est conçu par un docteur en pharmacie, délégué médical en exercice au Sénégal, qui a vécu les contraintes du métier : les comptes rendus de visite sur papier, les tournées planifiées de mémoire, les tableurs qui ne remontent jamais à temps, et l'impossibilité de prouver la couverture réelle d'une zone.</p>
      <p style="line-height:1.7">L'outil répond à ces contraintes : une checklist par district pour ne rater aucun professionnel de santé, des CRV saisis depuis le terrain et validés en une chaîne, des objectifs produits suivis zone par zone, et une couverture mesurée à la maille officielle.</p>
    </section>
    <section style="margin-bottom:22px">
      <h2 style="font-size:19px;margin-bottom:10px">Une base officielle : la carte sanitaire du Sénégal</h2>
      <p style="line-height:1.7">DelegPharma s'appuie sur la <a href="/carte-sanitaire">carte sanitaire et sociale</a> (référentiel MSAS/ANSD) : <b>14 régions médicales</b>, <b>79 districts sanitaires</b>, 3 915 structures et plus de 34 000 professionnels de santé recensés. Les données publiques sont utilisées telles quelles — une règle absolue : on n'invente jamais une donnée, une population ou un chiffre.</p>
      <p style="line-height:1.7">C'est la même maille que les managers et les délégués utilisent déjà : les tournées s'ancrent dans les districts, les objectifs se comparent entre zones, la couverture se calcule sans doublon. <a href="/laboratoires">Découvrir les laboratoires référencés</a>.</p>
    </section>
    <section style="margin-bottom:22px">
      <h2 style="font-size:19px;margin-bottom:10px">Pour les laboratoires pharmaceutiques</h2>
      <p style="line-height:1.7">Piloter une force de délégués médicaux sans outil, c'est renoncer à la visibilité. DelegPharma donne au laboratoire : la planification des tournées par district, la validation des CRV, les objectifs par produit phare et le taux de couverture par zone — la matière première du <a href="/blog/objectifs-campagnes-chiffre-affaires-laboratoire">pilotage du chiffre d'affaires</a>.</p>
    </section>
    <section style="margin-bottom:22px">
      <h2 style="font-size:19px;margin-bottom:10px">Pour les délégués médicaux</h2>
      <p style="line-height:1.7">Un délégué gagne du temps à chaque tournée : la checklist est prête, le CRV se rédige sur place, le PDF validé se génère en une seconde. Le délégué concentre son énergie sur la visite — pas sur la paperasse. <a href="/blog/tournees-terrain-delegue-medical">Bien organiser ses tournées</a>.</p>
    </section>
    <div style="text-align:center;margin:26px 0">
      <a class="primary" href="/inscription" style="display:inline-block;padding:11px 26px;font-size:15px;text-decoration:none">Créer un compte gratuit</a>
      <a class="primary" href="/tarifs" style="display:inline-block;padding:11px 26px;font-size:15px;text-decoration:none">Voir les tarifs</a>
    </div>
    <p class="hint" style="text-align:center">Données du référentiel MSAS / ANSD — utilisées sans invention.</p>
  </main>`;
}

function tarifsBody() {
  const cards = tarifs().map((t) => {
    const feats = JSON.parse(t.fonctionnalites || '[]').map((f) => `<li>${esc(f)}</li>`).join('');
    return `
    <div class="card formule">
      <h3>${esc(t.nom)}</h3>
      <div class="prix">${toFr(t.prix)} <small>FCFA / mois</small></div>
      <ul style="margin:12px 0 16px;padding-left:18px;line-height:1.7">${feats}</ul>
      <a class="primary" href="/inscription" style="display:inline-block;padding:9px 18px;text-decoration:none">S'abonner</a>
    </div>`;
  }).join('');
  return `
  <div style="max-width:920px;margin:0 auto;padding:28px 16px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
      <div class="brand">DelegPharma</div>
      <div><a href="/">Accueil</a> · <a href="/tarifs">Tarifs</a> · <a href="/login">Connexion</a></div>
    </div>
    <h1 style="font-size:26px;margin-bottom:20px">Nos tarifs</h1>
    <div id="public">
      <div class="cards">${cards}</div>
      <p class="hint">Abonnement mensuel (30 jours), renouvelable à tout moment. Paiement Mobile Money (Wave, Orange Money…).</p>
    </div>
  </div>`;
}

function loginBody() {
  return `
  <div class="card login-card">
    <h2>Connexion</h2>
    <form>
      <div><label>Identifiant</label><input name="email" autocomplete="username" placeholder="dm.senegal" required></div>
      <div><label>Mot de passe</label><input name="password" type="password" autocomplete="current-password" required></div>
      <button class="primary" type="submit">Se connecter</button>
    </form>
    <p class="hint">Pas encore de compte ? <a href="/inscription">Devenir délégué</a> · <a href="/tarifs">Tarifs</a> · <a href="/">← Retour</a></p>
  </div>`;
}

function laboratoiresBody() {
  const list = (laboratoiresCache || []).map((l) =>
    `<li style="margin:8px 0"><b>${esc(l.nom)}</b>${l.ville ? ` — ${esc(l.ville)}` : ''}</li>`
  ).join('');
  return `
  <div style="max-width:920px;margin:0 auto;padding:28px 16px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
      <div class="brand">DelegPharma</div>
      <div><a href="/">Accueil</a> · <a href="/tarifs">Tarifs</a> · <a href="/login">Connexion</a></div>
    </div>
    <h1 style="font-size:26px;margin-bottom:12px">Laboratoires pharmaceutiques au Sénégal</h1>
    <p class="hint" style="margin-bottom:20px">Annuaire des laboratoires référencés sur DelegPharma. La liste est enrichie régulièrement.</p>
    <ul style="line-height:1.8;column-count:2;column-gap:32px">${list || '<li class="muted">Aucun laboratoire référencé pour le moment.</li>'}</ul>
  </div>`;
}

/* ---------- Carte sanitaire (SSR public) ---------- */

function publicHeader() {
  return `
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
    <div class="brand">DelegPharma</div>
    <div><a href="/">Accueil</a> · <a href="/carte-sanitaire">Carte sanitaire</a> · <a href="/laboratoires">Laboratoires</a> · <a href="/tarifs">Tarifs</a> · <a href="/a-propos">À propos</a> · <a href="/login">Connexion</a></div>
  </div>`;
}

function hubBody() {
  const rows = carteRegions().map((r) => {
    const info = REGION_INFO[r.nom] || {};
    return `<li><a href="/carte-sanitaire/${slugify(r.nom)}"><b>${esc(r.nom)}</b></a> — ${r.districts.length} districts${info.population ? ` · ${toFr(info.population)} habitants` : ''}</li>`;
  }).join('');
  return `
  <main style="max-width:920px;margin:0 auto;padding:28px 16px">
    ${publicHeader()}
    <nav class="breadcrumb"><a href="/">Accueil</a> › Carte sanitaire</nav>
    <h1 style="font-size:26px;margin-bottom:12px">Carte sanitaire du Sénégal</h1>
    <p class="hint" style="margin-bottom:20px">Le référentiel national des 14 régions médicales et 79 districts sanitaires, issu de la Carte Sanitaire et Sociale (MSAS/ANSD). La référence des délégués médicaux et des laboratoires pharmaceutiques au Sénégal.</p>
    <section style="margin-bottom:24px">
      <h2 style="font-size:19px;margin-bottom:10px">Chiffres clés</h2>
      <ul style="line-height:1.8">
        <li><b>${NATIONAL.regions}</b> régions médicales</li>
        <li><b>${NATIONAL.districts}</b> districts sanitaires</li>
        <li><b>${toFr(NATIONAL.structures)}</b> structures de santé (${toFr(NATIONAL.postesSante)} postes, ${toFr(NATIONAL.centresSante)} centres, ${toFr(NATIONAL.hopitaux)} hôpitaux, ${toFr(NATIONAL.casesSante)} cases)</li>
        <li><b>${toFr(NATIONAL.professionnels)}</b> professionnels de santé</li>
        <li><b>${toFr(NATIONAL.population)}</b> habitants (projection ANSD 2024)</li>
      </ul>
    </section>
    <section>
      <h2 style="font-size:19px;margin-bottom:10px">Les 14 régions médicales</h2>
      <ul style="line-height:1.8;column-count:2;column-gap:32px">${rows}</ul>
    </section>
    <p class="hint" style="margin-top:24px">Chaque région et district est couvert par <b>DelegPharma</b>, le CRM des délégués médicaux au Sénégal. <a href="/tarifs">Découvrir les tarifs</a> · <a href="/laboratoires">Les laboratoires référencés</a></p>
  </main>`;
}

function regionBody(region) {
  const info = REGION_INFO[region.nom] || {};
  const districts = region.districts.map((d) => `<li><a href="/carte-sanitaire/${slugify(region.nom)}/${slugify(d.nom)}">${esc(d.nom)}</a></li>`).join('');
  return `
  <main style="max-width:920px;margin:0 auto;padding:28px 16px">
    ${publicHeader()}
    <nav class="breadcrumb"><a href="/">Accueil</a> › <a href="/carte-sanitaire">Carte sanitaire</a> › ${esc(region.nom)}</nav>
    <h1 style="font-size:26px;margin-bottom:12px">Région médicale de ${esc(region.nom)}</h1>
    <p class="hint" style="margin-bottom:20px">La région médicale de <b>${esc(region.nom)}</b> compte <b>${region.districts.length} districts sanitaires</b>${info.population ? ` et environ <b>${toFr(info.population)} habitants</b> (projection ANSD 2024)` : ''}${info.chefLieu ? `, chef-lieu <b>${esc(info.chefLieu)}</b>` : ''}.</p>
    <section>
      <h2 style="font-size:19px;margin-bottom:10px">Districts sanitaires de ${esc(region.nom)}</h2>
      <ul style="line-height:1.8;column-count:2;column-gap:32px">${districts}</ul>
    </section>
    <p class="hint" style="margin-top:24px">Les structures et professionnels de santé de la région de ${esc(region.nom)} sont référencés dans <b>DelegPharma</b>, le CRM des délégués médicaux. <a href="/tarifs">Voir les tarifs</a> · <a href="/laboratoires">Laboratoires</a></p>
  </main>`;
}

function districtBody(region, district) {
  const info = DISTRICT_INFO[district.nom] || {};
  const regionInfo = REGION_INFO[region.nom] || {};
  return `
  <main style="max-width:920px;margin:0 auto;padding:28px 16px">
    ${publicHeader()}
    <nav class="breadcrumb"><a href="/">Accueil</a> › <a href="/carte-sanitaire">Carte sanitaire</a> › <a href="/carte-sanitaire/${slugify(region.nom)}">${esc(region.nom)}</a> › ${esc(district.nom)}</nav>
    <h1 style="font-size:26px;margin-bottom:12px">District sanitaire de ${esc(district.nom)}</h1>
    <p class="hint" style="margin-bottom:20px">Le district sanitaire de <b>${esc(district.nom)}</b> est l'un des <b>${region.districts.length} districts</b> de la région médicale de <a href="/carte-sanitaire/${slugify(region.nom)}">${esc(region.nom)}</a>${info.chefLieu ? `, chef-lieu <b>${esc(info.chefLieu)}</b>` : ''}${regionInfo.population ? ` (population régionale : ${toFr(regionInfo.population)} habitants, ANSD 2024)` : ''}.</p>
    <section>
      <h2 style="font-size:19px;margin-bottom:10px">Structures et professionnels de santé</h2>
      <p>Les structures de santé (hôpitaux, centres et postes de santé) et les professionnels de santé (médecins, pharmaciens, sages-femmes, infirmiers) du district de ${esc(district.nom)} sont référencés dans <b>DelegPharma</b>, le CRM des délégués médicaux au Sénégal.</p>
    </section>
    <p class="hint" style="margin-top:24px"><a href="/carte-sanitaire/${slugify(region.nom)}">← Tous les districts de ${esc(region.nom)}</a> · <a href="/carte-sanitaire">Carte sanitaire du Sénégal</a> · <a href="/tarifs">Tarifs</a></p>
  </main>`;
}

function hubPage() {
  return {
    index: true,
    title: 'Carte sanitaire du Sénégal — 14 régions médicales, 79 districts sanitaires',
    desc: 'La carte sanitaire et sociale du Sénégal : 14 régions médicales, 79 districts sanitaires, 3 915 structures de santé. Le référentiel national des délégués médicaux et des laboratoires pharmaceutiques.',
    canonical: '/carte-sanitaire',
    jsonLd: {
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'BreadcrumbList', itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Accueil', item: BASE + '/' },
          { '@type': 'ListItem', position: 2, name: 'Carte sanitaire', item: BASE + '/carte-sanitaire' },
        ] },
        { '@type': 'ItemList', itemListElement: carteRegions().map((r, i) => ({ '@type': 'ListItem', position: i + 1, name: r.nom, url: BASE + '/carte-sanitaire/' + slugify(r.nom) })) },
      ],
    },
    body: hubBody,
  };
}

function regionPage(region) {
  const info = REGION_INFO[region.nom] || {};
  return {
    index: true,
    title: `Région médicale de ${region.nom} — districts sanitaires, population`,
    desc: `La région médicale de ${region.nom} : ${region.districts.length} districts sanitaires${info.population ? `, ${toFr(info.population)} habitants (ANSD 2024)` : ''}${info.chefLieu ? `, chef-lieu ${info.chefLieu}` : ''}. Référentiel des délégués médicaux.`,
    canonical: `/carte-sanitaire/${slugify(region.nom)}`,
    jsonLd: {
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'BreadcrumbList', itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Accueil', item: BASE + '/' },
          { '@type': 'ListItem', position: 2, name: 'Carte sanitaire', item: BASE + '/carte-sanitaire' },
          { '@type': 'ListItem', position: 3, name: region.nom, item: BASE + '/carte-sanitaire/' + slugify(region.nom) },
        ] },
        { '@type': 'ItemList', itemListElement: region.districts.map((d, i) => ({ '@type': 'ListItem', position: i + 1, name: d.nom, url: BASE + `/carte-sanitaire/${slugify(region.nom)}/${slugify(d.nom)}` })) },
      ],
    },
    body: () => regionBody(region),
  };
}

function districtPage(region, district) {
  const info = DISTRICT_INFO[district.nom] || {};
  return {
    index: true,
    title: `District sanitaire de ${district.nom} — ${region.nom}`,
    desc: `Le district sanitaire de ${district.nom} dans la région de ${region.nom}${info.chefLieu ? `, chef-lieu ${info.chefLieu}` : ''}. Structures et professionnels de santé référencés sur DelegPharma.`,
    canonical: `/carte-sanitaire/${slugify(region.nom)}/${slugify(district.nom)}`,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Accueil', item: BASE + '/' },
        { '@type': 'ListItem', position: 2, name: 'Carte sanitaire', item: BASE + '/carte-sanitaire' },
        { '@type': 'ListItem', position: 3, name: region.nom, item: BASE + '/carte-sanitaire/' + slugify(region.nom) },
        { '@type': 'ListItem', position: 4, name: district.nom, item: BASE + `/carte-sanitaire/${slugify(region.nom)}/${slugify(district.nom)}` },
      ],
    },
    body: () => districtBody(region, district),
  };
}

function carteSanitairePage(regionSlug, districtSlug) {
  if (!regionSlug) return hubPage();
  const region = carteRegions().find((r) => slugify(r.nom) === regionSlug);
  if (!region) return null;
  if (!districtSlug) return regionPage(region);
  const district = region.districts.find((d) => slugify(d.nom) === districtSlug);
  if (!district) return null;
  return districtPage(region, district);
}

/* ---------- Guides métier (blog SSR) ---------- */

function articleBody({ h1, intro, sections, faq }) {
  const secs = sections.map((s) => `<section><h2 style="font-size:19px;margin:18px 0 10px">${esc(s.h)}</h2>${s.p.map((p) => `<p style="line-height:1.7;margin-bottom:10px">${p}</p>`).join('')}</section>`).join('');
  const faqHtml = faq.map((f) => `<details style="margin:8px 0"><summary style="cursor:pointer;font-weight:600">${esc(f.q)}</summary><p style="line-height:1.7;margin-top:6px">${f.a}</p></details>`).join('');
  return `
  <main style="max-width:920px;margin:0 auto;padding:28px 16px">
    ${publicHeader()}
    <nav class="breadcrumb"><a href="/">Accueil</a> › ${esc(h1)}</nav>
    <article>
      <h1 style="font-size:26px;margin-bottom:12px">${esc(h1)}</h1>
      <p class="hint" style="margin-bottom:20px">${intro}</p>
      ${secs}
      <section>
        <h2 style="font-size:19px;margin:18px 0 10px">Questions fréquentes</h2>
        ${faqHtml}
      </section>
    </article>
    <p class="hint" style="margin-top:24px">DelegPharma, le CRM des délégués médicaux au Sénégal. <a href="/tarifs">Découvrir les tarifs</a> · <a href="/carte-sanitaire">Carte sanitaire</a> · <a href="/laboratoires">Laboratoires</a></p>
  </main>`;
}

function articlePage({ path, title, desc, h1, intro, sections, faq }) {
  return {
    index: true,
    title,
    desc,
    canonical: path,
    jsonLd: {
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'BreadcrumbList', itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Accueil', item: BASE + '/' },
          { '@type': 'ListItem', position: 2, name: h1, item: BASE + path },
        ] },
        { '@type': 'FAQPage', mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
      ],
    },
    body: () => articleBody({ h1, intro, sections, faq }),
  };
}

const GUIDES = [
  {
    path: '/blog/comment-devenir-delegue-medical-senegal',
    title: 'Comment devenir délégué médical au Sénégal — formation, compétences, débouchés',
    desc: 'Devenir délégué médical au Sénégal : formations (licence pro, ISMED UCAD, IUP-Santé, CEFAS), compétences requises, salaire et débouchés. Le guide complet du métier.',
    h1: 'Comment devenir délégué médical au Sénégal',
    intro: 'Le délégué médical (DM) est le représentant terrain des laboratoires pharmaceutiques auprès des professionnels de santé. Voici le parcours complet pour exercer ce métier au Sénégal.',
    sections: [
      { h: 'Quelles formations pour devenir délégué médical ?', p: [
        'Au Sénégal, le métier s\'apprend principalement via la licence professionnelle en délégué médical, proposée notamment par l\'Institut des sciences du médicament (ISMED) de l\'UCAD, l\'IUP-Santé et des instituts privés comme le CEFAS. La formation dure généralement 2 à 3 ans et couvre la pharmacologie, la visite médicale, la communication et la réglementation pharmaceutique.',
        'Un profil en pharmacie, biologie ou sciences de la santé est un atout. Les laboratoires recrutent aussi des profils commerciaux formés sur le tas, mais la licence pro reste la voie la plus reconnue.',
      ] },
      { h: 'Les compétences indispensables', p: [
        'Un bon délégué médical maîtrise la pharmacologie de ses produits, connaît parfaitement sa zone (carte sanitaire, districts, professionnels de santé) et sait structurer une visite : présentation du produit, argumentaire, recueil des objections, compte rendu.',
        'La rigueur administrative est essentielle : chaque visite doit être consignée dans un compte rendu de visite (CRV) avec le résultat obtenu (accord, réserve, refus) et la prochaine visite planifiée.',
      ] },
      { h: 'Salaire et débouchés', p: [
        'Le salaire d\'un délégué médical au Sénégal varie selon le laboratoire et l\'expérience, avec un fixe complété par des primes sur objectifs. Les débouchés : laboratoires pharmaceutiques, distributeurs, et à terme des postes de manager de zone ou de responsable de produits.',
        'DelegPharma accompagne les délégués médicaux au quotidien : tournées planifiées par district, CRV en une minute, PDF signé, suivi des objectifs. <a href="/tarifs">Découvrir les formules</a>.',
      ] },
    ],
    faq: [
      { q: 'Quelle formation faut-il pour être délégué médical au Sénégal ?', a: 'La licence professionnelle en délégué médical (ISMED UCAD, IUP-Santé, CEFAS) est la voie principale. Un profil pharmacie ou sciences de la santé est un atout.' },
      { q: 'Combien gagne un délégué médical au Sénégal ?', a: 'Le salaire se compose d\'un fixe et de primes sur objectifs, variable selon le laboratoire et l\'expérience. Les postes de manager de zone sont accessibles avec l\'expérience.' },
      { q: 'Quels sont les outils du délégué médical ?', a: 'Le délégué médical utilise un CRM métier pour planifier ses tournées, suivre les professionnels de santé et rédiger ses comptes rendus de visite (CRV).' },
    ],
  },
  {
    path: '/blog/le-metier-de-delegue-medical',
    title: 'Le métier de délégué médical : missions, journée type, carrière',
    desc: 'Le métier de délégué médical expliqué : missions (visite médicale, CRV, tournées, campagnes), journée type, compétences et perspectives de carrière au Sénégal.',
    h1: 'Le métier de délégué médical',
    intro: 'Le délégué médical est le lien entre les laboratoires pharmaceutiques et les professionnels de santé. Un métier de terrain, exigeant et structuré.',
    sections: [
      { h: 'Les missions du délégué médical', p: [
        'Le délégué médical visite les médecins, pharmaciens, sages-femmes et infirmiers de sa zone pour présenter les produits de son laboratoire, en s\'appuyant sur les numéros d\'agrément ARP et les données scientifiques.',
        'Chaque visite donne lieu à un compte rendu de visite (CRV) : professionnel rencontré, produits présentés, quantités, résultat (accord, réserve, refus) et prochaine visite. Le délégué planifie aussi ses tournées par district pour couvrir sa zone sans doublon.',
      ] },
      { h: 'Une journée type', p: [
        'La journée commence par la préparation de la tournée : sélection des professionnels à visiter dans le district, ordre de passage, documents. Puis les visites sur le terrain, chacune de 10 à 20 minutes. En fin de journée, le délégué consigne ses CRV et prépare le lendemain.',
        'Avec un CRM comme DelegPharma, la saisie des CRV se fait en une minute depuis le terrain, avec photo des documents, et le PDF signé est généré automatiquement.',
      ] },
      { h: 'Évolutions de carrière', p: [
        'Après quelques années, le délégué médical peut évoluer vers manager de zone, responsable de produits, ou coordinateur de campagnes. La maîtrise de la carte sanitaire et des objectifs de couverture est un accélérateur de carrière.',
      ] },
    ],
    faq: [
      { q: 'Qu\'est-ce qu\'un délégué médical ?', a: 'C\'est le représentant terrain d\'un laboratoire pharmaceutique qui visite les professionnels de santé pour présenter les produits et consigner des comptes rendus de visite.' },
      { q: 'Quelles sont les qualités d\'un bon délégué médical ?', a: 'Rigueur, sens du terrain, connaissances en pharmacologie, capacité à structurer une visite et à rendre compte précisément de chaque entretien.' },
      { q: 'Comment suivre ses visites et objectifs ?', a: 'Un CRM dédié comme DelegPharma permet de planifier les tournées, rédiger les CRV et suivre les objectifs de couverture par produit et par zone.' },
    ],
  },
  {
    path: '/blog/crv-compte-rendu-de-visite-guide',
    title: 'CRV : le compte rendu de visite médicale expliqué aux délégués',
    desc: 'Le compte rendu de visite (CRV) expliqué : définition, structure, workflow brouillon → soumis → validé, PDF signé et bonnes pratiques pour les délégués médicaux.',
    h1: 'CRV : le compte rendu de visite expliqué',
    intro: 'Le compte rendu de visite (CRV) est la pièce maîtresse du travail du délégué médical. C\'est lui qui transforme une visite terrain en donnée exploitable par le laboratoire.',
    sections: [
      { h: 'Qu\'est-ce qu\'un CRV ?', p: [
        'Le CRV consigne chaque visite d\'un professionnel de santé : identité du professionnel, structure, produits présentés avec les quantités, résultat de la visite (accord, réserve, refus, absent) et date de la prochaine visite.',
        'C\'est la preuve de l\'activité du délégué et la matière première des statistiques de couverture du laboratoire : taux de visite par district, objectifs produits, campagnes.',
      ] },
      { h: 'Le workflow de validation', p: [
        'Un bon CRV suit un cycle : brouillon (saisie terrain), soumis (envoi au manager), validé ou refusé (avec motif). Le délégué peut joindre des pièces (photos, bons de commande) et le CRV validé est généré en PDF signé.',
        'DelegPharma automatise tout ce cycle : saisie en une minute, pièces jointes, PDF signé en une seconde, historique complet. <a href="/tarifs">Voir les formules</a>.',
      ] },
      { h: 'Bonnes pratiques', p: [
        'Rédigez le CRV le jour même, soyez précis sur les quantités et le résultat, et planifiez systématiquement la prochaine visite. Un CRV bien renseigné alimente des statistiques fiables pour le laboratoire.',
      ] },
    ],
    faq: [
      { q: 'Que contient un compte rendu de visite ?', a: 'Le professionnel visité, la structure, les produits présentés avec quantités, le résultat (accord, réserve, refus) et la prochaine visite planifiée.' },
      { q: 'Pourquoi le CRV est-il important ?', a: 'Il prouve l\'activité du délégué et alimente les statistiques de couverture et d\'objectifs du laboratoire.' },
      { q: 'Comment générer un CRV en PDF ?', a: 'Avec DelegPharma, le CRV validé est généré en PDF signé automatiquement, avec les pièces jointes du terrain.' },
    ],
  },
  {
    path: '/blog/carte-sanitaire-senegal-guide',
    title: 'La carte sanitaire du Sénégal : 14 régions, 79 districts expliqués',
    desc: 'La carte sanitaire et sociale du Sénégal expliquée : 14 régions médicales, 79 districts sanitaires, structures de santé. Pourquoi elle est essentielle aux délégués médicaux.',
    h1: 'La carte sanitaire du Sénégal',
    intro: 'La carte sanitaire et sociale est le référentiel officiel du système de santé sénégalais. Pour le délégué médical, c\'est la base de toute planification de tournée.',
    sections: [
      { h: '14 régions médicales, 79 districts sanitaires', p: [
        'Le Sénégal est découpé en 14 régions médicales et 79 districts sanitaires, chacun doté de structures de santé : hôpitaux, centres de santé, postes de santé et cases de santé. Au total, près de 3 900 structures et plus de 34 000 professionnels de santé.',
        'Consultez le <a href="/carte-sanitaire">référentiel complet de la carte sanitaire</a> : chaque région et chaque district y est détaillé.',
      ] },
      { h: 'Pourquoi c\'est essentiel pour le délégué médical', p: [
        'La carte sanitaire permet de découper le territoire en zones de visite cohérentes, d\'identifier les professionnels à cibler par district et de mesurer la couverture réelle des campagnes.',
        'Un délégué qui maîtrise sa carte sanitaire planifie des tournées sans doublon, ne rate aucun professionnel clé et rend des comptes précis à son laboratoire.',
      ] },
      { h: 'La carte sanitaire dans DelegPharma', p: [
        'DelegPharma intègre la carte sanitaire complète : référentiel des régions et districts, structures et professionnels de santé, tournées par district et taux de couverture par produit. <a href="/tarifs">Découvrir les tarifs</a>.',
      ] },
    ],
    faq: [
      { q: 'Combien de régions médicales au Sénégal ?', a: 'Le Sénégal compte 14 régions médicales, de Dakar à Kédougou.' },
      { q: 'Combien de districts sanitaires ?', a: '79 districts sanitaires, répartis sur les 14 régions médicales.' },
      { q: 'Où trouver la carte sanitaire du Sénégal ?', a: 'Le référentiel officiel est publié par le MSAS. DelegPharma en propose une version interactive et détaillée, conçue pour les délégués médicaux.' },
    ],
  },
  {
    path: '/blog/agrement-arp-laboratoires',
    title: 'Agrément ARP : ce que les laboratoires pharmaceutiques doivent savoir',
    desc: 'L\'agrément ARP (Agence de Régulation Pharmaceutique) expliqué : définition, rôle, procédure et importance pour les laboratoires et produits pharmaceutiques au Sénégal.',
    h1: 'Agrément ARP : le sésame des laboratoires au Sénégal',
    intro: 'L\'Agence de Régulation Pharmaceutique (ARP) est l\'autorité qui encadre le médicament au Sénégal. Son agrément est indispensable pour commercialiser un produit.',
    sections: [
      { h: 'Qu\'est-ce que l\'ARP ?', p: [
        'L\'ARP (Agence de Régulation Pharmaceutique) est l\'organisme sénégalais chargé de la régulation du secteur pharmaceutique : enregistrement des médicaments, agrément des laboratoires, contrôle de la qualité et de la distribution.',
        'Chaque produit commercialisé au Sénégal doit disposer d\'un numéro d\'agrément ARP, et chaque laboratoire doit être agréé pour exercer.',
      ] },
      { h: 'Pourquoi c\'est important pour les délégués médicaux', p: [
        'Le délégué médical présente des produits agréés : le numéro d\'agrément ARP est un argument de crédibilité auprès des professionnels de santé. Les campagnes de promotion s\'appuient sur des produits dûment enregistrés.',
        'DelegPharma permet de suivre les agréments ARP des produits et des laboratoires, et de piloter les campagnes par produit agréé. <a href="/laboratoires">Voir les laboratoires référencés</a>.',
      ] },
      { h: 'La procédure d\'agrément', p: [
        'La procédure passe par le dépôt d\'un dossier auprès de l\'ARP (données du produit, qualité, pharmacovigilance) et son instruction. Les délais varient selon le type de produit. Un produit non agréé ne peut pas être promu ni distribué.',
      ] },
    ],
    faq: [
      { q: 'Qu\'est-ce que l\'agrément ARP ?', a: 'C\'est l\'autorisation délivrée par l\'Agence de Régulation Pharmaceutique du Sénégal pour commercialiser un médicament ou exercer en tant que laboratoire.' },
      { q: 'Pourquoi le numéro d\'agrément est-il important ?', a: 'Il garantit la conformité du produit et renforce la crédibilité de la visite médicale auprès des professionnels de santé.' },
      { q: 'Comment suivre les agréments de mes produits ?', a: 'DelegPharma permet de référencer les produits avec leur numéro d\'agrément ARP et de piloter les campagnes par produit agréé.' },
    ],
  },
  {
    path: '/blog/tournees-terrain-delegue-medical',
    title: 'Tournées terrain : comment optimiser sa couverture de délégué médical',
    desc: 'Optimiser ses tournées de délégué médical : planification par district, checklist des professionnels, couverture sans doublon et suivi des objectifs.',
    h1: 'Tournées terrain : optimiser sa couverture',
    intro: 'La tournée est le cœur de l\'activité du délégué médical. Bien planifiée, elle maximise la couverture de la zone et la qualité des visites.',
    sections: [
      { h: 'Planifier par district', p: [
        'Découpez votre zone en districts sanitaires et planifiez vos tournées district par district. Chaque tournée a une date, un district et une liste de professionnels à visiter.',
        'La carte sanitaire est votre meilleur allié : elle vous dit quels professionnels sont dans chaque district et quelle est la densité de structures. <a href="/carte-sanitaire">Consulter la carte sanitaire</a>.',
      ] },
      { h: 'La checklist des professionnels', p: [
        'Pour chaque tournée, établissez la checklist des professionnels à visiter : médecin, pharmacien, sage-femme, infirmier. Cochez au fur et à mesure pour ne rater personne et éviter les doublons.',
        'DelegPharma génère la checklist par district et suit l\'état de chaque visite. <a href="/tarifs">Découvrir les formules</a>.',
      ] },
      { h: 'Mesurer la couverture', p: [
        'La couverture se mesure : nombre de professionnels visités sur le total de la zone, taux de réalisation des objectifs par produit. Ces indicateurs guident vos prochaines tournées et alimentent les campagnes du laboratoire.',
      ] },
    ],
    faq: [
      { q: 'Comment planifier une tournée de délégué médical ?', a: 'Par district sanitaire, avec une checklist des professionnels à visiter et un ordre de passage optimisé. DelegPharma automatise cette planification.' },
      { q: 'Qu\'est-ce que la couverture d\'une zone ?', a: 'C\'est le ratio entre les professionnels visités et le total des professionnels de la zone. Un bon taux de couverture est l\'objectif de chaque campagne.' },
      { q: 'Comment éviter les doublons de visite ?', a: 'En centralisant les tournées et les CRV dans un CRM : chaque professionnel visité est tracé, et la checklist par district évite les oublis.' },
    ],
  },
  {
    path: '/blog/crm-laboratoire-pharmaceutique-delegues-medicaux',
    title: 'CRM pour laboratoire pharmaceutique au Sénégal : piloter ses délégués médicaux',
    desc: 'Pourquoi un laboratoire pharmaceutique au Sénégal a besoin d\'un CRM dédié : piloter ses délégués médicaux, suivre les comptes rendus de visite, mesurer la couverture par district et les objectifs produits.',
    h1: 'CRM pour laboratoire pharmaceutique : piloter sa force de délégués médicaux',
    intro: 'Un laboratoire pharmaceutique sénégalais qui déploie des délégués médicaux doit savoir qui visite qui, où, avec quel produit et avec quel résultat. Le CRM dédié à la visite médicale apporte cette visibilité — du référentiel national au taux de couverture par district.',
    sections: [
      { h: 'Pourquoi un laboratoire a besoin d\'un CRM de visite médicale', p: [
        'Sans outil centralisé, l\'activité terrain d\'un laboratoire repose sur des CRV papier, des tableurs et la mémoire des managers. Résultat : aucune vision fiable de la couverture réelle des zones, des objectifs produits non suivis et des campagnes impossibles à évaluer.',
        'Un CRM de visite médicale transforme chaque visite en donnée : professionnel rencontré, structure, produits présentés, quantités, résultat (accord, réserve, refus) et prochaine visite planifiée. C\'est la matière première du pilotage commercial du laboratoire.',
      ] },
      { h: 'Ce qu\'un CRM doit couvrir : tournées, CRV, objectifs, couverture', p: [
        'Le périmètre minimal : planification des tournées par district avec checklist des professionnels, saisie des comptes rendus de visite depuis le terrain (avec pièces jointes), validation par le manager, suivi des objectifs par produit phare et calcul du taux de couverture par zone.',
        'Les 14 régions médicales et 79 districts sanitaires du Sénégal sont la maille naturelle de ce pilotage : chaque tournée s\'ancre dans un district, chaque objectif se mesure sur une zone, chaque campagne se pilote par produit.',
      ] },
      { h: 'Le référentiel carte sanitaire : la base du découpage territorial', p: [
        'La <a href="/carte-sanitaire">carte sanitaire et sociale du Sénégal</a> (MSAS/ANSD) recense 14 régions médicales, 79 districts sanitaires, 3 915 structures et plus de 34 000 professionnels de santé. C\'est le découpage officiel sur lequel un laboratoire peut répartir sa force de vente sans doublon ni zone blanche.',
        'DelegPharma intègre ce référentiel : tournées par district, professionnels ciblables, couverture mesurée à la maille officielle. Consultez aussi <a href="/laboratoires">l\'annuaire des laboratoires pharmaceutiques présents au Sénégal</a>.',
      ] },
      { h: 'Mesurer la performance : couverture et objectifs produits', p: [
        'Les indicateurs qui comptent pour un laboratoire : taux de professionnels visités par district (couverture), réalisation des objectifs par produit phare et par zone, nombre de CRV validés par délégué, délai de remontée des comptes rendus.',
        'Ces indicateurs alimentent les campagnes suivantes : réallouer les délégués vers les districts sous-couverts, recentrer la promotion sur les produits en retard d\'objectif, et justifier le retour sur investissement de la force de vente. <a href="/tarifs">Découvrir les formules DelegPharma</a>.',
      ] },
    ],
    faq: [
      { q: 'Qu\'est-ce qu\'un CRM pour laboratoire pharmaceutique ?', a: 'C\'est un logiciel qui pilote l\'activité des délégués médicaux : tournées, comptes rendus de visite, objectifs produits et taux de couverture par zone. Il transforme le terrain en données exploitables.' },
      { q: 'Combien coûte un CRM de visite médicale au Sénégal ?', a: 'Chez DelegPharma, les formules vont de 5 000 FCFA (Essentiel) à 15 000 FCFA (Premium) par mois et par utilisateur, avec paiement Mobile Money (Wave, Orange Money).' },
      { q: 'Le CRM couvre-t-il les 14 régions du Sénégal ?', a: 'Oui. DelegPharma intègre la carte sanitaire complète : 14 régions médicales et 79 districts sanitaires, soit la maille officielle de répartition de votre force de vente.' },
      { q: 'Peut-on suivre les objectifs par produit ?', a: 'Oui. L\'outil suit les objectifs par produit phare et par zone, avec un taux de réalisation visible et des exports CSV/PDF pour vos rapports.' },
    ],
  },
  {
    path: '/blog/carte-sanitaire-laboratoire-couverture-territoriale',
    title: 'Carte sanitaire et laboratoire : découpage territorial, couverture et objectifs',
    desc: 'Comment les laboratoires pharmaceutiques utilisent la carte sanitaire du Sénégal (14 régions, 79 districts, 3 915 structures) pour répartir leurs délégués médicaux et mesurer la couverture des campagnes.',
    h1: 'La carte sanitaire au service des laboratoires pharmaceutiques',
    intro: 'La carte sanitaire et sociale est bien plus qu\'un document administratif : c\'est l\'outil de découpage territorial qui permet à un laboratoire de répartir ses délégués médicaux, de cibler les prescripteurs et de mesurer la couverture réelle de ses campagnes.',
    sections: [
      { h: '14 régions médicales, 79 districts : le découpage officiel', p: [
        'Le Sénégal est organisé en 14 régions médicales et 79 districts sanitaires, chacun doté de structures de santé : hôpitaux, centres de santé, postes de santé et cases de santé. Le référentiel officiel (MSAS/ANSD) recense 3 915 structures et plus de 34 000 professionnels.',
        'Pour un laboratoire, ce découpage est la maille idéale : il suit la réalité du système de santé et permet d\'aligner la force de vente sur la carte des prescripteurs. Explorez le <a href="/carte-sanitaire">référentiel complet région par région et district par district</a>.',
      ] },
      { h: 'De la carte sanitaire à la tournée : cibler les prescripteurs', p: [
        'Médecins, pharmaciens, sages-femmes et infirmiers sont répartis sur l\'ensemble du territoire. La carte sanitaire permet de prioriser les districts à forte densité de prescripteurs et de planifier des tournées sans doublon : chaque district a sa checklist, chaque professionnel a son historique de visites.',
        'C\'est particulièrement utile pour le lancement d\'un nouveau produit : le laboratoire concentre d\'abord les districts stratégiques (Dakar, Thiès, Saint-Louis…), puis élargit la couverture par vagues.',
      ] },
      { h: 'Couverture et objectifs : mesurer l\'atteinte par produit et par zone', p: [
        'Le taux de couverture — professionnels visités sur professionnels ciblés — est l\'indicateur central d\'une campagne. Rapporté au district, il révèle les zones blanches ; rapporté au produit, il montre où l\'objectif de prescriptions est en retard.',
        'DelegPharma calcule ces indicateurs automatiquement : couverture par district, objectifs par produit phare, CRV validés par délégué. <a href="/tarifs">Voir les formules</a> · <a href="/laboratoires">Les laboratoires référencés</a>.',
      ] },
      { h: 'Un avantage concurrentiel : s\'appuyer sur les données officielles', p: [
        'Travailler sur le référentiel officiel plutôt que sur une base maison donne au laboratoire un langage commun avec le terrain et une crédibilité accrue : les managers parlent des mêmes districts, les délégués couvrent les mêmes zones, les objectifs se comparent sur la même maille.',
        'La carte sanitaire est aussi un argument de recrutement : les délégués médicaux la connaissent et se repèrent immédiatement dans un outil construit dessus.',
      ] },
    ],
    faq: [
      { q: 'Combien de régions médicales compte le Sénégal ?', a: '14 régions médicales, de Dakar à Kédougou, chacune découpée en districts sanitaires.' },
      { q: 'Combien de structures de santé recense la carte sanitaire ?', a: 'Le référentiel MSAS/ANSD recense 3 915 structures de santé et plus de 34 000 professionnels de santé.' },
      { q: 'Comment un laboratoire mesure-t-il la couverture ?', a: 'En rapportant les professionnels visités par les délégués au total des professionnels ciblés dans chaque district. DelegPharma calcule ce taux automatiquement.' },
      { q: 'Pourquoi utiliser le référentiel officiel pour les campagnes ?', a: 'Il offre une maille commune (districts, structures, professionnels) qui aligne les managers et les délégués et rend les objectifs comparables entre zones.' },
    ],
  },
  {
    path: '/blog/objectifs-campagnes-chiffre-affaires-laboratoire',
    title: 'Objectifs commerciaux et campagnes : piloter le chiffre d\'affaires d\'un laboratoire au Sénégal',
    desc: 'Comment un laboratoire pharmaceutique au Sénégal définit des objectifs par produit, lance des campagnes de visite médicale et mesure leur impact sur le chiffre d\'affaires : indicateurs, couverture, reporting.',
    h1: 'Objectifs commerciaux et campagnes : le levier de chiffre d\'affaires d\'un laboratoire',
    intro: 'Le chiffre d\'affaires d\'un laboratoire repose sur sa force de vente : chaque visite médicale doit contribuer à un objectif produit, chaque campagne doit être mesurée. Encore faut-il définir les objectifs sur la bonne maille — les 14 régions et 79 districts de la carte sanitaire — et les suivre jusqu\'au terrain.',
    sections: [
      { h: 'Définir des objectifs par produit phare et par zone', p: [
        'Un objectif commercial pertinent se décline par produit phare et par zone (région ou district sanitaire). Le laboratoire fixe, pour chaque produit, un objectif de prescriptions ou de volumes sur la maille officielle, puis l\'assigne aux délégués concernés.',
        'DelegPharma permet de créer des objectifs par produit, de les affecter aux délégués et de suivre le taux de réalisation en temps réel, zone par zone. <a href="/carte-sanitaire">Consulter le découpage de la carte sanitaire</a>.',
      ] },
      { h: 'Lancer une campagne : cibler les bons prescripteurs', p: [
        'Une campagne de visite médicale sélectionne les professionnels de santé à visiter (médecins, pharmaciens, sages-femmes, infirmiers), priorise les districts stratégiques et définit les produits à promouvoir.',
        'Le suivi se fait par comptes rendus de visite : produit présenté, résultat (accord, réserve, refus), quantité. Ces données alimentent le pilotage de la campagne au jour le jour. <a href="/blog/crm-laboratoire-pharmaceutique-delegues-medicaux">Comprendre le CRM de visite médicale</a>.',
      ] },
      { h: 'Mesurer l\'impact sur le chiffre d\'affaires', p: [
        'Les indicateurs de pilotage : taux de couverture des professionnels ciblés, réalisation des objectifs par produit, CRV validés par délégué, délai de remontée du terrain.',
        'Avec ces données, le laboratoire réalloue les délégués vers les zones sous-couvertes, recentre la promotion sur les produits en retard et justifie l\'investissement de la force de vente. <a href="/blog/choisir-crm-force-de-vente-laboratoire-pharmaceutique">Comment choisir le bon CRM</a> · <a href="/laboratoires">Voir les laboratoires référencés</a> · <a href="/tarifs">Les formules</a>.',
      ] },
    ],
    faq: [
      { q: 'Comment fixer des objectifs commerciaux à une force de vente ?', a: 'Par produit phare et par zone : le laboratoire assigne à chaque délégué un objectif de réalisation sur un district ou une région, suivi en temps réel dans le CRM.' },
      { q: 'Comment mesurer l\'impact d\'une campagne de visite médicale ?', a: 'En croisant la couverture (professionnels visités / ciblés), les résultats des CRV et la réalisation des objectifs produits par zone.' },
      { q: 'Quels indicateurs pour piloter le chiffre d\'affaires ?', a: 'Couverture par district, réalisation des objectifs par produit, CRV validés par délégué et délai de remontée des comptes rendus.' },
    ],
  },
  {
    path: '/blog/choisir-crm-force-de-vente-laboratoire-pharmaceutique',
    title: 'Choisir son CRM de force de vente pharmaceutique : le guide pour laboratoires',
    desc: 'Le guide pour choisir le CRM de votre force de vente pharmaceutique au Sénégal : référentiel carte sanitaire, tournées, CRV, objectifs produits, couverture, prix et critères de sélection.',
    h1: 'Choisir le CRM de votre force de vente pharmaceutique',
    intro: 'Tournées, comptes rendus de visite, objectifs produits, couverture : le CRM de force de vente concentre toute l\'activité terrain d\'un laboratoire. Le bon choix se joue sur quelques critères précis, adaptés au contexte sénégalais.',
    sections: [
      { h: 'Les critères essentiels d\'un CRM de visite médicale', p: [
        'Le référentiel territorial d\'abord : l\'outil doit couvrir les 14 régions médicales et 79 districts sanitaires du Sénégal pour répartir la force de vente sur la maille officielle. Viennent ensuite les tournées par district avec checklist, la saisie des CRV depuis le terrain et leur validation.',
        'Enfin, le pilotage : objectifs par produit phare, taux de couverture par zone et exports pour le reporting, comme le montre notre guide sur <a href="/blog/objectifs-campagnes-chiffre-affaires-laboratoire">le pilotage du chiffre d\'affaires</a>. Sans ces briques, le CRM reste une simple base de contacts. <a href="/carte-sanitaire">Découvrir le référentiel</a>.',
      ] },
      { h: 'Les pièges à éviter', p: [
        'Un outil non adapté à la visite médicale (un simple CRM de contacts) ne gère ni les tournées, ni les CRV, ni les objectifs produits. Un outil sans référentiel local oblige à tout recréer, district par district.',
        'Méfiez-vous aussi des prix en devises et des abonnements sans paiement local : au Sénégal, le Mobile Money (Wave, Orange Money) est le mode de paiement naturel des PME. <a href="/tarifs">Comparer les formules DelegPharma</a>.',
      ] },
      { h: 'Le déploiement pas à pas', p: [
        'Commencez par référencer les professionnels de votre zone, créez vos produits avec leur agrément ARP, définissez les objectifs par produit, puis lancez les premières tournées.',
        'Un déploiement progressif par district permet de tester la prise en main par les délégués avant d\'étendre à tout le territoire. <a href="/inscription">Créer un compte gratuit pour découvrir l\'outil</a>.',
      ] },
    ],
    faq: [
      { q: 'Quel CRM choisir pour une force de vente pharmaceutique ?', a: 'Un CRM dédié à la visite médicale, adossé au référentiel carte sanitaire (régions, districts, professionnels), avec tournées, CRV, objectifs produits et suivi de couverture.' },
      { q: 'Combien coûte un CRM de force de vente au Sénégal ?', a: 'Chez DelegPharma, de 5 000 FCFA (Essentiel) à 15 000 FCFA (Premium) par mois et par utilisateur, réglables en Mobile Money (Wave, Orange Money).' },
      { q: 'Peut-on tester avant d\'acheter ?', a: 'Oui. DelegPharma permet de créer un compte gratuit en lecture seule pour découvrir le CRM avant de souscrire une formule.' },
    ],
  },
];

/* ---------- Métadonnées par route ---------- */

const LANDING_JD = {
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'SoftwareApplication', name: 'DelegPharma', url: BASE + '/', applicationCategory: 'BusinessApplication', operatingSystem: 'Web', description: 'CRM du délégué médical au Sénégal : tournées, comptes rendus de visite, objectifs et campagnes laboratoires.', offers: { '@type': 'AggregateOffer', lowPrice: '5000', highPrice: '15000', priceCurrency: 'XOF', offerCount: 3 } },
    { '@type': 'Organization', name: 'DelegPharma', url: BASE + '/', description: 'Éditeur du CRM des délégués médicaux au Sénégal.' },
    {
      '@type': 'FAQPage',
      mainEntity: [
        { '@type': 'Question', name: 'Qu\'est-ce qu\'un CRM pour délégué médical ?', acceptedAnswer: { '@type': 'Answer', text: 'Un CRM dédié à la visite médicale : il permet au délégué de planifier ses tournées, de suivre les professionnels de santé de sa zone et de consigner ses comptes rendus de visite (CRV) directement depuis le terrain.' } },
        { '@type': 'Question', name: 'Comment planifier mes tournées terrain ?', acceptedAnswer: { '@type': 'Answer', text: 'DelegPharma propose des tournées par district avec checklist des professionnels de santé à visiter, couvrant les 14 régions et 79 districts sanitaires du Sénégal.' } },
        { '@type': 'Question', name: 'Quels sont les tarifs de DelegPharma ?', acceptedAnswer: { '@type': 'Answer', text: 'Trois formules : Essentiel à 5 000 FCFA, Standard à 10 000 FCFA et Premium à 15 000 FCFA par mois, payables en Mobile Money (Wave, Orange Money).' } },
        { '@type': 'Question', name: 'Puis-je générer mes comptes rendus de visite en PDF ?', acceptedAnswer: { '@type': 'Answer', text: 'Oui, chaque CRV validé est généré en PDF signé en une seconde, avec les pièces jointes du terrain (photos, bons de commande, documents).' } },
        { '@type': 'Question', name: 'Quels professionnels de santé sont référencés ?', acceptedAnswer: { '@type': 'Answer', text: 'Le référentiel couvre les structures et professionnels de santé (médecins, pharmaciens, sages-femmes, infirmiers) répartis sur les 14 régions et 79 districts sanitaires du Sénégal.' } },
      ],
    },
  ],
};

const PAGES = {
  '/': {
    index: true,
    title: 'DelegPharma — CRM du délégué médical au Sénégal | Tournées, CRV, objectifs',
    desc: 'Le CRM des délégués médicaux au Sénégal : planifiez vos tournées de Dakar à Kédougou, suivez les professionnels de santé, rédigez vos comptes rendus de visite (CRV) et pilotez vos campagnes laboratoires. Dès 5 000 FCFA/mois.',
    canonical: '/',
    jsonLd: LANDING_JD,
    body: landingBody,
  },
  '/tarifs': {
    index: true,
    title: 'Tarifs DelegPharma — 5 000 / 10 000 / 15 000 FCFA par mois',
    desc: 'Abonnez-vous à DelegPharma : Essentiel 5 000 FCFA, Standard 10 000 FCFA ou Premium 15 000 FCFA par mois. Paiement Mobile Money (Wave, Orange Money). 30 jours, renouvelable.',
    canonical: '/tarifs',
    jsonLd: () => ({
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      itemListElement: tarifs().map((t, i) => ({ '@type': 'ListItem', position: i + 1, name: t.nom, item: BASE + '/tarifs', offers: { '@type': 'Offer', price: String(t.prix), priceCurrency: 'XOF' } })),
    }),
    body: tarifsBody,
  },
  '/laboratoires': {
    index: true,
    title: 'Laboratoires pharmaceutiques au Sénégal — Référencés sur DelegPharma',
    desc: 'Annuaire des laboratoires pharmaceutiques présents au Sénégal : industriels, distributeurs, génériques. DelegPharma les accompagne dans le suivi des délégués médicaux, des tournées et des comptes rendus de visite.',
    canonical: '/laboratoires',
    jsonLd: () => ({
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      itemListElement: (laboratoiresCache || []).map((l, i) => ({ '@type': 'ListItem', position: i + 1, name: l.nom, item: BASE + '/laboratoires' })),
    }),
    body: laboratoiresBody,
  },
  '/login': { index: false, title: 'Connexion — DelegPharma', desc: 'Accédez à votre espace délégué médical DelegPharma.', canonical: '/login', jsonLd: null, body: loginBody },
  '/inscription': { index: false, title: 'Inscription délégué médical — DelegPharma', desc: 'Créez votre compte délégué médical et abonnez-vous en Mobile Money.', canonical: '/inscription', jsonLd: null, body: loginBody },
  '/a-propos': {
    index: true,
    title: 'À propos — DelegPharma, le CRM des laboratoires et délégués médicaux du Sénégal',
    desc: 'DelegPharma est conçu par un docteur en pharmacie, délégué médical au Sénégal, sur le référentiel officiel de la carte sanitaire (MSAS/ANSD) : 14 régions, 79 districts, pour les laboratoires et les délégués médicaux.',
    canonical: '/a-propos',
    jsonLd: {
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'Organization', '@id': BASE + '/#org', name: 'DelegPharma', url: BASE + '/', description: 'CRM des délégués médicaux et des laboratoires pharmaceutiques au Sénégal, construit sur la carte sanitaire (MSAS/ANSD).', areaServed: { '@type': 'Country', name: 'Sénégal' } },
        { '@type': 'WebSite', '@id': BASE + '/#website', url: BASE + '/', name: 'DelegPharma', publisher: { '@id': BASE + '/#org' } },
        { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Accueil', item: BASE + '/' }, { '@type': 'ListItem', position: 2, name: 'À propos', item: BASE + '/a-propos' }] },
      ],
    },
    body: aProposBody,
  },
};
for (const g of GUIDES) PAGES[g.path] = articlePage(g);
const FALLBACK = { index: false, title: 'DelegPharma — CRM du délégué médical', desc: 'CRM du délégué médical au Sénégal.', canonical: '/', jsonLd: null, body: landingBody };

/* ---------- Assembleur de shell ---------- */

function head(page) {
  const robots = page.index ? 'index, follow' : 'noindex, nofollow';
  const canonical = BASE + page.canonical;
  const og = [
    '<meta property="og:type" content="website">',
    `<meta property="og:url" content="${canonical}">`,
    `<meta property="og:title" content="${esc(page.title)}">`,
    `<meta property="og:description" content="${esc(page.desc)}">`,
    `<meta property="og:site_name" content="DelegPharma">`,
    `<meta property="og:image" content="${BASE}/og-image-1200x630.png">`,
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${esc(page.title)}">`,
    `<meta name="twitter:description" content="${esc(page.desc)}">`,
    `<meta name="twitter:image" content="${BASE}/og-image-1200x630.png">`,
  ].join('\n  ');
  // jsonLd peut être un objet statique ou une fonction évaluée à la requête (caches warmés : tarifs, laboratoires).
  const jsonLd = typeof page.jsonLd === 'function' ? page.jsonLd() : page.jsonLd;
  const jdHtml = jsonLd ? `\n  <script type="application/ld+json">${jd(jsonLd)}</script>` : '';
  return [
    `<title>${esc(page.title)}</title>`,
    `<meta name="description" content="${esc(page.desc)}">`,
    `<meta name="robots" content="${robots}">`,
    `<link rel="canonical" href="${canonical}">`,
    og,
    jdHtml,
  ].join('\n  ');
}

function matchPage(path) {
  if (PAGES[path]) return PAGES[path];
  const m = path.match(/^\/carte-sanitaire(?:\/([^/]+))?(?:\/([^/]+))?$/);
  if (m) return carteSanitairePage(m[1], m[2]);
  return null;
}

export function seoShell(req) {
  const page = matchPage(req.path) || FALLBACK;
  const body = page.body();
  // Remplace la ligne <title> d'origine par le head SEO complet (title, desc, canonical, OG, JSON-LD).
  return SHELL
    .replace(/<title>.*?<\/title>/, `  ${head(page)}`)
    .replace('<div id="app"></div>', `<div id="app">${body}</div>`);
}

/* ---------- robots.txt / sitemap.xml ---------- */

const ROBOTS = `User-agent: *
Allow: /
Disallow: /api/

Sitemap: ${BASE}/sitemap.xml
`;

function sitemapUrls() {
  const urls = [
    { loc: '/', freq: 'weekly', prio: '1.0' },
    { loc: '/tarifs', freq: 'monthly', prio: '0.8' },
    { loc: '/laboratoires', freq: 'weekly', prio: '0.7' },
    { loc: '/carte-sanitaire', freq: 'weekly', prio: '0.9' },
    { loc: '/a-propos', freq: 'monthly', prio: '0.5' },
  ];
  for (const g of GUIDES) urls.push({ loc: g.path, freq: 'monthly', prio: '0.7' });
  for (const r of carteRegions()) {
    urls.push({ loc: `/carte-sanitaire/${slugify(r.nom)}`, freq: 'monthly', prio: '0.8' });
    for (const d of r.districts) urls.push({ loc: `/carte-sanitaire/${slugify(r.nom)}/${slugify(d.nom)}`, freq: 'monthly', prio: '0.6' });
  }
  return urls;
}

export function robotsTxt() { return ROBOTS; }
export function sitemapXml() {
  const urls = sitemapUrls().map((u) => `  <url><loc>${BASE}${u.loc}</loc><changefreq>${u.freq}</changefreq><priority>${u.prio}</priority></url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}
export { warmTarifs, warmLaboratoires, warmCarteSanitaire };
