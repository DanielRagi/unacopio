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
- Para corregir o cerrar un punto, quien lo organiza manda una **solicitud** desde
  la ficha y moderación la aplica. Sin cuenta, sin contraseña y sin código que
  guardar (ver D9).

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

Entonces queda un solo canal saliente, y es angosto: el correo de Supabase Auth
con el enlace de acceso al panel de moderación. Nada más. Al público no le
escribimos nunca; a los responsables de los puntos se les **llama** (ver D10).

Lo que sí sigue siendo por WhatsApp, porque no lo manda la plataforma sino las
personas:

- El botón "WhatsApp" en la ficha de un punto, que abre el chat entre quien dona
  y quien recibe, con el teléfono que el punto autorizó publicar.
- El botón "Compartir por WhatsApp", que arma un mensaje para que la persona lo
  reenvíe desde su propia cuenta.

Ambos son enlaces `wa.me` que abren la app del usuario. No hay API, ni número de
la plataforma, ni mensajes automáticos.

**Consecuencia:** el único canal de vuelta hacia el responsable de un punto queda
siendo el teléfono, que moderación ya usa para confirmar antes de publicar. El
correo se pide opcional, para escribirle cuando el teléfono no contesta.

## D9. Sin tokens: editar y cerrar también pasan por moderación

En la v1 **nadie edita el directorio directamente**. Quien organiza un punto y
necesita corregir el horario, cambiar lo que están recibiendo o cerrarlo, manda
una **solicitud** desde la ficha, con un campo de observaciones donde cuenta qué
cambió. Moderación lo lee y lo aplica.

Se había diseñado con un token: un enlace secreto de edición, sin contraseña.
Se descartó por una razón muy concreta: ese enlace hay que **hacerlo llegar**, y
por D8 el único canal sería el correo, para el que no hay proveedor de envío
disponible en esta ventana de tiempo. Un secreto que no se puede entregar no
sirve, y guardarlo igual solo agrega algo más que proteger.

Lo que se gana, además de quitar una dependencia:

- No hay código que perder, ni enlace que se filtre en un grupo de WhatsApp y
  termine dejando que un tercero edite un punto ajeno.
- Un par de ojos revisa cada cambio antes de que salga publicado, que es lo mismo
  que ya se hace al registrar.
- Una sola bandeja para todo lo que la gente nos dice de un punto, venga de quien
  lo organiza o de alguien que fue y encontró otra cosa.

Lo que se pierde, y hay que tener presente: **corregir un punto ya no es
instantáneo**, depende de que alguien de moderación lea la bandeja. Si el equipo
se queda corto, las fichas se desactualizan, que es justo la forma en que estos
directorios se mueren. Mientras eso pese más que la dependencia del correo, vale
la pena volver a los tokens.

Las solicitudes reutilizan la tabla `reportes`, que ya tenía los tipos que hacen
falta. La única distinción nueva es `es_responsable`: quien dice organizar el
punto está colaborando, no denunciando, así que su solicitud no cuenta para el
umbral de tres reportes que despublica un punto solo. Si no, alguien tumbaría su
propio punto al pedir que le corrijan el horario. Ojo: **`es_responsable` no está
verificado**; es una pista para priorizar, no una credencial.

## D10. La verificación periódica la hace una persona llamando

El plan original tenía un recordatorio automático cada 48 horas al responsable de
cada punto: "¿siguen recibiendo? Sí / Cambió / Ya cerramos", de un clic. Con D8
(nada por WhatsApp) y sin proveedor de correo, ese mensaje no tiene por dónde
salir. Entonces la ronda la hace **un moderador llamando por teléfono**.

No es solo el reemplazo barato. Llamar tiene algo que el mensaje automático no:
quien contesta suele decir más de lo que se le preguntó —"ya no necesitamos
ropa pero nos hace falta agua", "estamos llenos hasta el jueves"—, y eso es
justo lo que mantiene la ficha útil. Y confirma que del otro lado hay alguien
real, que es la mitad de lo que sostiene la confianza en el directorio.

Lo que cuesta, y hay que decirlo claro: **esto no escala solo**. Un mensaje
automático sirve igual con 40 puntos que con 400; una ronda de llamadas necesita
más gente a medida que crece el directorio. La regla práctica es que cada punto
se llama cada 48 horas, así que con N puntos son N/2 llamadas al día. Pasadas un
par de centenas hay que conseguir un proveedor de correo y volver al recordatorio
automático, dejando la llamada para lo que no conteste.

Lo que la app pone para que la ronda funcione con varios voluntarios a la vez:

- Una cola **Por llamar**: lo que lleva más de 48 horas sin confirmarse, de lo
  más viejo a lo más nuevo, y lo que nunca se verificó antes que todo.
- Cuatro respuestas de un toque: siguen recibiendo · están llenos · ya cerraron ·
  no contestan.
- `ultimo_intento_llamada` se escribe **siempre**, incluso cuando no contestan,
  y el punto sale de la cola por media hora. Sin eso, dos voluntarios marcan el
  mismo número con cinco minutos de diferencia, que es exactamente lo que pasa
  cuando la gente trabaja en paralelo sin coordinarse.
- `intentos_fallidos` cuenta las llamadas seguidas sin respuesta. Varias
  seguidas vuelven sospechoso a un punto aunque nadie lo haya reportado.

## D11. Un punto lleno se muestra, no se esconde

`lleno` significa "hoy no pueden recibir más". Antes esos puntos desaparecían del
directorio, y salía peor: quien se enteró por la radio o por un audio de WhatsApp
iba de todas formas, y no teníamos dónde decirle que no fuera.

Ahora aparecen, marcados con "Hoy no reciben más" y de últimos en el orden. La
ficha además sugiere llamar antes de ir o buscar otro punto cerca. Un viaje que
no se hace vale más que un renglón menos en la lista.

## D12. El horario se guarda estructurado, y el texto se genera

`puntos.horarios` guarda franjas —día, hora de apertura, hora de cierre— y de ahí
sale todo: el badge "Abierto ahora" y también el `horario_texto` que lee la
persona, generado en el servidor.

Se generó en vez de pedirlo aparte porque dos campos que dicen lo mismo terminan
diciendo cosas distintas. Un punto donde el texto dice "hasta las 6" y el badge
dice "cerrado" es peor que uno sin horario: destruye la confianza en todo lo
demás que muestra la ficha.

Detalles que importan:

- Todo se calcula en **hora de Colombia**, no en la del servidor. El sitio corre
  en Vercel con el reloj en UTC. Se resuelve con `Intl` y no restando 5 horas a
  mano: Colombia no cambia de hora, pero eso no tiene por qué seguir siendo
  cierto para siempre.
- Sin franjas, **no se muestra badge**. Los puntos viejos y los que cargó
  moderación a mano no tienen horario estructurado, y ahí es mejor callar que
  afirmar algo que no sabemos.
- El badge dice también **cuándo abre**, no solo que está cerrado. Quien mira a
  las siete de la noche quiere saber si le sirve ir mañana temprano.
- Las fechas de campaña mandan sobre el horario: si ya pasó `fecha_fin`, está
  cerrado aunque el día y la hora cuadren.

El cálculo está en `src/lib/horarios.ts` y tiene pruebas propias
(`npm run probar:horarios`), incluidas las de zona horaria y jornada partida. Es
el tipo de código que se equivoca en silencio, así que conviene que falle ruidoso
en la consola antes que callado en producción.


## D13. Un dato copiado de internet es una pista, no un hecho

Todo lo que entra por `importar_punto` —el CSV de una alcaldía, la lista de un
periódico, lo que recoja la fase 5— queda en `pendiente`, exactamente igual que
un registro del formulario público. No hay atajo por venir de una fuente
"buena": lo que publica un punto es que un moderador llamó y alguien contestó.

Suena excesivo cuando la lista viene del sitio web de la Alcaldía de Medellín.
No lo es, por dos razones que ya se han visto en otras emergencias:

- Las listas oficiales se publican una vez y no se vuelven a tocar. A los tres
  días la mitad de los puntos ya cerró o se mudó, y la página sigue igual.
- Publicar sin llamar rompe la única promesa que este sitio hace de verdad —
  "esto está confirmado" —, y la rompe justo donde más se nota: al principio,
  cuando nadie lo conoce todavía y una sola mala experiencia decide si vuelve.

Dos consecuencias en el modelo:

- **El teléfono importado nunca sale publicado.** Copiar un número de una
  publicación no es la autorización que pide la Ley 1581 de 2012. El número
  queda visible solo para moderación, que es quien va a llamar; la autorización
  para publicarlo se pide en esa llamada y se marca a mano.
- **La procedencia se guarda, pero no se muestra.** `fuente_nombre` y
  `fuente_url` quedan en la tabla para poder responder "¿de dónde salió esto?".
  No van en la ficha pública: mostrarlas invitaría a leer la fuente como aval,
  y el aval es la llamada. Si algún día se muestran, que sea junto a la fecha de
  verificación y no en su lugar.

## D14. La recolección en internet produce un CSV, no filas en la base

La fase 5 —buscar en internet los puntos que ya circulan en Medellín y Bogotá
para arrancar con datos reales— se hace con un script que **no escribe en la
base de datos**. Escribe un CSV, que un moderador abre, revisa y carga por
`/admin/importar`, donde vuelve a pasar por la revisión fila por fila.

Es una decisión de arquitectura, no de pereza. Un recolector que escribe directo
es imposible de auditar: cuando aparezca un punto raro no hay forma de saber si
lo inventó una expresión regular o si de verdad estaba en la página. Con el CSV
de por medio, cada punto tiene un archivo con su línea y su URL de origen.

Las reglas de la recolección, que valen tanto para el script como para quien lo
corra a mano:

- **Fuentes públicas y citables.** Páginas de alcaldías, gestión del riesgo,
  Cruz Roja, Defensa Civil, bomberos, y notas de prensa. Nada detrás de un
  login, nada de grupos privados de WhatsApp.
- **Respetar `robots.txt`**, identificarse con un User-Agent propio que diga qué
  es esto y a dónde escribir, y no pedir más de una página por segundo. No hay
  ninguna prisa que justifique tumbarle el sitio a una alcaldía en emergencia.
- **Los datos de contacto de personas no se publican nunca desde la
  recolección** (ver D13). Entran para poder llamar.
- **Sin geocodificación de pago.** Nominatim de OSM, un pedido por segundo y con
  User-Agent identificado, como pide su política de uso. Lo que no resuelva cae
  al centroide del municipio, que es exactamente lo que ya hace el formulario
  público cuando alguien registra sin JavaScript.
- **Se mide.** El pilotaje sirve tanto para sembrar el directorio como para
  saber cuánto cuesta mantenerlo: cuántas filas sobrevivieron a la revisión,
  cuántas llamadas hubo que hacer, cuántas contestaron. De ahí sale si la ronda
  de llamadas de D10 aguanta o si hay que conseguir el proveedor de correo ya.
