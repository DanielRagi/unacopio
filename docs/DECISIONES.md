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

## D15. Ya hay correo saliente, y es angosto a propósito

Desde el 15 de agosto de 2026 el proyecto tiene buzón propio: `hola@unacopio.co`,
en Spacemail, con el dominio. Supabase manda el enlace de acceso a moderación por
ese SMTP en vez del compartido, que aguantaba **dos correos por hora** — un
número con el que un equipo de cinco voluntarios no puede ni empezar el turno.

Lo que cambia y lo que no:

- **Cambia** que el enlace de acceso llega. Con SMTP propio el tope arranca en 30
  por hora y se sube en el panel. Para un equipo de moderación sobra.
- **Cambia** que hay una dirección pública donde escribirnos. Va en el pie, en
  `/datos` y en la pantalla de acceso. Antes decíamos "escríbenos" sin decir a
  dónde, que es peor que no decir nada.
- **No cambia** D8: al público no se le escribe. El correo es un canal de
  entrada —alguien nos manda su lista— y de salida solo hacia moderación.

**Spacemail es un buzón, no un proveedor transaccional**, y esa distinción
importa para lo que viene. Un buzón está pensado para que una persona escriba
correos; mandar cientos de mensajes automáticos desde ahí termina en throttling y
en la carpeta de spam, con el dominio quemado de paso. Para los enlaces de acceso
de cinco o diez moderadores es exactamente la herramienta correcta. Para
escribirle a 200 responsables de punto cada 48 horas, no.

Entonces **D9 y D10 siguen en pie tal como están**: sin tokens de edición y con
la verificación por llamada. Las dos se decidieron por no tener correo, y ahora
lo hay, así que vale la pena decir por qué no se revierten hoy:

- Volver a los tokens (D9) resolvería la lentitud de las correcciones, pero
  reintroduce el secreto que se filtra en un grupo de WhatsApp. La bandeja de
  solicitudes está funcionando; el problema que tenía D9 era de arquitectura, no
  de canal.
- El recordatorio automático de 48 horas (D10) sí es la mejora que de verdad
  desbloquearía el correo, y es lo que hay que hacer **cuando el directorio pase
  de unas cien fichas**. Pero necesita un proveedor transaccional —Resend,
  Postmark, SES— no el buzón. Meterlo hoy, con 21 puntos, sería cambiar una ronda
  de once llamadas diarias que además trae información que el formulario no
  captura ("ya no necesitamos ropa pero nos falta agua").

Dicho de otro modo: el correo dejó de ser el bloqueo, pero el bloqueo siguiente
—gente que llame— no lo resuelve un correo.

Las credenciales SMTP viven en el panel de Supabase y **no entran al repo**: la
aplicación no manda correos, los manda Supabase Auth. Lo único versionado son las
plantillas, en `supabase/correos/`.

## D16. La portada abre en la ciudad de quien entra, y lo dice

Antes la portada arrancaba mostrando Colombia entera. En una emergencia eso es
casi lo mismo que no mostrar nada: alguien en Manizales veía una lista donde su
municipio quedaba de decimoquinto, y encima el mapa abría al zoom del país.

Ahora se elige un municipio por defecto a partir de la geolocalización por IP que
Vercel deja en las cabeceras (`x-vercel-ip-city`, `x-vercel-ip-latitude`,
`x-vercel-ip-longitude`). No cuesta nada, no pide permiso, no necesita
JavaScript y llega a tiempo para renderizar en el servidor.

Las reglas que lo hacen honesto:

- **Se dice siempre.** "Te estamos mostrando Medellín, por tu conexión · Ver todo
  el país". Un filtro invisible que la persona no puso es una trampa: si el
  municipio está vacío, va a creer que no hay puntos en ninguna parte.
- **Un filtro explícito manda.** Si la URL trae `dep`, `mun`, `cat` o
  coordenadas, no se adivina nada. Nada peor que compartir "los puntos de
  Quibdó" por WhatsApp y que al otro le abra en Bogotá.
- **`?pais=1` desactiva la detección.** Tiene que ser un parámetro explícito y no
  la simple ausencia de filtros: si "ver todo el país" llevara a `/`, la
  detección se volvería a disparar y el botón no haría nada. Por lo mismo, el
  formulario de filtros lo manda siempre — usarlo es elegir a mano.
- **Solo Colombia.** A alguien que entra desde afuera no se le adivina ciudad:
  casi siempre está buscando para un familiar y quiere elegir el municipio.

**Cómo se resuelve la coordenada a un municipio, que es donde estaba la trampa.**
La primera versión buscaba el centroide más cercano, y con eso el centro de
Bogotá caía en **Cota**. No era redondeo: el centroide DANE de Bogotá D.C. está
en el páramo de Sumapaz, a unos 40 km del centro urbano, porque el distrito
incluye toda esa zona rural. Cualquier municipio grande tiene el mismo problema,
así que arreglarlo a mano para Bogotá habría dejado la trampa puesta.

`municipio_de_ubicacion` usa el **nombre** de la ciudad como señal principal y la
distancia solo para desempatar. Compara contra el nombre y contra el slug: contra
el nombre para que los homónimos —Argelia, La Unión, El Peñón— entren todos y
gane el más cercano; contra el slug porque hay nombres oficiales que nadie
escribe así, y "Bogotá D.C." es justamente el caso. Si el nombre no cuadra con
nada, ahí sí cae al centroide más cercano.

Para la distancia de verdad sigue estando el botón de GPS, que sí pide permiso.
La IP da ciudad —y a veces la del proveedor, no la de la persona—, así que se usa
para elegir un punto de partida, nunca para calcular "a 1,2 km".

## D17. El teléfono deja de ser obligatorio; Instagram entra como contacto

Aparece un caso que el diseño no contemplaba: puntos cuyo único contacto es una
cuenta de Instagram. Pasa con colectivos, con parroquias jóvenes y con
fundaciones chicas, que coordinan todo por ahí y no tienen un número que
contesten. Antes tenían dos salidas, las dos malas: quedarse por fuera del
directorio, o inventarse un teléfono para pasar la validación.

Un teléfono inventado es peor que ninguno. Manda a un donante a marcarle a un
desconocido, y hace que la ronda de verificación gaste llamadas en un número que
nunca fue de nadie.

Entonces:

- **`telefono` acepta texto.** Lo que no sea marcable queda como "Por
  confirmar". La columna sigue siendo `not null` porque siempre hay algo que
  decir ahí, y el flujo de moderación se apoya en que exista.
- **La ficha no ofrece "Llamar" ni WhatsApp cuando no hay número**, y la cola de
  llamadas muestra el Instagram en lugar del teléfono. Un botón que abre el
  marcador con basura hace creer que el sitio está roto, y con razón.
- **La validación cambia de pregunta.** Ya no es "¿esto parece un teléfono?"
  sino "¿hay alguna forma de contactarlos?". Tiene que haber teléfono marcable o
  Instagram. Un punto sin ninguno de los dos no se puede verificar ni
  preguntarle nada, y publicar una dirección que nadie puede confirmar es
  exactamente lo que hace que la gente pierda el viaje.

**Instagram no pasa por el consentimiento del teléfono**, y la diferencia es
deliberada. Un número de celular es un dato personal que hay que autorizar (Ley
1581 de 2012, ver D4). Una cuenta de Instagram que alguien escribe en un campo
que dice "se publica" ya es pública, y es justamente por donde quiere que le
escriban: pedirle una segunda autorización para publicar lo que acaba de
ofrecer como canal de contacto sería teatro.

Se guarda normalizado —sin arroba, sin URL, en minúsculas— porque la gente lo
escribe de cinco formas distintas y guardar cada variante impide compararlas y
armar el enlace. La normalización corre en la aplicación y también dentro de
`registrar_punto`, que es pública y tiene que defenderse sola.

**Lo que esto le cuesta a la ronda de llamadas (D10):** un punto de Instagram no
se llama, se le escribe, y eso es más lento y deja menos información que una
conversación. Si terminan siendo muchos, la regla de "N puntos son N/2 llamadas
al día" deja de servir para estimar el trabajo.

## D18. Se puede tomar de otro directorio, con reglas

Apareció **Centros de Acopio Colombia** (emergency-rosy.vercel.app), otro
proyecto ciudadano independiente que publica el mismo tipo de directorio y que
tiene bastante más datos que nosotros: 145 puntos en 27 departamentos, con
dirección, teléfono, coordenada exacta y notas de verificación serias.

Lo primero que hay que decir es incómodo y es cierto: **nuestra propia página
`/datos` argumenta que el problema de estas emergencias son cinco listas que se
contradicen, y ahora somos una de ellas.** Lo correcto es escribirles y unir
esfuerzos. Mientras tanto, tomar sus datos públicos es legítimo —los hechos
sobre dónde queda un punto no son de nadie— pero con reglas, porque la
diferencia entre reutilizar y aprovecharse está en los detalles:

- **Se respeta su `robots.txt`.** Permite `/` y prohíbe `/api`. Los datos salen
  del HTML prerenderizado de la portada, que es lo que autorizan. Su API sería
  más cómoda y por eso mismo no se toca: un archivo `robots.txt` es una
  preferencia explícita y legible por máquinas, y saltárselo porque conviene es
  justo lo que uno no quiere que le hagan.
- **Una sola petición por corrida**, con User-Agent identificado y con a dónde
  escribirnos.
- **La atribución apunta a la fuente original, no al agregador.** Si ellos
  citan el comunicado de la Alcaldía, nuestro `fuente_url` es ese comunicado, y
  la nota deja dicho que el dato pasó por Acopio Colombia. Poner solo el
  agregador borraría de dónde salió de verdad.
- **Su verificación no es la nuestra.** Ellos marcan puntos como `verified`
  contra el canal propio de la entidad, y lo hacen bien. Igual entra todo como
  `pendiente`: D13 no tiene excepciones, y si empezáramos a hacerlas la primera
  sería siempre la más razonable.

Lo que su base aporta y a nosotros nos faltaba es concreto: **coordenada exacta
y teléfono**. De los 50 puntos suyos en Medellín y Bogotá, 19 traen número — más
que todo lo que habíamos recolectado a mano.

Y lo que nosotros tenemos y ellos no se ve en su sitio: API abierta en JSON y
CSV con licencia, el "qué NO llevar" por punto, horarios estructurados con
"abierto ahora", páginas por municipio y la ronda de llamadas. Hay con qué
llegar a una conversación de iguales.

## D19. Moderación no juega con las mismas reglas que el público

Dos veces seguidas pasó lo mismo: una validación pensada para el formulario
público terminó bloqueando a quien modera. Primero el horario obligatorio, que
impedía corregir la dirección de un punto importado; después el contacto
obligatorio, que impedía publicar un coliseo municipal porque no conseguíamos un
celular. En los dos casos el punto ya estaba ahí, con su dirección, y lo único
que faltaba era un dato que solo el formulario público tiene derecho a exigir.

La regla que faltaba escribir es esta: **quien registra y quien modera no son la
misma persona y no saben lo mismo.**

- Quien registra sabe su horario y su teléfono. Exigírselos es razonable, y de
  paso es la barrera más barata contra el spam.
- Quien modera está mirando una ficha ajena. Muchas veces no tiene esos datos —
  el punto salió de una lista, o la persona con la que habló no los supo— y aun
  así necesita poder corregir lo demás.

Por eso hay dos esquemas. `esquemaRegistro` exige horario y contacto;
`esquemaModeracion` no exige ninguno de los dos, y todo lo demás sigue igual:
municipio coherente con el departamento, al menos una categoría que sí reciban,
dirección de verdad.

**Lo que se pierde, y hay que tenerlo presente:** ahora se puede publicar un
punto sin ninguna forma de contactarlo. Eso significa que nadie puede
confirmarlo después, así que se queda congelado hasta que alguien pase por ahí.
Es un intercambio consciente: para un coliseo o una estación de bomberos, saber
dónde queda vale más que poder llamar, y bloquear la publicación por eso deja a
la gente sin la dirección, que es peor.

También de acá sale que **cualquier estado se puede devolver a `pendiente`**. Un
punto rechazado por error o uno publicado al que le faltó algo tiene que poder
volver a la cola sin que nadie abra la base a mano. Mientras esté en `pendiente`
desaparece del sitio, que es exactamente lo que se quiere mientras se revisa.
