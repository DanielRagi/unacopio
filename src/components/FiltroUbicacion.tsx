import Link from 'next/link';
import { GRUPOS } from '@/lib/textos';
import type { Categoria, Departamento, GrupoCategoria, Municipio } from '@/lib/tipos';

/**
 * Filtro del listado: departamento, municipio y qué quiere donar la persona.
 *
 * Es un `<form method="get">` a propósito: funciona sin una línea de JavaScript,
 * que es la diferencia entre servir o no servir en un celular viejo con señal
 * mala. Se llena en dos pasos —primero departamento, después municipio— para no
 * mandar los 1.122 municipios en cada carga.
 */
export function FiltroUbicacion({
  departamentos,
  municipios,
  categorias,
  dep,
  mun,
  cat,
  lat,
  lng,
}: {
  departamentos: Departamento[];
  municipios: Municipio[];
  categorias: Categoria[];
  dep?: string;
  mun?: string;
  cat?: string;
  lat?: string;
  lng?: string;
}) {
  const claseSelect =
    'w-full rounded-lg border border-black/15 bg-transparent px-3 py-2.5 text-base dark:border-white/20';

  const grupos = [...new Set(categorias.map((c) => c.grupo))] as GrupoCategoria[];
  const hayFiltro = Boolean(dep || mun || cat || lat);

  return (
    <form method="get" action="/" className="flex flex-col gap-3">
      {/* Si la persona ya compartió su ubicación, no se pierde al filtrar. */}
      {lat && lng && (
        <>
          <input type="hidden" name="lat" value={lat} />
          <input type="hidden" name="lng" value={lng} />
        </>
      )}

      {/*
        Usar este formulario es elegir a mano, así que a partir de acá no se
        vuelve a adivinar la ciudad por la IP. Sin esto, elegir "Todo el país"
        mandaba a `/` sin filtros y la detección lo devolvía a su municipio: el
        selector parecía roto.
      */}
      <input type="hidden" name="pais" value="1" />

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

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">¿Qué quieres donar?</span>
        <select name="cat" defaultValue={cat ?? ''} className={claseSelect}>
          <option value="">Cualquier cosa</option>
          {grupos.map((grupo) => (
            <optgroup key={grupo} label={GRUPOS[grupo]}>
              {categorias
                .filter((c) => c.grupo === grupo)
                .map((c) => (
                  <option key={c.slug} value={c.slug}>{c.nombre}</option>
                ))}
            </optgroup>
          ))}
        </select>
      </label>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          className="rounded-lg bg-black px-5 py-2.5 text-sm font-semibold text-white dark:bg-white dark:text-black"
        >
          Buscar
        </button>
        {hayFiltro && (
          <Link href="/?pais=1" className="text-sm underline underline-offset-4">
            Quitar filtros
          </Link>
        )}
      </div>
    </form>
  );
}
