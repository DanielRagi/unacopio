import { aCsv, cabeceras, consultarPuntos, leerConsulta } from '@/lib/api';

/**
 * GET /api/puntos.csv
 *
 * Los mismos datos y los mismos filtros que `/api/puntos.json`, pero para quien
 * va a abrirlos en Excel y no va a escribir código. Es, de lejos, la forma en
 * que esto se va a consumir en una alcaldía.
 */
export const dynamic = 'force-dynamic';

export async function GET(peticion: Request) {
  const consulta = leerConsulta(new URL(peticion.url));

  try {
    const puntos = await consultarPuntos(consulta);
    return new Response(aCsv(puntos), {
      headers: cabeceras('text/csv; charset=utf-8', 'puntos-de-acopio.csv'),
    });
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'Error desconocido';
    return new Response(`error,${mensaje}\r\n`, {
      status: 502,
      headers: cabeceras('text/csv; charset=utf-8'),
    });
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: cabeceras('text/plain') });
}
