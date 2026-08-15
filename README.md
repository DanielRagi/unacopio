# UnAcopio

**Directorio abierto de puntos de acopio para la emergencia por el sismo en Colombia.**
→ [unacopio.co](https://unacopio.co)

Dos usos, una sola app:

1. **Quien recoge** registra su punto de acopio (ciudad, dirección, horarios, qué recibe, qué **no** recibe, prioridades, contacto).
2. **Quien dona** encuentra el punto más cercano y sabe qué llevar antes de salir de la casa.

> UnAcopio **no recibe dinero ni donaciones**. Solo publica información de puntos operados por terceros.

---

## Estado

**Fase 0 lista** — proyecto montado, esquema y catálogos listos para cargar.
Siguiente: fase 1 (formulario de registro + listado + moderación). Ver [`docs/PLAN.md`](docs/PLAN.md).

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
   | 3 | `supabase/seed/0001_categorias.sql` |
   | 4 | `supabase/seed/0002_municipios.sql` |

   `0002` y los dos seeds se pueden volver a pegar completos sin romper nada. El
   editor de Supabase aborta la corrida entera cuando algo falla, así que poder
   reintentar sin averiguar qué alcanzó a crearse es parte del diseño.

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

`npm run db:probar` es la red de seguridad del esquema: verifica que el formulario
público no pueda autopublicarse, que el token quede hasheado, que `anon` no
alcance la tabla base, que el teléfono se enmascare sin consentimiento y que tres
reportes despubliquen un punto. Correrlo antes de llevar cualquier cambio de SQL
a Supabase.

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
scripts/
  generar-municipios.mjs  descarga DIVIPOLA y genera el seed
  probar-sql.mjs          corre todo el SQL en un PostGIS de Docker
docs/                     plan, modelo de datos y decisiones
```

## Modelo de seguridad, en corto

- El público **nunca** consulta la tabla `puntos`: solo la vista `puntos_publicos`,
  que filtra por estado publicado y esconde el correo, el token de edición y el
  teléfono de quien no autorizó publicarlo.
- Registrar, buscar por cercanía y reportar van por funciones RPC `security definer`.
  El formulario no puede publicarse solo ni marcarse como entidad oficial.
- La moderación entra con Supabase Auth; sus permisos salen de la tabla `perfiles`.

Detalle en [`docs/MODELO-DATOS.md`](docs/MODELO-DATOS.md).
