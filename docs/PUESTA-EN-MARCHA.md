# Puesta en marcha — lo que falta para que UnAcopio esté vivo

La V1 está construida y probada. Lo que queda son cosas que no puede hacer el
código: cuentas, un dominio, y personas llamando por teléfono.

Está ordenado por lo que bloquea a lo demás. Si hay que parar a la mitad, lo de
arriba ya sirve.

---

## 0. Correr `0009_permisos_moderacion.sql` — bloquea todo lo demás

```
supabase/migrations/0009_permisos_moderacion.sql
```

Sin esto **el panel de moderación no carga nada**, ni con la sesión bien puesta:
responde «permission denied for table puntos».

Qué pasó: la migración 0002 le revocaba a `authenticated` todos los permisos
sobre `puntos`, `punto_categoria` y `reportes`, y confiaba en que las policies de
RLS le devolvieran el acceso a moderación. En Postgres eso no funciona — **una
policy no otorga permiso, filtra filas dentro del permiso que ya se tenga**. Sin
el `grant`, la policy nunca llega a evaluarse.

Estuvo así desde el primer día sin que nadie lo notara, porque `npm run db:probar`
comprobaba que `anon` estuviera bloqueado —lo estaba— y hacía todo lo demás como
superusuario, que se salta permisos y RLS por igual. Ahora hay una prueba que se
pone en el rol `authenticated` con perfil de moderador, y `npm run db:verificar`
inicia una sesión de verdad y lee las tres tablas.

No afloja nada: `anon` sigue sin tocar las tablas base, y un autenticado sin fila
en `perfiles` sigue viendo cero filas.

Después de correrlo, `npm run db:verificar` tiene que terminar en verde.

---

## 1. Poner el sitio en línea

### 1.1 Vercel

1. Importar el repo `DanielRagi/unacopio` en [vercel.com](https://vercel.com).
2. Variables de entorno (Settings → Environment Variables), las mismas de
   `.env.local`, en Production y Preview:

   | Variable | De dónde sale |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | idem (la publicable, `sb_publishable_…`) |
   | `SUPABASE_SERVICE_ROLE_KEY` | idem (la secreta, `sb_secret_…`) |
   | `NEXT_PUBLIC_SITIO_URL` | `https://unacopio.co` |

   `NEXT_PUBLIC_SITIO_URL` no es cosmético: de ahí salen las URL canónicas, las
   tarjetas de Open Graph que se ven al compartir por WhatsApp, el `sitemap.xml`
   y el enlace de acceso de moderación. Sin él todo apunta al dominio por
   defecto de Vercel.

### 1.2 Dominio

`unacopio.co` → Vercel (Settings → Domains). Con `www` redirigiendo al apex.

### 1.3 Supabase Auth

Authentication → URL Configuration:

- **Site URL:** `https://unacopio.co`
- **Redirect URLs:** agregar `https://unacopio.co/auth/confirmar` y, si se usan
  previews, `https://*.vercel.app/auth/confirmar`.

Sin esto el enlace del correo de moderación rebota.

### 1.4 Correo: SMTP propio con Spacemail

El servidor de correo compartido de Supabase manda **dos mensajes por hora**. Con
eso, un equipo de cinco voluntarios no alcanza ni a entrar el primer día. Con
buzón propio el tope arranca en 30 por hora y se sube en el panel.

#### a) DNS del dominio

En Spaceship → Domains → `unacopio.co` → DNS. Spacemail suele ponerlos solo
cuando el dominio está en la misma cuenta; **hay que verificar que estén los
tres**, porque de ellos depende que el correo no caiga en spam:

| Tipo | Host | Valor |
|---|---|---|
| MX | `@` | los de Spacemail, con sus prioridades |
| TXT (SPF) | `@` | `v=spf1 include:spf.spacemail.com ~all` |
| TXT (DKIM) | `spacemail._domainkey` | el que genera el panel de Spacemail |
| TXT (DMARC) | `_dmarc` | `v=DMARC1; p=none; rua=mailto:hola@unacopio.co` |

DKIM es el que más pesa: sin él, Gmail manda el correo a spam o lo rechaza. El
valor exacto lo da el panel de Spacemail, no se puede inventar.

Empezar el DMARC en `p=none` es a propósito: solo reporta, no bloquea. Cuando
lleven unos días de correos llegando bien, se sube a `p=quarantine`.

> **Ojo con el dominio en Vercel.** Los registros MX y TXT del correo van en la
> zona DNS del dominio. Si se apunta `unacopio.co` a Vercel cambiando los
> *nameservers*, la zona pasa a Vercel y estos registros hay que volverlos a
> crear allá. Se evita apuntando el dominio con registros `A`/`CNAME` en
> Spaceship en vez de mover los nameservers.

#### b) SMTP en Supabase

Authentication → Emails → SMTP Settings → *Enable Custom SMTP*:

| Campo | Valor |
|---|---|
| Host | `mail.spacemail.com` |
| Port | `587` |
| Username | `hola@unacopio.co` |
| Password | la contraseña del buzón |
| Sender email | `hola@unacopio.co` |
| Sender name | `UnAcopio` |

Puerto **587** y no 465: 587 negocia TLS con STARTTLS, que es lo que espera
Supabase y lo que menos problemas da con redes que filtran puertos.

El remitente es `hola@` y no un `no-reply@` a propósito: si a un moderador no le
llega el enlace y responde el correo, la respuesta cae en un buzón que alguien
abre.

#### c) Subir el límite

Authentication → Rate Limits → *Rate limit for sending emails*. Arranca en 30 por
hora. Para un equipo de moderación sobra; subirlo a 100 deja margen sin exponer
el buzón a que alguien lo use de trampolín.

#### d) La plantilla en español

Authentication → Emails → **Magic Link**: pegar el contenido de
[`supabase/correos/enlace-magico.html`](../supabase/correos/enlace-magico.html) y
poner de asunto `Tu enlace para entrar a UnAcopio`.

La plantilla de Supabase viene en inglés y dice "Your Magic Link". Alguien que se
ofreció de voluntario ayer, y recibe un correo en inglés desde un dominio que no
reconoce, lo borra pensando que es phishing — y hace bien.

#### e) Probar antes de invitar a nadie

Pedir un enlace desde `unacopio.co/admin` con un correo que ya esté en
`auth.users`, y revisar:

- que llegue en menos de un minuto,
- que **no** caiga en spam (probar con una cuenta de Gmail y otra de Outlook),
- que el enlace abra `/admin` con la sesión puesta.

Si cae en spam, casi siempre es DKIM sin propagar. Da unas horas y se revisa en
[mail-tester.com](https://www.mail-tester.com).

#### f) Cuando el enlace no sirve

Hay tres formas de entrar, y conviene conocerlas antes de necesitarlas a las once
de la noche.

**El enlace del correo.** Lo cómodo. Falla por cosas que no controlamos:

| Síntoma | Qué pasó | Salida |
|---|---|---|
| «El enlace ya se usó o se venció», recién llegado | El antivirus del correo —o el Safe Links de Outlook— **abrió el enlace** para revisarlo. Como es de un solo uso, quedó gastado antes de que lo tocaras | El código de seis dígitos |
| «Ese enlace solo sirve en el mismo navegador» | Lo pediste en un navegador y lo abriste en otro. El verificador PKCE quedó en el primero | El código de seis dígitos |
| «El enlace venía incompleto» | Casi siempre `emailRedirectTo` apuntando a un sitio distinto del que pidió el enlace | Revisar Site URL y Redirect URLs |

**El código de seis dígitos.** Llega en el mismo correo. Se escribe a mano en la
pantalla de acceso, así que ningún escáner lo puede gastar y no depende del
navegador. Es el camino aburrido y es el que siempre funciona.

**El enlace generado desde la terminal.** La salida de emergencia, para cuando el
correo no coopera de plano:

```bash
npm run acceso -- tu@correo.com                              # local
npm run acceso -- tu@correo.com --url https://unacopio.co    # producción
```

Imprime un enlace listo para pegar en el navegador. No manda correo, no necesita
SMTP y sirve en cualquier navegador, incluso de incógnito. Usa la llave de
servicio, así que solo corre desde una terminal con `.env.local`.

No es una puerta trasera: genera el mismo token de un solo uso que mandaría
Supabase, solo que en pantalla. El correo tiene que existir ya en `auth.users`, y
entrar al panel sigue exigiendo la fila en `perfiles`. Si falta, el script avisa.

> **Spacemail es un buzón, no un proveedor transaccional.** Para los enlaces de
> acceso de cinco o diez moderadores es exactamente la herramienta correcta. Si
> algún día se quiere el recordatorio automático de 48 horas a *todos* los
> responsables de punto (ver D10 y D15), eso ya es envío masivo y necesita
> Resend, Postmark o SES. Mandarlo desde el buzón termina en throttling, en spam
> y con el dominio quemado.

### 1.5 Rotar la llave de servicio

La `service_role` estuvo un rato en un archivo que iba a quedar versionado.
**Nunca llegó a GitHub** —lo frenó el push protection y el commit se rehízo—,
pero rotarla cuesta un minuto y quita la duda: Supabase → Project Settings →
API → Rotate. Después actualizarla en `.env.local` y en Vercel.

---

## 2. El equipo de moderación

Sin gente que llame, el directorio no publica nada. Es el cuello de botella real
de todo el proyecto (ver D10).

> **Hacer el 1.4 primero.** La invitación es un correo. Sin SMTP propio salen dos
> por hora, así que invitar a cinco personas de una toma tres horas y las
> primeras invitaciones se vencen esperando.

1. Invitar cada moderador en Supabase → Authentication → Users → Invite.
2. Darle permiso, que es una fila en `perfiles`:

   ```sql
   insert into perfiles (id, nombre, rol)
   select id, 'Nombre de la persona', 'moderador'
   from auth.users where email = 'correo@ejemplo.com';
   ```

   `admin` en vez de `moderador` solo para quien administre el equipo.
3. Entran por `unacopio.co/admin` con su correo. No hay contraseñas.

**Cuánta gente hace falta:** cada punto se llama cada 48 horas, así que con N
puntos son N/2 llamadas al día. Con los 21 sembrados son ~11 llamadas diarias:
una persona. Si el directorio llega a 200 puntos son 100 llamadas al día y hace
falta o más gente o un proveedor de correo para volver al recordatorio
automático.

---

## 3. Los 21 puntos que ya están en la cola

Ya cargados en `/admin`, en estado **pendiente**. No se ven en el sitio y no se
verán hasta que alguien llame y los publique.

Salieron de fuentes oficiales y de prensa sobre el terremoto del 10 de agosto.
Detalle y procedencia de cada dato en [`datos/pilotaje/LEEME.md`](../datos/pilotaje/LEEME.md).

### Lo que hay que resolver, en orden

**a) Conseguir 16 teléfonos.** Es lo más urgente de todo: sin teléfono el punto
no se puede verificar y se queda en pendiente para siempre. Tienen número las
tres bibliotecas de Medellín con directorio público, la Terminal del Norte,
EAFIT y el CAM.

**b) Dos conflictos entre fuentes**, marcados en las notas de cada punto:

| Punto | Conflicto |
|---|---|
| Palacio de los Deportes | Calle 63 **# 59A-06** (Alcaldía, Infobae, El Tiempo) vs. **# 54A-06** (otra nota de bogota.gov.co) |
| Centro Comercial Unicentro | 8:00 a.m.–9:00 p.m. vs. 9:00 a.m.–5:00 p.m., ambos de bogota.gov.co |

**c) Ocho puntos sin pin real.** Nominatim no pudo ubicar la dirección, así que
quedaron en el centro de la ciudad, marcado en las notas. Se mueven en
`/admin/punto/[id]`: el formulario de edición tiene mapa, se arrastra hasta que
el pin quede sobre la entrada y se guarda.

> **Estos ocho van a aparecer como "posible duplicado" unos de otros, a 0 m.**
> No es un error del detector: comparten coordenada porque comparten el pin de
> respaldo. Se arregla solo apenas se les ponga el pin correcto. Son las cinco
> sedes de Cruz Roja en Bogotá y, en Medellín, las dos fundaciones y el hall de
> la Alcaldía.

**d) Ocho direcciones de Medellín vienen del directorio de la sede**, no del
anuncio del acopio: la Alcaldía publicó los diez puntos por nombre y sin
dirección. Que la biblioteca exista ahí es un hecho; que ese día recibiera
donaciones ahí es lo que hay que confirmar en la llamada.

**e) Nada está marcado como urgente.** Las fuentes publican "qué se recibe", no
"qué falta más". Preguntarlo en la llamada es lo que llena el bloque de "lo que
más falta acá", que es de lo primero que mira quien va a donar.

### En la llamada, además de confirmar

- **Pedir autorización para publicar el teléfono.** Es lo que exige la Ley 1581
  de 2012, y sin ese permiso el número no sale en la ficha. Es una casilla en
  el formulario de edición.
- **Preguntar qué necesitan hoy**, no qué reciben en general.
- **Preguntar el horario real** y meterlo en el selector de días y horas. Solo
  con el horario estructurado aparece el sello de "Abierto ahora"; mientras no
  esté, la ficha calla, que es lo correcto.
- **Marcar "entidad oficial"** solo a alcaldías, gobernaciones, bomberos,
  Defensa Civil y Cruz Roja, y solo después de confirmarlo por teléfono (D4).

### Volver a cargar o deshacer

```bash
npm run pilotaje              # regenera el CSV desde los .json curados
npm run sembrar               # carga lo que falte (no duplica)
npm run sembrar -- --limpiar  # borra los importados que sigan pendientes
```

`--limpiar` no toca lo que moderación ya publicó, rechazó o cerró.

---

## 4. Conseguir que la lista sea *la* lista

El sitio puede estar perfecto y quedar vacío. Esto es lo que decide si sirve.

### 4.1 Pedir las listas (fase 5.1 del plan)

Escribirle a **DAGRD** (Medellín), **IDIGER** (Bogotá), **Cruz Roja seccional**
y a las oficinas de prensa de ambas alcaldías. Adjuntar la plantilla
(`unacopio.co/admin/importar/plantilla.csv`) y el enlace a `unacopio.co/datos`.

Una lista entregada llega limpia, con teléfonos que contestan, y deja un aliado.
Raspar la web es el complemento, no el plan.

### 4.2 Dos pistas que quedaron sin perseguir

- **Universidad Pedagógica Nacional e Instituto Pedagógico Nacional.** Anunciaron
  que habilitaron sus sedes, pero no se pudo leer la dirección en su sitio (el
  certificado del servidor no valida). Se sabe que una queda por la Calle 72.
- **El mapa de Mapas Bogotá** (capa 127089). La propia Alcaldía dice que ahí
  está la lista completa, no en el texto de la nota. Probablemente hay más
  puntos de los 11 que se pudieron sacar leyendo.

### 4.3 Difusión

- Una imagen para estados de WhatsApp e Instagram, con el dominio grande.
- Las páginas por municipio (`unacopio.co/acopio/medellin`) son las que se
  comparten: dicen el nombre de la ciudad en la tarjeta de WhatsApp.
- A medios y alcaldías, mandarles `unacopio.co/datos` en vez de una captura de
  pantalla. Si reutilizan los datos hay una sola lista que mantener, no cinco
  que se contradicen.

---

## 5. Lo que quedó decidido y conviene no olvidar

| | |
|---|---|
| **La plataforma nunca escribe por WhatsApp** (D8) | Los botones de WhatsApp abren el chat del usuario. No hay número propio ni mensajes automáticos. |
| **Nadie edita el directorio** (D9) | Corregir o cerrar es mandar una solicitud que aplica moderación. Sin tokens ni contraseñas. El costo: corregir no es instantáneo, depende de que alguien lea la bandeja. |
| **La verificación es una llamada** (D10) | No escala sola. Pasadas un par de centenas de puntos hay que conseguir proveedor de correo. |
| **Un dato copiado de internet es una pista** (D13) | Todo lo importado entra pendiente. Los teléfonos copiados no se publican. |
| **Sin dinero, nunca** (D6) | No se publican cuentas bancarias, Nequi ni Daviplata. Es el vector de estafa más obvio y no hay cómo verificarlo. |

---

## 6. Lo que no tiene la V1, a sabiendas

Nada de esto bloquea el arranque. Está acá para que no se descubra a las 2 a.m.

- **El municipio de un punto no se puede cambiar.** El pin sí se mueve, pero
  dentro del mismo municipio. Si un punto quedó en el municipio equivocado, se
  rechaza y se vuelve a registrar. Pasa poco y arreglarlo bien implica rehacer
  las categorías y el historial.
- **No hay foto del punto.** Ayudaría a reconocerlo, pero abre moderación de
  imágenes, que es otro problema.
- **No hay historial de cambios.** Se sabe quién verificó por última vez, no qué
  cambió.
- **La búsqueda es por cercanía y municipio, no por texto.** No se puede buscar
  "Unicentro".
- **Sin analítica.** No se sabe cuánta gente entra ni qué busca.
