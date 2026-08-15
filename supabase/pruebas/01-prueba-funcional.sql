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

\echo '--- registrar_punto'
select registrar_punto(
  'Parroquia San José', 'iglesia', '17', '17001', 'Calle 12 # 4-30',
  5.0703, -75.5138, 'María Gómez', '+573001112233', 'Lun a Sáb 8am-6pm',
  '[{"slug":"agua_embotellada","nivel":"alta"},
    {"slug":"ropa_usada_buen_estado","nivel":"no_recibe"}]'::jsonb
) as punto_id \gset

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
