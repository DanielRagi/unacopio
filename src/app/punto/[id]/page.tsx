import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Encabezado } from '@/components/Encabezado';
import { ListaCategorias } from '@/components/ListaCategorias';
import { PieDePagina } from '@/components/PieDePagina';
import { SelloFrescura } from '@/components/SelloFrescura';
import { obtenerPunto } from '@/lib/datos';
import {
  enlaceCompartir, enlaceGoogleMaps, enlaceLlamada, enlaceWaze, enlaceWhatsapp, urlPunto,
} from '@/lib/enlaces';
import { AVISOS, TIPOS_ORGANIZACION } from '@/lib/textos';
import type { PuntoPublico } from '@/lib/tipos';

export async function generateMetadata({ params }: PageProps<'/punto/[id]'>): Promise<Metadata> {
  const { id } = await params;
  const punto = await obtenerPunto(id);
  if (!punto) return { title: 'Punto no encontrado' };

  const urgente = punto.categorias.filter((c) => c.nivel === 'alta').map((c) => c.nombre);
  const descripcion = urgente.length
    ? `${punto.municipio}: necesitan ${urgente.slice(0, 4).join(', ')}. ${punto.horario_texto}`
    : `Punto de acopio en ${punto.municipio}, ${punto.departamento}. ${punto.horario_texto}`;

  return {
    title: punto.nombre,
    description: descripcion,
    openGraph: { title: punto.nombre, description: descripcion, url: urlPunto(punto.id) },
  };
}

export default async function PaginaPunto({ params }: PageProps<'/punto/[id]'>) {
  const { id } = await params;
  const punto = await obtenerPunto(id);
  if (!punto) notFound();

  const noRecibe = punto.categorias.filter((c) => c.nivel === 'no_recibe');

  return (
    <>
      <Encabezado />

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-7 px-5 py-8">
        <header className="flex flex-col gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            {punto.entidad_oficial && (
              <span className="rounded-full bg-emerald-600 px-2.5 py-0.5 text-xs font-semibold text-white">
                Entidad oficial
              </span>
            )}
            <SelloFrescura ultimaVerificacion={punto.ultima_verificacion} />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-balance">{punto.nombre}</h1>
          <p className="text-black/60 dark:text-white/60">
            {TIPOS_ORGANIZACION[punto.tipo_organizacion]} · {punto.municipio},{' '}
            {punto.departamento}
          </p>
        </header>

        <Acciones punto={punto} />

        {/* Antes que nada lo que NO hay que llevar: es lo único que se puede
            arruinar por completo si la persona ya salió de la casa. */}
        {noRecibe.length > 0 && (
          <section className="rounded-xl border-2 border-red-500/40 bg-red-500/5 p-4">
            <p className="mb-2 font-semibold text-red-800 dark:text-red-300">
              Por favor NO lleves esto
            </p>
            <ul className="flex flex-wrap gap-1.5">
              {noRecibe.map((c) => (
                <li
                  key={c.slug}
                  className="rounded-md bg-red-500/15 px-2 py-1 text-sm font-medium text-red-800 dark:text-red-300"
                >
                  {c.nombre}
                </li>
              ))}
            </ul>
          </section>
        )}

        <Seccion titulo="Qué reciben">
          <ListaCategorias categorias={punto.categorias} niveles={['alta', 'si']} />
          {punto.recibe_voluntarios && (
            <p className="mt-3 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-800 dark:text-emerald-300">
              También necesitan voluntarios
            </p>
          )}
        </Seccion>

        <Seccion titulo="Dónde">
          <p className="text-lg">{punto.direccion}</p>
          {punto.barrio && <p className="text-black/70 dark:text-white/70">Barrio {punto.barrio}</p>}
          {punto.referencia && (
            <p className="text-black/70 dark:text-white/70">Cómo ubicarlo: {punto.referencia}</p>
          )}
        </Seccion>

        <Seccion titulo="Cuándo">
          <p className="text-lg">{punto.horario_texto}</p>
          {(punto.fecha_inicio ?? punto.fecha_fin) && (
            <p className="text-black/70 dark:text-white/70">
              {punto.fecha_inicio && `Desde el ${formatearFecha(punto.fecha_inicio)}`}
              {punto.fecha_inicio && punto.fecha_fin && ' · '}
              {punto.fecha_fin && `Hasta el ${formatearFecha(punto.fecha_fin)}`}
            </p>
          )}
        </Seccion>

        <Seccion titulo="Quién responde">
          <p className="text-lg">{punto.responsable_nombre}</p>
          {punto.telefono ? (
            <p className="text-black/70 dark:text-white/70">{punto.telefono}</p>
          ) : (
            <p className="text-sm text-black/50 dark:text-white/50">
              No autorizaron publicar el teléfono.
            </p>
          )}
        </Seccion>

        {punto.notas && (
          <Seccion titulo="Más información">
            <p className="whitespace-pre-line text-black/80 dark:text-white/80">{punto.notas}</p>
          </Seccion>
        )}

        <a
          href={enlaceCompartir(
            `Punto de acopio en ${punto.municipio}: ${punto.nombre}, ${punto.direccion}. ${punto.horario_texto}.`,
            urlPunto(punto.id),
          )}
          className="rounded-lg border border-black/15 px-5 py-3 text-center text-sm font-semibold dark:border-white/20"
        >
          Compartir por WhatsApp
        </a>

        <p className="text-sm text-black/60 dark:text-white/60">{AVISOS.informacionDeTerceros}</p>
      </main>

      <PieDePagina />
    </>
  );
}

function Acciones({ punto }: { punto: PuntoPublico }) {
  const primario =
    'flex-1 rounded-lg bg-black px-4 py-3 text-center text-sm font-semibold text-white dark:bg-white dark:text-black';
  const secundario =
    'flex-1 rounded-lg border border-black/15 px-4 py-3 text-center text-sm font-semibold dark:border-white/20';

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <a href={enlaceGoogleMaps(punto.lat, punto.lng)} className={primario}>
          Cómo llegar
        </a>
        <a href={enlaceWaze(punto.lat, punto.lng)} className={secundario}>
          Abrir en Waze
        </a>
      </div>
      {punto.telefono && (
        <div className="flex gap-2">
          <a href={enlaceLlamada(punto.telefono)} className={secundario}>
            Llamar
          </a>
          {punto.whatsapp && (
            <a
              href={enlaceWhatsapp(
                punto.telefono,
                `Hola, vi el punto de acopio "${punto.nombre}" en UnAcopio. ¿Siguen recibiendo donaciones?`,
              )}
              className={secundario}
            >
              WhatsApp
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5 border-t border-black/10 pt-5 dark:border-white/15">
      <h2 className="text-sm font-medium uppercase tracking-wide text-black/50 dark:text-white/50">
        {titulo}
      </h2>
      {children}
    </section>
  );
}

function formatearFecha(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'long',
  });
}
