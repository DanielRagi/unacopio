import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { FormularioImportacion } from '@/components/FormularioImportacion';
import { listarCategorias, obtenerModerador } from '@/lib/datos';
import { GRUPOS, TIPOS_ORGANIZACION } from '@/lib/textos';
import type { GrupoCategoria } from '@/lib/tipos';

export const metadata: Metadata = {
  title: 'Importar una lista',
  robots: { index: false, follow: false },
};

export default async function PaginaImportar() {
  const sesion = await obtenerModerador();
  if (!sesion?.perfil) redirect('/admin');

  const categorias = await listarCategorias();

  const porGrupo = new Map<GrupoCategoria, string[]>();
  for (const c of categorias) {
    porGrupo.set(c.grupo, [...(porGrupo.get(c.grupo) ?? []), c.slug]);
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-7 px-5 py-8">
      <header className="flex flex-col gap-2">
        <Link href="/admin" className="text-sm underline underline-offset-4">
          ← Volver a moderación
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Importar una lista</h1>
        <p className="text-black/70 dark:text-white/70">
          Para las listas que ya existen: el Excel de la alcaldía, la nota del
          periódico, la hoja que armó un voluntario. Todo entra como{' '}
          <strong>pendiente</strong> y se publica cuando alguien llame a
          confirmar, igual que un registro del formulario.
        </p>
      </header>

      <section className="flex flex-col gap-3 rounded-xl border border-amber-600/30 bg-amber-50 p-4 text-sm dark:border-amber-400/25 dark:bg-amber-950/30">
        <p className="font-semibold">Antes de cargar</p>
        <ul className="flex list-disc flex-col gap-1.5 pl-5 text-black/75 dark:text-white/75">
          <li>
            Los teléfonos <strong>no</strong> quedan públicos. Copiar un número
            de una publicación no es la autorización que pide la Ley 1581; eso se
            pide en la llamada y se marca a mano.
          </li>
            <li>
            Guarda de dónde salió la lista en <code>fuente_nombre</code> y{' '}
            <code>fuente_url</code>. Cuando alguien pregunte por qué está ese
            punto ahí, la respuesta tiene que existir.
          </li>
          <li>
            Revisa duplicados después: los puntos importados salen en la cola de
            pendientes con el aviso de «hay otro a menos de 200 m».
          </li>
        </ul>
      </section>

      <FormularioImportacion />

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Cómo tiene que venir el archivo</h2>
        <p className="text-sm text-black/70 dark:text-white/70">
          Una fila por punto, con encabezados en la primera línea. Sirve separado
          por comas o por punto y coma (que es como exporta Excel en español).{' '}
          <a href="/admin/importar/plantilla.csv" className="font-medium underline underline-offset-4">
            Descarga la plantilla
          </a>{' '}
          y mándasela a quien tenga la lista.
        </p>

        <dl className="flex flex-col gap-2 text-sm">
          <Campo nombre="nombre, direccion" obligatorio>
            Lo único que no se puede deducir ni preguntar después.
          </Campo>
          <Campo nombre="municipio_codigo o municipio" obligatorio>
            El código DANE de 5 dígitos, o el nombre. Si el nombre existe en
            varios departamentos, toca el código.
          </Campo>
          <Campo nombre="lat, lng">
            Si no vienen, el punto queda en el centro del municipio y hay que
            afinarlo al editar. Acepta coma decimal.
          </Campo>
          <Campo nombre="tipo_organizacion">
            El slug o la etiqueta: {Object.values(TIPOS_ORGANIZACION).slice(0, 5).join(', ')}…
            Si no se reconoce, queda como particular.
          </Campo>
          <Campo nombre="telefono, responsable_nombre">
            Sin teléfono el punto no se puede verificar por llamada, así que se
            queda en pendientes para siempre.
          </Campo>
          <Campo nombre="necesita_urgente, recibe, no_recibe">
            Slugs de categoría separados por punto y coma. Ver la lista abajo.
          </Campo>
          <Campo nombre="horario_texto, barrio, referencia, notas">
            Opcionales, se copian tal cual.
          </Campo>
          <Campo nombre="fuente_nombre, fuente_url">
            De dónde salió el dato. No se publica; es para moderación.
          </Campo>
        </dl>
      </section>

      <details className="rounded-xl border border-black/10 p-4 dark:border-white/15">
        <summary className="cursor-pointer text-sm font-medium">
          Slugs de categoría ({categorias.length})
        </summary>
        <div className="mt-3 flex flex-col gap-3">
          {[...porGrupo.entries()].map(([grupo, slugs]) => (
            <div key={grupo} className="flex flex-col gap-1">
              <p className="text-xs font-semibold text-black/60 dark:text-white/60">
                {GRUPOS[grupo]}
              </p>
              <p className="font-mono text-xs break-words text-black/70 dark:text-white/70">
                {slugs.join(' · ')}
              </p>
            </div>
          ))}
        </div>
      </details>
    </main>
  );
}

function Campo({
  nombre,
  obligatorio,
  children,
}: {
  nombre: string;
  obligatorio?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1 border-b border-black/8 pb-2 sm:grid-cols-[minmax(0,15rem)_1fr] sm:gap-4 dark:border-white/12">
      <dt className="font-mono text-[0.85rem] break-words">
        {nombre}
        {obligatorio && <span className="ml-1 font-sans text-red-700 dark:text-red-400">*</span>}
      </dt>
      <dd className="text-black/70 dark:text-white/70">{children}</dd>
    </div>
  );
}
