/* DelegPharma — SPA vanilla servie par Express (une seule origine, cookie httpOnly). */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const today = () => new Date().toISOString().slice(0, 10);
const fmtDate = (d) => (d ? String(d).slice(0, 10) : '—');

const state = { user: null, labo: null, catalog: null, abonnement: null, tarifs: null, laboratoires: null, selFormule: null, hash: location.hash || '#/landing' };
let draft = { produits: [], docs: [] };
let psFilters = { region_id: '', district_id: '', specialite_id: '', potentiel: '', q: '' };
let crvFilters = { statut: '', region_id: '', district_id: '' };

/* ---------- API ---------- */
async function api(path, opts = {}) {
  const res = await fetch('/api' + path, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  const ct = res.headers.get('content-type') || '';
  const body = ct.includes('application/json') ? await res.json() : await res.text();
  if (!res.ok) throw new Error(body?.error || `Erreur ${res.status}`);
  return body;
}
function toast(msg) {
  $('#toast')?.remove();
  const t = document.createElement('div');
  t.className = 'toast';
  t.id = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2600);
}
async function catalog() {
  if (!state.catalog) state.catalog = await api('/catalog');
  return state.catalog;
}
const can = (roles) => state.user && roles.includes(state.user.role);

/* ---------- Démarrage ---------- */
async function init() {
  const p = location.pathname.replace(/\/+$/, '');
  // Garde « contenu statique » : /carte-sanitaire/* et /blog/* sont entièrement rendus
  // serveur (SSR). La SPA ne doit pas écraser le pré-rendu — on sort immédiatement.
  if (p.startsWith('/carte-sanitaire') || p.startsWith('/blog') || p === '/a-propos') return;
  // SEO : les URLs publiques /tarifs, /login, /inscription (SSR) doivent hydrater la vue
  // hash-routing correspondante — sinon le JS écraserait le pré-rendu par la landing.
  if (!location.hash) {
    const map = { '/tarifs': '#/tarifs', '/login': '#/login', '/inscription': '#/inscription', '/landing': '#/landing', '/laboratoires': '#/laboratoires' };
    if (map[p]) { location.hash = map[p]; state.hash = map[p]; }
  }
  try {
    const me = await api('/auth/me');
    state.user = me.user;
    state.labo = me.laboratoire;
    state.abonnement = me.abonnement || null;
  } catch { /* non connecté */ }
  window.addEventListener('hashchange', () => { state.hash = location.hash || '#/landing'; route(); });
  route();
}
function route() {
  if (!state.user) {
    const h = state.hash;
    if (h === '#/tarifs') { render(publicPage('Nos tarifs', '<div data-slot="body" class="muted">Chargement…</div>')); loadTarifs(); return; }
    if (h === '#/laboratoires') { render(publicPage('Laboratoires au Sénégal', '<div data-slot="body" class="muted">Chargement…</div>')); loadLaboratoires(); return; }
    if (h === '#/inscription') { render(publicPage('Inscription délégué', '<div data-slot="body" class="muted">Chargement…</div>')); loadInscription(); return; }
    render(h === '#/login' ? loginView() : landingView());
    return;
  }
  render(appShell());
}
function render(html) {
  $('#app').innerHTML = html;
  bind(); // délégation sur document (onclick/onchange/onsubmit) — toujours réattacher,
          // car au chargement avec cookie de session il n'y a pas de bind() sinon.
  if ($('#view')) showView();
}
/* Rendu interne dans le shell (après nav). bind() est global sur document. */
function renderMain(html) { $('#view').innerHTML = html; }

/* ---------- Shell + nav ---------- */
const NAV = {
  delegue: [['dashboard', 'Tableau de bord'], ['referentiel', 'Référentiel'], ['crv', 'CRV'], ['tournees', 'Tournées'], ['objectifs', 'Objectifs'], ['messagerie', 'Messagerie'], ['abonnement', 'Abonnement']],
  manager: [['dashboard', 'Tableau de bord'], ['referentiel', 'Référentiel'], ['crv', 'CRV'], ['tournees', 'Tournées'], ['campagnes', 'Campagnes'], ['objectifs', 'Objectifs'], ['messagerie', 'Messagerie'], ['abonnement', 'Abonnement'], ['revenus', 'Revenus']],
  laboratoire: [['dashboard', 'Tableau de bord'], ['referentiel', 'Référentiel'], ['crv', 'CRV'], ['campagnes', 'Campagnes'], ['objectifs', 'Objectifs'], ['messagerie', 'Messagerie'], ['abonnement', 'Abonnement'], ['revenus', 'Revenus']],
  admin: [['dashboard', 'Tableau de bord'], ['referentiel', 'Référentiel'], ['crv', 'CRV'], ['tournees', 'Tournées'], ['campagnes', 'Campagnes'], ['objectifs', 'Objectifs'], ['messagerie', 'Messagerie'], ['abonnement', 'Abonnement'], ['revenus', 'Revenus']],
  plateforme: [['plateforme', 'Plateforme'], ['revenus', 'Revenus'], ['referentiel', 'Référentiel']],
  professionnel: [['professionnel', 'Mes visites']],
};
function appShell() {
  const hash = state.hash;
  const nav = (NAV[state.user.role] || []).map(([h, label]) =>
    `<a href="#/${h}" class="${hash === '#/' + h ? 'active' : ''}">${label}</a>`).join('');
  return `
  <header class="app">
    <div class="brand">DelegPharma <small>· ${esc(state.labo?.nom || '')}</small></div>
    <nav class="main">${nav}</nav>
    <div class="userbox"><b>${esc(state.user.nom)}</b><span class="badge ${state.user.role}">${state.user.role}</span>
      <button class="ghost small" data-action="logout">Déconnexion</button></div>
  </header>
  ${state.user.role === 'delegue' ? `<div id="abo-banner-slot">${aboBanner()}</div>` : ''}
  <main id="view"></main>`;
}
async function showView() {
  if (state.user.role === 'delegue') await refreshMe(); // abonnement frais (verrouillage progressif §3.2)
  if (state.user.role === 'delegue') refreshAboBanner(); // le shell a pu être rendu avant le refreshMe (login/auto-login)
  const h = state.hash.split('?')[0];
  // Porte d'entrée monétisation : abonnement expiré → #/abonnement pour se réabonner.
  // Compte gratuit (statut « aucun ») = découverte en lecture seule : navigation libre,
  // l'écriture est bloquée côté API (403) et le bandeau invite à souscrire.
  const a = state.abonnement;
  if (state.user.role === 'delegue' && a && a.statut === 'expire' && h !== '#/abonnement') {
    state.hash = '#/abonnement';
    if (location.hash !== '#/abonnement') location.hash = '#/abonnement';
  }
  return runView(); // runView rend le résultat via renderMain
}

/* ---------- Landing / Login ---------- */
function landingView() {
  return `
  <div class="hero">
    <h1><span>DelegPharma</span> — CRM du délégué médical</h1>
    <p>Planifiez vos tournées, suivez chaque professionnel de santé, rédigez vos comptes rendus de visite et pilotez vos campagnes — de Dakar à Kédougou.</p>
    <p style="margin-top:18px">
      <button class="primary" data-action="go-inscription" style="padding:11px 26px;font-size:15px">Créer un compte gratuit</button>
      <button class="primary" data-action="go-login" style="padding:11px 26px;font-size:15px">Se connecter</button>
      <button class="primary" data-action="go-tarifs" style="padding:11px 26px;font-size:15px">Voir les tarifs</button>
    </p>
  </div>
  <div class="features">
    <div class="feature" data-action="rubrique" data-h="referentiel"><div class="ico">🗺️</div><h3>Référentiel national</h3><p>14 régions médicales, 79 districts sanitaires, structures et professionnels de santé ciblés.</p></div>
    <div class="feature" data-action="rubrique" data-h="crv"><div class="ico">📋</div><h3>Comptes rendus de visite</h3><p>CRV brouillon → soumis → validé, pièces jointes et PDF signé généré en une seconde.</p></div>
    <div class="feature" data-action="rubrique" data-h="tournees"><div class="ico">🧭</div><h3>Tournées terrain</h3><p>Checklist des professionnels par district pour ne rater aucune visite.</p></div>
    <div class="feature" data-action="rubrique" data-h="campagnes"><div class="ico">📈</div><h3>Campagnes & couverture</h3><p>Objectifs validés, taux de couverture par produit, pilotage par laboratoire.</p></div>
  </div>
  <div class="stats" style="max-width:860px;margin:26px auto 6px">
    <div class="stat"><div class="n">14</div><div class="l">régions médicales</div></div>
    <div class="stat"><div class="n">79</div><div class="l">districts sanitaires</div></div>
    <div class="stat"><div class="n">3 915</div><div class="l">structures de santé</div></div>
    <div class="stat"><div class="n">34 388</div><div class="l">professionnels recensés</div></div>
    <div class="stat"><div class="n">18,6 M</div><div class="l">habitants couverts</div></div>
  </div>
  <p class="hint" style="text-align:center;margin:-2px 0 0">Référentiel officiel MSAS / ANSD — la maille exacte pour répartir votre force de vente. <a href="/carte-sanitaire">Explorer la carte sanitaire →</a></p>
  <div class="lab-band">
    <h2>Le CRM pensé pour les laboratoires pharmaceutiques</h2>
    <p class="hint">Pilotez vos délégués médicaux, vos objectifs produits et votre couverture territoriale — et développez le chiffre d'affaires de vos campagnes.</p>
    <div class="features" style="margin-top:16px">
      <div class="feature" data-action="rubrique" data-h="objectifs"><div class="ico">🎯</div><h3>Objectifs produits</h3><p>Objectifs par produit phare et par zone, taux de réalisation, campagnes mesurées sur le chiffre d'affaires.</p></div>
      <div class="feature" data-action="rubrique" data-h="referentiel"><div class="ico">🗺️</div><h3>Couverture sans doublon</h3><p>Force de vente répartie sur le référentiel officiel : chaque district a sa checklist, chaque zone est mesurée.</p></div>
      <div class="feature" data-action="rubrique" data-h="crv"><div class="ico">📊</div><h3>Terrain en temps réel</h3><p>CRV validés depuis le terrain, couverture par district, exports CSV/PDF — fini les CRV papier et les tableurs.</p></div>
    </div>
    <p style="text-align:center;margin-top:18px">
      <button class="primary" data-action="go-inscription" style="padding:11px 26px;font-size:15px">Équiper mon laboratoire</button>
      <button class="primary" data-action="go-laboratoires" style="padding:11px 26px;font-size:15px">Voir les laboratoires référencés</button>
    </p>
  </div>
  <footer style="max-width:860px;margin:34px auto 8px;text-align:center;font-size:13px;color:var(--mut)">
    <a href="/carte-sanitaire">Carte sanitaire</a> · <a href="/laboratoires">Laboratoires</a> · <a href="/tarifs">Tarifs</a> · <a href="/a-propos">À propos</a> · <a href="/login">Connexion</a> · <a href="/inscription">Compte gratuit</a>
  </footer>`;
}
function loginView() {
  return `
  <div class="card login-card">
    <h2>Connexion</h2>
    <form data-form="login">
      <div><label>Identifiant</label><input name="email" autocomplete="username" placeholder="dm.senegal" required></div>
      <div><label>Mot de passe</label><input name="password" type="password" autocomplete="current-password" required></div>
      <button class="primary" type="submit">Se connecter</button>
      <div class="error" data-slot="error"></div>
    </form>
    <p class="hint">Comptes démo : <code>dm.senegal</code> / <code>manager.senegal</code> / <code>labo.pharma</code> — mot de passe dans la documentation.</p>
    <p class="hint">Pas encore de compte ? <a href="#/inscription">Devenir délégué</a> · <a href="#/tarifs">Tarifs</a> · <a href="#/landing">← Retour</a></p>
  </div>`;
}

/* ---------- Dashboard ---------- */
async function dashboardView() {
  renderMain('<div class="muted">Chargement…</div>');
  try {
    const d = await api('/dashboard');
    if (d.role === 'delegue') return delegueDash(d);
    if (d.role === 'manager') return managerDash(d);
    if (d.role === 'laboratoire') return laboDash(d);
    return adminDash(d);
  } catch (e) { return errBox(e); }
}
function delegueDash(d) {
  const s = d.stats || {};
  const rows = d.recentes.map((v) => `<tr><td>${fmtDate(v.date)}</td><td>${esc(v.professionnel)}</td><td>${badgeRes(v.resultat)}</td><td>${badgeStatut(v.statut)}</td><td><a class="small" href="/api/visites/${v.id}/pdf" target="_blank">PDF</a></td></tr>`).join('');
  return `
  <div class="stats">
    <div class="stat"><div class="n">${s.brouillon || 0}</div><div class="l">Brouillons</div></div>
    <div class="stat amber"><div class="n">${s.soumis || 0}</div><div class="l">Soumises</div></div>
    <div class="stat green"><div class="n">${s.valide || 0}</div><div class="l">Validées</div></div>
    <div class="stat red"><div class="n">${s.refuse || 0}</div><div class="l">Refusées</div></div>
    <div class="stat"><div class="n">${d.semaine}</div><div class="l">Visites (7 j)</div></div>
  </div>
  <div class="card" style="margin-bottom:16px">
    <h3 class="section-title">Prochaines visites</h3>
    ${d.prochaines.length ? d.prochaines.map((v) => `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f1f5f9"><span><b>${fmtDate(v.prochaine_visite)}</b> — ${esc(v.professionnel)} <span class="muted">(${esc(v.district)})</span></span> ${badgeStatut(v.statut)}</div>`).join('') : '<div class="muted">Aucune visite planifiée.</div>'}
  </div>
  <div class="card" style="margin-bottom:16px">
    <h3 class="section-title">Tournées planifiées</h3>
    ${d.tournees.length ? d.tournees.map((t) => `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f1f5f9"><span><b>${fmtDate(t.date)}</b> — ${esc(t.district)}</span> ${badgeStatut(t.statut)}</div>`).join('') : '<div class="muted">Aucune tournée planifiée.</div>'}
  </div>
  <div class="card">
    <h3 class="section-title">Dernières visites</h3>
    ${rows ? `<table><thead><tr><th>Date</th><th>Professionnel</th><th>Résultat</th><th>Statut</th><th></th></tr></thead><tbody>${rows}</tbody></table>` : '<div class="muted">Aucune visite.</div>'}
  </div>`;
}
function managerDash(d) {
  const file = d.fileAttente.map((v) => `<tr><td>${fmtDate(v.date)}</td><td>${esc(v.professionnel)}</td><td>${esc(v.district)}</td><td>${esc(v.auteur)}</td><td><button class="small" data-action="crv-open" data-id="${v.id}">Ouvrir</button></td></tr>`).join('');
  const equipe = d.equipe.map((e) => `<tr><td>${esc(e.nom)}</td><td>${e.soumises}</td><td>${e.validees}</td><td>${e.refusees}</td></tr>`).join('');
  const regions = d.parRegion.map((r) => `<tr><td>${esc(r.region || '—')}</td><td>${r.n}</td></tr>`).join('');
  return `
  <div class="stats">
    <div class="stat amber"><div class="n">${d.aValider}</div><div class="l">À valider</div></div>
    <div class="stat"><div class="n">${d.tournees.planifiees}</div><div class="l">Tournées planifiées</div></div>
    <div class="stat green"><div class="n">${d.tournees.faites}</div><div class="l">Tournées faites</div></div>
  </div>
  <div class="card" style="margin-bottom:16px">
    <h3 class="section-title">File d'attente — validations</h3>
    ${file ? `<table><thead><tr><th>Date</th><th>Professionnel</th><th>District</th><th>Auteur</th><th></th></tr></thead><tbody>${file}</tbody></table>` : '<div class="muted">Rien à valider.</div>'}
  </div>
  <div class="card" style="margin-bottom:16px">
    <h3 class="section-title">Activité par délégué</h3>
    <table><thead><tr><th>Délégué</th><th>Soumises</th><th>Validées</th><th>Refusées</th></tr></thead><tbody>${equipe || '<tr><td colspan="4" class="muted">Aucun délégué.</td></tr>'}</tbody></table>
  </div>
  <div class="card">
    <h3 class="section-title">Visites par région</h3>
    <table><thead><tr><th>Région</th><th>Visites</th></tr></thead><tbody>${regions || '<tr><td class="muted">Aucune donnée</td><td></td></tr>'}</tbody></table>
  </div>`;
}
function laboDash(d) {
  const camp = d.campagnes.map((c) => `
    <div style="padding:10px 0;border-bottom:1px solid #f1f5f9">
      <div style="display:flex;justify-content:space-between"><b>${esc(c.nom)}</b><span class="muted">${c.validees}/${c.objectif} validées · ${c.taux}%</span></div>
      <div class="bar"><div style="width:${Math.min(100, c.taux)}%"></div></div>
    </div>`).join('');
  const regions = d.parRegion.map((r) => `<tr><td>${esc(r.region || '—')}</td><td>${r.n}</td></tr>`).join('');
  return `
  <div class="stats">
    <div class="stat green"><div class="n">${d.global.validees}</div><div class="l">CRV validés</div></div>
    <div class="stat amber"><div class="n">${d.global.soumises}</div><div class="l">En attente</div></div>
    <div class="stat red"><div class="n">${d.global.refusees}</div><div class="l">Refusés</div></div>
    <div class="stat"><div class="n">${d.global.ps}</div><div class="l">Professionnels</div></div>
    <div class="stat"><div class="n">${d.global.delegues}</div><div class="l">Délégués</div></div>
  </div>
  <div class="card" style="margin-bottom:16px"><h3 class="section-title">Couverture campagnes</h3>${camp || '<div class="muted">Aucune campagne.</div>'}</div>
  <div class="card"><h3 class="section-title">Visites par région</h3><table><thead><tr><th>Région</th><th>Visites</th></tr></thead><tbody>${regions || '<tr><td class="muted">Aucune donnée</td><td></td></tr>'}</tbody></table></div>`;
}
function adminDash(d) {
  return `
  <div class="stats">
    <div class="stat"><div class="n">${esc(d.tenant.nom)}</div><div class="l">Laboratoire</div></div>
    <div class="stat"><div class="n">${d.ps}</div><div class="l">Professionnels</div></div>
    <div class="stat"><div class="n">${d.structures}</div><div class="l">Structures</div></div>
  </div>
  <div class="card"><h3 class="section-title">Comptes</h3>
    <table><thead><tr><th>Rôle</th><th>Nombre</th></tr></thead><tbody>${d.users.map((u) => `<tr><td>${esc(u.role)}</td><td>${u.n}</td></tr>`).join('')}</tbody></table>
  </div>`;
}

/* ---------- Référentiel ---------- */
async function referentielView() {
  renderMain('<div class="muted">Chargement…</div>');
  try {
    const [regions, cat, structures] = await Promise.all([api('/regions'), catalog(), api('/structures')]);
    state.catalog = cat;
    return `
    <div class="filters">
      <div class="field"><label>Région</label><select id="f-region">${regionOpts(regions, psFilters.region_id)}</select></div>
      <div class="field"><label>District</label><select id="f-district"><option value="">Tous</option></select></div>
      <div class="field"><label>Spécialité</label><select id="f-spec"><option value="">Toutes</option>${cat.specialites.map((s) => `<option value="${s.id}" ${psFilters.specialite_id == s.id ? 'selected' : ''}>${esc(s.nom)}</option>`).join('')}</select></div>
      <div class="field"><label>Potentiel</label><select id="f-pot"><option value="">Tous</option>${['A', 'B', 'C'].map((p) => `<option value="${p}" ${psFilters.potentiel === p ? 'selected' : ''}>${p}</option>`).join('')}</select></div>
      <div class="field"><label>Recherche</label><input id="f-q" placeholder="Nom du praticien" value="${esc(psFilters.q)}"></div>
      <button data-action="ps-apply">Filtrer</button>
      <button class="ghost" data-action="ps-reset">Tous</button>
      <button class="primary" data-action="ps-new-open" ${can(['delegue', 'manager', 'admin']) ? '' : 'disabled'}>+ Professionnel</button>
    </div>
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <h3 class="section-title">Professionnels de santé</h3><span class="muted" data-slot="count"></span>
      </div>
      <div data-slot="pslist"></div>
    </div>
    <div class="divider"></div>
    <div class="card">
      <h3 class="section-title">Structures (${structures.length})</h3>
      <table><thead><tr><th>Structure</th><th>Type</th><th>Région — District</th><th>Localité</th></tr></thead>
      <tbody>${structures.map((s) => `<tr><td><b>${esc(s.localite)}</b></td><td>${esc(s.type)}</td><td>${esc(s.region)} — ${esc(s.district)}</td><td>${esc(s.localite)}</td></tr>`).join('')}</tbody></table>
    </div>`;
  } catch (e) { return errBox(e); }
}
function regionOpts(regions, sel) {
  return `<option value="">Toutes</option>` + regions.map((r) => `<option value="${r.id}" ${String(sel) === String(r.id) ? 'selected' : ''}>${esc(r.nom)} (${r.districts})</option>`).join('');
}
async function applyPsFilters() {
  const params = new URLSearchParams();
  if (psFilters.region_id) params.set('region_id', psFilters.region_id);
  if (psFilters.district_id) params.set('district_id', psFilters.district_id);
  if (psFilters.specialite_id) params.set('specialite_id', psFilters.specialite_id);
  if (psFilters.potentiel) params.set('potentiel', psFilters.potentiel);
  if (psFilters.q) params.set('q', psFilters.q);
  const list = $('#view [data-slot="pslist"]');
  list.innerHTML = '<div class="muted">Chargement…</div>';
  const ps = await api('/professionnels?' + params);
  $('#view [data-slot="count"]').textContent = `${ps.length} résultat${ps.length > 1 ? 's' : ''}`;
  list.innerHTML = ps.length ? `
    <table><thead><tr><th>Professionnel</th><th>Spécialité</th><th>Pot.</th><th>Structure</th><th>Zone</th><th></th></tr></thead>
    <tbody>${ps.map((p) => `<tr>
      <td><b>${esc(p.nom)}</b></td><td>${esc(p.specialite)}</td><td>${badgePot(p.potentiel)}</td>
      <td>${esc(p.structure)}</td><td class="muted">${esc(p.region)} — ${esc(p.district)}</td>
      <td style="white-space:nowrap"><button class="small" data-action="ps-detail" data-id="${p.id}">Fiche</button>
      ${can(['delegue', 'manager', 'admin']) ? `<button class="small primary" data-action="crv-new-ps" data-id="${p.id}" data-nom="${esc(p.nom)}">CRV</button>` : ''}</td>
    </tr>`).join('')}</tbody></table>`
    : '<div class="empty">Aucun professionnel dans cette zone. Ajustez les filtres.</div>';
}

/* ---------- CRV ---------- */
async function crvListView() {
  renderMain('<div class="muted">Chargement…</div>');
  try {
    const [regions, rows] = await Promise.all([api('/regions'), listVisites()]);
    return `
    <div class="filters">
      <div class="field"><label>Statut</label><select id="c-statut"><option value="">Tous</option>${['brouillon', 'soumis', 'valide', 'refuse'].map((s) => `<option value="${s}" ${crvFilters.statut === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
      <div class="field"><label>Région</label><select id="c-region">${regionOpts(regions, crvFilters.region_id)}</select></div>
      <div class="field"><label>District</label><select id="c-district"><option value="">Tous</option></select></div>
      <button data-action="crv-apply">Filtrer</button>
      <button class="ghost" data-action="crv-export">Exporter CSV</button>
      ${can(['delegue', 'manager', 'admin']) ? `<button class="primary" data-action="crv-new">+ Nouveau CRV</button>` : ''}
    </div>
    <div class="card" data-slot="crvlist"></div>`;
  } catch (e) { return errBox(e); }
}
async function listVisites() {
  const p = new URLSearchParams();
  if (crvFilters.statut) p.set('statut', crvFilters.statut);
  if (crvFilters.region_id) p.set('region_id', crvFilters.region_id);
  if (crvFilters.district_id) p.set('district_id', crvFilters.district_id);
  return api('/visites?' + p);
}
async function refreshCrvList() {
  const list = $('#view [data-slot="crvlist"]');
  list.innerHTML = '<div class="muted">Chargement…</div>';
  const rows = await listVisites();
  if (!rows.length) { list.innerHTML = '<div class="empty">Aucun compte rendu.</div>'; return; }
  list.innerHTML = `
    <table><thead><tr><th>Date</th><th>Professionnel</th><th>District</th><th>Résultat</th><th>Statut</th><th>PDF</th><th></th></tr></thead>
    <tbody>${rows.map((v) => `<tr>
      <td>${fmtDate(v.date)}</td><td><b>${esc(v.professionnel)}</b></td><td class="muted">${esc(v.district)}</td>
      <td>${badgeRes(v.resultat)}</td><td>${badgeStatut(v.statut)}</td>
      <td><a class="small" href="/api/visites/${v.id}/pdf" target="_blank">PDF</a></td>
      <td>${crvActions(v)}</td>
    </tr>`).join('')}</tbody></table>`;
}
function crvActions(v) {
  const out = [];
  if (can(['delegue']) && v.statut === 'brouillon' && v.auteur === state.user.nom) out.push(`<button class="small" data-action="crv-submit" data-id="${v.id}">Soumettre</button>`);
  if (can(['manager', 'admin', 'laboratoire']) && v.statut === 'soumis') {
    out.push(`<button class="small primary" data-action="crv-validate" data-id="${v.id}">Valider</button>`);
    out.push(`<button class="small danger" data-action="crv-refuse" data-id="${v.id}">Refuser</button>`);
  }
  return out.join(' ');
}
async function crvNewView(psId, psNom) {
  renderMain('<div class="muted">Chargement…</div>');
  try {
    const [cat, ps] = await Promise.all([catalog(), api('/professionnels' + (psId ? `?` + new URLSearchParams({ q: '' }) : ''))]);
    state.catalog = cat;
    draft = { produits: [], docs: [], professionnel_id: psId ? Number(psId) : '', nom: psNom || '' };
    const psOpts = ps.map((p) => `<option value="${p.id}" ${draft.professionnel_id === p.id ? 'selected' : ''}>${esc(p.nom)} — ${esc(p.district)}</option>`).join('');
    return `
    <div class="card" style="max-width:760px">
      <h3 class="section-title">Nouveau compte rendu de visite</h3>
      <form data-form="crv-new">
        <div><label>Professionnel de santé</label><select name="ps" required>${psOpts || '<option value="">Aucun PS — créez-en un dans le Référentiel</option>'}</select></div>
        <div class="form-row">
          <div><label>Date</label><input name="date" type="date" value="${today()}" required></div>
          <div><label>Résultat</label><select name="resultat"><option value="">—</option><option>accord</option><option>reserve</option><option>refus</option><option>absent</option></select></div>
        </div>
        <div><label>Produits présentés</label>
          <div class="products-adder">
            <select id="p-select">${cat.produits.map((pr) => `<option value="${pr.id}">${esc(pr.nom)} — ${esc(pr.dci)}</option>`).join('')}</select>
            <input id="p-qty" type="number" min="1" value="1" style="width:80px">
            <button type="button" data-action="crv-add-produit">Ajouter</button>
          </div>
          <div data-slot="produits" class="docs" style="margin-top:8px"></div>
        </div>
        <div><label>Compte rendu</label><textarea name="compte_rendu" rows="4" placeholder="Accord de prescription, objections, information diffusée…"></textarea></div>
        <div class="form-row">
          <div><label>Prochaine visite</label><input name="prochaine_visite" type="date"></div>
          <div><label>Géolocalisation (optionnel)</label><input name="geo" placeholder="lat,lng"></div>
        </div>
        <div><label>Pièces jointes (ordonnance, bon de commande…)</label>
          <input type="file" multiple data-slot="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx">
          <div data-slot="docs" class="docs" style="margin-top:8px"></div>
        </div>
        <div class="actions"><button type="submit" class="primary">Enregistrer le brouillon</button></div>
        <div class="error" data-slot="error"></div>
      </form>
    </div>`;
  } catch (e) { return errBox(e); }
}
function renderDraftSlots() {
  const pr = $('#view [data-slot="produits"]');
  if (pr) pr.innerHTML = draft.produits.map((p, i) => `<span class="chip">${esc(p.nom)} × ${p.qty} <button type="button" class="ghost small" data-action="crv-remove-produit" data-i="${i}">✕</button></span>`).join('');
  const dc = $('#view [data-slot="docs"]');
  if (dc) dc.innerHTML = draft.docs.map((d, i) => `<span class="chip">${esc(d.nom)} <button type="button" class="ghost small" data-action="crv-remove-doc" data-i="${i}">✕</button></span>`).join('');
}

/* ---------- Tournées ---------- */
async function tourneesView() {
  renderMain('<div class="muted">Chargement…</div>');
  try {
    const [regions, rows] = await Promise.all([api('/regions'), api('/tournees')]);
    return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
      <h3 class="section-title">Tournées</h3>
      ${can(['delegue', 'manager', 'admin']) ? `<button class="primary" data-action="tournee-new-open">+ Planifier une tournée</button>` : ''}
    </div>
    <div class="card">
    ${rows.length ? `<table><thead><tr><th>Date</th><th>District</th><th>Statut</th><th>Auteur</th><th></th></tr></thead><tbody>${rows.map((t) => `<tr>
      <td>${fmtDate(t.date)}</td><td><b>${esc(t.district)}</b> <span class="muted">(${esc(t.region)})</span></td>
      <td>${badgeStatut(t.statut)}</td><td>${esc(t.auteur)}</td>
      <td>${t.statut === 'planifiee' ? `<button class="small primary" data-action="tournee-faire" data-id="${t.id}">Faire</button> <button class="small" data-action="tournee-annuler" data-id="${t.id}">Annuler</button>` : ''}</td>
    </tr>`).join('')}</tbody></table>` : '<div class="empty">Aucune tournée.</div>'}
    </div>`;
  } catch (e) { return errBox(e); }
}

/* ---------- Campagnes ---------- */
async function campagnesView() {
  renderMain('<div class="muted">Chargement…</div>');
  try {
    const [rows] = await Promise.all([api('/campagnes')]);
    return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
      <h3 class="section-title">Campagnes</h3>
      ${can(['manager', 'admin', 'laboratoire']) ? `<button class="primary" data-action="campagne-new-open">+ Nouvelle campagne</button>` : ''}
    </div>
    <div class="card">
    ${rows.length ? rows.map((c) => `
      <div style="padding:12px 0;border-bottom:1px solid #f1f5f9">
        <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px">
          <div><b>${esc(c.nom)}</b> <span class="muted">· ${esc(c.produit)}</span><br>
          <span class="muted">ARP ${esc(c.agrement_arp)} · ${fmtDate(c.debut)} → ${fmtDate(c.fin)} · ${esc(c.region || 'Tout pays')}${c.district ? ' — ' + esc(c.district) : ''}</span></div>
          <div style="text-align:right"><span class="badge ${c.statut === 'active' ? 'valide' : 'brouillon'}">${c.statut}</span>
          <div style="font-size:13px;color:var(--mut)">${c.validees}/${c.objectif} validées · ${c.taux}%</div>
          <div class="bar" style="width:180px"><div style="width:${Math.min(100, c.taux)}%"></div></div></div>
        </div>
      </div>`).join('') : '<div class="empty">Aucune campagne.</div>'}
    </div>`;
  } catch (e) { return errBox(e); }
}

/* ---------- Monétisation & modules SaaS (spec §2/§3/§4) ---------- */
function publicPage(title, body) {
  return `
  <div style="max-width:920px;margin:0 auto;padding:28px 16px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
      <div class="brand">DelegPharma</div>
      <div><a href="#/landing">Accueil</a> · <a href="#/laboratoires">Laboratoires</a> · <a href="#/tarifs">Tarifs</a> · <a href="/a-propos">À propos</a> · <a href="#/login">Connexion</a></div>
    </div>
    <h1 style="font-size:26px;margin-bottom:20px">${title}</h1>
    <div id="public">${body}</div>
  </div>`;
}
async function loadLaboratoires() {
  const slot = $('#public [data-slot="body"]');
  try {
    const laboratoires = await api('/laboratoires');
    state.laboratoires = laboratoires;
    slot.innerHTML = `
    <p class="hint" style="margin-bottom:16px">Annuaire des laboratoires pharmaceutiques présents au Sénégal. La liste est enrichie régulièrement.</p>
    <ul style="line-height:1.8;column-count:2;column-gap:32px">${laboratoires.map((l) => `<li style="margin:8px 0"><b>${esc(l.nom)}</b>${l.ville ? ` — ${esc(l.ville)}` : ''}</li>`).join('') || '<li class="muted">Aucun laboratoire référencé.</li>'}</ul>`;
  } catch (e) { slot.innerHTML = `<div class="error">${esc(e.message)}</div>`; }
}
async function loadTarifs() {
  const slot = $('#public [data-slot="body"]');
  try {
    const tarifs = await api('/tarifs');
    state.tarifs = tarifs;
    slot.innerHTML = `
    <div class="cards">
      ${tarifs.map((t) => `
      <div class="card formule">
        <h3>${esc(t.nom)}</h3>
        <div class="prix">${Number(t.prix).toLocaleString('fr-FR')} <small>FCFA / mois</small></div>
        <ul style="margin:12px 0 16px;padding-left:18px;line-height:1.7">${(t.fonctionnalites || []).map((f) => `<li>${esc(f)}</li>`).join('')}</ul>
        <button class="primary" data-action="go-inscription" data-formule="${t.id}">S'abonner</button>
      </div>`).join('')}
    </div>
    <p class="hint">Abonnement mensuel (30 jours), renouvelable à tout moment. Paiement Mobile Money (Wave, Orange Money…).</p>`;
  } catch (e) { slot.innerHTML = `<div class="error">${esc(e.message)}</div>`; }
}
async function loadInscription() {
  const slot = $('#public [data-slot="body"]');
  try {
    const [tarifs, laboratoires] = await Promise.all([api('/tarifs'), api('/laboratoires')]);
    state.tarifs = tarifs; state.laboratoires = laboratoires;
    slot.innerHTML = `
    <div class="card" style="max-width:600px">
      <form data-form="inscription">
        <div><label>Nom complet</label><input name="nom" required></div>
        <div class="form-row">
          <div><label>Email</label><input name="email" type="email" required></div>
          <div><label>Téléphone (Mobile Money)</label><input name="telephone" placeholder="77 000 00 00"></div>
        </div>
        <div class="form-row">
          <div><label>Laboratoire</label><select name="laboratoire_id" required>${laboratoires.map((l) => `<option value="${l.id}">${esc(l.nom)}</option>`).join('')}</select></div>
          <div><label>Formule</label><select name="formule_id"><option value="">Compte gratuit — lecture seule</option>${tarifs.map((t) => `<option value="${t.id}" ${String(state.selFormule) === String(t.id) ? 'selected' : ''}>${esc(t.nom)} — ${Number(t.prix).toLocaleString('fr-FR')} FCFA</option>`).join('')}</select></div>
        </div>
        <div><label>Mot de passe</label><input name="password" type="password" minlength="8" required></div>
        <button class="primary" type="submit">Créer mon compte</button>
        <p class="hint" style="margin-top:10px">Sans formule : découverte du CRM en lecture seule. Avec formule : abonnement réglé par Mobile Money (Wave, Orange Money).</p>
        <div class="error" data-slot="error"></div>
      </form>
    </div>
    <p class="hint">En créant un compte, vous acceptez un abonnement mensuel de la formule choisie.</p>`;
  } catch (e) { slot.innerHTML = `<div class="error">${esc(e.message)}</div>`; }
}
async function refreshMe() {
  try {
    const me = await api('/auth/me');
    state.user = me.user; state.labo = me.laboratoire; state.abonnement = me.abonnement || null;
  } catch { /* session expirée */ }
}
function aboBanner() {
  const a = state.abonnement || {};
  const s = a.statut;
  if (s === 'actif') return `<div class="abo-banner ok">Abonnement ${esc(a.formule_nom || '')} actif — ${a.jours_restants} j restants</div>`;
  if (s === 'arrive_expiration') return `<div class="abo-banner warn">Abonnement ${esc(a.formule_nom || '')} expire dans ${a.jours_restants} j — renouvelez pour éviter le blocage.</div>`;
  if (s === 'expire') return `<div class="abo-banner bad">Abonnement expiré — accès en lecture seule. <a href="#/abonnement">Renouveler</a></div>`;
  if (s === 'aucun') return `<div class="abo-banner bad">Compte gratuit — lecture seule. <a href="#/abonnement">Souscrivez pour activer l'écriture</a>.</div>`;
  return '';
}
/* Le shell rend le banner avec state.abonnement tel qu'au moment du rendu ; au login/
   auto-login il peut être null avant le refreshMe de showView → on re-rend le slot seul. */
function refreshAboBanner() {
  const slot = $('#abo-banner-slot');
  if (slot) slot.innerHTML = aboBanner();
}
async function aboInitier(formuleId) {
  try {
    const r = await api('/abonnements/initier', { method: 'POST', body: JSON.stringify({ formule_id: Number(formuleId) }) });
    if (r.payment?.redirect_url) { window.location.href = r.payment.redirect_url; return; }
    toast('Souscription en attente de paiement' + (r.pay_mode === 'demo' ? ' (validation admin requise)' : ''));
    await refreshMe();
    return showView();
  } catch (e) { toast(e.message); }
}
async function aboPayer(aboId) {
  try {
    const r = await api('/abonnements/payer', { method: 'POST', body: JSON.stringify({ abonnement_id: Number(aboId) }) });
    if (r.payment?.redirect_url) { window.location.href = r.payment.redirect_url; return; }
    toast('Relance de paiement' + (r.pay_mode === 'demo' ? ' (validation admin requise)' : ''));
    return showView();
  } catch (e) { toast(e.message); }
}
async function abonnementView() {
  renderMain('<div class="muted">Chargement…</div>');
  try {
    const d = await api('/abonnements/mon');
    const a = d.abonnement || {};
    if (state.user.role !== 'delegue') {
      return `<div class="card"><h3 class="section-title">Abonnement</h3><p class="muted">Les abonnements concernent les délégués médicaux. Votre compte (${esc(state.user.role)}) n'est pas concerné.</p></div>`;
    }
    const statutClass = a.statut === 'actif' ? 'green' : a.statut === 'arrive_expiration' ? 'amber' : a.statut === 'expire' ? 'red' : '';
    let html = `
    <div class="stats">
      <div class="stat ${statutClass}"><div class="n">${esc(a.statut)}</div><div class="l">Statut</div></div>
      ${a.date_expiration ? `<div class="stat"><div class="n">${a.jours_restants ?? '—'}</div><div class="l">Jours restants</div></div>` : ''}
      <div class="stat"><div class="n">${esc(a.formule_nom || '—')}</div><div class="l">Formule</div></div>
    </div>`;
    if (d.en_attente) {
      html += `
      <div class="card" style="margin:16px 0">
        <h3 class="section-title">Paiement en attente — ${esc(d.en_attente.formule_nom)} (${Number(d.en_attente.montant).toLocaleString('fr-FR')} FCFA)</h3>
        <p class="muted">Référence : <code>${esc(d.en_attente.ref_transaction)}</code></p>
        <button class="primary" data-action="abo-payer" data-id="${d.en_attente.id}">Relancer / payer</button>
      </div>`;
    }
    if (!state.tarifs) state.tarifs = await api('/tarifs');
    html += `<div class="card" style="margin:16px 0"><h3 class="section-title">Formules</h3>
      <div class="cards">${state.tarifs.map((t) => `
        <div class="card formule">
          <h3>${esc(t.nom)}</h3>
          <div class="prix">${Number(t.prix).toLocaleString('fr-FR')} <small>FCFA / mois</small></div>
          <div class="muted small" style="margin:6px 0">${(t.fonctionnalites || []).length} fonctionnalités</div>
          <button class="primary small" data-action="abo-initier" data-id="${t.id}">Souscrire / renouveler</button>
        </div>`).join('')}</div>
    </div>`;
    html += `<div class="card"><h3 class="section-title">Historique des paiements</h3>
      ${d.historique.length ? `<table><thead><tr><th>Date</th><th>Formule</th><th>Montant</th><th>Statut</th><th>Référence</th></tr></thead><tbody>${d.historique.map((t) => `<tr><td>${fmtDate(t.created_at)}</td><td>${esc(t.formule_nom || '—')}</td><td>${Number(t.montant).toLocaleString('fr-FR')} FCFA</td><td>${badgeStatut(t.statut)}</td><td class="muted"><code>${esc(t.reference)}</code></td></tr>`).join('')}</tbody></table>` : '<div class="muted">Aucun paiement enregistré.</div>'}</div>`;
    return html;
  } catch (e) { return errBox(e); }
}
async function objectifsView() {
  renderMain('<div class="muted">Chargement…</div>');
  try {
    const [objectifs, cat, regions] = await Promise.all([api('/objectifs'), catalog(), api('/regions')]);
    state.catalog = cat;
    const rows = objectifs.map((o) => {
      const pct = o.objectif ? Math.round(100 * o.realise / o.objectif) : 0;
      return `
      <div style="padding:10px 0;border-bottom:1px solid #f1f5f9">
        <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px">
          <div><b>${esc(o.produit_nom || o.campagne_nom || 'Objectif')}</b>
            ${o.delegue_nom ? ` · ${esc(o.delegue_nom)}` : ''}
            <span class="muted">· ${esc(o.region_nom || 'Tout pays')}${o.district_nom ? ' — ' + esc(o.district_nom) : ''}</span><br>
            <span class="muted">${fmtDate(o.debut)} → ${fmtDate(o.fin)}</span></div>
          <div style="text-align:right">
            <div style="font-size:13px;color:var(--mut)">${o.realise}/${o.objectif} · ${pct}%</div>
            <div class="bar" style="width:180px"><div style="width:${Math.min(100, pct)}%"></div></div>
            ${can(['manager', 'admin']) ? `<button class="small ghost" data-action="objectif-del" data-id="${o.id}">Suppr.</button>` : ''}
          </div>
        </div>
      </div>`;
    }).join('');
    return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
      <h3 class="section-title">Objectifs — produit phare par zone</h3>
      ${can(['manager', 'admin', 'laboratoire']) ? `<button class="primary" data-action="objectif-new-open">+ Fixer un objectif</button>` : ''}
    </div>
    <div class="card">${rows || '<div class="empty">Aucun objectif fixé.</div>'}</div>`;
  } catch (e) { return errBox(e); }
}
async function objectifNewModal() {
  const [cat, regions, delegues] = await Promise.all([catalog(), api('/regions'), api('/delegues')]);
  modal('Fixer un objectif', `
    <div><label>Produit phare</label><select name="produit_id">${cat.produits.map((p) => `<option value="${p.id}">${esc(p.nom)} — ${esc(p.dci)}</option>`).join('')}</select></div>
    <div><label>Délégué (vide = zone entière)</label><select name="user_id"><option value="">Toute l'équipe</option>${delegues.map((d) => `<option value="${d.id}">${esc(d.nom)}</option>`).join('')}</select></div>
    <div class="form-row">
      <div><label>Région</label><select name="region_id" data-slot="region"><option value="">Tout le pays</option>${regions.map((r) => `<option value="${r.id}">${esc(r.nom)}</option>`).join('')}</select></div>
      <div><label>District</label><select name="district_id"><option value="">Tous</option></select></div>
    </div>
    <div class="form-row">
      <div><label>Objectif (quantité)</label><input name="objectif" type="number" min="1" required></div>
      <div><label>Début</label><input name="debut" type="date" value="${today()}"></div>
      <div><label>Fin</label><input name="fin" type="date"></div>
    </div>`, 'objectif-new');
}
async function notificationsView() {
  renderMain('<div class="muted">Chargement…</div>');
  try {
    const rows = await api('/notifications');
    return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
      <h3 class="section-title">Messagerie</h3>
      ${can(['manager', 'admin', 'laboratoire']) ? `<button class="primary" data-action="notif-send-open">+ Envoyer un message</button>` : ''}
    </div>
    <div class="card">
      ${rows.length ? rows.map((n) => `
        <div style="padding:10px 0;border-bottom:1px solid #f1f5f9;display:flex;justify-content:space-between;gap:10px" class="${n.lu ? 'muted' : ''}">
          <div><div>${esc(n.message)}</div><div class="small muted">${esc(n.from_nom || 'Laboratoire')} · ${fmtDate(n.created_at)}</div></div>
          ${!n.lu ? `<button class="small ghost" data-action="notif-lu" data-id="${n.id}">Marquer lu</button>` : ''}
        </div>`).join('') : '<div class="empty">Aucun message.</div>'}
    </div>`;
  } catch (e) { return errBox(e); }
}
async function notifSendModal() {
  const delegues = await api('/delegues');
  modal('Envoyer un message', `
    <div><label>Destinataire</label><select name="to_user_id"><option value="">Toute l'équipe (diffusion)</option>${delegues.map((d) => `<option value="${d.id}">${esc(d.nom)}</option>`).join('')}</select></div>
    <div><label>Message</label><textarea name="message" rows="3" required></textarea></div>`, 'notif-send');
}
async function plateformeView() {
  renderMain('<div class="muted">Chargement…</div>');
  try {
    const [dash, revenus] = await Promise.all([api('/plateforme/dashboard'), api('/revenus')]);
    const t = dash.totaux || {};
    return `
    <div class="stats">
      <div class="stat"><div class="n">${t.n_laboratoires ?? 0}</div><div class="l">Laboratoires</div></div>
      <div class="stat"><div class="n">${t.n_delegues ?? 0}</div><div class="l">Délégués inscrits</div></div>
      <div class="stat green"><div class="n">${t.n_abonnes ?? 0}</div><div class="l">Abonnés actifs</div></div>
      <div class="stat amber"><div class="n">${Number(t.ca_total ?? 0).toLocaleString('fr-FR')}</div><div class="l">FCFA CA cumulé</div></div>
    </div>
    <div class="card" style="margin:16px 0"><h3 class="section-title">Inscriptions par formule</h3>
      <table><thead><tr><th>Formule</th><th>Comptes</th></tr></thead><tbody>${dash.inscParFormule.map((f) => `<tr><td>${esc(f.nom)}</td><td>${f.n}</td></tr>`).join('') || '<tr><td colspan="2" class="muted">Aucune inscription</td></tr>'}</tbody></table>
    </div>
    <div class="card" style="margin:16px 0"><h3 class="section-title">Revenus par formule</h3>
      <table><thead><tr><th>Formule</th><th>Paiements</th><th>CA (FCFA)</th></tr></thead><tbody>${revenus.byFormule.map((f) => `<tr><td>${esc(f.formule)}</td><td>${f.n}</td><td>${Number(f.ca).toLocaleString('fr-FR')}</td></tr>`).join('') || '<tr><td colspan="3" class="muted">Aucun paiement</td></tr>'}</tbody></table>
    </div>
    <div class="card"><h3 class="section-title">Laboratoires</h3>
      <table><thead><tr><th>Laboratoire</th><th>Utilisateurs</th><th>Abonnés</th></tr></thead><tbody>${dash.laboratoires.map((l) => `<tr><td><b>${esc(l.nom)}</b></td><td>${l.n_users}</td><td>${l.n_abonnes}</td></tr>`).join('')}</tbody></table>
    </div>`;
  } catch (e) { return errBox(e); }
}
async function revenusView() {
  renderMain('<div class="muted">Chargement…</div>');
  try {
    const r = await api('/revenus');
    return `
    <div class="stats">
      <div class="stat green"><div class="n">${Number(r.total?.ca ?? 0).toLocaleString('fr-FR')}</div><div class="l">FCFA CA</div></div>
      <div class="stat"><div class="n">${r.total?.n ?? 0}</div><div class="l">Paiements réussis</div></div>
    </div>
    <div class="card" style="margin:16px 0"><h3 class="section-title">Revenus par formule</h3>
      <table><thead><tr><th>Formule</th><th>Paiements</th><th>CA (FCFA)</th></tr></thead><tbody>${r.byFormule.map((f) => `<tr><td>${esc(f.formule)}</td><td>${f.n}</td><td>${Number(f.ca).toLocaleString('fr-FR')}</td></tr>`).join('') || '<tr><td colspan="3" class="muted">Aucun paiement</td></tr>'}</tbody></table>
    </div>
    <div class="card"><h3 class="section-title">Évolution mensuelle</h3>
      <table><thead><tr><th>Mois</th><th>Paiements</th><th>CA (FCFA)</th></tr></thead><tbody>${r.evolution.map((m) => `<tr><td>${esc(m.mois)}</td><td>${m.n}</td><td>${Number(m.ca).toLocaleString('fr-FR')}</td></tr>`).join('') || '<tr><td colspan="3" class="muted">Aucun paiement</td></tr>'}</tbody></table>
    </div>`;
  } catch (e) { return errBox(e); }
}
async function professionnelView() {
  renderMain('<div class="muted">Chargement…</div>');
  try {
    const [visites, synthese] = await Promise.all([api('/professionnel/visites'), api('/professionnel/synthese')]);
    const s = synthese || {};
    return `
    <div class="stats">
      <div class="stat"><div class="n">${s.total ?? 0}</div><div class="l">Visites reçues</div></div>
      <div class="stat green"><div class="n">${s.validees ?? 0}</div><div class="l">Validées</div></div>
      <div class="stat"><div class="n">${fmtDate(s.derniere_visite)}</div><div class="l">Dernière visite</div></div>
    </div>
    <div class="card" style="margin:16px 0"><h3 class="section-title">Historique des visites me concernant</h3>
      ${visites.length ? `<table><thead><tr><th>Date</th><th>Délégué</th><th>Structure</th><th>Résultat</th><th>Statut</th><th>Compte rendu</th></tr></thead><tbody>${visites.map((v) => `<tr><td>${fmtDate(v.date)}</td><td>${esc(v.delegue)}</td><td class="muted">${esc(v.structure)}</td><td>${badgeRes(v.resultat)}</td><td>${badgeStatut(v.statut)}</td><td class="muted">${esc((v.compte_rendu || '').slice(0, 90))}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">Aucune visite enregistrée.</div>'}
    </div>`;
  } catch (e) { return errBox(e); }
}
function exportCsv() {
  const p = new URLSearchParams();
  if (crvFilters.statut) p.set('statut', crvFilters.statut);
  if (crvFilters.region_id) p.set('region_id', crvFilters.region_id);
  if (crvFilters.district_id) p.set('district_id', crvFilters.district_id);
  window.open('/api/export/visites.csv?' + p.toString(), '_blank');
}

/* ---------- Modaux ---------- */
function modal(title, bodyHtml, formName) {
  $('#view').insertAdjacentHTML('afterend', `<div class="modal-back" data-action="modal-close">
    <div class="modal" data-stop="1"><h3>${title}</h3><form data-form="${formName}">${bodyHtml}
      <div class="actions"><button type="button" class="ghost" data-action="modal-close">Annuler</button><button type="submit" class="primary">Enregistrer</button></div>
      <div class="error" data-slot="error"></div></form></div></div>`);
  bind();
}
function closeModal() { $('.modal-back')?.remove(); }

async function psNewModal() {
  const cat = await catalog();
  const structures = await api('/structures');
  modal('Nouveau professionnel de santé', `
    <div><label>Nom</label><input name="nom" required></div>
    <div><label>Structure</label><select name="structure_id" required>${structures.map((s) => `<option value="${s.id}">${esc(s.localite)} — ${esc(s.district)}</option>`).join('')}</select></div>
    <div class="form-row">
      <div><label>Spécialité</label><select name="specialite_id">${cat.specialites.map((s) => `<option value="${s.id}">${esc(s.nom)}</option>`).join('')}</select></div>
      <div><label>Potentiel</label><select name="potentiel"><option>A</option><option selected>B</option><option>C</option></select></div>
    </div>
    <div><label>Téléphone</label><input name="telephone" placeholder="77 000 00 00"></div>`, 'ps-new');
}
async function tourneeNewModal() {
  const regions = await api('/regions');
  modal('Planifier une tournée', `
    <div><label>Date</label><input name="date" type="date" value="${today()}" required></div>
    <div><label>Région</label><select name="region_id" data-slot="region" required>${regionOpts(regions, '')}</select></div>
    <div><label>District</label><select name="district_id" data-slot="district" required><option value="">Choisissez la région d'abord</option></select></div>
    <div data-slot="check"></div>`, 'tournee-new');
}
async function campagneNewModal() {
  const cat = await catalog();
  const regions = await api('/regions');
  modal('Nouvelle campagne', `
    <div><label>Nom</label><input name="nom" required></div>
    <div><label>Produit</label><select name="produit_id" required>${cat.produits.map((p) => `<option value="${p.id}">${esc(p.nom)} — ${esc(p.dci)}</option>`).join('')}</select></div>
    <div class="form-row">
      <div><label>N° agrément ARP</label><input name="agrement_arp" placeholder="ARP-XXXX"></div>
      <div><label>Objectif (visites validées)</label><input name="objectif" type="number" min="1" required></div>
    </div>
    <div class="form-row">
      <div><label>Début</label><input name="debut" type="date" value="${today()}"></div>
      <div><label>Fin</label><input name="fin" type="date"></div>
    </div>
    <div><label>Zone (optionnel)</label><select name="region_id"><option value="">Tout le pays</option>${regions.map((r) => `<option value="${r.id}">${esc(r.nom)}</option>`).join('')}</select></div>`, 'campagne-new');
}

/* ---------- Handlers ---------- */
function bind() {
  // Délégation sur document (view + modaux, les 3 remplacés à chaque render).
  document.onclick = async (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const act = el.dataset.action;
    try {
      if (act === 'go-login') { location.hash = '#/login'; return; }
      if (act === 'rubrique') {
        const h = el.dataset.h;
        if (!state.user) { state.pendingHash = '#/' + h; location.hash = '#/login'; return; }
        location.hash = '#/' + h;
        return;
      }
      if (act === 'logout') { await api('/auth/logout', { method: 'POST' }); state.user = null; state.hash = '#/landing'; render(); return; }
      if (act === 'modal-close') { if (!e.target.closest('[data-stop]')) closeModal(); return; }

      if (act === 'ps-apply') {
        psFilters.region_id = $('#f-region').value; psFilters.district_id = $('#f-district').value;
        psFilters.specialite_id = $('#f-spec').value; psFilters.potentiel = $('#f-pot').value; psFilters.q = $('#f-q').value.trim();
        return applyPsFilters();
      }
      if (act === 'ps-reset') { psFilters = { region_id: '', district_id: '', specialite_id: '', potentiel: '', q: '' }; location.reload(); return; }
      if (act === 'ps-detail') { openPsFiche(el.dataset.id); return; }
      if (act === 'ps-new-open') { psNewModal(); return; }
      if (act === 'crv-new-ps') { showCrvNew(el.dataset.id, el.dataset.nom); return; }

      if (act === 'crv-new') { showCrvNew(); return; }
      if (act === 'crv-apply') {
        crvFilters.statut = $('#c-statut').value; crvFilters.region_id = $('#c-region').value; crvFilters.district_id = $('#c-district').value;
        return refreshCrvList();
      }
      if (act === 'crv-add-produit') {
        const id = Number($('#p-select').value); const qty = Number($('#p-qty').value) || 1;
        const pr = state.catalog.produits.find((x) => x.id === id);
        if (draft.produits.some((x) => x.produit_id === id)) { toast('Produit déjà ajouté'); return; }
        draft.produits.push({ produit_id: id, qty, nom: pr.nom });
        return renderDraftSlots();
      }
      if (act === 'crv-remove-produit') { draft.produits.splice(el.dataset.i, 1); return renderDraftSlots(); }
      if (act === 'crv-remove-doc') { draft.docs.splice(el.dataset.i, 1); return renderDraftSlots(); }
      if (act === 'crv-submit') { await api(`/visites/${el.dataset.id}/submit`, { method: 'POST' }); toast('CRV soumis'); return refreshCrvList(); }
      if (act === 'crv-validate') { await api(`/visites/${el.dataset.id}/validate`, { method: 'POST' }); toast('CRV validé'); return refreshCrvList(); }
      if (act === 'crv-refuse') {
        const v = await api(`/visites/${el.dataset.id}`);
        modal('Refuser ce CRV', `<div><label>Motif du refus</label><textarea name="motif" rows="3" required></textarea></div><div class="muted">CRV n°${v.id} — ${esc(v.professionnel)}, ${fmtDate(v.date)}</div>`, 'crv-refuse');
        state.refuseId = el.dataset.id;
        return;
      }
      if (act === 'crv-open') { openCrvFiche(el.dataset.id); return; }

      if (act === 'tournee-new-open') { tourneeNewModal(); return; }
      if (act === 'tournee-faire') { await api(`/tournees/${el.dataset.id}/faire`, { method: 'POST' }); toast('Tournée marquée faite'); location.hash = '#/tournees'; showView(); return; }
      if (act === 'tournee-annuler') { await api(`/tournees/${el.dataset.id}/annuler`, { method: 'POST' }); toast('Tournée annulée'); location.hash = '#/tournees'; showView(); return; }

      if (act === 'campagne-new-open') { campagneNewModal(); return; }

      // ---- Monétisation & modules SaaS ----
      if (act === 'go-tarifs') { location.hash = '#/tarifs'; return; }
      if (act === 'go-laboratoires') { location.hash = '#/laboratoires'; return; }
      if (act === 'go-inscription') { state.selFormule = el.dataset.formule; location.hash = '#/inscription'; return; }
      if (act === 'abo-initier') { await aboInitier(el.dataset.id); return; }
      if (act === 'abo-payer') { await aboPayer(el.dataset.id); return; }
      if (act === 'objectif-new-open') { await objectifNewModal(); return; }
      if (act === 'objectif-del') {
        if (!confirm('Supprimer cet objectif ?')) return;
        await api(`/objectifs/${el.dataset.id}`, { method: 'DELETE' });
        toast('Objectif supprimé'); return showView();
      }
      if (act === 'notif-send-open') { await notifSendModal(); return; }
      if (act === 'notif-lu') { await api(`/notifications/${el.dataset.id}/lu`, { method: 'POST' }); return showView(); }
      if (act === 'crv-export') { exportCsv(); return; }
    } catch (err) { toast(err.message); }
  };
  document.onchange = async (e) => {
    const el = e.target;
    if (el.id === 'f-region') await loadDistricts('f-district', el.value);
    if (el.id === 'c-region') await loadDistricts('c-district', el.value);
    if (el.id === 'f-district') psFilters.district_id = el.value;
    if (el.id === 'c-district') crvFilters.district_id = el.value;
    if (el.matches('[data-slot="region"]')) {
      const form = el.closest('form');
      const sel = form.querySelector('[name="district_id"]');
      sel.innerHTML = '<option value="">Choisissez…</option>';
      if (el.value) await loadDistrictsSelect(sel, el.value);
      return;
    }
    if (el.matches('[data-slot="district"]') && el.value) {
      const form = el.closest('form');
      const box = form.querySelector('[data-slot="check"]');
      box.innerHTML = '<div class="muted">Chargement de la checklist…</div>';
      const ps = await api(`/districts/${el.value}/professionnels`);
      box.innerHTML = `<label style="margin:6px 0">Checklist — ${ps.length} professionnel(s)</label>
        <div class="check-list">${ps.length ? ps.map((p) => `<label><input type="checkbox" value="${p.id}"> ${esc(p.nom)} <span class="muted">(${esc(p.specialite)} — ${esc(p.structure)})</span></label>`).join('') : '<div class="muted">Aucun professionnel dans ce district.</div>'}</div>`;
    }
    if (el.matches('[data-slot="file"]')) {
      const files = [...el.files];
      for (const f of files) draft.docs.push(await fileToB64(f));
      renderDraftSlots();
    }
  };
  document.onsubmit = async (e) => {
    e.preventDefault();
    const form = e.target;
    const name = form.dataset.form;
    const errSlot = form.querySelector('[data-slot="error"]');
    try {
      if (name === 'login') {
        const email = form.email.value, password = form.password.value;
        const me = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
        state.user = me.user; state.labo = me.laboratoire; state.abonnement = null;
        location.hash = state.pendingHash || '#/dashboard';
        state.pendingHash = null;
        return;
      }
      if (name === 'ps-new') {
        await api('/professionnels', { method: 'POST', body: JSON.stringify(read(form)) });
        closeModal(); toast('Professionnel ajouté');
        return location.reload();
      }
      if (name === 'crv-new') {
        const body = read(form);
        await api('/visites', { method: 'POST', body: JSON.stringify({ ...body, professionnel_id: Number(body.ps), produits: draft.produits, docs: draft.docs }) });
        toast('Brouillon enregistré'); draft = { produits: [], docs: [] };
        return location.hash = '#/crv';
      }
      if (name === 'crv-refuse') {
        await api(`/visites/${state.refuseId}/refuse`, { method: 'POST', body: JSON.stringify({ motif: form.motif.value }) });
        closeModal(); toast('CRV refusé'); return refreshCrvList();
      }
      if (name === 'tournee-new') {
        const ps_list = $$('input[type=checkbox]:checked', form).map((c) => Number(c.value));
        await api('/tournees', { method: 'POST', body: JSON.stringify({ date: form.date.value, district_id: Number(form.district_id.value), ps_list }) });
        closeModal(); toast('Tournée planifiée'); return location.reload();
      }
      if (name === 'campagne-new') {
        await api('/campagnes', { method: 'POST', body: JSON.stringify(read(form)) });
        closeModal(); toast('Campagne créée'); return location.reload();
      }
      if (name === 'inscription') {
        const body = read(form);
        body.laboratoire_id = Number(body.laboratoire_id);
        if (body.formule_id !== '') body.formule_id = Number(body.formule_id); else delete body.formule_id;
        const r = await api('/auth/inscription', { method: 'POST', body: JSON.stringify(body) });
        if (r.payment?.redirect_url) { window.location.href = r.payment.redirect_url; return; }
        state.user = r.user; state.labo = r.laboratoire; state.abonnement = null;
        toast(r.compte_gratuit ? 'Compte gratuit créé — découverte en lecture seule' : 'Compte créé — ' + (r.pay_mode === 'demo' ? 'abonnement en attente de validation' : 'paiement en attente'));
        return location.hash = r.compte_gratuit ? '#/dashboard' : '#/abonnement';
      }
      if (name === 'objectif-new') {
        const body = read(form);
        body.user_id = body.user_id ? Number(body.user_id) : null;
        body.region_id = body.region_id ? Number(body.region_id) : null;
        body.district_id = body.district_id ? Number(body.district_id) : null;
        body.produit_id = Number(body.produit_id);
        await api('/objectifs', { method: 'POST', body: JSON.stringify(body) });
        closeModal(); toast('Objectif fixé'); return showView();
      }
      if (name === 'notif-send') {
        const body = read(form);
        body.to_user_id = body.to_user_id ? Number(body.to_user_id) : null;
        await api('/notifications', { method: 'POST', body: JSON.stringify(body) });
        closeModal(); toast('Message envoyé'); return showView();
      }
    } catch (err) { if (errSlot) errSlot.textContent = err.message; else toast(err.message); }
  };
}
function read(form) {
  const o = {};
  for (const el of form.elements) if (el.name) o[el.name] = el.value;
  return o;
}
async function loadDistricts(selId, regionId) {
  const sel = $(`#${selId}`);
  sel.innerHTML = '<option value="">Tous</option>';
  if (!regionId) return;
  const ds = await api(`/districts?region_id=${regionId}`);
  sel.innerHTML = '<option value="">Tous</option>' + ds.map((d) => `<option value="${d.id}">${esc(d.nom)}</option>`).join('');
}
async function loadDistrictsSelect(sel, regionId) {
  const ds = await api(`/districts?region_id=${regionId}`);
  sel.innerHTML = '<option value="">Choisissez…</option>' + ds.map((d) => `<option value="${d.id}">${esc(d.nom)}</option>`).join('');
}
function fileToB64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res({ nom: file.name, type: file.type || 'application/octet-stream', data: String(r.result).split(',')[1] });
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}
async function openPsFiche(id) {
  try {
    const p = await api(`/professionnels/${id}`);
    modal('Fiche professionnel', `
      <div style="display:grid;gap:8px">
        <div><b>${esc(p.nom)}</b> ${badgePot(p.potentiel)}</div>
        <div>${esc(p.specialite)}</div>
        <div class="muted">${esc(p.type || '')} · ${esc(p.structure)}</div>
        <div class="muted">${esc(p.region)} — ${esc(p.district)}</div>
        ${p.telephone ? `<div>☎ ${esc(p.telephone)}</div>` : ''}
      </div>`, 'fiche');
  } catch (err) { toast(err.message); }
}
async function openCrvFiche(id) {
  try {
    const v = await api(`/visites/${id}`);
    const docs = v.docs.map((d, i) => `<a class="chip" href="/api/visites/${v.id}/doc/${i}" target="_blank">📎 ${esc(d.nom)}</a>`).join('') || '<span class="muted">Aucune pièce jointe</span>';
    modal(`CRV n°${v.id} — ${fmtDate(v.date)}`, `
      <div style="display:grid;gap:8px">
        <div><b>${esc(v.professionnel)}</b> ${badgePot(v.potentiel)} <span class="muted">(${esc(v.specialite)})</span></div>
        <div class="muted">${esc(v.structure)} · ${esc(v.region)} — ${esc(v.district)}</div>
        <div>Résultat : ${badgeRes(v.resultat)} · Statut : ${badgeStatut(v.statut)}</div>
        ${v.produits.length ? `<div>Produits : ${v.produits.map((p) => `<span class="chip">${esc(p.nom)} × ${p.qty}</span>`).join(' ')}</div>` : ''}
        ${v.compte_rendu ? `<div style="background:#f8fafc;padding:10px;border-radius:8px">${esc(v.compte_rendu)}</div>` : ''}
        ${v.prochaine_visite ? `<div class="muted">Prochaine visite : ${fmtDate(v.prochaine_visite)}</div>` : ''}
        ${v.motif_refus ? `<div style="color:var(--red)">Motif de refus : ${esc(v.motif_refus)}</div>` : ''}
        <div class="docs">${docs}</div>
        <div><a class="primary" style="color:var(--teal);font-weight:600" href="/api/visites/${v.id}/pdf" target="_blank">⬇ Télécharger le PDF</a></div>
      </div>`, 'fiche');
  } catch (err) { toast(err.message); }
}
async function showCrvNew(psId, psNom) {
  renderMain(await crvNewView(psId, psNom));
  renderDraftSlots();
}

/* ---------- Rendus de la vue courante ---------- */
async function runView() {
  const h = state.hash.split('?')[0];
  try {
    if (h === '#/referentiel') { renderMain(await referentielView()); return applyPsFilters(); }
    if (h === '#/crv') { renderMain(await crvListView()); return refreshCrvList(); }
    if (h === '#/crv/new') return showCrvNew();
    if (h === '#/tournees') return renderMain(await tourneesView());
    if (h === '#/campagnes') return renderMain(await campagnesView());
    if (h === '#/objectifs') return renderMain(await objectifsView());
    if (h === '#/messagerie') return renderMain(await notificationsView());
    if (h === '#/abonnement') return renderMain(await abonnementView());
    if (h === '#/plateforme') return renderMain(await plateformeView());
    if (h === '#/revenus') return renderMain(await revenusView());
    if (h === '#/professionnel') return renderMain(await professionnelView());
    return renderMain(await dashboardView());
  } catch (e) { return errBox(e); }
}
function errBox(e) { return renderMain(`<div class="card"><div class="error">${esc(e.message)}</div></div>`); }

/* ---------- Badges ---------- */
function badgePot(p) { return `<span class="badge ${p}">${p}</span>`; }
function badgeRes(r) { return r ? `<span class="badge ${r}">${r}</span>` : '<span class="muted">—</span>'; }
function badgeStatut(s) { return `<span class="badge ${s}">${s}</span>`; }

init();
