import Link from 'next/link';
import { BotonUbicacion } from '@/components/BotonUbicacion';
import { Encabezado } from '@/components/Encabezado';
import { FiltroUbicacion } from '@/components/FiltroUbicacion';
import { Necesidades } from '@/components/Necesidades';
import { PieDePagina } from '@/components/PieDePagina';
import { TarjetaPunto } from '@/components/TarjetaPunto';
import {
  buscarPuntos, listarCategorias, listarDepartamentos, listarMunicipios,
  municipioDeUbicacion, necesidadesDe,
} from '@/lib/datos';
import { aQueryString, leerFiltros, type FiltrosUrl } from '@/lib/filtros';
import { EMERGENCIA } from '@/lib/textos';
import { ubicacionPorIp } from '@/lib/ubicacion';

export default async function Portada({ searchParams }: PageProps<'/'>) {
  const params = await searchParams;
  const filtros = leerFiltros(params);

  /*
   * Si la persona no pidió nada en particular, se abre en su ciudad.
   *
   * Antes la portada arrancaba mostrando Colombia entera, y eso quería decir
   * que alguien en Manizales veía una lista donde su municipio quedaba de
   * decimoquinto. La ubicación sale de la IP, que Vercel resuelve en el borde:
   * no pide permiso, no necesita JavaScript y llega a tiempo para renderizar en
   * el servidor.
   *
   * Solo aplica cuando la URL viene limpia. Un filtro puesto a mano —o un enlace
   * compartido por WhatsApp— manda siempre: nada peor que compartir "los puntos
   * de Quibdó" y que al otro le abra en Bogotá.
   *
   * `?pais=1` es la forma de decir "no adivines". Tiene que ser un parámetro
   * explícito y no simplemente la ausencia de filtros: si "ver todo el país"
   * llevara a `/`, la detección se volvería a disparar y el botón no haría nada.
   */
  const quierePais = params.pais !== undefined;
  const sinFiltros =
    !quierePais && !filtros.dep && !filtros.mun && filtros.lat === undefined;
  const ipAproximada = sinFiltros ? await ubicacionPorIp() : null;
  const ciudadDetectada = ipAproximada
    ? await municipioDeUbicacion(ipAproximada.ciudad, ipAproximada.lat, ipAproximada.lng)
    : null;

  const activos: FiltrosUrl = ciudadDetectada
    ? { ...filtros, dep: ciudadDetectada.departamento_codigo, mun: ciudadDetectada.codigo }
    : filtros;

  const porCercania = activos.lat !== undefined;

  const [departamentos, municipios, categorias, resultados, necesidades] = await Promise.all([
    listarDepartamentos(),
    activos.dep ? listarMunicipios(activos.dep) : Promise.resolve([]),
    listarCategorias(),
    buscarPuntos({
      departamento: activos.dep,
      municipio: activos.mun,
      categoria: activos.cat,
      lat: activos.lat,
      lng: activos.lng,
      // Con ubicación se busca en un radio amplio: en una emergencia la gente
      // se mueve más lejos de lo normal con tal de entregar algo.
      radioM: 50000,
    }),
    porCercania
      ? Promise.resolve([])
      : necesidadesDe({ departamento: activos.dep, municipio: activos.mun }),
  ]);

  const nombreLugar =
    (activos.mun && municipios.find((m) => m.codigo === activos.mun)?.nombre) ??
    (activos.dep && departamentos.find((d) => d.codigo === activos.dep)?.nombre) ??
    'Colombia';

  const nombreCategoria = categorias.find((c) => c.slug === activos.cat)?.nombre;

  // Si la persona pidió ver el país entero, los enlaces de esta página tienen
  // que arrastrar esa decisión. Si no, tocar una categoría la devolvería a su
  // ciudad, que es exactamente lo que acababa de rechazar.
  const base = aQueryString(activos);
  const consulta =
    quierePais && !activos.dep && !activos.mun
      ? (base ? `${base}&pais=1` : '?pais=1')
      : base;

  return (
    <>
      <Encabezado />

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-5 py-8">
        <section className="flex flex-col gap-4">
          <h1 className="text-[2rem] leading-[1.1] font-bold tracking-tight text-balance sm:text-[2.6rem]">
            ¿Dónde llevar tu donación
            <span className="text-emerald-700 dark:text-emerald-400"> en Colombia</span>?
          </h1>
          <p className="max-w-prose text-[1.05rem] leading-relaxed text-black/70 dark:text-white/70">
            Encuentra el punto de acopio más cercano y mira qué necesitan{' '}
            <strong className="font-semibold text-black dark:text-white">
              antes de salir de casa
            </strong>
            . {EMERGENCIA.llamado}
          </p>
        </section>

        {/*
          El mapa, de primero y grande.
          Es lo que la mayoría viene a hacer —"¿cuál me queda cerca?"— y hasta
          ahora estaba escondido en un enlace de texto debajo de la lista.
        */}
        <Link
          href={`/mapa${consulta}`}
          className="group relative flex items-center gap-4 overflow-hidden rounded-2xl border border-emerald-700/25 bg-gradient-to-br from-emerald-700 to-emerald-800 p-5 text-white shadow-sm transition-shadow hover:shadow-md sm:p-6 dark:border-emerald-400/25 dark:from-emerald-700 dark:to-emerald-900"
        >
          <span aria-hidden className="pointer-events-none absolute -top-8 -right-6 opacity-15">
            <TrazoDeMapa />
          </span>
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-white/15 sm:size-14">
            <IconoMapa />
          </span>
          <span className="flex flex-col gap-0.5">
            <span className="text-lg font-bold tracking-tight sm:text-xl">
              Ver el mapa de puntos
            </span>
            <span className="text-sm text-white/80">
              {resultados.length > 0
                ? `${resultados.length} ${resultados.length === 1 ? 'punto' : 'puntos'} en ${nombreLugar} · toca un pin y te lleva`
                : 'Explora el mapa y encuentra el más cercano'}
            </span>
          </span>
          <span
            aria-hidden
            className="ml-auto hidden text-2xl transition-transform group-hover:translate-x-1 sm:block"
          >
            →
          </span>
        </Link>

        <div className="flex flex-col gap-3">
          <BotonUbicacion activa={porCercania} />

          {ciudadDetectada && (
            <p className="text-sm text-black/60 dark:text-white/60">
              Te estamos mostrando{' '}
              <strong className="font-semibold text-black dark:text-white">
                {ciudadDetectada.nombre}
              </strong>
              , por tu conexión.{' '}
              <Link href="/?pais=1" className="underline underline-offset-4">
                Ver todo el país
              </Link>
            </p>
          )}
        </div>

        <FiltroUbicacion
          departamentos={departamentos}
          municipios={municipios}
          categorias={categorias}
          dep={activos.dep}
          mun={activos.mun}
          cat={activos.cat}
          lat={activos.lat !== undefined ? String(activos.lat) : undefined}
          lng={activos.lng !== undefined ? String(activos.lng) : undefined}
        />

        {!activos.cat && (
          <Necesidades necesidades={necesidades} base={`/${consulta}`} lugar={nombreLugar} />
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
          </div>

          {resultados.length === 0 ? (
            <div className="flex flex-col items-start gap-4 rounded-2xl border border-dashed border-black/20 p-6 dark:border-white/25">
              <p className="text-black/70 dark:text-white/70">
                {porCercania
                  ? 'No hay puntos publicados a menos de 50 km de donde estás. Prueba buscando por departamento.'
                  : `Todavía no hay puntos publicados en ${nombreLugar}. Si conoces uno, o estás recogiendo donaciones, regístralo y lo revisamos para publicarlo.`}
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/registrar"
                  className="rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white dark:bg-emerald-600"
                >
                  Registrar un punto
                </Link>
                {(activos.mun || activos.dep) && (
                  <Link
                    href="/?pais=1"
                    className="rounded-lg border border-black/15 px-5 py-2.5 text-sm font-medium dark:border-white/20"
                  >
                    Buscar en todo el país
                  </Link>
                )}
              </div>
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

function IconoMapa() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-7 sm:size-8" aria-hidden>
      <path
        d="M9 3 3 5.4v15.2L9 18l6 2.6 6-2.4V3l-6 2.4L9 3Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M9 3v15M15 5.4v15.2" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

/** Adorno del fondo: curvas que sugieren un mapa sin dibujar ninguno real. */
function TrazoDeMapa() {
  return (
    <svg width="200" height="150" viewBox="0 0 200 150" fill="none" aria-hidden>
      <path d="M-10 40C40 20 60 70 110 50s70 10 110-10" stroke="white" strokeWidth="10" />
      <path d="M-10 90C40 70 60 120 110 100s70 10 110-10" stroke="white" strokeWidth="10" />
      <circle cx="120" cy="52" r="14" stroke="white" strokeWidth="8" />
    </svg>
  );
}
