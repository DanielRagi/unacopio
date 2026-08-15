-- UnAcopio — la ronda de llamadas y el estado "lleno" visible.
--
-- La verificación periódica la hace una persona llamando, no un mensaje
-- automático (ver D10). Esta migración le da a esa ronda lo que necesita para
-- funcionar con varios voluntarios a la vez, y saca del limbo a los puntos que
-- están llenos.
--
-- Se puede volver a correr sin romper nada.

-- ---------------------------------------------------------------- llamadas

alter table puntos
  add column if not exists ultimo_intento_llamada timestamptz,
  add column if not exists intentos_fallidos int not null default 0;

comment on column puntos.ultimo_intento_llamada is
  'Cuándo se intentó llamar por última vez, haya contestado o no. Sirve para que '
  'dos voluntarios no llamen al mismo punto con cinco minutos de diferencia.';

comment on column puntos.intentos_fallidos is
  'Llamadas seguidas sin respuesta. Se reinicia al contestar. Con varias, el '
  'punto se vuelve sospechoso aunque nadie lo haya reportado.';

-- La cola de llamadas: lo que lleva más tiempo sin verificarse va primero, y lo
-- que nunca se ha verificado va antes que todo.
create index if not exists puntos_por_llamar_idx
  on puntos (ultima_verificacion asc nulls first)
  where estado in ('publicado', 'lleno');

-- ---------------------------------------------------------------- vista

/*
 * Los puntos `lleno` vuelven a ser visibles.
 *
 * Antes desaparecían del directorio, y eso salía peor: quien se enteró del punto
 * por la radio o por un audio de WhatsApp igual iba, porque no teníamos cómo
 * decirle que hoy no reciben más. Ahora aparecen marcados y de últimos.
 */
drop view if exists puntos_publicos;

create view puntos_publicos as
select
  p.id,
  p.nombre,
  p.tipo_organizacion,
  p.estado,
  p.departamento_codigo,
  d.nombre as departamento,
  p.municipio_codigo,
  m.nombre as municipio,
  p.direccion,
  p.barrio,
  p.referencia,
  p.lat,
  p.lng,
  p.responsable_nombre,
  case when p.telefono_publico then p.telefono end as telefono,
  case when p.telefono_publico then p.whatsapp else false end as whatsapp,
  p.horario_texto,
  p.horarios,
  p.fecha_inicio,
  p.fecha_fin,
  p.recibe_voluntarios,
  p.notas,
  p.entidad_oficial,
  p.ultima_verificacion,
  p.actualizado_en,
  coalesce(c.categorias, '[]'::jsonb) as categorias
from puntos p
join departamentos d on d.codigo = p.departamento_codigo
join municipios    m on m.codigo = p.municipio_codigo
left join lateral (
  select jsonb_agg(
           jsonb_build_object('slug', pc.categoria_slug, 'nombre', cat.nombre,
                              'grupo', cat.grupo, 'nivel', pc.nivel)
           order by cat.orden
         ) as categorias
  from punto_categoria pc
  join categorias cat on cat.slug = pc.categoria_slug
  where pc.punto_id = p.id
) c on true
where p.estado in ('publicado', 'lleno');

grant select on puntos_publicos to anon, authenticated;

-- ---------------------------------------------------------------- búsqueda

-- Se recrea para que los puntos llenos queden de últimos: siguen sirviendo como
-- información, pero no deberían ser la primera opción de nadie.
drop function if exists buscar_puntos;

create or replace function buscar_puntos(
  p_departamento char(2)          default null,
  p_municipio    char(5)          default null,
  p_categoria    text             default null,
  p_lat          double precision default null,
  p_lng          double precision default null,
  p_radio_m      int              default 20000,
  p_limite       int              default 100
)
returns table (punto jsonb, metros double precision)
language sql
stable
security definer
set search_path = public, extensions
as $$
  with origen as (
    select case
             when p_lat is not null and p_lng is not null
             then st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography
           end as g
  )
  select
    to_jsonb(v),
    case
      when o.g is not null
      then st_distance(o.g, st_setsrid(st_makepoint(v.lng, v.lat), 4326)::geography)
    end
  from puntos_publicos v, origen o
  where (p_departamento is null or v.departamento_codigo = p_departamento)
    and (p_municipio    is null or v.municipio_codigo    = p_municipio)
    and (p_categoria is null or exists (
          select 1 from jsonb_array_elements(v.categorias) e
          where e->>'slug' = p_categoria and e->>'nivel' in ('alta', 'si')))
    and (o.g is null or st_dwithin(
          st_setsrid(st_makepoint(v.lng, v.lat), 4326)::geography, o.g, p_radio_m))
  order by
    case when v.estado = 'lleno' then 1 else 0 end,
    case
      when o.g is not null
      then st_distance(o.g, st_setsrid(st_makepoint(v.lng, v.lat), 4326)::geography)
    end asc nulls last,
    v.ultima_verificacion desc nulls last,
    v.actualizado_en desc
  limit least(p_limite, 300);
$$;

grant execute on function buscar_puntos to anon, authenticated;

-- ---------------------------------------------------------------- duplicados

/*
 * Puntos parecidos y cerca del que se está revisando.
 *
 * Cuando algo se vuelve conocido en un municipio, la misma parroquia la
 * registran tres personas distintas con tres nombres distintos. Verlo antes de
 * publicar es más barato que fusionar fichas después.
 *
 * Va con SECURITY INVOKER a propósito: consulta la tabla base, así que solo
 * devuelve algo si quien llama es moderador. RLS hace el resto.
 */
create or replace function posibles_duplicados(
  p_punto_id uuid,
  p_radio_m  int default 200
)
returns table (id uuid, nombre text, estado estado_punto, metros double precision)
language sql
stable
set search_path = public, extensions
as $$
  select otro.id, otro.nombre, otro.estado,
         st_distance(otro.ubicacion, este.ubicacion)
  from puntos este
  join puntos otro
    on otro.id <> este.id
   and otro.municipio_codigo = este.municipio_codigo
   and st_dwithin(otro.ubicacion, este.ubicacion, p_radio_m)
  where este.id = p_punto_id
    and otro.estado in ('pendiente', 'publicado', 'lleno')
  order by 4
  limit 5;
$$;

grant execute on function posibles_duplicados to authenticated;
