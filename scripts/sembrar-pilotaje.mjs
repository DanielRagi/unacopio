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

/*
 * Lo que ya está cargado, para no duplicar al volver a correr esto.
 *
 * Comparar el nombre exacto no basta: distintas fuentes escriben el mismo punto
 * distinto —"Universidad EAFIT (placa cubierta)" y "Universidad EAFIT — placa
 * cubierta"—. Pero comparar por cercanía tampoco sirve acá, y cuesta explicarlo:
 * muchos de nuestros puntos viejos tienen el pin de respaldo en el centro de la
 * ciudad, así que "Cruz Roja SAMU Sur" y "Cruz Roja SAMU Norte" aparecían a cero
 * metros uno del otro y el script los fundía en uno.
 *
 * La señal buena es la **dirección**: dos fichas con "Carrera 24 #73-38" son el
 * mismo lugar aunque se llamen distinto, y dos con nomenclatura distinta no lo
 * son aunque el pin diga que sí.
 *
 * Y ante la duda, entra. Un duplicado que entra lo agarra el detector de los
 * 200 metros en la cola de moderación, que para eso está; uno que el script
 * descarta por su cuenta no lo ve nadie nunca.
 */
const sinTildes = (s) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** "Carrera 52 # 30A-97, barrio Guayabal" → "cr5230a97" */
function claveDireccion(direccion) {
  const t = sinTildes(direccion ?? '')
    .replace(/avenida/g, 'av')
    .replace(/(carrera|cra|cr|kr|kra)/g, 'cr')
    .replace(/(calle|cll|cl)/g, 'cl')
    .replace(/(diagonal|dg|diag)/g, 'dg')
    .replace(/(transversal|tv|trans)/g, 'tv');
  const m = t.match(/(av\s*)?(cr|cl|dg|tv)\s*\d+[a-z]?(\s*bis)?(\s*(sur|norte|este|oeste))?\s*#?\s*\d+[a-z]?\s*-?\s*\d+/);
  return m ? m[0].replace(/[^a-z0-9]/g, '') : null;
}

const claveNombre = (nombre) =>
  sinTildes(nombre).replace(/[^a-z0-9]/g, '');

const { data: existentes } = await db
  .from('puntos').select('nombre, direccion, municipio_codigo').eq('origen', 'importacion');
const cargados = (existentes ?? []).map((p) => ({
  ...p, cNombre: claveNombre(p.nombre), cDireccion: claveDireccion(p.direccion),
}));

function yaCargado(p) {
  const cNombre = claveNombre(p.nombre);
  const cDireccion = claveDireccion(p.direccion);
  return cargados.find(
    (otro) =>
      otro.municipio_codigo === p.municipio_codigo &&
      (otro.cNombre === cNombre || (cDireccion !== null && otro.cDireccion === cDireccion)),
  );
}

let creados = 0;
let repetidos = 0;

for (const fila of revisadas) {
  const p = fila.punto;
  if (!p) continue;

  const gemelo = yaCargado(p);
  if (gemelo) {
    repetidos++;
    console.log(
      `  = ${p.nombre}` + (gemelo.nombre === p.nombre ? ' (ya estaba)' : `  ≈ misma dirección que "${gemelo.nombre}"`),
    );
    continue;
  }

  if (soloVer) {
    console.log(`  + ${p.nombre} — ${p.municipio_codigo} — ${p.lat}, ${p.lng}`);
    cargados.push({ nombre: p.nombre, municipio_codigo: p.municipio_codigo,
                    cNombre: claveNombre(p.nombre), cDireccion: claveDireccion(p.direccion) });
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

  cargados.push({ nombre: p.nombre, municipio_codigo: p.municipio_codigo,
                  cNombre: claveNombre(p.nombre), cDireccion: claveDireccion(p.direccion) });
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
