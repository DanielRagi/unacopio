import { estadoApertura, leerHorarios } from '@/lib/horarios';

/**
 * "Abierto ahora" / "Cerrado ahora, abre …".
 *
 * Se calcula en el servidor, en hora de Colombia, en cada carga. No aparece
 * cuando el punto no tiene horario estructurado —los registros viejos y los que
 * cargó moderación a mano—: mejor no decir nada que afirmar algo que no sabemos.
 *
 * Decir cuándo abre, y no solo que está cerrado, es la mitad de la utilidad:
 * quien lee a las 7 de la noche quiere saber si le sirve ir mañana temprano.
 */
export function SelloAbierto({
  horarios,
  fechaInicio,
  fechaFin,
}: {
  horarios: unknown;
  fechaInicio: string | null;
  fechaFin: string | null;
}) {
  const estado = estadoApertura(leerHorarios(horarios), fechaInicio, fechaFin);
  if (!estado) return null;

  if (estado.estado === 'abierto') {
    return (
      <span className="rounded-full bg-emerald-500/20 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
        Abierto ahora · cierra {estado.cierraA}
      </span>
    );
  }

  return (
    <span className="rounded-full bg-black/[0.08] px-2.5 py-1 text-xs font-medium text-black/70 dark:bg-white/10 dark:text-white/70">
      Cerrado ahora{estado.abreEn ? ` · abre ${estado.abreEn}` : ''}
    </span>
  );
}
