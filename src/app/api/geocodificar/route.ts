/**
 * Intenta convertir una dirección escrita en un punto del mapa.
 *
 * Existe para que quien registra no tenga que buscar su cuadra arrastrando el
 * mapa desde el centro del municipio. Escribe la dirección, el pin se acerca, y
 * solo le queda ajustar — que es muy distinto de ubicarlo desde cero en un
 * celular, parado en la calle.
 *
 * **Acierta pocas veces, y es a propósito.** Nominatim entiende mal la
 * nomenclatura colombiana: "Carrera 79 # 52A-23, Medellín" no devuelve nada, y
 * la misma dirección escrita "Cra 79 #52A-23, Medellin" sí. Acá se normaliza
 * antes de preguntar, y aun así solo se acepta cuando resuelve la placa exacta.
 * Medido contra 22 direcciones reales del directorio, eso deja pasar pocas —
 * pero las que pasan caen donde deben. Aceptar también "la calle correcta"
 * subía el acierto al 23% con 3,6 km de error mediano, y un pin a cuatro
 * kilómetros que dice "te encontré" es peor que no mover nada.
 *
 * Cuando no resuelve no pasa nada: el mapa se queda donde estaba y la persona
 * lo mueve, o usa el botón de su ubicación —que estando en el punto es mucho
 * más confiable que cualquier geocodificador—.
 *
 * Va por el servidor y no directo desde el navegador por tres razones: la
 * política de Nominatim pide un User-Agent que identifique la aplicación y
 * desde el navegador no se puede fijar; acá se puede cachear, y en una
 * emergencia media cuadra registra direcciones parecidas; y la dirección de
 * quien registra no sale hacia un tercero con su IP.
 */

const AGENTE = 'UnAcopio/1.0 (directorio de puntos de acopio; https://unacopio.co; hola@unacopio.co)';

const cache = new Map<string, Resultado>();
const MAXIMO_CACHE = 500;

/** Una consulta por segundo, como pide la política de uso de Nominatim. */
let ultimaConsulta = 0;
const ESPERA_MS = 1100;

/** Más allá de esto no es un error de precisión, es otro lugar. */
const MAXIMO_KM = 25;

type Resultado = { lat: number; lng: number } | null;

const sinTildes = (t: string) => t.normalize('NFD').replace(/\p{M}/gu, '');

/**
 * La dirección como la entiende Nominatim.
 *
 * Se comprobó a mano contra su servicio: con "Carrera 79 # 52A-23" no devuelve
 * nada y con "Cra 79 #52A-23" sí. Las abreviaturas y la falta de espacio
 * después del numeral no son cosmética, son la diferencia entre que funcione y
 * que no.
 */
function normalizar(direccion: string): string {
  return sinTildes(direccion)
    .replace(/\bcarrera\b/gi, 'Cra')
    .replace(/\bcalle\b/gi, 'Cl')
    .replace(/\bavenida\b/gi, 'Av')
    .replace(/\bdiagonal\b/gi, 'Dg')
    .replace(/\btransversal\b/gi, 'Tv')
    .replace(/\bcircular\b/gi, 'Cq')
    .replace(/#\s+/g, '#')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

const distanciaKm = (a: [number, number], b: [number, number]) =>
  Math.hypot((a[0] - b[0]) * 111.32, (a[1] - b[1]) * 111.32 * Math.cos((a[0] * Math.PI) / 180));

export async function GET(peticion: Request) {
  const { searchParams } = new URL(peticion.url);
  const direccion = (searchParams.get('direccion') ?? '').trim();
  const municipio = (searchParams.get('municipio') ?? '').trim();
  const centro: [number, number] = [
    Number(searchParams.get('lat')),
    Number(searchParams.get('lng')),
  ];

  // Sin un centro al que acotar no se pregunta: sin eso, "Calle 10" puede caer
  // en cualquiera de los mil municipios que tienen una.
  if (
    direccion.length < 6 || direccion.length > 160 || municipio.length < 2 ||
    !Number.isFinite(centro[0]) || !Number.isFinite(centro[1])
  ) {
    return Response.json({ resultado: null });
  }

  const consulta = `${normalizar(direccion)}, ${sinTildes(municipio)}, Colombia`;
  const clave = consulta.toLowerCase();
  if (cache.has(clave)) return Response.json({ resultado: cache.get(clave) });

  const espera = ESPERA_MS - (Date.now() - ultimaConsulta);
  if (espera > 0) await new Promise((r) => setTimeout(r, espera));
  ultimaConsulta = Date.now();

  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', consulta);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('limit', '1');
  url.searchParams.set('countrycodes', 'co');
  // Acotado al municipio: es la primera defensa contra que "Carrera 79"
  // resuelva en otra ciudad.
  url.searchParams.set(
    'viewbox',
    [centro[1] - 0.3, centro[0] + 0.3, centro[1] + 0.3, centro[0] - 0.3].join(','),
  );
  url.searchParams.set('bounded', '1');

  let resultado: Resultado = null;

  try {
    const respuesta = await fetch(url, {
      headers: { 'User-Agent': AGENTE },
      signal: AbortSignal.timeout(6000),
    });
    if (respuesta.ok) {
      const [primero] = await respuesta.json();
      if (primero) {
        const punto: [number, number] = [Number(primero.lat), Number(primero.lon)];
        // La segunda defensa, por si `bounded` no alcanza: más de 25 km del
        // centro del municipio no es imprecisión, es otro lugar.
        /*
         * Solo la placa exacta. Nada de "la calle correcta".
         *
         * Se midió contra 22 direcciones reales de nuestros propios puntos:
         * aceptando resultados a nivel de vía, resolvía el 23% pero con una
         * mediana de error de 3,6 km — dos de cinco cayeron a más de 4 km. Y un
         * pin a cuatro kilómetros con un mensaje que dice "encontramos la
         * calle" es peor que no mover nada, porque invita a confiar.
         *
         * Con este filtro acierta pocas veces y siempre bien. Es la misma
         * lección del pilotaje: mejor no responder que responder mal con cara
         * de precisión.
         */
        if (primero.address?.house_number && distanciaKm(punto, centro) <= MAXIMO_KM) {
          resultado = { lat: punto[0], lng: punto[1] };
        }
      }
    }
  } catch {
    // Sin red, o tardó demasiado. El mapa se queda donde está.
  }

  if (cache.size >= MAXIMO_CACHE) cache.delete(cache.keys().next().value!);
  cache.set(clave, resultado);

  return Response.json({ resultado });
}
