/* DelegPharma — SPA vanilla servie par Express (une seule origine, cookie httpOnly). */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const today = () => new Date().toISOString().slice(0, 10);
const fmtDate = (d) => (d ? String(d).slice(0, 10) : '—');

const state = { user: null, labo: null, catalog: null, hash: location.hash || '#/landing' };
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
  try {
    const me = await api('/auth/me');
    state.user = me.user;
    state.labo = me.laboratoire;
  } catch { /* non connecté */ }
  window.addEventListener('hashchange', () => { state.hash = location.hash || '#/landing'; route(); });
  route();
}
function route() {
  if (!state.user) {
    render(state.hash === '#/login' ? loginView() : landingView());
    return;
  }
  render(appShell());
}
function render(html) {
  $('#app').innerHTML = html;
  if ($('#view')) showView();
  else bind();
}
/* Rendu interne dans le shell (après nav). bind() est global sur document. */
function renderMain(html) { $('#view').innerHTML = html; }

/* ---------- Shell + nav ---------- */
const NAV = {
  delegue: [['dashboard', 'Tableau de bord'], ['referentiel', 'Référentiel'], ['crv', 'CRV'], ['tournees', 'Tournées']],
  manager: [['dashboard', 'Tableau de bord'], ['referentiel', 'Référentiel'], ['crv', 'CRV'], ['tournees', 'Tournées'], ['campagnes', 'Campagnes']],
  laboratoire: [['dashboard', 'Tableau de bord'], ['referentiel', 'Référentiel'], ['crv', 'CRV'], ['campagnes', 'Campagnes']],
  admin: [['dashboard', 'Tableau de bord'], ['referentiel', 'Référentiel'], ['crv', 'CRV'], ['tournees', 'Tournées'], ['campagnes', 'Campagnes']],
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
  <main id="view"></main>`;
}
async function showView() {
  const h = state.hash.split('?')[0];
  if (h === '#/dashboard') return dashboardView();
  if (h === '#/referentiel') return referentielView();
  if (h === '#/crv') return crvListView();
  if (h === '#/crv/new') return crvNewView();
  if (h === '#/tournees') return tourneesView();
  if (h === '#/campagnes') return campagnesView();
  return dashboardView();
}

/* ---------- Landing / Login ---------- */
function landingView() {
  return `
  <div class="hero">
    <h1><span>DelegPharma</span> — CRM du délégué médical</h1>
    <p>Planifiez vos tournées, suivez chaque professionnel de santé, rédigez vos comptes rendus de visite et pilotez vos campagnes — de Dakar à Kédougou.</p>
    <p style="margin-top:18px"><button class="primary" data-action="go-login" style="padding:11px 26px;font-size:15px">Se connecter</button></p>
  </div>
  <div class="features">
    <div class="feature"><div class="ico">🗺️</div><h3>Référentiel national</h3><p>14 régions médicales, 79 districts sanitaires, structures et professionnels de santé ciblés.</p></div>
    <div class="feature"><div class="ico">📋</div><h3>Comptes rendus de visite</h3><p>CRV brouillon → soumis → validé, pièces jointes et PDF signé généré en une seconde.</p></div>
    <div class="feature"><div class="ico">🧭</div><h3>Tournées terrain</h3><p>Checklist des professionnels par district pour ne rater aucune visite.</p></div>
    <div class="feature"><div class="ico">📈</div><h3>Campagnes & couverture</h3><p>Objectifs validés, taux de couverture par produit, pilotage par laboratoire.</p></div>
  </div>`;
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
    <p class="hint"><a href="#/landing">← Retour</a></p>
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
        state.user = me.user; state.labo = me.laboratoire;
        location.hash = '#/dashboard';
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
    return renderMain(await dashboardView());
  } catch (e) { return errBox(e); }
}
function errBox(e) { return renderMain(`<div class="card"><div class="error">${esc(e.message)}</div></div>`); }

/* ---------- Badges ---------- */
function badgePot(p) { return `<span class="badge ${p}">${p}</span>`; }
function badgeRes(r) { return r ? `<span class="badge ${r}">${r}</span>` : '<span class="muted">—</span>'; }
function badgeStatut(s) { return `<span class="badge ${s}">${s}</span>`; }

init();
