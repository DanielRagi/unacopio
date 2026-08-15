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

## Fase 1 — MVP publicable (≈ 4–6 h) 🎯 objetivo del día 1

- [ ] `/registrar` — formulario público de registro de punto
  - Datos del punto, mapa con pin arrastrable (Leaflet), selector de categorías
    en tres estados (**prioridad / recibimos / NO recibimos**)
  - Validación con Zod, Server Action, honeypot anti-spam
  - Check obligatorio de Habeas Data para publicar el teléfono
  - Al enviar: pantalla de "queda pendiente de aprobación" + link secreto de edición
- [ ] `/` — lista de puntos publicados
  - Filtro por departamento y municipio (server-side, en la URL: `/?dep=05&mun=05001`)
  - Tarjeta: nombre, tipo de organización, dirección, horario, qué necesitan con
    urgencia, qué NO reciben, "verificado hace X"
  - Renderizado en servidor, sin JS obligatorio para ver la lista
- [ ] `/punto/[id]` — ficha completa, con botones "Llamar", "WhatsApp",
      "Cómo llegar" (Google Maps / Waze) y "Compartir por WhatsApp"
- [ ] `/admin` — cola de moderación (Supabase Auth con magic link)
  - Aprobar / rechazar / editar / marcar como verificado / cerrar
- [ ] RLS activo en todas las tablas. **No pasar de aquí sin esto.**
- [ ] Aviso legal fijo: no recolectamos dinero, la información la aportan terceros
- [ ] Metadatos Open Graph — el 90% del tráfico va a entrar por un link de WhatsApp

**Sale de aquí:** el sitio ya sirve. Se puede empezar a difundir.

## Fase 2 — Encontrar el más cercano (≈ 3–4 h) 🎯 día 2

- [ ] Botón "Usar mi ubicación" (`navigator.geolocation`) → RPC `puntos_cercanos`,
      lista ordenada por distancia con "a 1,2 km"
- [ ] Fallback sin GPS: selector de municipio → centroide DANE
- [ ] `/mapa` — vista de mapa con marcadores agrupados (clusters) y popup por punto
- [ ] Filtro por categoría ("quiero donar agua" → solo puntos que reciben agua)
- [ ] Botón "Reportar" en cada ficha, con despublicación automática a los 3 reportes

## Fase 3 — Que la información no se pudra (≈ 1 día)

Este es el problema real de estos directorios: a la semana la mitad de los puntos
ya cerró y nadie lo actualizó. El sitio pierde credibilidad y la gente vuelve a
los audios de WhatsApp.

- [ ] Semáforo de frescura: verde <24h, amarillo <72h, gris >72h ("puede estar desactualizado")
- [ ] Recordatorio automático cada 48h al **correo** del responsable (nunca por
      WhatsApp, ver D8):
      "¿Siguen recibiendo? Sí / Cambió / Ya cerramos" — un click, sin login
- [ ] Panel de moderación con cola priorizada: sin verificar hace más tiempo primero
- [ ] Detección de duplicados: puntos a <100 m con nombre parecido
- [ ] Horarios estructurados + badge "Abierto ahora"
- [ ] Estado `lleno` — "hoy no reciben más, están saturados"

## Fase 4 — Alcance y aliados (según cómo evolucione)

- [ ] `GET /api/puntos.json` y `.csv` públicos, con licencia abierta, para que
      medios y alcaldías reutilicen los datos en vez de armar su propia lista
- [ ] PWA + caché offline de la lista del municipio (conectividad intermitente)
- [ ] Importación masiva desde CSV para listas que ya tienen las alcaldías
- [ ] Vista por municipio para compartir: `/acopio/manizales`
- [ ] Sección de "necesidades agregadas": qué falta más en cada municipio
- [ ] Accesibilidad: contraste AA, tipografía grande, funciona con lector de pantalla

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
| Información desactualizada | Fase 3 completa: semáforo + recordatorio de 48h |
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

Fase 0. Concretamente: `create-next-app`, proyecto en Supabase, migración inicial y
un deploy en Vercel apuntando al dominio.
