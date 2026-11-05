// Garde-fou : sur mobile, le bandeau de l'application ne doit pas élargir la page.
// Cause d'origine (2026-11-05) : header.app gardait flex-wrap: wrap en colonne → la ligne prenait la largeur du
// menu (721 px) au lieu de celle de l'écran → le menu ne défilait jamais et toute la page débordait.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const css = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'frontend', 'app.css'), 'utf8');

function blocMedia(condition) {
  const debut = css.indexOf(`@media (${condition}) {`);
  assert.ok(debut >= 0, `bloc @media (${condition}) introuvable`);
  let prof = 0;
  for (let i = css.indexOf('{', debut); i < css.length; i++) {
    if (css[i] === '{') prof++;
    if (css[i] === '}' && --prof === 0) return css.slice(debut, i + 1);
  }
  throw new Error('bloc non fermé');
}

test('mobile (<= 768 px) : le bandeau est en colonne SANS retour à la ligne', () => {
  const m = blocMedia('max-width: 768px');
  const regle = (m.match(/header\.app \{[^}]*\}/) || [''])[0];
  assert.match(regle, /flex-direction: column/);
  assert.match(regle, /flex-wrap: nowrap/, 'flex-wrap: nowrap obligatoire : sinon la ligne prend la largeur du menu');
});

test('mobile : le menu défile horizontalement dans le bandeau', () => {
  const m = blocMedia('max-width: 768px');
  const regle = (m.match(/nav\.main \{[^}]*\}/) || [''])[0];
  assert.match(regle, /overflow-x: auto/);
  assert.match(regle, /flex-wrap: nowrap/);
});

test('la feuille de style modifiée est servie avec une nouvelle version de cache', () => {
  const shell = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'frontend', 'index.html'), 'utf8');
  assert.match(shell, /app\.css\?v=([7-9]|\d{2,})/, 'incrémenter app.css?v= à chaque changement de style');
});
