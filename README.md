# UnAcopio

**Directorio abierto de puntos de acopio para la emergencia por el sismo en Colombia.**
→ [unacopio.co](https://unacopio.co)

Dos usos, una sola app:

1. **Quien recoge** registra su punto de acopio (ciudad, dirección, horarios, qué recibe, qué **no** recibe, prioridades, contacto).
2. **Quien dona** encuentra el punto más cercano y sabe qué llevar antes de salir de la casa.

> UnAcopio **no recibe dinero ni donaciones**. Solo publica información de puntos operados por terceros.

---

## Estado

**V1 completa** — fases 0 a 4 construidas y probadas, más la siembra inicial con
21 puntos reales de Medellín y Bogotá esperando verificación.

Lo que falta no es código: cuentas, un dominio y gente llamando por teléfono.
Está todo en **[`docs/PUESTA-EN-MARCHA.md`](docs/PUESTA-EN-MARCHA.md)**, que es
por donde hay que empezar.

| | |
|---|---|
| Qué hace y por qué | [`docs/PLAN.md`](docs/PLAN.md) |
| Por qué está hecho así | [`docs/DECISIONES.md`](docs/DECISIONES.md) — D1 a D14 |
| Esquema y seguridad | [`docs/MODELO-DATOS.md`](docs/MODELO-DATOS.md) |
| Los 21 puntos sembrados | [`datos/pilotaje/LEEME.md`](datos/pilotaje/LEEME.md) |

## Qué tiene

**Para quien dona** — listado por cercanía o por municipio, mapa con clusters,
filtro por lo que se quiere donar, sello de "Abierto ahora" en hora de Colombia,
semáforo de qué tan reciente es la verificación, y qué **no** llevar en rojo y
arriba. Botones de llamar, WhatsApp, cómo llegar y compartir. Página por
municipio para compartir (`/acopio/medellin`) y caché offline de lo ya visto.

**Para quien recoge** — registro público sin cuenta, con mapa y selector de
horarios. Para corregir o cerrar, una solicitud que aplica moderación.

**Para moderación** — cola de revisión con detección de duplicados a menos de
200 m, ronda de llamadas con reserva para que dos voluntarios no marquen el
mismo número, bandeja de solicitudes, edición completa con mapa, e importación
masiva desde CSV.

**Para todos los demás** — `/api/puntos.json` y `.csv` sin llave, con CC BY 4.0,
documentados en `/datos`. La idea es que medios y alcaldías reutilicen los datos
en vez de armar una sexta lista que se contradiga con las otras cinco.

## Stack

| Capa | Elección |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) + TypeScript |
| Estilos | Tailwind CSS v4 |
| Base de datos + Auth | Supabase (Postgres + PostGIS + Auth por magic link) |
| Mapa | Leaflet + react-leaflet + tiles de OpenStreetMap (sin API key) |
| Hosting | Vercel |
| Validación | Zod + Server Actions |

Justificación y alternativas descartadas en [`docs/DECISIONES.md`](docs/DECISIONES.md).

## Montaje

### 1. Dependencias

```bash
npm install
```

### 2. Proyecto de Supabase

1. Crear el proyecto en [supabase.com](https://supabase.com) (región `us-east-1`).
2. Database → Extensions → activar **postgis**.
3. En el SQL Editor, correr **en este orden**:

   | # | Archivo |
   |---|---|
   | 1 | `supabase/migrations/0001_esquema.sql` |
   | 2 | `supabase/migrations/0002_rls_y_funciones.sql` |
   | 3 | `supabase/migrations/0003_municipios_latlng.sql` |
   | 4 | `supabase/migrations/0004_sin_tokens_solicitudes.sql` |
   | 5 | `supabase/migrations/0005_buscar_puntos.sql` |
   | 6 | `supabase/migrations/0006_llamadas_y_lleno.sql` |
   | 7 | `supabase/migrations/0007_horarios_estructurados.sql` |
   | 8 | `supabase/seed/0001_categorias.sql` |
   | 9 | `supabase/seed/0002_municipios.sql` |
   | 10 | `supabase/migrations/0008_alcance.sql` |

   `0008` va **después** de las semillas: calcula el slug de cada municipio, así
   que necesita que los 1.122 ya estén cargados.

   Todo, menos `0001`, se puede volver a pegar completo sin romper nada. El
   editor de Supabase aborta la corrida entera cuando algo falla, así que poder
   reintentar sin averiguar qué alcanzó a crearse es parte del diseño. `0001` no:
   si el esquema se crea a medias, es mejor borrar y empezar limpio que remendar.

   **PostGIS tiene que quedar en el esquema `extensions`** (es donde lo pone el
   botón del panel). Ahí vive el tipo `geography`, y por eso las funciones que lo
   usan llevan `set search_path = public, extensions`. Si a alguna se le olvida,
   el error es `type "geography" does not exist`.

4. Crear el primer moderador: registrarse por magic link en `/admin` (fase 1) y
   luego insertar la fila en `perfiles`:

   ```sql
   insert into perfiles (id, nombre, rol)
   select id, 'Tu nombre', 'admin' from auth.users where email = 'tu@correo.com';
   ```

### 3. Variables de entorno

```bash
cp .env.example .env.local   # llenar con Project Settings → API
```

Las mismas variables van en Vercel. `SUPABASE_SERVICE_ROLE_KEY` es secreta y
nunca lleva el prefijo `NEXT_PUBLIC_`.

### 4. Arrancar

```bash
npm run dev     # http://localhost:3000
```

La portada muestra un diagnóstico: si faltan variables, si la base responde y si
los catálogos ya se cargaron.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run lint` | ESLint |
| `npm run municipios` | Regenera `supabase/seed/0002_municipios.sql` desde DIVIPOLA |
| `npm run db:probar` | Levanta un PostGIS en Docker, aplica todo el SQL y corre la prueba funcional |
| `npm run db:verificar` | Comprueba el proyecto real: llaves, catálogos, RLS y qué migraciones están aplicadas |
| `npm run probar:horarios` | Pruebas del cálculo de "abierto ahora" (zona horaria, jornadas partidas, fechas de campaña) |
| `npm run probar:importacion` | Pruebas del parser de CSV y de la revisión fila por fila |
| `npm run pilotaje` | Regenera el CSV de siembra desde `datos/pilotaje/*.json`, geocodificando con Nominatim |
| `npm run sembrar` | Carga ese CSV en la cola de moderación. `-- --ver` para ensayar, `-- --limpiar` para deshacer |
| `npm run tipos:scripts` | Chequeo de tipos de `scripts/`, que va aparte del proyecto |

`npm run db:probar` es la red de seguridad del esquema: verifica que el formulario
público no pueda autopublicarse, que `anon` no alcance la tabla base, que el
teléfono se enmascare sin consentimiento, que tres reportes de terceros
despubliquen un punto y que la solicitud de quien organiza el punto no cuente
para ese umbral. Correrlo antes de llevar cualquier cambio de SQL a Supabase.

## Estructura

```
src/
  app/                    rutas (App Router)
  lib/
    supabase/
      cliente.ts          navegador (RLS)
      servidor.ts         Server Components y Actions (RLS)
      admin.ts            llave de servicio — SALTA RLS, solo servidor
    tipos.ts              tipos que reflejan el esquema
    textos.ts             textos de la interfaz, centralizados
supabase/
  migrations/             esquema, RLS y funciones RPC
  seed/                   catálogos (categorías, municipios DANE)
  pruebas/                banco de pruebas del SQL
  correos/                plantillas de Auth, se pegan en el panel
datos/
  pilotaje/               recolección manual curada a mano + el CSV que produce
scripts/
  generar-municipios.mjs  descarga DIVIPOLA y genera el seed
  probar-sql.mjs          corre todo el SQL en un PostGIS de Docker
  pilotaje.mjs            geocodifica la recolección y arma el CSV de siembra
  sembrar-pilotaje.mjs    carga ese CSV en la cola de moderación
docs/                     plan, decisiones, modelo de datos y puesta en marcha
```

## Modelo de seguridad, en corto

- El público **nunca** consulta la tabla `puntos`: solo la vista `puntos_publicos`,
  que filtra por estado publicado y esconde el correo y el teléfono de quien no
  autorizó publicarlo.
- Registrar, buscar por cercanía y mandar solicitudes van por funciones RPC
  `security definer`. El formulario no puede publicarse solo ni marcarse como
  entidad oficial.
- **Nadie edita el directorio directamente.** Corregir o cerrar un punto es mandar
  una solicitud que aplica moderación: no hay tokens, ni contraseñas, ni enlaces
  secretos que se puedan filtrar.
- La moderación entra con Supabase Auth; sus permisos salen de la tabla `perfiles`.

Detalle en [`docs/MODELO-DATOS.md`](docs/MODELO-DATOS.md).
