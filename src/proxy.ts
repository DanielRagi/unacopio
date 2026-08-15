import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Refresca la sesión de Supabase antes de que se rendericen las rutas de
 * moderación.
 *
 * Sin esto, el token de acceso se vence en una hora y el panel empieza a
 * responder "no autorizado" a mitad de turno. Solo corre en /admin: el resto del
 * sitio es público y no tiene por qué pagar este viaje.
 *
 * En Next 16 esto se llama `proxy`; antes era `middleware`.
 */
export async function proxy(request: NextRequest) {
  let respuesta = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (galletas) => {
          for (const { name, value } of galletas) request.cookies.set(name, value);
          respuesta = NextResponse.next({ request });
          for (const { name, value, options } of galletas) {
            respuesta.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Hay que llamarlo: es lo que dispara el refresco del token.
  await supabase.auth.getUser();

  return respuesta;
}

export const config = {
  matcher: ['/admin/:path*'],
};
