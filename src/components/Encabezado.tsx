import Link from 'next/link';
import { SITIO } from '@/lib/textos';

export function Encabezado() {
  return (
    <header className="border-b border-black/10 dark:border-white/15">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-5 py-4">
        <Link href="/" className="flex flex-col leading-tight">
          <span className="text-xl font-bold tracking-tight">{SITIO.nombre}</span>
          <span className="text-xs text-black/60 dark:text-white/60">{SITIO.lema}</span>
        </Link>
        <Link
          href="/registrar"
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
        >
          Registrar un punto
        </Link>
      </div>
    </header>
  );
}
