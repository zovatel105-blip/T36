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
    
    // Preconnect para HLS streaming (si usa dominio separado)
    const hlsOrigin = 'https://manifest.googlevideo.com';
    const hlsLink = document.createElement('link');
    hlsLink.rel = 'preconnect';
    hlsLink.href = hls_origin;
    document.head.appendChild(hlsLink);
    cleanups.push(() => document.head.removeChild(hlsLink));

    // 2. Forzar will-change optimizado en el contenedor del feed
    if (containerRef?.current) {
      const container = containerRef.current;
      container.style.willChange = 'transform';
      container.style.contain = 'paint layout';
      container.style.transform = 'translateZ(0)';
      container.style.backfaceVisibility = 'hidden';
      cleanups.push(() => {
        if (containerRef.current) {
          containerRef.current.style.willChange = 'auto';
          containerRef.current.style.contain = '';
          containerRef.current.style.transform = '';
          containerRef.current.style.backfaceVisibility = '';
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
        .snaptok-swiper .swiper-wrapper {
          transition-timing-function: cubic-bezier(0.25, 0.1, 0.25, 1);
          will-change: transform;
        }
        .snaptok-swiper .swiper-slide {
          backface-visibility: hidden;
          transform: translateZ(0);
          will-change: contents, transform;
        }
      `;
      document.head.appendChild(style);
      cleanups.push(() => {
        const el = document.getElementById('ultra-smooth-feed-force');
        if (el) document.head.removeChild(el);
      });
    } catch (_) {}

    // 4. Optimización de GPU: forzar composición por capa
    try {
      const gpuStyle = document.createElement('style');
      gpuStyle.id = 'gpu-composition';
      gpuStyle.textContent = `
        .snaptok-swiper,
        .snaptok-swiper * {
          transform: translateZ(0);
          -webkit-transform: translateZ(0);
        }
      `;
      document.head.appendChild(gpuStyle);
      cleanups.push(() => {
        const el = document.getElementById('gpu-composition');
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
