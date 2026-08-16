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

// PostgREST corta en 1.000 filas sin avisar, y los municipios son 1.122. Quien
// se traiga el catálogo entero TIENE que paginar; si no, se queda con un
// subconjunto arbitrario. Le pasó al importador: Bogotá quedaba fuera y el error
// decía «el código DANE "11001" no existe».
const pagina = [];
for (let desde = 0; ; desde += 1000) {
  const { data } = await cliente
    .from('municipios').select('codigo').order('codigo').range(desde, desde + 999);
  pagina.push(...(data ?? []));
  if (!data || data.length < 1000) break;
}
const completo = pagina.length === 1122 && pagina.some((m) => m.codigo === '11001');
console.log('catálogo paginado:', completo ? `${pagina.length} municipios, con Bogotá ✓` : `INCOMPLETO (${pagina.length})`);
if (!completo) fallas++;

// La portada llama esto sin sesión para abrir en la ciudad de quien entra.
// Bogotá es el caso que importa: su centroide DANE cae en el páramo de Sumapaz,
// así que resolver por cercanía la mandaba a Cota. Tiene que ganar el nombre.
const { data: ciudad, error: errCiudad } = await cliente.rpc('municipio_de_ubicacion', {
  p_ciudad: 'Bogota', p_lat: 4.6486, p_lng: -74.0819,
});
const bogotaOk = !errCiudad && ciudad?.[0]?.codigo === '11001' && ciudad[0].por === 'nombre';
console.log(
  'municipio por IP:',
  bogotaOk
    ? 'Bogotá ✓ (por nombre)'
    : `revisar — ${errCiudad?.message ?? `${ciudad?.[0]?.nombre ?? 'sin resultado'} (${ciudad?.[0]?.por ?? '—'})`}`,
);
if (!bogotaOk) fallas++;

const { error: rpcError } = await cliente.rpc('buscar_puntos', {
  p_lat: 5.0689, p_lng: -75.5174, p_radio_m: 20000,
});
console.log('rpc buscar      :', rpcError ? `ERROR: ${rpcError.message}` : 'responde ✓');
if (rpcError) fallas++;

if (servicio) {
  const admin = createClient(url, servicio, { auth: { persistSession: false } });
  const { count, error } = await admin.from('puntos').select('*', { count: 'exact', head: true });
  console.log('\n— con service_role —');
  console.log('puntos (todos)  :', error ? `ERROR: ${error.message}` : count);
  if (error) fallas++;

  // Qué migraciones alcanzaron a correr. Es lo primero que uno quiere saber
  // cuando el sitio se comporta raro después de un despliegue.
  console.log('\n— migraciones aplicadas —');

  const { error: err3 } = await admin.from('municipios').select('lat').limit(1);
  console.log('0003 lat/lng    :', err3 ? 'NO aplicada' : 'sí ✓');
  if (err3) fallas++;

  const { error: err4 } = await admin.from('reportes').select('es_responsable').limit(1);
  console.log('0004 solicitudes:', err4 ? 'NO aplicada' : 'sí ✓');
  if (err4) fallas++;

  const { error: err5 } = await admin.rpc('buscar_puntos', { p_limite: 1 });
  console.log('0005 buscar     :', err5 ? 'NO aplicada' : 'sí ✓');
  if (err5) fallas++;

  const { error: err6 } = await admin.from('puntos').select('ultimo_intento_llamada').limit(1);
  console.log('0006 llamadas   :', err6 ? 'NO aplicada' : 'sí ✓');
  if (err6) fallas++;

  // Se llama con una coordenada inválida a propósito: si la función acepta
  // `p_horarios` falla por la coordenada, y si no, falla por el parámetro. En
  // ninguno de los dos casos se inserta nada.
  const { error: err7 } = await admin.rpc('registrar_punto', {
    p_nombre: 'sonda', p_tipo_organizacion: 'ong',
    p_departamento_codigo: '17', p_municipio_codigo: '17001', p_direccion: 'sonda',
    p_lat: 0, p_lng: 0, p_responsable_nombre: 'sonda', p_telefono: '+573000000000',
    p_horario_texto: 'sonda', p_categorias: [], p_horarios: [],
  });
  const tiene7 = err7?.message?.includes('dentro de Colombia');
  console.log('0007 horarios   :', tiene7 ? 'sí ✓' : `NO aplicada (${err7?.message ?? 'sin error'})`);
  if (!tiene7) fallas++;

  const { data: slugs, error: err8 } = await admin
    .from('municipios').select('slug').eq('codigo', '11001').maybeSingle();
  const tiene8 = !err8 && slugs?.slug === 'bogota';
  console.log('0008 slug       :', tiene8 ? 'sí ✓' : `NO aplicada (${err8?.message ?? slugs?.slug})`);
  if (!tiene8) fallas++;

  const { error: err8b } = await admin.rpc('necesidades', { p_municipio: '11001' });
  console.log('0008 necesidades:', err8b ? `NO aplicada (${err8b.message})` : 'sí ✓');
  if (err8b) fallas++;

  // Debe rechazar: se llama con la llave de servicio, que no tiene perfil de
  // moderador. Si algún día contesta otra cosa, la función quedó abierta.
  const { error: err8c } = await admin.rpc('importar_punto', {
    p_nombre: 'sonda', p_tipo_organizacion: 'ong',
    p_departamento_codigo: '17', p_municipio_codigo: '17001', p_direccion: 'sonda',
    p_lat: 0, p_lng: 0, p_responsable_nombre: 'sonda', p_telefono: '+573000000000',
    p_horario_texto: 'sonda',
  });
  const cerrada = err8c?.message?.includes('Solo moderación');
  console.log('0008 importar   :', cerrada ? 'cerrada ✓' : `revisar (${err8c?.message ?? 'no falló'})`);
  if (!cerrada) fallas++;

  /*
   * La prueba que faltaba: entrar de verdad como moderador.
   *
   * Todo lo de arriba usa `anon` o la llave de servicio. Ninguna de las dos se
   * parece a un moderador con sesión, que es el rol `authenticated` sujeto a
   * RLS. Por no probar esto, el panel estuvo semanas respondiendo «permission
   * denied for table puntos» sin que ninguna prueba se enterara: 0002 le había
   * revocado el GRANT a `authenticated`, y una policy no otorga permiso, filtra
   * dentro del que ya hay. Lo arregla 0009.
   */
  console.log('\n— como moderador (rol authenticated) —');

  const { data: perfiles } = await admin.from('perfiles').select('id').limit(1);
  if (!perfiles?.length) {
    console.log('moderación      : sin perfiles, no hay a quién probar');
  } else {
    const { data: cuenta } = await admin.auth.admin.getUserById(perfiles[0].id);
    const correo = cuenta?.user?.email;

    // Genera el token sin mandar correo, y lo canjea por una sesión real.
    const { data: enlace, error: errEnlace } = await admin.auth.admin.generateLink({
      type: 'magiclink', email: correo,
    });

    if (errEnlace) {
      console.log('moderación      : no se pudo generar el enlace —', errEnlace.message);
      fallas++;
    } else {
      const comoUsuario = createClient(url, anon, { auth: { persistSession: false } });
      const { error: errSesion } = await comoUsuario.auth.verifyOtp({
        token_hash: enlace.properties.hashed_token, type: 'magiclink',
      });

      if (errSesion) {
        console.log('sesión          : NO se pudo iniciar —', errSesion.message);
        fallas++;
      } else {
        console.log(`sesión          : ${correo} ✓`);
        for (const tabla of ['puntos', 'punto_categoria', 'reportes']) {
          const { error } = await comoUsuario.from(tabla).select('*', { head: true, count: 'exact' });
          const ok = !error;
          console.log(`  ${tabla.padEnd(16)}:`, ok ? 'lee ✓' : `BLOQUEADO — ${error.message || 'permission denied'} (falta 0009)`);
          if (!ok) fallas++;
        }
        await comoUsuario.auth.signOut();
      }
    }
  }
}

console.log(fallas === 0 ? '\n✓ el proyecto responde y RLS está en pie' : `\n✗ ${fallas} problema(s)`);
process.exit(fallas === 0 ? 0 : 1);
