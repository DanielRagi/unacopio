import Link from 'next/link';
import { FranjaBandera, Logo } from './Logo';
import { SITIO } from '@/lib/textos';

/**
 * Encabezado fijo. Se queda arriba mientras se baja por la lista, que en móvil
 * es la única forma de que "Registrar punto" siga a la mano.
 *
 * Nota de Tailwind: `bg-background/85` y no `bg-[var(--background)]/85`. El
 * modificador de opacidad necesita un color que Tailwind conozca, y
 * `--color-background` está declarado en el `@theme` de globals.css.
 */
export function Encabezado() {
  return (
    <header className="sticky top-0 z-30 border-b border-black/8 bg-background/85 backdrop-blur-md dark:border-white/12">
      <FranjaBandera />
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-5 py-3">
        <Link href="/" className="group flex items-center gap-2.5">
          <Logo className="size-9 shrink-0 text-emerald-900 transition-transform group-hover:-rotate-3 dark:text-emerald-200" />
          <span className="flex flex-col leading-none">
            <span className="text-[1.35rem] font-bold tracking-tight">
              Un<span className="text-emerald-700 dark:text-emerald-400">Acopio</span>
            </span>
            <span className="mt-1 text-[0.7rem] font-medium tracking-wide text-black/50 uppercase dark:text-white/50">
              {SITIO.lema}
            </span>
          </span>
        </Link>

        <nav className="flex items-center gap-2">
          <Link
            href="/mapa"
            className="hidden rounded-lg px-3 py-2 text-sm font-medium text-black/70 hover:bg-black/[0.04] hover:text-black sm:block dark:text-white/70 dark:hover:bg-white/[0.06] dark:hover:text-white"
          >
            Mapa
          </Link>
          <Link
            href="/registrar"
            className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
          >
            Registrar punto
          </Link>
        </nav>
      </div>
    </header>
  );
}
