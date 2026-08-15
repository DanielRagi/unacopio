-- Piezas que Supabase ya trae y que un Postgres pelado no tiene.
-- Solo para validar las migraciones en local (npm run db:probar).
-- Esto NO se corre nunca contra el proyecto real de Supabase.

create schema if not exists auth;
create schema if not exists extensions;

-- Supabase instala PostGIS en el esquema `extensions`; la imagen de Docker lo
-- instala en `public`. Reubicarlo aquí es lo que hace que el banco de pruebas se
-- parezca al entorno real: si una función fija `search_path` y se olvida de
-- `extensions`, en local pasaría y en Supabase explotaría con
-- «type "geography" does not exist». Mejor que falle acá.
drop extension if exists postgis_tiger_geocoder cascade;
drop extension if exists postgis_topology cascade;
drop extension if exists postgis cascade;
create extension postgis with schema extensions;

-- Igual que en Supabase, `extensions` va en el search_path de la conexión.
do $$
begin
  -- La lista va literal en el DDL: si se pasa como cadena (%L) Postgres la toma
  -- como un solo nombre de esquema y el search_path queda inservible.
  execute format('alter database %I set search_path to "$user", public, extensions',
                 current_database());
end
$$;

create table if not exists auth.users (
  id    uuid primary key default gen_random_uuid(),
  email text
);

create or replace function auth.uid() returns uuid
  language sql stable as $$ select null::uuid $$;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end
$$;

grant usage on schema public, extensions to anon, authenticated;
