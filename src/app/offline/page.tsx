import type { Metadata } from 'next';
import Link from 'next/link';
import { Encabezado } from '@/components/Encabezado';
import { PieDePagina } from '@/components/PieDePagina';

export const metadata: Metadata = {
  title: 'Sin conexión',
  robots: { index: false, follow: false },
};

/**
 * Lo que sale cuando no hay red y tampoco hay copia guardada de esa página.
 *
 * El objetivo no es disculparse: es que la persona sepa qué puede hacer sin
 * datos. Las páginas que ya visitó siguen abriendo, y el teléfono del punto que
 * alcanzó a ver sirve igual sin internet.
 */
export default function PaginaSinConexion() {
  return (
    <>
      <Encabezado />

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-5 py-12">
        <h1 className="text-3xl font-bold tracking-tight">Te quedaste sin conexión</h1>
        <p className="text-black/70 dark:text-white/70">
          No pudimos cargar esta página. Las que ya habías abierto sí deberían
          funcionar: prueba volver atrás.
        </p>
        <ul className="flex list-disc flex-col gap-2 pl-5 text-black/70 dark:text-white/70">
          <li>
            Si ya viste la ficha de un punto, el botón de llamar funciona sin
            datos.
          </li>
          <li>
            Cuando vuelva la señal, recarga: la información de los puntos cambia
            todos los días y no queremos mostrarte una copia vieja sin avisarte.
          </li>
        </ul>
        <Link
          href="/"
          className="self-start rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white dark:bg-emerald-600"
        >
          Reintentar
        </Link>
      </main>

      <PieDePagina />
    </>
  );
}
