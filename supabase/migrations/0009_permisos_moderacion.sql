-- UnAcopio — moderación recupera el permiso de tabla que le faltaba.
--
-- El bug: la migración 0002 hacía
--
--     revoke all on puntos, punto_categoria, reportes from anon, authenticated;
--
-- y confiaba en que las policies de RLS le devolvieran el acceso a moderación.
-- No funciona así. En Postgres **una policy no otorga permiso: filtra filas
-- dentro del permiso que ya se tenga**. Sin el GRANT, la policy nunca se evalúa.
--
-- El resultado era que un moderador con sesión válida, con su fila en `perfiles`
-- y con `es_moderador()` devolviendo `true`, recibía «permission denied for
-- table puntos» al abrir el panel. La cola de moderación no cargaba para nadie.
--
-- Por qué no lo agarró `npm run db:probar`: el banco de pruebas comprobaba que
-- `anon` estuviera bloqueado —lo estaba— y hacía todo lo demás como superusuario,
-- que se salta tanto los permisos como RLS. Nunca hubo una prueba que se pusiera
-- en el rol `authenticated` con un perfil de moderador, que es exactamente lo
-- que hace el panel. Ahora la hay.
--
-- Esto NO afloja la seguridad: quien esté autenticado y no sea del equipo sigue
-- viendo cero filas, porque las policies preguntan por `es_moderador()`. Y `anon`
-- sigue sin ningún permiso sobre las tablas base.
--
-- Se puede volver a correr sin romper nada.

revoke all on puntos, punto_categoria, reportes from anon;

grant select, insert, update, delete on puntos          to authenticated;
grant select, insert, update, delete on punto_categoria to authenticated;
grant select, insert, update, delete on reportes        to authenticated;
