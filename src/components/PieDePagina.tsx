import Link from 'next/link';
import { AVISOS, SITIO } from '@/lib/textos';

export function PieDePagina() {
  return (
    <footer className="mt-auto border-t border-black/10 dark:border-white/15">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-5 py-8 text-sm text-black/60 dark:text-white/60">
        <p className="font-medium text-amber-800 dark:text-amber-300">{AVISOS.sinDinero}</p>
        <p>{AVISOS.informacionDeTerceros}</p>
        <nav aria-label="Enlaces del pie" className="flex flex-wrap gap-x-4 gap-y-1">
          <Link href="/acopio" className="underline underline-offset-4">
            Municipios
          </Link>
          <Link href="/mapa" className="underline underline-offset-4">
            Mapa
          </Link>
          <Link href="/datos" className="underline underline-offset-4">
            Datos abiertos
          </Link>
          <Link href="/registrar" className="underline underline-offset-4">
            Registrar un punto
          </Link>
          <a href={`mailto:${SITIO.correo}`} className="underline underline-offset-4">
            {SITIO.correo}
          </a>
        </nav>
        <p className="text-xs">
          {SITIO.nombre} · {SITIO.dominio} · Información abierta, hecha por
          voluntarios.
        </p>
      </div>
    </footer>
  );
}
