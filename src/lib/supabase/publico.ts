import { createClient } from '@supabase/supabase-js';

/**
 * Cliente anónimo sin cookies, para lo que se sirve igual a todo el mundo.
 *
 * `clienteServidor` lee cookies para saber si hay sesión de moderador, y eso
 * vuelve dinámica cualquier ruta que lo use. La API abierta no depende de quién
 * pregunte, así que usa este y se puede cachear en el borde.
 */
export function clientePublico() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
