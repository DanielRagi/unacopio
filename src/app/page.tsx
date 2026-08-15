import Link from 'next/link';
import { BotonUbicacion } from '@/components/BotonUbicacion';
import { Encabezado } from '@/components/Encabezado';
import { FiltroUbicacion } from '@/components/FiltroUbicacion';
import { PieDePagina } from '@/components/PieDePagina';
import { TarjetaPunto } from '@/components/TarjetaPunto';
import { Necesidades } from '@/components/Necesidades';
import {
  buscarPuntos, listarCategorias, listarDepartamentos, listarMunicipios, necesidadesDe,
} from '@/lib/datos';
import { aQueryString, leerFiltros } from '@/lib/filtros';

export default async function Portada({ searchParams }: PageProps<'/'>) {
  const filtros = leerFiltros(await searchParams);
  const porCercania = filtros.lat !== undefined;

  const [departamentos, municipios, categorias, resultados, necesidades] = await Promise.all([
    listarDepartamentos(),
    filtros.dep ? listarMunicipios(filtros.dep) : Promise.resolve([]),
    listarCategorias(),
    buscarPuntos({
      departamento: filtros.dep,
      municipio: filtros.mun,
      categoria: filtros.cat,
      lat: filtros.lat,
      lng: filtros.lng,
      // Con ubicación se busca en un radio amplio: en una emergencia la gente
      // se mueve más lejos de lo normal con tal de entregar algo.
      radioM: 50000,
    }),
    // Sin ubicación no se calcula: "lo que más falta a 50 km a la redonda" no
    // es una pregunta que alguien se haga.
    porCercania
      ? Promise.resolve([])
      : necesidadesDe({ departamento: filtros.dep, municipio: filtros.mun }),
  ]);

  const nombreLugar =
    (filtros.mun && municipios.find((m) => m.codigo === filtros.mun)?.nombre) ??
    (filtros.dep && departamentos.find((d) => d.codigo === filtros.dep)?.nombre) ??
    'Colombia';

  const nombreCategoria = categorias.find((c) => c.slug === filtros.cat)?.nombre;

  return (
    <>
      <Encabezado />

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-7 px-5 py-8">
        <section className="flex flex-col gap-3">
          <h1 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            ¿Dónde llevar tu donación?
          </h1>
          <p className="text-black/70 dark:text-white/70">
            Busca el punto de acopio más cercano y mira qué necesitan antes de
            salir de la casa. Si estás recogiendo donaciones,{' '}
            <Link href="/registrar" className="font-medium underline underline-offset-4">
              registra tu punto
            </Link>
            .
          </p>
        </section>

        <BotonUbicacion activa={porCercania} />

        <FiltroUbicacion
          departamentos={departamentos}
          municipios={municipios}
          categorias={categorias}
          dep={filtros.dep}
          mun={filtros.mun}
          cat={filtros.cat}
          lat={filtros.lat !== undefined ? String(filtros.lat) : undefined}
          lng={filtros.lng !== undefined ? String(filtros.lng) : undefined}
        />

        {!filtros.cat && (
          <Necesidades
            necesidades={necesidades}
            base={`/${aQueryString(filtros)}`}
            lugar={nombreLugar}
          />
        )}

        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-medium text-black/60 dark:text-white/60">
              {resultados.length === 0
                ? 'Sin puntos publicados'
                : `${resultados.length} ${resultados.length === 1 ? 'punto' : 'puntos'}`}
              {porCercania ? ' cerca de ti' : ` en ${nombreLugar}`}
              {nombreCategoria && ` que reciben ${nombreCategoria.toLowerCase()}`}
            </h2>
            {resultados.length > 0 && (
              <Link
                href={`/mapa${aQueryString(filtros)}`}
                className="text-sm font-medium underline underline-offset-4"
              >
                Verlos en el mapa
              </Link>
            )}
          </div>

          {resultados.length === 0 ? (
            <div className="flex flex-col items-start gap-4 rounded-xl border border-dashed border-black/20 p-6 dark:border-white/25">
              <p className="text-black/70 dark:text-white/70">
                {porCercania
                  ? 'No hay puntos publicados a menos de 50 km de donde estás. Prueba buscando por departamento.'
                  : 'Todavía no hay puntos publicados aquí. Si conoces uno, o estás recogiendo donaciones, regístralo y lo revisamos para publicarlo.'}
              </p>
              <Link
                href="/registrar"
                className="rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white dark:bg-emerald-600"
              >
                Registrar un punto
              </Link>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {resultados.map(({ punto, metros }) => (
                <TarjetaPunto key={punto.id} punto={punto} metros={metros ?? undefined} />
              ))}
            </ul>
          )}
        </section>
      </main>

      <PieDePagina />
    </>
  );
}
