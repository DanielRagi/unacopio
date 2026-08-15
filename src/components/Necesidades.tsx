import Link from 'next/link';
import type { Necesidad } from '@/lib/datos';

/**
 * "Lo que más falta acá".
 *
 * Va arriba de la lista a propósito: la mayoría de la gente llega con la
 * pregunta "¿qué llevo?" antes que con "¿a dónde voy?". Cada renglón es un
 * enlace que filtra el listado, para que la respuesta se pueda seguir de un
 * toque.
 */
export function Necesidades({
  necesidades,
  base,
  lugar,
}: {
  necesidades: Necesidad[];
  /** A dónde apunta cada categoría, ya con los filtros del lugar puestos. */
  base: string;
  lugar: string;
}) {
  const urgentes = necesidades.filter((n) => n.urgente > 0);
  if (urgentes.length === 0) return null;

  return (
    <section
      aria-labelledby="titulo-necesidades"
      className="flex flex-col gap-3 rounded-xl border border-amber-600/30 bg-amber-50 p-4 dark:border-amber-400/25 dark:bg-amber-950/30 sm:p-5"
    >
      <h2 id="titulo-necesidades" className="text-sm font-semibold">
        Lo que más falta en {lugar}
      </h2>
      <ul className="flex flex-wrap gap-2">
        {urgentes.map((n) => (
          <li key={n.slug}>
            <Link
              href={`${base}${base.includes('?') ? '&' : '?'}cat=${n.slug}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-amber-700/30 bg-white px-3 py-1.5 text-sm font-medium hover:border-amber-700/60 dark:border-amber-400/30 dark:bg-white/10 dark:hover:border-amber-300/60"
            >
              {n.nombre}
              <span className="text-xs font-normal text-black/55 dark:text-white/55">
                {n.urgente} {n.urgente === 1 ? 'punto' : 'puntos'}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="text-xs text-black/60 dark:text-white/60">
        Cuenta cuántos puntos lo marcaron como urgente. Toca una categoría para
        ver solo los que la reciben.
      </p>
    </section>
  );
}
