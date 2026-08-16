'use client';

import Link from 'next/link';
import { useRef } from 'react';
import { GRUPOS } from '@/lib/textos';
import type { Categoria, Departamento, GrupoCategoria, Municipio } from '@/lib/tipos';

/**
 * Filtro del listado: departamento, municipio y qué quiere donar la persona.
 *
 * Sigue siendo un `<form method="get">` de verdad, y eso no es nostalgia: es lo
 * que hace que el filtro funcione en un celular viejo con la señal en un palito,
 * que es el escenario real. Lo que hace el JavaScript es solo quitar un toque —
 * al cambiar un select, el formulario se manda solo.
 *
 * El botón "Buscar" no desaparece: se va a un `<noscript>`. Con JavaScript
 * estorba; sin JavaScript es la única forma de enviar. Así ninguna de las dos
 * versiones queda coja.
 *
 * Se llena en dos pasos —primero departamento, después municipio— para no mandar
 * los 1.122 municipios en cada carga.
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
  const formulario = useRef<HTMLFormElement>(null);

  // Se deja la flecha nativa del `select`: la del sistema es la que la gente
  // reconoce, y dibujar una propia obliga a `appearance-none`, que en algunos
  // Android deja el control sin ninguna señal de que se puede desplegar.
  const claseSelect =
    'w-full rounded-lg border border-black/15 bg-transparent px-3 py-2.5 text-base transition-colors hover:border-black/30 dark:border-white/20 dark:hover:border-white/35';

  const grupos = [...new Set(categorias.map((c) => c.grupo))] as GrupoCategoria[];
  const hayFiltro = Boolean(dep || mun || cat || lat);

  const enviar = () => formulario.current?.requestSubmit();

  /*
   * Al cambiar de departamento hay que soltar el municipio.
   *
   * Sin esto quedaba una combinación imposible: elegir Antioquia + Medellín y
   * después volver a "Todo el país" dejaba el municipio puesto, así que el
   * selector decía "Todo el país" mientras la lista mostraba —o no mostraba—
   * Medellín. El municipio pertenece a un departamento; si cambia el padre, el
   * hijo no sobrevive.
   */
  const cambiarDepartamento = (evento: React.ChangeEvent<HTMLSelectElement>) => {
    const municipio = evento.currentTarget.form?.elements.namedItem('mun');
    if (municipio instanceof HTMLSelectElement) municipio.value = '';
    enviar();
  };

  return (
    <form
      ref={formulario}
      method="get"
      action="/"
      className="flex flex-col gap-3 rounded-2xl border border-black/8 bg-black/[0.015] p-4 dark:border-white/12 dark:bg-white/[0.02]"
    >
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
          <select
            name="dep"
            defaultValue={dep ?? ''}
            onChange={cambiarDepartamento}
            className={claseSelect}
          >
            <option value="">Todo el país</option>
            {departamentos.map((d) => (
              <option key={d.codigo} value={d.codigo}>{d.nombre}</option>
            ))}
          </select>
        </label>

        {dep && (
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="text-sm font-medium">Municipio</span>
            <select name="mun" defaultValue={mun ?? ''} onChange={enviar} className={claseSelect}>
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
        <select name="cat" defaultValue={cat ?? ''} onChange={enviar} className={claseSelect}>
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

      <noscript>
        <button
          type="submit"
          className="rounded-lg bg-black px-5 py-2.5 text-sm font-semibold text-white dark:bg-white dark:text-black"
        >
          Buscar
        </button>
      </noscript>

      {hayFiltro && (
        <Link
          href="/?pais=1"
          className="self-start text-sm underline underline-offset-4 opacity-70 hover:opacity-100"
        >
          Quitar filtros
        </Link>
      )}
    </form>
  );
}
