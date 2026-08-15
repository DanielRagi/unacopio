/**
 * Comprueba contra el proyecto REAL de Supabase que las llaves sirven, que los
 * catálogos están cargados y —lo importante— que el rol anónimo sigue sin poder
 * leer la tabla `puntos`.
 *
 *   npm run db:verificar
 *
 * `npm run db:probar` valida el SQL en local; esto valida el proyecto de verdad,
 * que es donde una policy mal puesta hace daño.
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const servicio = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anon) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local');
  process.exit(1);
}

const cliente = createClient(url, anon, { auth: { persistSession: false } });
let fallas = 0;

const contar = async (tabla) => {
  const { count, error } = await cliente.from(tabla).select('*', { count: 'exact', head: true });
  if (error) { fallas++; return `ERROR: ${error.message}`; }
  return count;
};

console.log('Proyecto:', url.replace(/https:\/\/(.{4}).*/, 'https://$1…….supabase.co'));

console.log('\n— como anon (lo que ve el público) —');
console.log('departamentos   :', await contar('departamentos'));
console.log('municipios      :', await contar('municipios'));
console.log('categorias      :', await contar('categorias'));
console.log('puntos_publicos :', await contar('puntos_publicos'));

// Esto TIENE que fallar. Si algún día deja de fallar, hay una fuga de datos:
// correos, teléfonos sin consentimiento y los hashes de los tokens de edición.
const { error: fuga } = await cliente.from('puntos').select('id').limit(1);
if (fuga) {
  console.log('puntos (tabla)  : bloqueado ✓');
} else {
  console.log('puntos (tabla)  : ¡¡FUGA!! anon pudo leer la tabla base');
  fallas++;
}

const { error: rpcError } = await cliente.rpc('puntos_cercanos', {
  p_lat: 5.0689, p_lng: -75.5174, p_radio_m: 20000,
});
console.log('rpc cercanos    :', rpcError ? `ERROR: ${rpcError.message}` : 'responde ✓');
if (rpcError) fallas++;

if (servicio) {
  const admin = createClient(url, servicio, { auth: { persistSession: false } });
  const { count, error } = await admin.from('puntos').select('*', { count: 'exact', head: true });
  console.log('\n— con service_role —');
  console.log('puntos (todos)  :', error ? `ERROR: ${error.message}` : count);
  if (error) fallas++;
}

console.log(fallas === 0 ? '\n✓ el proyecto responde y RLS está en pie' : `\n✗ ${fallas} problema(s)`);
process.exit(fallas === 0 ? 0 : 1);
