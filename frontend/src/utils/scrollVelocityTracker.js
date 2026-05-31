/**
 * scrollVelocityTracker — pub/sub singleton para velocidad del scroll del feed.
 *
 * Por qué existe:
 *   Cuando el usuario hace fast-scroll (varios swipes seguidos), no tiene
 *   sentido que los slots PREV/NEXT carguen HLS (manifest + primer segmento).
 *   El usuario ni siquiera va a ver ese contenido — los slots rotarán
 *   antes de que termine la descarga, y la bandwidth se desperdicia.
 *
 *   TikTok hace exactamente esto: durante fast-scroll, suspende el preload
 *   de los slots vecinos. Solo lo reactiva cuando el scroll se ha estabilizado
 *   (settled) por al menos ~200ms.
 *
 * API:
 *   - setFastScrolling(boolean) — llamado por TikTokScrollView cuando detecta
 *     velocidad alta o múltiples swipes en cascada.
 *   - isFastScrolling() — síncrono, lo usan PollOptionMedia/HlsVideo para
 *     decidir si cargar HLS en slots no-activos.
 *   - subscribe(callback) — escucha cambios; PollOptionMedia se suscribe para
 *     reaccionar (descargar HLS cuando se suelta el fast-scroll).
 *   - recordSwipe(velocity) — registra un swipe con su velocidad para
 *     detección automática de fast-scroll.
 *
 * Threshold:
 *   Considerado fast cuando velocity > 1.0 px/ms (reducido de 1.2 para mayor
 *   sensibilidad) O cuando hay 3+ swipes en 800ms (detección de cascada).
 *   Suelto tras 200ms de idle (reducido de 250ms para respuesta más rápida).
 */
import { useEffect, useState } from 'react';

const STATE = {
  fastScrolling: false,
  // setTimeout id para auto-soltar el flag tras inactividad
  releaseTimer: null,
  listeners: new Set(),
  // Detección de cascada de swipes
  swipeHistory: [], // [{time, velocity}]
  SWIPE_WINDOW_MS: 800, // ventana para contar swipes
  SWIPE_COUNT_THRESHOLD: 3, // swipes para considerar cascada
  VELOCITY_THRESHOLD: 1.0, // px/ms (reducido para más sensibilidad)
};

const RELEASE_DELAY_MS = 200; // reducido para respuesta más rápida

const emit = () => {
  STATE.listeners.forEach((cb) => {
    try { cb(STATE.fastScrolling); } catch (_) { /* swallow */ }
  });
};

// Limpieza de historial de swipes antiguos
const cleanupSwipeHistory = () => {
  const now = Date.now();
  STATE.swipeHistory = STATE.swipeHistory.filter(
    (swipe) => now - swipe.time < STATE.SWIPE_WINDOW_MS
  );
};

// Detección de fast-scroll por cascada de swipes
const detectSwipeCascade = () => {
  cleanupSwipeHistory();
  return STATE.swipeHistory.length >= STATE.SWIPE_COUNT_THRESHOLD;
};

export const setFastScrolling = (value) => {
  const next = !!value;

  if (next) {
    // Marcar fast; renovar el timer de auto-release.
    if (STATE.releaseTimer) {
      clearTimeout(STATE.releaseTimer);
      STATE.releaseTimer = null;
    }
    if (STATE.fastScrolling !== true) {
      STATE.fastScrolling = true;
      emit();
    }
  } else {
    // Pedir release diferido (no liberamos inmediatamente para evitar
    // flickering si el usuario hace swipes en cascada con micro-pausas).
    if (STATE.releaseTimer) clearTimeout(STATE.releaseTimer);
    STATE.releaseTimer = setTimeout(() => {
      STATE.releaseTimer = null;
      if (STATE.fastScrolling !== false) {
        STATE.fastScrolling = false;
        emit();
      }
    }, RELEASE_DELAY_MS);
  }
};

// Registrar un swipe con velocidad para detección automática de cascada
export const recordSwipe = (velocity) => {
  if (typeof velocity !== 'number' || velocity <= 0) return;
  
  const now = Date.now();
  cleanupSwipeHistory();
  STATE.swipeHistory.push({ time: now, velocity });
  
  // Detectar fast-scroll por velocidad alta O por cascada
  const isHighVelocity = velocity > STATE.VELOCITY_THRESHOLD;
  const isCascade = detectSwipeCascade();
  
  if (isHighVelocity || isCascade) {
    setFastScrolling(true);
  }
};

export const isFastScrolling = () => STATE.fastScrolling;

export const subscribeFastScrolling = (callback) => {
  if (typeof callback !== 'function') return () => {};
  STATE.listeners.add(callback);
  return () => {
    STATE.listeners.delete(callback);
  };
};

// Exportar funciones de utilidad para debug
export const getSwipeHistory = () => STATE.swipeHistory;
export const clearSwipeHistory = () => { STATE.swipeHistory = []; };

// React hook conveniente
export const useFastScrolling = () => {
  const [val, setVal] = useState(STATE.fastScrolling);
  useEffect(() => {
    const unsub = subscribeFastScrolling((v) => setVal(v));
    return unsub;
  }, []);
  return val;
};
