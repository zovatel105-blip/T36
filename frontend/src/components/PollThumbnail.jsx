import React, { useState, useRef, useCallback, useMemo } from 'react';
import { Check, Play } from 'lucide-react';
import AppConfig from '../config/config';
import LayoutRenderer from './layouts/LayoutRenderer';

// Resuelve URLs relativas a absolutas para APK nativa Android
const resolveUrl = (url) => {
  if (!url) return null;
  if (
    url.startsWith('http://') ||
    url.startsWith('https://') ||
    url.startsWith('blob:') ||
    url.startsWith('data:')
  ) {
    return url; // Ya es absoluta, no tocar
  }
  const base = AppConfig.BACKEND_URL || '';
  return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
};

/**
 * Componente de miniatura de poll que replica el layout completo del poll
 * Muestra todas las opciones con su layout original (grid, carousel, etc.)
 * @param {boolean} hideBadge - Si es true, oculta el badge de layout
 * @param {function} onQuickVote - Callback para votar rápidamente (pollId, optionIndex)
 */
const PollThumbnail = ({ result, className = "", onClick, hideBadge = false, onQuickVote }) => {
  const [showQuickVote, setShowQuickVote] = useState(false);
  const [selectedOption, setSelectedOption] = useState(null);
  const longPressTimer = useRef(null);
  const containerRef = useRef(null);
  const touchStartPos = useRef({ x: 0, y: 0 });
  const hasMoved = useRef(false);
  
  // Long press handlers - Track swipe vs tap
  const handlePressStart = useCallback((e) => {
    hasMoved.current = false;
    
    if (e.type.includes('touch') && e.touches.length > 0) {
      touchStartPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else {
      touchStartPos.current = { x: e.clientX, y: e.clientY };
    }
    
    longPressTimer.current = setTimeout(() => {
      if (!hasMoved.current) {
        setShowQuickVote(true);
      }
    }, 300);
  }, []);
  
  const handlePressMove = useCallback((e) => {
    let clientX, clientY;
    if (e.type.includes('touch')) {
      if (e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else {
        return;
      }
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    const dx = Math.abs(clientX - touchStartPos.current.x);
    const dy = Math.abs(clientY - touchStartPos.current.y);
    
    if (dx > 10 || dy > 10) {
      hasMoved.current = true;
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }
    }
    
    if (!showQuickVote || !containerRef.current) return;
    
    const elements = document.elementsFromPoint(clientX, clientY);
    const optionElement = elements.find(el => el.dataset.optionIndex !== undefined);
    
    if (optionElement) {
      const optionIndex = parseInt(optionElement.dataset.optionIndex);
      setSelectedOption(optionIndex);
    } else {
      setSelectedOption(null);
    }
  }, [showQuickVote]);
  
  const handlePressEnd = useCallback(async (e) => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
    
    if (showQuickVote && selectedOption !== null && onQuickVote && result) {
      e.preventDefault();
      e.stopPropagation();
      await onQuickVote(result.id, selectedOption);
    }
    
    setShowQuickVote(false);
    setSelectedOption(null);
    
    if (!showQuickVote && !hasMoved.current && onClick) {
      onClick();
    }
  }, [showQuickVote, selectedOption, onQuickVote, result, onClick]);
  
  const handlePressCancel = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
    setShowQuickVote(false);
    setSelectedOption(null);
  }, []);
  
  if (!result || result.type !== 'post') {
    return null;
  }

  const options = result.options || [];
  const layout = result.layout || 'vertical';
  // 🎯 VS: orientación del split (vertical=lado a lado, horizontal=arriba-abajo)
  const vsOrientation = result.vs_orientation || 'vertical';

  const getGridClasses = () => {
    switch (layout) {
      case 'vs':
        return vsOrientation === 'horizontal'
          ? 'grid grid-cols-1 grid-rows-2 gap-0.5'
          : 'grid grid-cols-2 gap-0.5';
      case 'vertical':           return 'grid grid-cols-2 gap-0.5';
      case 'horizontal':         return 'grid grid-cols-1 grid-rows-2 gap-0.5';
      case 'triptych-vertical':  return 'grid grid-cols-3 gap-0.5';
      case 'triptych-horizontal':return 'grid grid-cols-1 grid-rows-3 gap-0.5';
      case 'grid-2x2':           return 'grid grid-cols-2 grid-rows-2 gap-0.5';
      case 'grid-3x2':           return 'grid grid-cols-3 grid-rows-2 gap-0.5';
      case 'horizontal-3x2':     return 'grid grid-cols-2 grid-rows-3 gap-0.5';
      case 'off':                return 'grid grid-cols-1 gap-0';
      case 'moment':             return 'grid grid-cols-1 gap-0';
      default:                   return 'grid grid-cols-2 gap-0.5';
    }
  };

  const getMaxOptions = () => {
    switch (layout) {
      case 'vs':                  return 2;  // 🎯 VS: muestra las 2 opciones de la primera pregunta
      case 'vertical':            return 2;
      case 'horizontal':          return 2;
      case 'triptych-vertical':   return 3;
      case 'triptych-horizontal': return 3;
      case 'grid-2x2':            return 4;
      case 'grid-3x2':            return 6;
      case 'horizontal-3x2':      return 6;
      case 'off':                 return 1;
      case 'moment':              return 1;
      default:                    return 2;
    }
  };

  const isVideoUrl = (url) => {
    if (!url) return false;
    const lower = url.toLowerCase();
    return lower.includes('.mp4') || lower.includes('.mov') || lower.includes('.webm') || lower.includes('.avi');
  };

  // Helper: Extract normalized media fields supporting both shapes:
  // - Legacy: option.media_url / option.media_type / option.thumbnail_url
  // - New:    option.media.url / option.media.type / option.media.thumbnail
  //
  // Para video preferir optimized_media_url (transcodificado 720p H.264+AAC
  // por el pipeline backend) cuando esté disponible.
  const getMediaFields = (option) => {
    const rawUrl = option.media?.url || option.media_url;
    const optimizedUrl =
      option.media?.optimizedUrl ||
      option.media?.optimized_media_url ||
      option.optimized_media_url;
    const type = option.media?.type || option.media_type;
    const isVideo = type === 'video';
    return {
      // Para vídeos: optimizado si lo hay, si no el original
      url: (isVideo && optimizedUrl) ? optimizedUrl : rawUrl,
      type,
      thumbnail: option.media?.thumbnail || option.thumbnail_url,
    };
  };

  // Helper: Render the correct media element for an option (image or video fallback)
  const renderMediaElement = (option, altText, imgClassName = "w-full h-full object-cover") => {
    const { url: optionUrl, type: optionType, thumbnail: optionThumb } = getMediaFields(option);
    const isVideo = optionType === 'video' || isVideoUrl(optionUrl);
    
    const thumbnailIsImage = optionThumb && !isVideoUrl(optionThumb);
    const mediaIsImage = optionUrl && !isVideoUrl(optionUrl);
    // resolveUrl applied for native APK compatibility
    const imageUrl = resolveUrl(thumbnailIsImage ? optionThumb : (mediaIsImage ? optionUrl : null));
    
    if (imageUrl) {
      return (
        <>
          <img
            src={imageUrl}
            alt={altText}
            className={imgClassName}
            loading="lazy"
            decoding="async"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
          {isVideo && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="bg-black/40 rounded-full p-2">
                <Play size={20} className="text-white fill-white" />
              </div>
            </div>
          )}
        </>
      );
    }
    
    // resolveUrl applied to video src for native APK compatibility
    const videoSrc = resolveUrl(optionUrl || optionThumb);
    if (isVideo && videoSrc) {
      return (
        <>
          <video
            src={videoSrc}
            className={imgClassName}
            muted
            playsInline
            preload="metadata"
            onLoadedData={(e) => {
              e.target.currentTime = 0.1;
              e.target.pause();
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-black/40 rounded-full p-2">
              <Play size={20} className="text-white fill-white" />
            </div>
          </div>
        </>
      );
    }
    
    return null;
  };

  if (process.env.NODE_ENV === 'development') {
    console.log('PollThumbnail Debug:', {
      pollId: result?.id,
      layout,
      optionsCount: options.length,
      options: options.map(opt => {
        const f = getMediaFields(opt);
        return {
          text: opt.text,
          media_type: f.type,
          has_media_url: !!f.url,
          has_thumbnail_url: !!f.thumbnail,
          media_url_resolved: resolveUrl(f.url)?.substring(0, 60),
          thumbnail_url_resolved: resolveUrl(f.thumbnail)?.substring(0, 60),
        };
      })
    });
  }

  const optionsWithMedia = options.filter(option => {
    const f = getMediaFields(option);
    return f.url || f.thumbnail;
  }).slice(0, getMaxOptions());

  console.log('Options with media:', optionsWithMedia.length);

  if (optionsWithMedia.length === 0) {
    return (
      <div
        className={`relative aspect-[6/11] bg-gradient-to-br from-blue-400 to-purple-500 cursor-pointer rounded-xl overflow-hidden flex items-center justify-center ${className}`}
        onClick={onClick}
      >
        <div className="text-center text-white">
          <div className="text-lg font-bold mb-1">📊</div>
          <div className="text-xs">Poll</div>
        </div>
      </div>
    );
  }

  // ─── Layout: VS (mismo diseño que la vista completa) ──────────────────────
  // 🎯 Para posts VS renderizamos el VSLayout real en modo thumbnail (isThumbnail=true,
  //    isActive=false). Así el preview en grids/búsqueda se ve EXACTAMENTE igual
  //    que la vista completa, sin reinventar el layout con un grid simple.
  if (layout === 'vs') {
    return (
      <div
        ref={containerRef}
        className={`relative aspect-[6/11] bg-black cursor-pointer rounded-xl overflow-hidden ${className}`}
        onMouseDown={handlePressStart}
        onMouseMove={handlePressMove}
        onMouseUp={handlePressEnd}
        onMouseLeave={handlePressCancel}
        onTouchStart={handlePressStart}
        onTouchMove={handlePressMove}
        onTouchEnd={handlePressEnd}
        onTouchCancel={handlePressCancel}
      >
        {/* Vista normal — VSLayout en modo thumbnail. Se oculta cuando aparece
            el overlay de voto rápido para liberar memoria/eventos. */}
        {!showQuickVote && (
          <LayoutRenderer
            poll={result}
            onVote={() => {}}
            isActive={false}
            isThumbnail={true}
            isBottomNavVisible={false}
          />
        )}
        {!hideBadge && !showQuickVote && (
          <div className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/80 text-white backdrop-blur-sm pointer-events-none">
            VS
          </div>
        )}

        {/* Overlay de voto rápido — respeta la orientación del VS */}
        {showQuickVote && (
          <div
            className="absolute inset-0 bg-black/90 z-50 flex items-center justify-center p-2"
            style={{ touchAction: 'none' }}
          >
            <div className="w-full h-full flex flex-col">
              <div className="text-white text-center mb-2 text-xs font-medium">
                Mantén presionado para votar
              </div>
              <div className={`flex-1 gap-1 ${vsOrientation === 'horizontal' ? 'grid grid-cols-1 grid-rows-2' : 'grid grid-cols-2'}`}>
                {options.slice(0, 2).map((option, index) => {
                  const isSelected = selectedOption === index;
                  const isVoted = result.user_vote === index;
                  const votePercentage = result.total_votes > 0
                    ? Math.round((option.votes / result.total_votes) * 100) : 0;
                  const mf = getMediaFields(option);
                  const bgSrc = mf.type === 'video'
                    ? resolveUrl(mf.thumbnail && !isVideoUrl(mf.thumbnail) ? mf.thumbnail : null)
                    : resolveUrl(mf.url || mf.thumbnail);

                  return (
                    <div
                      key={option.id || `vs-vote-opt-${index}`}
                      data-option-index={index}
                      className={`relative rounded-lg overflow-hidden transition-all duration-150 ${isSelected ? 'ring-4 ring-blue-400 scale-105' : 'scale-100'}`}
                    >
                      {bgSrc && (
                        <img
                          src={bgSrc}
                          alt={option.text || `Option ${index + 1}`}
                          className="absolute inset-0 w-full h-full object-cover"
                          loading="lazy"
                          decoding="async"
                        />
                      )}
                      <div className={`absolute inset-0 transition-all duration-150 ${isSelected ? 'bg-blue-500/40' : 'bg-black/30'}`} />
                      <div className="relative h-full flex flex-col justify-between p-2">
                        <div className="flex-1 flex items-center justify-center">
                          {option.text && (
                            <span className="text-white text-sm font-semibold drop-shadow-lg text-center">
                              {option.text}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1">
                            {isVoted && <div className="bg-white/90 rounded-full p-0.5"><Check size={12} className="text-blue-500" /></div>}
                            {isSelected && <div className="bg-blue-500 rounded-full p-1 animate-pulse"><Check size={14} className="text-white" /></div>}
                          </div>
                          <span className="text-white text-xs font-bold bg-black/50 px-1.5 py-0.5 rounded-full">{votePercentage}%</span>
                        </div>
                      </div>
                      <div className="absolute bottom-0 left-0 h-1 bg-blue-500 transition-all duration-500" style={{ width: `${votePercentage}%` }} />
                    </div>
                  );
                })}
              </div>
              <div className="text-center text-white text-xs opacity-70 mt-2">
                {selectedOption !== null ? '✓ Suelta para votar' : 'Desliza para seleccionar'}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── Layout: CARRUSEL (off) ───────────────────────────────────────────────
  if (layout === 'off') {
    const firstOption = optionsWithMedia[0];
    return (
      <div
        ref={containerRef}
        className={`relative aspect-[6/11] bg-gray-100 cursor-pointer rounded-xl overflow-hidden ${className}`}
        onMouseDown={handlePressStart}
        onMouseMove={handlePressMove}
        onMouseUp={handlePressEnd}
        onMouseLeave={handlePressCancel}
        onTouchStart={handlePressStart}
        onTouchMove={handlePressMove}
        onTouchEnd={handlePressEnd}
        onTouchCancel={handlePressCancel}
      >
        {renderMediaElement(firstOption, result.title || 'Poll option', "w-full h-full object-cover")}

        {showQuickVote && (
          <div
            className="absolute inset-0 bg-black/90 z-50 flex items-center justify-center p-2"
            style={{ touchAction: 'none' }}
          >
            <div className="w-full h-full flex flex-col">
              <div className="text-white text-center mb-2 text-xs font-medium">
                Mantén presionado para votar
              </div>
              <div className="flex-1 flex overflow-x-auto gap-1 snap-x snap-mandatory scrollbar-hide">
                {options.map((option, index) => {
                  const isSelected = selectedOption === index;
                  const isVoted = result.user_vote === index;
                  const votePercentage = result.total_votes > 0
                    ? Math.round((option.votes / result.total_votes) * 100) : 0;
                  const mf = getMediaFields(option);
                  const bgSrc = mf.type === 'video'
                    ? resolveUrl(mf.thumbnail && !isVideoUrl(mf.thumbnail) ? mf.thumbnail : null)
                    : resolveUrl(mf.url || mf.thumbnail);

                  return (
                    <div
                      key={option.id || `carousel-opt-${index}`}
                      data-option-index={index}
                      className={`relative flex-shrink-0 w-full h-full rounded-lg overflow-hidden transition-all duration-150 snap-center ${isSelected ? 'ring-4 ring-blue-400 scale-105' : 'scale-100'}`}
                    >
                      {bgSrc && (
                        <img
                          src={bgSrc}
                          alt={option.text || `Option ${index + 1}`}
                          className="absolute inset-0 w-full h-full object-cover"
                          loading="lazy"
                          decoding="async"
                        />
                      )}
                      <div className={`absolute inset-0 transition-all duration-150 ${isSelected ? 'bg-blue-500/40' : 'bg-black/30'}`} />
                      <div className="relative h-full flex flex-col justify-between p-3">
                        <div className="flex-1 flex items-center justify-center">
                          {option.text && (
                            <span className="text-white text-lg font-bold drop-shadow-lg text-center">
                              {option.text}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {isVoted && <div className="bg-white/90 rounded-full p-1"><Check size={14} className="text-blue-500" /></div>}
                            {isSelected && <div className="bg-blue-500 rounded-full p-2 animate-pulse"><Check size={18} className="text-white" /></div>}
                          </div>
                          <span className="text-white text-sm font-bold bg-black/50 px-2 py-1 rounded-full">{votePercentage}%</span>
                        </div>
                      </div>
                      <div className="absolute bottom-0 left-0 h-1.5 bg-blue-500 transition-all duration-500" style={{ width: `${votePercentage}%` }} />
                    </div>
                  );
                })}
              </div>
              <div className="text-center text-white text-xs opacity-70 mt-2">
                {selectedOption !== null ? '✓ Suelta para votar' : 'Desliza para seleccionar'}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── Layout: MOMENTO ────────────────────────────────────────────────────────
  if (layout === 'moment') {
    const firstOption = optionsWithMedia[0];
    return (
      <div
        ref={containerRef}
        className={`relative aspect-[6/11] bg-gray-100 cursor-pointer rounded-xl overflow-hidden ${className}`}
        onMouseDown={handlePressStart}
        onMouseMove={handlePressMove}
        onMouseUp={handlePressEnd}
        onMouseLeave={handlePressCancel}
        onTouchStart={handlePressStart}
        onTouchMove={handlePressMove}
        onTouchEnd={handlePressEnd}
        onTouchCancel={handlePressCancel}
      >
        {renderMediaElement(firstOption, result.title || 'Momento', "w-full h-full object-cover")}

        {!hideBadge && (
          <div className="absolute top-1 left-1 bg-amber-500/80 text-white text-xs px-2 py-0.5 rounded-full">📸</div>
        )}

        {showQuickVote && (
          <div
            className="absolute inset-0 bg-black/90 z-50 flex items-center justify-center p-2"
            style={{ touchAction: 'none' }}
          >
            <div className="w-full h-full flex flex-col">
              <div className="text-white text-center mb-2 text-xs font-medium">Mantén presionado para votar</div>
              <div className="flex-1 relative">
                {options.slice(0, 1).map((option, index) => {
                  const isSelected = selectedOption === index;
                  const isVoted = result.user_vote === index;
                  const votePercentage = result.total_votes > 0
                    ? Math.round((option.votes / result.total_votes) * 100) : 0;
                  const mf = getMediaFields(option);
                  const bgSrc = mf.type === 'video'
                    ? resolveUrl(mf.thumbnail && !isVideoUrl(mf.thumbnail) ? mf.thumbnail : null)
                    : resolveUrl(mf.url || mf.thumbnail);

                  return (
                    <div
                      key={option.id || `single-opt-${index}`}
                      data-option-index={index}
                      className={`relative w-full h-full rounded-lg overflow-hidden transition-all duration-150 ${isSelected ? 'ring-4 ring-amber-400 scale-[0.98]' : 'scale-100'}`}
                    >
                      {bgSrc && (
                        <img
                          src={bgSrc}
                          alt={option.text || 'Momento'}
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                      )}
                      <div className={`absolute inset-0 transition-all duration-150 ${isSelected ? 'bg-amber-500/40' : 'bg-black/30'}`} />
                      <div className="relative h-full flex flex-col justify-end p-3">
                        {option.text && (
                          <span className="text-white text-sm font-medium drop-shadow-lg text-center mb-2">{option.text}</span>
                        )}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {isVoted && <div className="bg-white/90 rounded-full p-1"><Check size={14} className="text-amber-500" /></div>}
                            {isSelected && <div className="bg-amber-500 rounded-full p-2 animate-pulse"><Check size={18} className="text-white" /></div>}
                          </div>
                          <span className="text-white text-sm font-bold bg-black/50 px-2 py-1 rounded-full">{votePercentage}%</span>
                        </div>
                      </div>
                      <div className="absolute bottom-0 left-0 h-1.5 bg-amber-500 transition-all duration-500" style={{ width: `${votePercentage}%` }} />
                    </div>
                  );
                })}
              </div>
              <div className="text-center text-white text-xs opacity-70 mt-2">
                {selectedOption !== null ? '✓ Suelta para votar' : 'Toca para votar'}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── Layout: GRID (vertical, horizontal, triptych, grid-2x2, grid-3x2…) ───
  return (
    <div
      ref={containerRef}
      className={`relative aspect-[6/11] bg-black cursor-pointer rounded-xl overflow-hidden ${className}`}
      onMouseDown={handlePressStart}
      onMouseMove={handlePressMove}
      onMouseUp={handlePressEnd}
      onMouseLeave={handlePressCancel}
      onTouchStart={handlePressStart}
      onTouchMove={handlePressMove}
      onTouchEnd={handlePressEnd}
      onTouchCancel={handlePressCancel}
    >
      <div className={`w-full h-full ${getGridClasses()}`}>
        {optionsWithMedia.map((option, index) => (
          <div
            key={option.id || `grid-opt-${index}`}
            className="relative bg-gray-200 overflow-hidden"
            style={{ minHeight: '30px' }}
          >
            {(() => {
              const mf = getMediaFields(option);
              const isVideo = mf.type === 'video' || isVideoUrl(mf.url);
              const thumbnailIsImage = mf.thumbnail && !isVideoUrl(mf.thumbnail);
              const mediaIsImage = mf.url && !isVideoUrl(mf.url);

              // resolveUrl in both branches for native APK compatibility
              const imageUrl = isVideo
                ? (thumbnailIsImage ? resolveUrl(mf.thumbnail) : null)
                : resolveUrl(mf.url || mf.thumbnail);

              if (imageUrl) {
                return (
                  <>
                    <img
                      src={imageUrl}
                      alt={option.text || `Option ${index + 1}`}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      decoding="async"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                    {isVideo && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="bg-black/40 rounded-full p-1">
                          <Play size={14} className="text-white fill-white" />
                        </div>
                      </div>
                    )}
                  </>
                );
              }

              // resolveUrl on video fallback for native APK
              const videoSrc = resolveUrl(mf.url || mf.thumbnail);
              if (isVideo && videoSrc) {
                return (
                  <>
                    <video
                      src={videoSrc}
                      className="w-full h-full object-cover"
                      muted
                      playsInline
                      preload="metadata"
                      onLoadedData={(e) => {
                        e.target.currentTime = 0.1;
                        e.target.pause();
                      }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="bg-black/40 rounded-full p-1">
                        <Play size={14} className="text-white fill-white" />
                      </div>
                    </div>
                  </>
                );
              }

              return (
                <div className="absolute inset-0 bg-gray-300 flex items-center justify-center text-xs text-gray-600 p-1 text-center">
                  {option.text || `Option ${index + 1}`}
                </div>
              );
            })()}

            {option.text && (option.media?.url || option.media_url || option.thumbnail_url) && (
              <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-1 text-center">
                {option.text.length > 15 ? `${option.text.substring(0, 15)}...` : option.text}
              </div>
            )}
          </div>
        ))}

        {Array.from({ length: Math.max(0, getMaxOptions() - optionsWithMedia.length) }).map((_, index) => (
          <div
            key={`empty-${index}`}
            className="bg-gray-800 flex items-center justify-center text-gray-400 text-xs"
          >
            <span>Empty</span>
          </div>
        ))}
      </div>

      {!hideBadge && (
        <div className="absolute top-1 left-1 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full">
          {layout === 'vertical'            && '2️⃣'}
          {layout === 'horizontal'          && '⏸️'}
          {layout === 'triptych-vertical'   && '3️⃣'}
          {layout === 'triptych-horizontal' && '3️⃣⏸️'}
          {layout === 'grid-2x2'            && '4️⃣'}
          {layout === 'grid-3x2'            && '6️⃣'}
          {layout === 'horizontal-3x2'      && '6️⃣⏸️'}
          {layout === 'off'                 && '🎠'}
        </div>
      )}

      {/* Modal de votación rápida - Adaptado al layout */}
      {showQuickVote && (
        <div
          className="absolute inset-0 bg-black/90 z-50 flex items-center justify-center p-2"
          style={{ touchAction: 'none' }}
        >
          <div className="w-full h-full flex flex-col">
            <div className="text-white text-center mb-2 text-xs font-medium">
              Mantén presionado para votar
            </div>
            <div className={`flex-1 gap-1 ${getGridClasses()}`}>
              {options.map((option, index) => {
                const isSelected = selectedOption === index;
                const isVoted = result.user_vote === index;
                const votePercentage = result.total_votes > 0
                  ? Math.round((option.votes / result.total_votes) * 100) : 0;
                const mf = getMediaFields(option);
                const bgSrc = mf.type === 'video'
                  ? resolveUrl(mf.thumbnail && !isVideoUrl(mf.thumbnail) ? mf.thumbnail : null)
                  : resolveUrl(mf.url || mf.thumbnail);

                return (
                  <div
                    key={option.id || `grid-vote-opt-${index}`}
                    data-option-index={index}
                    className={`relative rounded-lg overflow-hidden transition-all duration-150 ${isSelected ? 'ring-4 ring-blue-400 scale-105' : 'scale-100'}`}
                  >
                    {bgSrc && (
                      <img
                        src={bgSrc}
                        alt={option.text || `Option ${option.index + 1}`}
                        className="absolute inset-0 w-full h-full object-cover"
                        loading="lazy"
                        decoding="async"
                      />
                    )}
                    <div className={`absolute inset-0 transition-all duration-150 ${isSelected ? 'bg-blue-500/40' : 'bg-black/30'}`} />
                    <div className="relative h-full flex flex-col justify-between p-2">
                      <div className="flex-1 flex items-center justify-center">
                        {option.text && (
                          <span className="text-white text-sm font-semibold drop-shadow-lg text-center">
                            {option.text}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          {isVoted && <div className="bg-white/90 rounded-full p-0.5"><Check size={12} className="text-blue-500" /></div>}
                          {isSelected && <div className="bg-blue-500 rounded-full p-1 animate-pulse"><Check size={14} className="text-white" /></div>}
                        </div>
                        <span className="text-white text-xs font-bold bg-black/50 px-1.5 py-0.5 rounded-full">{votePercentage}%</span>
                      </div>
                    </div>
                    <div className="absolute bottom-0 left-0 h-1 bg-blue-500 transition-all duration-500" style={{ width: `${votePercentage}%` }} />
                  </div>
                );
              })}
            </div>
            <div className="text-center text-white text-xs opacity-70 mt-2">
              {selectedOption !== null ? '✓ Suelta para votar' : 'Desliza para seleccionar'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(PollThumbnail);
