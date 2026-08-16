'use client';

import Link from 'next/link';
import { useRef } from 'react';
import type { UbicacionModeracion } from '@/lib/datos';

/**
 * Filtro por departamento y municipio para el panel de moderación.
 *
 * Solo ofrece los lugares que **tienen puntos**, con cuántos hay por revisar.
 * Un selector con los 1.122 municipios del país sería peor que no filtrar:
 * quien modera tendría que buscar los dos que importan entre mil vacíos.
 *
 * Se manda solo al cambiar, igual que el filtro público, y arrastra en campos
 * ocultos la pestaña donde está la persona. Sin eso, filtrar por Medellín
 * mientras se revisan los rechazados devolvería a la cola de pendientes.
 */
export function FiltroModeracion({
  ubicaciones,
  dep,
  mun,
  vista,
  estado,
}: {
  ubicaciones: UbicacionModeracion[];
  dep?: string;
  mun?: string;
  vista?: string;
  estado?: string;
}) {
  const formulario = useRef<HTMLFormElement>(null);
  const enviar = () => formulario.current?.requestSubmit();

  const departamentos = [...new Map(
    ubicaciones.map((u) => [u.departamento_codigo, u]),
  ).values()];

  const totalPorDepartamento = (codigo: string) =>
    ubicaciones
      .filter((u) => u.departamento_codigo === codigo)
      .reduce((suma, u) => suma + u.pendientes, 0);

  const municipios = dep
    ? ubicaciones.filter((u) => u.departamento_codigo === dep)
    : [];

  const cambiarDepartamento = (evento: React.ChangeEvent<HTMLSelectElement>) => {
    // El municipio pertenece al departamento: si cambia el padre, no sobrevive.
    const municipio = evento.currentTarget.form?.elements.namedItem('mun');
    if (municipio instanceof HTMLSelectElement) municipio.value = '';
    enviar();
  };

  if (ubicaciones.length === 0) return null;

  const clase =
    'rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/20';

  return (
    <form
      ref={formulario}
      method="get"
      action="/admin"
      className="flex flex-wrap items-end gap-3 rounded-xl border border-black/8 bg-black/[0.015] p-3 dark:border-white/12 dark:bg-white/[0.02]"
    >
      {vista && <input type="hidden" name="vista" value={vista} />}
      {estado && <input type="hidden" name="estado" value={estado} />}

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-black/60 dark:text-white/60">Departamento</span>
        <select name="dep" defaultValue={dep ?? ''} onChange={cambiarDepartamento} className={clase}>
          <option value="">Todos</option>
          {departamentos.map((u) => (
            <option key={u.departamento_codigo} value={u.departamento_codigo}>
              {u.departamento} ({totalPorDepartamento(u.departamento_codigo)} por revisar)
            </option>
          ))}
        </select>
      </label>

      {dep && (
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-black/60 dark:text-white/60">Municipio</span>
          <select name="mun" defaultValue={mun ?? ''} onChange={enviar} className={clase}>
            <option value="">Todos</option>
            {municipios.map((u) => (
              <option key={u.municipio_codigo} value={u.municipio_codigo}>
                {u.municipio} ({u.pendientes} por revisar)
              </option>
            ))}
          </select>
        </label>
      )}

      <noscript>
        <button
          type="submit"
          className="rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-black"
        >
          Filtrar
        </button>
      </noscript>

      {(dep ?? mun) && (
        <Link
          href={`/admin${vista ? `?vista=${vista}` : estado ? `?estado=${estado}` : ''}`}
          className="pb-2 text-sm underline underline-offset-4 opacity-70 hover:opacity-100"
        >
          Ver todo
        </Link>
      )}
    </form>
  );
}
