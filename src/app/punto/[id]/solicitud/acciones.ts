'use server';

import { createHash } from 'node:crypto';
import { headers } from 'next/headers';
import type { EstadoSolicitud } from '@/lib/estados';
import { clienteServidor } from '@/lib/supabase/servidor';
import type { TipoReporte } from '@/lib/tipos';

const TIPOS_VALIDOS: TipoReporte[] = [
  'info_incorrecta', 'cerrado', 'duplicado', 'no_existe', 'spam',
];

/**
 * Huella de la IP para el antiabuso de `reportar_punto`, que ignora repeticiones
 * sobre el mismo punto dentro de una hora.
 *
 * Se guarda el hash y no la IP: alcanza para detectar la repetición y no deja
 * un registro de quién escribió sobre qué punto.
 */
async function huellaIp(): Promise<string | null> {
  const cabeceras = await headers();
  const ip = (cabeceras.get('x-forwarded-for') ?? cabeceras.get('x-real-ip') ?? '')
    .split(',')[0]
    .trim();
  if (!ip) return null;
  return createHash('sha256').update(`unacopio:${ip}`).digest('hex');
}

/**
 * Solicitud sobre un punto ya publicado: pedir un cambio, pedir el cierre, o
 * avisar que algo está mal.
 *
 * Reemplaza al token de edición. Nadie edita directamente: moderación lee la
 * observación y aplica el cambio. Es más lento, pero no exige entregarle un
 * secreto a cada persona que registra un punto, ni un proveedor de correo para
 * hacérselo llegar.
 */
export async function enviarSolicitud(
  _previo: EstadoSolicitud,
  formData: FormData,
): Promise<EstadoSolicitud> {
  if ((formData.get('sitio_web') as string)?.trim()) {
    return { estado: 'enviada' }; // bot: se responde bonito y no se guarda nada
  }

  const puntoId = String(formData.get('punto_id') ?? '');
  const tipo = String(formData.get('tipo') ?? '') as TipoReporte;
  const observaciones = String(formData.get('observaciones') ?? '').trim();
  const contacto = String(formData.get('contacto') ?? '').trim();
  const esResponsable = formData.get('es_responsable') !== null;

  if (!puntoId) return { estado: 'error', mensaje: 'Falta el punto.' };
  if (!TIPOS_VALIDOS.includes(tipo)) {
    return { estado: 'error', mensaje: 'Elige de qué se trata la solicitud.' };
  }
  if (observaciones.length < 10) {
    return {
      estado: 'error',
      mensaje: 'Cuéntanos con un poco más de detalle qué hay que cambiar.',
    };
  }
  if (observaciones.length > 1000) {
    return { estado: 'error', mensaje: 'La observación quedó muy larga.' };
  }

  const supabase = await clienteServidor();
  const { error } = await supabase.rpc('reportar_punto', {
    p_punto_id: puntoId,
    p_tipo: tipo,
    p_comentario: observaciones,
    p_contacto: contacto || null,
    p_ip_hash: await huellaIp(),
    p_es_responsable: esResponsable,
  });

  if (error) {
    return { estado: 'error', mensaje: `No pudimos enviar la solicitud: ${error.message}` };
  }

  return { estado: 'enviada' };
}
