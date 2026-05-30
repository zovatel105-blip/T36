import { useEffect, useRef } from 'react';

const useUltraSmoothFeed = ({ enabled = true, containerRef }) => {
  const cleanupRef = useRef([]);

  useEffect(() => {
    if (!enabled) return;

    const cleanups = [];

    // 1. Preconnect a CDN/media origins desde <link> hints
    const origin = process.env.REACT_APP_BACKEND_URL || window.location.origin;
    if (origin && origin !== window.location.origin) {
      const link = document.createElement('link');
      link.rel = 'preconnect';
      link.href = origin;
      link.crossOrigin = 'anonymous';
      document.head.appendChild(link);
      cleanups.push(() => document.head.removeChild(link));
    }

    // 2. Forzar will-change optimizado en el contenedor del feed
    if (containerRef?.current) {
      containerRef.current.style.willChange = 'transform';
      containerRef.current.style.contain = 'paint';
      cleanups.push(() => {
        if (containerRef.current) {
          containerRef.current.style.willChange = 'auto';
          containerRef.current.style.contain = '';
        }
      });
    }

    // 3. Deshabilitar el debouncing del scroll nativo en webview
    try {
      const style = document.createElement('style');
      style.id = 'ultra-smooth-feed-force';
      style.textContent = `
        * { -webkit-overflow-scrolling: touch; }
        .snaptok-swiper {
          -webkit-overflow-scrolling: auto !important;
          overflow-scrolling: auto !important;
        }
      `;
      document.head.appendChild(style);
      cleanups.push(() => {
        const el = document.getElementById('ultra-smooth-feed-force');
        if (el) document.head.removeChild(el);
      });
    } catch (_) {}

    cleanupRef.current = cleanups;

    return () => {
      cleanups.forEach(fn => { try { fn(); } catch (_) {} });
      cleanupRef.current = [];
    };
  }, [enabled, containerRef]);
};

export default useUltraSmoothFeed;
