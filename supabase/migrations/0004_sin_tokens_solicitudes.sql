-- UnAcopio — se eliminan los tokens de edición.
--
-- Cambio de estrategia: en la v1 nadie edita nada por su cuenta. Quien registró
-- un punto y necesita corregirlo o cerrarlo manda una solicitud, y moderación la
-- aplica. El motivo es práctico: el enlace de edición había que hacerlo llegar
-- por correo, y no hay proveedor de envío a la mano. Un token que no se puede
-- entregar no sirve de nada, y guardarlo solo agrega superficie que proteger.
--
-- Las solicitudes reutilizan la tabla `reportes`, que ya tiene los tipos que
-- hacen falta: `cerrado` para pedir el cierre, `info_incorrecta` para pedir un
-- cambio. Lo único nuevo es saber si quien escribe dice ser el responsable.
--
-- Se puede volver a correr sin romper nada.

alter table reportes
  add column if not exists es_responsable boolean not null default false;

comment on column reportes.es_responsable is
  'Quien escribe dice ser el responsable del punto. NO está verificado: es una '
  'pista para que moderación priorice y llame a confirmar.';

comment on column reportes.comentario is
  'Observaciones. Es el canal por el que la gente nos cuenta qué cambió.';

-- Fuera el token: ya no se genera, ni se guarda, ni se entrega.
drop index if exists puntos_token_idx;
alter table puntos drop column if exists token_edicion_hash;

-- ---------------------------------------------------------------- registrar

-- Cambia el tipo de retorno (ya no devuelve token), así que toca recrearla.
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

  insert into puntos (
    nombre, tipo_organizacion, departamento_codigo, municipio_codigo,
    direccion, barrio, referencia, ubicacion,
    responsable_nombre, telefono, whatsapp, telefono_publico, correo,
    horario_texto, fecha_inicio, fecha_fin, recibe_voluntarios, notas,
    estado, origen, entidad_oficial
  ) values (
    trim(p_nombre), p_tipo_organizacion, p_departamento_codigo, p_municipio_codigo,
    trim(p_direccion), p_barrio, p_referencia,
    st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography,
    trim(p_responsable_nombre), p_telefono, p_whatsapp, p_telefono_publico, p_correo,
    p_horario_texto, p_fecha_inicio, p_fecha_fin, p_recibe_voluntarios, p_notas,
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

-- ---------------------------------------------------------------- solicitudes

drop function if exists reportar_punto;

/*
 * Una sola puerta para todo lo que la gente nos quiera decir de un punto:
 * pedir un cambio, pedir el cierre, o avisar que algo está mal.
 *
 * La diferencia la hace `p_es_responsable`. Un vecino que reporta empuja hacia
 * despublicar —tres reportes y el punto sale de la lista solo—, pero quien dice
 * ser el responsable está colaborando, no denunciando: su solicitud no cuenta
 * para ese umbral. Si no, alguien podría tumbar su propio punto sin querer al
 * pedir que le corrijan el horario.
 */
create or replace function reportar_punto(
  p_punto_id       uuid,
  p_tipo           tipo_reporte,
  p_comentario     text default null,
  p_contacto       text default null,
  p_ip_hash        text default null,
  p_es_responsable boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_abiertos int;
begin
  if not exists (select 1 from puntos where id = p_punto_id) then
    raise exception 'El punto no existe';
  end if;

  if p_ip_hash is not null and exists (
       select 1 from reportes
       where ip_hash = p_ip_hash and punto_id = p_punto_id
         and creado_en > now() - interval '1 hour') then
    return;  -- ya escribió sobre este punto hace poco; se ignora en silencio
  end if;

  insert into reportes (punto_id, tipo, comentario, contacto, ip_hash, es_responsable)
  values (p_punto_id, p_tipo, nullif(trim(p_comentario), ''), nullif(trim(p_contacto), ''),
          p_ip_hash, p_es_responsable);

  if p_es_responsable then
    return;
  end if;

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
