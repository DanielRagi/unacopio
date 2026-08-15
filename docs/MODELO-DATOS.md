# Modelo de datos

Postgres en Supabase. Nombres de tablas y columnas en español para que el equipo
de moderación pueda leer el panel de Supabase sin traducir nada.

Extensiones: `postgis` (activar desde Database → Extensions en Supabase) y
`pgcrypto` (para los tokens de edición).

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
| `horario_texto` | `text` | "Lun a Sáb 8am–6pm, domingos 9am–1pm" — v1 en texto libre |
| `horarios` | `jsonb null` | estructurado, se llena en F3 para el badge "Abierto ahora" |
| `fecha_inicio` | `date null` | |
| `fecha_fin` | `date null` | campañas con fecha de cierre |
| `recibe_voluntarios` | `boolean` | |
| `notas` | `text null` | "Tenemos parqueadero", "Se puede descargar en carro" |
| `estado` | `enum` | `pendiente`, `publicado`, `rechazado`, `cerrado`, `lleno` |
| `token_edicion_hash` | `text` | SHA-256 del token del link secreto de edición; el token en claro se muestra una sola vez, al registrar |
| `ultima_verificacion` | `timestamptz null` | la fija moderación al confirmar por teléfono |
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

| Columna | Tipo |
|---|---|
| `id` | `uuid pk` |
| `punto_id` | `uuid` → `puntos.id` |
| `tipo` | `enum`: `cerrado`, `info_incorrecta`, `duplicado`, `no_existe`, `spam` |
| `comentario` | `text null` |
| `contacto` | `text null` |
| `ip_hash` | `text` — anti-abuso |
| `resuelto` | `boolean` |
| `creado_en` | `timestamptz` |

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
| Vista `puntos_publicos` | anónimo | Solo `estado = 'publicado'`. Enmascara `telefono` cuando `telefono_publico = false`, y nunca expone `correo` ni `token_edicion_hash`. Trae las categorías ya agregadas en un `jsonb`, para resolver el listado en una sola consulta. |
| `registrar_punto(...)` | anónimo | Inserta forzando `estado = 'pendiente'` y `entidad_oficial = false` — el formulario no puede autopublicarse ni autocertificarse. Valida que la coordenada caiga dentro de Colombia. Devuelve el token de edición en claro, una sola vez. |
| `puntos_cercanos(...)` | anónimo | Publicados dentro de un radio, ordenados por distancia, con filtro opcional por categoría (solo cuenta si el punto la recibe, no si la rechaza). |
| `reportar_punto(...)` | anónimo | Inserta el reporte, ignora repeticiones del mismo `ip_hash` en una hora y despublica el punto al tercer reporte abierto. |

Las tres son `security definer` con `search_path` fijo.

La moderación sí entra por RLS normal: las policies de `puntos`, `punto_categoria`
y `reportes` preguntan por `es_moderador()`, que consulta `perfiles`. Esa función
es `security definer` justamente para no morder su propia cola con RLS.

La edición por token no pasa por el cliente: va por una Server Action que compara
el hash con la `service_role` key. Esa llave nunca sale del servidor.

## Consulta clave: puntos más cercanos

```sql
select * from puntos_cercanos(
  p_lat => 6.2442, p_lng => -75.5812,
  p_radio_m => 20000, p_categoria => 'agua_embotellada'
);
```

Devuelve `(punto jsonb, metros double precision)`. Se llama con
`supabase.rpc('puntos_cercanos', { p_lat, p_lng, p_radio_m, p_categoria })`, sin
exponer SQL al navegador. El índice que la sostiene es `GIST(ubicacion)`.
