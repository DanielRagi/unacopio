'use client';

import Link from 'next/link';
import { useActionState, useRef, useState } from 'react';
import { procesarImportacion } from '@/app/admin/importar/acciones';
import { IMPORTACION_INICIAL } from '@/lib/estados';
import { PLANTILLA_CSV } from '@/lib/importacion';

/**
 * Cargar una lista ajena en dos pasos: revisar y confirmar.
 *
 * El paso de revisión no es burocracia. Las listas que llegan traen municipios
 * mal escritos, coordenadas invertidas y categorías inventadas; verlo antes de
 * cargar es la diferencia entre corregir un archivo y ponerse a borrar cuarenta
 * puntos de la cola.
 */
export function FormularioImportacion() {
  const [estado, enviar, procesando] = useActionState(procesarImportacion, IMPORTACION_INICIAL);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const [nombreArchivo, setNombreArchivo] = useState<string | null>(null);

  async function tomarArchivo(evento: React.ChangeEvent<HTMLInputElement>) {
    const archivo = evento.target.files?.[0];
    if (!archivo || !areaRef.current) return;
    areaRef.current.value = await archivo.text();
    setNombreArchivo(archivo.name);
  }

  if (estado.estado === 'cargado') {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-5">
          <p className="font-semibold">
            {estado.creados} {estado.creados === 1 ? 'punto cargado' : 'puntos cargados'}
          </p>
          <p className="text-sm text-black/70 dark:text-white/70">
            Entraron a la cola de pendientes. Ninguno se ve en el sitio hasta que
            alguien llame a confirmar y lo publique.
          </p>
        </div>

        {estado.fallidos.length > 0 && (
          <div className="flex flex-col gap-2 rounded-xl border border-red-500/40 p-5">
            <p className="font-semibold">
              {estado.fallidos.length}{' '}
              {estado.fallidos.length === 1 ? 'fila no entró' : 'filas no entraron'}
            </p>
            <ul className="flex flex-col gap-1 text-sm text-black/70 dark:text-white/70">
              {estado.fallidos.map((f) => (
                <li key={f.numero}>
                  <span className="font-mono">Línea {f.numero}</span> · {f.nombre} —{' '}
                  {f.mensaje}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <Link
            href="/admin"
            className="rounded-lg bg-black px-5 py-2.5 text-sm font-semibold text-white dark:bg-white dark:text-black"
          >
            Ir a la cola de pendientes
          </Link>
          <Link
            href="/admin/importar"
            className="rounded-lg border border-black/15 px-5 py-2.5 text-sm font-medium dark:border-white/20"
          >
            Cargar otra lista
          </Link>
        </div>
      </div>
    );
  }

  const revisado = estado.estado === 'revisado' ? estado : null;
  const listas = revisado?.filas.filter((f) => f.punto) ?? [];
  const malas = revisado?.filas.filter((f) => !f.punto) ?? [];

  return (
    <form action={enviar} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <label htmlFor="archivo" className="text-sm font-medium">
          Sube el archivo CSV
        </label>
        <input
          id="archivo"
          type="file"
          accept=".csv,text/csv,text/plain"
          onChange={tomarArchivo}
          className="text-sm file:mr-3 file:rounded-lg file:border file:border-black/15 file:bg-transparent file:px-4 file:py-2 file:text-sm file:font-medium dark:file:border-white/20"
        />
        {nombreArchivo && (
          <p className="text-sm text-black/60 dark:text-white/60">
            Cargado: <span className="font-medium">{nombreArchivo}</span>. Revisa
            abajo antes de confirmar.
          </p>
        )}
      </div>

      <details open={!revisado} className="flex flex-col gap-2">
        <summary className="cursor-pointer text-sm font-medium">
          …o pega el contenido aquí
        </summary>
        <textarea
          ref={areaRef}
          name="csv"
          rows={10}
          defaultValue={revisado?.csv ?? ''}
          spellCheck={false}
          placeholder={PLANTILLA_CSV}
          className="mt-2 w-full rounded-lg border border-black/15 bg-transparent px-3 py-2.5 font-mono text-xs dark:border-white/20"
        />
      </details>

      {estado.estado === 'error' && (
        <p className="rounded-lg border border-red-500/40 p-3 text-sm font-medium text-red-700 dark:text-red-400">
          {estado.mensaje}
        </p>
      )}

      {revisado && (
        <div className="flex flex-col gap-4">
          <p className="text-sm font-medium">
            {listas.length} {listas.length === 1 ? 'fila lista' : 'filas listas'}
            {malas.length > 0 && ` · ${malas.length} con problemas`}
          </p>

          <ul className="flex flex-col gap-2">
            {revisado.filas.map((fila) => (
              <li
                key={fila.numero}
                className={`flex flex-col gap-1 rounded-lg border p-3 text-sm ${
                  fila.punto
                    ? 'border-black/10 dark:border-white/15'
                    : 'border-red-500/40 bg-red-500/5'
                }`}
              >
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="font-mono text-xs text-black/50 dark:text-white/50">
                    {fila.numero}
                  </span>
                  <span className="font-medium">{fila.nombre}</span>
                  <span className="text-black/60 dark:text-white/60">{fila.municipio}</span>
                </div>
                {fila.errores.map((e) => (
                  <p key={e} className="text-red-700 dark:text-red-400">
                    {e}
                  </p>
                ))}
                {fila.advertencias.map((a) => (
                  <p key={a} className="text-amber-700 dark:text-amber-400">
                    {a}
                  </p>
                ))}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={procesando}
          className="rounded-lg border border-black/15 px-5 py-3 text-sm font-medium disabled:opacity-60 dark:border-white/20"
        >
          {procesando ? 'Revisando…' : revisado ? 'Revisar otra vez' : 'Revisar'}
        </button>

        {listas.length > 0 && (
          <button
            type="submit"
            name="confirmar"
            value="1"
            disabled={procesando}
            className="rounded-lg bg-emerald-700 px-6 py-3 text-sm font-semibold text-white disabled:opacity-60 dark:bg-emerald-600"
          >
            Cargar {listas.length} {listas.length === 1 ? 'punto' : 'puntos'} como pendientes
          </button>
        )}
      </div>
    </form>
  );
}
