import { createClient } from '@supabase/supabase-js';

/**
 * Cliente con llave de servicio: SALTA RLS POR COMPLETO.
 *
 * Solo para el flujo de edición por token, donde el servidor ya validó el hash
 * del token, y para tareas de mantenimiento. Nunca importar desde un archivo
 * con "use client".
 */
export function clienteAdmin() {
  const llave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!llave) throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY');

  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, llave, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
