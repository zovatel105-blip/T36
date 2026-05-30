/**
 * useNetworkStatus
 *
 * Hook unificado para saber si la app está online/offline en web + Capacitor.
 *
 * En Capacitor (APK) usa `@capacitor/network` que se basa en la API nativa
 * del SO (ConnectivityManager en Android, Reachability en iOS). En web cae
 * al `navigator.onLine` + eventos `online`/`offline` del navegador.
 *
 * Devuelve:
 *   {
 *     isOnline: boolean,
 *     connectionType: 'wifi' | 'cellular' | 'ethernet' | 'none' | 'unknown',
 *     isMetered: boolean          // true cuando parece red móvil (cellular)
 *                                 // útil para no prefetchar videos pesados.
 *   }
 */
import { useEffect, useState, useCallback } from 'react';

const isCapacitorAvailable = () => {
  try {
    // eslint-disable-next-line no-undef
    return !!(window?.Capacitor?.isNativePlatform?.());
  } catch {
    return false;
  }
};

const normalizeType = (t) => {
  if (!t || typeof t !== 'string') return 'unknown';
  const lowered = t.toLowerCase();
  if (['wifi', 'cellular', 'ethernet', 'none'].includes(lowered)) return lowered;
  if (lowered.includes('4g') || lowered.includes('3g') || lowered.includes('5g')) return 'cellular';
  return 'unknown';
};

const readNavConn = () => {
  if (typeof navigator === 'undefined') return {};
  const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (!c) return {};
  return {
    effectiveType: c.effectiveType,
    saveData: !!c.saveData,
    downlink: typeof c.downlink === 'number' ? c.downlink : null,
  };
};

export const useNetworkStatus = () => {
  const [state, setState] = useState(() => {
    const initialOnline =
      typeof navigator !== 'undefined' ? navigator.onLine !== false : true;
    const nc = readNavConn();
    return {
      isOnline: initialOnline,
      connectionType: 'unknown',
      isMetered: false,
      effectiveType: nc.effectiveType || 'unknown',
      saveData: nc.saveData || false,
      downlink: nc.downlink,
      isSlowConnection: nc.effectiveType === 'slow-2g' || nc.effectiveType === '2g' || nc.effectiveType === '3g' || nc.saveData,
    };
  });

  const update = useCallback((status, navOverride) => {
    const connectionType = normalizeType(status?.connectionType);
    const nc = navOverride || readNavConn();
    const et = nc.effectiveType || 'unknown';
    setState({
      isOnline: !!status?.connected,
      connectionType,
      isMetered: connectionType === 'cellular',
      effectiveType: et,
      saveData: nc.saveData || false,
      downlink: nc.downlink,
      isSlowConnection: et === 'slow-2g' || et === '2g' || et === '3g' || !!nc.saveData,
    });
  }, []);

  useEffect(() => {
    let listenerHandle = null;
    let navListener = null;
    let cancelled = false;

    const refreshNavConn = () => {
      if (!cancelled) {
        const nc = readNavConn();
        setState(prev => ({
          ...prev,
          effectiveType: nc.effectiveType || 'unknown',
          saveData: nc.saveData || false,
          downlink: nc.downlink,
          isSlowConnection: nc.effectiveType === 'slow-2g' || nc.effectiveType === '2g' || nc.effectiveType === '3g' || !!nc.saveData,
        }));
      }
    };

    const init = async () => {
      // Escuchar cambios de navigator.connection (effectiveType, saveData)
      const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      if (c && typeof c.addEventListener === 'function') {
        navListener = () => refreshNavConn();
        c.addEventListener('change', navListener);
      }

      if (isCapacitorAvailable()) {
        try {
          const { Network } = await import('@capacitor/network');
          const initial = await Network.getStatus();
          if (!cancelled) update(initial);
          listenerHandle = await Network.addListener(
            'networkStatusChange',
            (status) => {
              if (!cancelled) update(status);
            }
          );
        } catch (err) {
          console.warn('[useNetworkStatus] Capacitor Network init failed:', err?.message);
          attachWebListeners();
        }
      } else {
        attachWebListeners();
      }
    };

    const onOnline = () =>
      !cancelled && update({ connected: true, connectionType: 'unknown' });
    const onOffline = () =>
      !cancelled && update({ connected: false, connectionType: 'none' });

    const attachWebListeners = () => {
      window.addEventListener('online', onOnline);
      window.addEventListener('offline', onOffline);
      update({
        connected: navigator.onLine !== false,
        connectionType: 'unknown',
      });
    };

    init();

    return () => {
      cancelled = true;
      try {
        listenerHandle?.remove?.();
      } catch { /* noop */ }
      if (navListener) {
        const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        if (c && typeof c.removeEventListener === 'function') c.removeEventListener('change', navListener);
      }
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [update]);

  return state;
};

export default useNetworkStatus;
