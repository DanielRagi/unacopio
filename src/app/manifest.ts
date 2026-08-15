import type { MetadataRoute } from 'next';
import { SITIO } from '@/lib/textos';

/**
 * Manifiesto para instalar el sitio.
 *
 * No se le pide a nadie que "descargue la app": el valor está en que quien ya
 * usó el sitio pueda dejarlo en su pantalla de inicio y que la lista que
 * consultó siga ahí cuando la red se caiga, que en una emergencia pasa.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITIO.nombre} — ${SITIO.lema}`,
    short_name: SITIO.nombre,
    description: SITIO.descripcion,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    lang: 'es-CO',
    background_color: '#ffffff',
    theme_color: '#047857',
    icons: [
      { src: '/icono.svg', sizes: 'any', type: 'image/svg+xml' },
      { src: '/icono-mascara.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Ver el mapa', url: '/mapa' },
      { name: 'Registrar un punto', url: '/registrar' },
    ],
  };
}
