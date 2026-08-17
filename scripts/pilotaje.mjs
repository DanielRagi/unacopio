/**
 * Convierte los archivos curados de `datos/pilotaje/` en un CSV listo para
 * `/admin/importar`, geocodificando cada dirección con Nominatim.
 *
 *   npm run pilotaje
 *
 * Este script NO escribe en la base de datos, a propósito (ver D14). Escribe un
 * CSV que un moderador abre, revisa y carga. Un recolector que escribe directo
 * es imposible de auditar: cuando aparezca un punto raro no habría cómo saber si
 * lo inventó el script o si de verdad estaba en la fuente.
 *
 * Política de uso de Nominatim, que se respeta acá y no es negociable:
 *   · un pedido por segundo, máximo
 *   · User-Agent que diga qué es esto y a dónde escribir
 *   · caché en disco, para no volver a pedir lo mismo en cada corrida
 * https://operations.osmfoundation.org/policies/nominatim/
 */
import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const ENTRADA = join(RAIZ, 'datos', 'pilotaje');
const SALIDA = join(ENTRADA, 'salida');
const CACHE = join(ENTRADA, 'cache-geocodificacion.json');

const CONTACTO = 'https://unacopio.co';
const AGENTE = `UnAcopio/1.0 (directorio de puntos de acopio; ${CONTACTO})`;

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

const cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : {};
let pedidos = 0;

/** Una consulta cruda a Nominatim, con la pausa y el User-Agent que pide su política. */
async function preguntar(consulta) {
  if (consulta in cache) return cache[consulta];

  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', consulta);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('limit', '3');
  url.searchParams.set('countrycodes', 'co');

  if (pedidos > 0) await dormir(1100);
  pedidos++;

  try {
    const respuesta = await fetch(url, { headers: { 'User-Agent': AGENTE } });
    if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
    cache[consulta] = await respuesta.json();
  } catch (error) {
    console.error(`  ! ${consulta}: ${error.message}`);
    cache[consulta] = [];
  }

  return cache[consulta];
}

const sinTildes = (t) =>
  t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/**
 * Geocodificación con el listón alto a propósito.
 *
 * La primera versión de esto aceptaba el primer resultado que devolviera
 * Nominatim y produjo pines francamente malos: Unicentro en el sur de Bogotá,
 * el Parque Biblioteca San Javier en el centro de Medellín. Nominatim, cuando no
 * entiende una nomenclatura colombiana —"Calle 42C # 95-50"—, no dice que no
 * sabe: devuelve el centroide del barrio o de la vía más parecida, y eso se ve
 * igual de bien en un JSON que una coordenada correcta.
 *
 * Un pin equivocado es peor que ningún pin: manda a alguien al otro lado de la
 * ciudad con el carro cargado. Entonces solo se acepta una coordenada cuando hay
 * evidencia de que Nominatim entendió:
 *
 *   1. Por nombre del lugar, si devuelve un elemento cuyo nombre coincide de
 *      verdad (Unicentro, El Campín, EAFIT están mapeados en OSM con su nombre).
 *   2. Por dirección, solo si la respuesta trae `house_number`: eso significa
 *      que ubicó una placa, no una calle entera.
 *   3. Por barrio, marcado como aproximado.
 *
 * Lo que no pase ninguno de los tres devuelve `null` y cae al centro de la
 * ciudad (ver `centroDeCiudad`), con la nota diciéndolo. Es la misma decisión de
 * D13: mejor un dato que se sabe incompleto que uno que aparenta una precisión
 * que no tiene.
 */
async function geocodificar(punto, municipio) {
  // Si la fuente ya trae coordenada, se respeta: adivinarla otra vez solo puede
  // empeorarla. Acopio Colombia además dice si la suya es exacta o aproximada,
  // y eso viaja en las notas del punto.
  if (typeof punto.lat === 'number' && typeof punto.lng === 'number') {
    return { lat: punto.lat, lng: punto.lng, por: 'la fuente' };
  }

  const nombreLimpio = punto.nombre.replace(/\s*\(.*?\)\s*/g, ' ').trim();
  const palabras = sinTildes(nombreLimpio)
    .split(/[^a-z0-9]+/)
    .filter((p) => p.length >= 4 && !['cruz','roja','parque','biblioteca','centro','punto','acopio','sede'].includes(p));

  // 1) Por nombre, si el lugar tiene uno distintivo.
  if (palabras.length > 0) {
    for (const candidato of await preguntar(`${nombreLimpio}, ${municipio}, Colombia`)) {
      const nombreOsm = sinTildes(candidato.display_name ?? '');
      if (palabras.every((p) => nombreOsm.includes(p))) {
        return { lat: Number(candidato.lat), lng: Number(candidato.lon), por: 'nombre' };
      }
    }
  }

  // 2) Por dirección, solo con número de placa resuelto.
  for (const candidato of await preguntar(`${punto.direccion}, ${municipio}, Colombia`)) {
    if (candidato.address?.house_number) {
      return { lat: Number(candidato.lat), lng: Number(candidato.lon), por: 'dirección' };
    }
  }

  // 3) Por barrio. Deja el pin a menos de un kilómetro, que para "por dónde
  //    queda" ya sirve, y el moderador lo afina.
  const BARRIOS = ['suburb', 'neighbourhood', 'quarter', 'city_district', 'borough'];
  if (punto.barrio) {
    const soloBarrio = punto.barrio.split(/[(/]/)[0].trim();
    for (const candidato of await preguntar(`${soloBarrio}, ${municipio}, Colombia`)) {
      if (BARRIOS.includes(candidato.addresstype)) {
        return { lat: Number(candidato.lat), lng: Number(candidato.lon), por: 'barrio, aproximado' };
      }
    }
  }

  return null;
}

/**
 * Dónde cae lo que no se pudo ubicar.
 *
 * NO el centroide del municipio, que es lo que hace el formulario público: para
 * Bogotá D.C. ese centroide queda en 4,31 / -74,18, o sea en el páramo de
 * Sumapaz, a unos 40 km del centro. Un pin ahí no es "aproximado", es falso.
 *
 * El nodo que OSM tiene para la ciudad cae en el centro urbano, que es lo que
 * cualquiera entendería por "no sabemos la cuadra, pero es en esta ciudad".
 */
async function centroDeCiudad(municipio) {
  for (const candidato of await preguntar(`${municipio}, Colombia`)) {
    if (['city', 'town', 'municipality'].includes(candidato.addresstype)) {
      return { lat: Number(candidato.lat), lng: Number(candidato.lon) };
    }
  }
  return null;
}

const celda = (valor) => {
  const texto = valor === undefined || valor === null ? '' : String(valor);
  return /[",\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
};

const COLUMNAS = [
  'nombre', 'tipo_organizacion', 'municipio_codigo', 'municipio', 'direccion',
  'barrio', 'lat', 'lng', 'responsable_nombre', 'telefono', 'instagram',
  'horario_texto', 'necesita_urgente', 'recibe', 'no_recibe', 'notas',
  'fuente_nombre', 'fuente_url',
];

/** Todo lo que un moderador necesita saber antes de marcar el teléfono. */
function armarNotas(punto, ciudad, coord) {
  const partes = [];
  if (punto.nota) partes.push(punto.nota);
  if (punto.conflicto) partes.push(`CONFLICTO ENTRE FUENTES: ${punto.conflicto}`);
  if (punto.direccion_de) {
    partes.push(
      `La dirección no viene del anuncio del acopio sino del directorio de la sede (${punto.direccion_de}). Confirmar que ahí es donde reciben.`,
    );
  }
  if (!coord) {
    partes.push('PIN SIN UBICAR: quedó en el centro de la ciudad, no en la dirección. Moverlo al editar.');
  } else if (coord.por !== 'nombre' && coord.por !== 'dirección' && coord.por !== 'la fuente') {
    partes.push(`PIN APROXIMADO (ubicado por ${coord.por}). Verificarlo al editar.`);
  }
  if (!punto.telefono && !punto.instagram) {
    partes.push('SIN CONTACTO: conseguir teléfono o Instagram antes de poder verificar.');
  } else if (!punto.telefono) {
    partes.push('Sin teléfono: la verificación toca por Instagram.');
  }
  if (ciudad.nota_horario) partes.push(ciudad.nota_horario);
  return partes.join(' · ');
}

/*
 * Se lee lo que PARECE una recolección, en vez de excluir los cachés por
 * nombre. La lista negra se quedó corta en cuanto apareció un segundo caché
 * —el de Photon— y el script se cayó a mitad de camino intentando contar los
 * puntos de un diccionario de respuestas HTTP.
 */
const archivos = readdirSync(ENTRADA).filter((f) => {
  if (!f.endsWith('.json')) return false;
  const contenido = JSON.parse(readFileSync(join(ENTRADA, f), 'utf8'));
  return Array.isArray(contenido.puntos) || Array.isArray(contenido.ciudades);
});
if (archivos.length === 0) {
  console.error(`No hay archivos de recolección en ${ENTRADA}`);
  process.exit(1);
}

const filas = [];
const informe = [];

/*
 * Un archivo puede traer una ciudad o varias.
 *
 * Empezó con una por archivo, que es lo cómodo cuando se recolecta a mano
 * ciudad por ciudad. Pero la ronda nacional dejó municipios con un solo punto
 * —una capital donde la única fuente publicó una dirección— y veintitantos
 * archivos de tres líneas cada uno son más difíciles de leer que uno solo.
 * Las dos formas conviven: si hay `ciudades`, son varias; si no, el archivo
 * entero es una.
 */
const ciudadesDe = (contenido) =>
  Array.isArray(contenido.ciudades) ? contenido.ciudades : [contenido];

for (const archivo of archivos) {
  for (const ciudad of ciudadesDe(JSON.parse(readFileSync(join(ENTRADA, archivo), 'utf8')))) {
  console.log(`\n→ ${ciudad.municipio} (${ciudad.puntos.length} puntos)`);

  const centro = await centroDeCiudad(ciudad.municipio);
  if (!centro) {
    console.error(`  ! no se pudo ubicar el centro de ${ciudad.municipio}; se omite la ciudad`);
    continue;
  }

  let ubicados = 0;
  let deLaFuente = 0;

  for (const punto of ciudad.puntos) {
    const coord = await geocodificar(punto, ciudad.municipio);
    if (coord && coord.por !== 'barrio, aproximado') ubicados++;
    if (coord?.por === 'la fuente') deLaFuente++;
    console.log(
      `  ${coord ? '·' : '?'} ${punto.nombre} — ${coord ? `por ${coord.por}` : 'centro de la ciudad'}`,
    );

    filas.push([
      punto.nombre,
      punto.tipo,
      ciudad.municipio_codigo,
      ciudad.municipio,
      punto.direccion,
      punto.barrio ?? '',
      // Siempre va coordenada: si se deja vacía, el importador cae al centroide
      // DANE del municipio, y para Bogotá eso es el páramo de Sumapaz.
      (coord ?? centro).lat,
      (coord ?? centro).lng,
      // Vacío a propósito: no hay una persona responsable identificada, y
      // `importar_punto` lo deja como "Por confirmar".
      '',
      punto.telefono ?? '',
      punto.instagram ?? '',
      punto.horario ?? ciudad.horario_reportado ?? '',
      // Solo va como urgente lo que la fuente marque explícitamente. Cuando no
      // prioriza —el caso de la recolección manual— queda vacío: marcar todo
      // como urgente arruinaría el agregado de "lo que más falta".
      (punto.urgente ?? []).join(';'),
      // Las listas de la ciudad son el caso general; un punto puede traer las
      // suyas. Los de mascotas no reciben arroz, y los que solo aceptan aseo no
      // deberían salir cuando alguien filtra por alimentos.
      (punto.recibe ?? ciudad.recibe).join(';'),
      (punto.no_recibe ?? ciudad.no_recibe).join(';'),
      armarNotas(punto, ciudad, coord),
      punto.fuente_nombre ?? ciudad.fuente_principal.nombre,
      punto.fuente_url ?? ciudad.fuente_principal.url,
    ]);
  }

  informe.push({
    archivo,
    ciudad: ciudad.municipio,
    puntos: ciudad.puntos.length,
    conCoordenadaDeLaFuente: deLaFuente,
    ubicados,
    aproximadosOSinUbicar: ciudad.puntos.length - ubicados,
    sinTelefono: ciudad.puntos.filter((p) => !p.telefono).length,
    soloInstagram: ciudad.puntos.filter((p) => !p.telefono && p.instagram).length,
    conConflicto: ciudad.puntos.filter((p) => p.conflicto).length,
    pistasSinConfirmar: ciudad.pistas_sin_confirmar?.length ?? 0,
  });
  }
}

mkdirSync(SALIDA, { recursive: true });
writeFileSync(CACHE, `${JSON.stringify(cache, null, 2)}\n`);

const csv = `﻿${[COLUMNAS.join(','), ...filas.map((f) => f.map(celda).join(','))].join('\r\n')}\r\n`;
const destino = join(SALIDA, 'pilotaje.csv');
writeFileSync(destino, csv);

console.log('\n— informe —');
console.table(informe);
console.log(`\n${filas.length} filas → ${destino}`);
console.log('Ninguna se publica sola: entran como pendientes y hay que llamar.\n');
