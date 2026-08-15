# Correos de autenticación

Plantillas para **Supabase → Authentication → Emails**. No las usa la aplicación:
se pegan a mano en el panel, y quedan versionadas acá para que se puedan revisar
en un diff y no se pierdan cuando alguien las toque a las 2 a.m.

| Archivo | Dónde va | Asunto sugerido |
|---|---|---|
| `enlace-magico.html` | Magic Link | `Tu enlace para entrar a UnAcopio` |

## Por qué se reemplaza la de Supabase

La que viene por defecto está en inglés y dice "Your Magic Link". Alguien que se
ofreció de voluntario ayer, y recibe un correo en inglés desde un dominio que no
reconoce, lo borra pensando que es phishing. Y hace bien.

## Reglas al editarlas

Los clientes de correo no son navegadores. Lo que aplica acá y no en el sitio:

- **CSS en línea**, siempre. Gmail y Outlook descartan las hojas de estilo.
- **Tablas, no flexbox ni grid.** Outlook renderiza con el motor de Word.
- **Sin imágenes.** Muchos clientes las bloquean por defecto, y una imagen que
  no carga deja el correo mudo.
- **El enlace también como texto plano.** Hay clientes que no muestran botones,
  y quien desconfía quiere ver a dónde lo mandan antes de tocar.
- **Decir que nunca pedimos contraseñas ni plata.** Es un sitio de emergencia:
  los estafadores llegan solos, y conviene que la gente ya sepa qué no esperar
  de nosotros.

## Lo único que manda UnAcopio

Este correo, y nada más. Al público no se le escribe nunca (ver D8 y D15). Si
algún día aparece una plantilla nueva acá, es porque esa decisión cambió, y eso
debería quedar escrito en `docs/DECISIONES.md` antes que en este directorio.
