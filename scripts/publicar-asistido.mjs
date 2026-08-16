/**
 * Aplica una tanda de decisiones de moderación asistida.
 *
 *   npm run publicar:asistido -- --ver   muestra qué haría, sin escribir
 *   npm run publicar:asistido            aplica
 *
 * Existe por una razón de emergencia y conviene decirla en voz alta: en los
 * primeros días de un terremoto no hay tiempo para llamar punto por punto antes
 * de mostrar nada, y una lista vacía tampoco ayuda a nadie. Así que se publica
 * lo que resiste una revisión de escritorio —fuente identificable, pin sobre la
 * dirección, sin duplicar— y se deja pendiente el resto.
 *
 * Lo que este script NO hace, a propósito:
 *
 *   · No marca `ultima_verificacion`. Nadie llamó. Un punto publicado por acá
 *     sigue estando sin verificar, y el panel tiene que poder distinguirlos.
 *   · No toca `telefono_publico`. Copiar un número de una publicación no es la
 *     autorización que pide la Ley 1581 de 2012, y publicarlo porque corre prisa
 *     sería justo el atajo que no se puede tomar.
 *   · No escribe nada en `instagram`. El sitio lo publica como enlace a una
 *     cuenta: un "Por confirmar" ahí manda a la gente a instagram.com/Por...
 *   · No inventa ni mueve coordenadas.
 *
 * Usa la llave de servicio, que salta RLS, porque un script no tiene sesión de
 * moderador. Por eso mismo verifica antes de escribir que cada id exista y siga
 * en `pendiente`: si alguien ya lo tocó desde el panel, este script se aparta.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { SIN_TELEFONO, esTelefonoMarcable } from '../src/lib/validacion.ts';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const soloVer = process.argv.includes('--ver');
const archivo =
  process.argv.find((a) => a.endsWith('.json')) ??
  join(RAIZ, 'datos', 'moderacion', '2026-08-16-publicacion-asistida.json');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const servicio = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !servicio) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local');
  process.exit(1);
}

const db = createClient(url, servicio, { auth: { persistSession: false } });
const decisiones = JSON.parse(readFileSync(archivo, 'utf8'));

/* ------------------------------------------------------ revisión del archivo */

const publicar = decisiones.publicar ?? [];
const pendientes = decisiones.dejar_pendiente ?? [];
const problemas = [];

const vistos = new Set();
for (const d of [...publicar, ...pendientes]) {
  if (vistos.has(d.id)) problemas.push(`${d.nombre}: aparece dos veces (${d.id})`);
  vistos.add(d.id);
}
for (const d of publicar) {
  if (!d.notas?.trim()) problemas.push(`${d.nombre}: sin nota pública`);
  // Lo interno se queda adentro. Si algo de esto sobrevive a la reescritura,
  // termina en la página que ve quien va a donar.
  if (/PIN |sin verificar|REPORTADO|Acopio Colombia|antes de poder verificar|al editar/i.test(d.notas)) {
    problemas.push(`${d.nombre}: la nota todavía tiene texto interno`);
  }
}
for (const d of pendientes) {
  if (!d.motivo?.trim()) problemas.push(`${d.nombre}: sin motivo`);
}

if (problemas.length > 0) {
  console.error('El archivo de decisiones tiene problemas:');
  for (const p of problemas) console.error(`  ✗ ${p}`);
  process.exit(1);
}

/* ------------------------------------------- contraste contra la base actual */

const ids = [...vistos];
const { data: enBase, error } = await db
  .from('puntos')
  .select('id, nombre, estado, telefono, municipio_codigo')
  .in('id', ids);

if (error) { console.error(error.message); process.exit(1); }

const porId = new Map((enBase ?? []).map((p) => [p.id, p]));
const faltantes = ids.filter((id) => !porId.has(id));
if (faltantes.length > 0) {
  console.error(`Hay ${faltantes.length} ids del archivo que ya no están en la base:`);
  for (const id of faltantes) console.error(`  ✗ ${id}`);
  process.exit(1);
}

const { count: totalPendientes } = await db
  .from('puntos').select('id', { count: 'exact', head: true }).eq('estado', 'pendiente');

if (totalPendientes !== ids.length) {
  console.log(
    `Aviso: la cola tiene ${totalPendientes} pendientes y el archivo decide sobre ${ids.length}. ` +
    'Los que no aparezcan en el archivo se quedan como están.',
  );
}

/* ---------------------------------------------------------------- aplicación */

let publicados = 0;
let saltados = 0;

for (const d of publicar) {
  const actual = porId.get(d.id);
  if (actual.estado !== 'pendiente') {
    console.log(`  ~ ${d.nombre}: ya está en «${actual.estado}», no se toca`);
    saltados++;
    continue;
  }

  const cambios = {
    estado: 'publicado',
    notas: d.notas.trim(),
    ...(esTelefonoMarcable(actual.telefono) ? {} : { telefono: SIN_TELEFONO }),
    ...(d.fecha_fin ? { fecha_fin: d.fecha_fin } : {}),
  };

  if (soloVer) {
    const tel = cambios.telefono ? ` · telefono → «${SIN_TELEFONO}» (era «${actual.telefono}»)` : '';
    const fin = d.fecha_fin ? ` · hasta ${d.fecha_fin}` : '';
    console.log(`  + ${d.nombre}${tel}${fin}`);
    publicados++;
    continue;
  }

  const { error: errorAl } = await db.from('puntos').update(cambios).eq('id', d.id).eq('estado', 'pendiente');
  if (errorAl) {
    console.error(`  ✗ ${d.nombre}: ${errorAl.message}`);
    continue;
  }
  console.log(`  + ${d.nombre}`);
  publicados++;
}

console.log(`\n${soloVer ? 'Se publicarían' : 'Publicados'}: ${publicados}`);
if (saltados) console.log(`Ya no estaban pendientes: ${saltados}`);
console.log(`Se dejan pendientes a propósito: ${pendientes.length}`);
console.log('\nNinguno de estos está verificado por teléfono. Siguen necesitando la llamada.\n');
