'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { EstadoImportacion } from '@/lib/estados';
import { parsearCsv, revisarFilas, type CatalogosImportacion } from '@/lib/importacion';
import { clienteServidor } from '@/lib/supabase/servidor';
import { TIPOS_ORGANIZACION } from '@/lib/textos';

/** Tope por tanda. Más que esto y nadie alcanza a revisar la vista previa. */
const MAXIMO_FILAS = 200;

/**
 * Un solo formulario para los dos pasos: revisar y cargar. El botón de confirmar
 * manda `confirmar=1`, y el textarea con el CSV sigue siendo la única fuente de
 * verdad, así que se puede corregir y volver a revisar sin perder nada.
 */
export async function procesarImportacion(
  previo: EstadoImportacion,
  formData: FormData,
): Promise<EstadoImportacion> {
  return formData.get('confirmar') === '1'
    ? ejecutarImportacion(previo, formData)
    : revisarImportacion(previo, formData);
}

async function catalogos(
  supabase: Awaited<ReturnType<typeof clienteServidor>>,
): Promise<CatalogosImportacion> {
  const [municipios, categorias] = await Promise.all([
    supabase.from('municipios').select('codigo, nombre, departamento_codigo, lat, lng'),
    supabase.from('categorias').select('slug'),
  ]);

  return {
    municipios: (municipios.data ?? []) as CatalogosImportacion['municipios'],
    categorias: new Set((categorias.data ?? []).map((c) => c.slug as string)),
    etiquetasDeTipo: TIPOS_ORGANIZACION,
  };
}

/**
 * Paso 1: revisar.
 *
 * No toca la base. Devuelve el CSV tal cual junto al análisis, para que la
 * confirmación no dependa de guardar nada a medias en el servidor.
 */
export async function revisarImportacion(
  _previo: EstadoImportacion,
  formData: FormData,
): Promise<EstadoImportacion> {
  const csv = String(formData.get('csv') ?? '').trim();
  if (!csv) return { estado: 'error', mensaje: 'Pega el CSV o sube el archivo.' };

  const supabase = await clienteServidor();
  const { data: sesion } = await supabase.auth.getUser();
  if (!sesion.user) redirect('/admin');

  const { columnas, filas } = parsearCsv(csv);
  if (filas.length === 0) {
    return { estado: 'error', mensaje: 'El archivo no tiene filas de datos.' };
  }
  if (!columnas.includes('nombre')) {
    return {
      estado: 'error',
      mensaje: `No encontré la columna "nombre". Las que llegaron: ${columnas.join(', ')}`,
    };
  }
  if (filas.length > MAXIMO_FILAS) {
    return {
      estado: 'error',
      mensaje: `Son ${filas.length} filas y el tope por tanda es ${MAXIMO_FILAS}. Pártelo en varios archivos.`,
    };
  }

  return { estado: 'revisado', csv, filas: revisarFilas(filas, await catalogos(supabase)) };
}

/**
 * Paso 2: cargar.
 *
 * Se vuelve a parsear y a revisar el mismo CSV en vez de confiar en lo que
 * devolvió el paso anterior: lo que vuelve del navegador es entrada del usuario,
 * aunque lo hayamos mandado nosotros. Solo entran las filas sin errores.
 */
export async function ejecutarImportacion(
  _previo: EstadoImportacion,
  formData: FormData,
): Promise<EstadoImportacion> {
  const csv = String(formData.get('csv') ?? '').trim();
  if (!csv) return { estado: 'error', mensaje: 'Se perdió el archivo. Vuelve a pegarlo.' };

  const supabase = await clienteServidor();
  const { data: sesion } = await supabase.auth.getUser();
  if (!sesion.user) redirect('/admin');

  const { filas } = parsearCsv(csv);
  if (filas.length > MAXIMO_FILAS) {
    return { estado: 'error', mensaje: `El tope por tanda es ${MAXIMO_FILAS} filas.` };
  }

  const revisadas = revisarFilas(filas, await catalogos(supabase));
  const fallidos: { numero: number; nombre: string; mensaje: string }[] = [];
  let creados = 0;

  for (const fila of revisadas) {
    if (!fila.punto) continue;
    const p = fila.punto;

    const { error } = await supabase.rpc('importar_punto', {
      p_nombre: p.nombre,
      p_tipo_organizacion: p.tipo_organizacion,
      p_departamento_codigo: p.departamento_codigo,
      p_municipio_codigo: p.municipio_codigo,
      p_direccion: p.direccion,
      p_lat: p.lat,
      p_lng: p.lng,
      p_responsable_nombre: p.responsable_nombre,
      p_telefono: p.telefono,
      p_horario_texto: p.horario_texto,
      p_categorias: p.categorias,
      p_horarios: null,
      p_barrio: p.barrio ?? null,
      p_referencia: p.referencia ?? null,
      p_notas: p.notas ?? null,
      p_fuente_nombre: p.fuente_nombre ?? null,
      p_fuente_url: p.fuente_url ?? null,
    });

    if (error) fallidos.push({ numero: fila.numero, nombre: fila.nombre, mensaje: error.message });
    else creados++;
  }

  // Las que ni siquiera se intentaron también son parte del resultado: si no se
  // dicen, quien importó cree que entraron las 40 y entraron 31.
  for (const fila of revisadas) {
    if (fila.punto) continue;
    fallidos.push({
      numero: fila.numero,
      nombre: fila.nombre,
      mensaje: fila.errores.join('. '),
    });
  }
  fallidos.sort((a, b) => a.numero - b.numero);

  revalidatePath('/admin');
  return { estado: 'cargado', creados, fallidos };
}
