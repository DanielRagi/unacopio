/**
 * Carga el CSV del pilotaje en la cola de moderación del proyecto real.
 *
 *   npm run sembrar            revisa y carga lo que falte
 *   npm run sembrar -- --ver   solo muestra qué haría, sin escribir
 *   npm run sembrar -- --limpiar   borra los importados que sigan pendientes
 *
 * Es una herramienta de operación, no parte de la aplicación. La puerta normal
 * para cargar una lista es `/admin/importar`, que exige sesión de moderador;
 * este script existe porque un script no tiene sesión, y sembrar el directorio
 * la primera vez es algo que se hace desde una terminal.
 *
 * Usa la llave de servicio, que SALTA RLS. A cambio, replica exactamente las
 * garantías de `importar_punto`, que son las que importan (ver D13):
 *
 *   · estado 'pendiente' — nada se publica sin que alguien llame
 *   · telefono_publico = false — copiar un número de una publicación no es la
 *     autorización que pide la Ley 1581 de 2012
 *   · entidad_oficial = false — esa banda la pone moderación, a mano
 *   · origen 'importacion' y la fuente guardada, para poder auditar después
 *
 * Es idempotente: no vuelve a insertar un punto que ya esté cargado con el
 * mismo nombre en el mismo municipio.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { parsearCsv, revisarFilas } from '../src/lib/importacion.ts';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const CSV = join(RAIZ, 'datos', 'pilotaje', 'salida', 'pilotaje.csv');

const soloVer = process.argv.includes('--ver');
const limpiar = process.argv.includes('--limpiar');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const servicio = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !servicio) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local');
  process.exit(1);
}

const db = createClient(url, servicio, { auth: { persistSession: false } });

if (limpiar) {
  const { data, error } = await db
    .from('puntos')
    .delete()
    .eq('origen', 'importacion')
    .eq('estado', 'pendiente')
    .select('id');

  if (error) { console.error(error.message); process.exit(1); }
  console.log(`Borrados ${data?.length ?? 0} puntos importados que seguían pendientes.`);
  console.log('Los que moderación ya publicó, rechazó o cerró NO se tocan.');
  process.exit(0);
}

/** PostgREST corta en 1.000 filas sin avisar, y los municipios son 1.122. */
async function todosLosMunicipios() {
  const todos = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await db
      .from('municipios')
      .select('codigo, nombre, departamento_codigo, lat, lng')
      .order('codigo')
      .range(desde, desde + 999);
    if (error) throw new Error(error.message);
    todos.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return todos;
}

const [municipios, { data: categorias }] = await Promise.all([
  todosLosMunicipios(),
  db.from('categorias').select('slug'),
]);

const { filas } = parsearCsv(readFileSync(CSV, 'utf8'));
const revisadas = revisarFilas(filas, {
  municipios,
  categorias: new Set((categorias ?? []).map((c) => c.slug)),
  // Las mismas etiquetas de `src/lib/textos.ts`. Van copiadas y no importadas
  // porque `textos.ts` arrastra tipos de React y esto lo corre node pelado.
  etiquetasDeTipo: {
    alcaldia: 'Alcaldía', gobernacion: 'Gobernación', bomberos: 'Bomberos',
    defensa_civil: 'Defensa Civil', cruz_roja: 'Cruz Roja', iglesia: 'Iglesia o parroquia',
    jac: 'Junta de Acción Comunal', ong: 'ONG', fundacion: 'Fundación',
    empresa: 'Empresa', colegio: 'Colegio', universidad: 'Universidad',
    conjunto_residencial: 'Conjunto residencial', particular: 'Persona natural',
  },
});

const malas = revisadas.filter((f) => !f.punto);
for (const f of malas) console.error(`  ✗ línea ${f.numero} ${f.nombre}: ${f.errores.join('. ')}`);

// Lo que ya está cargado, para no duplicar al volver a correr esto.
const { data: existentes } = await db
  .from('puntos').select('nombre, municipio_codigo').eq('origen', 'importacion');
const yaEsta = new Set((existentes ?? []).map((p) => `${p.municipio_codigo}|${p.nombre}`));

let creados = 0;
let repetidos = 0;

for (const fila of revisadas) {
  const p = fila.punto;
  if (!p) continue;

  if (yaEsta.has(`${p.municipio_codigo}|${p.nombre}`)) {
    repetidos++;
    console.log(`  = ${p.nombre} (ya estaba)`);
    continue;
  }

  if (soloVer) {
    console.log(`  + ${p.nombre} — ${p.municipio_codigo} — ${p.lat}, ${p.lng}`);
    creados++;
    continue;
  }

  const { data: punto, error } = await db
    .from('puntos')
    .insert({
      nombre: p.nombre,
      tipo_organizacion: p.tipo_organizacion,
      departamento_codigo: p.departamento_codigo,
      municipio_codigo: p.municipio_codigo,
      direccion: p.direccion,
      barrio: p.barrio ?? null,
      referencia: p.referencia ?? null,
      // EWKT: es lo que entiende `geography` y lo único que PostgREST puede
      // mandar, porque no sabe llamar a st_makepoint.
      ubicacion: `SRID=4326;POINT(${p.lng} ${p.lat})`,
      responsable_nombre: p.responsable_nombre?.trim() || 'Por confirmar',
      telefono: p.telefono || 'por conseguir',
      whatsapp: true,
      telefono_publico: false,
      horario_texto: p.horario_texto?.trim() || 'Horario por confirmar',
      // Sin franjas estructuradas a propósito: sin ellas UnAcopio no muestra el
      // sello de "Abierto ahora", que es justo lo correcto mientras el horario
      // no esté confirmado por teléfono.
      horarios: null,
      notas: p.notas ?? null,
      estado: 'pendiente',
      origen: 'importacion',
      entidad_oficial: false,
      fuente_nombre: p.fuente_nombre ?? null,
      fuente_url: p.fuente_url ?? null,
    })
    .select('id')
    .single();

  if (error) {
    console.error(`  ✗ ${p.nombre}: ${error.message}`);
    continue;
  }

  if (p.categorias.length > 0) {
    const { error: errorCat } = await db.from('punto_categoria').insert(
      p.categorias.map((c) => ({ punto_id: punto.id, categoria_slug: c.slug, nivel: c.nivel })),
    );
    if (errorCat) console.error(`  ! ${p.nombre}: categorías — ${errorCat.message}`);
  }

  creados++;
  console.log(`  + ${p.nombre}`);
}

const { count } = await db
  .from('puntos').select('id', { count: 'exact', head: true }).eq('estado', 'pendiente');

console.log(`\n${soloVer ? 'Se cargarían' : 'Cargados'}: ${creados}`);
if (repetidos) console.log(`Ya estaban:  ${repetidos}`);
if (malas.length) console.log(`Rechazados:  ${malas.length}`);
console.log(`Cola de pendientes: ${count}`);
console.log('\nNinguno se ve en el sitio. Se publican desde /admin, después de llamar.\n');
