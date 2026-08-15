import { frescura, haceCuanto } from '@/lib/textos';

/**
 * Semáforo de qué tan confiable es la información de un punto.
 *
 * Un directorio de emergencia se muere por información vieja, no por falta de
 * registros. Decir en la cara "esto no se verifica hace 4 días" es más útil que
 * mostrarlo como si fuera dato fresco.
 */
export function SelloFrescura({ ultimaVerificacion }: { ultimaVerificacion: string | null }) {
  const estado = frescura(ultimaVerificacion);

  const estilos = {
    fresca: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300',
    tibia: 'bg-amber-500/15 text-amber-800 dark:text-amber-300',
    vieja: 'bg-black/10 text-black/60 dark:bg-white/10 dark:text-white/60',
  }[estado];

  const texto = ultimaVerificacion
    ? `Verificado ${haceCuanto(ultimaVerificacion)}`
    : 'Sin verificar';

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${estilos}`}>
      {texto}
      {estado === 'vieja' && ultimaVerificacion && ' · puede estar desactualizado'}
    </span>
  );
}
