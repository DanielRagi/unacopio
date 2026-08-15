import type { CategoriaDePunto, NivelCategoria } from '@/lib/tipos';

const ESTILOS: Record<NivelCategoria, string> = {
  alta: 'bg-amber-500/20 text-amber-900 dark:text-amber-200 font-semibold',
  si: 'bg-black/[0.06] text-black/75 dark:bg-white/10 dark:text-white/75',
  no_recibe: 'bg-red-500/15 text-red-800 dark:text-red-300 font-semibold',
};

const TITULOS: Record<NivelCategoria, string> = {
  alta: 'Se necesita urgente',
  si: 'También reciben',
  no_recibe: 'NO llevar',
};

/**
 * Las categorías de un punto, agrupadas por nivel.
 *
 * El bloque `no_recibe` es el que más trabajo hace: es lo que evita que alguien
 * cargue el carro de ropa usada para un punto que solo necesita agua.
 */
export function ListaCategorias({
  categorias,
  niveles = ['alta', 'si', 'no_recibe'],
  compacto = false,
}: {
  categorias: CategoriaDePunto[];
  niveles?: NivelCategoria[];
  compacto?: boolean;
}) {
  const grupos = niveles
    .map((nivel) => ({ nivel, items: categorias.filter((c) => c.nivel === nivel) }))
    .filter((g) => g.items.length > 0);

  if (grupos.length === 0) return null;

  return (
    <div className="flex flex-col gap-2.5">
      {grupos.map(({ nivel, items }) => (
        <div key={nivel} className="flex flex-col gap-1.5">
          <p
            className={`text-xs uppercase tracking-wide ${
              nivel === 'no_recibe'
                ? 'font-semibold text-red-700 dark:text-red-400'
                : 'text-black/50 dark:text-white/50'
            }`}
          >
            {TITULOS[nivel]}
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {(compacto ? items.slice(0, 6) : items).map((c) => (
              <li
                key={c.slug}
                className={`rounded-md px-2 py-1 text-sm ${ESTILOS[c.nivel]}`}
              >
                {c.nombre}
              </li>
            ))}
            {compacto && items.length > 6 && (
              <li className="px-1 py-1 text-sm text-black/50 dark:text-white/50">
                +{items.length - 6} más
              </li>
            )}
          </ul>
        </div>
      ))}
    </div>
  );
}
