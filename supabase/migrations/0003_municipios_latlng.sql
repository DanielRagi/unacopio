-- UnAcopio — lat/lng de los municipios, expuestos como columnas.
--
-- PostgREST devuelve una columna `geography` como EWKB en hexadecimal, que en el
-- navegador no sirve de nada. Estas dos columnas generadas dejan usar el
-- centroide directamente: centrar el mapa en el municipio que la persona eligió,
-- y tener a dónde caer cuando alguien registra sin JavaScript y no hay pin.
--
-- Se puede volver a correr sin romper nada.

alter table municipios
  add column if not exists lat double precision
    generated always as (st_y(centroide::geometry)) stored,
  add column if not exists lng double precision
    generated always as (st_x(centroide::geometry)) stored;
