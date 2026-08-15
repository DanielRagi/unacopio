/**
 * Los filtros del listado viven en la URL, no en el estado del cliente.
 *
 * Así el servidor puede renderizar la página completa, la búsqueda se puede
 * compartir por WhatsApp tal cual, y el botón de atrás del navegador funciona
 * como la gente espera. Este archivo es el único que sabe cómo se leen.
 */

export interface FiltrosUrl {
  dep?: string;
  mun?: string;
  cat?: string;
  lat?: number;
  lng?: number;
}

type Parametros = Record<string, string | string[] | undefined>;

function primerValor(v: string | string[] | undefined): string | undefined {
  const valor = Array.isArray(v) ? v[0] : v;
  return valor && valor.trim() !== '' ? valor.trim() : undefined;
}

function coordenada(v: string | string[] | undefined, min: number, max: number) {
  const texto = primerValor(v);
  if (!texto) return undefined;
  const numero = Number(texto);
  return Number.isFinite(numero) && numero >= min && numero <= max ? numero : undefined;
}

export function leerFiltros(params: Parametros): FiltrosUrl {
  let dep = primerValor(params.dep);
  let mun = primerValor(params.mun);

  // Los códigos DANE encajan: los 5 dígitos del municipio empiezan por los 2 del
  // departamento. Eso deja resolver el caso de quien cambia de departamento sin
  // cambiar el municipio, que si no filtraría por un municipio de otro lado.
  if (mun && dep && !mun.startsWith(dep)) mun = undefined;
  if (mun && !dep) dep = mun.slice(0, 2);

  const lat = coordenada(params.lat, -5, 14);
  const lng = coordenada(params.lng, -82, -66);

  return {
    dep,
    mun,
    cat: primerValor(params.cat),
    // Media coordenada no sirve para nada: o vienen las dos o ninguna.
    ...(lat !== undefined && lng !== undefined ? { lat, lng } : {}),
  };
}

/** Reconstruye la query string, para saltar entre el listado y el mapa. */
export function aQueryString(filtros: FiltrosUrl): string {
  const p = new URLSearchParams();
  if (filtros.dep) p.set('dep', filtros.dep);
  if (filtros.mun) p.set('mun', filtros.mun);
  if (filtros.cat) p.set('cat', filtros.cat);
  if (filtros.lat !== undefined && filtros.lng !== undefined) {
    p.set('lat', String(filtros.lat));
    p.set('lng', String(filtros.lng));
  }
  const cadena = p.toString();
  return cadena ? `?${cadena}` : '';
}
