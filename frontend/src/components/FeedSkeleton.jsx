/**
 * FeedSkeleton - Carga INSTANTÁNEA como TikTok/Instagram
 * 
 * Muestra skeletons IMEDIATAMENTE mientras cargan los datos reales.
 * Los skeletons son ligeros (<1KB c/u) y aparecen en 0ms.
 * 
 * Uso:
 *   {isLoading && <FeedSkeleton count={6} />}
 *   {polls.map(poll => <TikTokScrollView poll={poll} />)}
 */

import React from 'react';

const FeedSkeleton = ({ count = 6 }) => {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="absolute inset-0 bg-black overflow-hidden animate-pulse"
          style={{
            transform: `translateY(${i * 100}vh)`,
            height: '100vh',
          }}
        >
          {/* Header skeleton */}
          <div className="absolute top-4 left-4 flex items-center gap-2 z-10">
            <div className="w-10 h-10 rounded-full bg-gray-800" />
            <div className="space-y-2">
              <div className="w-24 h-3 bg-gray-800 rounded" />
              <div className="w-16 h-2 bg-gray-900 rounded" />
            </div>
          </div>
          
          {/* Contenido central skeleton */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div 
              className="w-32 h-32 rounded-xl bg-gray-900"
              style={{ animationDelay: `${i * 0.1}s` }}
            />
          </div>
          
          {/* Actions skeleton */}
          <div className="absolute right-3 bottom-32 flex flex-col gap-4 z-10">
            {[1, 2, 3, 4].map((j) => (
              <div key={j} className="flex flex-col items-center gap-1">
                <div 
                  className="w-8 h-8 rounded-full bg-gray-800"
                  style={{ animationDelay: `${i * 0.1 + j * 0.05}s` }}
                />
                <div 
                  className="w-6 h-2 rounded bg-gray-900"
                  style={{ animationDelay: `${i * 0.1 + j * 0.05 + 0.025}s` }}
                />
              </div>
            ))}
          </div>
          
          {/* Footer skeleton */}
          <div className="absolute bottom-0 left-0 right-0 px-4 pb-8 flex items-center gap-3 z-10">
            <div className="w-10 h-10 rounded-full bg-gray-800" />
            <div className="flex-1 space-y-2">
              <div className="w-48 h-3 bg-gray-800 rounded" />
              <div className="w-32 h-2 bg-gray-900 rounded" />
            </div>
          </div>
          
          {/* Overlay gradiente */}
          <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
        </div>
      ))}
    </>
  );
};

export default FeedSkeleton;