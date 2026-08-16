-- UnAcopio — lo que hace falta para que otros usen los datos y para sembrarlos.
--
-- Tres cosas, todas de la fase 4:
--   · `municipios.slug` para tener URLs compartibles por municipio
--     (`/acopio/medellin`), que es como esto se mueve por WhatsApp
--   · `importar_punto`, la puerta de entrada de las listas que ya existen
--     (alcaldías, medios, la recolección de la fase 5). Entra como `pendiente`,
--     igual que el formulario público: un dato copiado de internet es una pista,
--     no un hecho verificado (ver D13)
--   · `necesidades`, para responder "¿qué es lo que más falta acá?" sin que
--     nadie tenga que abrir 30 fichas
--
-- Se puede volver a correr sin romper nada.

-- ---------------------------------------------------------------- slug

-- `translate` sobre los acentos y no `unaccent`: la extensión existe en Supabase
-- pero habría que instalarla, y para nombres de municipios colombianos esto
-- alcanza y es determinístico.
create or replace function slug_texto(p_texto text)
returns text
language sql
immutable
as $$
  select trim(both '-' from
    regexp_replace(
      regexp_replace(
        lower(translate(
          coalesce(p_texto, ''),
          'áàäâãéèëêíìïîóòöôõúùüûñçÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇ',
          'aaaaaeeeeiiiiooooouuuuncAAAAAEEEEIIIIOOOOOUUUUNC')),
        '[^a-z0-9]+', '-', 'g'),
      '-+', '-', 'g'));
$$;

alter table municipios add column if not exists slug text;

-- El slug se rellena solo si nadie lo trae. Sin esto, volver a correr la semilla
-- de municipios después de esta migración revienta contra el `not null`: el
-- `on conflict do nothing` descarta la fila, pero la restricción se evalúa antes.
create or replace function municipios_completar_slug()
returns trigger language plpgsql as $$
begin
  new.slug := coalesce(nullif(new.slug, ''), slug_texto(new.nombre));
  return new;
end;
$$;

drop trigger if exists municipios_slug on municipios;
create trigger municipios_slug
  before insert or update on municipios
  for each row execute function municipios_completar_slug();

-- Hay decenas de nombres repetidos entre departamentos (Albania, El Peñón, La
-- Unión). Los únicos se quedan con el nombre pelado; los repetidos llevan el
-- departamento pegado, que es como la gente los distingue al hablar.
with base as (
  select m.codigo,
         slug_texto(m.nombre) as s,
         slug_texto(d.nombre) as sd,
         count(*) over (partition by slug_texto(m.nombre)) as repetidos
  from municipios m
  join departamentos d on d.codigo = m.departamento_codigo
)
update municipios m
   set slug = case when b.repetidos = 1 then b.s else b.s || '-' || b.sd end
  from base b
 where b.codigo = m.codigo
   and m.slug is distinct from (case when b.repetidos = 1 then b.s else b.s || '-' || b.sd end);

-- Red de seguridad: si dos municipios del mismo departamento se llamaran igual,
-- el desempate lo pone el código DANE. Hoy no pasa, pero el índice único de
-- abajo tumbaría la migración entera y esto no cuesta nada.
with repetidos as (
  select codigo, row_number() over (partition by slug order by codigo) as n
  from municipios
)
update municipios m
   set slug = m.slug || '-' || m.codigo
  from repetidos r
 where r.codigo = m.codigo and r.n > 1;

-- El DANE la llama "Bogotá D.C.", y `bogota-d-c` no es una URL que alguien vaya
-- a escribir ni a reconocer en un grupo de WhatsApp. Es el único municipio del
-- país cuyo nombre oficial no produce un slug decente.
update municipios set slug = 'bogota' where codigo = '11001' and slug <> 'bogota';

alter table municipios alter column slug set not null;
create unique index if not exists municipios_slug_idx on municipios (slug);

comment on column municipios.slug is
  'Identificador para URLs compartibles: /acopio/medellin. Único; los nombres '
  'repetidos entre departamentos llevan el departamento pegado.';

-- ---------------------------------------------------------------- procedencia

alter table puntos
  add column if not exists fuente_nombre text,
  add column if not exists fuente_url    text;

comment on column puntos.fuente_nombre is
  'De dónde salió un punto importado: "Alcaldía de Medellín", "El Colombiano". '
  'Es interno: no se publica, porque lo que sostiene la ficha es la llamada de '
  'confirmación, no la fuente de la que se copió.';

create index if not exists puntos_origen_idx on puntos (origen, estado);

-- ---------------------------------------------------------------- importación

/*
 * Carga de un punto desde una lista que ya existe.
 *
 * Es la contraparte de `registrar_punto` para moderación, y se parece a propósito:
 *
 *   · el estado también se fuerza a `pendiente`. Nadie publica sin que alguien
 *     llame, ni siquiera cuando el dato viene de la página de una alcaldía
 *   · `telefono_publico` arranca en false y no se puede subir desde acá. Ese
 *     consentimiento lo da una persona (Ley 1581 de 2012), y copiar un teléfono
 *     de una publicación no es consentimiento (ver D13)
 *   · `entidad_oficial` tampoco: eso lo pone moderación a mano, después
 *
 * Exige sesión de moderador. No es `security definer` por gusto: necesita crear
 * el `geography`, que PostgREST no sabe construir desde el cliente.
 */
-- Se borra primero. Migraciones posteriores le agregan parámetros, y en
-- Postgres agregar un parámetro no reemplaza la función: crea una sobrecarga.
-- Sin esto, volver a correr este archivo dejaba dos `importar_punto` y el
-- `revoke` de abajo fallaba con «function name is not unique».
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
  p_fuente_url          text default null
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
    responsable_nombre, telefono, whatsapp, telefono_publico,
    horario_texto, horarios, notas,
    estado, origen, entidad_oficial, fuente_nombre, fuente_url
  ) values (
    trim(p_nombre), p_tipo_organizacion, p_departamento_codigo, p_municipio_codigo,
    trim(p_direccion), p_barrio, p_referencia,
    st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography,
    coalesce(nullif(trim(p_responsable_nombre), ''), 'Por confirmar'),
    p_telefono, true, false,
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

-- `public` y no solo `anon`: Postgres le da EXECUTE a PUBLIC en toda función
-- nueva, y quitárselo a `anon` no toca esa herencia. Dentro la función igual
-- exige moderador, pero no hay razón para dejarla al alcance de quien no lo es.
revoke execute on function importar_punto from public, anon;
grant execute on function importar_punto to authenticated;

-- ---------------------------------------------------------------- agregados

/*
 * Qué es lo que más piden en un municipio o departamento.
 *
 * Ordena por cuántos puntos lo marcaron urgente. Sirve para dos cosas distintas:
 * a quien va a donar le dice qué llevar, y a quien coordina la emergencia le
 * dice dónde está el hueco.
 *
 * Los puntos `lleno` no cuentan: hoy no pueden recibir, así que sumarlos
 * exageraría la demanda.
 */
create or replace function necesidades(
  p_departamento char(2) default null,
  p_municipio    char(5) default null,
  p_limite       int default 8
)
returns table (slug text, nombre text, grupo grupo_categoria, urgente int, puntos int)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select c.slug, c.nombre, c.grupo,
         count(*) filter (where e->>'nivel' = 'alta')::int as urgente,
         count(*)::int as puntos
  from puntos_publicos v
  cross join lateral jsonb_array_elements(v.categorias) e
  join categorias c on c.slug = e->>'slug'
  where v.estado = 'publicado'
    and (p_departamento is null or v.departamento_codigo = p_departamento)
    and (p_municipio   is null or v.municipio_codigo   = p_municipio)
    and e->>'nivel' in ('alta', 'si')
  group by c.slug, c.nombre, c.grupo, c.orden
  order by urgente desc, puntos desc, c.orden
  limit least(coalesce(p_limite, 8), 20);
$$;

grant execute on function necesidades to anon, authenticated;

-- Los municipios que hoy tienen algo que mostrar. De aquí salen el índice de
-- `/acopio` y el sitemap: no tiene sentido publicar 1.122 URLs vacías.
create or replace function municipios_con_puntos()
returns table (
  codigo char(5), nombre text, slug text,
  departamento_codigo char(2), departamento text, puntos int
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select m.codigo, m.nombre, m.slug, d.codigo, d.nombre, count(*)::int
  from puntos_publicos v
  join municipios    m on m.codigo = v.municipio_codigo
  join departamentos d on d.codigo = m.departamento_codigo
  group by m.codigo, m.nombre, m.slug, d.codigo, d.nombre
  order by count(*) desc, m.nombre;
$$;

grant execute on function municipios_con_puntos to anon, authenticated;
