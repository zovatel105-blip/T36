/**
 * tiktokOptimizations.js
 * 
 * Configuración centralizada para optimizaciones TikTok-style del feed.
 * Todos los thresholds y timings críticos para la fluidez tipo TikTok.
 * 
 * @see https://www.tiktok.com/engineering para referencia de arquitectura
 */

// ─────────────────────────────────────────────────────────────────────────────
// SCROLL & SWIPE CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────

export const SCROLL_CONFIG = {
  // Velocidad mínima (px/ms) para considerar fast-scroll
  FAST_SCROLL_VELOCITY_THRESHOLD: 1.0,
  
  // Número de swipes en ventana de tiempo para detectar cascada
  SWIPE_CASCADE_COUNT: 3,
  SWIPE_CASCADE_WINDOW_MS: 800,
  
  // Tiempo de inactividad antes de liberar fast-scrolling
  FAST_SCROLL_RELEASE_DELAY_MS: 200,
  
  // Sensibilidad del mouse wheel (1.0 = normal, >1 = más sensible)
  MOUSE_WHEEL_SENSITIVITY: 1.2,
  
  // Threshold delta para mouse wheel (evita over-scroll)
  MOUSE_WHEEL_THRESHOLD_DELTA: 15,
  
  // Ratio para long swipe (0.35 = más sensible que 0.4)
  LONG_SWIPES_RATIO: 0.35,
  
  // Tiempo máximo para considerar long swipe
  LONG_SWIPES_MS: 250,
  
  // Threshold de touch para iniciar swipe
  TOUCH_THRESHOLD: 3,
};

// ─────────────────────────────────────────────────────────────────────────────
// TRANSITION TIMING
// ─────────────────────────────────────────────────────────────────────────────

export const TRANSITION_CONFIG = {
  // Duración mínima de transición (swipes rápidos)
  MIN_TRANSITION_DURATION_MS: 180,
  
  // Duración máxima de transición (swipes lentos)
  MAX_TRANSITION_DURATION_MS: 320,
  
  // Factor de reducción por velocidad (ms por px/ms)
  VELOCITY_DURATION_FACTOR: 30,
  
  // Easing function tipo TikTok (cubic-bezier)
  EASING_FUNCTION: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
};

// ─────────────────────────────────────────────────────────────────────────────
// PREFETCH & CACHING
// ─────────────────────────────────────────────────────────────────────────────

export const PREFETCH_CONFIG = {
  // Número de slides hacia adelante para prefetch
  PREFETCH_AHEAD_COUNT: 4,
  
  // Número de slides hacia atrás para mantener en cache
  PREFETCH_BEHIND_COUNT: 1,
  
  // Distancia máxima para cancelar prefetches (TikTok-style aggressive cancel)
  CANCEL_DISTANCE: 2,
  
  // Tamaño máximo de video para prefetch (25 MB)
  MAX_VIDEO_PREFETCH_BYTES: 25 * 1024 * 1024,
  
  // Tamaño máximo de audio para prefetch (8 MB)
  MAX_AUDIO_PREFETCH_BYTES: 8 * 1024 * 1024,
  
  // Profundidad de prefetch de thumbnails (más baratos)
  THUMBNAIL_PREFETCH_AHEAD: 8,
};

// ─────────────────────────────────────────────────────────────────────────────
// VIDEO & DECODER BUDGET
// ─────────────────────────────────────────────────────────────────────────────

export const VIDEO_CONFIG = {
  // Distancia máxima para renderizar etiqueta <video> (normal)
  MAX_VIDEO_TAG_DISTANCE: 2,
  
  // Distancia máxima para renderizar etiqueta <video> (layout VS)
  MAX_VIDEO_TAG_DISTANCE_VS: 1,
  
  // Tiempo de warm-up para video en slot adyacente
  VIDEO_WARMUP_DELAY_MS: 60,
  
  // Tiempo mínimo de buffer antes de mostrar video (crossfade)
  MIN_BUFFER_TIME_MS: 200,
  
  // TTL para cache de tiempo de video (scroll-back instant resume)
  VIDEO_TIME_CACHE_TTL_MS: 30000,
};

// ─────────────────────────────────────────────────────────────────────────────
// RENDERING WINDOW
// ─────────────────────────────────────────────────────────────────────────────

export const RENDER_WINDOW_CONFIG = {
  // Slides montados hacia atrás del activo
  WINDOW_BEHIND: 1,
  
  // Slides montados hacia adelante del activo (más buffer)
  WINDOW_AHEAD: 4,
  
  // Distancia para mostrar skeleton placeholder
  SKELETON_DISTANCE: 3,
};

// ─────────────────────────────────────────────────────────────────────────────
// SKELETON LOADING
// ─────────────────────────────────────────────────────────────────────────────

export const SKELETON_CONFIG = {
  // Tiempo mínimo de muestra de skeleton (evita flash)
  MIN_SKELETON_DISPLAY_MS: 300,
  
  // Número de slides skeleton para precargar sensación
  SKELETON_SLIDE_COUNT: 3,
  
  // Duración de animación shimmer
  SHIMMER_ANIMATION_DURATION_MS: 1500,
};

// ─────────────────────────────────────────────────────────────────────────────
// GPU & CSS OPTIMIZATIONS
// ─────────────────────────────────────────────────────────────────────────────

export const GPU_CONFIG = {
  // Enable CSS will-change para elementos en movimiento
  ENABLE_WILL_CHANGE: true,
  
  // Enable transform translateZ(0) para GPU acceleration
  ENABLE_GPU_COMPOSITION: true,
  
  // Enable backface-visibility: hidden
  ENABLE_BACKFACE_HIDDEN: true,
  
  // Enable content-visibility: auto
  ENABLE_CONTENT_VISIBILITY: true,
};

// ─────────────────────────────────────────────────────────────────────────────
// NETWORK ADAPTATION
// ─────────────────────────────────────────────────────────────────────────────

export const NETWORK_CONFIG = {
  // Reducción de prefetch en redes lentas
  SLOW_NETWORK_PREFETCH_REDUCTION: 0.5,
  
  // Deshabilitar prefetch en 2G
  DISABLE_PREFETCH_2G: true,
  
  // Deshabilitar prefetch con saveData enabled
  DISABLE_PREFETCH_SAVE_DATA: true,
  
  // Umbrales de tipo de red efectiva
  NETWORK_TYPES: {
    SLOW_2G: 'slow-2g',
    SLOW: '2g',
    MEDIUM: '3g',
    FAST: '4g',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// DEBUG & MONITORING
// ─────────────────────────────────────────────────────────────────────────────

export const DEBUG_CONFIG = {
  // Enable logging de cancelaciones de prefetch
  LOG_PREFETCH_CANCELS: true,
  
  // Enable logging de velocidad de swipe
  LOG_SWIPE_VELOCITY: false,
  
  // Enable stats de decoder budget
  LOG_DECODER_STATS: false,
};

// Helper para obtener configuración adaptativa según red
export const getAdaptiveConfig = () => {
  const connection = typeof navigator !== 'undefined' ? navigator.connection : null;
  const saveData = connection?.saveData === true;
  const effectiveType = connection?.effectiveType;
  
  if (saveData || effectiveType === 'slow-2g' || effectiveType === '2g') {
    return {
      prefetch: {
        ...PREFETCH_CONFIG,
        PREFETCH_AHEAD_COUNT: 1,
        THUMBNAIL_PREFETCH_AHEAD: 3,
      },
      video: {
        ...VIDEO_CONFIG,
        MAX_VIDEO_TAG_DISTANCE: 0, // Solo video activo
      },
    };
  }
  
  if (effectiveType === '3g') {
    return {
      prefetch: {
        ...PREFETCH_CONFIG,
        PREFETCH_AHEAD_COUNT: 2,
        THUMBNAIL_PREFETCH_AHEAD: 5,
      },
      video: {
        ...VIDEO_CONFIG,
        MAX_VIDEO_TAG_DISTANCE: 1,
      },
    };
  }
  
  // 4G / WiFi / desconocido
  return {
    prefetch: PREFETCH_CONFIG,
    video: VIDEO_CONFIG,
  };
};

// Exportar todo como objeto único para conveniencia
const tiktokOptimizations = {
  SCROLL_CONFIG,
  TRANSITION_CONFIG,
  PREFETCH_CONFIG,
  VIDEO_CONFIG,
  RENDER_WINDOW_CONFIG,
  SKELETON_CONFIG,
  GPU_CONFIG,
  NETWORK_CONFIG,
  DEBUG_CONFIG,
  getAdaptiveConfig,
};

export default tiktokOptimizations;