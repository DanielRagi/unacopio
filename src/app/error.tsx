'use client';

import Link from 'next/link';

/**
 * Pantalla de error. En una emergencia lo peor es un muro en blanco: siempre hay
 * que dejar una salida a mano.
 */
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-5 py-16">
      <h1 className="text-2xl font-bold">Algo falló de nuestro lado</h1>
      <p className="text-black/70 dark:text-white/70">
        No pudimos cargar la información. Puede ser un problema momentáneo de
        conexión.
      </p>
      <div className="flex flex-wrap gap-3">
        <button
          onClick={reset}
          className="rounded-lg bg-black px-5 py-2.5 text-sm font-semibold text-white dark:bg-white dark:text-black"
        >
          Reintentar
        </button>
        <Link
          href="/"
          className="rounded-lg border border-black/15 px-5 py-2.5 text-sm font-semibold dark:border-white/20"
        >
          Volver al inicio
        </Link>
      </div>
    </main>
  );
}
