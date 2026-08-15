import Link from 'next/link';
import type { Departamento, Municipio } from '@/lib/tipos';

/**
 * Filtro por departamento y municipio.
 *
 * Es un `<form method="get">` a propósito: funciona sin una línea de JavaScript,
 * que es la diferencia entre servir o no servir en un celular viejo con señal
 * mala. Se llena en dos pasos —primero departamento, después municipio— para no
 * mandar los 1.122 municipios en cada carga.
 */
export function FiltroUbicacion({
  departamentos,
  municipios,
  dep,
  mun,
}: {
  departamentos: Departamento[];
  municipios: Municipio[];
  dep?: string;
  mun?: string;
}) {
  const claseSelect =
    'w-full rounded-lg border border-black/15 bg-transparent px-3 py-2.5 text-base dark:border-white/20';

  return (
    <form method="get" action="/" className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="flex flex-1 flex-col gap-1.5">
          <span className="text-sm font-medium">Departamento</span>
          <select name="dep" defaultValue={dep ?? ''} className={claseSelect}>
            <option value="">Todo el país</option>
            {departamentos.map((d) => (
              <option key={d.codigo} value={d.codigo}>{d.nombre}</option>
            ))}
          </select>
        </label>

        {dep && (
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="text-sm font-medium">Municipio</span>
            <select name="mun" defaultValue={mun ?? ''} className={claseSelect}>
              <option value="">Todo el departamento</option>
              {municipios.map((m) => (
                <option key={m.codigo} value={m.codigo}>{m.nombre}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          className="rounded-lg bg-black px-5 py-2.5 text-sm font-semibold text-white dark:bg-white dark:text-black"
        >
          Buscar
        </button>
        {(dep || mun) && (
          <Link href="/" className="text-sm underline underline-offset-4">
            Ver todo el país
          </Link>
        )}
      </div>
    </form>
  );
}
