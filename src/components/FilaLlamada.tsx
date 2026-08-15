import Link from 'next/link';
import { registrarLlamada } from '@/app/admin/acciones';
import { enlaceLlamada } from '@/lib/enlaces';
import { haceCuanto } from '@/lib/textos';
import type { PuntoPorLlamar } from '@/lib/datos';

/**
 * Una entrada de la ronda de llamadas.
 *
 * Está armada para usarse con el teléfono en la otra mano: el número es lo más
 * grande de la fila y marca de un toque, y los botones son las cuatro
 * respuestas que de verdad da la gente. Nada de formularios largos.
 */
export function FilaLlamada({ punto }: { punto: PuntoPorLlamar }) {
  return (
    <li className="flex flex-col gap-3 rounded-xl border border-black/10 p-4 dark:border-white/15">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span
            className={`rounded-full px-2 py-0.5 font-medium ${
              punto.ultima_verificacion
                ? 'bg-black/10 dark:bg-white/15'
                : 'bg-amber-500/25 text-amber-900 dark:text-amber-200'
            }`}
          >
            {punto.ultima_verificacion
              ? `Verificado ${haceCuanto(punto.ultima_verificacion)}`
              : 'Nunca verificado'}
          </span>
          {punto.estado === 'lleno' && (
            <span className="rounded-full bg-amber-500/25 px-2 py-0.5 font-medium text-amber-900 dark:text-amber-200">
              Marcado lleno
            </span>
          )}
          {punto.intentos_fallidos > 0 && (
            <span className="rounded-full bg-red-500/15 px-2 py-0.5 font-medium text-red-800 dark:text-red-300">
              {punto.intentos_fallidos} sin contestar
            </span>
          )}
        </div>

        <Link href={`/punto/${punto.id}`} className="font-semibold underline underline-offset-4">
          {punto.nombre}
        </Link>
        <p className="text-sm text-black/60 dark:text-white/60">
          {punto.municipios?.nombre}, {punto.departamentos?.nombre} ·{' '}
          {punto.responsable_nombre}
        </p>
      </div>

      <a
        href={enlaceLlamada(punto.telefono)}
        className="self-start text-2xl font-bold tracking-tight underline underline-offset-4"
      >
        {punto.telefono}
      </a>

      <div className="flex flex-wrap gap-2 border-t border-black/10 pt-3 dark:border-white/15">
        <Boton id={punto.id} resultado="sigue" tono="principal">Siguen recibiendo</Boton>
        <Boton id={punto.id} resultado="lleno">Están llenos</Boton>
        <Boton id={punto.id} resultado="cerrado" tono="peligro">Ya cerraron</Boton>
        <Boton id={punto.id} resultado="no_contesta">No contestan</Boton>
        <Link
          href={`/admin/punto/${punto.id}`}
          className="self-center text-sm font-medium underline underline-offset-4"
        >
          Cambió algo
        </Link>
      </div>
    </li>
  );
}

function Boton({
  id,
  resultado,
  tono,
  children,
}: {
  id: string;
  resultado: string;
  tono?: 'principal' | 'peligro';
  children: React.ReactNode;
}) {
  const clase =
    tono === 'principal'
      ? 'rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white dark:bg-emerald-600'
      : tono === 'peligro'
        ? 'rounded-lg border border-red-500/40 px-3 py-2 text-sm font-medium text-red-800 dark:text-red-300'
        : 'rounded-lg border border-black/15 px-3 py-2 text-sm font-medium dark:border-white/20';

  return (
    <form action={registrarLlamada}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="resultado" value={resultado} />
      <button type="submit" className={clase}>{children}</button>
    </form>
  );
}
