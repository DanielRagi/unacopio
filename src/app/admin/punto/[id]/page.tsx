import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { FormularioEdicion, type PuntoEditable } from '@/components/FormularioEdicion';
import { listarCategorias, obtenerModerador, obtenerPuntoParaEditar } from '@/lib/datos';

export const metadata: Metadata = {
  title: 'Editar punto',
  robots: { index: false, follow: false },
};

export default async function PaginaEditar({ params }: PageProps<'/admin/punto/[id]'>) {
  const sesion = await obtenerModerador();
  if (!sesion?.perfil) redirect('/admin');

  const { id } = await params;
  const [punto, categorias] = await Promise.all([
    obtenerPuntoParaEditar(id),
    listarCategorias(),
  ]);
  if (!punto) notFound();

  const editable: PuntoEditable = {
    ...punto,
    categorias: Object.fromEntries(
      punto.punto_categoria.map((c) => [c.categoria_slug, c.nivel]),
    ),
  };

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-5 py-8">
      <header className="flex flex-col gap-1">
        <Link href="/admin" className="text-sm underline underline-offset-4">
          ← Moderación
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Editar punto</h1>
        <p className="text-sm text-black/60 dark:text-white/60">
          Aquí se aplica lo que sale de las llamadas y de las solicitudes.
          Guardar deja el punto marcado como verificado ahora mismo.
        </p>
      </header>

      <FormularioEdicion punto={editable} categorias={categorias} />
    </main>
  );
}
