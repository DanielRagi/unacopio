'use client';

import 'leaflet/dist/leaflet.css';
import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';

const CENTRO_COLOMBIA: [number, number] = [4.5709, -74.2973];

/**
 * Selector de ubicación: el pin va fijo en el centro de la pantalla y lo que se
 * mueve es el mapa.
 *
 * Es el patrón de las apps de domicilios, y se eligió por una razón práctica:
 * arrastrar un marcador de 20 píxeles con el dedo, en un bus, es difícil; mover
 * el mapa entero no. Además nos ahorra los iconos de Leaflet, que se rompen con
 * los bundlers porque vienen referenciados como rutas de imagen.
 */

function AvisarCentro({ alMover }: { alMover: (lat: number, lng: number) => void }) {
  const mapa = useMapEvents({
    moveend: () => {
      const centro = mapa.getCenter();
      alMover(centro.lat, centro.lng);
    },
  });
  return null;
}

/**
 * Mueve el mapa cuando cambia el municipio elegido o cuando la persona pide su
 * ubicación. Son dos efectos separados porque son dos disparadores distintos, y
 * así el último en cambiar es el que manda, sin tener que sincronizar estados.
 *
 * Las dependencias son los números y no el objeto, a propósito. Con el objeto,
 * un padre que pasara `{lat, lng}` como literal —cosa perfectamente razonable de
 * escribir— entraba en bucle: cada render creaba una referencia nueva, el efecto
 * se disparaba, `setView` emitía `moveend`, el `moveend` avisaba al padre, el
 * padre re-renderizaba y otra vez. Desde afuera no parecía un bucle sino una
 * página muerta. Comparar valores en vez de identidades cierra esa puerta para
 * cualquiera que use este componente después.
 */
function Recentrar({
  municipio,
  usuario,
}: {
  municipio: { lat: number; lng: number } | null;
  usuario: [number, number] | null;
}) {
  const mapa = useMap();
  const lat = municipio?.lat ?? null;
  const lng = municipio?.lng ?? null;
  const [latUsuario, lngUsuario] = usuario ?? [null, null];

  useEffect(() => {
    if (lat !== null && lng !== null) mapa.setView([lat, lng], Math.max(mapa.getZoom(), 15));
  }, [lat, lng, mapa]);

  useEffect(() => {
    if (latUsuario !== null && lngUsuario !== null) mapa.setView([latUsuario, lngUsuario], 17);
  }, [latUsuario, lngUsuario, mapa]);

  return null;
}

export default function MapaSelector({
  centroMunicipio,
  alCambiar,
}: {
  centroMunicipio: { lat: number; lng: number } | null;
  alCambiar: (lat: number, lng: number) => void;
}) {
  const [buscandoUbicacion, setBuscandoUbicacion] = useState(false);
  const [ubicacionUsuario, setUbicacionUsuario] = useState<[number, number] | null>(null);

  const usarMiUbicacion = () => {
    if (!navigator.geolocation) return;
    setBuscandoUbicacion(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setUbicacionUsuario([coords.latitude, coords.longitude]);
        alCambiar(coords.latitude, coords.longitude);
        setBuscandoUbicacion(false);
      },
      () => setBuscandoUbicacion(false),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="relative h-72 overflow-hidden rounded-xl border border-black/15 dark:border-white/20">
        <MapContainer
          center={centroMunicipio ? [centroMunicipio.lat, centroMunicipio.lng] : CENTRO_COLOMBIA}
          zoom={centroMunicipio ? 14 : 6}
          scrollWheelZoom
          className="h-full w-full"
        >
          <TileLayer
            attribution='&copy; colaboradores de <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
          />
          <AvisarCentro alMover={alCambiar} />
          <Recentrar municipio={centroMunicipio} usuario={ubicacionUsuario} />
        </MapContainer>

        {/* El pin. `pointer-events-none` para que no estorbe al arrastrar. */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 z-[1000] -translate-x-1/2 -translate-y-full"
        >
          <svg width="34" height="46" viewBox="0 0 34 46" fill="none">
            <path
              d="M17 45C17 45 32 27.5 32 17C32 8.7 25.3 2 17 2S2 8.7 2 17c0 10.5 15 28 15 28z"
              fill="#047857"
              stroke="white"
              strokeWidth="3"
            />
            <circle cx="17" cy="17" r="5.5" fill="white" />
          </svg>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={usarMiUbicacion}
          className="rounded-lg border border-black/15 px-3 py-2 text-sm font-medium dark:border-white/20"
        >
          {buscandoUbicacion ? 'Buscando…' : 'Usar mi ubicación'}
        </button>
        <p className="text-sm text-black/60 dark:text-white/60">
          Mueve el mapa hasta que el pin quede sobre la entrada del punto.
        </p>
      </div>
    </div>
  );
}
