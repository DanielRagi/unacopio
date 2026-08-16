import { headers } from 'next/headers';

/**
 * De dónde entra la persona, según su IP.
 *
 * Vercel resuelve la geolocalización en el borde y la deja en cabeceras. No
 * cuesta nada, no pide permiso y no necesita JavaScript, así que la portada
 * puede abrir mostrando la ciudad de quien entra en vez del país entero — que
 * en una emergencia es la diferencia entre ver seis puntos útiles y ver una
 * lista de todo el país donde el suyo está de decimoquinto.
 *
 * Lo que **no** es: precisión. La IP da ciudad, y a veces la del proveedor y no
 * la de la persona. Por eso solo se usa para elegir un municipio por defecto,
 * siempre se dice cuál se eligió, y siempre se puede cambiar. Para la distancia
 * de verdad está el botón de GPS, que sí pide permiso.
 *
 * En local estas cabeceras no existen y todo esto devuelve `null`, que es el
 * comportamiento de antes: Colombia entera.
 */

export interface UbicacionAproximada {
  lat: number;
  lng: number;
  ciudad: string | null;
}

const numero = (valor: string | null): number | null => {
  if (!valor) return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
};

export async function ubicacionPorIp(): Promise<UbicacionAproximada | null> {
  const cabeceras = await headers();

  // Solo Colombia. A alguien que entra desde afuera no le sirve que le
  // adivinemos una ciudad: casi siempre está buscando para un familiar y quiere
  // elegir el municipio a mano.
  if (cabeceras.get('x-vercel-ip-country') !== 'CO') return null;

  const lat = numero(cabeceras.get('x-vercel-ip-latitude'));
  const lng = numero(cabeceras.get('x-vercel-ip-longitude'));
  if (lat === null || lng === null) return null;

  const ciudad = cabeceras.get('x-vercel-ip-city');

  return {
    lat,
    lng,
    // Vercel las manda con codificación de URL: "Bogot%C3%A1".
    ciudad: ciudad ? decodeURIComponent(ciudad) : null,
  };
}
