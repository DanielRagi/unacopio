import { NextResponse, type NextRequest } from 'next/server';
import { clienteServidor } from '@/lib/supabase/servidor';

/**
 * Donde aterriza el enlace de acceso que llega por correo.
 *
 * Supabase manda acá con un `code`; se cambia por una sesión y las cookies
 * quedan puestas. Es el único camino de entrada al panel: no hay contraseñas.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const siguiente = searchParams.get('next') ?? '/admin';

  if (!code) {
    return NextResponse.redirect(`${origin}/admin?error=sin_codigo`);
  }

  const supabase = await clienteServidor();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/admin?error=enlace_invalido`);
  }

  return NextResponse.redirect(`${origin}${siguiente}`);
}
