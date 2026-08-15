import { LICENCIA, cabeceras, consultarPuntos, leerConsulta, puntoParaApi } from '@/lib/api';

/**
 * GET /api/puntos.json
 *
 * Parámetros opcionales: `dep` (código DANE de 2 dígitos), `mun` (5 dígitos),
 * `cat` (slug de categoría) y `limite`.
 *
 * Devuelve exactamente lo que ve el público en el sitio: nada de correos, y el
 * teléfono solo cuando la persona autorizó publicarlo. La vista `puntos_publicos`
 * ya se encarga de eso, así que no hay forma de que esta ruta filtre de más.
 */
export const dynamic = 'force-dynamic';

export async function GET(peticion: Request) {
  const consulta = leerConsulta(new URL(peticion.url));

  try {
    const puntos = await consultarPuntos(consulta);

    return Response.json(
      {
        licencia: LICENCIA,
        generado_en: new Date().toISOString(),
        filtros: {
          departamento: consulta.departamento ?? null,
          municipio: consulta.municipio ?? null,
          categoria: consulta.categoria ?? null,
        },
        total: puntos.length,
        puntos: puntos.map(puntoParaApi),
      },
      { headers: cabeceras('application/json; charset=utf-8') },
    );
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'Error desconocido';
    return Response.json({ error: mensaje }, { status: 502, headers: cabeceras('application/json') });
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: cabeceras('text/plain') });
}
