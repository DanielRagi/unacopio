-- UnAcopio — contacto por Instagram, y el teléfono deja de ser obligatorio.
--
-- Aparece un caso que el diseño no contemplaba: puntos cuyo único contacto es
-- una cuenta de Instagram. Pasa con colectivos, con parroquias jóvenes y con
-- fundaciones chicas, que coordinan todo por ahí y no tienen un número que
-- contesten. Sin esto quedaban por fuera del directorio, o entraban con un
-- teléfono inventado, que es peor.
--
-- Dos cambios:
--
--   1. `instagram`, con el usuario ya normalizado (sin arroba, sin URL). Se
--      publica: es el canal por el que la gente va a preguntar.
--   2. `telefono` deja de exigir un número. Puede decir "Por confirmar". La
--      aplicación se encarga de no ofrecer "Llamar" ni "WhatsApp" cuando lo que
--      hay no es marcable — un botón que abre el marcador con basura es peor
--      que no tener botón.
--
-- Lo que NO cambia: `telefono` sigue siendo `not null`, porque siempre hay algo
-- que decir ahí aunque sea "Por confirmar", y el flujo de moderación se apoya en
-- que la columna exista.
--
-- Se puede volver a correr sin romper nada.

alter table puntos add column if not exists instagram text;

comment on column puntos.instagram is
  'Usuario de Instagram del punto, sin arroba y en minúsculas. Se publica: es '
  'el canal de contacto cuando no hay teléfono que conteste.';

/*
 * La misma normalización que hace la aplicación, pero acá.
 *
 * No es duplicación por descuido: `registrar_punto` es pública, la puede llamar
 * cualquiera sin pasar por el formulario, y la primera versión de esto solo
 * quitaba la arroba. Al probarlo de verdad se guardó
 * `https://www.instagram.com/barrioabajo/?hl=es` tal cual, y con eso el enlace
 * de la ficha habría quedado apuntando a
 * `instagram.com/https://www.instagram.com/...`.
 *
 * La base es el último lugar donde se puede garantizar la forma del dato, así
 * que la garantiza.
 */
create or replace function usuario_instagram(p_entrada text)
returns text
language sql
immutable
as $$
  select nullif(
    regexp_replace(                                        -- arrobas del inicio
      regexp_replace(                                      -- ruta, query o ancla
        regexp_replace(                                    -- el dominio
          regexp_replace(lower(trim(coalesce(p_entrada, ''))), '^https?://', ''),
          '^(www\.)?instagram\.com/', ''),
        '[?#/].*$', ''),
      '^@+', ''),
    '');
$$;

-- ---------------------------------------------------------------- vista

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
  -- Instagram no pasa por el consentimiento del teléfono: son cosas distintas.
  -- Un número de celular es un dato personal que hay que autorizar (Ley 1581);
  -- una cuenta de Instagram que alguien escribe en un campo que dice "se
  -- publica" ya es pública, y es justamente por donde quiere que le escriban.
  p.instagram,
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

-- ---------------------------------------------------------------- RPC

drop function if exists registrar_punto;

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
  p_categorias          jsonb,
  p_horarios            jsonb default null,
  p_barrio              text default null,
  p_referencia          text default null,
  p_whatsapp            boolean default true,
  p_telefono_publico    boolean default false,
  p_correo              text default null,
  p_fecha_inicio        date default null,
  p_fecha_fin           date default null,
  p_recibe_voluntarios  boolean default false,
  p_notas               text default null,
  p_instagram           text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_id uuid;
begin
  if coalesce(trim(p_nombre), '') = '' or coalesce(trim(p_direccion), '') = '' then
    raise exception 'Faltan datos obligatorios del punto';
  end if;

  -- Tiene que quedar alguna forma de contactarlos. Un punto sin teléfono y sin
  -- Instagram no se puede verificar ni preguntarle nada: no sirve publicarlo.
  if coalesce(trim(p_telefono), '') = '' and coalesce(trim(p_instagram), '') = '' then
    raise exception 'Hace falta un teléfono o un Instagram de contacto';
  end if;

  if p_lat is null or p_lng is null
     or p_lat not between -5 and 14 or p_lng not between -82 and -66 then
    raise exception 'La ubicación debe estar dentro de Colombia';
  end if;

  if p_horarios is not null and jsonb_typeof(p_horarios) <> 'array' then
    raise exception 'El horario estructurado debe ser una lista de franjas';
  end if;

  insert into puntos (
    nombre, tipo_organizacion, departamento_codigo, municipio_codigo,
    direccion, barrio, referencia, ubicacion,
    responsable_nombre, telefono, whatsapp, telefono_publico, correo, instagram,
    horario_texto, horarios, fecha_inicio, fecha_fin, recibe_voluntarios, notas,
    estado, origen, entidad_oficial
  ) values (
    trim(p_nombre), p_tipo_organizacion, p_departamento_codigo, p_municipio_codigo,
    trim(p_direccion), p_barrio, p_referencia,
    st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography,
    trim(p_responsable_nombre),
    coalesce(nullif(trim(p_telefono), ''), 'Por confirmar'),
    p_whatsapp, p_telefono_publico, p_correo,
    usuario_instagram(p_instagram),
    p_horario_texto,
    case when jsonb_array_length(coalesce(p_horarios, '[]'::jsonb)) > 0 then p_horarios end,
    p_fecha_inicio, p_fecha_fin, p_recibe_voluntarios, p_notas,
    'pendiente', 'formulario', false
  )
  returning puntos.id into v_id;

  insert into punto_categoria (punto_id, categoria_slug, nivel)
  select v_id, x.slug, x.nivel
  from jsonb_to_recordset(coalesce(p_categorias, '[]'::jsonb))
       as x(slug text, nivel nivel_categoria)
  on conflict do nothing;

  return v_id;
end;
$$;

grant execute on function registrar_punto to anon, authenticated;

-- ---------------------------------------------------------------- importación

-- Se borra primero: agregar un parámetro no es reemplazar, es crear una
-- sobrecarga, y quedarían dos `importar_punto` compitiendo.
drop function if exists importar_punto;

create or replace function importar_punto(
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
  p_categorias          jsonb default '[]'::jsonb,
  p_horarios            jsonb default null,
  p_barrio              text default null,
  p_referencia          text default null,
  p_notas               text default null,
  p_fuente_nombre       text default null,
  p_fuente_url          text default null,
  p_instagram           text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_id uuid;
begin
  if not es_moderador() then
    raise exception 'Solo moderación puede importar puntos';
  end if;

  if coalesce(trim(p_nombre), '') = '' or coalesce(trim(p_direccion), '') = '' then
    raise exception 'Faltan datos obligatorios del punto';
  end if;

  if p_lat is null or p_lng is null
     or p_lat not between -5 and 14 or p_lng not between -82 and -66 then
    raise exception 'La ubicación debe estar dentro de Colombia';
  end if;

  if p_horarios is not null and jsonb_typeof(p_horarios) <> 'array' then
    raise exception 'El horario estructurado debe ser una lista de franjas';
  end if;

  insert into puntos (
    nombre, tipo_organizacion, departamento_codigo, municipio_codigo,
    direccion, barrio, referencia, ubicacion,
    responsable_nombre, telefono, whatsapp, telefono_publico, instagram,
    horario_texto, horarios, notas,
    estado, origen, entidad_oficial, fuente_nombre, fuente_url
  ) values (
    trim(p_nombre), p_tipo_organizacion, p_departamento_codigo, p_municipio_codigo,
    trim(p_direccion), p_barrio, p_referencia,
    st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography,
    coalesce(nullif(trim(p_responsable_nombre), ''), 'Por confirmar'),
    coalesce(nullif(trim(p_telefono), ''), 'Por confirmar'),
    true, false,
    usuario_instagram(p_instagram),
    coalesce(nullif(trim(p_horario_texto), ''), 'Horario por confirmar'),
    case when jsonb_array_length(coalesce(p_horarios, '[]'::jsonb)) > 0 then p_horarios end,
    p_notas,
    'pendiente', 'importacion', false,
    nullif(trim(p_fuente_nombre), ''), nullif(trim(p_fuente_url), '')
  )
  returning puntos.id into v_id;

  insert into punto_categoria (punto_id, categoria_slug, nivel)
  select v_id, x.slug, x.nivel
  from jsonb_to_recordset(coalesce(p_categorias, '[]'::jsonb))
       as x(slug text, nivel nivel_categoria)
  on conflict do nothing;

  return v_id;
end;
$$;

revoke execute on function importar_punto from public, anon;
grant execute on function importar_punto to authenticated;
