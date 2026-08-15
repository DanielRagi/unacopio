/**
 * Enlace de acceso a moderación sin pasar por el correo.
 *
 *   npm run acceso -- tu@correo.com
 *   npm run acceso -- tu@correo.com --url https://unacopio.co
 *
 * Es la salida de emergencia para cuando el correo no coopera: el SMTP está a
 * medio configurar, el enlace llega gastado porque un antivirus lo abrió, o
 * simplemente no llega. Genera el mismo token que mandaría Supabase, pero lo
 * imprime en la terminal en vez de mandarlo.
 *
 * Cómo funciona: `auth.admin.generateLink` crea el token de un solo uso sin
 * enviar nada. Con él se arma una URL que apunta a `/auth/confirmar` con
 * `token_hash`, que es el camino que **no** necesita la cookie del verificador
 * PKCE. Por eso el enlace sirve en cualquier navegador, incluso en uno de
 * incógnito.
 *
 * Qué NO es: no crea usuarios ni salta permisos. Solo genera un enlace para un
 * correo que ya exista en `auth.users`; entrar al panel sigue exigiendo la fila
 * en `perfiles`. Es la misma puerta, con otra llave.
 *
 * Necesita `SUPABASE_SERVICE_ROLE_KEY`, así que corre solo desde una terminal
 * con acceso a `.env.local`. Nunca desde la aplicación.
 */
import { createClient } from '@supabase/supabase-js';

const argumentos = process.argv.slice(2);
const correo = argumentos.find((a) => a.includes('@'));
const indiceUrl = argumentos.indexOf('--url');
const base = (indiceUrl >= 0 ? argumentos[indiceUrl + 1] : null) ?? 'http://localhost:3000';

if (!correo) {
  console.error('Falta el correo.\n\n  npm run acceso -- tu@correo.com\n');
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const servicio = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !servicio) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local');
  process.exit(1);
}

const db = createClient(url, servicio, { auth: { persistSession: false } });

const { data, error } = await db.auth.admin.generateLink({
  type: 'magiclink',
  email: correo,
  options: { redirectTo: `${base.replace(/\/$/, '')}/auth/confirmar` },
});

if (error) {
  console.error(`\nNo se pudo generar el enlace: ${error.message}`);
  if (/not found/i.test(error.message)) {
    console.error('Ese correo no existe en auth.users. Invítalo primero desde Supabase.\n');
  }
  process.exit(1);
}

const { hashed_token: token } = data.properties;
const enlace = `${base.replace(/\/$/, '')}/auth/confirmar?token_hash=${token}&type=magiclink`;

// Se avisa si la cuenta todavía no es moderadora: el enlace va a funcionar y la
// sesión va a quedar puesta, pero el panel va a decir "sin permisos", y sin este
// aviso uno cree que el enlace falló.
const { data: perfil } = await db.from('perfiles').select('nombre, rol').eq(
  'id',
  data.user.id,
).maybeSingle();

console.log(`\n  Enlace de acceso para ${correo}`);
console.log(`  ${perfil ? `Perfil: ${perfil.nombre ?? '—'} (${perfil.rol})` : 'SIN PERFIL en `perfiles`: va a entrar pero sin permisos'}`);
console.log(`\n${enlace}\n`);
console.log('  Se usa una sola vez y se vence en una hora. Sirve en cualquier navegador.');
console.log('  Si apuntas a producción: npm run acceso -- correo --url https://unacopio.co\n');
