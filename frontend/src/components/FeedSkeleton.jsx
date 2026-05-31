/**
 * FeedSkeleton — carga instantánea tipo TikTok mientras llegan los datos reales.
 * 
 * Muestra placeholders animados que ocupan el mismo espacio que el contenido real,
 * evitando layout shift y dando feedback visual inmediato al usuario.
 * 
 * Optimizaciones:
 *   - Usa 100dvh para altura completa sin shifts
 *   - Gradientes animados tipo "shimmer" para sensación de carga rápida
 *   - Mismo layout que TikTokPollCard (header, contenido, actions)
 *   - Skeleton múltiple (3 slides) para pre-cargar la sensación de scroll
 */
import React from 'react';
import { cn } from '../lib/utils';

const SkeletonAvatar = () => (
  <div className="w-12 h-12 rounded-full bg-white/10 animate-pulse flex-shrink-0" />
);

const SkeletonText = ({ width = 'w-32', lines = 1 }) => (
  <div className="flex flex-col gap-2">
    {Array.from({ length: lines }).map((_, i) => (
      <div
        key={i}
        className={cn(
          'h-3 rounded bg-white/10 animate-pulse',
          width,
          i === lines - 1 && 'w-2/3'
        )}
      />
    ))}
  </div>
);

const SkeletonAction = () => (
  <div className="flex flex-col items-center gap-1">
    <div className="w-8 h-8 rounded-full bg-white/10 animate-pulse" />
    <div className="w-6 h-2 rounded bg-white/5 animate-pulse" />
  </div>
);

const SkeletonSlide = ({ index = 0 }) => {
  const isTop = index === 0;
  
  return (
    <div
      className="absolute inset-0 w-full h-full bg-black overflow-hidden"
      style={{ height: '100dvh', contain: 'strict' }}
      data-testid={`feed-skeleton-slide-${index}`}
    >
      {/* Background gradiente animado */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(
            ${180 + index * 15}deg,
            #1a1a2e 0%,
            #16213e 50%,
            #0f3460 100%
          )`,
          animation: `gradientShift ${3 + index * 0.5}s ease infinite`,
        }}
      />
      
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 flex items-center gap-3 px-4 z-10"
           style={{ paddingTop: 'max(1rem, env(safe-area-inset-top, 8px))' }}>
        <SkeletonAvatar />
        <div className="flex-1">
          <SkeletonText width="w-40" lines={1} />
          <div className="mt-1">
            <SkeletonText width="w-24" lines={1} />
          </div>
        </div>
      </div>
      
      {/* Contenido central placeholder */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="w-64 h-64 rounded-2xl bg-white/5 animate-pulse"
          style={{
            animationDelay: `${index * 0.2}s`,
            animationDuration: '1.5s',
          }}
        />
      </div>
      
      {/* Barra lateral de acciones (derecha) */}
      <div className="absolute right-3 bottom-32 flex flex-col gap-4 z-10">
        <SkeletonAction />
        <SkeletonAction />
        <SkeletonAction />
        <SkeletonAction />
      </div>
      
      {/* Footer con info de audio */}
      <div className="absolute bottom-0 left-0 right-0 px-4 pb-8 flex items-center gap-3 z-10">
        <div className="w-10 h-10 rounded-full bg-white/10 animate-pulse flex-shrink-0" />
        <div className="flex-1">
          <SkeletonText width="w-48" lines={1} />
          <div className="mt-1">
            <SkeletonText width="w-32" lines={1} />
          </div>
        </div>
      </div>
      
      {/* Overlay gradiente inferior */}
      <div
        className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black/60 to-transparent pointer-events-none"
      />
    </div>
  );
};

const FeedSkeleton = ({ count = 3 }) => {
  return (
    <>
      <style>{`
        @keyframes gradientShift {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }
        
        @keyframes shimmer {
          0% {
            background-position: -200% 0;
          }
          100% {
            background-position: 200% 0;
          }
        }
        
        .animate-shimmer {
          animation: shimmer 1.5s infinite linear;
          background: linear-gradient(
            90deg,
            rgba(255, 255, 255, 0.05) 0%,
            rgba(255, 255, 255, 0.15) 50%,
            rgba(255, 255, 255, 0.05) 100%
          );
          background-size: 200% 100%;
        }
      `}</style>
      
      <div className="fixed inset-0 bg-black overflow-hidden" data-testid="feed-skeleton">
        {Array.from({ length: count }).map((_, i) => (
          <SkeletonSlide key={i} index={i} />
        ))}
      </div>
    </>
  );
};

export default FeedSkeleton;