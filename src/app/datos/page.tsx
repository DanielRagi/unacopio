import type { Metadata } from 'next';
import Link from 'next/link';
import { Encabezado } from '@/components/Encabezado';
import { PieDePagina } from '@/components/PieDePagina';
import { LICENCIA } from '@/lib/api';
import { SITIO } from '@/lib/textos';

/**
 * La página que hace que la API sirva de algo.
 *
 * Una API sin una página que la explique en español no la usa nadie en una
 * alcaldía ni en una sala de redacción, que es justo donde tiene que llegar
 * para que no aparezca una sexta lista paralela.
 */

export const metadata: Metadata = {
  title: 'Datos abiertos',
  description:
    'Descarga la lista de puntos de acopio en CSV o JSON. Datos abiertos, sin llave, ' +
    'con licencia CC BY 4.0. Para medios, alcaldías y quien quiera reutilizarlos.',
  alternates: { canonical: '/datos' },
};

const EJEMPLOS = [
  { url: '/api/puntos.json', que: 'Todos los puntos publicados, en JSON.' },
  { url: '/api/puntos.csv', que: 'Lo mismo en CSV, para abrir en Excel.' },
  { url: '/api/puntos.json?dep=05', que: 'Solo Antioquia (código DANE del departamento).' },
  { url: '/api/puntos.csv?mun=05001', que: 'Solo Medellín (código DANE del municipio).' },
  {
    url: '/api/puntos.json?cat=agua_embotellada',
    que: 'Solo los puntos que reciben agua embotellada.',
  },
];

const CAMPOS = [
  ['nombre, direccion, barrio, referencia', 'Dónde queda, como lo escribió quien lo registró.'],
  ['lat, lng', 'Coordenadas del pin, en WGS84.'],
  ['estado', '`publicado` o `lleno`. Un punto lleno hoy no recibe más.'],
  ['telefono, whatsapp', 'Solo si la persona autorizó publicarlo. Si no, van vacíos.'],
  ['horario_texto', 'El horario en lenguaje humano.'],
  ['horarios', 'El mismo horario estructurado: día (0=domingo), desde, hasta.'],
  ['necesita_urgente', 'Slugs de lo que más falta en ese punto.'],
  ['no_recibe', 'Slugs de lo que NO hay que llevar. El campo más útil de todos.'],
  ['entidad_oficial', 'Alcaldía, bomberos, Defensa Civil o Cruz Roja, confirmado por teléfono.'],
  ['ultima_verificacion', 'Cuándo se confirmó por última vez, llamando.'],
];

export default function PaginaDatos() {
  return (
    <>
      <Encabezado />

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-5 py-8">
        <section className="flex flex-col gap-3">
          <h1 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            Datos abiertos
          </h1>
          <p className="text-black/70 dark:text-white/70">
            Toda la información de {SITIO.nombre} se puede descargar y reutilizar,
            sin pedir permiso y sin llave de acceso. Si estás armando un mapa, una
            nota o el micrositio de tu alcaldía, usa esto en vez de copiar la lista
            a mano: así hay una sola lista que mantener y no cinco que se
            contradicen.
          </p>
        </section>

        <section className="flex flex-wrap gap-3">
          <a
            href="/api/puntos.csv"
            className="rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white dark:bg-emerald-600"
          >
            Descargar CSV
          </a>
          <a
            href="/api/puntos.json"
            className="rounded-lg border border-black/15 px-5 py-2.5 text-sm font-medium hover:border-black/35 dark:border-white/20 dark:hover:border-white/40"
          >
            Ver el JSON
          </a>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Cómo se pide</h2>
          <p className="text-sm text-black/70 dark:text-white/70">
            Todo son peticiones <code className="font-mono text-[0.9em]">GET</code>,
            sin autenticación y con CORS abierto: se pueden llamar desde el
            navegador. La respuesta se cachea cinco minutos.
          </p>
          <ul className="flex flex-col gap-2">
            {EJEMPLOS.map(({ url, que }) => (
              <li
                key={url}
                className="flex flex-col gap-1 rounded-lg border border-black/10 p-3 dark:border-white/15"
              >
                <a
                  href={url}
                  className="font-mono text-sm break-all underline underline-offset-4"
                >
                  {url}
                </a>
                <span className="text-sm text-black/65 dark:text-white/65">{que}</span>
              </li>
            ))}
          </ul>
          <p className="text-sm text-black/65 dark:text-white/65">
            Los filtros se combinan y también aceptan{' '}
            <code className="font-mono text-[0.9em]">limite</code> (máximo 500).
            Los códigos son los del DANE: dos dígitos para departamento, cinco
            para municipio.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Qué trae cada punto</h2>
          <dl className="flex flex-col gap-2 text-sm">
            {CAMPOS.map(([campo, descripcion]) => (
              <div
                key={campo}
                className="grid gap-1 border-b border-black/8 pb-2 sm:grid-cols-[minmax(0,14rem)_1fr] sm:gap-4 dark:border-white/12"
              >
                <dt className="font-mono text-[0.85rem] break-words">{campo}</dt>
                <dd className="text-black/70 dark:text-white/70">{descripcion}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="flex flex-col gap-3 rounded-xl border border-black/10 p-4 dark:border-white/15 sm:p-5">
          <h2 className="text-lg font-semibold">Lo que no vas a encontrar</h2>
          <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm text-black/70 dark:text-white/70">
            <li>
              Correos electrónicos. No se publican nunca, de nadie.
            </li>
            <li>
              Teléfonos de quien no autorizó publicarlos. El campo va vacío, no
              enmascarado a medias.
            </li>
            <li>
              Puntos pendientes de revisión, rechazados o cerrados. Solo sale lo
              que moderación ya confirmó por teléfono.
            </li>
          </ul>
          <p className="text-sm text-black/65 dark:text-white/65">
            Si reutilizas los teléfonos, ten presente que las personas
            autorizaron publicarlos para que los donantes las contacten (Ley 1581
            de 2012). Usarlos para otra cosa es problema tuyo, y de la ley.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Licencia</h2>
          <p className="text-sm text-black/70 dark:text-white/70">
            <a
              href={LICENCIA.url}
              rel="license noreferrer"
              target="_blank"
              className="font-medium underline underline-offset-4"
            >
              {LICENCIA.nombre}
            </a>
            : haz lo que quieras con los datos, incluso comercialmente, siempre
            que digas de dónde salieron. La atribución que pedimos es{' '}
            <span className="font-medium">{LICENCIA.atribucion}</span>.
          </p>
          <p className="text-sm text-black/65 dark:text-white/65">
            La información la aportan las personas que organizan cada punto y se
            confirma llamando. Puede estar desactualizada: cada punto trae{' '}
            <code className="font-mono text-[0.9em]">ultima_verificacion</code>{' '}
            para que sepas qué tan vieja es.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">¿Tienes una lista para aportar?</h2>
          <p className="text-sm text-black/70 dark:text-white/70">
            Si tu alcaldía o tu medio ya tiene una lista de puntos de acopio,
            escríbenos a{' '}
            <a
              href={`mailto:${SITIO.correo}?subject=${encodeURIComponent('Lista de puntos de acopio')}`}
              className="font-medium underline underline-offset-4"
            >
              {SITIO.correo}
            </a>{' '}
            y la cargamos: no hay que volver a digitarla punto por punto. Sirve
            un Excel, un CSV o hasta la lista pegada en el cuerpo del correo.
            Cada punto entra a la cola de verificación y se publica cuando
            alguien confirme por teléfono.{' '}
            <Link href="/acopio" className="font-medium underline underline-offset-4">
              Mira en qué municipios ya hay puntos
            </Link>
            .
          </p>
        </section>
      </main>

      <PieDePagina />
    </>
  );
}
