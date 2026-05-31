/**
 * tiktokOptimizations.custom.js
 * 
 * Ejemplo de configuración personalizada para las optimizaciones TikTok-style.
 * Copia este archivo y ajusta los valores según tus necesidades.
 * 
 * Uso:
 *   1. Copia este archivo a `tiktokOptimizations.custom.js`
 *   2. Ajusta los valores
 *   3. Importa en tu código: import customConfig from './tiktokOptimizations.custom.js'
 *   4. Fusiona con la config base: const config = { ...defaultConfig, ...customConfig }
 */

import defaultConfig from './tiktokOptimizations.js';

const customConfig = {
  // ───────────────────────────────────────────────────────────────────────────
  // EJEMPLO 1: Configuración para dispositivos de gama alta
  // ───────────────────────────────────────────────────────────────────────────
  SCROLL_CONFIG: {
    ...defaultConfig.SCROLL_CONFIG,
    // Scroll más sensible para usuarios expertos
    FAST_SCROLL_VELOCITY_THRESHOLD: 0.8, // default: 1.0
    LONG_SWIPES_RATIO: 0.3, // default: 0.35 (más rápido)
  },
  
  TRANSITION_CONFIG: {
    ...defaultConfig.TRANSITION_CONFIG,
    // Transiciones más rápidas
    MIN_TRANSITION_DURATION_MS: 150, // default: 180
    MAX_TRANSITION_DURATION_MS: 280, // default: 320
    VELOCITY_DURATION_FACTOR: 40, // default: 30 (más reducción por velocidad)
  },
  
  PREFETCH_CONFIG: {
    ...defaultConfig.PREFETCH_CONFIG,
    // Prefetch más agresivo (más consumo de datos, pero más rápido)
    PREFETCH_AHEAD_COUNT: 6, // default: 4
    THUMBNAIL_PREFETCH_AHEAD: 12, // default: 8
  },
  
  VIDEO_CONFIG: {
    ...defaultConfig.VIDEO_CONFIG,
    // Más videos simultáneos (gama alta puede manejarlo)
    MAX_VIDEO_TAG_DISTANCE: 3, // default: 2
  },
  
  // ───────────────────────────────────────────────────────────────────────────
  // EJEMPLO 2: Configuración para ahorro de datos
  // ───────────────────────────────────────────────────────────────────────────
  /*
  SCROLL_CONFIG: {
    ...defaultConfig.SCROLL_CONFIG,
    // Scroll normal
  },
  
  PREFETCH_CONFIG: {
    ...defaultConfig.PREFETCH_CONFIG,
    // Prefetch mínimo
    PREFETCH_AHEAD_COUNT: 1, // default: 4
    THUMBNAIL_PREFETCH_AHEAD: 3, // default: 8
    MAX_VIDEO_PREFETCH_BYTES: 10 * 1024 * 1024, // default: 25MB
  },
  
  VIDEO_CONFIG: {
    ...defaultConfig.VIDEO_CONFIG,
    // Solo video activo
    MAX_VIDEO_TAG_DISTANCE: 0, // default: 2
  },
  
  NETWORK_CONFIG: {
    ...defaultConfig.NETWORK_CONFIG,
    // Deshabilitar prefetch en 3G también
    DISABLE_PREFETCH_3G: true,
  },
  */
  
  // ───────────────────────────────────────────────────────────────────────────
  // EJEMPLO 3: Configuración para gama baja
  // ───────────────────────────────────────────────────────────────────────────
  /*
  SCROLL_CONFIG: {
    ...defaultConfig.SCROLL_CONFIG,
    // Scroll menos sensible para evitar activaciones accidentales
    FAST_SCROLL_VELOCITY_THRESHOLD: 1.5, // default: 1.0
  },
  
  TRANSITION_CONFIG: {
    ...defaultConfig.TRANSITION_CONFIG,
    // Transiciones más lentas para dar sensación de estabilidad
    MIN_TRANSITION_DURATION_MS: 200, // default: 180
    MAX_TRANSITION_DURATION_MS: 400, // default: 320
  },
  
  VIDEO_CONFIG: {
    ...defaultConfig.VIDEO_CONFIG,
    // Mínimo de videos simultáneos
    MAX_VIDEO_TAG_DISTANCE: 1, // default: 2
    MAX_VIDEO_TAG_DISTANCE_VS: 0, // default: 1
  },
  
  SKELETON_CONFIG: {
    ...defaultConfig.SKELETON_CONFIG,
    // Skeleton por más tiempo para evitar flashes
    MIN_SKELETON_DISPLAY_MS: 500, // default: 300
  },
  */
  
  // ───────────────────────────────────────────────────────────────────────────
  // EJEMPLO 4: Configuración para debugging
  // ───────────────────────────────────────────────────────────────────────────
  /*
  DEBUG_CONFIG: {
    ...defaultConfig.DEBUG_CONFIG,
    // Habilitar todos los logs
    LOG_PREFETCH_CANCELS: true,
    LOG_SWIPE_VELOCITY: true,
    LOG_DECODER_STATS: true,
  },
  */
};

// Exportar configuración fusionada
const config = {
  ...defaultConfig,
  ...customConfig,
  SCROLL_CONFIG: { ...defaultConfig.SCROLL_CONFIG, ...customConfig.SCROLL_CONFIG },
  TRANSITION_CONFIG: { ...defaultConfig.TRANSITION_CONFIG, ...customConfig.TRANSITION_CONFIG },
  PREFETCH_CONFIG: { ...defaultConfig.PREFETCH_CONFIG, ...customConfig.PREFETCH_CONFIG },
  VIDEO_CONFIG: { ...defaultConfig.VIDEO_CONFIG, ...customConfig.VIDEO_CONFIG },
  RENDER_WINDOW_CONFIG: { ...defaultConfig.RENDER_WINDOW_CONFIG, ...customConfig.RENDER_WINDOW_CONFIG },
  SKELETON_CONFIG: { ...defaultConfig.SKELETON_CONFIG, ...customConfig.SKELETON_CONFIG },
  GPU_CONFIG: { ...defaultConfig.GPU_CONFIG, ...customConfig.GPU_CONFIG },
  NETWORK_CONFIG: { ...defaultConfig.NETWORK_CONFIG, ...customConfig.NETWORK_CONFIG },
  DEBUG_CONFIG: { ...defaultConfig.DEBUG_CONFIG, ...customConfig.DEBUG_CONFIG },
};

export default config;

// ───────────────────────────────────────────────────────────────────────────
// GUÍA RÁPIDA DE AJUSTES
// ───────────────────────────────────────────────────────────────────────────

/*
PROBLEMA: Scroll demasiado sensible
SOLUCIÓN: Aumentar FAST_SCROLL_VELOCITY_THRESHOLD a 1.2 o 1.5

PROBLEMA: Videos se congelan en gama baja
SOLUCIÓN: Reducir MAX_VIDEO_TAG_DISTANCE a 1 o 0

PROBLEMA: Alto consumo de datos
SOLUCIÓN: Reducir PREFETCH_AHEAD_COUNT a 2 o 1

PROBLEMA: Skeleton parpadea
SOLUCIÓN: Aumentar MIN_SKELETON_DISPLAY_MS a 500

PROBLEMA: Transiciones muy lentas
SOLUCIÓN: Reducir MIN_TRANSITION_DURATION_MS a 150

PROBLEMA: Transiciones muy rápidas
SOLUCIÓN: Aumentar MIN_TRANSITION_DURATION_MS a 200

PROBLEMA: Demasiados logs en consola
SOLUCIÓN: Habilitar DEBUG_CONFIG.* solo en desarrollo
*/