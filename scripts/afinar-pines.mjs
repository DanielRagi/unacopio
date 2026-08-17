/**
 * Segundo intento de ubicar los pines que quedaron en el centro de la ciudad.
 *
 *   npm run pines            propone (no escribe en la base)
 *   npm run pines -- --aplicar   escribe las propuestas aceptadas
 *
 * Por qué existe, si ya hay geocodificador en `pilotaje.mjs`: aquel usa
 * Nominatim, que fuera de Bogotá y Medellín falló en 55 de 68 puntos. Nominatim
 * es exigente con la consulta libre y no perdona la nomenclatura colombiana.
 * **Photon** —el mismo OSM detrás, motor de búsqueda distinto— sí encuentra por
 * nombre propio, que es justamente lo que tiene la mitad de esta cola: coliseos,
 * plazoletas, centrales de abastos y centros comerciales, sitios sin dirección
 * publicada pero mapeados en OSM con su nombre.
 *
 * Las tres defensas, y las tres están acá porque las tres fallaron primero:
 *
 *   1. **Anillo de cordura.** El candidato tiene que caer a menos de X km del
 *      nodo que OSM tiene para la ciudad. Sin esto, "Banco de Alimentos de
 *      Cartagena" trajo la de Murcia, España, y la Empresa de Licores de
 *      Cundinamarca se fue de Cota a Bogotá, 21 km.
 *   2. **El nombre tiene que ser el mismo sitio, no uno que lo contenga.** El
 *      municipio no cuenta como palabra propia —"Banco de Alimentos de Cali"
 *      coincidía con *Cali*— y tres palabras de más ya es otro lugar.
 *   3. **La placa no vale sola: tiene que estar en la vía pedida.** Photon
 *      contesta con números que existen en otra calle. "Avenida Carrera 15
 *      #99-23" trajo el número 15 de esa avenida, siete kilómetros al sur.
 *
 * Hubo un cuarto intento —aceptar la vía sin número de placa— y se quitó: dio
 * dos resultados y los dos estaban mal. Una avenida de quince kilómetros no
 * ubica nada.
 *
 * Lo que no hace: no publica, no toca `ultima_verificacion`, no inventa
 * direcciones. Mueve el pin y anota con qué evidencia.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const MODERACION = join(RAIZ, 'datos', 'moderacion');
const ENTRADA = join(MODERACION, 'pendientes.json');
const PROPUESTAS = join(MODERACION, 'pines-propuestos.json');
const CACHE = join(RAIZ, 'datos', 'pilotaje', 'cache-photon.json');

const aplicar = process.argv.includes('--aplicar');
const AGENTE = 'UnAcopio/1.0 (directorio de puntos de acopio; https://unacopio.co)';

const cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : {};
let pedidos = 0;
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

async function photon(consulta) {
  if (consulta in cache) return cache[consulta];
  if (pedidos > 0) await dormir(1100);
  pedidos++;
  try {
    const url = `https://photon.komoot.io/api?q=${encodeURIComponent(consulta)}&limit=5`;
    const respuesta = await fetch(url, { headers: { 'User-Agent': AGENTE } });
    if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
    cache[consulta] = (await respuesta.json()).features ?? [];
  } catch (error) {
    console.error(`  ! ${consulta}: ${error.message}`);
    cache[consulta] = [];
  }
  return cache[consulta];
}

const sinTildes = (t) => (t ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const KM = 111.32;
const distancia = (a, b) =>
  Math.hypot((a.lat - b.lat) * KM, (a.lng - b.lng) * KM * Math.cos((a.lat * Math.PI) / 180));

/** El nodo urbano de la ciudad. NO el centroide DANE: para Bogotá ese cae en Sumapaz. */
async function nodoDeCiudad(municipio) {
  for (const f of await photon(`${municipio}, Colombia`)) {
    const p = f.properties;
    if (p.country === 'Colombia' && ['city', 'town', 'municipality'].includes(p.osm_value)) {
      return { lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] };
    }
  }
  return null;
}

/*
 * Palabras que no distinguen nada. "Centro de acopio Parque Principal" comparte
 * "centro" y "parque" con media ciudad; si cuentan como coincidencia, cualquier
 * resultado pasa.
 */
const VACIAS = new Set([
  'centro', 'comercial', 'punto', 'acopio', 'sede', 'parque', 'unidad', 'de', 'del', 'la', 'las',
  'los', 'el', 'y', 'con', 'para', 'coliseo', 'banco', 'alimentos', 'fundacion', 'universidad',
  'plaza', 'plazoleta', 'ciudadela', 'oficina', 'estacion', 'servicio', 'biblioteca', 'cruz', 'roja',
  // Calificativos que ponemos nosotros y OSM no: "— sede administrativa",
  // "— primer piso", "— local 015". Describen dónde entrar, no qué lugar es.
  'administrativa', 'administrativo', 'primer', 'primero', 'piso', 'bodega', 'local', 'principal',
]);

/*
 * El nombre del municipio NO cuenta como palabra distintiva, y esto costó una
 * pasada entera descubrirlo. "Banco de Alimentos de Cali" se reduce a ["cali"]
 * al quitar las palabras vacías, y entonces coincide con *Cali*, la ciudad, a
 * cero metros del pin de respaldo. Igual "de Manizales" con la catedral de
 * Manizales y "de Dosquebradas" con los bomberos de Dosquebradas. Todas pasaron
 * el filtro y todas estaban mal.
 */
const distintivas = (nombre, municipio) => {
  const delMunicipio = new Set(sinTildes(municipio).split(/[^a-z0-9]+/).filter(Boolean));
  // Se corta en el paréntesis pero NO en la raya: nuestros nombres ponen lo
  // propio después de ella. Cortando en la raya, "Bomberos — Estación Kennedy
  // B-5" se reducía a "bomberos" y dejaba de distinguirse de las otras tres.
  return sinTildes(nombre.replace(/\s*\(.*$/, ''))
    .split(/[^a-z0-9]+/)
    .filter((p) => p.length >= 4 && !VACIAS.has(p) && !delMunicipio.has(p));
};

/** "Carrera 52A #30A-97" → { tipo: 'cr', numero: '52a', placa: '30a' } */
function partesDeDireccion(direccion) {
  const t = sinTildes(direccion)
    .replace(/\bavenida\b/g, 'av')
    .replace(/\b(carrera|cra|cr|kra|kr)\b/g, 'cr')
    .replace(/\b(calle|cll|cl)\b/g, 'cl')
    .replace(/\b(diagonal|diag|dg)\b/g, 'dg')
    .replace(/\b(transversal|trans|tv)\b/g, 'tv');
  const m = t.match(/\b(cr|cl|dg|tv)\s*(\d+[a-z]?(?:\s*bis)?)\s*(sur|norte|este|oeste)?\s*#?\s*(\d+[a-z]?)?/);
  return m
    ? { tipo: m[1], numero: m[2].replace(/\s+/g, ''), sentido: m[3] ?? '', placa: m[4] ?? null }
    : null;
}

/**
 * ¿La vía que devolvió OSM es la que pedimos?
 *
 * Sin esto, Photon contesta con una placa que existe pero en otra calle:
 * pedimos "Avenida Carrera 15 #99-23" y devolvió "Avenida Carrera 15" número
 * 15, siete kilómetros más al sur. Tiene placa, está en el país y cae dentro
 * del anillo — pasa todos los filtros anteriores y es un pin equivocado.
 */
function mismaVia(pedida, calleOsm) {
  const a = partesDeDireccion(pedida);
  const b = partesDeDireccion(calleOsm ?? '');
  // El «Sur» cuenta. Pedimos "Diagonal 48 #19-16" y OSM contestó "Diagonal 48
  // S": mismo tipo, mismo número, trece kilómetros de diferencia.
  return Boolean(a && b && a.tipo === b.tipo && a.numero === b.numero && a.sentido === b.sentido);
}

/** Misma cuadra: "134D-23" y "134D-14" sirven; "99-23" y "15" no. */
function mismaCuadra(pedida, placaOsm) {
  const a = partesDeDireccion(pedida);
  if (!a?.placa || !placaOsm) return false;
  return sinTildes(String(placaOsm)).split('-')[0].trim() === a.placa;
}

/* ------------------------------------------------------------------ búsqueda */

async function ubicar(punto, nodo, radio) {
  const dentro = (f) => {
    const c = { lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] };
    return f.properties.country === 'Colombia' && distancia(c, nodo) <= radio ? c : null;
  };

  // 1) Por nombre propio. Es lo que salva a los sitios sin dirección publicada.
  //    `osm_key === 'place'` queda fuera: son ciudades, barrios y veredas, no
  //    lugares. Es la puerta por la que se coló "Cali" como si fuera un punto.
  const tokens = distintivas(punto.nombre, punto.municipio);
  if (tokens.length > 0) {
    for (const f of await photon(`${punto.nombre}, ${punto.municipio}, Colombia`)) {
      const c = dentro(f);
      if (!c || f.properties.osm_key === 'place' || !f.properties.name) continue;
      const nombreOsm = sinTildes(f.properties.name);
      if (!tokens.every((t) => nombreOsm.includes(t))) continue;
      /*
       * Que el nombre de OSM contenga el nuestro no basta: tiene que ser el
       * mismo sitio, no uno que lo contenga. "Centro de Acopio Barranquillita"
       * coincidía con "Portal de Barranquillita Nelson Pinedo" —un portal de
       * buses— porque comparte la palabra del sector. Tres palabras propias de
       * más es otro lugar; una o dos son la variante del nombre oficial
       * ("Alcaldía **Municipal** de Bucaramanga", "**Concesionaria** Fersautos").
       */
      const nuestras = new Set(distintivas(punto.nombre, punto.municipio));
      const sobran = distintivas(f.properties.name, punto.municipio).filter((t) => !nuestras.has(t));
      if (sobran.length > 2) continue;
      return { ...c, por: 'nombre', detalle: f.properties.name, calle: f.properties.street ?? null };
    }
  }

  const conDireccion = await photon(`${punto.direccion}, ${punto.municipio}, Colombia`);

  // 2) Por placa, y solo si la vía es la que pedimos y la placa cae en la misma
  //    cuadra. La placa sola no basta: existe en otra calle y se ve igual de bien.
  for (const f of conDireccion) {
    const c = dentro(f);
    if (!c || !f.properties.housenumber) continue;
    if (!mismaVia(punto.direccion, f.properties.street)) continue;
    if (!mismaCuadra(punto.direccion, f.properties.housenumber)) continue;
    return { ...c, por: 'placa', detalle: `${f.properties.street} ${f.properties.housenumber}` };
  }

  /*
   * Hubo un tercer intento —aceptar la vía sin placa— y se quitó porque no
   * funciona. Produjo exactamente dos resultados y los dos estaban mal: la
   * Avenida Carrera 15 mide quince kilómetros, así que "está sobre esa avenida"
   * no ubica nada. Sin el número de la placa, la vía sola no es evidencia.
   */
  return null;
}

/* ----------------------------------------------------------------- ejecución */

const puntos = JSON.parse(readFileSync(ENTRADA, 'utf8'));

/*
 * Solo se tocan los que están sobre un pin compartido. Un pin compartido entre
 * dos puntos distintos de la misma ciudad es la firma del respaldo del centro
 * urbano: dos lugares reales no caen en la misma coordenada de siete decimales.
 */
const cuenta = new Map();
for (const p of puntos) {
  const k = `${p.municipio_codigo}|${p.lat},${p.lng}`;
  cuenta.set(k, (cuenta.get(k) ?? 0) + 1);
}
const sospechoso = (p) =>
  cuenta.get(`${p.municipio_codigo}|${p.lat},${p.lng}`) > 1 ||
  /PIN SIN UBICAR|PIN APROXIMADO \(ubicado por barrio/i.test(p.notas ?? '') ||
  // Y el que llegó sin nomenclatura: su pin puede ser único —único de esa
  // ciudad— y aun así estar puesto donde el geocodificador se rindió. El
  // Coliseo Bernardo Caraballo se quedó fuera de la primera pasada por esto,
  // teniendo OSM su nombre exacto.
  /FALTA LA (NOMENCLATURA|DIRECCIÓN)|DIRECCIÓN SIN CONFIRMAR/i.test(p.notas ?? '');

const aRevisar = puntos.filter(sospechoso);
console.log(`${aRevisar.length} de ${puntos.length} pendientes con el pin sospechoso.\n`);

const nodos = new Map();
const propuestas = [];

for (const punto of aRevisar) {
  if (!nodos.has(punto.municipio_codigo)) nodos.set(punto.municipio_codigo, await nodoDeCiudad(punto.municipio));
  const nodo = nodos.get(punto.municipio_codigo);
  if (!nodo) {
    console.log(`  ? ${punto.municipio}: sin nodo urbano en OSM, se omite la ciudad`);
    continue;
  }

  // 15 km de radio salvo en las tres grandes. Con 22 entraba la Empresa de
  // Licores de Cundinamarca desde Bogotá a un punto que está en Cota: mismo
  // nombre, otro municipio, 21 km. Un municipio pequeño no mide eso.
  const radio = ['11001', '05001', '76001'].includes(punto.municipio_codigo) ? 35 : 15;
  const encontrado = await ubicar(punto, nodo, radio);

  if (!encontrado) {
    console.log(`  · ${punto.municipio} — ${punto.nombre}: sigue sin ubicar`);
    continue;
  }

  const movido = Math.round(distancia({ lat: punto.lat, lng: punto.lng }, encontrado) * 1000);
  console.log(
    `  ✓ ${punto.municipio} — ${punto.nombre}: por ${encontrado.por} (${encontrado.detalle}), ${movido} m`,
  );
  propuestas.push({
    id: punto.id,
    nombre: punto.nombre,
    municipio: punto.municipio,
    direccion: punto.direccion,
    antes: { lat: punto.lat, lng: punto.lng },
    despues: { lat: encontrado.lat, lng: encontrado.lng },
    por: encontrado.por,
    detalle: encontrado.detalle,
    calle_osm: encontrado.calle ?? null,
    metros_movido: movido,
  });
}

writeFileSync(CACHE, `${JSON.stringify(cache, null, 2)}\n`);
writeFileSync(PROPUESTAS, `${JSON.stringify(propuestas, null, 2)}\n`);

const porMetodo = {};
for (const p of propuestas) porMetodo[p.por] = (porMetodo[p.por] ?? 0) + 1;
console.log(`\n${propuestas.length} de ${aRevisar.length} ubicados:`, porMetodo);
console.log(`Propuestas → ${PROPUESTAS}`);

if (!aplicar) {
  console.log('\nNada se escribió. Corré con --aplicar cuando las revises.\n');
  process.exit(0);
}

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

let escritos = 0;
for (const p of propuestas) {
  const { error } = await db
    .from('puntos')
    .update({ ubicacion: `SRID=4326;POINT(${p.despues.lng} ${p.despues.lat})` })
    .eq('id', p.id)
    .eq('estado', 'pendiente');
  if (error) console.error(`  ✗ ${p.nombre}: ${error.message}`);
  else escritos++;
}
console.log(`\nPines movidos: ${escritos}\n`);
