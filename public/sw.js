/**
 * Service worker de UnAcopio.
 *
 * El escenario que resuelve es concreto: alguien consulta la lista de su
 * municipio con señal, sale de la casa, y a mitad de camino se queda sin datos.
 * Sin esto, la página que ya había visto se convierte en el dinosaurio del
 * navegador.
 *
 * Reglas, en orden de importancia:
 *
 *   · Las páginas se piden SIEMPRE a la red primero. Un punto de acopio que
 *     cerró es información peligrosa: preferimos tardar que mentir.
 *   · Si la red falla, sale la última copia que se haya visto, marcada como
 *     copia guardada por la página misma (ver `AvisoSinConexion`).
 *   · Si tampoco hay copia, sale `/offline`.
 *   · Nada de moderación, nada de la API y nada de peticiones con sesión se
 *     guarda en caché.
 *
 * Se escribe a mano y sin Workbox: son cincuenta líneas y no vale meterle otra
 * dependencia con su propio ciclo de vida al proyecto.
 */

const VERSION = 'unacopio-v1';
const ESTATICOS = `${VERSION}-estaticos`;
const PAGINAS = `${VERSION}-paginas`;
const SIN_CONEXION = '/offline';

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches.open(ESTATICOS).then((cache) => cache.addAll([SIN_CONEXION, '/icono.svg'])),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((claves) =>
        Promise.all(claves.filter((c) => !c.startsWith(VERSION)).map((c) => caches.delete(c))),
      )
      .then(() => self.clients.claim()),
  );
});

/** Lo que nunca se guarda: cambia solo, o es privado. */
function noCachear(url) {
  return (
    url.pathname.startsWith('/admin') ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/auth/') ||
    // Los tiles del mapa son de OpenStreetMap: su política pide no acumularlos.
    url.hostname.endsWith('tile.openstreetmap.org')
  );
}

self.addEventListener('fetch', (evento) => {
  const peticion = evento.request;
  if (peticion.method !== 'GET') return;

  const url = new URL(peticion.url);
  if (noCachear(url)) return;

  // Los archivos con hash en el nombre no cambian nunca: caché primero.
  if (url.origin === self.location.origin && url.pathname.startsWith('/_next/static/')) {
    evento.respondWith(
      caches.match(peticion).then(
        (guardada) =>
          guardada ??
          fetch(peticion).then((respuesta) => {
            const copia = respuesta.clone();
            caches.open(ESTATICOS).then((cache) => cache.put(peticion, copia));
            return respuesta;
          }),
      ),
    );
    return;
  }

  if (peticion.mode !== 'navigate') return;

  evento.respondWith(
    fetch(peticion)
      .then((respuesta) => {
        if (respuesta.ok) {
          const copia = respuesta.clone();
          caches.open(PAGINAS).then((cache) => cache.put(peticion, copia));
        }
        return respuesta;
      })
      .catch(async () => {
        const guardada = await caches.match(peticion, { ignoreSearch: false });
        return guardada ?? (await caches.match(SIN_CONEXION)) ?? Response.error();
      }),
  );
});
