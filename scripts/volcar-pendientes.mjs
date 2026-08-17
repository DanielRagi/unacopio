/**
 * Vuelca la cola de moderación a JSON y a un digesto legible.
 *
 *   npm run pendientes                 → datos/moderacion/pendientes.json + .txt
 *
 * Solo lee. Existe porque revisar cien puntos desde el panel, uno por pantalla,
 * es inviable cuando hay que decidir en bloque: acá caben todos en un archivo y
 * se pueden comparar entre sí —duplicados, pines repetidos, direcciones a
 * medias— que es justo lo que el panel, punto por punto, no deja ver.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const DESTINO = join(RAIZ, 'datos', 'moderacion');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const servicio = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !servicio) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local');
  process.exit(1);
}
const db = createClient(url, servicio, { auth: { persistSession: false } });

/** PostgREST corta en 1.000 filas sin avisar. */
async function paginar(tabla, columnas, orden, filtro = (q) => q) {
  const todo = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await filtro(db.from(tabla).select(columnas)).order(orden).range(desde, desde + 999);
    if (error) throw new Error(error.message);
    todo.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return todo;
}

const [puntos, categorias, municipios, { data: departamentos }] = await Promise.all([
  paginar(
    'puntos',
    'id, nombre, tipo_organizacion, departamento_codigo, municipio_codigo, direccion, barrio, referencia, lat, lng, responsable_nombre, telefono, instagram, telefono_publico, horario_texto, horarios, notas, estado, origen, entidad_oficial, fuente_nombre, fuente_url, creado_en',
    'id',
    (q) => q.eq('estado', 'pendiente'),
  ),
  paginar('punto_categoria', 'punto_id, categoria_slug, nivel', 'punto_id'),
  paginar('municipios', 'codigo, nombre, departamento_codigo, lat, lng', 'codigo'),
  db.from('departamentos').select('codigo, nombre'),
]);

const porMunicipio = new Map(municipios.map((m) => [m.codigo, m]));
const porDepartamento = new Map((departamentos ?? []).map((d) => [d.codigo, d.nombre]));
const porPunto = new Map();
for (const c of categorias) porPunto.set(c.punto_id, [...(porPunto.get(c.punto_id) ?? []), `${c.categoria_slug}:${c.nivel}`]);

const salida = puntos
  .map((p) => ({
    ...p,
    municipio: porMunicipio.get(p.municipio_codigo)?.nombre,
    departamento: porDepartamento.get(p.departamento_codigo),
    categorias: (porPunto.get(p.id) ?? []).sort(),
  }))
  .sort((a, b) => `${a.departamento}${a.municipio}${a.nombre}`.localeCompare(`${b.departamento}${b.municipio}${b.nombre}`));

/*
 * El digesto quita el texto que se repite en todas las notas. No es cosmético:
 * con el párrafo del horario y la coletilla de verificación puestos, el archivo
 * triplica de tamaño y lo importante —qué le falta a ESTE punto— se pierde.
 */
const REPETIDO = [
  /El Tiempo reporta 8am-5pm; Infobae dice[^·]*\./,
  /Se carga como texto, sin franjas estructuradas:[^·]*/,
  /Ninguna fuente da el horario punto por punto\./,
  /Igual hay que llamar: acá no se publica nada sin confirmar de primera mano\./,
];

const lineas = [];
salida.forEach((p, i) => {
  const notas = (p.notas ?? '')
    .split(' · ')
    .map((t) => REPETIDO.reduce((s, r) => s.replace(r, '').trim(), t))
    .filter(Boolean);
  lineas.push(
    `\n[${i + 1}] ${p.nombre}`,
    `    ${p.municipio} (${p.departamento}) · tipo=${p.tipo_organizacion}`,
    `    dir: ${p.direccion}${p.barrio ? ` | barrio: ${p.barrio}` : ''}`,
    `    pin: ${p.lat}, ${p.lng}`,
    `    tel: ${p.telefono} | ig: ${p.instagram ?? '—'}`,
    `    hor: ${p.horario_texto}`,
    `    fuente: ${p.fuente_nombre ?? '—'}`,
    ...notas.map((n) => `    · ${n}`),
    `    cats: ${p.categorias.join(' ')}`,
    `    id: ${p.id}`,
  );
});

const compartidos = new Map();
for (const p of salida) {
  const k = `${p.lat},${p.lng}`;
  compartidos.set(k, [...(compartidos.get(k) ?? []), `${p.municipio}: ${p.nombre}`]);
}
lineas.push('\n=== PINES COMPARTIDOS (respaldo del centro de la ciudad) ===');
for (const [k, v] of compartidos) if (v.length > 1) lineas.push(`${k}\n  ${v.join('\n  ')}`);

mkdirSync(DESTINO, { recursive: true });
writeFileSync(join(DESTINO, 'pendientes.json'), `${JSON.stringify(salida, null, 2)}\n`);
writeFileSync(join(DESTINO, 'pendientes.txt'), `${lineas.join('\n')}\n`);

const porCiudad = {};
for (const p of salida) porCiudad[p.municipio] = (porCiudad[p.municipio] ?? 0) + 1;
console.log(`${salida.length} pendientes → datos/moderacion/pendientes.{json,txt}`);
console.table(
  Object.entries(porCiudad)
    .map(([ciudad, pendientes]) => ({ ciudad, pendientes }))
    .sort((a, b) => b.pendientes - a.pendientes),
);
