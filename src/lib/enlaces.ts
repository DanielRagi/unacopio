/** Armado de enlaces externos: llamar, WhatsApp, cómo llegar, compartir. */

import { SITIO } from './textos';

/** `+57 300 111 2233` → `573001112233`, que es lo que espera wa.me */
export function soloDigitos(telefono: string): string {
  return telefono.replace(/\D/g, '');
}

export function enlaceLlamada(telefono: string): string {
  return `tel:${telefono.replace(/[^\d+]/g, '')}`;
}

export function enlaceWhatsapp(telefono: string, mensaje?: string): string {
  const base = `https://wa.me/${soloDigitos(telefono)}`;
  return mensaje ? `${base}?text=${encodeURIComponent(mensaje)}` : base;
}

/** Abre la app de mapas que la persona ya tenga. */
export function enlaceGoogleMaps(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

export function enlaceWaze(lat: number, lng: number): string {
  return `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
}

/**
 * Compartir por WhatsApp. Es el canal por donde de verdad circula esta
 * información, así que el texto tiene que servir solo, sin que nadie abra el link.
 */
export function enlaceCompartir(texto: string, url: string): string {
  return `https://wa.me/?text=${encodeURIComponent(`${texto}\n${url}`)}`;
}

export function urlPunto(id: string): string {
  const base = process.env.NEXT_PUBLIC_SITIO_URL ?? `https://${SITIO.dominio}`;
  return `${base}/punto/${id}`;
}
