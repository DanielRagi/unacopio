import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Encabezado } from '@/components/Encabezado';
import { Necesidades } from '@/components/Necesidades';
import { PieDePagina } from '@/components/PieDePagina';
import { TarjetaPunto } from '@/components/TarjetaPunto';
import { buscarPuntos, municipioPorSlug, necesidadesDe } from '@/lib/datos';
import { SITIO } from '@/lib/textos';

/**
 * `/acopio/medellin` — la página del municipio.
 *
 * Es la URL que se comparte. "Mira, acá está la lista de Medellín" pega mucho
 * mejor en un grupo de WhatsApp que `unacopio.co/?dep=05&mun=05001`, y el título
 * de la tarjeta de Open Graph dice el nombre del municipio, que es lo que la
 * gente alcanza a leer antes de decidir si toca.
 */

// Se renderiza en cada visita, como el resto del sitio: en una emergencia un
// punto que cerró hace diez minutos importa más que ahorrarse un render.
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: PageProps<'/acopio/[slug]'>): Promise<Metadata> {
  const { slug } = await params;
  const municipio = await municipioPorSlug(slug);
  if (!municipio) return { title: 'Municipio no encontrado' };

  const titulo = `Puntos de acopio en ${municipio.nombre}`;
  const descripcion =
    `Dónde llevar donaciones en ${municipio.nombre}, ` +
    `${municipio.departamentos?.nombre ?? ''}: dirección, horario y qué necesitan.`;

  return {
    title: titulo,
    description: descripcion,
    alternates: { canonical: `/acopio/${municipio.slug}` },
    openGraph: {
      title: `${titulo} · ${SITIO.nombre}`,
      description: descripcion,
      url: `/acopio/${municipio.slug}`,
    },
  };
}

export default async function PaginaMunicipio({ params }: PageProps<'/acopio/[slug]'>) {
  const { slug } = await params;
  const municipio = await municipioPorSlug(slug);
  if (!municipio) notFound();

  const [resultados, necesidades] = await Promise.all([
    buscarPuntos({ municipio: municipio.codigo, limite: 200 }),
    necesidadesDe({ municipio: municipio.codigo }),
  ]);

  const departamento = municipio.departamentos?.nombre ?? '';
  const filtros = `?dep=${municipio.departamento_codigo}&mun=${municipio.codigo}`;

  return (
    <>
      <Encabezado />

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-7 px-5 py-8">
        <section className="flex flex-col gap-3">
          <p className="text-sm text-black/60 dark:text-white/60">
            <Link href="/" className="underline underline-offset-4">
              Inicio
            </Link>{' '}
            · {departamento}
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            Puntos de acopio en {municipio.nombre}
          </h1>
          <p className="text-black/70 dark:text-white/70">
            {resultados.length === 0
              ? `Todavía no hay puntos publicados en ${municipio.nombre}.`
              : `${resultados.length} ${resultados.length === 1 ? 'punto publicado' : 'puntos publicados'}. Mira qué necesitan antes de salir de la casa.`}
          </p>
        </section>

        <Necesidades necesidades={necesidades} base={`/${filtros}`} lugar={municipio.nombre} />

        <div className="flex flex-wrap gap-3 text-sm">
          <Link
            href={`/mapa${filtros}`}
            className="rounded-lg border border-black/15 px-4 py-2 font-medium hover:border-black/35 dark:border-white/20 dark:hover:border-white/40"
          >
            Verlos en el mapa
          </Link>
          <Link
            href="/registrar"
            className="rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white dark:bg-emerald-600"
          >
            Registrar un punto
          </Link>
        </div>

        {resultados.length === 0 ? (
          <p className="rounded-xl border border-dashed border-black/20 p-6 text-black/70 dark:border-white/25 dark:text-white/70">
            Si conoces un punto de acopio en {municipio.nombre}, o estás
            recogiendo donaciones, regístralo y lo revisamos para publicarlo.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {resultados.map(({ punto }) => (
              <TarjetaPunto key={punto.id} punto={punto} />
            ))}
          </ul>
        )}

        <p className="text-sm text-black/60 dark:text-white/60">
          ¿Vas a reutilizar esta lista?{' '}
          <Link href="/datos" className="underline underline-offset-4">
            Descárgala en CSV o JSON
          </Link>
          .
        </p>
      </main>

      <PieDePagina />
    </>
  );
}
