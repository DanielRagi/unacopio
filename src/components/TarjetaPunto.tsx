import Link from 'next/link';
import { ListaCategorias } from './ListaCategorias';
import { SelloAbierto } from './SelloAbierto';
import { SelloFrescura } from './SelloFrescura';
import { SelloLleno } from './SelloLleno';
import { TIPOS_ORGANIZACION } from '@/lib/textos';
import type { PuntoPublico } from '@/lib/tipos';

export function TarjetaPunto({ punto, metros }: { punto: PuntoPublico; metros?: number }) {
  return (
    <li
      className="group relative overflow-hidden rounded-2xl border border-black/8 bg-white/60 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all hover:-translate-y-px hover:border-black/20 hover:shadow-[0_6px_18px_rgba(0,0,0,0.07)] dark:border-white/12 dark:bg-white/[0.03] dark:hover:border-white/25"
    >
      {/*
        Franja de color al costado. Es la señal que se lee sin leer: verde para
        entidad oficial, ámbar para un punto que hoy está lleno.
      */}
      <span
        aria-hidden
        className={`absolute inset-y-0 left-0 w-1 ${
          punto.estado === 'lleno'
            ? 'bg-amber-500'
            : punto.entidad_oficial
              ? 'bg-emerald-600'
              : 'bg-transparent'
        }`}
      />

      <Link href={`/punto/${punto.id}`} className="flex flex-col gap-3 p-4 pl-5 sm:p-5 sm:pl-6">
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            {punto.estado === 'lleno' && <SelloLleno />}
            <SelloAbierto
              horarios={punto.horarios}
              fechaInicio={punto.fecha_inicio}
              fechaFin={punto.fecha_fin}
            />
            {punto.entidad_oficial && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-0.5 text-xs font-semibold text-white">
                <svg viewBox="0 0 12 12" className="size-3" fill="currentColor" aria-hidden>
                  <path d="M6 0 7.6 3.6 11.4 4 8.6 6.6 9.4 10.4 6 8.5 2.6 10.4 3.4 6.6.6 4l3.8-.4L6 0Z" />
                </svg>
                Entidad oficial
              </span>
            )}
            <SelloFrescura ultimaVerificacion={punto.ultima_verificacion} />
            {metros !== undefined && (
              <span className="ml-auto rounded-full bg-black/[0.06] px-2.5 py-1 text-xs font-semibold tabular-nums dark:bg-white/10">
                a {formatearDistancia(metros)}
              </span>
            )}
          </div>

          <h3 className="text-lg leading-snug font-semibold group-hover:text-emerald-800 dark:group-hover:text-emerald-300">
            {punto.nombre}
          </h3>
          <p className="text-sm text-black/55 dark:text-white/55">
            {TIPOS_ORGANIZACION[punto.tipo_organizacion]} · {punto.municipio},{' '}
            {punto.departamento}
          </p>
        </div>

        <div className="flex flex-col gap-1 text-sm">
          <p className="flex items-start gap-1.5">
            <IconoPin />
            <span>
              {punto.direccion}
              {punto.barrio ? `, ${punto.barrio}` : ''}
            </span>
          </p>
          <p className="flex items-start gap-1.5 text-black/60 dark:text-white/60">
            <IconoReloj />
            <span>{punto.horario_texto}</span>
          </p>
        </div>

        <ListaCategorias categorias={punto.categorias} niveles={['alta', 'no_recibe']} compacto />
      </Link>
    </li>
  );
}

function IconoPin() {
  return (
    <svg viewBox="0 0 16 16" className="mt-0.5 size-4 shrink-0 opacity-45" fill="none" aria-hidden>
      <path
        d="M8 1.5c-2.5 0-4.5 2-4.5 4.5 0 3.2 4.5 8.5 4.5 8.5s4.5-5.3 4.5-8.5c0-2.5-2-4.5-4.5-4.5Z"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <circle cx="8" cy="6" r="1.6" fill="currentColor" />
    </svg>
  );
}

function IconoReloj() {
  return (
    <svg viewBox="0 0 16 16" className="mt-0.5 size-4 shrink-0 opacity-45" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="6.3" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 4.5V8l2.4 1.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function formatearDistancia(metros: number): string {
  if (metros < 1000) return `${Math.round(metros)} m`;
  return `${(metros / 1000).toFixed(1).replace('.', ',')} km`;
}
