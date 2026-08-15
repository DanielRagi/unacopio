import type { MetadataRoute } from 'next';
import { SITIO } from '@/lib/textos';

const base = process.env.NEXT_PUBLIC_SITIO_URL ?? `https://${SITIO.dominio}`;

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Moderación y el flujo de acceso no tienen nada que hacer en un índice.
      disallow: ['/admin', '/auth', '/offline'],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
