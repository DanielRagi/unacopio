import Link from 'next/link';
import { resolverSolicitud } from '@/app/admin/acciones';
import { enlaceLlamada } from '@/lib/enlaces';
import { haceCuanto } from '@/lib/textos';
import type { Solicitud } from '@/lib/datos';
import type { TipoReporte } from '@/lib/tipos';

const MOTIVOS: Record<TipoReporte, string> = {
  info_incorrecta: 'Hay que corregir algo',
  cerrado: 'Ya no está recibiendo',
  no_existe: 'Dicen que no existe',
  duplicado: 'Está repetido',
  spam: 'Spam',
};

export function FilaSolicitud({ solicitud }: { solicitud: Solicitud }) {
  const punto = solicitud.puntos;

  return (
    <li className="flex flex-col gap-3 rounded-xl border border-black/10 p-4 dark:border-white/15">
      <div className="flex flex-wrap items-center gap-2">
        {solicitud.es_responsable ? (
          <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-semibold text-white">
            Dice ser el responsable
          </span>
        ) : (
          <span className="rounded-full bg-black/10 px-2 py-0.5 text-xs font-semibold dark:bg-white/15">
            Reporte de un tercero
          </span>
        )}
        <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-900 dark:text-amber-200">
          {MOTIVOS[solicitud.tipo]}
        </span>
        <span className="text-xs text-black/50 dark:text-white/50">
          {haceCuanto(solicitud.creado_en)}
        </span>
      </div>

      <div className="flex flex-col gap-0.5">
        <Link href={`/punto/${solicitud.punto_id}`} className="font-semibold underline underline-offset-4">
          {punto?.nombre ?? 'Punto eliminado'}
        </Link>
        {punto && (
          <p className="text-sm text-black/60 dark:text-white/60">
            {punto.municipios?.nombre} · estado: {punto.estado} · {punto.responsable_nombre}{' '}
            <a href={enlaceLlamada(punto.telefono)} className="underline underline-offset-2">
              {punto.telefono}
            </a>
          </p>
        )}
      </div>

      {solicitud.comentario && (
        <blockquote className="whitespace-pre-line rounded-lg bg-black/[0.03] p-3 text-sm dark:bg-white/5">
          {solicitud.comentario}
        </blockquote>
      )}

      {solicitud.contacto && (
        <p className="text-sm text-black/60 dark:text-white/60">
          Contacto que dejó: {solicitud.contacto}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-black/10 pt-3 dark:border-white/15">
        <form action={resolverSolicitud}>
          <input type="hidden" name="id" value={solicitud.id} />
          <button
            type="submit"
            className="rounded-lg border border-black/15 px-3 py-2 text-sm font-medium dark:border-white/20"
          >
            Marcar como atendida
          </button>
        </form>
        <Link
          href={`/admin?estado=${punto?.estado ?? 'publicado'}`}
          className="text-sm underline underline-offset-4"
        >
          Ir a la ficha para editarla
        </Link>
      </div>
    </li>
  );
}
