# Pilotaje — recolección manual

Terremoto del 10 de agosto de 2026 (magnitud 7,4, epicentro en San José del
Palmar, Chocó). Esta carpeta tiene la siembra inicial del directorio para
Medellín y Bogotá.

**Nada de lo que hay acá está verificado.** Es un punto de partida para la ronda
de llamadas, no una lista publicable. Ver `docs/DECISIONES.md`, D13 y D14.

## Cómo funciona

```
2026-08-medellin.json  ─┐
2026-08-bogota.json    ─┴─→  npm run pilotaje  ─→  salida/pilotaje.csv
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
| `2026-08-*.json` | Los puntos, curados a mano, con la fuente de cada dato |
| `salida/pilotaje.csv` | Lo que se carga en `/admin/importar` |
| `cache-geocodificacion.json` | Respuestas de Nominatim, para no volver a pedirlas |

La caché va versionada a propósito: junto con el CSV es el rastro de auditoría.
Cuando alguien pregunte por qué un punto quedó donde quedó, la respuesta está
en el repo.

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
- **`SIN TELÉFONO`** — no se puede verificar por llamada hasta conseguirlo. Son
  16 de 21, y es el trabajo más urgente de todos: sin teléfono el punto se queda
  en `pendiente` para siempre.
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
