/**
 * La marca: una caja de donaciones abierta, con el pin del mapa saliendo.
 *
 * Dibujada en SVG y no en un archivo de imagen para que herede el color del
 * texto y se vea igual en claro y en oscuro, sin pedir una segunda descarga en
 * la conexión de alguien que está en la calle.
 *
 * La caja dice "esto es sobre donaciones" y el pin dice "esto es sobre dónde".
 * Son las dos únicas cosas que el sitio hace.
 */
export function Logo({ className = 'size-9' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      role="img"
      aria-label="UnAcopio"
      fill="none"
    >
      {/* Caja */}
      <path
        d="M8 20h32v18a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4V20Z"
        className="fill-emerald-700 dark:fill-emerald-500"
      />
      {/* Tapa */}
      <path
        d="M6 13h36a2 2 0 0 1 2 2v5H4v-5a2 2 0 0 1 2-2Z"
        className="fill-emerald-800 dark:fill-emerald-400"
      />
      {/* El pin que sale de la caja */}
      <path
        d="M24 3c-4.4 0-8 3.5-8 7.9 0 5.4 8 12.1 8 12.1s8-6.7 8-12.1C32 6.5 28.4 3 24 3Z"
        className="fill-amber-500"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <circle cx="24" cy="10.5" r="2.6" className="fill-white" />
    </svg>
  );
}
