'use client';

import dynamic from 'next/dynamic';
import type { PuntoMapa } from './MapaPuntos';

// Leaflet toca `window` al importarse, así que no puede renderizarse en el
// servidor. Este envoltorio existe solo para poder pedirlo con ssr:false, que
// únicamente se permite desde un componente de cliente.
const MapaPuntos = dynamic(() => import('./MapaPuntos'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-black/[0.03] dark:bg-white/5">
      <p className="text-sm text-black/50 dark:text-white/50">Cargando el mapa…</p>
    </div>
  ),
});

export function VistaMapa(props: {
  puntos: PuntoMapa[];
  centro: { lat: number; lng: number } | null;
  ubicacionUsuario: { lat: number; lng: number } | null;
}) {
  return <MapaPuntos {...props} />;
}
