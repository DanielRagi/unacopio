import Link from 'next/link';
import { ListaCategorias } from './ListaCategorias';
import { SelloAbierto } from './SelloAbierto';
import { SelloFrescura } from './SelloFrescura';
import { SelloLleno } from './SelloLleno';
import { TIPOS_ORGANIZACION } from '@/lib/textos';
import type { PuntoPublico } from '@/lib/tipos';

export function TarjetaPunto({ punto, metros }: { punto: PuntoPublico; metros?: number }) {
  return (
    <li className="rounded-xl border border-black/10 transition-colors hover:border-black/25 dark:border-white/15 dark:hover:border-white/30">
      <Link href={`/punto/${punto.id}`} className="flex flex-col gap-3 p-4 sm:p-5">
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            {punto.estado === 'lleno' && <SelloLleno />}
            <SelloAbierto
              horarios={punto.horarios}
              fechaInicio={punto.fecha_inicio}
              fechaFin={punto.fecha_fin}
            />
            {punto.entidad_oficial && (
              <span className="rounded-full bg-emerald-600 px-2.5 py-0.5 text-xs font-semibold text-white">
                Entidad oficial
              </span>
            )}
            <SelloFrescura ultimaVerificacion={punto.ultima_verificacion} />
            {metros !== undefined && (
              <span className="rounded-full bg-black/[0.06] px-2.5 py-1 text-xs font-medium dark:bg-white/10">
                a {formatearDistancia(metros)}
              </span>
            )}
          </div>

          <h3 className="text-lg font-semibold leading-snug">{punto.nombre}</h3>
          <p className="text-sm text-black/60 dark:text-white/60">
            {TIPOS_ORGANIZACION[punto.tipo_organizacion]} · {punto.municipio},{' '}
            {punto.departamento}
          </p>
        </div>

        <div className="flex flex-col gap-0.5 text-sm">
          <p>{punto.direccion}{punto.barrio ? `, ${punto.barrio}` : ''}</p>
          <p className="text-black/60 dark:text-white/60">{punto.horario_texto}</p>
        </div>

        <ListaCategorias categorias={punto.categorias} niveles={['alta', 'no_recibe']} compacto />
      </Link>
    </li>
  );
}

function formatearDistancia(metros: number): string {
  if (metros < 1000) return `${Math.round(metros)} m`;
  return `${(metros / 1000).toFixed(1).replace('.', ',')} km`;
}
