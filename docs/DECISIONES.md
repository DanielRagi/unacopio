# Decisiones

Fecha de corte: 2026-08-14. Criterio rector: **salir hoy**. Cada decisión se toma
por "cuánto tarda en estar en producción", no por elegancia.

---

## D1. Stack: Next.js + Supabase + Vercel

**Por qué:**

- Un solo repo, un solo lenguaje (TypeScript). No hay backend aparte que desplegar.
- Server Components → la lista y el detalle de puntos se renderizan en el servidor.
  Página utilizable en 3G y en celulares gama baja, que es el escenario real en
  una emergencia.
- Supabase da en 10 minutos: Postgres administrado, PostGIS para "el más cercano",
  auth por magic link para el equipo de moderación, y un panel para editar datos a
  mano cuando algo se rompa a las 2am.
- Vercel: `git push` → producción. Preview por PR. Dominio + HTTPS gratis.
- Costo $0 en tier gratuito hasta un tráfico que ya sería un buen problema.

**Descartadas:**

- *Un Google Form + Google Sheet*: es lo más rápido de todo (30 min) y es el
  **fallback si algo se atraviesa hoy**. Se descarta como producto porque no
  permite buscar por cercanía, no se puede moderar bien, y la hoja pública se
  vuelve inmanejable pasados ~200 registros.
- *Firebase*: sin SQL geoespacial decente; las consultas por radio quedan cojas.
- *Rails/Django + servidor propio*: más tiempo de montaje y despliegue del que
  tenemos.
- *App móvil nativa*: descartado de plano. Nadie instala una app para donar una vez.
  Web móvil, compartible por WhatsApp con un link.

## D2. Mapa: Leaflet + OpenStreetMap, no Google Maps

Sin API key, sin tarjeta de crédito, sin cuota que se agote justo cuando el sitio
se vuelva viral. Los tiles de OSM son suficientes para "¿cuál me queda cerca?".

Consecuencia aceptada: la búsqueda de direcciones (geocoding) queda limitada.
Se resuelve pidiéndole a quien registra que **ponga el pin en el mapa**, que además
da coordenadas más confiables que geocodificar una dirección colombiana mal escrita.

Los links "Cómo llegar" sí abren Google Maps / Waze con las coordenadas — ahí no
hay costo y es lo que la gente ya sabe usar.

## D3. Nadie inicia sesión para registrar un punto

Pedir cuenta antes de registrar mata la mitad de los registros. Entonces:

- Formulario público → el punto entra en estado `pendiente`.
- Moderación aprueba → pasa a `publicado`.
- Quien registró recibe un **link secreto de edición** (token) para actualizar
  horarios, marcar "ya no recibimos ropa" o cerrar el punto. Sin contraseñas.
  El link se muestra en pantalla apenas termina el registro y se manda por
  **correo**, nunca por WhatsApp (ver D8).

Solo el equipo de moderación tiene cuenta (Supabase Auth, magic link).

## D4. Confianza: mostrarla, no fingirla

No podemos verificar de verdad en 24 horas. Entonces mostramos **señales**, no sellos:

- Fecha de última verificación, visible y en lenguaje humano ("verificado hace 2 días").
  Un punto sin verificar hace más de 72h se marca en amarillo.
- Tipo de organización (alcaldía / bomberos / iglesia / JAC / ONG / empresa / particular).
- Nombre del responsable + teléfono público, con **consentimiento explícito** en el
  formulario (Ley 1581 de 2012 — Habeas Data). Sin ese check, no se publica el teléfono.
- Botón "Reportar" en cada punto: cerrado, información incorrecta, duplicado, spam.
  A los N reportes el punto se despublica solo y entra a la cola de revisión.
- Banda de "Entidad oficial" únicamente para alcaldías, gobernaciones, UNGRD, Cruz Roja,
  Defensa Civil y bomberos, y solo cuando moderación lo confirme por teléfono.

## D5. Decir qué **NO** se recibe es tan importante como decir qué sí

En toda emergencia en Colombia se repite lo mismo: llega ropa usada por toneladas y
falta agua, y los puntos terminan gastando gente en clasificar basura. Por eso la
taxonomía tiene tres estados por categoría — `alta` (prioridad), `si` (recibe) y
`no_recibe` — y la ficha del punto muestra el "NO recibimos" en rojo, arriba,
antes de que la persona salga de su casa.

## D6. Sin dinero, nunca

La plataforma no procesa pagos ni publica cuentas bancarias, Nequi ni Daviplata en
la v1. Es el vector de estafa más obvio y no tenemos cómo verificarlo. Aviso
explícito en el pie de cada ficha.

## D7. Español plano, sin i18n todavía

Todos los textos van en español directamente en el código. Se evita la capa de
traducción en v1, pero se centralizan las cadenas de UI en `lib/textos.ts` para
que meter i18n después no obligue a tocar 40 componentes.

## D8. La plataforma nunca escribe por WhatsApp

UnAcopio **no manda nada por WhatsApp**: ni códigos de verificación, ni enlaces
de acceso, ni recordatorios, ni avisos de moderación. Cero mensajes salientes.

El motivo es de plazos: mandar mensajes desde un número propio exige verificación
de negocio y aprobación de plantillas, que tardan más de lo que dura la ventana
en la que este sitio sirve para algo. Y un número no verificado escribiéndole a
gente que acaba de publicar su teléfono es exactamente lo que hace un estafador.

Entonces, canales salientes: **solo correo** (Supabase Auth para el equipo de
moderación, y el enlace de edición para quien registró un punto).

Lo que sí sigue siendo por WhatsApp, porque no lo manda la plataforma sino las
personas:

- El botón "WhatsApp" en la ficha de un punto, que abre el chat entre quien dona
  y quien recibe, con el teléfono que el punto autorizó publicar.
- El botón "Compartir por WhatsApp", que arma un mensaje para que la persona lo
  reenvíe desde su propia cuenta.

Ambos son enlaces `wa.me` que abren la app del usuario. No hay API, ni número de
la plataforma, ni mensajes automáticos.

**Consecuencia:** el correo pasa a ser el único camino de vuelta hacia el
responsable de un punto, así que el formulario lo pide obligatorio. Sin él no hay
cómo mandarle el enlace de edición ni el recordatorio de 48h de la fase 3, que es
lo que mantiene el directorio vivo.
