import type { Metadata } from 'next';
import Link from 'next/link';
import { cerrarSesion } from './acciones';
import { AvisoDeFragmento } from '@/components/AvisoDeFragmento';
import { FilaLlamada } from '@/components/FilaLlamada';
import { FilaModeracion } from '@/components/FilaModeracion';
import { FilaSolicitud } from '@/components/FilaSolicitud';
import { FormularioAcceso } from '@/components/FormularioAcceso';
import {
  contarPorEstado, contarSolicitudes, duplicadosDe, HORAS_FRESCURA,
  listarPorLlamar, listarPuntosModeracion, listarSolicitudes, obtenerModerador,
  type Duplicado,
} from '@/lib/datos';
import type { EstadoPunto } from '@/lib/tipos';

export const metadata: Metadata = {
  title: 'Moderación',
  robots: { index: false, follow: false },
};

const PESTANAS: { estado: EstadoPunto; etiqueta: string }[] = [
  { estado: 'pendiente', etiqueta: 'Por revisar' },
  { estado: 'publicado', etiqueta: 'Publicados' },
  { estado: 'lleno', etiqueta: 'Llenos' },
  { estado: 'cerrado', etiqueta: 'Cerrados' },
  { estado: 'rechazado', etiqueta: 'Rechazados' },
];

const ERRORES: Record<string, string> = {
  sin_codigo: 'El enlace venía incompleto. Pide uno nuevo, o usa el código de seis dígitos.',
  enlace_invalido:
    'Ese enlace ya se usó o se venció. Suele pasar cuando el antivirus del correo lo abre ' +
    'para revisarlo. Usa el código de seis dígitos del mismo correo.',
  otro_navegador:
    'Ese enlace solo sirve en el mismo navegador desde el que se pidió. Usa el código de ' +
    'seis dígitos, que funciona en cualquiera.',
  rechazado: 'Supabase rechazó el enlace.',
};

export default async function PaginaAdmin({ searchParams }: PageProps<'/admin'>) {
  const params = await searchParams;
  const sesion = await obtenerModerador();

  if (!sesion) {
    const error = typeof params.error === 'string' ? ERRORES[params.error] : undefined;
    // Lo que dijo Supabase, que casi siempre es más concreto que lo nuestro.
    const detalle = typeof params.detalle === 'string' ? params.detalle : undefined;
    return (
      <Marco titulo="Moderación">
        <AvisoDeFragmento />
        {error && (
          <div className="flex flex-col gap-1 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200">
            <p className="font-medium">{error}</p>
            {detalle && <p className="text-xs opacity-80">Supabase dijo: {detalle}</p>}
          </div>
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

  const vista = params.vista === 'solicitudes' || params.vista === 'llamadas'
    ? params.vista
    : 'puntos';

  const estadoActivo =
    (typeof params.estado === 'string' &&
      PESTANAS.some((p) => p.estado === params.estado) &&
      (params.estado as EstadoPunto)) ||
    'pendiente';

  const [puntos, conteos, solicitudes, pendientesBandeja, porLlamar] = await Promise.all([
    vista === 'puntos' ? listarPuntosModeracion(estadoActivo) : Promise.resolve([]),
    contarPorEstado(),
    vista === 'solicitudes' ? listarSolicitudes() : Promise.resolve([]),
    contarSolicitudes(),
    listarPorLlamar(),
  ]);

  // Solo se buscan duplicados en la cola de revisión, que es donde sirven: una
  // vez publicado, el punto ya pasó por ojos humanos.
  const duplicados = new Map<string, Duplicado[]>();
  if (vista === 'puntos' && estadoActivo === 'pendiente') {
    const encontrados = await Promise.all(
      puntos.map(async (p) => [p.id, await duplicadosDe(p.id)] as const),
    );
    for (const [id, lista] of encontrados) if (lista.length > 0) duplicados.set(id, lista);
  }

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
          <Link href="/admin/importar" className="text-sm underline underline-offset-4">
            Importar lista
          </Link>
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
        <Pestana
          href="/admin?vista=llamadas"
          activa={vista === 'llamadas'}
          cuenta={porLlamar.length}
        >
          Por llamar
        </Pestana>
        {PESTANAS.map((pestana) => (
          <Pestana
            key={pestana.estado}
            href={`/admin?estado=${pestana.estado}`}
            activa={vista === 'puntos' && pestana.estado === estadoActivo}
            cuenta={conteos[pestana.estado] ?? 0}
          >
            {pestana.etiqueta}
          </Pestana>
        ))}
        <Pestana
          href="/admin?vista=solicitudes"
          activa={vista === 'solicitudes'}
          cuenta={pendientesBandeja}
        >
          Solicitudes
        </Pestana>
      </nav>

      {vista === 'llamadas' && (
        <>
          <p className="rounded-lg bg-black/[0.03] p-3 text-sm text-black/70 dark:bg-white/5 dark:text-white/70">
            Ronda de verificación: llama y pregunta si siguen recibiendo. Sale lo
            que lleva más de {HORAS_FRESCURA} horas sin confirmarse, de lo más
            viejo a lo más nuevo. Al registrar el resultado el punto sale de la
            cola un rato, para que otro voluntario no marque el mismo número.
          </p>
          {porLlamar.length === 0 ? (
            <p className="rounded-xl border border-dashed border-black/20 p-6 text-black/60 dark:border-white/25 dark:text-white/60">
              Nada por llamar. Todo el directorio está confirmado.
            </p>
          ) : (
            <ul className="flex flex-col gap-4">
              {porLlamar.map((punto) => (
                <FilaLlamada key={punto.id} punto={punto} />
              ))}
            </ul>
          )}
        </>
      )}

      {vista === 'solicitudes' &&
        (solicitudes.length === 0 ? (
          <p className="rounded-xl border border-dashed border-black/20 p-6 text-black/60 dark:border-white/25 dark:text-white/60">
            No hay solicitudes sin atender.
          </p>
        ) : (
          <ul className="flex flex-col gap-4">
            {solicitudes.map((solicitud) => (
              <FilaSolicitud key={solicitud.id} solicitud={solicitud} />
            ))}
          </ul>
        ))}

      {vista === 'puntos' && (
        <>
          {estadoActivo === 'pendiente' && puntos.length > 0 && (
            <p className="rounded-lg bg-black/[0.03] p-3 text-sm text-black/70 dark:bg-white/5 dark:text-white/70">
              Antes de publicar, llama al responsable y confirma que el punto
              existe y sigue recibiendo. Publicar deja tu nombre y la fecha en el
              registro.
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
                <FilaModeracion
                  key={punto.id}
                  punto={punto}
                  duplicados={duplicados.get(punto.id) ?? []}
                />
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
