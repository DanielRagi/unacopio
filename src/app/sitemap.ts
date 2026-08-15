import type { MetadataRoute } from 'next';
import { municipiosConPuntos } from '@/lib/datos';
import { SITIO } from '@/lib/textos';

const base = process.env.NEXT_PUBLIC_SITIO_URL ?? `https://${SITIO.dominio}`;

/**
 * Solo las páginas que le sirven a alguien que llega de Google.
 *
 * Las fichas de puntos quedan fuera a propósito: cambian y se cierran todos los
 * días, y una ficha indexada de un punto que ya cerró manda gente a un lugar
 * donde no hay nadie. Los municipios sí, porque "puntos de acopio en Medellín"
 * es exactamente lo que la gente busca.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const fijas: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: 'hourly', priority: 1 },
    { url: `${base}/acopio`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${base}/mapa`, changeFrequency: 'hourly', priority: 0.8 },
    { url: `${base}/registrar`, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${base}/datos`, changeFrequency: 'weekly', priority: 0.5 },
  ];

  try {
    const municipios = await municipiosConPuntos();
    return [
      ...fijas,
      ...municipios.map((m) => ({
        url: `${base}/acopio/${m.slug}`,
        changeFrequency: 'daily' as const,
        priority: 0.7,
      })),
    ];
  } catch {
    // Si la base no responde, un sitemap corto es mejor que un 500.
    return fijas;
  }
}
