# Plan — UnAcopio

Proyecto de emergencia. El plan está ordenado por **valor por hora**, no por
completitud. Si a la mitad hay que parar, lo que quedó arriba ya sirve solo.

Regla de oro: **el sitio debe estar en línea y recibiendo registros hoy**, aunque
sea feo. Un directorio feo con 40 puntos reales vence a un mapa bonito vacío.

---

## Fase 0 — Montaje ✅

Hecho, salvo lo que depende de cuentas que solo puede crear el equipo.

- [x] Next.js 16 + TypeScript + Tailwind v4, con `src/` y alias `@/*`
- [x] Dependencias: `@supabase/supabase-js`, `@supabase/ssr`, `zod`, `leaflet`, `react-leaflet`
- [x] Esquema completo en `supabase/migrations/` (PostGIS, enums, índices, triggers)
- [x] Vista pública, RLS y las tres RPC (`registrar_punto`, `puntos_cercanos`, `reportar_punto`)
- [x] Semillas: 48 categorías de donación y 1.122 municipios DANE con centroide
- [x] Clientes de Supabase (navegador / servidor / servicio), tipos y textos centralizados
- [x] Portada provisional que sirve de diagnóstico del montaje
- [x] Banco de pruebas del SQL en Docker: `npm run db:probar`
- [ ] Proyecto en Supabase + correr las migraciones (necesita cuenta)
- [ ] Repo en GitHub + conexión a Vercel (necesita cuenta)
- [ ] Dominio `unacopio.co` apuntando a Vercel
- [ ] Variables de entorno en Vercel

**Sale de aquí:** el sitio desplegado en el dominio real, con la base lista para
recibir el primer registro.

## Fase 1 — MVP publicable 🎯 objetivo del día 1

- [x] `/registrar` — formulario público de registro de punto
  - Datos del punto, mapa con pin fijo al centro (se mueve el mapa, no el pin),
    selector de categorías en cuatro estados (**urgente / sí / no llevar / —**)
  - Validación con Zod en el servidor, Server Action, honeypot anti-spam
  - Check de Habeas Data para publicar el teléfono
  - Sin JavaScript el formulario igual sirve: el punto cae en el centroide del
    municipio y moderación lo afina
  - Al enviar: pantalla de "queda pendiente" + código secreto de edición
- [x] `/` — lista de puntos publicados
  - Filtro por departamento y municipio en un form GET, sin JS, en la URL
  - Tarjeta: nombre, tipo de organización, dirección, horario, qué necesitan con
    urgencia, qué NO reciben, "verificado hace X"
- [x] `/punto/[id]` — ficha completa, con "Llamar", "WhatsApp", "Cómo llegar"
      (Google Maps / Waze) y "Compartir por WhatsApp"
- [x] `/admin` — cola de moderación (Supabase Auth por correo)
  - Publicar / rechazar / cerrar / marcar lleno / marcar «oficial» / editar
  - Publicar firma quién verificó y cuándo, y resuelve los reportes abiertos
  - Muestra correo y teléfono no publicable: es con eso que se llama a confirmar
- [x] RLS activo en todas las tablas
- [x] Aviso legal fijo: no recolectamos dinero, la información la aportan terceros
- [x] Metadatos Open Graph, también por punto
- [x] `/punto/[id]/solicitud` — pedir un cambio o el cierre, con observaciones.
      Reemplaza al enlace de edición con token (ver D9)
- [x] Bandeja de solicitudes y reportes en moderación

**Sale de aquí:** el sitio ya sirve. Se puede empezar a difundir.

## Fase 2 — Encontrar el más cercano 🎯 día 2

- [x] Botón "Ver los más cercanos a mí" (`navigator.geolocation`) → RPC
      `buscar_puntos`, lista ordenada por distancia con "a 1,2 km".
      Las coordenadas van en la URL: ordena el servidor, y la búsqueda se puede
      compartir tal cual por WhatsApp
- [x] Fallback sin GPS: el filtro por municipio, y el mapa se centra en el
      centroide DANE de ese municipio
- [x] `/mapa` — marcadores agrupados en clusters, popup por punto, encuadre
      automático sobre los resultados y marca aparte de "estás aquí"
- [x] Filtro por categoría ("quiero donar agua" → solo puntos que reciben agua;
      un `no_recibe` es justamente la razón para no mostrarlo)
- [x] Botón "Reportar" en cada ficha, con despublicación automática a los 3
      reportes de terceros — resuelto en la fase 1 con el formulario de solicitud

## Fase 3 — Que la información no se pudra (≈ 1 día)

Este es el problema real de estos directorios: a la semana la mitad de los puntos
ya cerró y nadie lo actualizó. El sitio pierde credibilidad y la gente vuelve a
los audios de WhatsApp.

- [x] Semáforo de frescura: verde <24h, amarillo <72h, gris >72h ("puede estar desactualizado")
- [x] Ronda de llamadas en vez del recordatorio automático (ver D10): sin
      proveedor de correo y sin WhatsApp saliente, la verificación la hace un
      moderador llamando
- [x] Cola "Por llamar": lo que lleva más de 48h sin confirmarse, de lo más viejo
      a lo más nuevo, con reserva de 30 minutos para que dos voluntarios no
      marquen el mismo número
- [x] Detección de duplicados: puntos a menos de 200 m en el mismo municipio,
      avisados en la cola de revisión antes de publicar
- [x] Estado `lleno` visible: "hoy no reciben más", marcado y de último (ver D11)
- [x] Horarios estructurados + badge "Abierto ahora", calculado en hora de
      Colombia y con pruebas propias (ver D12)
- [x] `/admin/punto/[id]` — edición completa desde moderación. Es la contraparte
      de D9: si el público no edita, alguien tiene que poder aplicar lo que sale
      de las llamadas y de la bandeja

## Fase 4 — Alcance y aliados ✅

- [x] `GET /api/puntos.json` y `.csv` públicos, sin llave, con CORS abierto y
      licencia CC BY 4.0, para que medios y alcaldías reutilicen los datos en vez
      de armar su propia lista. El CSV lleva BOM y CRLF: se va a abrir en Excel
- [x] `/datos` — la página que explica la API en español. Sin ella la API no la
      usa nadie fuera de un equipo técnico, que no es a quien hay que convencer
- [x] Importación masiva desde CSV (`/admin/importar`), en dos pasos: revisar
      fila por fila y confirmar. Detecta el separador, resuelve municipios por
      código DANE o por nombre y cae al centroide cuando no hay coordenadas
- [x] Vista por municipio para compartir: `/acopio/medellin`, más el índice
      `/acopio` de los municipios que ya tienen puntos
- [x] "Lo que más falta acá": necesidades agregadas por municipio, cada una
      enlazando al listado ya filtrado
- [x] PWA + caché offline: las páginas van a la red primero y solo caen a la
      copia guardada sin señal; `/offline` dice qué sí se puede hacer sin datos
- [x] `sitemap.xml` con los municipios (las fichas no: se cierran a diario) y
      `robots.txt`
- [x] Accesibilidad: enlace de "saltar al contenido", foco visible en todo,
      `prefers-reduced-motion`

## Fase 5 — Pilotaje con datos reales: Medellín y Bogotá

El sitio ya sirve, pero está vacío, y un directorio vacío no lo comparte nadie.
Esta fase es la siembra —y, de paso, la primera medición honesta de cuánto
cuesta mantenerlo—. Ver **D13** (un dato copiado es una pista, no un hecho) y
**D14** (la recolección produce un CSV, no filas en la base).

Se eligen Medellín y Bogotá porque son donde más información circula y donde el
error se nota rápido: si el directorio queda mal ahí, se sabe en horas.

### 5.1 — Primero preguntar, que sale más barato que raspar

Antes de escribir una línea de código: escribirle al DAGRD de Medellín, al
IDIGER en Bogotá, a la Cruz Roja seccional y a las oficinas de prensa de ambas
alcaldías pidiendo su lista, con la plantilla de `/admin/importar` adjunta y el
enlace a `/datos`. Una lista entregada llega limpia, con teléfonos que contestan,
y de paso deja un aliado. Raspar es el plan B y el complemento, no el plan A.

- [ ] Correo a las cuatro entidades, con plantilla CSV y enlace a `/datos`
- [ ] Cargar por `/admin/importar` lo que llegue

### 5.2 — Recolección desde fuentes públicas

- [ ] `docs/fuentes.json` — lista **curada a mano** de URLs por ciudad: páginas
      de alcaldía y gestión del riesgo, Cruz Roja, Defensa Civil, bomberos y
      notas de prensa. Descubrir fuentes automáticamente es una fantasía; lo que
      sí escala es releer las mismas veinte páginas cada día
- [ ] `npm run recolectar` (`scripts/recolectar.mjs`) — baja cada fuente,
      respeta `robots.txt`, un pedido por segundo, User-Agent propio que diga qué
      es esto y a dónde escribir
- [ ] Extracción: direcciones colombianas (`Calle|Carrera|Cra|Kr|Av … # …-…`),
      celulares (`3XX XXX XXXX`), horarios y el bloque de texto alrededor. Lo que
      no encaje se deja en `notas` en crudo, sin inventar: una dirección mal
      adivinada manda a alguien a otra parte de la ciudad
- [ ] Geocodificación con Nominatim de OSM: un pedido por segundo, User-Agent
      identificado, caché en disco para no volver a pedir lo mismo. Lo que no
      resuelva cae al centroide del municipio
- [ ] Salida: un CSV en el formato exacto de `/admin/importar`, con
      `fuente_nombre` y `fuente_url` en cada fila, más un informe de qué se
      descartó y por qué
- [ ] `npm run probar:recoleccion` — pruebas de la extracción contra HTML
      guardado en el repo, no contra la red: si un sitio cambia, las pruebas
      tienen que seguir corriendo

### 5.3 — Revisión y llamadas

- [ ] Cargar el CSV y revisar duplicados (la cola ya avisa "hay otro a menos de
      200 m")
- [ ] Ronda de llamadas sobre los importados. En la llamada, además de confirmar,
      se pide autorización para publicar el teléfono (Ley 1581) y se pregunta qué
      necesitan hoy — que es el dato que ninguna página web tiene al día
- [ ] Publicar solo lo confirmado

### 5.4 — Lo que hay que medir

El pilotaje vale tanto por los puntos que siembra como por lo que enseña:

| Número | Para qué sirve |
|---|---|
| Filas recolectadas vs. filas que sobrevivieron la revisión | Dice si el raspado aporta o solo hace ruido |
| Llamadas hechas vs. llamadas contestadas | Si contesta menos de la mitad, la ronda de D10 no se sostiene |
| Minutos por punto (revisar + llamar + publicar) | Cuántos voluntarios hace falta por cada 50 puntos |
| Puntos que ya habían cerrado al llamar | Mide qué tan rápido se pudre una lista publicada |

**Sale de aquí:** Medellín y Bogotá con puntos reales y confirmados, y un número
concreto para decidir si la verificación por llamada aguanta el crecimiento o si
hay que conseguir ya el proveedor de correo (ver D10).

---

## Lo que NO se hace (v1)

Cada uno de estos suena razonable y hunde el cronograma:

- Cuentas de usuario para donantes
- Chat, mensajería o comentarios
- Pagos, cuentas bancarias, Nequi o Daviplata (ver D6)
- Registro de personas damnificadas o de necesidades individuales — es otro
  producto, con implicaciones serias de datos sensibles
- Inventario en tiempo real de cada punto
- App nativa
- Multi-idioma

## Riesgos y cómo se mitigan

| Riesgo | Mitigación |
|---|---|
| Spam / puntos falsos | Moderación previa obligatoria, honeypot, rate limit por IP, botón de reporte |
| Información desactualizada | Fase 3 completa: semáforo + ronda de llamadas cada 48h (D10) |
| Datos raspados de internet que resultan viejos o falsos | Todo entra `pendiente` y se publica solo tras la llamada (D13); la fuente queda guardada para poder auditar |
| Teléfonos copiados de una publicación | No se publican nunca desde importación: la autorización de Habeas Data se pide en la llamada (D13) |
| Estafas con datos bancarios | Prohibido publicar cuentas; aviso visible; se rechaza el registro |
| Datos personales expuestos | Consentimiento explícito (Ley 1581/2012), teléfono opt-in, correo nunca público |
| Pico de tráfico por un trino o una nota de prensa | SSR + caché de la lista; Vercel escala solo |
| Nadie registra puntos | El cuello de botella real no es técnico. Ver "Difusión" |

## Difusión (esto decide si el proyecto sirve o no)

El sitio puede estar perfecto y quedar vacío. Hay que sembrarlo con datos el mismo día:

1. Cargar a mano, desde moderación, los puntos que ya circulan en las listas de
   WhatsApp y en las cuentas de las alcaldías. Arrancar con 30–50 puntos reales.
2. Escribirle a las oficinas de gestión del riesgo municipales, Defensa Civil,
   Cruz Roja y a las emisoras locales — que la lista sea *la* lista.
3. Una imagen para estados de WhatsApp e Instagram con el dominio grande y legible.

## Siguiente paso inmediato

Fase 5.1: escribirle al DAGRD, al IDIGER, a la Cruz Roja y a las oficinas de
prensa de Medellín y Bogotá pidiendo sus listas. Es lo único de todo el plan que
no depende de escribir código y sí decide si el directorio arranca lleno o vacío.
