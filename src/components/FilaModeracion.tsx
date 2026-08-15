import Link from 'next/link';
import { alternarEntidadOficial, cambiarEstado, marcarVerificado } from '@/app/admin/acciones';
import { enlaceLlamada, enlaceWhatsapp } from '@/lib/enlaces';
import { haceCuanto, TIPOS_ORGANIZACION } from '@/lib/textos';
import type { Duplicado, PuntoModeracion } from '@/lib/datos';

/**
 * Una fila de la cola de moderación.
 *
 * Muestra a propósito lo que el público no ve: el correo, y el teléfono aunque
 * no esté autorizado para publicarse. Es con eso que el equipo llama a confirmar
 * que el punto existe y sigue recibiendo, que es todo el trabajo de moderar.
 *
 * Los botones son formularios normales contra Server Actions: el panel funciona
 * sin JavaScript, que ayuda cuando se modera desde un celular en la calle.
 */
export function FilaModeracion({
  punto,
  duplicados = [],
}: {
  punto: PuntoModeracion;
  duplicados?: Duplicado[];
}) {
  const urgentes = punto.punto_categoria.filter((c) => c.nivel === 'alta');
  const rechazadas = punto.punto_categoria.filter((c) => c.nivel === 'no_recibe');

  return (
    <li className="flex flex-col gap-4 rounded-xl border border-black/10 p-4 dark:border-white/15">
      {/* Cuando un punto se vuelve conocido, la misma parroquia la registran tres
          personas distintas con tres nombres distintos. Verlo antes de publicar
          sale más barato que fusionar fichas después. */}
      {duplicados.length > 0 && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <p className="font-semibold text-amber-900 dark:text-amber-200">
            ¿Será el mismo punto? Hay {duplicados.length === 1 ? 'otro' : 'otros'} muy cerca:
          </p>
          <ul className="mt-1 flex flex-col gap-0.5">
            {duplicados.map((d) => (
              <li key={d.id}>
                <Link href={`/punto/${d.id}`} className="underline underline-offset-2">
                  {d.nombre}
                </Link>{' '}
                <span className="opacity-70">
                  · {d.estado} · a {Math.round(d.metros)} m
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          {punto.entidad_oficial && (
            <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-semibold text-white">
              Oficial
            </span>
          )}
          {punto.reportes_abiertos > 0 && (
            <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-semibold text-red-800 dark:text-red-300">
              {punto.reportes_abiertos} reporte{punto.reportes_abiertos === 1 ? '' : 's'}
            </span>
          )}
          <span className="text-xs text-black/50 dark:text-white/50">
            Registrado {haceCuanto(punto.creado_en)}
            {punto.ultima_verificacion && ` · verificado ${haceCuanto(punto.ultima_verificacion)}`}
          </span>
        </div>

        <h3 className="text-lg font-semibold">{punto.nombre}</h3>
        <p className="text-sm text-black/60 dark:text-white/60">
          {TIPOS_ORGANIZACION[punto.tipo_organizacion]} · {punto.municipios?.nombre},{' '}
          {punto.departamentos?.nombre}
        </p>
      </div>

      <dl className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
        <Dato termino="Dirección">
          {punto.direccion}
          {punto.barrio && `, ${punto.barrio}`}
          {punto.referencia && (
            <span className="block text-black/60 dark:text-white/60">{punto.referencia}</span>
          )}
        </Dato>
        <Dato termino="Horario">{punto.horario_texto}</Dato>
        <Dato termino="Responsable">{punto.responsable_nombre}</Dato>
        <Dato termino="Teléfono">
          <a href={enlaceLlamada(punto.telefono)} className="underline underline-offset-2">
            {punto.telefono}
          </a>
          {punto.whatsapp && (
            <>
              {' · '}
              <a
                href={enlaceWhatsapp(punto.telefono)}
                className="underline underline-offset-2"
              >
                WhatsApp
              </a>
            </>
          )}
          {!punto.telefono_publico && (
            <span className="ml-1 rounded bg-amber-500/20 px-1.5 py-0.5 text-xs text-amber-900 dark:text-amber-200">
              no publicable
            </span>
          )}
        </Dato>
        <Dato termino="Correo">{punto.correo ?? '—'}</Dato>
        <Dato termino="Coordenadas">
          <a
            href={`https://www.google.com/maps?q=${punto.lat},${punto.lng}`}
            className="underline underline-offset-2"
          >
            {punto.lat.toFixed(5)}, {punto.lng.toFixed(5)}
          </a>
        </Dato>
      </dl>

      {(urgentes.length > 0 || rechazadas.length > 0) && (
        <div className="flex flex-wrap gap-1.5 text-xs">
          {urgentes.map((c, i) => (
            <span key={`u${i}`} className="rounded bg-amber-500/20 px-2 py-1">
              {c.categorias?.nombre}
            </span>
          ))}
          {rechazadas.map((c, i) => (
            <span key={`n${i}`} className="rounded bg-red-500/15 px-2 py-1 text-red-800 dark:text-red-300">
              no: {c.categorias?.nombre}
            </span>
          ))}
        </div>
      )}

      {punto.notas && (
        <p className="rounded-lg bg-black/[0.03] p-3 text-sm dark:bg-white/5">{punto.notas}</p>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-black/10 pt-3 dark:border-white/15">
        {punto.estado !== 'publicado' && (
          <Boton accion={cambiarEstado} id={punto.id} estado="publicado" tono="principal">
            Publicar
          </Boton>
        )}
        {punto.estado === 'publicado' && (
          <form action={marcarVerificado}>
            <input type="hidden" name="id" value={punto.id} />
            <button type="submit" className={CLASE_SECUNDARIO}>
              Ya confirmé por teléfono
            </button>
          </form>
        )}
        {punto.estado !== 'cerrado' && (
          <Boton accion={cambiarEstado} id={punto.id} estado="cerrado">
            Cerrado
          </Boton>
        )}
        {punto.estado !== 'lleno' && punto.estado === 'publicado' && (
          <Boton accion={cambiarEstado} id={punto.id} estado="lleno">
            Está lleno
          </Boton>
        )}
        {punto.estado !== 'rechazado' && (
          <Boton accion={cambiarEstado} id={punto.id} estado="rechazado" tono="peligro">
            Rechazar
          </Boton>
        )}

        <form action={alternarEntidadOficial}>
          <input type="hidden" name="id" value={punto.id} />
          <input type="hidden" name="oficial" value={String(!punto.entidad_oficial)} />
          <button type="submit" className={CLASE_SECUNDARIO}>
            {punto.entidad_oficial ? 'Quitar «oficial»' : 'Marcar «oficial»'}
          </button>
        </form>

        {punto.estado === 'publicado' && (
          <Link
            href={`/punto/${punto.id}`}
            className="text-sm underline underline-offset-4"
          >
            Ver ficha
          </Link>
        )}
      </div>
    </li>
  );
}

const CLASE_SECUNDARIO =
  'rounded-lg border border-black/15 px-3 py-2 text-sm font-medium dark:border-white/20';

function Boton({
  accion,
  id,
  estado,
  tono,
  children,
}: {
  accion: (formData: FormData) => Promise<void>;
  id: string;
  estado: string;
  tono?: 'principal' | 'peligro';
  children: React.ReactNode;
}) {
  const clase =
    tono === 'principal'
      ? 'rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white dark:bg-emerald-600'
      : tono === 'peligro'
        ? 'rounded-lg border border-red-500/40 px-3 py-2 text-sm font-medium text-red-800 dark:text-red-300'
        : CLASE_SECUNDARIO;

  return (
    <form action={accion}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="estado" value={estado} />
      <button type="submit" className={clase}>
        {children}
      </button>
    </form>
  );
}

function Dato({ termino, children }: { termino: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs uppercase tracking-wide text-black/45 dark:text-white/45">
        {termino}
      </dt>
      <dd>{children}</dd>
    </div>
  );
}
