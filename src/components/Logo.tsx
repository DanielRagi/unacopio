/**
 * La marca: una caja de donaciones abierta, con un pin del mapa saliendo, y el
 * pin lleva la bandera de Colombia.
 *
 * La caja dice "esto es sobre donaciones", el pin dice "esto es sobre dónde", y
 * la bandera dice "esto es acá". Son las tres cosas que alguien necesita
 * entender de este sitio antes de leer una palabra.
 *
 * Va dibujada en SVG y no en un archivo de imagen para que herede el color del
 * texto —se ve igual en claro y en oscuro— y para no pedir una segunda descarga
 * en la conexión de alguien que está en la calle.
 *
 * Los amarillos, azules y rojos son los del pabellón nacional: #FCD116, #003893
 * y #CE1126. No se ajustan "para que combinen": una bandera aproximada se ve mal
 * justo para quien la reconoce.
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
      <defs>
        {/* El pin se recorta con su propia forma para que las franjas de la
            bandera lleguen justo hasta el borde. */}
        <clipPath id="unacopio-pin">
          <path d="M24 2.5c-4.7 0-8.5 3.7-8.5 8.4 0 5.7 8.5 12.8 8.5 12.8s8.5-7.1 8.5-12.8c0-4.7-3.8-8.4-8.5-8.4Z" />
        </clipPath>
      </defs>

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

      {/* El pin, con la bandera adentro: amarillo a la mitad, azul y rojo a un
          cuarto cada uno, que es la proporción real. */}
      <g clipPath="url(#unacopio-pin)">
        <rect x="14" y="2" width="20" height="11" fill="#FCD116" />
        <rect x="14" y="13" width="20" height="5.5" fill="#003893" />
        <rect x="14" y="18.5" width="20" height="6" fill="#CE1126" />
      </g>
      <path
        d="M24 2.5c-4.7 0-8.5 3.7-8.5 8.4 0 5.7 8.5 12.8 8.5 12.8s8.5-7.1 8.5-12.8c0-4.7-3.8-8.4-8.5-8.4Z"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * La bandera como una franja delgada. Se usa de remate en el encabezado y el
 * pie: pone el país sin robarle atención a lo que la gente vino a buscar.
 */
export function FranjaBandera({ className = '' }: { className?: string }) {
  return (
    <div aria-hidden className={`flex h-1 w-full ${className}`}>
      <span className="h-full flex-[2] bg-[#FCD116]" />
      <span className="h-full flex-1 bg-[#003893]" />
      <span className="h-full flex-1 bg-[#CE1126]" />
    </div>
  );
}
