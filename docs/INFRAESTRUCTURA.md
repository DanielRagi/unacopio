# Infraestructura — el mapa técnico de UnAcopio

Dónde vive cada pieza, con qué cuenta se entra, qué se vence y cuándo, y qué se
rompe si algo de esto falta.

`PUESTA-EN-MARCHA.md` es el instructivo de cómo montarlo. **Este documento es el
inventario**: para cuando ya está montado y hay que responder «¿dónde está el
DNS?» o «¿quién paga esto?» sin ir a adivinar entre paneles.

> **Acá no hay contraseñas ni llaves.** Solo los nombres de las llaves y el
> lugar donde viven. Ver [Secretos](#secretos-dónde-vive-cada-llave).

---

## De una ojeada

```
                    ┌─────────────────────┐
   quien dona  ───► │  unacopio.co        │
   quien recoge     │  Next.js en Vercel  │
                    └──────────┬──────────┘
                               │ SQL + Auth
                    ┌──────────▼──────────┐
                    │  Supabase           │
                    │  Postgres + PostGIS │
                    │  Auth (magic link)  │
                    └──────────┬──────────┘
                               │ SMTP saliente
                    ┌──────────▼──────────┐
                    │  Spacemail          │
                    │  hola@unacopio.co   │
                    └─────────────────────┘

   DNS de unacopio.co ──► Spaceship (registrador Y zona DNS)
   Código             ──► GitHub · DanielRagi/unacopio
```

Vercel construye desde GitHub en cada push a `main`. Supabase guarda todo el
estado. Spacemail solo manda los correos de acceso de moderación. Spaceship es el
único punto donde el dominio y la zona DNS conviven.

---

## Cuentas y proveedores

| Qué | Proveedor | Cuenta | Cómo se entra | Se vence |
|---|---|---|---|---|
| Código | GitHub | `DanielRagi` | usuario propio | — |
| Despliegue | Vercel | conectada **con GitHub** | *Continue with GitHub* | — |
| Base de datos + Auth | Supabase | conectada **con GitHub** | *Continue with GitHub* | — |
| Dominio | Spaceship | `DanielRamg` | usuario propio | **15 ago 2027** |
| DNS | Spaceship | `DanielRamg` | misma cuenta | con el dominio |
| Correo | Spacemail (servicio de Spaceship) | `DanielRamg` | misma cuenta | **15 ago 2027** |

**Lo importante de esa tabla:** Vercel y Supabase **no tienen credenciales
propias**. Entran por GitHub. Eso quiere decir que la cuenta de GitHub
`DanielRagi` es la llave maestra de tres de los cinco servicios — si se pierde el
acceso a GitHub, se pierde el acceso al despliegue y a la base de datos al mismo
tiempo. Por eso la 2FA de GitHub y sus códigos de respaldo no son un detalle: son
*la* credencial del proyecto.

### Identificadores públicos

Estos se pueden pegar en cualquier lado sin problema — el navegador ya los recibe
en cada visita:

| | |
|---|---|
| Dominio | `unacopio.co` (con `www` redirigiendo al apex) |
| Repositorio | `github.com/DanielRagi/unacopio` |
| Proyecto de Supabase | `pbymxaxlehymsrwconpv` |
| URL de la API | `https://pbymxaxlehymsrwconpv.supabase.co` |

---

## Fechas críticas

| Fecha | Qué pasa | Aviso |
|---|---|---|
| **15 ago 2027** | Vence el dominio `unacopio.co` | Dejar la renovación automática **prendida** en Spaceship |
| **15 ago 2027** | Vence Spacemail (mismo ciclo, va con el dominio) | idem |

**Vencen el mismo día, y ese es el riesgo.** Si el dominio se cae, no se cae solo
el sitio: se cae el correo con él, y con el correo se van los enlaces de acceso
al panel de moderación. Es decir, el día que expire el dominio nadie puede entrar
a arreglar nada por la vía normal — quedaría solo `npm run acceso` desde una
terminal con `.env.local`.

Dos cosas que cuestan cinco minutos y quitan ese riesgo:

1. Renovación automática prendida, con una tarjeta que no expire antes de 2027.
2. Un recordatorio en el calendario para **julio de 2027**, un mes antes, con la
   cuenta de Spaceship anotada.

---

## Dominio y DNS

El dominio está en Spaceship **y la zona DNS también**. Eso fue una decisión, no
una casualidad: apuntar `unacopio.co` a Vercel con registros `A`/`CNAME` en vez
de mover los *nameservers* deja los registros de correo donde están.

> **Si algún día se mueven los nameservers a Vercel**, la zona pasa a Vercel y
> los MX, SPF, DKIM y DMARC de Spacemail hay que volver a crearlos allá. El
> correo se cae en silencio hasta que alguien lo note. Los detalles de cada
> registro están en `PUESTA-EN-MARCHA.md` §1.4.

| Registro | Para qué | Si falta |
|---|---|---|
| `A` / `CNAME` → Vercel | El sitio | No hay sitio |
| `MX` → Spacemail | Recibir en `hola@` | Nadie puede responder un correo del proyecto |
| `TXT` SPF | Autoriza a Spacemail a mandar | Gmail marca como sospechoso |
| `TXT` DKIM | Firma los correos | **Gmail manda a spam o rechaza** |
| `TXT` DMARC | Política + reportes | Menos reputación, no bloquea |

DKIM es el que más pesa. Si los enlaces de acceso empiezan a caer en spam, ese es
el primer lugar donde mirar.

---

## Secretos: dónde vive cada llave

Cuatro variables mueven el proyecto. Dos son públicas a propósito y dos no.

| Variable | ¿Secreta? | Vive en |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | No — va al navegador | `.env.local` · Vercel |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | No — va al navegador | `.env.local` · Vercel |
| `NEXT_PUBLIC_SITIO_URL` | No | `.env.local` · Vercel |
| `SUPABASE_SERVICE_ROLE_KEY` | **Sí. Salta RLS por completo** | `.env.local` · Vercel · gestor de contraseñas |

Fuera del código hay tres más que ningún archivo conoce:

| Credencial | Vive en |
|---|---|
| Contraseña del buzón `hola@unacopio.co` | Panel de Spacemail · SMTP de Supabase · gestor |
| Cuenta de Spaceship (`DanielRamg`) | gestor |
| Cuenta de GitHub (`DanielRagi`) + códigos 2FA | gestor |

### Por qué la `service_role` es distinta a todas

No es «una llave más con más permisos». **Se salta RLS por completo**: con ella
se leen los teléfonos que nadie autorizó publicar, se edita cualquier punto y se
borra la base entera. Es la llave que usan `npm run sembrar`, `npm run acceso` y
`npm run publicar:asistido`, que por eso solo corren desde una terminal.

Nunca lleva el prefijo `NEXT_PUBLIC_`. Si alguna vez alguien se lo pone, sale en
el bundle del navegador y hay que rotarla el mismo día.

### Lo que ya está puesto para que no se escape

- **`.gitignore`** ignora todo `.env*` menos `.env.example`.
- **`.env.example` está vacío de valores**, a propósito, y se versiona así.
- **Hook de pre-commit** (`.githooks/pre-commit` → `scripts/guardia-secretos.mjs`),
  instalado solo por `npm install`. Bloquea el commit si aparece un
  `sb_secret_`, un `sb_publishable_`, un JWT o un `ghp_` dentro de un archivo
  `.env*`, `*.example` o `*.sample`.
- **Push protection de GitHub**, que ya frenó una vez la `service_role` camino al
  repositorio.

Tres capas, y la del medio existe porque la de arriba se olvida: el hook solo
funciona en la máquina donde alguien corrió `npm install`. En un clon nuevo hay
que correrlo antes del primer commit.

### Cómo rotar cada cosa

| Llave | Dónde | Qué actualizar después |
|---|---|---|
| `service_role` y `anon` | Supabase → Project Settings → API → *Rotate* | `.env.local` y las variables de Vercel — **redesplegar** |
| Contraseña del buzón | Panel de Spacemail | El SMTP en Supabase → Authentication → Emails |
| GitHub | Cuenta de GitHub | Nada más: Vercel y Supabase siguen la sesión |

Rotar `anon` rompe el sitio hasta que se redespliega Vercel. Rotar la
`service_role` no rompe el sitio, pero sí los scripts de terminal.

---

## Qué se rompe si cae cada pieza

| Se cae | Sigue funcionando | Se muere |
|---|---|---|
| **Vercel** | nada | El sitio entero |
| **Supabase** | nada útil | Sitio y panel: no hay datos ni sesiones |
| **Spacemail** | Sitio y panel para quien ya tenga sesión | Enlaces de acceso nuevos → salida: `npm run acceso` |
| **DNS / dominio** | nada | Sitio y correo a la vez |
| **GitHub** | Sitio y base, funcionando | Desplegar cambios, y el acceso a Vercel y Supabase |

La fila que sorprende es la última. El sitio no depende de GitHub para *estar en
línea*, pero sí para *cambiar*, y como Vercel y Supabase se entran con GitHub,
perder esa cuenta deja el proyecto vivo y congelado al mismo tiempo.

---

## Lo que NO está montado

Vale más escribirlo que descubrirlo un martes:

- **Respaldos de la base.** Supabase hace respaldos automáticos según el plan.
  **Hay que verificar cuál tiene este proyecto** y, si es el gratuito, exportar
  `puntos` y `punto_categoria` a CSV cada tanto. El directorio es trabajo humano
  de llamadas: se puede reconstruir el código en un día, la lista verificada no.
- **Monitoreo / alertas.** Nadie avisa si el sitio se cae. Un chequeo gratuito
  (UptimeRobot o similar) contra `unacopio.co` cuesta cinco minutos.
- **Correo transaccional.** Spacemail es un buzón, no un proveedor de envío
  masivo. Para los enlaces de acceso de cinco o diez moderadores está perfecto;
  el día que se quiera el recordatorio automático a *todos* los responsables de
  punto (D10, D15), eso necesita Resend, Postmark o SES. Mandarlo desde el buzón
  termina en throttling y con el dominio quemado.
- **Un segundo par de manos.** Todo lo de arriba está a nombre de una persona.
  Ver la sección siguiente.

---

## Gestor de contraseñas — la recomendación

**Bitwarden.** Concretamente: crear una *organización* (no un vault personal) y
meter ahí las seis credenciales del proyecto.

Por qué esta y no otra, para este proyecto en particular:

1. **El plan gratuito ya alcanza.** Bitwarden permite compartir con dos usuarios
   sin pagar, y la organización de equipo cuesta unos pocos dólares al mes si
   entra más gente. Para un proyecto de voluntariado sin ingresos, empezar a
   pagar una suscripción es una razón para no hacerlo nunca.
2. **Tiene acceso de emergencia.** Se designa a alguien de confianza que puede
   pedir acceso al vault; si no respondes en el plazo que definas, lo recibe.
   **Este es el punto que de verdad importa acá.** UnAcopio existe por un
   terremoto, lo mantiene una persona, y hoy esa persona es el único camino al
   dominio, al DNS, al correo, al despliegue y a la base. Si te enfermas o te
   quedas sin señal una semana, el proyecto no tiene forma de seguir.
3. **Es de código abierto y se puede autoalojar.** No es urgente, pero significa
   que no hay un proveedor que pueda dejar el proyecto sin sus llaves.

**La alternativa razonable es 1Password**, si prefieres mejor experiencia de uso
y te sirve `op run` para inyectar las variables de entorno sin que la
`service_role` llegue a tocar el disco. Cuesta desde el primer día y no tiene
acceso de emergencia con el mismo alcance, pero el manejo de secretos para
desarrollo es más fino. Cualquiera de las dos es muchísimo mejor que el estado
actual.

### Qué guardar, exactamente

Una entrada por cada una de estas, y ninguna en un archivo de texto:

- [ ] GitHub `DanielRagi` — contraseña + **códigos de respaldo de 2FA**
- [ ] Spaceship `DanielRamg` — contraseña + 2FA
- [ ] Buzón `hola@unacopio.co` — contraseña
- [ ] Supabase `service_role` del proyecto `pbymxaxlehymsrwconpv`
- [ ] Supabase `anon` / publishable
- [ ] Una nota segura con el enlace a este documento y las fechas de 2027

Los códigos de respaldo de 2FA de GitHub son el ítem que más se olvida y el que
más duele: sin ellos, perder el teléfono cierra la puerta de tres servicios a la
vez.

### Lo que no cambia por tener un gestor

`.env.local` sigue siendo el único lugar de donde el código lee las llaves en
desarrollo, y sigue estando fuera de Git. El gestor es la copia de respaldo y el
canal para pasárselas a alguien más — **nunca por chat, ni por correo, ni pegadas
en un issue.**

---

## Referencias

| | |
|---|---|
| Cómo montarlo paso a paso | [`PUESTA-EN-MARCHA.md`](PUESTA-EN-MARCHA.md) |
| Por qué está hecho así | [`DECISIONES.md`](DECISIONES.md) |
| Esquema, RLS y qué es público | [`MODELO-DATOS.md`](MODELO-DATOS.md) |
| Qué hace el producto | [`PLAN.md`](PLAN.md) |
