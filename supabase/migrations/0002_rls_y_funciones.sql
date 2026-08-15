-- UnAcopio — vistas públicas, RLS y funciones RPC.
--
-- Este archivo se puede volver a correr completo sin romper nada: la vista y las
-- policies se borran antes de recrearse, y las funciones son `create or replace`.
-- Importa, porque si el editor de Supabase aborta a la mitad uno necesita poder
-- pegarlo otra vez sin ponerse a averiguar qué alcanzó a quedar creado.

create extension if not exists pgcrypto with schema extensions;

-- ================================================================ vista pública
-- El público NUNCA consulta `puntos` directamente: solo esta vista.
-- Es SECURITY DEFINER (el default) a propósito — filtra por estado y enmascara
-- el teléfono sin consentimiento; `correo` y `token_edicion_hash` no salen nunca.

drop view if exists puntos_publicos;

create view puntos_publicos as
select
  p.id,
  p.nombre,
  p.tipo_organizacion,
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
where p.estado = 'publicado';

-- ================================================================ RLS

alter table puntos          enable row level security;
alter table punto_categoria enable row level security;
alter table reportes        enable row level security;
alter table perfiles        enable row level security;
alter table categorias      enable row level security;
alter table municipios      enable row level security;
alter table departamentos   enable row level security;

-- Nadie anónimo toca las tablas base de puntos. Se entra por la vista o por RPC.
revoke all on puntos, punto_categoria, reportes from anon, authenticated;
grant select on puntos_publicos to anon, authenticated;
grant select on categorias, municipios, departamentos to anon, authenticated;

drop policy if exists "catalogo categorias visible"            on categorias;
drop policy if exists "catalogo municipios visible"            on municipios;
drop policy if exists "catalogo departamentos visible"         on departamentos;
drop policy if exists "moderacion lee puntos"                  on puntos;
drop policy if exists "moderacion escribe puntos"              on puntos;
drop policy if exists "moderacion lee categorias de punto"     on punto_categoria;
drop policy if exists "moderacion escribe categorias de punto" on punto_categoria;
drop policy if exists "moderacion lee reportes"                on reportes;
drop policy if exists "moderacion escribe reportes"            on reportes;
drop policy if exists "perfil propio"                          on perfiles;

-- Catálogos: lectura libre.
create policy "catalogo categorias visible"    on categorias    for select using (true);
create policy "catalogo municipios visible"    on municipios    for select using (true);
create policy "catalogo departamentos visible" on departamentos for select using (true);

-- Moderación: acceso total a puntos y reportes.
create policy "moderacion lee puntos"     on puntos for select using (es_moderador());
create policy "moderacion escribe puntos" on puntos for all    using (es_moderador()) with check (es_moderador());

create policy "moderacion lee categorias de punto"     on punto_categoria for select using (es_moderador());
create policy "moderacion escribe categorias de punto" on punto_categoria for all    using (es_moderador()) with check (es_moderador());

create policy "moderacion lee reportes"     on reportes for select using (es_moderador());
create policy "moderacion escribe reportes" on reportes for all    using (es_moderador()) with check (es_moderador());

create policy "perfil propio" on perfiles for select using (id = auth.uid());

-- ================================================================ RPC públicas

-- Registro de un punto desde el formulario público.
-- Fuerza estado 'pendiente' y entidad_oficial=false: el formulario no puede
-- publicarse solo ni auto-certificarse. Devuelve el token de edición en claro,
-- que solo se ve una vez (en la base queda el hash).
create or replace function registrar_punto(
  p_nombre              text,
  p_tipo_organizacion   tipo_organizacion,
  p_departamento_codigo char(2),
  p_municipio_codigo    char(5),
  p_direccion           text,
  p_lat                 double precision,
  p_lng                 double precision,
  p_responsable_nombre  text,
  p_telefono            text,
  p_horario_texto       text,
  p_categorias          jsonb,             -- [{"slug":"agua_embotellada","nivel":"alta"}, ...]
  p_barrio              text default null,
  p_referencia          text default null,
  p_whatsapp            boolean default true,
  p_telefono_publico    boolean default false,
  p_correo              text default null,
  p_fecha_inicio        date default null,
  p_fecha_fin           date default null,
  p_recibe_voluntarios  boolean default false,
  p_notas               text default null
)
returns table (id uuid, token text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_token text := encode(gen_random_bytes(24), 'hex');
  v_id    uuid;
begin
  if coalesce(trim(p_nombre), '') = '' or coalesce(trim(p_direccion), '') = '' then
    raise exception 'Faltan datos obligatorios del punto';
  end if;

  if p_lat is null or p_lng is null
     or p_lat not between -5 and 14 or p_lng not between -82 and -66 then
    raise exception 'La ubicación debe estar dentro de Colombia';
  end if;

  insert into puntos (
    nombre, tipo_organizacion, departamento_codigo, municipio_codigo,
    direccion, barrio, referencia, ubicacion,
    responsable_nombre, telefono, whatsapp, telefono_publico, correo,
    horario_texto, fecha_inicio, fecha_fin, recibe_voluntarios, notas,
    estado, origen, entidad_oficial, token_edicion_hash
  ) values (
    trim(p_nombre), p_tipo_organizacion, p_departamento_codigo, p_municipio_codigo,
    trim(p_direccion), p_barrio, p_referencia,
    st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography,
    trim(p_responsable_nombre), p_telefono, p_whatsapp, p_telefono_publico, p_correo,
    p_horario_texto, p_fecha_inicio, p_fecha_fin, p_recibe_voluntarios, p_notas,
    'pendiente', 'formulario', false, encode(digest(v_token, 'sha256'), 'hex')
  )
  returning puntos.id into v_id;

  insert into punto_categoria (punto_id, categoria_slug, nivel)
  select v_id, x.slug, x.nivel
  from jsonb_to_recordset(coalesce(p_categorias, '[]'::jsonb))
       as x(slug text, nivel nivel_categoria)
  on conflict do nothing;

  return query select v_id, v_token;
end;
$$;

grant execute on function registrar_punto to anon, authenticated;

-- Puntos publicados ordenados por cercanía. `p_categoria` filtra por lo que la
-- persona quiere donar (solo cuenta si el punto lo recibe, no si lo rechaza).
create or replace function puntos_cercanos(
  p_lat       double precision,
  p_lng       double precision,
  p_radio_m   int default 20000,
  p_categoria text default null,
  p_limite    int default 50
)
returns table (punto jsonb, metros double precision)
language sql
stable
security definer
-- `extensions` es obligatorio: en Supabase PostGIS vive ahí, no en `public`, y
-- sin él esta función no encuentra ni el tipo `geography` ni las `st_*`.
set search_path = public, extensions
as $$
  select to_jsonb(v) - 'lat' - 'lng' || jsonb_build_object('lat', v.lat, 'lng', v.lng),
         st_distance(st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography,
                     st_setsrid(st_makepoint(v.lng, v.lat), 4326)::geography)
  from puntos_publicos v
  where st_dwithin(st_setsrid(st_makepoint(v.lng, v.lat), 4326)::geography,
                   st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography,
                   p_radio_m)
    and (p_categoria is null or exists (
          select 1 from jsonb_array_elements(v.categorias) e
          where e->>'slug' = p_categoria and e->>'nivel' in ('alta', 'si')))
  order by 2
  limit least(p_limite, 200);
$$;

grant execute on function puntos_cercanos to anon, authenticated;

-- Reporte ciudadano. A los 3 reportes abiertos el punto se despublica solo y
-- queda en la cola de moderación: mejor un falso negativo que mandar gente
-- a un punto que ya cerró.
create or replace function reportar_punto(
  p_punto_id   uuid,
  p_tipo       tipo_reporte,
  p_comentario text default null,
  p_contacto   text default null,
  p_ip_hash    text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_abiertos int;
begin
  if p_ip_hash is not null and exists (
       select 1 from reportes
       where ip_hash = p_ip_hash and punto_id = p_punto_id
         and creado_en > now() - interval '1 hour') then
    return;  -- ya reportó este punto hace poco; se ignora en silencio
  end if;

  insert into reportes (punto_id, tipo, comentario, contacto, ip_hash)
  values (p_punto_id, p_tipo, p_comentario, p_contacto, p_ip_hash);

  update puntos
     set reportes_abiertos = reportes_abiertos + 1
   where id = p_punto_id
  returning reportes_abiertos into v_abiertos;

  if v_abiertos >= 3 then
    update puntos set estado = 'pendiente'
     where id = p_punto_id and estado = 'publicado';
  end if;
end;
$$;

grant execute on function reportar_punto to anon, authenticated;
