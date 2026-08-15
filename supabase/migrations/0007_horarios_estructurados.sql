-- UnAcopio — el registro público ya manda el horario estructurado.
--
-- `puntos.horarios` existía desde 0001 pero nadie lo llenaba. Ahora el
-- formulario lo arma —días y rango— y de ahí sale tanto el jsonb como el
-- `horario_texto` legible, generado en el servidor para que no puedan
-- contradecirse: un punto donde el texto dice una cosa y el badge "abierto
-- ahora" dice otra es peor que un punto sin horario.
--
-- Se puede volver a correr sin romper nada.

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
  p_horarios            jsonb default null,   -- [{"dia":1,"desde":"08:00","hasta":"18:00"}]
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

  if p_lat is null or p_lng is null
     or p_lat not between -5 and 14 or p_lng not between -82 and -66 then
    raise exception 'La ubicación debe estar dentro de Colombia';
  end if;

  -- Si viene horario estructurado tiene que ser una lista; un objeto suelto o
  -- una cadena romperían el cálculo de "abierto ahora" en silencio.
  if p_horarios is not null and jsonb_typeof(p_horarios) <> 'array' then
    raise exception 'El horario estructurado debe ser una lista de franjas';
  end if;

  insert into puntos (
    nombre, tipo_organizacion, departamento_codigo, municipio_codigo,
    direccion, barrio, referencia, ubicacion,
    responsable_nombre, telefono, whatsapp, telefono_publico, correo,
    horario_texto, horarios, fecha_inicio, fecha_fin, recibe_voluntarios, notas,
    estado, origen, entidad_oficial
  ) values (
    trim(p_nombre), p_tipo_organizacion, p_departamento_codigo, p_municipio_codigo,
    trim(p_direccion), p_barrio, p_referencia,
    st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography,
    trim(p_responsable_nombre), p_telefono, p_whatsapp, p_telefono_publico, p_correo,
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
