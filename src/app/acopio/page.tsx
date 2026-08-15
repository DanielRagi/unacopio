import type { Metadata } from 'next';
import Link from 'next/link';
import { Encabezado } from '@/components/Encabezado';
import { PieDePagina } from '@/components/PieDePagina';
import { municipiosConPuntos } from '@/lib/datos';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Municipios con puntos de acopio',
  description:
    'Lista de municipios de Colombia donde hay puntos de acopio publicados en UnAcopio.',
  alternates: { canonical: '/acopio' },
};

/** El índice de `/acopio/[slug]`: solo municipios que ya tienen algo que mostrar. */
export default async function IndiceMunicipios() {
  const municipios = await municipiosConPuntos();

  // Agrupados por departamento, que es como la gente busca su pueblo.
  const porDepartamento = new Map<string, typeof municipios>();
  for (const m of municipios) {
    const grupo = porDepartamento.get(m.departamento) ?? [];
    grupo.push(m);
    porDepartamento.set(m.departamento, grupo);
  }

  const departamentos = [...porDepartamento.entries()].sort(([a], [b]) => a.localeCompare(b, 'es'));

  return (
    <>
      <Encabezado />

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-7 px-5 py-8">
        <section className="flex flex-col gap-3">
          <h1 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            ¿En qué municipios hay puntos?
          </h1>
          <p className="text-black/70 dark:text-white/70">
            Cada municipio tiene su propia página para compartir. Si el tuyo no
            aparece,{' '}
            <Link href="/registrar" className="font-medium underline underline-offset-4">
              registra el primer punto
            </Link>
            .
          </p>
        </section>

        {departamentos.length === 0 ? (
          <p className="rounded-xl border border-dashed border-black/20 p-6 text-black/70 dark:border-white/25 dark:text-white/70">
            Todavía no hay puntos publicados en ningún municipio.
          </p>
        ) : (
          <div className="flex flex-col gap-6">
            {departamentos.map(([departamento, lista]) => (
              <section key={departamento} className="flex flex-col gap-3">
                <h2 className="text-sm font-semibold text-black/60 dark:text-white/60">
                  {departamento}
                </h2>
                <ul className="flex flex-wrap gap-2">
                  {lista.map((m) => (
                    <li key={m.codigo}>
                      <Link
                        href={`/acopio/${m.slug}`}
                        className="inline-flex items-baseline gap-1.5 rounded-lg border border-black/12 px-3 py-2 text-sm hover:border-black/35 dark:border-white/18 dark:hover:border-white/40"
                      >
                        <span className="font-medium">{m.nombre}</span>
                        <span className="text-xs text-black/55 dark:text-white/55">
                          {m.puntos}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </main>

      <PieDePagina />
    </>
  );
}
