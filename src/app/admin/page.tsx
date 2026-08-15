import type { Metadata } from 'next';
import Link from 'next/link';
import { cerrarSesion } from './acciones';
import { FilaModeracion } from '@/components/FilaModeracion';
import { FilaSolicitud } from '@/components/FilaSolicitud';
import { FormularioAcceso } from '@/components/FormularioAcceso';
import {
  contarPorEstado, contarSolicitudes, listarPuntosModeracion, listarSolicitudes,
  obtenerModerador,
} from '@/lib/datos';
import type { EstadoPunto } from '@/lib/tipos';

export const metadata: Metadata = {
  title: 'Moderación',
  robots: { index: false, follow: false },
};

const PESTANAS: { estado: EstadoPunto; etiqueta: string }[] = [
  { estado: 'pendiente', etiqueta: 'Por revisar' },
  { estado: 'publicado', etiqueta: 'Publicados' },
  { estado: 'cerrado', etiqueta: 'Cerrados' },
  { estado: 'rechazado', etiqueta: 'Rechazados' },
];

const ERRORES: Record<string, string> = {
  sin_codigo: 'El enlace venía incompleto. Pide uno nuevo.',
  enlace_invalido: 'Ese enlace ya se usó o se venció. Pide uno nuevo.',
};

export default async function PaginaAdmin({ searchParams }: PageProps<'/admin'>) {
  const params = await searchParams;
  const sesion = await obtenerModerador();

  if (!sesion) {
    const error = typeof params.error === 'string' ? ERRORES[params.error] : undefined;
    return (
      <Marco titulo="Moderación">
        {error && (
          <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm font-medium text-amber-900 dark:text-amber-200">
            {error}
          </p>
        )}
        <FormularioAcceso />
      </Marco>
    );
  }

  if (!sesion.perfil) {
    return (
      <Marco titulo="Sin permisos">
        <p className="text-black/70 dark:text-white/70">
          Entraste como <strong>{sesion.usuario.email}</strong>, pero esa cuenta
          no está en el equipo de moderación. Pídele a un administrador que te
          agregue a la tabla <code>perfiles</code>.
        </p>
        <form action={cerrarSesion}>
          <button type="submit" className="text-sm underline underline-offset-4">
            Salir
          </button>
        </form>
      </Marco>
    );
  }

  const enBandeja = params.vista === 'solicitudes';

  const estadoActivo =
    (typeof params.estado === 'string' &&
      PESTANAS.some((p) => p.estado === params.estado) &&
      (params.estado as EstadoPunto)) ||
    'pendiente';

  const [puntos, conteos, solicitudes, pendientesBandeja] = await Promise.all([
    enBandeja ? Promise.resolve([]) : listarPuntosModeracion(estadoActivo),
    contarPorEstado(),
    enBandeja ? listarSolicitudes() : Promise.resolve([]),
    contarSolicitudes(),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-5 py-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight">Moderación</h1>
          <p className="text-sm text-black/60 dark:text-white/60">
            {sesion.perfil.nombre ?? sesion.usuario.email} · {sesion.perfil.rol}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/" className="text-sm underline underline-offset-4">
            Ver el sitio
          </Link>
          <form action={cerrarSesion}>
            <button type="submit" className="text-sm underline underline-offset-4">
              Salir
            </button>
          </form>
        </div>
      </header>

      <nav className="flex flex-wrap gap-2">
        {PESTANAS.map((pestana) => {
          const activa = !enBandeja && pestana.estado === estadoActivo;
          return (
            <Pestana
              key={pestana.estado}
              href={`/admin?estado=${pestana.estado}`}
              activa={activa}
              cuenta={conteos[pestana.estado] ?? 0}
            >
              {pestana.etiqueta}
            </Pestana>
          );
        })}
        <Pestana href="/admin?vista=solicitudes" activa={enBandeja} cuenta={pendientesBandeja}>
          Solicitudes
        </Pestana>
      </nav>

      {enBandeja ? (
        solicitudes.length === 0 ? (
          <p className="rounded-xl border border-dashed border-black/20 p-6 text-black/60 dark:border-white/25 dark:text-white/60">
            No hay solicitudes sin atender.
          </p>
        ) : (
          <ul className="flex flex-col gap-4">
            {solicitudes.map((solicitud) => (
              <FilaSolicitud key={solicitud.id} solicitud={solicitud} />
            ))}
          </ul>
        )
      ) : (
        <>
      {estadoActivo === 'pendiente' && puntos.length > 0 && (
        <p className="rounded-lg bg-black/[0.03] p-3 text-sm text-black/70 dark:bg-white/5 dark:text-white/70">
          Antes de publicar, llama al responsable y confirma que el punto existe y
          sigue recibiendo. Publicar deja tu nombre y la fecha en el registro.
        </p>
      )}

      {puntos.length === 0 ? (
        <p className="rounded-xl border border-dashed border-black/20 p-6 text-black/60 dark:border-white/25 dark:text-white/60">
          {estadoActivo === 'pendiente'
            ? 'No hay nada por revisar. Cola limpia.'
            : 'No hay puntos en este estado.'}
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {puntos.map((punto) => (
            <FilaModeracion key={punto.id} punto={punto} />
          ))}
        </ul>
      )}
        </>
      )}
    </main>
  );
}

function Pestana({
  href,
  activa,
  cuenta,
  children,
}: {
  href: string;
  activa: boolean;
  cuenta: number;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded-lg px-3 py-2 text-sm font-medium ${
        activa
          ? 'bg-black text-white dark:bg-white dark:text-black'
          : 'border border-black/15 dark:border-white/20'
      }`}
    >
      {children}
      <span className={activa ? 'opacity-70' : 'opacity-50'}> {cuenta}</span>
    </Link>
  );
}

function Marco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-5 py-16">
      <h1 className="text-2xl font-bold tracking-tight">{titulo}</h1>
      {children}
    </main>
  );
}
