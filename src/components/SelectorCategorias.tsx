import { GRUPOS } from '@/lib/textos';
import type { Categoria, GrupoCategoria } from '@/lib/tipos';

/**
 * Qué recibe el punto, categoría por categoría, en cuatro estados.
 *
 * "No llevar" es un estado propio y no la ausencia de respuesta, porque es
 * información que vale tanto como el resto: es lo que evita que a un punto que
 * solo necesita agua le lleguen doscientos bultos de ropa usada.
 *
 * Son radios normales dentro de un `<details>` por grupo: funciona sin
 * JavaScript y se envía solo con el formulario.
 */

const OPCIONES = [
  { valor: '', etiqueta: '—', clase: 'peer-checked:bg-black/10 dark:peer-checked:bg-white/15' },
  { valor: 'alta', etiqueta: 'Urgente', clase: 'peer-checked:bg-amber-500/30 peer-checked:font-semibold' },
  { valor: 'si', etiqueta: 'Sí', clase: 'peer-checked:bg-emerald-500/25 peer-checked:font-semibold' },
  { valor: 'no_recibe', etiqueta: 'No llevar', clase: 'peer-checked:bg-red-500/25 peer-checked:font-semibold' },
] as const;

// Los tres primeros grupos abiertos: es lo que más se necesita y lo que más se
// marca. El resto plegado para que el formulario no asuste al abrirlo.
const ABIERTOS: GrupoCategoria[] = ['agua', 'alimentos', 'aseo'];

export function SelectorCategorias({
  categorias,
  valores = {},
}: {
  categorias: Categoria[];
  /** Lo ya marcado, para poder editar un punto sin volver a llenar todo. */
  valores?: Record<string, string>;
}) {
  const grupos = [...new Set(categorias.map((c) => c.grupo))];

  return (
    <div className="flex flex-col gap-2">
      {grupos.map((grupo) => (
        <details
          key={grupo}
          open={ABIERTOS.includes(grupo)}
          className="rounded-xl border border-black/10 dark:border-white/15"
        >
          <summary className="cursor-pointer px-4 py-3 font-medium select-none">
            {GRUPOS[grupo]}
          </summary>
          <div className="flex flex-col divide-y divide-black/5 border-t border-black/10 dark:divide-white/10 dark:border-white/15">
            {categorias
              .filter((c) => c.grupo === grupo)
              .map((categoria) => (
                <fieldset
                  key={categoria.slug}
                  className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <legend className="sr-only">{categoria.nombre}</legend>
                  <span className="text-sm">{categoria.nombre}</span>
                  <div className="flex flex-wrap gap-1">
                    {OPCIONES.map((opcion) => (
                      <label key={opcion.valor || 'ninguno'} className="cursor-pointer">
                        <input
                          type="radio"
                          name={`cat_${categoria.slug}`}
                          value={opcion.valor}
                          defaultChecked={(valores[categoria.slug] ?? '') === opcion.valor}
                          className="peer sr-only"
                        />
                        <span
                          className={`block rounded-md border border-black/10 px-2.5 py-1 text-xs dark:border-white/15 ${opcion.clase}`}
                        >
                          {opcion.etiqueta}
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}
          </div>
        </details>
      ))}
    </div>
  );
}
