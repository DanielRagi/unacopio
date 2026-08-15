import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Cliente de Supabase para Server Components, Server Actions y Route Handlers.
 * Usa la llave anónima: todo lo que consulte pasa por RLS.
 *
 * En Next 16 `cookies()` es asíncrono, por eso esta función lo es.
 */
export async function clienteServidor() {
  const almacen = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => almacen.getAll(),
        setAll: (galletas) => {
          try {
            for (const { name, value, options } of galletas) {
              almacen.set(name, value, options);
            }
          } catch {
            // Llamado desde un Server Component: no se pueden escribir cookies.
            // Lo resuelve el refresco de sesión en el proxy; aquí se ignora.
          }
        },
      },
    },
  );
}
