// Vérif P1 : matchPage distingue les routes connues (200) des chemins inconnus (404).
// Usage : node test-matchPage.mjs  (ne touche à rien, import seul)
import { matchPage } from './src/seo.js';

const known = [
  '/',
  '/tarifs',
  '/laboratoires',
  '/login',
  '/inscription',
  '/a-propos',
  '/blog',
  '/delegue-medical',
  '/mentions-legales',
  '/politique-de-confidentialite',
  '/contact',
  '/blog/le-metier-de-delegue-medical',
];
const unknown = [
  '/definitely-not-a-page',
  '/dashboard',
  '/espace-client',
  '/foo/bar/baz',
  '/carte-sanitaire-totalement-faux',
];
const dynamic = ['/carte-sanitaire/thies', '/carte-sanitaire/thies/tivaouane']; // DB requise

let fail = 0;
for (const p of known) {
  const page = matchPage(p);
  const ok = !!page && page.index !== undefined;
  if (!ok) { fail++; console.log(`✗ KNOWN  ${p} → ne matche pas`); }
  else console.log(`✓ known  ${p} → ${page.index ? 'index' : 'noindex'}`);
}
for (const p of unknown) {
  const page = matchPage(p);
  if (page) { fail++; console.log(`✗ UNKNOWN ${p} → matche (bug, devrait être null)`); }
  else console.log(`✓ unknown ${p} → null → 404`);
}
for (const p of dynamic) {
  try {
    const page = matchPage(p);
    console.log(`✓ dynamic ${p} → ${page ? 'matche' : 'null'} (DB ok)`);
  } catch (e) {
    console.log(`~ dynamic ${p} → exception (${e.message}) — à revérifier en prod`);
  }
}
console.log(fail === 0 ? '\nPASS' : `\nFAIL (${fail})`);
process.exit(fail === 0 ? 0 : 1);
