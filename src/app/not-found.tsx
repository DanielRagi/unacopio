import Link from 'next/link';
import { Encabezado } from '@/components/Encabezado';
import { PieDePagina } from '@/components/PieDePagina';

export default function NoEncontrado() {
  return (
    <>
      <Encabezado />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-5 py-16">
        <h1 className="text-2xl font-bold">No encontramos esta página</h1>
        <p className="text-black/70 dark:text-white/70">
          Puede que el punto de acopio ya no esté publicado: a veces se cierran o
          se despublican cuando la información deja de estar al día.
        </p>
        <Link
          href="/"
          className="self-start rounded-lg bg-black px-5 py-2.5 text-sm font-semibold text-white dark:bg-white dark:text-black"
        >
          Ver los puntos publicados
        </Link>
      </main>
      <PieDePagina />
    </>
  );
}
