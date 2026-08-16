-- Prueba funcional del esquema. Corre con `npm run db:probar`.
--
-- Lo que verifica, que es justo lo que no se puede romper sin darse cuenta:
--   · los catálogos quedaron completos y con centroide usable
--   · el formulario público no puede autopublicarse ni autocertificarse
--   · anon no llega a la tabla base, solo a la vista
--   · el teléfono se enmascara sin consentimiento (Habeas Data)
--   · la búsqueda por cercanía respeta radio y categorías `no_recibe`
--   · tres reportes de terceros despublican el punto solo
--   · una solicitud del responsable NO cuenta para ese umbral
--   · ya no queda rastro de tokens de edición

\set ON_ERROR_STOP on
\pset pager off

truncate puntos cascade;

\echo '--- catalogos'
select (select count(*) from departamentos) as departamentos,
       (select count(*) from municipios)    as municipios,
       (select count(*) from municipios where centroide is null) as sin_centroide,
       (select count(*) from municipios where lat is null)       as sin_lat,
       (select count(*) from categorias)    as categorias;

\echo '--- el centroide sale como lat/lng usable (Medellin)'
select nombre, round(lat::numeric, 3) as lat, round(lng::numeric, 3) as lng
from municipios where codigo = '05001';

\echo '--- ya no existe la columna de token'
select count(*) as columnas_token
from information_schema.columns
where table_name = 'puntos' and column_name like '%token%';

\echo '--- registrar_punto, ahora con horario estructurado'
select registrar_punto(
  'Parroquia San José', 'iglesia', '17', '17001', 'Calle 12 # 4-30',
  5.0703, -75.5138, 'María Gómez', '+573001112233',
  'Lunes a sábado de 8:00 a.m. a 6:00 p.m.',
  '[{"slug":"agua_embotellada","nivel":"alta"},
    {"slug":"ropa_usada_buen_estado","nivel":"no_recibe"}]'::jsonb,
  '[{"dia":1,"desde":"08:00","hasta":"18:00"},
    {"dia":2,"desde":"08:00","hasta":"18:00"}]'::jsonb
) as punto_id \gset

select jsonb_array_length(horarios) as franjas_guardadas,
       horarios -> 0 ->> 'desde' as primera_apertura
from puntos where id = :'punto_id';

\echo '--- un horario que no sea lista debe ser rechazado'
do $$
begin
  perform registrar_punto('Malo','ong','17','17001','x', 5.07, -75.51,
                          'y','+573001112233','z','[]'::jsonb, '{"dia":1}'::jsonb);
  raise exception 'FALLA: acepto un horario que no era una lista';
exception
  when others then
    if sqlerrm like '%lista de franjas%' then raise notice 'OK: rechazo el horario mal formado';
    else raise; end if;
end
$$;

select estado, entidad_oficial, origen,
       round(lat::numeric, 4) as lat, round(lng::numeric, 4) as lng
from puntos where id = :'punto_id';

\echo '--- un punto pendiente NO se ve en la vista publica'
set role anon;
select count(*) as visibles_pendiente from puntos_publicos;
reset role;

\echo '--- anon no puede leer la tabla base'
do $$
begin
  set local role anon;
  perform 1 from puntos limit 1;
  raise exception 'FALLA: anon pudo leer la tabla puntos';
exception
  when insufficient_privilege then raise notice 'OK: anon bloqueado en puntos';
end
$$;

\echo '--- publicado, con telefono sin consentimiento'
update puntos set estado = 'publicado', telefono_publico = false where id = :'punto_id';
set role anon;
select nombre, municipio, departamento,
       telefono as telefono_enmascarado, whatsapp,
       jsonb_array_length(categorias) as num_categorias
from puntos_publicos where id = :'punto_id';
reset role;

\echo '--- con consentimiento el telefono si sale'
update puntos set telefono_publico = true where id = :'punto_id';
set role anon;
select telefono from puntos_publicos where id = :'punto_id';

\echo '--- buscar_puntos por cercania desde el centro de Manizales (~430 m)'
select (punto->>'nombre') as nombre, round(metros::numeric) as metros
from buscar_puntos(p_lat => 5.0689, p_lng => -75.5174);

\echo '--- el radio si filtra'
select 100 as radio_m, count(*) from buscar_puntos(p_lat => 5.0689, p_lng => -75.5174, p_radio_m => 100)
union all
select 500, count(*) from buscar_puntos(p_lat => 5.0689, p_lng => -75.5174, p_radio_m => 500);

\echo '--- sin ubicacion no hay distancia, pero si hay resultados'
select (punto->>'nombre') as nombre, metros from buscar_puntos();

\echo '--- filtro por categoria: agua SI, ropa usada NO (esta marcada no_recibe)'
select 'agua' as filtro, count(*) from buscar_puntos(p_categoria => 'agua_embotellada')
union all
select 'ropa', count(*) from buscar_puntos(p_categoria => 'ropa_usada_buen_estado');

\echo '--- filtro por departamento y municipio'
select 'Caldas'      as filtro, count(*) from buscar_puntos(p_departamento => '17')
union all
select 'Manizales',  count(*) from buscar_puntos(p_municipio => '17001')
union all
select 'Antioquia',  count(*) from buscar_puntos(p_departamento => '05');
reset role;

\echo '--- coordenada fuera de Colombia: debe fallar'
do $$
begin
  perform registrar_punto('Falso','ong','17','17001','x', 40.7, -74.0,
                          'y','+57300','z','[]'::jsonb);
  raise exception 'FALLA: acepto una coordenada fuera de Colombia';
exception
  when others then
    if sqlerrm like '%dentro de Colombia%' then raise notice 'OK: rechazo la coordenada';
    else raise; end if;
end
$$;

\echo '--- solicitud del responsable: se guarda pero NO empuja a despublicar'
select reportar_punto(:'punto_id', 'info_incorrecta',
                      'Cambiamos el horario, ahora cerramos a las 4pm',
                      'María Gómez 3001112233', 'ip-resp', true);
select estado, reportes_abiertos from puntos where id = :'punto_id';
select tipo, es_responsable, comentario from reportes where punto_id = :'punto_id';

\echo '--- solicitud de cierre del responsable: tampoco despublica sola'
select reportar_punto(:'punto_id', 'cerrado', 'Ya no recibimos mas', null, 'ip-resp2', true);
select estado, reportes_abiertos from puntos where id = :'punto_id';

\echo '--- reportes de terceros: el repetido se ignora, al tercero se despublica'
select reportar_punto(:'punto_id', 'cerrado', null, null, 'ip-a');
select reportar_punto(:'punto_id', 'cerrado', null, null, 'ip-a');
select estado, reportes_abiertos from puntos where id = :'punto_id';
select reportar_punto(:'punto_id', 'cerrado',   null, null, 'ip-b');
select reportar_punto(:'punto_id', 'no_existe', null, null, 'ip-c');
select estado, reportes_abiertos from puntos where id = :'punto_id';

\echo '--- ya despublicado, desaparece de la vista'
set role anon;
select count(*) as visibles_final from puntos_publicos;
reset role;

\echo '--- un punto lleno SI se ve, pero de ultimo'
update puntos set estado = 'publicado', reportes_abiertos = 0 where id = :'punto_id';
select registrar_punto(
  'Coliseo Municipal', 'alcaldia', '17', '17001', 'Carrera 20 # 30-10',
  5.0600, -75.5100, 'Juan Perez', '+573009998877', 'Todos los dias',
  '[{"slug":"agua_embotellada","nivel":"si"}]'::jsonb
) as lleno_id \gset
update puntos set estado = 'lleno' where id = :'lleno_id';

set role anon;
select (punto->>'nombre') as nombre, (punto->>'estado') as estado
from buscar_puntos(p_municipio => '17001');
reset role;

\echo '--- duplicados: un punto a menos de 200 m del primero'
select registrar_punto(
  'Parroquia San Jose (repetido)', 'iglesia', '17', '17001', 'Calle 12 # 4-32',
  5.0704, -75.5139, 'Otra persona', '+573001110000', 'Lun a Vie',
  '[{"slug":"agua_embotellada","nivel":"si"}]'::jsonb
) as duplicado_id \gset

select nombre, estado, round(metros::numeric) as metros
from posibles_duplicados(:'duplicado_id');

\echo '--- y el coliseo, que esta a mas de 200 m, no aparece como duplicado'
select count(*) as duplicados_del_coliseo from posibles_duplicados(:'lleno_id');

\echo '--- slug de municipio: unico, sin tildes, y desempatado por departamento'
select (select count(*) from municipios where slug is null)        as sin_slug,
       (select count(distinct slug) from municipios)               as slugs_distintos,
       (select slug from municipios where codigo = '05001')        as medellin,
       (select slug from municipios where codigo = '11001')        as bogota,
       (select count(*) from municipios where slug like '%-d-c%')  as slugs_feos,
       (select count(*) from municipios where slug like '%-antioquia') as desempatados_antioquia;

\echo '--- municipio_de_ubicacion: el nombre manda sobre la distancia'
select 'Bogota' as ciudad_ip, nombre, por from municipio_de_ubicacion('Bogota', 4.6486, -74.0819)
union all
select 'Medellin', nombre, por from municipio_de_ubicacion('Medellin', 6.2518, -75.5636)
union all
select 'Manizales', nombre, por from municipio_de_ubicacion('Manizales', 5.0689, -75.5174)
union all
-- Con tilde y con mayúsculas, como lo manda cualquier proveedor.
select 'MEDELLÍN', nombre, por from municipio_de_ubicacion('MEDELLÍN', 6.2518, -75.5636);

\echo '--- sin nombre util, cae a la cercania'
select nombre, por from municipio_de_ubicacion(null, 5.0689, -75.5174)
union all
select nombre, por from municipio_de_ubicacion('Ciudad Que No Existe', 5.0689, -75.5174);

\echo '--- homonimos: Argelia existe en Antioquia, Cauca y Valle; desempata la coordenada'
select nombre, departamento, por from municipio_de_ubicacion('Argelia', 2.25, -77.24);

\echo '--- fuera de Colombia y sin nombre: no hay respuesta que dar (Madrid)'
select count(*) as resultados_madrid from municipio_de_ubicacion(null, 40.4168, -3.7038);

\echo '--- y anon puede llamarla: la portada la usa sin sesion'
set role anon;
select count(*) as anon_puede from municipio_de_ubicacion('Medellin', 6.2518, -75.5636);
reset role;

\echo '--- necesidades agregadas en Manizales (el coliseo esta lleno, no cuenta)'
select slug, urgente, puntos from necesidades(p_municipio => '17001');

\echo '--- municipios con puntos publicados'
select slug, puntos from municipios_con_puntos();

\echo '--- importar_punto exige sesion de moderador'
do $$
begin
  set local role anon;
  perform importar_punto('Copiado de internet','ong','05','05001','Calle 50',
                         6.25, -75.56, 'Sin nombre', '+573000000000', 'Sin horario');
  raise exception 'FALLA: anon pudo importar un punto';
exception
  when insufficient_privilege then raise notice 'OK: anon no puede ni ejecutar importar_punto';
  when others then
    if sqlerrm like '%Solo moderacion%' or sqlerrm like '%Solo moderación%'
      then raise notice 'OK: importar_punto rechazo a quien no es moderador';
    else raise; end if;
end
$$;

\echo '--- importado por moderacion: entra pendiente, sin telefono publico y con fuente'
-- Se finge una sesión de moderador: `es_moderador()` mira `auth.uid()`, que en
-- el banco de pruebas es un stub que devuelve null.
insert into auth.users (id, email)
  values ('11111111-1111-1111-1111-111111111111', 'moderador@prueba.co')
  on conflict do nothing;
insert into perfiles (id, nombre, rol)
  values ('11111111-1111-1111-1111-111111111111', 'Moderador de prueba', 'moderador')
  on conflict do nothing;
create or replace function auth.uid() returns uuid
  language sql stable as $$ select '11111111-1111-1111-1111-111111111111'::uuid $$;

-- Con parámetros nombrados: son 17 y posicionalmente es cuestión de tiempo
-- que la fuente termine guardada en las notas.
select importar_punto(
  p_nombre              => 'Unidad Deportiva Atanasio Girardot',
  p_tipo_organizacion   => 'alcaldia',
  p_departamento_codigo => '05',
  p_municipio_codigo    => '05001',
  p_direccion           => 'Carrera 74 # 48-10',
  p_lat                 => 6.2568,
  p_lng                 => -75.5906,
  p_responsable_nombre  => '',
  p_telefono            => '+573001234567',
  p_horario_texto       => '',
  p_categorias          => '[{"slug":"agua_embotellada","nivel":"si"}]'::jsonb,
  p_barrio              => 'Estadio',
  p_fuente_nombre       => 'Lista publicada por la Alcaldía',
  p_fuente_url          => 'https://www.medellin.gov.co/'
) as importado_id \gset

select estado, origen, telefono_publico, entidad_oficial,
       fuente_nombre, responsable_nombre, horario_texto
from puntos where id = :'importado_id';

\echo '--- y no se ve en publico hasta que moderacion lo confirme'
set role anon;
select count(*) as importados_visibles from puntos_publicos where municipio_codigo = '05001';
reset role;

/*
 * Un moderador de verdad: rol `authenticated` con perfil.
 *
 * Esta es LA prueba que faltaba. Todo lo de arriba corre como superusuario, que
 * se salta permisos y RLS por igual, así que durante semanas nadie notó que
 * 0002 le había revocado el GRANT a `authenticated`: `es_moderador()` decía
 * `true`, las policies estaban bien escritas, y el panel igual respondía
 * «permission denied». Una policy no da permiso, filtra dentro del que ya hay.
 */
\echo '--- moderacion con rol authenticated SI puede leer y escribir'
set role authenticated;
select count(*) > 0 as ve_puntos from puntos;
select count(*) >= 0 as ve_categorias from punto_categoria;
select count(*) >= 0 as ve_reportes from reportes;
update puntos set notas = coalesce(notas, '') where id = :'importado_id';
select 'pudo actualizar' as escritura;
reset role;

\echo '--- pero un authenticated SIN perfil no ve nada'
create or replace function auth.uid() returns uuid
  language sql stable as $$ select '22222222-2222-2222-2222-222222222222'::uuid $$;
set role authenticated;
select count(*) as filas_para_un_extrano from puntos;
reset role;

do $$
begin
  set local role authenticated;
  update puntos set entidad_oficial = true;
  if found then raise exception 'FALLA: un authenticated sin perfil pudo escribir';
  else raise notice 'OK: sin perfil no ve ni toca nada'; end if;
end
$$;

create or replace function auth.uid() returns uuid
  language sql stable as $$ select null::uuid $$;

\echo '--- reportar un punto inexistente falla'
do $$
begin
  perform reportar_punto('00000000-0000-0000-0000-000000000000'::uuid, 'spam');
  raise exception 'FALLA: acepto un reporte sobre un punto inexistente';
exception
  when others then
    if sqlerrm like '%no existe%' then raise notice 'OK: rechazo el punto inexistente';
    else raise; end if;
end
$$;
