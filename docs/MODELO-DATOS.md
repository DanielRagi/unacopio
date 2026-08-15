# Modelo de datos

Postgres en Supabase. Nombres de tablas y columnas en español para que el equipo
de moderación pueda leer el panel de Supabase sin traducir nada.

Extensiones: `postgis` (activar desde Database → Extensions en Supabase).

> Implementado en `supabase/migrations/0001_esquema.sql` y
> `0002_rls_y_funciones.sql`. Este documento explica el porqué; el SQL manda.

---

## `puntos`

El registro central. Un punto de acopio.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `uuid pk` | `gen_random_uuid()` |
| `nombre` | `text` | "Parroquia San José", "Coliseo Municipal" |
| `tipo_organizacion` | `enum` | `alcaldia`, `gobernacion`, `bomberos`, `defensa_civil`, `cruz_roja`, `iglesia`, `jac` (Junta de Acción Comunal), `ong`, `fundacion`, `empresa`, `colegio`, `universidad`, `conjunto_residencial`, `particular` |
| `departamento_codigo` | `char(2)` → `departamentos.codigo` | código DANE |
| `municipio_codigo` | `char(5)` → `municipios.codigo` | código DANE |
| `direccion` | `text` | "Calle 12 # 4-30" |
| `barrio` | `text null` | |
| `referencia` | `text null` | "Frente al parque principal, portón azul" — clave en zonas sin nomenclatura |
| `ubicacion` | `geography(Point,4326)` | pin puesto en el mapa por quien registra |
| `lat` / `lng` | `double precision` | columnas generadas a partir de `ubicacion`, para no desempacar el geography en el cliente |
| `responsable_nombre` | `text` | |
| `telefono` | `text` | E.164 → `+57...` |
| `whatsapp` | `boolean` | si ese número recibe WhatsApp |
| `telefono_publico` | `boolean` | consentimiento Habeas Data; si es `false`, solo lo ve moderación |
| `correo` | `text null` | interno, para el enlace de edición y el recordatorio de 48h; nunca se publica. Nulable en la base por las cargas de moderación e importación, pero **obligatorio en el formulario público**: desde D8 es el único canal de vuelta hacia el responsable |
| `horario_texto` | `text` | lo que lee la persona. **Se genera** a partir de `horarios`, no se escribe aparte: si el texto y las franjas pudieran contradecirse, el badge diría una cosa y la ficha otra |
| `horarios` | `jsonb null` | franjas estructuradas: `[{"dia":1,"desde":"08:00","hasta":"18:00"}]`, con `dia` 0=domingo…6=sábado, igual que `Date.getDay()`. De aquí sale el badge "Abierto ahora", calculado en hora de Colombia. Null en los registros viejos y en las cargas de moderación: sin franjas no se muestra badge |
| `fecha_inicio` | `date null` | |
| `fecha_fin` | `date null` | campañas con fecha de cierre |
| `recibe_voluntarios` | `boolean` | |
| `notas` | `text null` | "Tenemos parqueadero", "Se puede descargar en carro" |
| `estado` | `enum` | `pendiente`, `publicado`, `rechazado`, `cerrado`, `lleno` |
| `ultima_verificacion` | `timestamptz null` | la fija moderación al confirmar por teléfono. Es la fuente del semáforo de frescura |
| `ultimo_intento_llamada` | `timestamptz null` | último intento de llamada, **haya contestado o no**. Saca el punto de la cola por 30 minutos para que dos voluntarios no marquen el mismo número |
| `intentos_fallidos` | `int` | llamadas seguidas sin respuesta; se reinicia al contestar |
| `verificado_por` | `uuid null` → `perfiles.id` | |
| `entidad_oficial` | `boolean` | banda verde; solo lo activa moderación |
| `reportes_abiertos` | `int` | contador desnormalizado, dispara despublicación |
| `origen` | `enum` | `formulario`, `moderacion`, `importacion` |
| `creado_en` / `actualizado_en` | `timestamptz` | |

Índices: `GIST(ubicacion)`, `(estado, municipio)`, `(estado, actualizado_en desc)`.

## `categorias`

Catálogo semilla, no lo edita el usuario.

| Columna | Tipo |
|---|---|
| `slug` | `text pk` |
| `nombre` | `text` |
| `grupo` | `enum` |
| `orden` | `int` |

Semilla inicial, agrupada:

- **agua**: `agua_embotellada`, `agua_bidones`, `tanques`
- **alimentos**: `no_perecederos`, `enlatados`, `granos`, `panela_azucar`, `aceite`, `formula_infantil`, `comida_preparada`
- **aseo**: `jabon`, `papel_higienico`, `panales_bebe`, `panales_adulto`, `toallas_higienicas`, `cepillo_crema_dental`, `desinfectantes`
- **salud**: `botiquin`, `medicamentos_sellados`, `suero_oral`, `tapabocas`, `guantes`
- **albergue**: `colchonetas`, `cobijas`, `sabanas`, `carpas`, `plasticos_lona`, `toldillos`
- **ropa**: `ropa_nueva`, `ropa_usada_buen_estado`, `calzado`, `ropa_bebe`
- **hogar**: `ollas_utensilios`, `estufas_gas`, `velas_linternas`, `pilas`, `baterias_celular`
- **construccion**: `tejas`, `herramientas`, `palas_picas`, `guantes_trabajo`, `botas`
- **mascotas**: `alimento_perro`, `alimento_gato`, `guacales`
- **otros**: `voluntarios`, `transporte_camiones`, `equipos_pesados`

## `punto_categoria`

| Columna | Tipo | Notas |
|---|---|---|
| `punto_id` | `uuid` → `puntos.id` | |
| `categoria_slug` | `text` → `categorias.slug` | |
| `nivel` | `enum` | `alta` = urgente ahora · `si` = se recibe · `no_recibe` = **no traer** |

PK compuesta `(punto_id, categoria_slug)`.

`no_recibe` no es "ausencia de fila": es una fila explícita. Es la que evita que
lleguen 300 bultos de ropa usada a un punto que solo necesita agua (ver D5).

## `reportes`

La bandeja de moderación. Guarda **todo lo que la gente nos dice sobre un punto**:
tanto la solicitud de quien lo organiza ("cambió el horario", "ya cerramos") como
el reporte de un tercero ("fui y no había nada").

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `uuid pk` | |
| `punto_id` | `uuid` → `puntos.id` | |
| `tipo` | `enum`: `cerrado`, `info_incorrecta`, `duplicado`, `no_existe`, `spam` | `info_incorrecta` = pedir un cambio · `cerrado` = pedir el cierre |
| `comentario` | `text null` | las observaciones; es el mensaje que nos deja la persona |
| `contacto` | `text null` | opcional, para poder llamar y confirmar |
| `es_responsable` | `boolean` | dice ser quien organiza el punto. **No está verificado**: es una pista para priorizar, no una credencial. Su solicitud no cuenta para el umbral de tres reportes |
| `ip_hash` | `text` | anti-abuso: ignora repeticiones sobre el mismo punto en una hora |
| `resuelto` | `boolean` | atendida por moderación. No se borra: es el historial de por qué un punto quedó como quedó |
| `creado_en` | `timestamptz` | |

## `perfiles`

Espejo de `auth.users` para el equipo de moderación.

| Columna | Tipo |
|---|---|
| `id` | `uuid pk` → `auth.users.id` |
| `nombre` | `text` |
| `rol` | `enum`: `moderador`, `admin` |

## `departamentos` y `municipios`

Catálogo DIVIPOLA (33 departamentos, 1.122 municipios) con centroide, para el
selector y para "puntos en tu municipio" cuando la persona no da permiso de GPS.

| `departamentos` | Tipo |
|---|---|
| `codigo` (pk) | `char(2)` |
| `nombre` | `text` |

| `municipios` | Tipo |
|---|---|
| `codigo` (pk) | `char(5)` |
| `nombre` | `text` |
| `departamento_codigo` | `char(2)` → `departamentos.codigo` |
| `centroide` | `geography(Point,4326)` |

Se generan con `npm run municipios`, que baja el dataset `pqwj-3fi4` de
datos.gov.co y escribe `supabase/seed/0002_municipios.sql`. El SQL queda
versionado en el repo: el sitio no depende de que esa fuente esté arriba.

---

## Seguridad: la vista pública y las RPC

El principio: **el público no toca las tablas base**. `puntos`, `punto_categoria`
y `reportes` tienen los permisos revocados para `anon` y `authenticated`. Todo lo
público entra por una vista y tres funciones.

| Puerta | Quién | Qué hace |
|---|---|---|
| Vista `puntos_publicos` | anónimo | Deja pasar `publicado` y `lleno` (ver D11), y expone `estado` para poder marcarlos. Enmascara `telefono` cuando `telefono_publico = false`, y nunca expone `correo`. Trae las categorías ya agregadas en un `jsonb`, para resolver el listado en una sola consulta. |
| `registrar_punto(...)` | anónimo | Inserta forzando `estado = 'pendiente'` y `entidad_oficial = false` — el formulario no puede autopublicarse ni autocertificarse. Valida que la coordenada caiga dentro de Colombia. Devuelve el `uuid` del punto. |
| `buscar_puntos(...)` | anónimo | La única puerta del listado y del mapa. Filtra por departamento, municipio y categoría, y —si le pasan coordenadas— por radio, ordenando por distancia. Sin coordenadas ordena por verificación más reciente. El filtro por categoría solo cuenta si el punto la recibe: un `no_recibe` es justamente la razón para no mostrarlo. |
| `reportar_punto(...)` | anónimo | Recibe solicitudes y reportes. Ignora repeticiones del mismo `ip_hash` en una hora. Al tercer reporte **de terceros** despublica el punto; las solicitudes con `es_responsable` no suman a ese contador. |
| `posibles_duplicados(...)` | moderación | Puntos del mismo municipio a menos de 200 m. Va con `SECURITY INVOKER` a propósito: consulta la tabla base, así que RLS lo deja vacío para cualquiera que no sea del equipo. |

La búsqueda ordena los puntos `lleno` de últimos: siguen sirviendo como
información —evitan un viaje— pero no deberían ser la primera opción de nadie.

Las tres son `security definer` con `search_path` fijo.

La moderación sí entra por RLS normal: las policies de `puntos`, `punto_categoria`
y `reportes` preguntan por `es_moderador()`, que consulta `perfiles`. Esa función
es `security definer` justamente para no morder su propia cola con RLS.

No hay edición directa por parte del público (ver D9): corregir o cerrar un punto
es mandar una solicitud, que cae en la misma tabla `reportes` y la aplica
moderación.

## Consulta clave: `buscar_puntos`

```sql
-- "quiero donar agua y estoy por acá"
select * from buscar_puntos(
  p_lat => 6.2442, p_lng => -75.5812,
  p_radio_m => 20000, p_categoria => 'agua_embotellada'
);

-- "muéstrame todo lo que hay en Manizales"
select * from buscar_puntos(p_municipio => '17001');
```

Devuelve `(punto jsonb, metros double precision)`, con `metros` en `null` cuando
no se mandaron coordenadas. Se llama con `supabase.rpc('buscar_puntos', {...})`,
sin exponer SQL al navegador. El índice que la sostiene es `GIST(ubicacion)`.

Es la **única** consulta del listado y del mapa. Tenerla en un solo lugar es lo
que evita que las dos vistas muestren cosas distintas para el mismo filtro, que
es de los errores más difíciles de notar.
