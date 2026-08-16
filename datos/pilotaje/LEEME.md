# Pilotaje — recolección manual

Terremoto del 10 de agosto de 2026 (magnitud 7,4, epicentro en San José del
Palmar, Chocó). Esta carpeta tiene la siembra inicial del directorio para
Medellín y Bogotá.

**Nada de lo que hay acá está verificado.** Es un punto de partida para la ronda
de llamadas, no una lista publicable. Ver `docs/DECISIONES.md`, D13 y D14.

## Cómo funciona

```
2026-08-medellin.json         ─┐
2026-08-bogota.json           ─┤
2026-08-*-acopio-colombia.json ┴→  npm run pilotaje  ─→  salida/pilotaje.csv
                                                        │
                                          /admin/importar (revisar + confirmar)
                                                        │
                                              21 puntos en `pendiente`
                                                        │
                                                 ronda de llamadas
                                                        │
                                                    publicado
```

Los `.json` se curan **a mano**, leyendo las fuentes. El script solo geocodifica
y arma el CSV: no interpreta páginas web ni escribe en la base de datos. Si
mañana la Alcaldía anuncia tres puntos más, se agregan al JSON y se vuelve a
correr.

## Qué hay en cada archivo

| Archivo | Qué es |
|---|---|
| `2026-08-medellin.json`, `2026-08-bogota.json` | Los puntos curados a mano, con la fuente de cada dato |
| `2026-08-*-acopio-colombia.json` | Generados con `npm run acopio-colombia` desde otro directorio ciudadano. **No editar a mano**: se regeneran (ver D18) |
| `salida/pilotaje.csv` | Lo que se carga en `/admin/importar` |
| `cache-geocodificacion.json` | Respuestas de Nominatim, para no volver a pedirlas |

La caché va versionada a propósito: junto con el CSV es el rastro de auditoría.
Cuando alguien pregunte por qué un punto quedó donde quedó, la respuesta está
en el repo.

## Dos rondas

**Ronda 1 (15 de agosto).** Los 10 puntos oficiales de Medellín y los 11 de la
Alcaldía de Bogotá y la Cruz Roja.

**Ronda 2 (15 de agosto, más tarde).** Lo que **no** es de la Alcaldía, que es
donde de verdad estaba el hueco: colectivos estudiantiles, una librería, ONG,
bomberos, universidades, tiendas de mascotas y los centros comerciales de ACE
Colombia. Son 33 puntos más, y son los que más se mueven y los que primero
cierran — así que son los que más urge llamar.

Lo que **no** se encontró, y conviene saberlo: los puntos que solo se anuncian
por Instagram o por cadenas de WhatsApp. Esas plataformas no son legibles sin
sesión, así que todo lo que hay acá salió de prensa y de páginas
institucionales. Los que aparecen mencionados sin dirección quedaron anotados
en `pistas_sin_confirmar` de cada archivo.

## Antes de llamar, lea las notas

Cada fila del CSV trae en `notas` lo que el moderador necesita saber:

- **`CONFLICTO ENTRE FUENTES`** — dos fuentes dicen cosas distintas. Es lo
  primero que hay que resolver. Hoy hay dos: el número del Palacio de los
  Deportes (59A-06 vs. 54A-06) y el horario de Unicentro.
- **`PIN SIN UBICAR`** — la coordenada es el centro de la ciudad, no la
  dirección. Cinco puntos de Bogotá y tres de Medellín. Van a salir marcados
  como posibles duplicados entre sí, porque comparten coordenada: es esperable,
  no es un error del detector.
- **`PIN APROXIMADO`** — se ubicó por barrio. Está a menos de un kilómetro.
- **`SIN CONTACTO`** — no se puede verificar hasta conseguir teléfono o
  Instagram. Es el trabajo más urgente de todos: sin contacto el punto se queda
  en `pendiente` para siempre. De los 54, solo 8 traen teléfono, y todos son de
  Medellín.
- **`SOLO MASCOTAS`** — Corferias y las tiendas Laika no reciben mercado ni
  aseo. Sus categorías ya vienen puestas así, para que no salgan cuando alguien
  filtra por alimentos.
- **`DIRECCIÓN SIN CONFIRMAR`** — los 13 centros comerciales de ACE. La fuente
  publicó solo el nombre, así que el pin se ubicó por nombre en OpenStreetMap y
  el campo de dirección repite el nombre. Hay que conseguir la nomenclatura y
  preguntar en qué parte del centro comercial está el punto.
- **Fechas que vencen.** Corferias cierra el 17 de agosto. Si se publica, hay
  que ponerle `fecha_fin` o revisarlo ese día.
- **La dirección salió del directorio de la sede**, no del anuncio del acopio.
  Que la sede exista ahí es un hecho; que ese día recibiera donaciones ahí es lo
  que falta confirmar. Pasa con los 8 puntos de Medellín cuya dirección la
  Alcaldía no publicó.

## Lo que quedó por fuera

En `pistas_sin_confirmar`, dentro de cada JSON. Hoy: las sedes de la Universidad
Pedagógica Nacional (anunciadas pero sin dirección legible) y el mapa
interactivo de Mapas Bogotá, que según la propia Alcaldía tiene la lista
completa y puede traer varios puntos más.

## Nada va marcado como urgente

Ninguna fuente prioriza: publican "qué se recibe", no "qué falta más". Marcar
todo como urgente arruinaría el agregado de "lo que más falta acá" justo cuando
más se mira. La urgencia se pregunta en la llamada, que es la única que la sabe
de verdad.
