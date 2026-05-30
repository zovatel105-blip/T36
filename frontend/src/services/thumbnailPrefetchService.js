/**
 * Thumbnail Prefetch Service
 * --------------------------
 * Descarga Y DECODIFICA silenciosamente los thumbnails (y avatares) de los
 * próximos posts que el usuario va a ver en el feed, para que cuando llegue
 * a ellos ya estén en GPU y listos para pintar instantáneamente.
 *
 * Estrategia TikTok:
 *   1. Creamos un `new Image()` que descarga la URL → HTTP cache.
 *   2. En onload, llamamos `img.decode()` que fuerza al browser a decodificar
 *      la imagen en GPU. Sin este paso, el <img> del DOM solo encuentra la
 *      imagen en HTTP cache pero tiene que decodificarla → visible 1-2 frames
 *      después (el "flash" que vemos en feeds no optimizados).
 *   3. Deduplicamos URLs ya pedidas en la sesión (Set en memoria).
 *   4. Concurrencia limitada a MAX_CONCURRENCY para no saturar la red.
 */

const inFlight = new Set();
const completed = new Set();

const MAX_CONCURRENCY = 6;
let activeCount = 0;
const queue = [];

function pump() {
  while (activeCount < MAX_CONCURRENCY && queue.length > 0) {
    const next = queue.shift();
    if (next) next();
  }
}

function enqueue(fn) {
  queue.push(fn);
  pump();
}

function prefetchOne(url) {
  return new Promise((resolve) => {
    if (!url || typeof url !== 'string') return resolve();
    if (completed.has(url) || inFlight.has(url)) return resolve();
    inFlight.add(url);

    enqueue(() => {
      activeCount++;
      let cancelled = false;
      const img = new Image();
      img.crossOrigin = 'anonymous';

      const cleanup = () => {
        activeCount--;
        inFlight.delete(url);
        completed.add(url);
        pump();
        resolve();
      };

      const onLoad = async () => {
        if (cancelled) { cleanup(); return; }
        // 🚀 PRE-DECODE REAL: forzar decodificación en GPU
        // Sin esto, el <img> del DOM solo encuentra la imagen en HTTP cache
        // pero tiene que decodificarla → 1-2 frames de flash.
        try {
          await img.decode();
        } catch (_) { /* decode fail — la imagen se renderiza igual */ }
        if (!cancelled) cleanup();
      };

      img.onload = onLoad;
      img.onerror = cleanup;
      img.src = url;

      // Timeout de seguridad: si decode no termina en 5s, igual limpiamos
      setTimeout(() => {
        if (!cancelled) { cancelled = true; cleanup(); }
      }, 5000);
    });
  });
}

/**
 * Extrae todas las URLs de imagen relevantes de un poll (thumbnails de
 * opciones, miniaturas generadas por el backend, avatar del autor).
 * Ignora URLs que no sean http/https o rutas relativas.
 */
function extractImageUrls(poll) {
  if (!poll || typeof poll !== 'object') return [];
  const urls = [];

  // Avatar del autor (suele ser la primera imagen visible al cargar el post)
  const avatar = poll?.author?.avatar_url || poll?.author?.avatar;
  if (avatar) urls.push(avatar);

  // Miniatura de portada del post (si el backend la precalcula)
  if (poll?.thumbnail_url) urls.push(poll.thumbnail_url);

  // Opciones (slides del carrusel): cada una puede tener thumbnail y/o media
  for (const opt of collectAllOptions(poll)) {
    if (!opt) continue;
    if (opt.thumbnail_url) urls.push(opt.thumbnail_url);
    if (opt.media?.thumbnail) urls.push(opt.media.thumbnail);
    if (opt.media_type === 'image' && opt.media_url) urls.push(opt.media_url);
  }

  return urls.filter(Boolean);
}

function collectAllOptions(poll) {
  const all = [];
  if (Array.isArray(poll?.options)) {
    for (const o of poll.options) if (o) all.push(o);
  }
  if (Array.isArray(poll?.vs_questions)) {
    for (const q of poll.vs_questions) {
      const qOpts = Array.isArray(q?.options) ? q.options : [];
      for (const o of qOpts) if (o) all.push(o);
    }
  }
  return all;
}

export const thumbnailPrefetch = {
  /**
   * Prefetch los thumbnails de los N posts siguientes al indice dado.
   *
   * @param {Array} polls   Lista completa de polls del feed.
   * @param {number} index  Indice del post actualmente visible.
   * @param {number} [aheadCount=3] Cuantos posts por delante prefetchar.
   */
  prefetchAroundIndex(polls, index, aheadCount = 3) {
    if (!Array.isArray(polls) || polls.length === 0) return;
    if (typeof index !== 'number' || index < 0) return;

    const end = Math.min(polls.length, index + 1 + aheadCount);
    for (let i = index + 1; i < end; i++) {
      const urls = extractImageUrls(polls[i]);
      for (const u of urls) {
        prefetchOne(u);
      }
    }
    // Tambien prefetch del post +1 hacia atras — ayuda si el usuario
    // vuelve al anterior y su cache HTTP ya se purgó.
    if (index - 1 >= 0) {
      const urls = extractImageUrls(polls[index - 1]);
      for (const u of urls) prefetchOne(u);
    }
  },

  /**
   * Prefetch explicito de un listado de URLs (usado por el componente
   * grid para precargar thumbnails de todos los posts que se rendericen
   * por primera vez).
   */
  prefetchUrls(urls = []) {
    for (const u of urls) prefetchOne(u);
  },

  /**
   * Limpia el registro en memoria. NO borra cache HTTP del WebView.
   * Util en dev / al cerrar sesion.
   */
  reset() {
    inFlight.clear();
    completed.clear();
    queue.length = 0;
    activeCount = 0;
  },
};

export default thumbnailPrefetch;
