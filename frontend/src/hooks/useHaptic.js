/**
 * useHaptic - Feedback háptico para dispositivos móviles
 * 
 * Proporciona vibración táctil al interactuar con la UI (like, vote, share, etc.)
 * para una sensación "premium" tipo app nativa.
 * 
 * Uso:
 *   const { vibrate } = useHaptic();
 *   vibrate('light'); // Al hacer like
 *   vibrate('medium'); // Al votar
 *   vibrate('success'); // Al completar una acción exitosa
 * 
 * Soporte:
 *   - Android: ✅ (vía Navigator.vibrate)
 *   - iOS: ❌ (Safari no soporta Navigator.vibrate)
 *   - Desktop: ❌ (sin motor de vibración)
 * 
 * Patrones de vibración:
 *   - light: [10ms] - Feedback sutil para likes
 *   - medium: [20ms] - Feedback moderado para votos
 *   - heavy: [30ms] - Feedback fuerte para shares
 *   - success: [10, 50, 10] - Doble vibración para éxito
 *   - error: [20, 50, 20] - Vibración de error
 */

import { useCallback } from 'react';

export const useHaptic = () => {
  const vibrate = useCallback((pattern = 'light') => {
    // Verificar soporte del API
    if (typeof navigator?.vibrate !== 'function') {
      return; // No soportado (iOS, desktop)
    }
    
    // Patrones de vibración predefinidos
    const patterns = {
      light: [10],           // Like - feedback sutil
      medium: [20],          // Vote - feedback moderado
      heavy: [30],           // Share - feedback fuerte
      success: [10, 50, 10], // Doble vibración - éxito
      error: [20, 50, 20],   // Vibración de error
      warning: [15, 30, 15], // Advertencia
      scroll: [5],           // Fast-scroll - muy sutil
    };
    
    // Ejecutar vibración
    try {
      navigator.vibrate(patterns[pattern] || patterns.light);
    } catch (error) {
      // Ignorar errores (puede fallar en algunos browsers)
      console.warn('Haptic feedback failed:', error);
    }
  }, []);
  
  return { vibrate };
};

export default useHaptic;