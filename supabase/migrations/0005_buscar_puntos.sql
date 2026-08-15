-- UnAcopio — una sola función de búsqueda para el listado y el mapa.
--
-- Reemplaza a `puntos_cercanos`, que solo sabía buscar por cercanía. El listado
-- necesitaba además filtrar por departamento, municipio y categoría, y el filtro
-- por categoría no se puede hacer desde PostgREST porque las categorías vienen
-- agregadas en un `jsonb` dentro de la vista.
--
-- Tener una sola puerta evita que el listado y el mapa muestren cosas distintas
-- para el mismo filtro, que es de los errores más difíciles de ver.
--
-- Se puede volver a correr sin romper nada.

drop function if exists puntos_cercanos;
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
-- `extensions` es obligatorio: en Supabase PostGIS vive ahí, no en `public`.
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
    -- Filtra por lo que la persona quiere donar. Solo cuenta si el punto lo
    -- recibe: un `no_recibe` es precisamente la razón para NO mostrarlo.
    and (p_categoria is null or exists (
          select 1 from jsonb_array_elements(v.categorias) e
          where e->>'slug' = p_categoria and e->>'nivel' in ('alta', 'si')))
    and (o.g is null or st_dwithin(
          st_setsrid(st_makepoint(v.lng, v.lat), 4326)::geography, o.g, p_radio_m))
  order by
    -- Con ubicación manda la distancia. Sin ella, lo verificado hace menos
    -- tiempo va primero: es lo que menos riesgo tiene de mandar a alguien a un
    -- portón cerrado.
    case
      when o.g is not null
      then st_distance(o.g, st_setsrid(st_makepoint(v.lng, v.lat), 4326)::geography)
    end asc nulls last,
    v.ultima_verificacion desc nulls last,
    v.actualizado_en desc
  limit least(p_limite, 300);
$$;

grant execute on function buscar_puntos to anon, authenticated;
