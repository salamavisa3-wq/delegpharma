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

// Identité légale / contact — jamais codée en dur : lue depuis l'environnement (voir .env.example).
// Tant que ces variables ne sont pas définies, /contact et /mentions-legales affichent un texte
// de repli honnête (aucune coordonnée inventée) plutôt qu'un marqueur de template du type "[à compléter]".
const SUPPORT_EMAIL = (process.env.SUPPORT_EMAIL || '').trim();
const SUPPORT_WHATSAPP = (process.env.SUPPORT_WHATSAPP || '').trim();
const LEGAL_ENTITY_NAME = (process.env.LEGAL_ENTITY_NAME || '').trim();
const LEGAL_ADDRESS = (process.env.LEGAL_ADDRESS || '').trim();
const LEGAL_RC = (process.env.LEGAL_RC || '').trim();
const LEGAL_NINEA = (process.env.LEGAL_NINEA || '').trim();
const LEGAL_DIRECTOR_NAME = (process.env.LEGAL_DIRECTOR_NAME || '').trim();
const DPO_EMAIL = (process.env.DPO_EMAIL || SUPPORT_EMAIL || '').trim();
const DATA_RETENTION_NOTE = (process.env.DATA_RETENTION_NOTE || '').trim();

if (process.env.NODE_ENV === 'production') {
  const missing = [
    !SUPPORT_EMAIL && 'SUPPORT_EMAIL',
    !LEGAL_ENTITY_NAME && 'LEGAL_ENTITY_NAME',
    !LEGAL_ADDRESS && 'LEGAL_ADDRESS',
    !LEGAL_DIRECTOR_NAME && 'LEGAL_DIRECTOR_NAME',
  ].filter(Boolean);
  if (missing.length) {
    console.error(`[seo] ATTENTION : variables légales/contact manquantes en production (${missing.join(', ')}) — /contact et /mentions-legales affichent un texte de repli au lieu des vraies coordonnées. Voir .env.example.`);
  }
}

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
  <main>
  <div class="hero">
    <h1><span>DelegPharma</span> — le CRM des délégués médicaux et des laboratoires au Sénégal</h1>
    <p>Planifiez vos tournées, suivez chaque professionnel de santé, rédigez vos comptes rendus de visite et pilotez vos campagnes — de Dakar à Kédougou.</p>
    <p style="margin-top:18px">
      <a class="primary" href="/inscription" style="display:inline-block;padding:11px 26px;font-size:15px;text-decoration:none">Créer un compte gratuit</a>
      <a class="primary" href="/login" style="display:inline-block;padding:11px 26px;font-size:15px;text-decoration:none">Se connecter</a>
      <a class="primary" href="/tarifs" style="display:inline-block;padding:11px 26px;font-size:15px;text-decoration:none">Voir les tarifs</a>
    </p>
  </div>
  <div class="features">
    <div class="feature"><div class="ico">🗺️</div><h2>Référentiel national</h2><p>14 régions médicales, 79 districts sanitaires, structures et professionnels de santé ciblés. <a href="/carte-sanitaire">Explorer la carte sanitaire →</a></p></div>
    <div class="feature"><div class="ico">📋</div><h2>Comptes rendus de visite</h2><p>CRV brouillon → soumis → validé, pièces jointes et PDF signé généré en une seconde.</p></div>
    <div class="feature"><div class="ico">🧭</div><h2>Tournées terrain</h2><p>Checklist des professionnels par district pour ne rater aucune visite.</p></div>
    <div class="feature"><div class="ico">📈</div><h2>Campagnes & couverture</h2><p>Objectifs validés, taux de couverture par produit, pilotage par laboratoire.</p></div>
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
      <div class="feature"><div class="ico">🎯</div><h2>Objectifs produits</h2><p>Objectifs par produit phare et par zone, taux de réalisation, campagnes mesurées sur le chiffre d'affaires.</p></div>
      <div class="feature"><div class="ico">🗺️</div><h2>Couverture sans doublon</h2><p>Force de vente répartie sur le référentiel officiel : chaque district a sa checklist, chaque zone est mesurée.</p></div>
      <div class="feature"><div class="ico">📊</div><h2>Terrain en temps réel</h2><p>CRV validés depuis le terrain, couverture par district, exports CSV/PDF — fini les CRV papier et les tableurs.</p></div>
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
  </footer>
  </main>`;
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
  <main style="max-width:920px;margin:0 auto;padding:28px 16px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
      <div class="brand">DelegPharma</div>
      <div><a href="/">Accueil</a> · <a href="/delegue-medical">Délégué médical</a> · <a href="/tarifs">Tarifs</a> · <a href="/login">Connexion</a></div>
    </div>
    <h1 style="font-size:26px;margin-bottom:20px">Nos tarifs</h1>
    <div id="public">
      <div class="cards">${cards}</div>
      <p class="hint">Abonnement mensuel (30 jours), renouvelable à tout moment. Paiement par Mobile Money (Wave, Orange Money, QR), carte Visa/Mastercard ou PayPal.</p>
    </div>
  </main>`;
}

function loginBody() {
  return `
  <main class="card login-card">
    <h2>Connexion</h2>
    <form>
      <div><label>Identifiant</label><input name="email" autocomplete="username" placeholder="dm.senegal" required></div>
      <div><label>Mot de passe</label><input name="password" type="password" autocomplete="current-password" required></div>
      <button class="primary" type="submit">Se connecter</button>
    </form>
    <p class="hint">Pas encore de compte ? <a href="/inscription">Devenir délégué</a> · <a href="/tarifs">Tarifs</a> · <a href="/">← Retour</a></p>
  </main>`;
}

// SSR de la page d'inscription : reflète le formulaire SPA (loadInscription) pour les
// crawlers et les visiteurs sans JS — avant, la page servait le formulaire de connexion.
function inscriptionBody() {
  const labs = (laboratoiresCache || []).map((l) => `<option value="${l.id}">${esc(l.nom)}</option>`).join('');
  const formules = tarifs().map((t) => `<option value="${t.id}">${esc(t.nom)} — ${toFr(t.prix)} FCFA</option>`).join('');
  return `
  <main style="max-width:920px;margin:0 auto;padding:28px 16px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
      <div class="brand">DelegPharma</div>
      <div><a href="/">Accueil</a> · <a href="/delegue-medical">Délégué médical</a> · <a href="/tarifs">Tarifs</a> · <a href="/login">Connexion</a></div>
    </div>
    <h1 style="font-size:26px;margin-bottom:12px">Créer un compte gratuit</h1>
    <p class="hint" style="margin-bottom:20px">Le CRM des délégués médicaux et des laboratoires pharmaceutiques au Sénégal : tournées, comptes rendus de visite, objectifs et couverture par district. Sans formule : découverte en lecture seule. Avec formule : abonnement réglé par Mobile Money (Wave, Orange Money, QR), carte Visa/Mastercard ou PayPal.</p>
    <div class="card" style="max-width:600px">
      <form data-form="inscription">
        <div><label>Nom complet</label><input name="nom" required></div>
        <div class="form-row">
          <div><label>Email</label><input name="email" type="email" required></div>
          <div><label>Téléphone (Mobile Money)</label><input name="telephone" placeholder="77 000 00 00"></div>
        </div>
        <div class="form-row">
          <div><label>Laboratoire</label><select name="laboratoire_id" required>${labs}</select></div>
          <div><label>Formule</label><select name="formule_id"><option value="">Compte gratuit — lecture seule</option>${formules}</select></div>
        </div>
        <div class="form-row">
          <div><label>Adresse (optionnel, paiement carte)</label><input name="adresse" placeholder="Ex. : Rue 10, Medina"></div>
          <div><label>Ville (optionnel, paiement carte)</label><input name="ville" placeholder="Ex. : Dakar"></div>
        </div>
        <div><label>Mot de passe</label><input name="password" type="password" minlength="8" required></div>
        <button class="primary" type="submit">Créer mon compte</button>
        <p class="hint" style="margin-top:10px">Sans formule : découverte du CRM en lecture seule. Avec formule : abonnement réglé par Mobile Money (Wave, Orange Money, QR), carte Visa/Mastercard ou PayPal.</p>
      </form>
    </div>
    <p class="hint" style="margin-top:14px">Déjà inscrit ? <a href="/login">Se connecter</a> · <a href="/tarifs">Voir les tarifs</a></p>
  </main>`;
}

function laboratoiresBody() {
  const list = (laboratoiresCache || []).map((l) =>
    `<li style="margin:8px 0"><b>${esc(l.nom)}</b>${l.ville ? ` — ${esc(l.ville)}` : ''}</li>`
  ).join('');
  return `
  <main style="max-width:920px;margin:0 auto;padding:28px 16px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
      <div class="brand">DelegPharma</div>
      <div><a href="/">Accueil</a> · <a href="/delegue-medical">Délégué médical</a> · <a href="/tarifs">Tarifs</a> · <a href="/login">Connexion</a></div>
    </div>
    <h1 style="font-size:26px;margin-bottom:12px">Laboratoires pharmaceutiques au Sénégal</h1>
    <p class="hint" style="margin-bottom:20px">Annuaire des laboratoires référencés sur DelegPharma. La liste est enrichie régulièrement.</p>
    <ul style="line-height:1.8;column-count:2;column-gap:32px">${list || '<li class="muted">Aucun laboratoire référencé pour le moment.</li>'}</ul>
  </main>`;
}

/* ---------- Carte sanitaire (SSR public) ---------- */

function publicHeader() {
  return `
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
    <div class="brand">DelegPharma</div>
    <div><a href="/">Accueil</a> · <a href="/delegue-medical">Délégué médical</a> · <a href="/carte-sanitaire">Carte sanitaire</a> · <a href="/laboratoires">Laboratoires</a> · <a href="/tarifs">Tarifs</a> · <a href="/a-propos">À propos</a> · <a href="/login">Connexion</a></div>
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
      <p class="hint" style="font-size:13px;color:#667;margin-bottom:20px">Par DelegPharma — docteur en pharmacie, délégué médical au Sénégal · Mis à jour le 17 août 2026</p>
      ${secs}
      <section>
        <h2 style="font-size:19px;margin:18px 0 10px">Questions fréquentes</h2>
        ${faqHtml}
      </section>
    </article>
    <p class="hint" style="margin-top:24px">DelegPharma, le CRM des délégués médicaux au Sénégal. <a href="/tarifs">Découvrir les tarifs</a> · <a href="/carte-sanitaire">Carte sanitaire</a> · <a href="/laboratoires">Laboratoires</a></p>
  </main>`;
}

function articlePage({ path, title, desc, h1, intro, sections, faq, published = '2026-08-17', modified = '2026-08-21', primaryImage = BASE + '/og-image-1200x630.png' }) {
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
        {
          '@type': 'WebPage',
          '@id': BASE + path,
          url: BASE + path,
          name: title,
          headline: h1,
          description: desc,
          isPartOf: { '@type': 'WebSite', '@id': BASE + '/#website', url: BASE + '/', name: 'DelegPharma' },
          publisher: { '@type': 'Organization', '@id': BASE + '/#org', name: 'DelegPharma', url: BASE + '/', logo: { '@type': 'ImageObject', url: BASE + '/og-image-1200x630.png' } },
          author: { '@type': 'Organization', name: 'DelegPharma', url: BASE + '/' },
          datePublished: published,
          dateModified: modified,
          primaryImageOfPage: { '@type': 'ImageObject', url: primaryImage, width: 1200, height: 630 },
          inLanguage: 'fr',
        },
        { '@type': 'FAQPage', mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
      ],
    },
    body: () => articleBody({ h1, intro, sections, faq }),
  };
}

function legalBody({ h1, intro, sections }) {
  const secs = sections.map((s) => `<section><h2 style="font-size:19px;margin:18px 0 10px">${esc(s.h)}</h2>${s.p.map((p) => `<p style="line-height:1.7;margin-bottom:10px">${p}</p>`).join('')}</section>`).join('');
  return `
  <main style="max-width:920px;margin:0 auto;padding:28px 16px">
    ${publicHeader()}
    <nav class="breadcrumb"><a href="/">Accueil</a> › ${esc(h1)}</nav>
    <article>
      <h1 style="font-size:26px;margin-bottom:12px">${esc(h1)}</h1>
      <p class="hint" style="margin-bottom:20px">${intro}</p>
      ${secs}
    </article>
    <p class="hint" style="margin-top:24px">DelegPharma, le CRM des délégués médicaux au Sénégal. <a href="/tarifs">Découvrir les tarifs</a> · <a href="/carte-sanitaire">Carte sanitaire</a> · <a href="/laboratoires">Laboratoires</a></p>
  </main>`;
}

function blogBody() {
  const items = GUIDES.map((g) => `
    <article style="margin-bottom:22px;padding-bottom:18px;border-bottom:1px solid #eee">
      <h2 style="font-size:19px;margin-bottom:6px"><a href="${g.path}">${esc(g.h1)}</a></h2>
      <p style="line-height:1.7;margin:0 0 8px;color:var(--mut)">${g.desc}</p>
      <a href="${g.path}" style="font-size:13px">Lire l'article →</a>
    </article>`).join('');
  return `
  <main style="max-width:920px;margin:0 auto;padding:28px 16px">
    ${publicHeader()}
    <nav class="breadcrumb"><a href="/">Accueil</a> › Blog</nav>
    <h1 style="font-size:26px;margin-bottom:12px">Le blog DelegPharma</h1>
    <p class="hint" style="margin-bottom:20px">Guides et conseils pour les délégués médicaux et les laboratoires pharmaceutiques au Sénégal : métier, formation, salaire, tournées, CRV, carte sanitaire, CRM de visite médicale.</p>
    ${items}
    <p class="hint" style="margin-top:24px">DelegPharma, le CRM des délégués médicaux au Sénégal. <a href="/tarifs">Découvrir les tarifs</a> · <a href="/carte-sanitaire">Carte sanitaire</a> · <a href="/laboratoires">Laboratoires</a></p>
  </main>`;
}

/* ---------- Page pilier : Délégué médical (SSR public) ---------- */

const DELEGUE_FAQ = [
  { q: 'C\'est quoi un délégué médical ?', a: 'Un délégué médical représente un laboratoire pharmaceutique auprès des professionnels de santé (médecins, infirmiers, sages-femmes) : il informe sur les produits, promeut la prescription et rend compte de chaque visite.' },
  { q: 'Quels sont les débouchés du métier ?', a: 'Superviseur ou délégué médical auprès des laboratoires pharmaceutiques, commercial chez les grossistes pharmaceutiques, commercial dans les industries pharmaceutiques, ou délégué pharmaceutique / vendeur en pharmacie.' },
  { q: 'Combien gagne un délégué médical au Sénégal ?', a: 'La rémunération combine un fixe et des primes sur objectifs. Le total varie selon le laboratoire, la zone et l\'expérience : aucune grille publique unique ne fait foi. Voir notre <a href="/blog/salaire-remuneration-delegue-medical-senegal">guide du salaire</a>.' },
  { q: 'Quelles formations pour devenir délégué médical ?', a: 'La licence professionnelle (ISMED UCAD, IUP-Santé) et les instituts privés (IPAM, IFAA, ICOA Santé) préparent au métier. Les conditions et frais relèvent de chaque établissement. Voir notre <a href="/blog/formations-delegue-medical-senegal">guide des formations</a>.' },
  { q: 'C\'est quoi un CRV ?', a: 'Un compte rendu de visite : la trace structurée de chaque visite d\'un professionnel de santé. Il permet au laboratoire de suivre la couverture réelle de sa force de vente. Voir le <a href="/blog/crv-compte-rendu-de-visite-guide">guide du CRV</a>.' },
  { q: 'Comment DelegPharma aide le délégué médical ?', a: 'DelegPharma s\'appuie sur la carte sanitaire officielle (14 régions, 79 districts), référence les professionnels de santé, planifie les tournées, enregistre les CRV et suit les objectifs — pour piloter sa zone de bout en bout.' },
];

function delegueMedicalBody() {
  const faqHtml = DELEGUE_FAQ.map((f) => `<details style="margin:8px 0"><summary style="cursor:pointer;font-weight:600">${esc(f.q)}</summary><p style="line-height:1.7;margin-top:6px">${f.a}</p></details>`).join('');
  return `
  <main style="max-width:920px;margin:0 auto;padding:28px 16px">
    ${publicHeader()}
    <nav class="breadcrumb"><a href="/">Accueil</a> › Délégué médical</nav>
    <article>
      <h1 style="font-size:26px;margin-bottom:12px">Délégué médical</h1>
      <p class="hint" style="margin-bottom:20px">Le délégué médical est le lien entre les laboratoires pharmaceutiques et les professionnels de santé : il informe, promeut la prescription et anime sa zone au Sénégal — district par district.</p>
      <p class="hint" style="font-size:13px;color:#667;margin-bottom:20px">Par DelegPharma — docteur en pharmacie, délégué médical au Sénégal · Mis à jour le 24 août 2026</p>
      <section>
        <h2 style="font-size:19px;margin:18px 0 10px">Objectif du métier</h2>
        <p style="line-height:1.7;margin-bottom:10px">L\'objectif du délégué médical est de faire connaître les produits pharmaceutiques de son laboratoire aux prescripteurs : médecins, infirmières, sages-femmes, pharmaciens. Cela suppose une formation médicale solide — connaissance du médicament, information médicale — et la promotion quotidienne des produits.</p>
        <ul style="line-height:1.8;margin-bottom:10px">
          <li>Informer les professionnels de santé sur les produits et leur bon usage</li>
          <li>Promouvoir les produits pharmaceutiques du laboratoire représenté</li>
          <li>Suivre l\'évolution de la prescription dans sa zone</li>
          <li>Rendre un compte rendu de visite (CRV) pour chaque rencontre</li>
        </ul>
      </section>
      <section>
        <h2 style="font-size:19px;margin:18px 0 10px">Les débouchés</h2>
        <p style="line-height:1.7;margin-bottom:10px">Le métier et la formation de délégué médical ouvrent plusieurs voies dans le secteur pharmaceutique :</p>
        <ul style="line-height:1.8;margin-bottom:10px">
          <li>Superviseur ou délégué médical auprès des laboratoires pharmaceutiques</li>
          <li>Commercial au niveau des grossistes pharmaceutiques</li>
          <li>Commercial au niveau des industries pharmaceutiques</li>
          <li>Délégué pharmaceutique ou vendeur en pharmacie</li>
        </ul>
        <p style="line-height:1.7;margin-bottom:10px">Voir le <a href="/blog/le-metier-de-delegue-medical">métier de délégué médical</a> en détail et le <a href="/blog/comment-devenir-delegue-medical-senegal">guide pour devenir délégué médical</a>.</p>
      </section>
      <section>
        <h2 style="font-size:19px;margin:18px 0 10px">Le métier au quotidien</h2>
        <p style="line-height:1.7;margin-bottom:10px">Une semaine de délégué médical s\'organise autour de tournées sur le terrain : chaque visite est préparée (argumentaire produit, objectif de rencontre), réalisée chez le prescripteur, puis tracée dans un compte rendu de visite.</p>
        <p style="line-height:1.7;margin-bottom:10px"><a href="/blog/preparer-visite-medicale-argumentaire-produit">Préparer une visite médicale</a> · <a href="/blog/tournees-terrain-delegue-medical">Optimiser ses tournées</a> · <a href="/blog/crv-compte-rendu-de-visite-guide">Le CRV</a> · <a href="/blog/professionnels-de-sante-senegal-referentiel-delegue">Le référentiel des professionnels de santé</a></p>
      </section>
      <section>
        <h2 style="font-size:19px;margin:18px 0 10px">Le métier avec DelegPharma</h2>
        <p style="line-height:1.7;margin-bottom:10px">DelegPharma est le CRM construit pour le délégué médical sénégalais : il s\'appuie sur la carte sanitaire officielle (<b>14 régions, 79 districts</b>), référence les professionnels de santé, planifie les tournées, enregistre les CRV et suit les objectifs produits.</p>
        <p style="line-height:1.7;margin-bottom:10px"><a href="/carte-sanitaire">La carte sanitaire</a> · <a href="/tarifs">Les tarifs</a> · <a href="/inscription">Créer un compte gratuit</a></p>
      </section>
      <section>
        <h2 style="font-size:19px;margin:18px 0 10px">Se former au métier</h2>
        <p style="line-height:1.7;margin-bottom:10px">Au Sénégal, la licence professionnelle (ISMED UCAD, IUP-Santé) et les instituts privés (IPAM, IFAA, ICOA Santé) préparent au métier. Les frais, la durée et les conditions d\'admission relèvent de chaque établissement : renseignez-vous directement auprès d\'eux.</p>
        <p style="line-height:1.7;margin-bottom:10px"><a href="/blog/formations-delegue-medical-senegal">Les formations de délégué médical</a> · <a href="/blog/salaire-remuneration-delegue-medical-senegal">Le salaire du délégué médical</a></p>
      </section>
      <section>
        <h2 style="font-size:19px;margin:18px 0 10px">Questions fréquentes</h2>
        ${faqHtml}
      </section>
    </article>
    <p class="hint" style="margin-top:24px">DelegPharma, le CRM des délégués médicaux au Sénégal. <a href="/tarifs">Découvrir les tarifs</a> · <a href="/carte-sanitaire">Carte sanitaire</a> · <a href="/laboratoires">Laboratoires</a></p>
  </main>`;
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
        'Deux voies existent au Sénégal. La licence professionnelle en délégué médical (2 à 3 ans) est proposée notamment par l\'Institut des sciences du médicament (ISMED) de l\'UCAD (admission Bac + 2) et par l\'IUP-Santé. Des formations courtes de 8 à 10 mois sont également proposées par des instituts privés : l\'IPAM (diplôme d\'études spéciales en visite médicale, 8 mois en cours du soir), l\'IFAA (10 mois, dont 1 mois de stage), l\'ICOA Santé (10 mois) et l\'IUP-Santé (admission dès le BFEM).',
        'Ces formations couvrent la pharmacologie, la visite médicale, la communication et la réglementation pharmaceutique. Les frais sont variables selon l\'institut (à titre indicatif, 2026 : IPAM 555 000 FCFA pour le DESMV, IFAA 55 000 FCFA/mois, ICOA Santé 60 000 FCFA/mois, IUP-Santé 50 000 FCFA/mois) ; vérifiez les conditions d\'admission et les tarifs auprès de chaque école.',
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
      { q: 'Quelle formation faut-il pour être délégué médical au Sénégal ?', a: 'La licence professionnelle (ISMED UCAD, IUP-Santé) est la voie la plus reconnue, sur 2 à 3 ans. Des instituts privés (IPAM, IFAA, ICOA Santé) proposent aussi des formations courtes de 8 à 10 mois. Un profil pharmacie ou sciences de la santé est un atout.' },
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
        'Identifiez chaque professionnel avec une convention claire : « Dr NOM Prénom – Spécialité – Ville ». Pour chaque produit présenté, notez les quantités d\'échantillons laissés (EMG) et les produits présentés (PRES), ainsi que le niveau d\'intérêt du prescripteur (froid, tiède ou chaud).',
        'Rédigez le CRV dans les 30 minutes suivant la visite, soyez précis sur les quantités et le résultat, et planifiez systématiquement la prochaine visite. Un CRV bien renseigné alimente des statistiques fiables pour le laboratoire.',
      ] },
    ],
    faq: [
      { q: 'Que contient un compte rendu de visite ?', a: 'Le professionnel visité (Dr NOM Prénom – Spécialité – Ville), les produits présentés avec quantités d\'échantillons (EMG), le niveau d\'intérêt (froid, tiède, chaud), le résultat (accord, réserve, refus) et la prochaine visite planifiée.' },
      { q: 'Pourquoi le CRV est-il important ?', a: 'Il prouve l\'activité du délégué et alimente les statistiques de couverture et d\'objectifs du laboratoire.' },
      { q: 'Comment générer un CRV en PDF ?', a: 'Avec DelegPharma, le CRV validé est généré en PDF signé automatiquement, avec les pièces jointes du terrain.' },
    ],
  },
  {
    path: '/blog/carte-sanitaire-senegal-guide',
    title: 'Carte sanitaire du Sénégal — 14 régions, 79 districts (guide 2026)',
    desc: 'Guide complet de la carte sanitaire et sociale du Sénégal : 14 régions médicales, 79 districts sanitaires, structures de santé. Idéal pour les délégués médicaux et les laboratoires.',
    h1: 'La carte sanitaire du Sénégal',
    intro: 'La carte sanitaire et sociale est le référentiel officiel du système de santé sénégalais. Pour le délégué médical, c\'est la base de toute planification de tournée.',
    sections: [
      { h: '14 régions médicales, 79 districts sanitaires', p: [
        'Le Sénégal est découpé en 14 régions médicales et 79 districts sanitaires, chacun doté de structures de santé : hôpitaux, centres de santé, postes de santé et cases de santé. Au total, près de 3 900 structures et plus de 34 000 professionnels de santé.',
        'Consultez le <a href="/carte-sanitaire">référentiel complet de la carte sanitaire</a> : chaque région et chaque district y est détaillé.',
      ] },
      { h: 'Carte de santé du Sénégal : le référentiel du terrain', p: [
        'La carte de santé recense les professionnels de santé, les structures publiques et privées et le découpage territorial utilisé par le MSAS et l\'ANSD. Elle permet à un laboratoire ou à un délégué médical de cibler les districts et de mesurer la couverture réelle.',
        'Explorez la carte de santé par région puis par district pour préparer vos tournées sans doublon ni zone blanche.',
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
      { q: 'Qu\'est-ce que la carte de santé du Sénégal ?', a: 'C\'est le référentiel national des structures, professionnels et découpages territoriaux du système de santé sénégalais.' },
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
    title: 'CRM laboratoire pharmaceutique Sénégal — délégués médicaux',
    desc: 'CRM pour laboratoire pharmaceutique au Sénégal : piloter les délégués médicaux, suivre les CRV, mesurer la couverture par district et les objectifs produits.',
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
      { h: 'Délégués médicaux : recrutement, salaire et pilotage', p: [
        'Le délégué médical est le visage du laboratoire sur le terrain. Son salaire au Sénégal combine un fixe et des primes sur objectifs. Pour le recruter, structurer sa zone et le fidéliser, le laboratoire doit lui donner un outil fiable : tournées claires, CRV validés, objectifs transparents.',
        'DelegPharma transforme le terrain en données exploitables : chaque délégué sait où aller, le manager voit la couverture en temps réel, et le laboratoire peut justifier son investissement. <a href="/blog/salaire-remuneration-delegue-medical-senegal">En savoir plus sur le salaire du délégué médical</a>.',
      ] },
      { h: 'Mesurer la performance : couverture et objectifs produits', p: [
        'Les indicateurs qui comptent pour un laboratoire : taux de professionnels visités par district (couverture), réalisation des objectifs par produit phare et par zone, nombre de CRV validés par délégué, délai de remontée des comptes rendus.',
        'Ces indicateurs alimentent les campagnes suivantes : réallouer les délégués vers les districts sous-couverts, recentrer la promotion sur les produits en retard d\'objectif, et justifier le retour sur investissement de la force de vente. <a href="/tarifs">Découvrir les formules DelegPharma</a>.',
      ] },
    ],
    faq: [
      { q: 'Qu\'est-ce qu\'un CRM pour laboratoire pharmaceutique ?', a: 'C\'est un logiciel qui pilote l\'activité des délégués médicaux : tournées, comptes rendus de visite, objectifs produits et taux de couverture par zone. Il transforme le terrain en données exploitables.' },
      { q: 'Combien coûte un CRM de visite médicale au Sénégal ?', a: 'Chez DelegPharma, les formules vont de 5 000 FCFA (Essentiel) à 15 000 FCFA (Premium) par mois et par utilisateur, avec paiement Mobile Money (Wave, Orange Money, QR Wave/OM), carte Visa/Mastercard ou PayPal.' },
      { q: 'Le CRM couvre-t-il les 14 régions du Sénégal ?', a: 'Oui. DelegPharma intègre la carte sanitaire complète : 14 régions médicales et 79 districts sanitaires, soit la maille officielle de répartition de votre force de vente.' },
      { q: 'Peut-on suivre les objectifs par produit ?', a: 'Oui. L\'outil suit les objectifs par produit phare et par zone, avec un taux de réalisation visible et des exports CSV/PDF pour vos rapports.' },
      { q: 'Quel est le salaire d\'un délégué médical au Sénégal ?', a: 'La rémunération combine un fixe et des primes sur objectifs (couverture, CRV validés, objectifs produits). Le montant total dépend du laboratoire, de la zone couverte et de l\'expérience.' },
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
    title: 'Choisir un CRM force de vente laboratoire pharmaceutique — guide',
    desc: 'Guide pour choisir un CRM laboratoire pharmaceutique au Sénégal : référentiel carte sanitaire, tournées, CRV, objectifs produits, couverture et prix.',
    h1: 'Choisir le CRM de votre force de vente pharmaceutique',
    intro: 'Tournées, comptes rendus de visite, objectifs produits, couverture : le CRM de force de vente concentre toute l\'activité terrain d\'un laboratoire. Le bon choix se joue sur quelques critères précis, adaptés au contexte sénégalais.',
    sections: [
      { h: 'Les critères essentiels d\'un CRM de visite médicale', p: [
        'Le référentiel territorial d\'abord : l\'outil doit couvrir les 14 régions médicales et 79 districts sanitaires du Sénégal pour répartir la force de vente sur la maille officielle. Viennent ensuite les tournées par district avec checklist, la saisie des CRV depuis le terrain et leur validation.',
        'Enfin, le pilotage : objectifs par produit phare, taux de couverture par zone et exports pour le reporting, comme le montre notre guide sur <a href="/blog/objectifs-campagnes-chiffre-affaires-laboratoire">le pilotage du chiffre d\'affaires</a>. Sans ces briques, le CRM reste une simple base de contacts. <a href="/carte-sanitaire">Découvrir le référentiel</a>.',
      ] },
      { h: 'CRM laboratoire pharmaceutique : les pièges à éviter', p: [
        'Un outil non adapté à la visite médicale (un simple CRM de contacts) ne gère ni les tournées, ni les CRV, ni les objectifs produits. Un outil sans référentiel local oblige à tout recréer, district par district.',
        'Méfiez-vous aussi des prix en devises et des abonnements sans paiement local : au Sénégal, le Mobile Money (Wave, Orange Money, QR Wave/OM) est le mode de paiement naturel des PME. <a href="/tarifs">Comparer les formules DelegPharma</a>.',
      ] },
      { h: 'Le déploiement pas à pas', p: [
        'Commencez par référencer les professionnels de votre zone, créez vos produits avec leur agrément ARP, définissez les objectifs par produit, puis lancez les premières tournées.',
        'Un déploiement progressif par district permet de tester la prise en main par les délégués avant d\'étendre à tout le territoire. <a href="/inscription">Créer un compte gratuit pour découvrir l\'outil</a>.',
      ] },
    ],
    faq: [
      { q: 'Quel CRM choisir pour une force de vente pharmaceutique ?', a: 'Un CRM dédié à la visite médicale, adossé au référentiel carte sanitaire (régions, districts, professionnels), avec tournées, CRV, objectifs produits et suivi de couverture.' },
      { q: 'Combien coûte un CRM de force de vente au Sénégal ?', a: 'Chez DelegPharma, de 5 000 FCFA (Essentiel) à 15 000 FCFA (Premium) par mois et par utilisateur, réglables en Mobile Money (Wave, Orange Money, QR Wave/OM), carte Visa/Mastercard ou PayPal.' },
      { q: 'Peut-on tester avant d\'acheter ?', a: 'Oui. DelegPharma permet de créer un compte gratuit en lecture seule pour découvrir le CRM avant de souscrire une formule.' },
    ],
  },
  {
    path: '/blog/reporting-kpi-laboratoire-force-de-vente',
    title: 'Reporting et KPIs d\'un laboratoire : piloter la force de vente pharmaceutique',
    desc: 'Les indicateurs clés pour piloter une force de vente pharmaceutique au Sénégal : couverture, objectifs, CRV, taux de conversion, tableau de bord et exports pour le manager de laboratoire.',
    h1: 'Reporting et KPIs : piloter la force de vente d\'un laboratoire',
    intro: 'Un laboratoire qui déploie des délégués médicaux ne peut pas piloter sans indicateurs. Le reporting transforme l\'activité terrain en décisions : réallouer les efforts, recentrer une campagne, valider le retour sur investissement de la force de vente.',
    sections: [
      { h: 'Les KPIs essentiels du laboratoire', p: [
        'Les indicateurs se déclinent en quatre familles. La couverture territoriale : taux de professionnels de santé visités par rapport aux professionnels ciblés, par district et par région. L\'activité : nombre de visites réalisées, CRV validés, délai de remontée. Les objectifs : taux de réalisation par produit phare et par zone. Enfin la conversion : résultats des CRV (accord, réserve, refus) et prochaines visites planifiées.',
        'Ces KPIs donnent au manager une vision en temps réel de la performance de chaque délégué et de chaque zone, sans dépendre des tableurs. <a href="/blog/objectifs-campagnes-chiffre-affaires-laboratoire">Voir le guide pilotage CA et campagnes</a>.',
      ] },
      { h: 'Du tableau de bord à la décision', p: [
        'Un bon reporting ne s\'arrête pas à l\'affichage. Il doit permettre de comparer les périodes (semaine, mois, trimestre), d\'identifier les zones sous-couvertes et de détecter les délégués qui remontent leurs CRV en retard.',
        'DelegPharma fournit un tableau de bord avec les statistiques par délégué, par produit et par district, directement alimenté par les CRV validés. Les managers peuvent ensuite exporter les données en CSV ou PDF pour leurs réunions.',
      ] },
      { h: 'Fréquence et rituels de pilotage', p: [
        'Le rituel recommandé : un point hebdomadaire sur l\'activité et la couverture, un point mensuel sur les objectifs produits, et un bilan trimestriel sur le retour sur investissement de la force de vente. Chaque point s\'appuie sur les mêmes données du CRM.',
        'La régularité du reporting est aussi un moteur de motivation pour les délégués : les objectifs sont clairs, la performance est transparente, et les bonnes zones sont reconnues.',
      ] },
      { h: 'Exports et conformité', p: [
        'Les exports CSV/PDF permettent d\'archiver les CRV et les tableaux de bord, de justifier l\'activité auprès de la direction et de préparer les audits internes. Ils conservent la traçabilité : qui a visité qui, quand, avec quel résultat.',
        'Pour démarrer le pilotage, créez un <a href="/inscription">compte gratuit</a> ou consultez les <a href="/tarifs">formules DelegPharma</a>. Pour choisir l\'outil adapté, lisez le guide <a href="/blog/choisir-crm-force-de-vente-laboratoire-pharmaceutique">choisir un CRM de force de vente</a>.',
      ] },
    ],
    faq: [
      { q: 'Quels sont les KPIs d\'une force de vente pharmaceutique ?', a: 'Couverture par district, CRV validés, objectifs par produit phare, résultats des visites (accord, réserve, refus) et délai de remontée des comptes rendus.' },
      { q: 'À quelle fréquence piloter la force de vente ?', a: 'Hebdomadaire sur l\'activité, mensuel sur les objectifs produits, trimestriel sur le retour sur investissement.' },
      { q: 'Comment exporter les données de suivi ?', a: 'DelegPharma propose des exports CSV/PDF des CRV et des tableaux de bord par délégué, produit et district.' },
      { q: 'Le reporting permet-il de comparer les délégués ?', a: 'Oui, le tableau de bord compare l\'activité, la couverture et la conversion par délégué, sur la même base de données du CRM.' },
    ],
  },
  {
    path: '/blog/preparer-visite-medicale-argumentaire-produit',
    title: 'Préparer une visite médicale : argumentaire, objections, clôture',
    desc: 'Préparer une visite médicale efficace : argumentaire produit, levée des objections, entretien en 4 temps et clôture avec une prochaine visite planifiée.',
    h1: 'Préparer une visite médicale efficace',
    intro: 'La visite médicale est courte — 10 à 20 minutes chez un professionnel de santé occupé. Sa qualité se joue avant : préparation, argumentaire, gestion des objections et clôture.',
    sections: [
      { h: 'La préparation avant la visite', p: [
        'Avant chaque visite, identifiez le professionnel : nom, spécialité, structure, district, historique des visites et centres d\'intérêt. Fixez un objectif précis — obtenir un accord, laisser un échantillon, planifier la prochaine visite.',
        'Préparez les documents : fiche produit, numéro d\'agrément ARP, données scientifiques ou études disponibles. Un délégué bien préparé est crédible et gagne du temps sur le terrain.',
      ] },
      { h: 'Structurer l\'entretien en quatre temps', p: [
        'L\'accroche (se présenter, rappeler le contexte de la visite), la présentation du produit (les bénéfices pour le patient plus que les caractéristiques), la preuve (études, agrément, retours d\'expérience), et la clôture (demander un engagement : accord, échantillon, prochaine visite).',
        'Chaque temps répond à une question du professionnel : pourquoi vous, pourquoi ce produit, pourquoi maintenant, pourquoi pour mes patients ?',
      ] },
      { h: 'Gérer les objections', p: [
        'Une objection est un signal d\'intérêt, pas un refus. Classez-la : prix, concurrence, habitudes de prescription, crainte d\'effets indésirables. Répondez en écoutant, en reformulant et en apportant une preuve (donnée, agrément, essai).',
        'Ne jamais inventer de donnée : si vous n\'avez pas la réponse, notez la question et revenez avec une source documentée à la prochaine visite. C\'est un signe de sérieux qui renforce votre crédibilité.',
      ] },
      { h: 'Clôturer et consigner', p: [
        'Demandez un engagement clair : accord, réserve ou refus. Planifiez la prochaine visite. Consignez le tout dans le compte rendu de visite dans les 30 minutes — voir le <a href="/blog/crv-compte-rendu-de-visite-guide">guide du CRV</a>.',
        'Une visite sans clôture ni CRV est une visite perdue pour le laboratoire : la discipline du compte rendu transforme chaque entretien en donnée exploitable.',
      ] },
    ],
    faq: [
      { q: 'Combien de temps doit durer une visite médicale ?', a: 'En moyenne 10 à 20 minutes selon le professionnel et la structure. L\'essentiel est d\'avoir un ordre du jour clair et une clôture avec un engagement.' },
      { q: 'Comment gérer les objections d\'un médecin ?', a: 'Écouter, reformuler, apporter une preuve (étude, agrément ARP) et proposer un essai. Si vous n\'avez pas la réponse, notez-la et revenez avec une source officielle.' },
      { q: 'Que faire si le professionnel est absent ?', a: 'Consigner « absent » dans le CRV pour ne pas perdre la trace, et replanifier une visite dans le même district.' },
      { q: 'Quel est le bon moment pour une visite ?', a: 'Le délégué s\'adapte aux horaires du professionnel : fin de consultation, après-midi pour certains, début de matinée pour d\'autres. La tournée par district aide à optimiser l\'ordre de passage.' },
    ],
  },
  {
    path: '/blog/professionnels-de-sante-senegal-referentiel-delegue',
    title: 'Professionnels de santé au Sénégal : le guide du délégué médical',
    desc: 'Référentiel des professionnels de santé au Sénégal : médecins, pharmaciens, sages-femmes, infirmiers, dentistes — comment les cibler par district.',
    h1: 'Le référentiel des professionnels de santé du délégué médical',
    intro: 'Qui le délégué médical visite-t-il ? Médecins, pharmaciens, sages-femmes, infirmiers, dentistes… Chaque catégorie a ses besoins, ses horaires et son rôle dans la prescription. Le référentiel les structure pour une couverture complète.',
    sections: [
      { h: 'Les catégories et leur rôle dans la prescription', p: [
        'Les médecins sont les prescripteurs principaux — généralistes et spécialistes. Les pharmaciens dispensent et conseillent, parfois en proposant une alternative. Les sages-femmes jouent un rôle clé en santé maternelle et néonatale. Les infirmiers sont en première ligne dans les postes de santé. Les dentistes forment un réseau distinct.',
        'Chaque catégorie se visite avec un argumentaire adapté : le médecin attend des données, le pharmacien des conditions, la sage-femme des produits de santé maternelle, l\'infirmier une approche de soins.',
      ] },
      { h: 'Les structures où les rencontrer', p: [
        'La pyramide sanitaire sénégalaise comprend les hôpitaux, les centres de santé, les postes de santé et les cases de santé. Le référentiel (MSAS/ANSD) recense 3 915 structures et plus de 34 000 professionnels de santé, dont près de 1 230 officines selon esante.sn.',
        'Explorez le <a href="/carte-sanitaire">référentiel complet de la carte sanitaire</a>, région par région et district par district.',
      ] },
      { h: 'Cibler par district : la maille de la tournée', p: [
        'Chaque tournée se découpe par district sanitaire, avec une checklist des professionnels à visiter par catégorie. Cela évite les doublons, ne rate aucun prescripteur clé et rend la couverture mesurable. Voir le <a href="/blog/tournees-terrain-delegue-medical">guide des tournées terrain</a>.',
        'Les districts à forte densité de prescripteurs (Dakar, Thiès, Saint-Louis…) méritent une priorité dans le plan de couverture.',
      ] },
      { h: 'Le référentiel dans DelegPharma', p: [
        'DelegPharma référence les professionnels de santé de la carte sanitaire : type, spécialité, structure et district. Chaque visite est tracée, chaque taux de couverture se calcule automatiquement. <a href="/inscription">Créer un compte gratuit</a> pour le découvrir.',
      ] },
    ],
    faq: [
      { q: 'Quels professionnels visite un délégué médical ?', a: 'Médecins, pharmaciens, sages-femmes, infirmiers, dentistes, et parfois les laboratoires privés d\'analyses. Chaque catégorie a un rôle et un argumentaire adapté.' },
      { q: 'Combien de professionnels de santé y a-t-il au Sénégal ?', a: 'Le référentiel (MSAS/ANSD) recense plus de 34 000 professionnels de santé, répartis sur 3 915 structures, dont près de 1 230 officines selon esante.sn.' },
      { q: 'Comment se répartit la couverture ?', a: 'Par district sanitaire : chaque professionnel a un type, une structure et un historique de visites. Le taux de professionnels visités rapporté au ciblé définit la couverture.' },
      { q: 'Où trouver la liste des professionnels de santé ?', a: 'DelegPharma référence les professionnels de la carte sanitaire (14 régions, 79 districts) et permet de les filtrer par catégorie et par district.' },
    ],
  },
  {
    path: '/blog/salaire-remuneration-delegue-medical-senegal',
    title: 'Salaire et rémunération du délégué médical au Sénégal',
    desc: 'La rémunération du délégué médical au Sénégal : fixe, primes sur objectifs, avantages terrain — ce qui la compose et ce qui la fait varier.',
    h1: 'Salaire et rémunération du délégué médical',
    intro: 'Le salaire du délégué médical combine un fixe et des primes sur objectifs. Le total varie selon le laboratoire, la zone et l\'expérience : voici comment elle se structure et ce qui la fait évoluer.',
    sections: [
      { h: 'La structure de la rémunération', p: [
        'La rémunération se compose en général d\'un fixe mensuel et de primes de performance (objectifs produits, couverture de zone, comptes rendus validés). S\'y ajoutent parfois des avantages : véhicule, carburant, téléphone.',
        'Les montants précis se négocient avec chaque laboratoire. Aucune grille publique unique ne fait foi pour ce métier au Sénégal — méfiez-vous des chiffres présentés comme officiels.',
      ] },
      { h: 'Ce qui fait varier le salaire', p: [
        'L\'expérience et l\'ancienneté, la taille du laboratoire, la zone couverte (Dakar et les grandes villes par rapport aux régions), le portefeuille de produits et le chiffre d\'affaires apporté.',
        'Un délégué qui maîtrise sa zone et rend des comptes complets gagne en valeur : la couverture mesurable est un argument de négociation.',
      ] },
      { h: 'Les primes sur objectifs : le vrai levier', p: [
        'Les primes se calculent sur des objectifs concrets : réalisation des objectifs produits, taux de couverture des professionnels ciblés, CRV validés dans les délais. Voir le <a href="/blog/objectifs-campagnes-chiffre-affaires-laboratoire">guide des objectifs commerciaux</a>.',
        'Un CRM qui suit ces indicateurs en temps réel permet au délégué de piloter sa propre prime et au laboratoire de récompenser la performance réelle.',
      ] },
      { h: 'Négocier et évoluer', p: [
        'À l\'embauche, négociez le fixe, la part variable et les conditions terrain (véhicule, téléphone). Le <a href="/blog/comment-devenir-delegue-medical-senegal">guide pour devenir délégué médical</a> détaille les formations qui valorisent un profil.',
        'Avec de l\'expérience, les postes de manager de zone ou de responsable produits offrent un salaire plus élevé et des responsabilités élargies.',
      ] },
    ],
    faq: [
      { q: 'Combien gagne un délégué médical au Sénégal ?', a: 'Un fixe plus des primes sur objectifs, dont le total varie selon le laboratoire et l\'expérience. Pour un montant précis, demandez la grille au recruteur : aucune grille publique unique ne fait foi.' },
      { q: 'Les primes sont-elles mensuelles ?', a: 'Elles sont souvent mensuelles ou trimestrielles, calculées sur les objectifs produits, la couverture de zone et les comptes rendus validés.' },
      { q: 'Le délégué médical a-t-il une voiture ?', a: 'Souvent un véhicule de fonction ou une indemnité de carburant, selon le laboratoire et la zone couverte.' },
      { q: 'Le salaire augmente-t-il avec l\'expérience ?', a: 'Oui, et les postes de manager de zone ou de chef de produit sont des évolutions naturelles pour les délégués confirmés.' },
    ],
  },
  {
    path: '/blog/recruter-delegues-medicaux-laboratoire',
    title: 'Recruter des délégués médicaux : le guide du laboratoire',
    desc: 'Recruter des délégués médicaux au Sénégal : profil type, sources (licence pro ISMED, IPAM, IFAA, ICOA), entretien, test terrain et formation.',
    h1: 'Recruter des délégués médicaux : guide du laboratoire',
    intro: 'Le délégué médical est le visage du laboratoire sur le terrain. Un bon recrutement évite une zone sous-couverte et un départ coûteux. Voici comment évaluer, recruter et former efficacement.',
    sections: [
      { h: 'Le profil type', p: [
        'Les candidats formés à la licence professionnelle (ISMED UCAD, IUP-Santé) ou aux instituts privés (IPAM, IFAA, ICOA Santé) apportent la base pharmacologique et réglementaire. Détails dans <a href="/blog/comment-devenir-delegue-medical-senegal">devenir délégué médical</a>.',
        'Le profil commercial est apprécié, à condition d\'ajouter la formation produit. Les qualités clés : rigueur, sens du terrain, écoute, communication, éthique.',
      ] },
      { h: 'Les canaux de recrutement', p: [
        'Les écoles et instituts de formation fournissent un vivier régulier. Les annonces en ligne, la cooptation par les délégués actuels et le repérage de délégués expérimentés sont aussi efficaces.',
        'Pour une reprise en main rapide, un délégué confirmé formé sur vos produits démarre plus vite qu\'un junior : l\'arbitrage entre potentiel et rapidité dépend de votre plan de couverture.',
      ] },
      { h: 'L\'entretien et le test terrain', p: [
        'Évaluez la connaissance de la zone (districts, structures, prescripteurs), des produits et la posture éthique. Un test de visite simulée révèle le vrai savoir-faire.',
        'Demandez comment le candidat rédige ses comptes rendus : un candidat qui ne rend pas de comptes de façon structurée sera difficile à piloter. Voir le <a href="/blog/crv-compte-rendu-de-visite-guide">guide du CRV</a>.',
      ] },
      { h: 'L\'intégration et la formation continue', p: [
        'Programmez une immersion produits et agréments ARP, un parrainage par un délégué senior, des tournées d\'observation, puis une prise en main autonome suivie. La formation continue (nouveaux produits, campagnes) maintient la qualité de la force de vente.',
        'Un délégué bien intégré dans un outil unique (tournées, CRV, objectifs) devient vite opérationnel. <a href="/blog/manager-force-de-vie-delegues-medicaux">Voir le guide management de force de vente</a>.',
      ] },
    ],
    faq: [
      { q: 'Quels profils pour devenir délégué médical ?', a: 'Une licence professionnelle (ISMED UCAD, IUP-Santé) ou une formation courte (IPAM, IFAA, ICOA Santé). Un atout en pharmacie ou sciences de la santé est apprécié.' },
      { q: 'Combien de temps pour former un nouveau délégué ?', a: 'Quelques semaines d\'intégration produit et réglementaire, plus un parrainage terrain de plusieurs semaines avant l\'autonomie complète.' },
      { q: 'Profil formation ou terrain, que privilégier ?', a: 'Le terrain compte dans la pratique, mais la formation apporte la base réglementaire et pharmacologique. Un délégué confirmé remonté est opérationnel plus vite.' },
      { q: 'Comment évaluer un candidat efficacement ?', a: 'Par une présentation de visite simulée et l\'analyse de son approche du compte rendu : la structuration de la visite et de la trace est le meilleur indicateur.' },
    ],
  },
  {
    path: '/blog/lancer-produit-pharmaceutique-senegal',
    title: 'Lancer un produit pharmaceutique au Sénégal : le plan complet',
    desc: 'Lancer un médicament au Sénégal : agrément ARP, ciblage des prescripteurs par district, lancement par vagues et mesure de la couverture.',
    h1: 'Lancer un produit pharmaceutique au Sénégal',
    intro: 'Le lancement d\'un produit pharmaceutique repose sur la conformité (agrément), le ciblage (bon prescripteur, bon district) et la mesure (couverture, objectifs). Voici le plan en quatre étapes.',
    sections: [
      { h: 'La conformité : l\'agrément ARP', p: [
        'Avant toute promotion, le produit doit être enregistré auprès de l\'Agence de Régulation Pharmaceutique (ARP) et disposer de son numéro d\'agrément. Sans cela, aucune visite ni distribution légale. <a href="/blog/agrement-arp-laboratoires">Comprendre l\'agrément ARP</a>.',
        'Prévoyez ce délai dans votre plan de lancement : l\'instruction du dossier dépend du type de produit.',
      ] },
      { h: 'Le ciblage des prescripteurs', p: [
        'Identifiez les prescripteurs potentiels par spécialité et par district, puis priorisez les districts à forte densité : Dakar, Thiès, Saint-Louis, puis les régions. Le <a href="/blog/professionnels-de-sante-senegal-referentiel-delegue">référentiel des professionnels de santé</a> structure ce ciblage.',
        'Segmentez les messages : un médecin hospitalier, un pharmacien d\'officine et une sage-femme ne reçoivent pas le même argumentaire.',
      ] },
      { h: 'Le lancement par vagues', p: [
        'Commencez par une zone pilote : un nombre de districts maîtrisé, une équipe dédiée, des objectifs de couverture explicites. Étendez ensuite par vagues en réallouant les moyens selon les résultats.',
        'Assignez les objectifs par produit et par zone aux délégués concernés — voir le <a href="/blog/objectifs-campagnes-chiffre-affaires-laboratoire">guide objectifs et campagnes</a>.',
      ] },
      { h: 'La campagne et la mesure', p: [
        'Organisez des tournées dédiées au lancement, consignez chaque visite par produit dans les comptes rendus, et mesurez : taux de couverture des prescripteurs ciblés, réalisation des objectifs produits, résultats des CRV (accord, réserve, refus).',
        'Ces indicateurs disent en temps réel si le produit est adopté, où il faut accentuer la pression et quel argumentaire fonctionne. Une visibilité qu\'un CRM dédié, comme <a href="/blog/crm-laboratoire-pharmaceutique-delegues-medicaux">celui de la visite médicale</a>, rend possible.',
      ] },
    ],
    faq: [
      { q: 'L\'agrément ARP est-il obligatoire pour lancer ?', a: 'Oui. Le produit doit être enregistré auprès de l\'ARP pour être promu et distribué au Sénégal ; le numéro d\'agrément est la preuve de la conformité.' },
      { q: 'Par où commencer le lancement ?', a: 'Par le district le plus dense en prescripteurs, généralement Dakar, puis élargir par vagues en fonction de la couverture atteinte.' },
      { q: 'Comment mesurer le succès d\'un lancement ?', a: 'Par le taux de couverture des prescripteurs ciblés, la réalisation des objectifs produits et les résultats des comptes rendus (accord, réserve, refus).' },
      { q: 'Faut-il adapter le message selon la cible ?', a: 'Oui : un médecin hospitalier, un pharmacien et une sage-femme ont des besoins et des attentes différents — l\'argumentaire doit être segmenté.' },
    ],
  },
  {
    path: '/blog/manager-force-de-vie-delegues-medicaux',
    title: 'Manager une force de vente de délégués médicaux',
    desc: 'Manager une équipe de délégués médicaux : secteurs par district, rituels hebdo/mensuel/trimestriel, animation, validation des CRV et pilotage de la couverture.',
    h1: 'Manager une force de vente de délégués médicaux',
    intro: 'Manager des délégués médicaux, c\'est combiner la structuration (secteurs, objectifs), l\'animation (motivation, formation) et le contrôle (CRV, couverture). Un rôle de terrain qui se pilote avec des rituels.',
    sections: [
      { h: 'Structurer la force de vente', p: [
        'Alignez les secteurs des délégués sur les districts sanitaires de la carte sanitaire — la maille officielle — pour éviter les doublons et les zones blanches. Chaque délégué connaît sa zone et ses objectifs. <a href="/carte-sanitaire">Consulter le référentiel</a>.',
        'Un référentiel partagé (professionnels, structures, districts) dans un <a href="/blog/crm-laboratoire-pharmaceutique-delegues-medicaux">CRM de visite médicale</a> évite les tableurs et les conflits de répartition.',
      ] },
      { h: 'Les rituels de pilotage', p: [
        'Le rituel hebdomadaire : activité de la semaine (visites réalisées, CRV validés, couverture en cours). Le rituel mensuel : réalisation des objectifs produits. Le rituel trimestriel : le retour sur investissement de la force de vente.',
        'Chaque point s\'appuie sur les mêmes données du CRM — voir le <a href="/blog/reporting-kpi-laboratoire-force-de-vente">guide reporting et KPIs</a>.',
      ] },
      { h: 'Animer et motiver', p: [
        'Des objectifs clairs, un feedback constructif après les CRV, la reconnaissance des zones et des délégués performants : l\'animation ne remplace pas la structure, elle la fait vivre.',
        'La formation continue et le mentorat fidélisent : un délégué qui voit un chemin d\'évolution (manager de zone, chef de produit) s\'investit davantage.',
      ] },
      { h: 'Contrôler sans tuer l\'initiative', p: [
        'Le contrôle passe par la validation des CRV et les taux de couverture, en temps réel, avec un retour constructif plutôt que des sanctions. Voir le <a href="/blog/crv-compte-rendu-de-visite-guide">cycle de validation du CRV</a>.',
        'Face à une zone sous-couverte : réaffectez, coachez, redéfinissez le plan. Face à un délégué en retard de reporting : débloquez l\'obstacle avant de conclure.',
      ] },
    ],
    faq: [
      { q: 'Comment organiser une équipe de délégués ?', a: 'Par secteurs alignés sur les districts sanitaires, chacun avec des objectifs propres et une checklist de professionnels à visiter.' },
      { q: 'Quels rituels pour manager ?', a: 'Hebdomadaire sur l\'activité et la couverture, mensuel sur les objectifs produits, trimestriel sur le retour sur investissement.' },
      { q: 'Comment motiver les délégués ?', a: 'Objectifs clairs, reconnaissance des résultats, formation continue et participation aux décisions qui touchent leur zone.' },
      { q: 'Comment contrôler sans freiner ?', a: 'Par les CRV validés et la couverture, en temps réel, avec un retour constructif : le contrôle est un outil de pilotage, pas de défiance.' },
    ],
  },
  {
    path: '/blog/formations-delegue-medical-senegal',
    title: 'Formations de délégué médical au Sénégal : le guide des écoles',
    desc: 'Les formations de délégué médical au Sénégal : licence pro ISMED UCAD, IUP-Santé, instituts IPAM, IFAA, ICOA Santé — durées et tarifs indicatifs.',
    h1: 'Les formations de délégué médical au Sénégal',
    intro: 'Devenir délégué médical passe par une formation reconnue. Voici les principales voies au Sénégal : la licence professionnelle et les formations courtes des instituts privés.',
    sections: [
      { h: 'La licence professionnelle (2 à 3 ans)', p: [
        'La licence professionnelle en délégué médical est la voie la plus reconnue. Elle est proposée notamment par l\'Institut des sciences du médicament (ISMED) de l\'UCAD, avec une admission à Bac + 2, et par l\'IUP-Santé.',
        'Ce parcours long apporte une base solide en pharmacologie, réglementation et visite médicale, très valorisée par les laboratoires.',
      ] },
      { h: 'Les formations courtes (8 à 10 mois)', p: [
        'Des instituts privés proposent des formations accélérées : l\'IPAM (diplôme d\'études spéciales en visite médicale, 8 mois en cours du soir), l\'IFAA (10 mois, dont 1 mois de stage), l\'ICOA Santé (10 mois) et l\'IUP-Santé (admission dès le BFEM).',
        'Les frais sont variables selon l\'institut — à titre indicatif, 2026 : IPAM 555 000 FCFA pour le DESMV, IFAA 55 000 FCFA/mois, ICOA Santé 60 000 FCFA/mois, IUP-Santé 50 000 FCFA/mois. Vérifiez les conditions d\'admission et les tarifs auprès de chaque école.',
      ] },
      { h: 'Le contenu des formations', p: [
        'Les programmes couvrent la pharmacologie, la visite médicale, la communication et la réglementation pharmaceutique. Un profil en pharmacie, biologie ou sciences de la santé est un atout.',
        'Le <a href="/blog/comment-devenir-delegue-medical-senegal">guide complet pour devenir délégué médical</a> détaille le parcours, les compétences et les débouchés.',
      ] },
      { h: 'Choisir sa formation', p: [
        'L\'arbitrage se joue entre la reconnaissance (licence pro) et la rapidité d\'entrée sur le marché (formations courtes). Le budget et le niveau d\'admission (BFEM, Bac, Bac + 2) orientent aussi le choix.',
        'Les laboratoires recrutent aussi des profils commerciaux formés sur le tas, mais la formation reste la voie la plus reconnue et la plus valorisée.',
      ] },
    ],
    faq: [
      { q: 'Quelle est la meilleure formation de délégué médical au Sénégal ?', a: 'La licence professionnelle (ISMED UCAD, IUP-Santé) est la plus reconnue. Les instituts privés (IPAM, IFAA, ICOA Santé) offrent des formations courtes pour entrer plus vite sur le marché.' },
      { q: 'Combien coûte une formation de délégué médical ?', a: 'À titre indicatif (2026) : IPAM 555 000 FCFA pour le DESMV, IFAA 55 000 FCFA/mois, ICOA Santé 60 000 FCFA/mois, IUP-Santé 50 000 FCFA/mois. Vérifiez auprès de chaque école.' },
      { q: 'Peut-on devenir délégué médical sans formation ?', a: 'Certains laboratoires recrutent des profils commerciaux formés sur le tas, mais la formation reste la voie la plus reconnue et la plus valorisée.' },
      { q: 'Quel est le contenu d\'une formation de délégué médical ?', a: 'Pharmacologie, visite médicale, communication et réglementation pharmaceutique, complétés par un stage pour les formations courtes.' },
    ],
  },
  {
    path: '/blog/devenir-delegue-medical-cote-ivoire',
    title: 'Devenir délégué médical en Côte d\'Ivoire : formations',
    desc: 'Devenir délégué médical en Côte d\'Ivoire : formations (Medicours, IIFPM, UFR SPB, Académie Tridem), salaire 250 000-600 000 FCFA, 1 217 officines.',
    h1: 'Devenir délégué médical en Côte d\'Ivoire',
    intro: 'La Côte d\'Ivoire compte plus de 1 200 officines et un marché pharmaceutique en forte croissance. Voici les formations reconnues pour devenir délégué médical, les salaires pratiqués et les débouchés.',
    sections: [
      { h: 'Les formations de délégué médical en Côte d\'Ivoire', p: [
        'Quatre voies principales se distinguent. L\'Institut Medicours International propose une formation de délégué médical en 12 mois (dont 6 mois de stage), accessible à partir du BAC, avec un suivi en ligne possible.',
        'L\'IIFPM (Abidjan, Cocody) forme au métier de Délégué Médical Spécialisé (gynécologie, cardiologie, ophtalmologie), avec stage assuré et premier emploi visé. L\'UFR Sciences Pharmaceutiques et Biologiques de l\'Université Félix Houphouët-Boigny délivre un certificat spécialisé de visiteurs médicaux en 12 mois (8 mois de cours, 3 mois de stage, 1 mois de mémoire).',
        'L\'Académie Tridem, créée par Tridem Pharma avec l\'UFHB, forme des visiteurs médicaux et pharmaceutiques à un niveau universitaire sur un an.',
      ] },
      { h: 'Le coût des formations', p: [
        'Les tarifs varient selon l\'établissement. À titre indicatif, le certificat de l\'UFR SPB (UFHB) revient à 1 000 000 FCFA (200 000 FCFA de scolarité UFHB + 800 000 FCFA de frais pédagogiques), plus 30 000 FCFA de frais de candidature.',
        'Les instituts privés comme Medicours et l\'IIFPM communiquent leurs frais directement. Vérifiez toujours les conditions d\'admission et les tarifs auprès de chaque école avant de vous engager.',
      ] },
      { h: 'Le salaire d\'un délégué médical en Côte d\'Ivoire', p: [
        'Le salaire d\'un délégué médical en Côte d\'Ivoire se situe généralement entre 250 000 et 600 000 FCFA par mois, selon l\'expérience, le laboratoire et la zone couverte.',
        'Les profils spécialisés (Délégué Médical Spécialisé) et ceux issus de formations universitaires reconnues négocient les rémunérations les plus élevées.',
      ] },
      { h: 'Le marché : 1 217 officines et 4 grossistes', p: [
        'Le secteur privé ivoirien compte 1 217 officines de pharmacie (Ministère de la Santé, fin août 2025) et 9 unités de production de médicaments. Quatre grossistes-répartiteurs approvisionnent le marché : UBIPHARM, COPHARMED, DPCI et TEDIS PHARMA CI.',
        'Plus de 90 % des médicaments sont importés, ce qui maintient une forte présence des délégués médicaux sur le terrain pour la promotion auprès des officines et des professionnels de santé.',
      ] },
      { h: 'La régulation : AIRP et DAP', p: [
        'La visite médicale en Côte d\'Ivoire s\'exerce dans un cadre réglementé. L\'AIRP (Autorité Ivoirienne de Régulation Pharmaceutique, loi n° 2017-541) encadre l\'activité pharmaceutique, et la DAP (Direction de l\'Activité Pharmaceutique) définit la politique pharmaceutique nationale.',
        'L\'Ordre National des Pharmaciens (loi n° 2015-535) régit la profession. Un délégué médical qui maîtrise ce cadre réglementaire est un atout pour les laboratoires.',
      ] },
      { h: 'Choisir sa formation', p: [
        'L\'arbitrage se joue entre la reconnaissance universitaire (UFR SPB, Académie Tridem) et la rapidité d\'entrée sur le marché (Medicours, IIFPM). Le budget, le niveau d\'admission et la spécialisation souhaitée orientent le choix.',
        'Au Sénégal, le guide des <a href="/blog/formations-delegue-medical-senegal">formations de délégué médical</a> détaille les voies équivalentes. Les laboratoires recrutent aussi des profils commerciaux formés sur le tas, mais la formation reste la voie la plus reconnue.',
      ] },
    ],
    faq: [
      { q: 'Quelle est la meilleure formation de délégué médical en Côte d\'Ivoire ?', a: 'Le certificat de l\'UFR SPB (Université Félix Houphouët-Boigny) et l\'Académie Tridem offrent la reconnaissance universitaire. Medicours et l\'IIFPM proposent des formations plus courtes pour entrer plus vite sur le marché.' },
      { q: 'Combien coûte une formation de délégué médical en Côte d\'Ivoire ?', a: 'À titre indicatif, le certificat de l\'UFR SPB revient à 1 000 000 FCFA (plus 30 000 FCFA de candidature). Les instituts privés communiquent leurs frais directement.' },
      { q: 'Quel est le salaire d\'un délégué médical en Côte d\'Ivoire ?', a: 'Entre 250 000 et 600 000 FCFA par mois selon l\'expérience, le laboratoire et la zone couverte. Les profils spécialisés négocient les rémunérations les plus élevées.' },
      { q: 'Peut-on devenir délégué médical en Côte d\'Ivoire sans formation ?', a: 'Certains laboratoires recrutent des profils commerciaux formés sur le tas, mais la formation reste la voie la plus reconnue et la plus valorisée.' },
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
        { '@type': 'Question', name: 'Quels sont les tarifs de DelegPharma ?', acceptedAnswer: { '@type': 'Answer', text: 'Trois formules : Essentiel à 5 000 FCFA, Standard à 10 000 FCFA et Premium à 15 000 FCFA par mois, payables en Mobile Money (Wave, Orange Money, QR Wave/OM), carte Visa/Mastercard ou PayPal.' } },
        { '@type': 'Question', name: 'Puis-je générer mes comptes rendus de visite en PDF ?', acceptedAnswer: { '@type': 'Answer', text: 'Oui, chaque CRV validé est généré en PDF signé en une seconde, avec les pièces jointes du terrain (photos, bons de commande, documents).' } },
        { '@type': 'Question', name: 'Quels professionnels de santé sont référencés ?', acceptedAnswer: { '@type': 'Answer', text: 'Le référentiel couvre les structures et professionnels de santé (médecins, pharmaciens, sages-femmes, infirmiers) répartis sur les 14 régions et 79 districts sanitaires du Sénégal.' } },
      ],
    },
  ],
};

const PAGES = {
  '/': {
    index: true,
    title: 'DelegPharma — CRM des laboratoires et délégués médicaux au Sénégal',
    desc: 'Le CRM des laboratoires et délégués médicaux au Sénégal : tournées, CRV, objectifs, couverture par district. Compte gratuit. Dès 5 000 FCFA/mois.',
    canonical: '/',
    jsonLd: LANDING_JD,
    body: landingBody,
  },
  '/tarifs': {
    index: true,
    title: 'Tarifs DelegPharma — 5 000 / 10 000 / 15 000 FCFA par mois',
    desc: 'Abonnez-vous à DelegPharma : Essentiel 5 000 FCFA, Standard 10 000 FCFA ou Premium 15 000 FCFA par mois. Paiement Mobile Money (Wave, Orange Money, QR Wave/OM), carte Visa/Mastercard ou PayPal. 30 jours, renouvelable.',
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
    title: 'Liste des laboratoires pharmaceutiques au Sénégal — 2026',
    desc: 'Liste des laboratoires pharmaceutiques au Sénégal : industriels, distributeurs, génériques. Annuaire référencé sur DelegPharma pour les délégués médicaux.',
    canonical: '/laboratoires',
    jsonLd: () => ({
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      itemListElement: (laboratoiresCache || []).map((l, i) => ({ '@type': 'ListItem', position: i + 1, name: l.nom, item: BASE + '/laboratoires' })),
    }),
    body: laboratoiresBody,
  },
  '/login': { index: false, title: 'Connexion — DelegPharma', desc: 'Accédez à votre espace délégué médical DelegPharma.', canonical: '/login', jsonLd: null, body: loginBody },
  '/inscription': { index: true, title: 'Créer un compte gratuit — DelegPharma', desc: 'Créez votre compte gratuit DelegPharma : découvrez le CRM des délégués médicaux et des laboratoires pharmaceutiques au Sénégal, puis abonnez-vous en Mobile Money (Wave, Orange Money, QR), carte Visa/Mastercard ou PayPal.', canonical: '/inscription', jsonLd: null, body: inscriptionBody },
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
  '/blog': {
    index: true,
    title: 'Blog — guides du délégué médical et du laboratoire',
    desc: 'Les guides de DelegPharma pour les délégués médicaux et les laboratoires pharmaceutiques au Sénégal : formation, salaire, tournées, CRV, carte sanitaire, CRM de visite médicale.',
    canonical: '/blog',
    jsonLd: () => ({
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'BreadcrumbList', itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Accueil', item: BASE + '/' },
          { '@type': 'ListItem', position: 2, name: 'Blog', item: BASE + '/blog' },
        ] },
        { '@type': 'ItemList', itemListElement: GUIDES.map((g, i) => ({ '@type': 'ListItem', position: i + 1, name: g.h1, url: BASE + g.path })) },
      ],
    }),
    body: blogBody,
  },
  '/delegue-medical': {
    index: true,
    title: 'Délégué médical — métier, formation, salaire, outils | DelegPharma',
    desc: 'Délégué médical au Sénégal : objectifs, débouchés (laboratoires, grossistes, industries, vendeur en pharmacie), formations et outils de visite médicale.',
    canonical: '/delegue-medical',
    jsonLd: {
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'BreadcrumbList', itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Accueil', item: BASE + '/' },
          { '@type': 'ListItem', position: 2, name: 'Délégué médical', item: BASE + '/delegue-medical' },
        ] },
        {
          '@type': 'WebPage',
          '@id': BASE + '/delegue-medical',
          url: BASE + '/delegue-medical',
          name: 'Délégué médical — métier, formation, salaire, outils | DelegPharma',
          headline: 'Délégué médical',
          description: 'Délégué médical au Sénégal : objectifs, débouchés (laboratoires, grossistes, industries, vendeur en pharmacie), formations et outils de visite médicale.',
          isPartOf: { '@type': 'WebSite', '@id': BASE + '/#website', url: BASE + '/', name: 'DelegPharma' },
          publisher: { '@type': 'Organization', '@id': BASE + '/#org', name: 'DelegPharma', url: BASE + '/', logo: { '@type': 'ImageObject', url: BASE + '/og-image-1200x630.png' } },
          author: { '@type': 'Organization', name: 'DelegPharma', url: BASE + '/' },
          datePublished: '2026-08-24',
          dateModified: '2026-08-24',
          primaryImageOfPage: { '@type': 'ImageObject', url: BASE + '/og-image-1200x630.png', width: 1200, height: 630 },
          inLanguage: 'fr',
        },
        { '@type': 'FAQPage', mainEntity: DELEGUE_FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a.replace(/<[^>]+>/g, '') } })) },
      ],
    },
    body: delegueMedicalBody,
  },
  '/mentions-legales': {
    index: true,
    title: 'Mentions légales — DelegPharma',
    desc: 'Mentions légales du site DelegPharma (app.delegpharma.com) : éditeur, directeur de publication, hébergeur OVHcloud et contact.',
    canonical: '/mentions-legales',
    jsonLd: null,
    body: () => legalBody({
      h1: 'Mentions légales',
      intro: 'Le site app.delegpharma.com est édité par DelegPharma, le CRM des délégués médicaux et des laboratoires pharmaceutiques au Sénégal.',
      sections: [
        { h: 'Éditeur', p: [
          LEGAL_ENTITY_NAME && LEGAL_ADDRESS
            ? `DelegPharma — ${esc(LEGAL_ENTITY_NAME)} — ${esc(LEGAL_ADDRESS)}, Sénégal.`
            : 'DelegPharma — informations légales de l\'éditeur (raison sociale, adresse) en cours de publication.',
          ...(LEGAL_RC || LEGAL_NINEA ? [[
            LEGAL_RC && `RC ${esc(LEGAL_RC)}`,
            LEGAL_NINEA && `NINEA ${esc(LEGAL_NINEA)}`,
          ].filter(Boolean).join(' — ') + '.'] : []),
          LEGAL_DIRECTOR_NAME
            ? `Directeur de la publication : ${esc(LEGAL_DIRECTOR_NAME)}.`
            : 'Directeur de la publication : information en cours de publication.',
        ] },
        { h: 'Hébergeur', p: [
          'Le site est hébergé par OVHcloud, 2 rue Kellermann, 59100 Roubaix, France (serveur dédié/VPS).',
        ] },
        { h: 'Contact', p: [
          SUPPORT_EMAIL
            ? `Pour toute question : ${esc(SUPPORT_EMAIL)}. Pour les demandes professionnelles (laboratoires, délégués médicaux), voir la <a href="/contact">page contact</a>.`
            : 'Pour toute question, voir la <a href="/contact">page contact</a>.',
        ] },
        { h: 'Propriété intellectuelle', p: [
          'Les contenus du site (textes, données, marque DelegPharma) sont la propriété de DelegPharma. Toute reproduction sans autorisation est interdite.',
        ] },
      ],
    }),
  },
  '/politique-de-confidentialite': {
    index: true,
    title: 'Politique de confidentialité — DelegPharma',
    desc: 'Politique de confidentialité de DelegPharma : données collectées, finalités, base légale, durée de conservation et droits des utilisateurs.',
    canonical: '/politique-de-confidentialite',
    jsonLd: null,
    body: () => legalBody({
      h1: 'Politique de confidentialité',
      intro: 'DelegPharma traite les données personnelles de ses utilisateurs (délégués médicaux, laboratoires) dans le cadre de la fourniture de son service CRM. Cette politique explique quelles données sont collectées et comment elles sont utilisées.',
      sections: [
        { h: 'Données collectées', p: [
          'Lors de la création d\'un compte : nom, adresse e-mail, numéro de téléphone, laboratoire et formule choisie. Dans le cadre du service : données d\'activité (tournées, comptes rendus de visite, professionnels de santé visités).',
        ] },
        { h: 'Finalités', p: [
          'Les données servent à fournir le service CRM (planification des tournées, CRV, suivi des objectifs), à la facturation et au support client. Elles ne sont jamais revendues à des tiers.',
        ] },
        { h: 'Base légale et conservation', p: [
          `Le traitement repose sur l'exécution du contrat de service et le consentement. Les données sont conservées pendant la durée de l'abonnement${DATA_RETENTION_NOTE ? `, puis ${esc(DATA_RETENTION_NOTE)}` : ', puis pour la durée nécessaire au respect de nos obligations légales et comptables.'}`,
        ] },
        { h: 'Vos droits', p: [
          `Conformément à la loi sénégalaise n° 2008-12 sur la protection des données personnelles et au RGPD, vous disposez d'un droit d'accès, de rectification et de suppression de vos données.${DPO_EMAIL ? ` Pour l'exercer : ${esc(DPO_EMAIL)}.` : ' Pour l\'exercer, voir la <a href="/contact">page contact</a>.'}`,
        ] },
      ],
    }),
  },
  '/contact': {
    index: true,
    title: 'Contact — DelegPharma',
    desc: 'Contacter DelegPharma : support utilisateurs, démonstration pour laboratoires, partenariats délégués médicaux au Sénégal.',
    canonical: '/contact',
    jsonLd: null,
    body: () => legalBody({
      h1: 'Contact',
      intro: 'Une question sur DelegPharma, une démonstration pour votre laboratoire, un partenariat ? Voici comment nous joindre.',
      sections: [
        { h: 'Support et démonstration', p: [
          ...(SUPPORT_EMAIL ? [`Pour les délégués médicaux et les laboratoires : ${esc(SUPPORT_EMAIL)}.`] : []),
          ...(SUPPORT_WHATSAPP ? [`WhatsApp : ${esc(SUPPORT_WHATSAPP)} — le canal le plus direct au Sénégal.`] : []),
          ...(!SUPPORT_EMAIL && !SUPPORT_WHATSAPP ? ['Créez un compte gratuit ci-dessous pour échanger avec notre équipe, ou consultez nos <a href="/tarifs">tarifs</a>.'] : []),
        ] },
        { h: 'Créer un compte', p: [
          'Vous pouvez aussi <a href="/inscription">créer un compte gratuit</a> pour découvrir le CRM, ou consulter les <a href="/tarifs">formules</a>.',
        ] },
      ],
    }),
  },
};
for (const g of GUIDES) PAGES[g.path] = articlePage(g);
const FALLBACK = { index: false, title: 'DelegPharma — CRM des laboratoires et délégués médicaux', desc: 'CRM des laboratoires pharmaceutiques et délégués médicaux au Sénégal.', canonical: '/', jsonLd: null, body: landingBody };

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
    `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`,
    '<meta property="og:locale" content="fr_FR">',
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
    { loc: '/inscription', freq: 'monthly', prio: '0.7' },
    { loc: '/tarifs', freq: 'monthly', prio: '0.8' },
    { loc: '/laboratoires', freq: 'weekly', prio: '0.7' },
    { loc: '/blog', freq: 'weekly', prio: '0.8' },
    { loc: '/carte-sanitaire', freq: 'weekly', prio: '0.9' },
    { loc: '/delegue-medical', freq: 'monthly', prio: '0.9' },
    { loc: '/a-propos', freq: 'monthly', prio: '0.5' },
    { loc: '/mentions-legales', freq: 'yearly', prio: '0.2' },
    { loc: '/politique-de-confidentialite', freq: 'yearly', prio: '0.2' },
    { loc: '/contact', freq: 'yearly', prio: '0.3' },
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
  const urls = sitemapUrls().map((u) => `  <url><loc>${BASE}${u.loc}</loc><lastmod>2026-08-17</lastmod><changefreq>${u.freq}</changefreq><priority>${u.prio}</priority></url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}
export { warmTarifs, warmLaboratoires, warmCarteSanitaire, matchPage };
