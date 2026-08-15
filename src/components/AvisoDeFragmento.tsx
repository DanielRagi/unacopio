'use client';

import { useSyncExternalStore } from 'react';

/**
 * Muestra el error que Supabase esconde en el fragmento de la URL.
 *
 * Cuando el enlace del correo falla, Supabase no manda el motivo como parámetro
 * sino después del `#`: `.../admin#error=access_denied&error_code=otp_expired`.
 * El fragmento **no viaja al servidor** —el navegador no lo manda—, así que
 * desde el Route Handler eso se ve como una visita normal sin código, y el
 * mensaje que sale es «el enlace venía incompleto», que no es lo que pasó.
 *
 * Este componente lo lee en el navegador y lo traduce. Es la diferencia entre
 * un voluntario que sabe qué hacer y uno que escribe a las once de la noche
 * diciendo que "no funciona".
 */

const MOTIVOS: Record<string, string> = {
  otp_expired:
    'El enlace ya se usó o se venció. Suele pasar cuando el antivirus del correo lo abre para revisarlo: con eso queda gastado antes de que lo toques. Usa el código de seis dígitos del mismo correo.',
  access_denied:
    'Supabase rechazó el enlace. Si lo abriste en un navegador distinto del que lo pidió, prueba con el código de seis dígitos.',
  server_error: 'Supabase respondió con un error. Vuelve a pedir el enlace en un momento.',
};

/**
 * El fragmento se lee con `useSyncExternalStore` y no con un efecto que llame a
 * `setState`: es un valor que vive fuera de React, y el snapshot del servidor es
 * la cadena vacía, así que la hidratación cuadra.
 */
const suscribir = (avisar: () => void) => {
  window.addEventListener('hashchange', avisar);
  return () => window.removeEventListener('hashchange', avisar);
};

export function AvisoDeFragmento() {
  const fragmento = useSyncExternalStore(
    suscribir,
    () => window.location.hash,
    () => '',
  );

  const parametros = new URLSearchParams(fragmento.slice(1));
  const codigo = parametros.get('error_code');
  const descripcion = parametros.get('error_description');

  const mensaje = !codigo && !descripcion
    ? null
    : (codigo && MOTIVOS[codigo]) ?? descripcion?.replace(/\+/g, ' ') ?? 'El enlace no sirvió.';

  if (!mensaje) return null;

  return (
    <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm font-medium text-amber-900 dark:text-amber-200">
      {mensaje}
    </p>
  );
}
