/**
 * TikTokStyleVideo - Carga INSTANTÁNEA como TikTok Web
 * 
 * ESTRATEGIA TIKTOK:
 * 1. Mostrar thumbnail IMAGACTAMENTE (siempre visible, nunca negro)
 * 2. Video carga en segundo plano (invisible)
 * 3. Crossfade imperceptible cuando el video está listo (100ms)
 * 4. Si el video falla, mantener thumbnail para siempre
 * 
 * Diferencias vs PollOptionMedia:
 * - PollOptionMedia: espera a que el video cargue → pantalla negra
 * - TikTokStyleVideo: thumbnail siempre visible → carga instantánea
 */

import React, { useState, useEffect, useRef } from 'react';
import { pickPlayableVideoUrl, pickVideoPosterUrl } from '../../utils/mediaUrl';
import resolveAssetUrl from '../../utils/resolveAssetUrl';
import { cn } from '../../lib/utils';

// Thumbnail por defecto (gradiente SVG inline, <1KB)
const DEFAULT_THUMBNAIL = 
  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNzIwIiBoZWlnaHQ9IjEyODAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PGxpbmVhckdyYWRpZW50IGlkPSJnIiB4MT0iMCUiIHkxPSIwJSIgeDI9IjEwMCUiIHkyPSIxMDAlIj48c3RvcCBvZmZzZXQ9IjAlIiBzdHlsZT0ic3RvcC1jb2xvcjojMmQwMDM4O3N0b3Atb3BhY2l0eToxIiAvPjxzdG9wIG9mZnNldD0iNTAlIiBzdHlsZT0ic3RvcC1jb2xvcjojMWYwMDI4O3N0b3Atb3BhY2l0eToxIiAvPjxzdG9wIG9mZnNldD0iMTAwJSIgc3R5bGU9InN0b3AtY29sb3I6IzBmMDAxNTtzdG9wLW9wYWNpdHk6MSIgLz48L2xpbmVhckdyYWRpZW50PjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2cpIi8+PC9zdmc+';

const TikTokStyleVideo = ({
  option,
  className,
  style,
  isActive = false,
  distanceFromActive = 0,
  muted = true,
  loop = true,
  preload = true,
}) => {
  const videoRef = useRef(null);
  const imageRef = useRef(null);
  
  // Estados
  const [thumbnailLoaded, setThumbnailLoaded] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [error, setError] = useState(false);
  
  // URLs
  const videoUrl = pickPlayableVideoUrl(option);
  const posterUrl = pickVideoPosterUrl(option) || DEFAULT_THUMBNAIL;
  
  // 🚀 PRELOAD AGRESIVO - Empezar a cargar el video INMEDIATAMENTE
  useEffect(() => {
    if (!videoUrl || distanceFromActive > 3) return;
    
    // Crear elemento de video invisible para precargar
    const preloadVideo = document.createElement('video');
    preloadVideo.preload = 'auto';
    preloadVideo.src = videoUrl;
    preloadVideo.muted = true;
    preloadVideo.playsInline = true;
    preloadVideo.style.display = 'none';
    
    // Escuchar eventos
    const onCanPlay = () => {
      setVideoReady(true);
      document.body.removeChild(preloadVideo);
    };
    
    const onError = () => {
      setError(true);
      if (preloadVideo.parentNode) {
        document.body.removeChild(preloadVideo);
      }
    };
    
    preloadVideo.addEventListener('canplay', onCanPlay, { once: true });
    preloadVideo.addEventListener('error', onError, { once: true });
    
    // Agregar al DOM para que empiece a cargar
    document.body.appendChild(preloadVideo);
    preloadVideo.load();
    
    // Cleanup
    return () => {
      preloadVideo.removeEventListener('canplay', onCanPlay);
      preloadVideo.removeEventListener('error', onError);
      if (preloadVideo.parentNode) {
        document.body.removeChild(preloadVideo);
      }
    };
  }, [videoUrl, distanceFromActive]);
  
  // 🎬 PLAY/PAUSE basado en isActive
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoReady) return;
    
    if (isActive && video.paused) {
      video.play().catch(() => {});
    } else if (!isActive && !video.paused) {
      video.pause();
    }
  }, [isActive, videoReady]);
  
  // Handlers de carga
  const handleThumbnailLoad = () => {
    setThumbnailLoaded(true);
  };
  
  const handleVideoCanPlay = () => {
    setVideoReady(true);
  };
  
  const handleVideoError = () => {
    setError(true);
    setVideoReady(false);
  };
  
  // Si no es video o no hay URL, mostrar imagen o placeholder
  if (!videoUrl) {
    const imageUrl = resolveAssetUrl(
      option?.media?.url ||
      option?.media_url ||
      option?.image
    );
    
    if (!imageUrl) {
      return (
        <div 
          className={cn('w-full h-full bg-gradient-to-br from-purple-900 via-pink-900 to-blue-900', className)}
          style={style}
        />
      );
    }
    
    return (
      <img
        ref={imageRef}
        src={imageUrl}
        alt=""
        className={cn('w-full h-full object-cover', className)}
        style={style}
        loading="eager"
        fetchPriority="high"
      />
    );
  }
  
  // 🎯 RENDER TIKTOK-STYLE:
  // 1. Thumbnail SIEMPRE visible (nunca se oculta)
  // 2. Video invisible encima (opacity: 0 hasta que está ready)
  // 3. Crossfade suave cuando el video está listo
  return (
    <div
      className={cn('relative w-full h-full overflow-hidden', className)}
      style={style}
    >
      {/* 🖼️ THUMBNAIL - Siempre visible, carga instantánea */}
      <img
        ref={imageRef}
        src={posterUrl}
        alt=""
        className={cn(
          'absolute inset-0 w-full h-full object-cover transition-opacity duration-300',
          videoReady && !error ? 'opacity-0' : 'opacity-100'
        )}
        loading="eager"
        fetchPriority="high"
        onLoad={handleThumbnailLoad}
        onError={() => setError(true)}
        draggable={false}
      />
      
      {/* 🎬 VIDEO - Invisible hasta que está ready */}
      <video
        ref={videoRef}
        src={videoUrl}
        className={cn(
          'absolute inset-0 w-full h-full object-cover transition-opacity duration-100',
          videoReady && !error ? 'opacity-100' : 'opacity-0'
        )}
        muted={muted}
        loop={loop}
        playsInline
        preload={preload ? 'auto' : 'metadata'}
        onCanPlay={handleVideoCanPlay}
        onError={handleVideoError}
        style={{ 
          transform: 'translateZ(0)',
          backfaceVisibility: 'hidden',
        }}
      />
      
      {/* ⚠️ ERROR STATE - Mantener thumbnail si el video falla */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
          <div className="text-white/50 text-sm">Video no disponible</div>
        </div>
      )}
    </div>
  );
};

export default TikTokStyleVideo;