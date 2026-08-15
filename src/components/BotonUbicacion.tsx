'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

/**
 * "Usar mi ubicación": pide el GPS y recarga la página con las coordenadas en
 * la URL.
 *
 * La ubicación va en la URL a propósito. Así el orden por cercanía lo calcula
 * el servidor —el navegador no descarga todos los puntos para ordenarlos—, y el
 * enlace se puede compartir: "mira, estos son los que te quedan cerca".
 *
 * Las coordenadas no se guardan en ninguna parte: viven en la barra de
 * direcciones mientras dure la búsqueda.
 */
export function BotonUbicacion({ activa }: { activa: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const irCon = (cambios: (p: URLSearchParams) => void) => {
    const p = new URLSearchParams(params.toString());
    cambios(p);
    const cadena = p.toString();
    router.push(cadena ? `/?${cadena}` : '/');
  };

  if (activa) {
    return (
      <button
        type="button"
        onClick={() => irCon((p) => {
          p.delete('lat');
          p.delete('lng');
        })}
        className="text-sm underline underline-offset-4"
      >
        Dejar de ordenar por cercanía
      </button>
    );
  }

  const pedirUbicacion = () => {
    if (!navigator.geolocation) {
      setError('Tu navegador no puede darnos la ubicación. Filtra por municipio.');
      return;
    }
    setBuscando(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        irCon((p) => {
          p.set('lat', coords.latitude.toFixed(5));
          p.set('lng', coords.longitude.toFixed(5));
        });
        setBuscando(false);
      },
      (fallo) => {
        setBuscando(false);
        setError(
          fallo.code === fallo.PERMISSION_DENIED
            ? 'No nos diste permiso de ubicación. Puedes filtrar por municipio.'
            : 'No pudimos obtener tu ubicación. Puedes filtrar por municipio.',
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  };

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={pedirUbicacion}
        disabled={buscando}
        className="self-start rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60 dark:bg-emerald-600"
      >
        {buscando ? 'Buscando tu ubicación…' : 'Ver los más cercanos a mí'}
      </button>
      {error && <p className="text-sm text-amber-800 dark:text-amber-300">{error}</p>}
    </div>
  );
}
