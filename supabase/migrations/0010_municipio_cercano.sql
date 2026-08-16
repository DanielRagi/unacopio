-- UnAcopio — resolver la ubicación aproximada de alguien a un municipio.
--
-- Sirve para que la portada abra mostrando la ciudad de quien entra y no el país
-- entero. Los datos vienen de la geolocalización por IP que Vercel deja en las
-- cabeceras: un nombre de ciudad y un par de coordenadas, ambos de precisión
-- de ciudad. Pedir el municipio es exactamente la granularidad que eso aguanta.
--
-- Se puede volver a correr sin romper nada.

-- Índice para el operador de vecino más cercano (`<->`). Sin él son 1.122
-- distancias calculadas en cada visita.
create index if not exists municipios_centroide_idx on municipios using gist (centroide);

/*
 * El nombre manda; la distancia solo desempata.
 *
 * La primera versión resolvía únicamente por centroide más cercano, y con eso
 * el centro de Bogotá caía en **Cota**. No era un error de redondeo: el
 * centroide DANE de Bogotá D.C. está en el páramo de Sumapaz, a unos 40 km del
 * centro urbano, porque el distrito incluye toda esa zona rural. Desde la Plaza
 * de Bolívar, el centroide más cercano es el de un municipio vecino.
 *
 * El mismo problema tiene cualquier municipio grande y alargado, así que
 * arreglarlo a mano para Bogotá habría dejado la trampa puesta para los demás.
 *
 * El nombre de la ciudad que manda Vercel es mucho mejor señal, y cuando el
 * nombre se repite entre departamentos —Argelia, La Unión, El Peñón— la
 * coordenada desempata bien, porque los homónimos quedan lejos entre sí.
 */
create or replace function municipio_de_ubicacion(
  p_ciudad text,
  p_lat    double precision,
  p_lng    double precision
)
returns table (
  codigo char(5), nombre text, slug text,
  departamento_codigo char(2), departamento text,
  metros double precision, por text
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  with punto as (
    select case
             when p_lat between -5 and 14 and p_lng between -82 and -66
             then st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography
           end as g
  ),
  candidatos as (
    -- Por nombre. Va primero y con `por = 'nombre'` para poder distinguirlo.
    select m.codigo, m.nombre, m.slug, m.departamento_codigo,
           st_distance(m.centroide, p.g) as metros, 'nombre' as por, 1 as prioridad
    from municipios m, punto p
    where coalesce(trim(p_ciudad), '') <> ''
      -- Se comparan las dos formas a propósito. Contra el nombre, para que los
      -- homónimos —Argelia, La Unión— entren todos y desempate la coordenada.
      -- Y contra el slug, porque hay nombres oficiales que nadie escribe así:
      -- el DANE dice "Bogotá D.C.", el proveedor de IP dice "Bogota", y sin
      -- esta segunda comparación la capital caía por cercanía en Cota.
      and (slug_texto(m.nombre) = slug_texto(p_ciudad) or m.slug = slug_texto(p_ciudad))

    union all

    -- Y si el nombre no cuadra con nada, el centroide más cercano.
    select m.codigo, m.nombre, m.slug, m.departamento_codigo,
           st_distance(m.centroide, p.g), 'cercania', 2
    from municipios m, punto p
    where p.g is not null and m.centroide is not null
    order by 7, 5
    limit 40
  )
  select c.codigo, c.nombre, c.slug, c.departamento_codigo, d.nombre, c.metros, c.por
  from candidatos c
  join departamentos d on d.codigo = c.departamento_codigo
  -- Entre los que coinciden por nombre gana el más cercano a la coordenada; si
  -- no hubo coordenada, el orden por `metros` deja los nulos de último y toma
  -- el primero, que con un solo homónimo es el correcto.
  order by c.prioridad, c.metros nulls last
  limit 1;
$$;

grant execute on function municipio_de_ubicacion to anon, authenticated;

-- La versión vieja, solo por cercanía, queda fuera: dar un municipio equivocado
-- con cara de certeza es peor que no dar ninguno.
drop function if exists municipio_mas_cercano(double precision, double precision);
