'use client';

import 'leaflet/dist/leaflet.css';
import 'react-leaflet-cluster/dist/assets/MarkerCluster.css';
import 'react-leaflet-cluster/dist/assets/MarkerCluster.Default.css';

import L from 'leaflet';
import Link from 'next/link';
import { useEffect, useMemo } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';

export interface PuntoMapa {
  id: string;
  nombre: string;
  lat: number;
  lng: number;
  municipio: string;
  direccion: string;
  horario: string;
  urgentes: string[];
  oficial: boolean;
  metros: number | null;
}

const CENTRO_COLOMBIA: [number, number] = [4.5709, -74.2973];

/**
 * Iconos dibujados con HTML en vez de imágenes.
 *
 * Los iconos por defecto de Leaflet vienen como rutas a PNG que los bundlers
 * reescriben, y terminan saliendo rotos. Un `divIcon` no depende de ningún
 * archivo, y de paso deja marcar en verde los puntos de entidades oficiales.
 */
function icono(oficial: boolean) {
  const color = oficial ? '#047857' : '#1f2937';
  return L.divIcon({
    className: '',
    html: `<svg width="26" height="36" viewBox="0 0 34 46" xmlns="http://www.w3.org/2000/svg">
             <path d="M17 45C17 45 32 27.5 32 17C32 8.7 25.3 2 17 2S2 8.7 2 17c0 10.5 15 28 15 28z"
                   fill="${color}" stroke="white" stroke-width="3"/>
             <circle cx="17" cy="17" r="5.5" fill="white"/>
           </svg>`,
    iconSize: [26, 36],
    iconAnchor: [13, 36],
    popupAnchor: [0, -34],
  });
}

const iconoUsuario = () =>
  L.divIcon({
    className: '',
    html: `<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
             <circle cx="10" cy="10" r="7" fill="#2563eb" stroke="white" stroke-width="3"/>
           </svg>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });

/**
 * Encuadra el mapa sobre lo que hay. Vale más que un centro fijo: si el filtro
 * dejó tres puntos en un municipio, se ven los tres, no un país entero vacío.
 */
function AjustarVista({
  puntos,
  centro,
}: {
  puntos: PuntoMapa[];
  centro: { lat: number; lng: number } | null;
}) {
  const mapa = useMap();

  useEffect(() => {
    if (puntos.length > 0) {
      const limites = L.latLngBounds(puntos.map((p) => [p.lat, p.lng] as [number, number]));
      mapa.fitBounds(limites, { padding: [40, 40], maxZoom: 16 });
    } else if (centro) {
      mapa.setView([centro.lat, centro.lng], 13);
    }
  }, [puntos, centro, mapa]);

  return null;
}

export default function MapaPuntos({
  puntos,
  centro,
  ubicacionUsuario,
}: {
  puntos: PuntoMapa[];
  centro: { lat: number; lng: number } | null;
  ubicacionUsuario: { lat: number; lng: number } | null;
}) {
  const iconos = useMemo(
    () => ({ oficial: icono(true), normal: icono(false), usuario: iconoUsuario() }),
    [],
  );

  return (
    <MapContainer
      center={centro ? [centro.lat, centro.lng] : CENTRO_COLOMBIA}
      zoom={centro ? 13 : 6}
      scrollWheelZoom
      className="h-full w-full"
    >
      <TileLayer
        attribution='&copy; colaboradores de <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />

      <AjustarVista puntos={puntos} centro={centro} />

      {ubicacionUsuario && (
        <Marker
          position={[ubicacionUsuario.lat, ubicacionUsuario.lng]}
          icon={iconos.usuario}
        >
          <Popup>Estás aquí</Popup>
        </Marker>
      )}

      <MarkerClusterGroup chunkedLoading maxClusterRadius={50}>
        {puntos.map((punto) => (
          <Marker
            key={punto.id}
            position={[punto.lat, punto.lng]}
            icon={punto.oficial ? iconos.oficial : iconos.normal}
          >
            <Popup>
              <span className="block text-sm font-semibold">{punto.nombre}</span>
              <span className="block text-xs opacity-70">
                {punto.municipio}
                {punto.metros !== null && ` · a ${formatearDistancia(punto.metros)}`}
              </span>
              <span className="mt-1 block text-xs">{punto.direccion}</span>
              <span className="block text-xs opacity-70">{punto.horario}</span>
              {punto.urgentes.length > 0 && (
                <span className="mt-1 block text-xs">
                  <strong>Necesitan:</strong> {punto.urgentes.slice(0, 3).join(', ')}
                </span>
              )}
              <Link href={`/punto/${punto.id}`} className="mt-1 block text-xs font-semibold">
                Ver la ficha completa
              </Link>
            </Popup>
          </Marker>
        ))}
      </MarkerClusterGroup>
    </MapContainer>
  );
}

function formatearDistancia(metros: number): string {
  if (metros < 1000) return `${Math.round(metros)} m`;
  return `${(metros / 1000).toFixed(1).replace('.', ',')} km`;
}
