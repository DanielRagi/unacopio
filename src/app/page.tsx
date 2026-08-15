import Link from 'next/link';
import { Encabezado } from '@/components/Encabezado';
import { FiltroUbicacion } from '@/components/FiltroUbicacion';
import { PieDePagina } from '@/components/PieDePagina';
import { TarjetaPunto } from '@/components/TarjetaPunto';
import { listarDepartamentos, listarMunicipios, listarPuntos } from '@/lib/datos';

function primerValor(v: string | string[] | undefined): string | undefined {
  const valor = Array.isArray(v) ? v[0] : v;
  return valor && valor.trim() !== '' ? valor : undefined;
}

export default async function Portada({ searchParams }: PageProps<'/'>) {
  const params = await searchParams;

  let dep = primerValor(params.dep);
  let mun = primerValor(params.mun);

  // Los códigos DANE encajan: los 5 dígitos del municipio empiezan por los 2 del
  // departamento. Eso deja resolver solo el caso de quien cambia de departamento
  // sin cambiar el municipio, que si no filtraría por un municipio de otro lado.
  if (mun && dep && !mun.startsWith(dep)) mun = undefined;
  if (mun && !dep) dep = mun.slice(0, 2);

  const [departamentos, municipios, puntos] = await Promise.all([
    listarDepartamentos(),
    dep ? listarMunicipios(dep) : Promise.resolve([]),
    listarPuntos({ departamento: dep, municipio: mun }),
  ]);

  const nombreLugar =
    (mun && municipios.find((m) => m.codigo === mun)?.nombre) ??
    (dep && departamentos.find((d) => d.codigo === dep)?.nombre) ??
    'Colombia';

  return (
    <>
      <Encabezado />

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-5 py-8">
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

        <FiltroUbicacion
          departamentos={departamentos}
          municipios={municipios}
          dep={dep}
          mun={mun}
        />

        <section className="flex flex-col gap-4">
          <h2 className="text-sm font-medium text-black/60 dark:text-white/60">
            {puntos.length === 0
              ? `Sin puntos publicados en ${nombreLugar}`
              : `${puntos.length} ${puntos.length === 1 ? 'punto' : 'puntos'} en ${nombreLugar}`}
          </h2>

          {puntos.length === 0 ? (
            <div className="flex flex-col items-start gap-4 rounded-xl border border-dashed border-black/20 p-6 dark:border-white/25">
              <p className="text-black/70 dark:text-white/70">
                Todavía no hay puntos publicados aquí. Si conoces uno, o estás
                recogiendo donaciones, regístralo y lo revisamos para publicarlo.
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
              {puntos.map((punto) => (
                <TarjetaPunto key={punto.id} punto={punto} />
              ))}
            </ul>
          )}
        </section>
      </main>

      <PieDePagina />
    </>
  );
}
