/**
 * Levanta un Postgres con PostGIS en Docker, aplica migraciones y semillas, y
 * corre la prueba funcional. Sirve para no descubrir un error de SQL a la mitad
 * de la madrugada, pegando en el editor de Supabase.
 *
 *   npm run db:probar
 *
 * Requiere Docker corriendo. No toca el proyecto real de Supabase.
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONTENEDOR = 'unacopio-pg-prueba';
const IMAGEN = 'postgis/postgis:16-3.4';

const ARCHIVOS = [
  'supabase/pruebas/00-stubs-supabase.sql',
  'supabase/migrations/0001_esquema.sql',
  'supabase/migrations/0002_rls_y_funciones.sql',
  'supabase/migrations/0003_municipios_latlng.sql',
  'supabase/migrations/0004_sin_tokens_solicitudes.sql',
  'supabase/migrations/0005_buscar_puntos.sql',
  'supabase/seed/0001_categorias.sql',
  'supabase/seed/0002_municipios.sql',
  // A propósito dos veces: el editor de Supabase aborta la corrida entera si algo
  // falla, así que 0002 y las semillas tienen que aguantar que uno los vuelva a
  // pegar. Si alguien mete un `create policy` suelto, revienta aquí y no allá.
  'supabase/migrations/0002_rls_y_funciones.sql',
  'supabase/migrations/0003_municipios_latlng.sql',
  'supabase/migrations/0004_sin_tokens_solicitudes.sql',
  'supabase/migrations/0005_buscar_puntos.sql',
  'supabase/seed/0001_categorias.sql',
  'supabase/seed/0002_municipios.sql',
  'supabase/pruebas/01-prueba-funcional.sql',
];

const docker = (args, opciones = {}) =>
  spawnSync('docker', args, { encoding: 'utf8', ...opciones });

const psql = (args, opciones = {}) =>
  docker(['exec', CONTENEDOR, 'psql', '-U', 'postgres', '-d', 'unacopio', ...args], opciones);

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

function limpiar() {
  docker(['rm', '-f', CONTENEDOR]);
}

if (docker(['version']).status !== 0) {
  console.error('Docker no responde. Arranca Docker Desktop y vuelve a intentar.');
  process.exit(1);
}

limpiar();
console.log(`→ levantando ${IMAGEN}`);
const arranque = docker([
  'run', '-d', '--name', CONTENEDOR,
  '-e', 'POSTGRES_PASSWORD=prueba',
  '-e', 'POSTGRES_DB=unacopio',
  '-v', `${RAIZ}:/proyecto`,
  IMAGEN,
]);
if (arranque.status !== 0) {
  console.error(arranque.stderr.trim());
  process.exit(1);
}

// Ojo con la espera: durante initdb el entrypoint levanta un Postgres temporal
// que solo escucha por socket unix. Si uno se conecta ahí, al terminar la
// inicialización mata la conexión a media migración (exit 137). Preguntar por
// TCP (-h 127.0.0.1) solo responde cuando el servidor definitivo ya está arriba.
let listo = false;
for (let i = 0; i < 60 && !listo; i++) {
  listo = docker([
    'exec', CONTENEDOR, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres', '-d', 'unacopio',
  ]).status === 0;
  if (!listo) await dormir(1000);
}
if (!listo) {
  console.error('Postgres no arrancó a tiempo.');
  console.error(docker(['logs', '--tail', '30', CONTENEDOR]).stdout);
  limpiar();
  process.exit(1);
}

let fallo = false;
for (const archivo of ARCHIVOS) {
  console.log(`\n→ ${archivo}`);
  const r = psql(['-v', 'ON_ERROR_STOP=1', '-f', `/proyecto/${archivo}`]);
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  if (r.status !== 0) { fallo = true; break; }
}

limpiar();

if (fallo) {
  console.error('\n✗ el SQL falló — no lo lleves a Supabase todavía');
  process.exit(1);
}
console.log('\n✓ migraciones, semillas y prueba funcional pasaron');
