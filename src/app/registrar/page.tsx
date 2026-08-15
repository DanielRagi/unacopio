import type { Metadata } from 'next';
import { Encabezado } from '@/components/Encabezado';
import { FormularioRegistro } from '@/components/FormularioRegistro';
import { PieDePagina } from '@/components/PieDePagina';
import { listarCategorias, listarDepartamentos } from '@/lib/datos';

export const metadata: Metadata = {
  title: 'Registrar un punto de acopio',
  description:
    'Publica tu punto de acopio para que la gente sepa dónde llevar donaciones, ' +
    'qué necesitas con urgencia y qué prefieres que no te lleven.',
};

export default async function PaginaRegistrar() {
  const [departamentos, categorias] = await Promise.all([
    listarDepartamentos(),
    listarCategorias(),
  ]);

  return (
    <>
      <Encabezado />

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-5 py-8">
        <header className="flex flex-col gap-3">
          <h1 className="text-3xl font-bold tracking-tight text-balance">
            Registra tu punto de acopio
          </h1>
          <p className="text-black/70 dark:text-white/70">
            Entre más claro esté qué necesitas y qué no, menos tiempo pierde tu
            equipo clasificando. Toma unos cinco minutos y no necesitas crear
            ninguna cuenta.
          </p>
        </header>

        <FormularioRegistro departamentos={departamentos} categorias={categorias} />
      </main>

      <PieDePagina />
    </>
  );
}
