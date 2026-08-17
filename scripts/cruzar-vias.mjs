/**
 * Ubica pines cruzando las dos vías de la dirección.
 *
 *   npm run cruces              propone (no escribe)
 *   npm run cruces -- --aplicar  escribe
 *
 * Por qué hace falta un tercer geocodificador. Nominatim y Photon fallan fuera
 * de Bogotá y Medellín por la misma razón: **OSM no tiene números de placa en
 * las ciudades intermedias de Colombia**. Tiene los ejes de las vías, y nada
 * más. Pedirle "Calle 45 #28-36, Bucaramanga" es pedirle algo que no sabe.
 *
 * Pero una dirección colombiana ya es una intersección. "Calle 45 #28-36"
 * significa: sobre la Calle 45, a la altura de la Carrera 28. Eso OSM sí lo
 * tiene — las dos vías están dibujadas— y cruzarlas da un punto a media cuadra
 * del portal, que para "por dónde queda" es de sobra.
 *
 * Se pide **una consulta por ciudad**, con todas las vías que se necesitan de
 * esa ciudad en una sola unión, y los cruces se calculan acá. Overpass es un
 * recurso compartido y gratuito: una consulta por punto serían cientos, y con
 * razón devuelve 429.
 *
 * Cuándo se acepta el resultado:
 *   · las dos polilíneas se acercan a menos de 150 m (si no, no se cruzan y
 *     alguna de las dos no es la vía que creemos),
 *   · el cruce cae dentro del anillo de cordura de la ciudad,
 *   · y hay un solo cruce plausible. Cuando una vía aparece en dos partes de la
 *     ciudad —pasa con las que cambian de nombre— hay varios cruces lejos entre
 *     sí, y ahí se prefiere no elegir.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const ENTRADA = join(RAIZ, 'datos', 'moderacion', 'pendientes.json');
const PROPUESTAS = join(RAIZ, 'datos', 'moderacion', 'cruces-propuestos.json');
const CACHE = join(RAIZ, 'datos', 'pilotaje', 'cache-overpass.json');

/*
 * `--aplicar` NO recalcula: escribe lo que hay en el archivo de propuestas.
 *
 * Antes recalculaba y volvía a escribir el archivo antes de aplicarlo, lo que
 * pisaba en silencio cualquier revisión hecha a mano. Se descartaron tres
 * cruces malos del archivo, se corrió `--aplicar`, y los tres entraron igual
 * porque el archivo se había regenerado un segundo antes. Un paso de revisión
 * que el propio script deshace no es un paso de revisión.
 */
const aplicar = process.argv.includes('--aplicar');
const AGENTE = 'UnAcopio/1.0 (directorio de puntos de acopio; https://unacopio.co)';
const ESPEJOS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];

const cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : {};
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const KM = 111.32;
const metros = (a, b) =>
  Math.hypot((a.lat - b.lat) * KM, (a.lng - b.lng) * KM * Math.cos((a.lat * Math.PI) / 180)) * 1000;

async function overpass(clave, consulta) {
  if (clave in cache) return cache[clave];
  for (const espejo of ESPEJOS) {
    for (let intento = 0; intento < 3; intento++) {
      await dormir(4000);
      try {
        const r = await fetch(espejo, {
          method: 'POST',
          headers: { 'User-Agent': AGENTE, 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `data=${encodeURIComponent(consulta)}`,
        });
        if (r.status === 429 || r.status === 504) continue;
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        cache[clave] = (await r.json()).elements ?? [];
        return cache[clave];
      } catch (error) {
        if (intento === 2) console.error(`  ! ${clave}: ${error.message}`);
      }
    }
  }
  cache[clave] = [];
  return cache[clave];
}

const sinTildes = (t) => (t ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/**
 * "Calle 45 #28-36" → { via: 'Calle 45', cruce: 'Carrera 28' }
 *
 * El tipo de la vía transversal es siempre el contrario: sobre una calle se
 * numera por carreras y al revés. Las diagonales y transversales quedan fuera
 * porque no siguen esa regla y adivinarles el eje sería inventar.
 */
function ejes(direccion) {
  const t = sinTildes(direccion)
    .replace(/\b(avenida|av)\b\.?/g, '')
    .replace(/\b(carrera|cra|cr|kra|kr)\b\.?/g, 'carrera')
    .replace(/\b(calle|cll|cl)\b\.?/g, 'calle');
  const m = t.match(/\b(calle|carrera)\s*(\d+[a-z]?)\s*(sur|norte|este|oeste)?\s*#?\s*(\d+[a-z]?)\s*(sur|norte|este|oeste)?\s*-\s*\d+/);
  if (!m) return null;
  const [, tipo, numero, sentido, numeroCruce, sentidoCruce] = m;
  const capital = (s) => s[0].toUpperCase() + s.slice(1);
  const sufijo = (s) => (s ? ` ${capital(s)}` : '');
  return {
    via: `${capital(tipo)} ${numero.toUpperCase()}${sufijo(sentido)}`,
    cruce: `${tipo === 'calle' ? 'Carrera' : 'Calle'} ${numeroCruce.toUpperCase()}${sufijo(sentidoCruce ?? sentido)}`,
  };
}

/** Los nombres que OSM le puede haber puesto a la misma vía. */
const variantes = (nombre) => {
  const [tipo, ...resto] = nombre.split(' ');
  const n = resto.join(' ');
  return [`${tipo} ${n}`, `Avenida ${tipo} ${n}`, `Av. ${tipo} ${n}`, `Avenida ${n}`];
};

/** El punto más cercano entre dos conjuntos de polilíneas, y qué tan cerca quedan. */
function cruzar(a, b) {
  let mejor = null;
  for (const wa of a) {
    for (const pa of wa.geometry ?? []) {
      for (const wb of b) {
        for (const pb of wb.geometry ?? []) {
          const d = metros({ lat: pa.lat, lng: pa.lon }, { lat: pb.lat, lng: pb.lon });
          if (!mejor || d < mejor.separacion) {
            mejor = { separacion: d, lat: (pa.lat + pb.lat) / 2, lng: (pa.lon + pb.lon) / 2 };
          }
        }
      }
    }
  }
  return mejor;
}

/* ----------------------------------------------------------------- ejecución */

if (aplicar) {
  if (!existsSync(PROPUESTAS)) {
    console.error(`No hay propuestas en ${PROPUESTAS}. Corré primero sin --aplicar.`);
    process.exit(1);
  }
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const revisadas = JSON.parse(readFileSync(PROPUESTAS, 'utf8'));
  let escritos = 0;
  for (const p of revisadas) {
    const { error } = await db
      .from('puntos')
      .update({ ubicacion: `SRID=4326;POINT(${p.despues.lng} ${p.despues.lat})` })
      .eq('id', p.id)
      .eq('estado', 'pendiente');
    if (error) console.error(`  ✗ ${p.nombre}: ${error.message}`);
    else escritos++;
  }
  console.log(`\nPines movidos: ${escritos} de ${revisadas.length} propuestas revisadas.\n`);
  process.exit(0);
}

const puntos = JSON.parse(readFileSync(ENTRADA, 'utf8'));

// Nombre del municipio tal como lo tiene OSM, donde no coincide con el del DANE.
const EN_OSM = { 'Bogotá D.C.': 'Bogotá, D.C.', Itagui: 'Itagüí', Cali: 'Santiago de Cali' };
const NODOS = {}; // se llena con el primer punto de cada ciudad, que sirve de referencia

const porCiudad = new Map();
for (const p of puntos) {
  const e = ejes(p.direccion);
  if (!e) continue;
  if (!porCiudad.has(p.municipio_codigo)) porCiudad.set(p.municipio_codigo, { municipio: p.municipio, items: [] });
  porCiudad.get(p.municipio_codigo).items.push({ punto: p, ...e });
}

console.log(`${[...porCiudad.values()].reduce((n, c) => n + c.items.length, 0)} puntos con dirección cruzable, en ${porCiudad.size} municipios.\n`);

const propuestas = [];

for (const [codigo, { municipio, items }] of porCiudad) {
  const nombreOsm = EN_OSM[municipio] ?? municipio;
  const necesarias = [...new Set(items.flatMap((i) => [...variantes(i.via), ...variantes(i.cruce)]))];
  const filtros = necesarias.map((n) => `way(area.a)["name"="${n.replace(/"/g, '')}"];`).join('');
  const consulta = `[out:json][timeout:90];area["name"="${nombreOsm}"]["boundary"="administrative"]->.a;(${filtros});out geom;`;

  const vias = await overpass(`${codigo}|${necesarias.length}|${necesarias.join(',')}`, consulta);
  const porNombre = new Map();
  for (const w of vias) {
    const n = w.tags?.name;
    if (n) porNombre.set(n, [...(porNombre.get(n) ?? []), w]);
  }
  console.log(`→ ${municipio}: ${vias.length} vías, ${porNombre.size} nombres distintos`);

  /*
   * Referencia de cordura: el promedio de los pines que la ciudad ya tiene.
   *
   * OJO CON ESTO. Es circular cuando la ciudad tiene un solo punto y ese punto
   * está sobre el pin de respaldo: el anillo queda centrado en el error que se
   * quiere corregir. Pasó con Yumbo, donde el cruce propuesto cayó ocho
   * kilómetros al sur —dentro de Cali— y el filtro lo dejó pasar. Mientras el
   * anillo no se centre en el nodo urbano de OSM, los resultados de ciudades
   * con uno o dos puntos hay que mirarlos a mano.
   */
  NODOS[codigo] = items.reduce(
    (acc, i, _, arr) => ({ lat: acc.lat + i.punto.lat / arr.length, lng: acc.lng + i.punto.lng / arr.length }),
    { lat: 0, lng: 0 },
  );

  for (const { punto, via, cruce } of items) {
    const a = variantes(via).flatMap((n) => porNombre.get(n) ?? []);
    const b = variantes(cruce).flatMap((n) => porNombre.get(n) ?? []);
    if (!a.length || !b.length) {
      console.log(`   · ${punto.nombre}: falta ${!a.length ? via : cruce} en OSM`);
      continue;
    }
    const x = cruzar(a, b);
    if (!x || x.separacion > 150) {
      console.log(`   · ${punto.nombre}: ${via} y ${cruce} no se cruzan (${x ? Math.round(x.separacion) : '?'} m)`);
      continue;
    }
    if (metros(x, NODOS[codigo]) > 30000) {
      console.log(`   · ${punto.nombre}: el cruce cae lejísimos de la ciudad`);
      continue;
    }
    const movido = Math.round(metros({ lat: punto.lat, lng: punto.lng }, x));
    console.log(`   ✓ ${punto.nombre}: ${via} × ${cruce} → ${movido} m`);
    propuestas.push({
      id: punto.id,
      nombre: punto.nombre,
      municipio,
      direccion: punto.direccion,
      via,
      cruce,
      separacion_m: Math.round(x.separacion),
      antes: { lat: punto.lat, lng: punto.lng },
      despues: { lat: Number(x.lat.toFixed(7)), lng: Number(x.lng.toFixed(7)) },
      metros_movido: movido,
    });
  }

  writeFileSync(CACHE, `${JSON.stringify(cache)}\n`);
}

writeFileSync(PROPUESTAS, `${JSON.stringify(propuestas, null, 2)}\n`);
console.log(`\n${propuestas.length} pines propuestos → ${PROPUESTAS}`);

console.log('Revisá el archivo, quitá los cruces que no convenzan, y corré con --aplicar.\n');
