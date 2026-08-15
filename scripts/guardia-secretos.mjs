/**
 * Se ejecuta antes de cada commit. Revisa lo que está en el índice buscando
 * llaves de verdad en archivos que sí se suben al repo.
 *
 * Existe porque ya pasó una vez: las credenciales terminaron en `.env.example`
 * en vez de en `.env.local`. Lo atajó la protección de GitHub, pero para
 * entonces la llave ya estaba en un commit local.
 */
import { spawnSync } from 'node:child_process';

const PATRONES = [
  [/\bsb_secret_[A-Za-z0-9_-]{10,}/, 'llave secreta de Supabase (sb_secret_…)'],
  [/\bsb_publishable_[A-Za-z0-9_-]{10,}/, 'llave publicable de Supabase (sb_publishable_…)'],
  [/\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\./, 'JWT (posible llave anon/service de Supabase)'],
  [/\bghp_[A-Za-z0-9]{30,}/, 'token de GitHub'],
];

// `.env.local` está en .gitignore; si aparece acá es que alguien lo forzó.
const VIGILADOS = /(^|\/)(\.env($|\..*)|.*\.example|.*\.sample)$/;

const git = (...args) => spawnSync('git', args, { encoding: 'utf8' }).stdout ?? '';

const archivos = git('diff', '--cached', '--name-only', '--diff-filter=ACM')
  .split('\n')
  .map((f) => f.trim())
  .filter(Boolean);

const hallazgos = [];

for (const archivo of archivos) {
  if (!VIGILADOS.test(archivo)) continue;
  const contenido = git('show', `:${archivo}`);
  for (const [patron, descripcion] of PATRONES) {
    if (patron.test(contenido)) hallazgos.push({ archivo, descripcion });
  }
}

if (hallazgos.length > 0) {
  console.error('\n✗ Commit detenido: hay credenciales reales en archivos que se suben al repo.\n');
  for (const { archivo, descripcion } of hallazgos) {
    console.error(`   ${archivo} → ${descripcion}`);
  }
  console.error('\n  Los valores reales van en .env.local (ignorado por git).');
  console.error('  .env.example es una plantilla: se deja con los valores vacíos.');
  console.error('\n  Si de verdad es un falso positivo: git commit --no-verify\n');
  process.exit(1);
}
