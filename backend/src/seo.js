// DelegPharma — SEO : head complet par route + SSR des pages publiques + robots/sitemap.
// Chargé par server.js. La SPA garde son hash-routing ; ici on pré-rend le contenu public
// (crawlers / pas de JS) et on injecte meta/canonical/OG/JSON-LD dans le shell.
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { all } from './db.js';

const here = dirname(fileURLToPath(import.meta.url));
const BASE = 'https://app.delegpharma.com';
const SHELL = readFileSync(resolve(here, '../../frontend/index.html'), 'utf8');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const toFr = (n) => Number(n).toLocaleString('fr-FR');
const jd = (o) => JSON.stringify(o).replace(/</g, '\\u003c'); // JSON-LD sûr dans <script>

// Tarifs réels (base seedée) mis en cache au démarrage ; fallback = valeurs officielles du seed.
let tarifsCache = null;
export async function warmTarifs() {
  try { tarifsCache = await all('SELECT id, nom, prix, duree_jours, fonctionnalites FROM formule ORDER BY prix'); }
  catch (e) { console.error('[seo] warmTarifs échoué (fallback statique) :', e.message); }
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
  return `
  <div class="hero">
    <h1><span>DelegPharma</span> — CRM du délégué médical</h1>
    <p>Planifiez vos tournées, suivez chaque professionnel de santé, rédigez vos comptes rendus de visite et pilotez vos campagnes — de Dakar à Kédougou.</p>
    <p style="margin-top:18px">
      <a class="primary" href="/login" style="display:inline-block;padding:11px 26px;font-size:15px;text-decoration:none">Se connecter</a>
      <a class="primary" href="/tarifs" style="display:inline-block;padding:11px 26px;font-size:15px;text-decoration:none">Voir les tarifs</a>
    </p>
  </div>
  <div class="features">
    <div class="feature"><div class="ico">🗺️</div><h3>Référentiel national</h3><p>14 régions médicales, 79 districts sanitaires, structures et professionnels de santé ciblés.</p></div>
    <div class="feature"><div class="ico">📋</div><h3>Comptes rendus de visite</h3><p>CRV brouillon → soumis → validé, pièces jointes et PDF signé généré en une seconde.</p></div>
    <div class="feature"><div class="ico">🧭</div><h3>Tournées terrain</h3><p>Checklist des professionnels par district pour ne rater aucune visite.</p></div>
    <div class="feature"><div class="ico">📈</div><h3>Campagnes & couverture</h3><p>Objectifs validés, taux de couverture par produit, pilotage par laboratoire.</p></div>
  </div>`;
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
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      itemListElement: tarifs().map((t, i) => ({ '@type': 'Offer', position: i + 1, name: t.nom, price: String(t.prix), priceCurrency: 'XOF', url: BASE + '/tarifs' })),
    },
    body: tarifsBody,
  },
  '/login': { index: false, title: 'Connexion — DelegPharma', desc: 'Accédez à votre espace délégué médical DelegPharma.', canonical: '/login', jsonLd: null, body: loginBody },
  '/inscription': { index: false, title: 'Inscription délégué médical — DelegPharma', desc: 'Créez votre compte délégué médical et abonnez-vous en Mobile Money.', canonical: '/inscription', jsonLd: null, body: loginBody },
};
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
  const jdHtml = page.jsonLd ? `\n  <script type="application/ld+json">${jd(page.jsonLd)}</script>` : '';
  return [
    `<title>${esc(page.title)}</title>`,
    `<meta name="description" content="${esc(page.desc)}">`,
    `<meta name="robots" content="${robots}">`,
    `<link rel="canonical" href="${canonical}">`,
    og,
    jdHtml,
  ].join('\n  ');
}

export function seoShell(req) {
  const page = PAGES[req.path] || FALLBACK;
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

const SITEMAP = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${BASE}/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>
  <url><loc>${BASE}/tarifs</loc><changefreq>monthly</changefreq><priority>0.8</priority></url>
</urlset>
`;

export function robotsTxt() { return ROBOTS; }
export function sitemapXml() { return SITEMAP; }
