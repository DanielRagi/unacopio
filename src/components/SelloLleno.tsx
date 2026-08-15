/**
 * Marca de "hoy no reciben más".
 *
 * Los puntos llenos siguen apareciendo en el directorio en vez de desaparecer.
 * Quitarlos salía peor: quien se enteró por la radio o por un audio de WhatsApp
 * iba de todos modos, y no teníamos dónde decirle que no fuera.
 */
export function SelloLleno({ grande = false }: { grande?: boolean }) {
  return (
    <span
      className={`rounded-full bg-amber-500/25 font-semibold text-amber-900 dark:text-amber-200 ${
        grande ? 'px-3 py-1 text-sm' : 'px-2.5 py-1 text-xs'
      }`}
    >
      Hoy no reciben más
    </span>
  );
}
