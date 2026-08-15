import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Encabezado } from '@/components/Encabezado';
import { FormularioSolicitud } from '@/components/FormularioSolicitud';
import { PieDePagina } from '@/components/PieDePagina';
import { obtenerPunto } from '@/lib/datos';

export const metadata: Metadata = {
  title: 'Solicitar un cambio',
  robots: { index: false, follow: false },
};

export default async function PaginaSolicitud({ params }: PageProps<'/punto/[id]/solicitud'>) {
  const { id } = await params;
  const punto = await obtenerPunto(id);
  if (!punto) notFound();

  return (
    <>
      <Encabezado />

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-7 px-5 py-8">
        <header className="flex flex-col gap-2">
          <Link
            href={`/punto/${punto.id}`}
            className="text-sm underline underline-offset-4"
          >
            ← {punto.nombre}
          </Link>
          <h1 className="text-3xl font-bold tracking-tight text-balance">
            Solicitar un cambio o el cierre
          </h1>
          <p className="text-black/70 dark:text-white/70">
            Nadie edita el directorio directamente: nos cuentas qué cambió y
            moderación lo actualiza. Así no hay contraseñas ni códigos que
            perder, y nadie puede modificar un punto ajeno.
          </p>
        </header>

        <FormularioSolicitud puntoId={punto.id} nombrePunto={punto.nombre} />
      </main>

      <PieDePagina />
    </>
  );
}
