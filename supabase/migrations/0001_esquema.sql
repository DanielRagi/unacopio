-- UnAcopio — esquema inicial
-- Ejecutar en Supabase: SQL Editor, o `supabase db push` con el CLI.

create extension if not exists postgis;

-- ---------------------------------------------------------------- enumeraciones

create type tipo_organizacion as enum (
  'alcaldia', 'gobernacion', 'bomberos', 'defensa_civil', 'cruz_roja',
  'iglesia', 'jac', 'ong', 'fundacion', 'empresa', 'colegio', 'universidad',
  'conjunto_residencial', 'particular'
);

create type estado_punto as enum (
  'pendiente', 'publicado', 'rechazado', 'cerrado', 'lleno'
);

-- alta = lo necesitan con urgencia · si = lo reciben · no_recibe = NO llevar
create type nivel_categoria as enum ('alta', 'si', 'no_recibe');

create type grupo_categoria as enum (
  'agua', 'alimentos', 'aseo', 'salud', 'albergue', 'ropa',
  'hogar', 'construccion', 'mascotas', 'otros'
);

create type tipo_reporte as enum (
  'cerrado', 'info_incorrecta', 'duplicado', 'no_existe', 'spam'
);

create type origen_punto as enum ('formulario', 'moderacion', 'importacion');

create type rol_perfil as enum ('moderador', 'admin');

-- ---------------------------------------------------------------- catálogos

create table departamentos (
  codigo      char(2) primary key,
  nombre      text not null
);

create table municipios (
  codigo              char(5) primary key,
  nombre              text not null,
  departamento_codigo char(2) not null references departamentos(codigo),
  centroide           geography(Point, 4326)
);

create index municipios_departamento_idx on municipios (departamento_codigo);
create index municipios_nombre_idx on municipios (lower(nombre));

create table categorias (
  slug   text primary key,
  nombre text not null,
  grupo  grupo_categoria not null,
  orden  int not null default 0
);

-- ---------------------------------------------------------------- moderación

create table perfiles (
  id     uuid primary key references auth.users(id) on delete cascade,
  nombre text,
  rol    rol_perfil not null default 'moderador'
);

-- Evita recursión de RLS: se consulta desde las policies de otras tablas.
create or replace function es_moderador()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from perfiles where id = auth.uid());
$$;

-- ---------------------------------------------------------------- puntos

create table puntos (
  id                    uuid primary key default gen_random_uuid(),

  nombre                text not null,
  tipo_organizacion     tipo_organizacion not null,

  departamento_codigo   char(2) not null references departamentos(codigo),
  municipio_codigo      char(5) not null references municipios(codigo),
  direccion             text not null,
  barrio                text,
  referencia            text,
  ubicacion             geography(Point, 4326) not null,

  responsable_nombre    text not null,
  telefono              text not null,
  whatsapp              boolean not null default true,
  telefono_publico      boolean not null default false,  -- consentimiento Habeas Data
  correo                text,                            -- interno; nunca se publica

  horario_texto         text not null,
  horarios              jsonb,                           -- estructurado, fase 3
  fecha_inicio          date,
  fecha_fin             date,

  recibe_voluntarios    boolean not null default false,
  notas                 text,

  estado                estado_punto not null default 'pendiente',
  origen                origen_punto not null default 'formulario',
  entidad_oficial       boolean not null default false,  -- solo lo activa moderación

  token_edicion_hash    text not null,
  ultima_verificacion   timestamptz,
  verificado_por        uuid references perfiles(id),
  reportes_abiertos     int not null default 0,

  creado_en             timestamptz not null default now(),
  actualizado_en        timestamptz not null default now(),

  -- derivadas, para no tener que desempacar el geography en el cliente
  lat double precision generated always as (st_y(ubicacion::geometry)) stored,
  lng double precision generated always as (st_x(ubicacion::geometry)) stored,

  constraint fechas_coherentes check (fecha_fin is null or fecha_inicio is null or fecha_fin >= fecha_inicio)
);

create index puntos_ubicacion_idx    on puntos using gist (ubicacion);
create index puntos_estado_mun_idx   on puntos (estado, municipio_codigo);
create index puntos_estado_fecha_idx on puntos (estado, actualizado_en desc);
create index puntos_token_idx        on puntos (token_edicion_hash);

create table punto_categoria (
  punto_id       uuid not null references puntos(id) on delete cascade,
  categoria_slug text not null references categorias(slug),
  nivel          nivel_categoria not null,
  primary key (punto_id, categoria_slug)
);

create index punto_categoria_slug_idx on punto_categoria (categoria_slug, nivel);

create table reportes (
  id         uuid primary key default gen_random_uuid(),
  punto_id   uuid not null references puntos(id) on delete cascade,
  tipo       tipo_reporte not null,
  comentario text,
  contacto   text,
  ip_hash    text,
  resuelto   boolean not null default false,
  creado_en  timestamptz not null default now()
);

create index reportes_pendientes_idx on reportes (punto_id) where not resuelto;

-- ---------------------------------------------------------------- triggers

create or replace function tocar_actualizado_en()
returns trigger language plpgsql as $$
begin
  new.actualizado_en = now();
  return new;
end;
$$;

create trigger puntos_actualizado_en
  before update on puntos
  for each row execute function tocar_actualizado_en();
