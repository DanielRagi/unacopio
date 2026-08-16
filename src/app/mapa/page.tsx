import type { Metadata } from 'next';
import Link from 'next/link';
import { Encabezado } from '@/components/Encabezado';
import type { PuntoMapa } from '@/components/MapaPuntos';
import { VistaMapa } from '@/components/VistaMapa';
import { buscarPuntos, centroideMunicipio, municipioDeUbicacion } from '@/lib/datos';
import { aQueryString, leerFiltros } from '@/lib/filtros';
import { ubicacionPorIp } from '@/lib/ubicacion';

export const metadata: Metadata = {
  title: 'Mapa de puntos de acopio',
  description: 'Los puntos de acopio publicados, ubicados en el mapa.',
};

export default async function PaginaMapa({ searchParams }: PageProps<'/mapa'>) {
  const params = await searchParams;
  const leidos = leerFiltros(params);

  // Igual que en la portada: si nadie pidió nada, el mapa abre en la ciudad de
  // quien entra. Un mapa de Colombia entera al 6 de zoom no le sirve a nadie.
  const sinFiltros =
    params.pais === undefined && !leidos.dep && !leidos.mun && leidos.lat === undefined;
  const aproximada = sinFiltros ? await ubicacionPorIp() : null;
  const detectada = aproximada ? await municipioDeUbicacion(aproximada.ciudad, aproximada.lat, aproximada.lng) : null;

  const filtros = detectada
    ? { ...leidos, dep: detectada.departamento_codigo, mun: detectada.codigo }
    : leidos;

  const [resultados, centroide] = await Promise.all([
    buscarPuntos({
      departamento: filtros.dep,
      municipio: filtros.mun,
      categoria: filtros.cat,
      lat: filtros.lat,
      lng: filtros.lng,
      radioM: 50000,
      // El mapa aguanta más marcadores que una lista: cada punto que falte es
      // una cuadra que alguien no sabe que tiene al lado.
      limite: 300,
    }),
    // Sin GPS, el centroide DANE del municipio es a dónde apuntar el mapa.
    filtros.mun ? centroideMunicipio(filtros.mun) : Promise.resolve(null),
  ]);

  const ubicacionUsuario =
    filtros.lat !== undefined && filtros.lng !== undefined
      ? { lat: filtros.lat, lng: filtros.lng }
      : null;

  const puntos: PuntoMapa[] = resultados.map(({ punto, metros }) => ({
    id: punto.id,
    nombre: punto.nombre,
    lat: punto.lat,
    lng: punto.lng,
    municipio: punto.municipio,
    direccion: punto.direccion,
    horario: punto.horario_texto,
    urgentes: punto.categorias.filter((c) => c.nivel === 'alta').map((c) => c.nombre),
    oficial: punto.entidad_oficial,
    metros,
  }));

  return (
    <>
      <Encabezado />

      <main className="flex flex-1 flex-col">
        <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-3 px-5 py-4">
          <p className="text-sm text-black/70 dark:text-white/70">
            {puntos.length === 0
              ? 'No hay puntos publicados con estos filtros.'
              : `${puntos.length} ${puntos.length === 1 ? 'punto' : 'puntos'} en el mapa`}
            {detectada && (
              <>
                {' '}en <strong>{detectada.nombre}</strong> ·{' '}
                <Link href="/mapa?pais=1" className="underline underline-offset-4">
                  todo el país
                </Link>
              </>
            )}
          </p>
          <Link
            href={`/${aQueryString(filtros)}`}
            className="text-sm font-medium underline underline-offset-4"
          >
            Volver a la lista
          </Link>
        </div>

        {/* Alto fijo: el mapa necesita saber cuánto mide, y en móvil hay que
            dejarle casi toda la pantalla para que sirva de algo. */}
        <div className="h-[70vh] min-h-[420px] w-full border-y border-black/10 dark:border-white/15">
          <VistaMapa
            puntos={puntos}
            centro={ubicacionUsuario ?? centroide}
            ubicacionUsuario={ubicacionUsuario}
          />
        </div>

        <div className="mx-auto w-full max-w-3xl px-5 py-4">
          <p className="text-sm text-black/60 dark:text-white/60">
            Toca un marcador para ver qué reciben y abrir la ruta en Google Maps
            o Waze. Los puntos en verde son de entidades oficiales.
          </p>
        </div>
      </main>
    </>
  );
}
