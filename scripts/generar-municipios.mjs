/**
 * Genera supabase/seed/0002_municipios.sql a partir de DIVIPOLA.
 *
 * Fuente: datos.gov.co, dataset pqwj-3fi4 ("MinSalud Divipola - Municipios"),
 * que trae código DANE de departamento y municipio, nombre y centroide.
 * Los nombres de departamento se fijan aquí porque el dataset solo trae el código.
 *
 *   node scripts/generar-municipios.mjs
 *
 * Solo hay que volver a correrlo si cambia la división político-administrativa,
 * o sea casi nunca. El SQL generado se versiona en el repo.
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const SALIDA = join(RAIZ, 'supabase', 'seed', '0002_municipios.sql');
const FUENTE = 'https://www.datos.gov.co/resource/pqwj-3fi4.json?$limit=2000';

const DEPARTAMENTOS = {
  '05': 'Antioquia',       '08': 'Atlántico',   '11': 'Bogotá D.C.',
  '13': 'Bolívar',         '15': 'Boyacá',      '17': 'Caldas',
  '18': 'Caquetá',         '19': 'Cauca',       '20': 'Cesar',
  '23': 'Córdoba',         '25': 'Cundinamarca','27': 'Chocó',
  '41': 'Huila',           '44': 'La Guajira',  '47': 'Magdalena',
  '50': 'Meta',            '52': 'Nariño',      '54': 'Norte de Santander',
  '63': 'Quindío',         '66': 'Risaralda',   '68': 'Santander',
  '70': 'Sucre',           '73': 'Tolima',      '76': 'Valle del Cauca',
  '81': 'Arauca',          '85': 'Casanare',    '86': 'Putumayo',
  '88': 'Archipiélago de San Andrés, Providencia y Santa Catalina',
  '91': 'Amazonas',        '94': 'Guainía',     '95': 'Guaviare',
  '97': 'Vaupés',          '99': 'Vichada',
};

// Centroides que la fuente trae vacíos o fuera de rango, corregidos a mano.
const CENTROIDES_CORREGIDOS = {
  '73443': { lat: 5.1994, lng: -74.8919 },  // San Sebastián de Mariquita, Tolima
};

const comillas = (s) => `'${String(s).replace(/'/g, "''")}'`;

const respuesta = await fetch(FUENTE, { signal: AbortSignal.timeout(60_000) });
if (!respuesta.ok) throw new Error(`La fuente respondió ${respuesta.status}`);
const crudos = await respuesta.json();

const municipios = [];
const sinDepartamento = new Set();
const sinCoordenadas = [];

for (const fila of crudos) {
  const codigo = String(fila.idmupio ?? '').padStart(5, '0');
  const dep = codigo.slice(0, 2);
  if (!DEPARTAMENTOS[dep]) { sinDepartamento.add(dep); continue; }

  const correccion = CENTROIDES_CORREGIDOS[codigo];
  const lat = correccion ? correccion.lat : Number(fila.mpiolatitud);
  const lng = correccion ? correccion.lng : Number(fila.mpiolongitud);
  // Colombia continental + insular. Descarta ceros y coordenadas basura.
  const valida = Number.isFinite(lat) && Number.isFinite(lng) &&
                 lat > -5 && lat < 14 && lng > -82 && lng < -66;
  if (!valida) sinCoordenadas.push(`${codigo} ${fila.nommpio}`);

  municipios.push({ codigo, nombre: String(fila.nommpio).trim(), dep, lat, lng, valida });
}

municipios.sort((a, b) => a.codigo.localeCompare(b.codigo));

// Ordenado por código: JS reordena las llaves numéricas de un objeto y '05'/'08'
// quedarían al final.
const filasDep = Object.entries(DEPARTAMENTOS)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([codigo, nombre]) => `  (${comillas(codigo)}, ${comillas(nombre)})`)
  .join(',\n');

const filasMun = municipios
  .map((m) => {
    const centroide = m.valida
      ? `st_setsrid(st_makepoint(${m.lng}, ${m.lat}), 4326)::geography`
      : 'null';
    return `  (${comillas(m.codigo)}, ${comillas(m.nombre)}, ${comillas(m.dep)}, ${centroide})`;
  })
  .join(',\n');

const sql = `-- UnAcopio — departamentos y municipios (DIVIPOLA / DANE).
-- GENERADO POR scripts/generar-municipios.mjs — no editar a mano.
-- Fuente: datos.gov.co dataset pqwj-3fi4.
-- ${municipios.length} municipios, ${municipios.filter((m) => !m.valida).length} sin centroide.

insert into departamentos (codigo, nombre) values
${filasDep}
on conflict (codigo) do update set nombre = excluded.nombre;

insert into municipios (codigo, nombre, departamento_codigo, centroide) values
${filasMun}
on conflict (codigo) do update
  set nombre              = excluded.nombre,
      departamento_codigo = excluded.departamento_codigo,
      centroide           = coalesce(excluded.centroide, municipios.centroide);
`;

await mkdir(dirname(SALIDA), { recursive: true });
await writeFile(SALIDA, sql, 'utf8');

console.log(`✓ ${SALIDA}`);
console.log(`  ${municipios.length} municipios, ${Object.keys(DEPARTAMENTOS).length} departamentos`);
if (sinCoordenadas.length) {
  console.log(`  ⚠ ${sinCoordenadas.length} sin centroide válido:`);
  for (const m of sinCoordenadas.slice(0, 20)) console.log(`     ${m}`);
}
if (sinDepartamento.size) {
  console.log(`  ⚠ códigos de departamento desconocidos: ${[...sinDepartamento].join(', ')}`);
}
