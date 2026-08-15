'use client';

import { useEffect } from 'react';

/**
 * Registra el service worker, y solo en producción.
 *
 * En desarrollo estorba: sirve páginas viejas y uno termina depurando una copia
 * en caché en vez del código que acaba de escribir.
 */
export function RegistrarServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;

    // Después de `load` para no competir por ancho de banda con la página misma,
    // que en 3G es lo único que importa.
    const registrar = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Que falle no rompe nada: el sitio funciona igual, solo sin copia
        // offline. No vale la pena molestar a nadie con un aviso.
      });
    };

    if (document.readyState === 'complete') registrar();
    else window.addEventListener('load', registrar, { once: true });

    return () => window.removeEventListener('load', registrar);
  }, []);

  return null;
}
