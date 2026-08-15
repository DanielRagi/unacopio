'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import type { EstadoAcceso } from '@/lib/estados';
import { clienteServidor } from '@/lib/supabase/servidor';
import type { EstadoPunto } from '@/lib/tipos';

/**
 * Manda el enlace de acceso al correo del moderador.
 *
 * Solo correo: la plataforma no escribe por WhatsApp (D8). Y sin contraseñas,
 * que en un equipo de voluntarios armado a las carreras se terminan compartiendo
 * por chat.
 */
export async function enviarEnlaceAcceso(
  _previo: EstadoAcceso,
  formData: FormData,
): Promise<EstadoAcceso> {
  const correo = String(formData.get('correo') ?? '').trim().toLowerCase();
  if (!correo || !correo.includes('@')) {
    return { estado: 'error', mensaje: 'Escribe un correo válido.' };
  }

  const cabeceras = await headers();
  const origen =
    process.env.NEXT_PUBLIC_SITIO_URL ??
    `https://${cabeceras.get('host') ?? 'unacopio.co'}`;

  const supabase = await clienteServidor();
  const { error } = await supabase.auth.signInWithOtp({
    email: correo,
    options: {
      emailRedirectTo: `${origen}/auth/confirmar`,
      // Nadie se registra solo: el moderador tiene que existir ya en Supabase.
      shouldCreateUser: false,
    },
  });

  if (error) {
    return { estado: 'error', mensaje: `No pudimos enviar el enlace: ${error.message}` };
  }

  return { estado: 'enviado', correo };
}

export async function cerrarSesion() {
  const supabase = await clienteServidor();
  await supabase.auth.signOut();
  redirect('/admin');
}

/** Cambia el estado de un punto. Quien no sea moderador rebota contra RLS. */
export async function cambiarEstado(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  const estado = String(formData.get('estado') ?? '') as EstadoPunto;

  const supabase = await clienteServidor();
  const { data: sesion } = await supabase.auth.getUser();
  if (!sesion.user) redirect('/admin');

  const cambios: Record<string, unknown> = { estado };

  // Publicar es también decir "yo confirmé esto": queda firmado y con fecha, que
  // es de donde sale el semáforo de frescura de la ficha pública.
  if (estado === 'publicado') {
    cambios.ultima_verificacion = new Date().toISOString();
    cambios.verificado_por = sesion.user.id;
    cambios.reportes_abiertos = 0;
  }

  await supabase.from('puntos').update(cambios).eq('id', id);

  if (estado === 'publicado') {
    await supabase.from('reportes').update({ resuelto: true }).eq('punto_id', id);
  }

  revalidatePath('/admin');
  revalidatePath('/');
  revalidatePath(`/punto/${id}`);
}

/** "Ya llamé y siguen recibiendo": reinicia el reloj de frescura. */
export async function marcarVerificado(formData: FormData) {
  const id = String(formData.get('id') ?? '');

  const supabase = await clienteServidor();
  const { data: sesion } = await supabase.auth.getUser();
  if (!sesion.user) redirect('/admin');

  await supabase
    .from('puntos')
    .update({
      ultima_verificacion: new Date().toISOString(),
      verificado_por: sesion.user.id,
    })
    .eq('id', id);

  revalidatePath('/admin');
  revalidatePath(`/punto/${id}`);
}

/**
 * Registra el resultado de una llamada de la ronda de verificación.
 *
 * Todos los caminos escriben `ultimo_intento_llamada`, incluso cuando no
 * contestan. Es lo que saca al punto de la cola por un rato y evita que otro
 * voluntario marque el mismo número enseguida.
 */
export async function registrarLlamada(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  const resultado = String(formData.get('resultado') ?? '');

  const supabase = await clienteServidor();
  const { data: sesion } = await supabase.auth.getUser();
  if (!sesion.user) redirect('/admin');

  const ahora = new Date().toISOString();
  const cambios: Record<string, unknown> = { ultimo_intento_llamada: ahora };

  // "Contestaron" es lo que reinicia el reloj de frescura, no el intento.
  const contestaron = resultado !== 'no_contesta';
  if (contestaron) {
    cambios.ultima_verificacion = ahora;
    cambios.verificado_por = sesion.user.id;
    cambios.intentos_fallidos = 0;
  }

  if (resultado === 'sigue') cambios.estado = 'publicado';
  if (resultado === 'lleno') cambios.estado = 'lleno';
  if (resultado === 'cerrado') {
    cambios.estado = 'cerrado';
    // Ya no está en el directorio: no tiene sentido seguir contando frescura.
    delete cambios.ultima_verificacion;
    delete cambios.verificado_por;
  }

  if (resultado === 'no_contesta') {
    const { data: actual } = await supabase
      .from('puntos').select('intentos_fallidos').eq('id', id).maybeSingle();
    cambios.intentos_fallidos = (actual?.intentos_fallidos ?? 0) + 1;
  }

  await supabase.from('puntos').update(cambios).eq('id', id);

  revalidatePath('/admin');
  revalidatePath('/');
  revalidatePath(`/punto/${id}`);
}

/**
 * Da por atendida una solicitud.
 *
 * No borra: la bandeja atendida es el historial de por qué un punto quedó como
 * quedó, y sirve para detectar al que reporta lo mismo veinte veces.
 */
export async function resolverSolicitud(formData: FormData) {
  const id = String(formData.get('id') ?? '');

  const supabase = await clienteServidor();
  const { data: sesion } = await supabase.auth.getUser();
  if (!sesion.user) redirect('/admin');

  await supabase.from('reportes').update({ resuelto: true }).eq('id', id);

  revalidatePath('/admin');
}

/**
 * Marca o desmarca la banda de entidad oficial.
 * Solo para alcaldías, gobernaciones, bomberos, Defensa Civil y Cruz Roja, y
 * solo después de confirmarlo por teléfono (D4).
 */
export async function alternarEntidadOficial(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  const oficial = formData.get('oficial') === 'true';

  const supabase = await clienteServidor();
  await supabase.from('puntos').update({ entidad_oficial: oficial }).eq('id', id);

  revalidatePath('/admin');
  revalidatePath(`/punto/${id}`);
}
