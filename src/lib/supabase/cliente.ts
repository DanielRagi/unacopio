import { createBrowserClient } from '@supabase/ssr';

/**
 * Cliente de Supabase para componentes con "use client".
 * Solo para lo que de verdad necesita el navegador: el mapa y la búsqueda por
 * cercanía. El listado y el detalle se renderizan en el servidor.
 */
export function clienteNavegador() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
