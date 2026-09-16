// Init Schéma idempotent — exécuté par le workflow de déploiement (runner GitHub,
// CPU illimité), jamais dans le Worker (le multi-statement DDL y dépasserait le budget).
// Le DEFAULT est schéma seul : la base reste vierge jusqu'au seed (init-base.yml →
// npm run seed, idempotent, socle complet : référentiel + formules + catalogue).
// --seed / --extras pour un environnement de test/dev.
// Usage : DATABASE_URL="$NEON" node scripts/schema-init.mjs [--seed] [--extras]
import { setDriver, close } from '../src/db.js';
import { initSchema } from '../src/schema.js';
import { seed, seedExtras } from '../src/seed.js';

const args = process.argv.slice(2);
setDriver(
  process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgres') ? 'pg' : 'sqlite',
);

initSchema()
  .then(async () => {
    if (args.includes('--seed')) await seed();
    if (args.includes('--extras')) await seedExtras();
    const note = args.includes('--seed') || args.includes('--extras') ? ' + seeds (--seed/--extras)' : ' (schéma seul)';
    console.log(`Schéma initialisé — idempotent${note}.`);
  })
  .then(() => close())
  .catch((e) => {
    console.error('schema-init a échoué :', e);
    process.exit(1);
  });
