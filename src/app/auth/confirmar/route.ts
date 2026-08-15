import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { clienteServidor } from '@/lib/supabase/servidor';

/**
 * Donde aterriza el enlace de acceso que llega por correo.
 *
 * Supabase puede mandar acá de tres formas distintas, y hay que atender las
 * tres o el error se ve siempre igual —«el enlace caducó»— sin importar qué
 * pasó de verdad:
 *
 *   1. `token_hash` + `type`. Es el camino bueno para un servidor: se verifica
 *      con `verifyOtp` y no necesita la cookie del verificador PKCE, así que
 *      funciona aunque el correo se abra en otro navegador o en otro equipo.
 *      Es lo que usa la plantilla de `supabase/correos/`.
 *   2. `code`. El flujo PKCE. Solo sirve en el mismo navegador que pidió el
 *      enlace, porque el verificador quedó en una cookie de ese navegador.
 *   3. `error` / `error_code`. Supabase ya rechazó el token y nos lo cuenta.
 *
 * Un detalle que cuesta horas si no se sabe: cuando Supabase falla **antes** de
 * llegar acá, manda el motivo en el *fragmento* de la URL (`#error=...`), y el
 * fragmento no viaja al servidor. Por eso el fallo se ve como «vino sin código»
 * y no como «caducó». `AvisoDeFragmento`, en la página de /admin, lo lee desde
 * el navegador y lo traduce.
 */

const TIPOS: EmailOtpType[] = ['magiclink', 'signup', 'invite', 'recovery', 'email_change', 'email'];

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const siguiente = searchParams.get('next') ?? '/admin';

  // Supabase ya dijo que no. Se pasa su motivo tal cual: es más útil que el
  // nuestro, y evita inventar una explicación.
  const errorSupabase = searchParams.get('error_code') ?? searchParams.get('error');
  if (errorSupabase) {
    const detalle = searchParams.get('error_description') ?? errorSupabase;
    return NextResponse.redirect(
      `${origin}/admin?error=rechazado&detalle=${encodeURIComponent(detalle)}`,
    );
  }

  const supabase = await clienteServidor();

  const tokenHash = searchParams.get('token_hash');
  const tipo = searchParams.get('type');
  if (tokenHash) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: TIPOS.includes(tipo as EmailOtpType) ? (tipo as EmailOtpType) : 'email',
    });
    if (error) {
      return NextResponse.redirect(
        `${origin}/admin?error=enlace_invalido&detalle=${encodeURIComponent(error.message)}`,
      );
    }
    return NextResponse.redirect(`${origin}${siguiente}`);
  }

  const code = searchParams.get('code');
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(
        `${origin}/admin?error=otro_navegador&detalle=${encodeURIComponent(error.message)}`,
      );
    }
    return NextResponse.redirect(`${origin}${siguiente}`);
  }

  return NextResponse.redirect(`${origin}/admin?error=sin_codigo`);
}
