/**
 * VSFeedSwiper — contenedor Swiper.js vertical para el Feed V2.
 *
 * Configuración alineada con la referencia VT3 (replicada exactamente):
 *   - Virtual: addSlidesBefore=1, addSlidesAfter=2, cache=true.
 *   - Resistance OFF (sin rebote en iOS), threshold=5.
 *   - longSwipesRatio=0.4 (más sensible para flick TikTok-style).
 *   - mousewheel.thresholdDelta=20 (evita over-scroll con trackpad).
 *   - keyboard.onlyInViewport=true.
 *
 * Pasa al slide:
 *   - `isActive`: slide visible → monta video + UI completa.
 *   - `isNear`:   slide adyacente (±1) → preload poster + 256KB del video.
 *   - `muted`:    estado global de audio (toggle desde TopBar).
 */
import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Virtual, Mousewheel, Keyboard } from 'swiper/modules';
import VSSlideV2 from './VSSlideV2';
import feedMediaPrefetcher from '../../services/feedMediaPrefetcher';
import useUltraSmoothFeed from '../../hooks/useUltraSmoothFeed';
import { setFastScrolling } from '../../utils/scrollVelocityTracker';
import 'swiper/css';
import 'swiper/css/virtual';

// Ventana de renderizado de CONTENIDO (asimétrica, ponderada hacia la dirección
// del scroll). Solo los slides dentro de [-BEHIND, +AHEAD] del activo montan el
// árbol pesado (TikTokPollCard); el resto = placeholder negro. Así evitamos que
// al paginar 40+ posts haya decenas de tarjetas pesadas montadas a la vez.
const WINDOW_BEHIND = 1; // slides montados hacia atrás
const WINDOW_AHEAD = 4;  // slides montados hacia adelante (más buffer para TikTok-style)

// TikTok-style snap timing: reducción progresiva de duración según velocidad
const MIN_TRANSITION_DURATION = 180; // ms mínimo para swipes rápidos
const MAX_TRANSITION_DURATION = 320; // ms máximo para swipes lentos

export default function VSFeedSwiper({
  polls,
  initialIndex = 0,
  muted = true,
  onActiveIndexChange,
  onReachEnd,
  hasMore = false,
  isLoadingMore = false,
  renderSlide,
}) {
  const swiperRef = useRef(null);
  const containerRef = useRef(null);
  const lastSwipeVelocity = useRef(0);
  const lastSwipeTime = useRef(0);
  useUltraSmoothFeed({ enabled: true, containerRef });
  const [activeIndex, setActiveIndex] = useState(initialIndex);

  // TikTok-style: transición dinámica según velocidad del swipe
  const updateTransitionDuration = useCallback((swiper, velocity) => {
    if (!swiper || !swiper.params) return;
    const absVelocity = Math.abs(velocity);
    // Calcular duración inversamente proporcional a la velocidad
    const duration = Math.max(
      MIN_TRANSITION_DURATION,
      Math.min(
        MAX_TRANSITION_DURATION,
        MAX_TRANSITION_DURATION - (absVelocity * 30)
      )
    );
    swiper.params.speed = duration;
    if (swiper.wrapperEl) {
      swiper.wrapperEl.style.transitionDuration = `${duration}ms`;
    }
  }, []);

  const handleSlideChange = useCallback((swiper) => {
    const idx = swiper.activeIndex;
    setActiveIndex(idx);
    onActiveIndexChange?.(idx);

    // TikTok-style: actualizar duración de transición basado en velocidad
    const now = Date.now();
    const timeDiff = now - lastSwipeTime.current;
    if (timeDiff > 0 && timeDiff < 500) {
      const velocity = lastSwipeVelocity.current;
      updateTransitionDuration(swiper, velocity);
    }

    // Trigger load-more anticipado: cuando quedan 5 slides para el final, para
    // que la siguiente página ya esté cargada antes de llegar (sin esperas).
    if (hasMore && !isLoadingMore && idx >= polls.length - 5) {
      onReachEnd?.();
    }
  }, [polls.length, onReachEnd, onActiveIndexChange, hasMore, isLoadingMore, updateTransitionDuration]);

  // TikTok-style: capturar velocidad del swipe para ajustar transición
  const handleTouchEnd = useCallback((swiper, event) => {
    const now = Date.now();
    lastSwipeTime.current = now;
    
    // Calcular velocidad basada en el movimiento del touch
    if (event?.changedTouches?.length > 0) {
      const touch = event.changedTouches[0];
      const velocity = Math.abs(touch.velocityY || (touch.clientY - touch.startY) / (now - swiper.touchEventsData?.touchStartTime || 1));
      lastSwipeVelocity.current = velocity;
      
      // Notificar scroll velocity tracker para fast-scroll detection
      if (velocity > 1.2) {
        setFastScrolling(true);
      }
    }
  }, []);

  // Eager prefetch del slide +1 al iniciar swipe (touchstart). Import estático
  // → sin coste de promesa/resolución de módulo en cada toque.
  const handleTouchStart = useCallback((swiper) => {
    const next = swiper.activeIndex + 1;
    if (next >= polls.length) return;
    try {
      feedMediaPrefetcher?.prefetchVideosAroundIndex?.(polls, next, 0);
    } catch (_) {}
    
    // Marcar inicio de swipe para velocity tracking
    lastSwipeTime.current = Date.now();
    lastSwipeVelocity.current = 0;
  }, [polls]);

  useEffect(() => {
    if (swiperRef.current && swiperRef.current.activeIndex !== initialIndex) {
      swiperRef.current.slideTo(initialIndex, 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialIndex]);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 bg-black"
      style={{
        height: '100dvh',
        width: '100vw',
        overflow: 'hidden',
        contain: 'paint',
      }}
      data-testid="vs-feed-swiper-container"
    >
      <Swiper
        modules={[Virtual, Mousewheel, Keyboard]}
        direction="vertical"
        slidesPerView={1}
        spaceBetween={0}
        speed={MAX_TRANSITION_DURATION}
        resistance={false}
        resistanceRatio={0}
        touchRatio={1}
        followFinger
        threshold={3}
        shortSwipes
        longSwipes
        longSwipesRatio={0.35}
        longSwipesMs={250}
        observer
        observeParents
        virtual={{
          enabled: true,
          addSlidesBefore: 1,
          addSlidesAfter: 4,
          cache: true,
        }}
        mousewheel={{
          forceToAxis: true,
          sensitivity: 1.2,
          releaseOnEdges: false,
          thresholdDelta: 15,
          invert: true,
        }}
        keyboard={{ enabled: true, onlyInViewport: true }}
        initialSlide={initialIndex}
        onSwiper={(s) => { swiperRef.current = s; }}
        onSlideChange={handleSlideChange}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="snaptok-swiper"
        style={{
          height: '100%',
          width: '100%',
          transform: 'translateZ(0)',
          willChange: 'transform',
        }}
        data-testid="vs-feed-swiper"
      >
        {polls.map((poll, idx) => {
          const delta = idx - activeIndex;
          const distance = Math.abs(delta);
          const isActive = delta === 0;
          const withinWindow = delta >= -WINDOW_BEHIND && delta <= WINDOW_AHEAD;
          return (
            <SwiperSlide
              key={poll.id || idx}
              virtualIndex={idx}
              style={{
                height: '100dvh',
                contain: 'layout style paint',
                contentVisibility: isActive ? 'visible' : 'auto',
                transform: 'translateZ(0)',
                backfaceVisibility: 'hidden',
                willChange: isActive ? 'transform, opacity' : 'auto',
              }}
            >
              {!withinWindow ? (
                <div className="w-full h-full bg-black" data-testid="vs-slide-placeholder" />
              ) : renderSlide ? (
                renderSlide(poll, {
                  isActive,
                  distanceFromActive: distance,
                  index: idx,
                })
              ) : (
                <VSSlideV2
                  poll={poll}
                  isActive={isActive}
                  isNear={distance <= 1}
                  muted={muted}
                />
              )}
            </SwiperSlide>
          );
        })}
      </Swiper>
      <style>{`
        .snaptok-swiper .swiper-slide {
          contain: layout style paint;
          content-visibility: auto;
          transform: translateZ(0);
          backface-visibility: hidden;
          will-change: transform;
        }
        .snaptok-swiper .swiper-slide-active,
        .snaptok-swiper .swiper-slide-visible {
          content-visibility: visible;
          will-change: transform, opacity;
        }
        .snaptok-swiper .swiper-wrapper {
          transition-timing-function: cubic-bezier(0.25, 0.1, 0.25, 1);
        }
      `}</style>
    </div>
  );
}
