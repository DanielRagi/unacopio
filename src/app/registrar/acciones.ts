'use server';

import { z } from 'zod';
import type { EstadoRegistro } from '@/lib/estados';
import { textoHorario } from '@/lib/horarios';
import { clienteServidor } from '@/lib/supabase/servidor';
import { esquemaRegistro, leerFormulario } from '@/lib/validacion';

/**
 * Registra un punto desde el formulario público.
 *
 * Va con el cliente anónimo a propósito: la RPC `registrar_punto` es
 * `security definer` y ya fuerza estado `pendiente` y `entidad_oficial=false`.
 * Usar la llave de servicio acá sería darle permisos de más a un formulario
 * abierto a internet.
 */
export async function registrarPunto(
  _previo: EstadoRegistro,
  formData: FormData,
): Promise<EstadoRegistro> {
  // Trampa para bots: un campo que los humanos no ven y no llenan. Si viene con
  // algo, se responde como si todo hubiera salido bien y no se guarda nada.
  if ((formData.get('sitio_web') as string)?.trim()) {
    return { estado: 'listo', id: 'descartado' };
  }

  const analisis = esquemaRegistro.safeParse(leerFormulario(formData));
  if (!analisis.success) {
    return { estado: 'error', errores: z.flattenError(analisis.error).fieldErrors };
  }

  const datos = analisis.data;
  const supabase = await clienteServidor();

  // Sin JavaScript no hay pin en el mapa. Antes que perder el registro, se ubica
  // en el centro del municipio y moderación lo afina después.
  let lat = datos.lat;
  let lng = datos.lng;

  if (lat === undefined || lng === undefined) {
    const { data: municipio } = await supabase
      .from('municipios')
      .select('lat, lng')
      .eq('codigo', datos.municipio_codigo)
      .maybeSingle();

    if (municipio?.lat == null || municipio?.lng == null) {
      return {
        estado: 'error',
        errores: {},
        mensaje: 'No pudimos ubicar el municipio. Marca el punto en el mapa e intenta de nuevo.',
      };
    }
    lat = municipio.lat;
    lng = municipio.lng;
  }

  const { data, error } = await supabase.rpc('registrar_punto', {
    p_nombre: datos.nombre,
    p_tipo_organizacion: datos.tipo_organizacion,
    p_departamento_codigo: datos.departamento_codigo,
    p_municipio_codigo: datos.municipio_codigo,
    p_direccion: datos.direccion,
    p_lat: lat,
    p_lng: lng,
    p_responsable_nombre: datos.responsable_nombre,
    p_telefono: datos.telefono,
    // El texto legible sale de las franjas, no de un campo aparte: así el badge
    // "abierto ahora" y lo que lee la persona nunca pueden decir cosas distintas.
    p_horario_texto: textoHorario(datos.horarios),
    p_horarios: datos.horarios,
    p_categorias: datos.categorias,
    p_barrio: datos.barrio ?? null,
    p_referencia: datos.referencia ?? null,
    p_whatsapp: datos.whatsapp,
    p_telefono_publico: datos.telefono_publico,
    p_correo: datos.correo,
    p_fecha_inicio: datos.fecha_inicio ?? null,
    p_fecha_fin: datos.fecha_fin ?? null,
    p_recibe_voluntarios: datos.recibe_voluntarios,
    p_notas: datos.notas ?? null,
  });

  if (error) {
    return {
      estado: 'error',
      errores: {},
      mensaje: `No pudimos guardar el punto: ${error.message}`,
    };
  }

  // Desde 0004 la función devuelve el uuid pelado, sin token de edición.
  const id = typeof data === 'string' ? data : null;
  if (!id) {
    return { estado: 'error', errores: {}, mensaje: 'No pudimos guardar el punto. Intenta de nuevo.' };
  }

  return { estado: 'listo', id };
}
