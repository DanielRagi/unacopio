-- Un punto cuya campaña ya terminó sale del directorio, sin que nadie lo toque.
--
-- El 21 de agosto aparecieron en el sitio tres puntos publicados cuya fecha de
-- cierre había pasado: el acopio de mascotas de Corferias (cerró el 17), la
-- Universidad Católica (el 19) y Somos Iglesia Medellín (el 16). Se veían
-- exactamente igual que uno abierto: con su pin en el mapa, su botón de "Cómo
-- llegar" y sin ninguna advertencia.
--
-- Eran dos fallas encadenadas. En el cliente, `estadoApertura` devolvía `null`
-- antes de mirar las fechas cuando el punto no tenía franjas horarias — y
-- ninguno de los importados las tiene—, así que no salía ni el sello de
-- "cerrado". Eso ya está arreglado en `src/lib/horarios.ts`. Pero el sello solo
-- no alcanza: el punto seguía apareciendo en el listado, en el mapa, en el
-- sitemap y en la API.
--
-- La corrección de fondo va acá, en la vista, porque es la puerta por la que
-- pasa todo lo público. `fecha_fin` es una fecha en hora de Colombia, así que
-- se compara contra la fecha de allá y no contra el UTC del servidor: si no,
-- entre las 7 p. m. y la medianoche de Colombia el punto desaparecería un día
-- antes de tiempo.
--
-- Se compara con >= para que el último día siga siendo un día hábil: "hasta el
-- 23 de agosto" significa que el 23 todavía reciben.

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
where p.estado in ('publicado', 'lleno')
  and (p.fecha_fin is null
       or p.fecha_fin >= (now() at time zone 'America/Bogota')::date);

comment on view puntos_publicos is
  'Lo único que ve el público. Filtra por estado y además esconde los puntos '
  'cuya fecha_fin ya pasó, en hora de Colombia.';

grant select on puntos_publicos to anon, authenticated;
