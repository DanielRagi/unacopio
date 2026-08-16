'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { z } from 'zod';
import type { EstadoAcceso, EstadoEdicion } from '@/lib/estados';
import { textoHorario } from '@/lib/horarios';
import { clienteServidor } from '@/lib/supabase/servidor';
import type { EstadoPunto } from '@/lib/tipos';
import { esquemaModeracion, leerFormulario } from '@/lib/validacion';

/**
 * Manda el enlace de acceso al correo del moderador.
 *
 * Solo correo: la plataforma no escribe por WhatsApp (D8). Y sin contraseñas,
 * que en un equipo de voluntarios armado a las carreras se terminan compartiendo
 * por chat.
 */
/**
 * De dónde salió la petición.
 *
 * **El origen real, no `NEXT_PUBLIC_SITIO_URL`.** Esa variable apunta al dominio
 * de producción, así que usarla acá mandaba a quien pedía el enlace desde
 * `localhost` a darse contra unacopio.co: el enlace aterrizaba en otro sitio
 * —a veces sin desplegar— y, aunque llegara, la cookie con el verificador PKCE
 * se había quedado en localhost. El síntoma era «el enlace caducó», que no dice
 * nada de lo que en realidad pasó.
 *
 * Usar la cabecera `host` no abre un redirect abierto: Supabase solo acepta
 * `emailRedirectTo` si coincide con su lista de Redirect URLs. Un host inventado
 * lo rechaza Supabase, no nosotros.
 */
async function origenDeLaPeticion(): Promise<string> {
  const cabeceras = await headers();
  const host = cabeceras.get('host');
  if (!host) return process.env.NEXT_PUBLIC_SITIO_URL ?? 'https://unacopio.co';

  const protocolo =
    cabeceras.get('x-forwarded-proto') ??
    (host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https');

  return `${protocolo}://${host}`;
}

export async function enviarEnlaceAcceso(
  _previo: EstadoAcceso,
  formData: FormData,
): Promise<EstadoAcceso> {
  const correo = String(formData.get('correo') ?? '').trim().toLowerCase();
  if (!correo || !correo.includes('@')) {
    return { estado: 'error', mensaje: 'Escribe un correo válido.' };
  }

  const origen = await origenDeLaPeticion();

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

/**
 * Entrar con el código de seis dígitos que viene en el mismo correo.
 *
 * Existe porque el enlace falla por razones que no dependen de nosotros y que
 * además se ven todas iguales desde afuera («caducó»):
 *
 *   · Los antivirus de correo y el Safe Links de Outlook **abren los enlaces**
 *     para revisarlos. Como el enlace se consume de un solo uso, para cuando la
 *     persona lo toca ya está gastado.
 *   · Si el correo se abre en un navegador distinto del que pidió el enlace, la
 *     cookie con el verificador PKCE no está y el intercambio falla.
 *
 * Un código que se escribe a mano no lo puede gastar un escáner ni depende del
 * navegador. Es el camino aburrido y es el que siempre funciona.
 */
export async function verificarCodigo(
  _previo: EstadoAcceso,
  formData: FormData,
): Promise<EstadoAcceso> {
  const correo = String(formData.get('correo') ?? '').trim().toLowerCase();
  const codigo = String(formData.get('codigo') ?? '').replace(/\D/g, '');

  if (!correo) return { estado: 'error', mensaje: 'Falta el correo. Vuelve a pedir el enlace.' };
  if (codigo.length !== 6) {
    return { estado: 'codigo', correo, mensaje: 'El código son seis dígitos.' };
  }

  const supabase = await clienteServidor();
  const { error } = await supabase.auth.verifyOtp({ email: correo, token: codigo, type: 'email' });

  if (error) {
    return {
      estado: 'codigo',
      correo,
      mensaje: `No sirvió: ${error.message}. Revisa que sea el código del último correo.`,
    };
  }

  redirect('/admin');
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
 * Guarda los cambios que moderación aplica a un punto.
 *
 * Es la contraparte de D9: si el público no puede editar, moderación tiene que
 * poder. Sin esto, una solicitud que dice "cambiamos el horario" no tiene dónde
 * aterrizar, y la ronda de llamadas —que existe justamente para enterarse de
 * esos cambios— no serviría de nada.
 */
export async function guardarPunto(
  _previo: EstadoEdicion,
  formData: FormData,
): Promise<EstadoEdicion> {
  const id = String(formData.get('id') ?? '');
  if (!id) return { estado: 'error', errores: {}, mensaje: 'Falta el punto.' };

  // `esquemaModeracion` y no el del formulario público: acá el horario puede
  // quedar vacío. Ver el comentario en validacion.ts.
  const analisis = esquemaModeracion.safeParse(leerFormulario(formData));
  if (!analisis.success) {
    return { estado: 'error', errores: z.flattenError(analisis.error).fieldErrors };
  }
  const datos = analisis.data;

  const supabase = await clienteServidor();
  const { data: sesion } = await supabase.auth.getUser();
  if (!sesion.user) redirect('/admin');

  // El pin solo se toca si vinieron las dos coordenadas. Si el mapa no cargó
  // —sin JavaScript, o con la red caída a mitad— es mejor dejar el punto donde
  // estaba que moverlo a la nada.
  const ubicacion =
    datos.lat !== undefined && datos.lng !== undefined
      ? { ubicacion: `SRID=4326;POINT(${datos.lng} ${datos.lat})` }
      : {};

  /*
   * Sin franjas no se toca `horario_texto`.
   *
   * `textoHorario([])` devuelve cadena vacía, así que sobrescribirlo dejaría en
   * blanco lo que el punto ya decía —"Horario por confirmar", o lo que hubiera
   * copiado la importación— a cambio de nada. Se guarda `null` en `horarios`
   * para que el sello de "Abierto ahora" siga callado, que es lo correcto
   * mientras nadie confirme el horario (D12).
   */
  const horario =
    datos.horarios.length > 0
      ? { horario_texto: textoHorario(datos.horarios), horarios: datos.horarios }
      : { horarios: null };

  const { error } = await supabase
    .from('puntos')
    .update({
      ...ubicacion,
      nombre: datos.nombre,
      tipo_organizacion: datos.tipo_organizacion,
      direccion: datos.direccion,
      barrio: datos.barrio ?? null,
      referencia: datos.referencia ?? null,
      responsable_nombre: datos.responsable_nombre,
      telefono: datos.telefono,
      instagram: datos.instagram ?? null,
      whatsapp: datos.whatsapp,
      telefono_publico: datos.telefono_publico,
      correo: datos.correo ?? null,
      ...horario,
      fecha_inicio: datos.fecha_inicio ?? null,
      fecha_fin: datos.fecha_fin ?? null,
      recibe_voluntarios: datos.recibe_voluntarios,
      notas: datos.notas ?? null,
      // Editar es también haber hablado con alguien: cuenta como verificación.
      ultima_verificacion: new Date().toISOString(),
      verificado_por: sesion.user.id,
    })
    .eq('id', id);

  if (error) {
    return { estado: 'error', errores: {}, mensaje: `No se pudo guardar: ${error.message}` };
  }

  // Las categorías se reemplazan enteras: es más simple y más seguro que
  // calcular qué cambió, y son pocas filas.
  await supabase.from('punto_categoria').delete().eq('punto_id', id);
  if (datos.categorias.length > 0) {
    await supabase.from('punto_categoria').insert(
      datos.categorias.map((c) => ({ punto_id: id, categoria_slug: c.slug, nivel: c.nivel })),
    );
  }

  revalidatePath('/admin');
  revalidatePath('/');
  revalidatePath(`/punto/${id}`);

  return { estado: 'guardado' };
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
