-- UnAcopio — qué ciudades hay en la cola de moderación.
--
-- Para poder filtrar el panel por departamento y municipio hace falta saber
-- cuáles tienen puntos. Mostrar los 33 departamentos y los 1.122 municipios
-- sería peor que no filtrar: quien modera tendría que buscar los dos que
-- importan entre mil que están vacíos.
--
-- Va en SQL y no contando en la aplicación por dos razones. La primera es que
-- PostgREST corta en 1.000 filas sin avisar, y traerse la tabla entera para
-- agrupar en JavaScript es justo el error que ya nos costó una vez —el
-- importador perdía 122 municipios, Bogotá entre ellos—. La segunda es que un
-- `group by` es una línea acá y quince allá.
--
-- **SECURITY INVOKER a propósito** (el modo por defecto): la función consulta
-- `puntos`, así que RLS aplica con los permisos de quien llama. A quien no sea
-- moderador le devuelve cero filas, sin que haya que revisarlo por aparte.
--
-- Se puede volver a correr sin romper nada.

create or replace function ubicaciones_moderacion()
returns table (
  departamento_codigo char(2),
  departamento        text,
  municipio_codigo    char(5),
  municipio           text,
  pendientes          int,
  total               int
)
language sql
stable
set search_path = public
as $$
  select p.departamento_codigo, d.nombre, p.municipio_codigo, m.nombre,
         count(*) filter (where p.estado = 'pendiente')::int,
         count(*)::int
  from puntos p
  join departamentos d on d.codigo = p.departamento_codigo
  join municipios    m on m.codigo = p.municipio_codigo
  group by p.departamento_codigo, d.nombre, p.municipio_codigo, m.nombre
  -- Primero donde hay más por revisar: es donde va a estar el trabajo.
  order by count(*) filter (where p.estado = 'pendiente') desc, d.nombre, m.nombre;
$$;

revoke execute on function ubicaciones_moderacion from public, anon;
grant execute on function ubicaciones_moderacion to authenticated;
