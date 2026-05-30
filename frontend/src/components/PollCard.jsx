import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from './ui/card';
import { Avatar, AvatarImage, AvatarFallback } from './ui/avatar';
import { Button } from './ui/button';
import { Heart, MessageCircle, Send, MoreHorizontal, Play, CheckCircle, Bookmark, Trophy, Share2, Share, User } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'framer-motion';
import { useAddiction } from '../contexts/AddictionContext';
// import SocialProofBadge from './AddictionUI_backup/SocialProofBadge'; // REMOVED: Component deleted during cleanup
import CommentsModal from './CommentsModal';
import ShareModal from './ShareModal';
import { useShare } from '../hooks/useShare';
import storyService from '../services/storyService';
import StoriesViewer from './StoriesViewer';
import audioManager from '../services/AudioManager';
import { useAuth } from '../contexts/AuthContext';
import { resolveAssetUrl } from '../utils/resolveAssetUrl';
import useCachedSrc from '../hooks/useCachedSrc';

// Helper function to render text with clickable hashtags
const renderTextWithHashtags = (text, navigate) => {
  if (!text) return null;
  
  // Split text by hashtags while keeping the hashtags
  const parts = text.split(/(#\w+)/g);
  
  return parts.map((part, index) => {
    if (part.startsWith('#')) {
      // This is a hashtag, make it clickable
      return (
        <span
          key={`hashtag-${part}-${index}`}
          className="text-blue-600 hover:text-blue-700 cursor-pointer underline"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/search?q=${encodeURIComponent(part.substring(1))}&filter=hashtags`);
          }}
        >
          {part}
        </span>
      );
    }
    // Regular text
    return <span key={`text-${index}`}>{part}</span>;
  });
};

const MediaPreview = ({ media, isWinner, isSelected, onClick, percentage, option, totalVotes, userVote, fullScreen = false, globalMentions = [] }) => {
  // Detect mobile device with window resize handling
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [imageDecoded, setImageDecoded] = useState(false);
  const [thumbnailSrc, setThumbnailSrc] = useState(null);

  // 🚀 OFFLINE-FIRST: usar URI cacheada del filesystem si existe.
  // Aplicado a thumbnail, vídeo principal e imagen estática.
  const cachedThumbnailSrc = useCachedSrc(thumbnailSrc, { enabled: !!thumbnailSrc });
  const cachedVideoUrl = useCachedSrc(media?.url, {
    enabled: media?.type === 'video' && !!media?.url,
    maxBytes: 25 * 1024 * 1024,
  });
  const cachedImageUrl = useCachedSrc(media?.url, {
    enabled: media?.type !== 'video' && !!media?.url,
  });
  
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 🚀 OPTIMIZACIÓN: Determinar la mejor fuente de thumbnail para vídeos
  useEffect(() => {
    if (media?.type === 'video') {
      // Prioridad de thumbnails:
      // 1. option.thumbnail_url (del backend, ya generado)
      // 2. media.thumbnail (si existe)
      // 3. null (mostrará placeholder)
      const bestThumbnail = option?.thumbnail_url || media?.thumbnail;
      setThumbnailSrc(bestThumbnail);
      
      // Pre-cargar la imagen para que esté lista
      if (bestThumbnail) {
        const img = new Image();
        img.src = bestThumbnail;
        img.onload = () => setImageLoaded(true);
        img.onerror = () => setImageError(true);
      }
    }
  }, [media, option]);
  
  // YouTube-style percentage bars: ONLY show when user has voted AND on mobile
  const shouldShowBars = isMobile && userVote !== null;
  const displayPercentage = Math.max(percentage || 0, 0);
  
  console.log(`MediaPreview Debug - Option ${option?.id}: isMobile=${isMobile}, userVote=${userVote}, shouldShowBars=${shouldShowBars}, displayPercentage=${displayPercentage}`);
  const [isPlaying, setIsPlaying] = useState(false);
  const navigate = useNavigate();

  const handleClick = async () => {
    onClick && onClick();
  };

  const renderMentionedUsers = () => {
    const optionMentions = option.mentioned_users || [];

    if (optionMentions.length === 0) return null;

    return (
      <div className="absolute bottom-2 left-2 flex flex-wrap gap-1 z-20" onClick={(e) => e.stopPropagation()}>
        {optionMentions.slice(0, 2).map((user, idx) => (
          <div 
            key={idx} 
            className="relative group/user cursor-pointer transition-transform hover:scale-110"
            onClick={(e) => {
              e.stopPropagation();
              const username = user.username || user.display_name?.toLowerCase().replace(/\s+/g, '_');
              if (username) navigate(`/profile/${username}`);
            }}
          >
            <Avatar className="w-6 h-6 border border-white shadow-sm">
              <AvatarImage src={resolveAssetUrl(user.avatar_url)} />
              <AvatarFallback className="bg-gray-400 text-white flex items-center justify-center">
                <User className="w-3 h-3" />
              </AvatarFallback>
            </Avatar>
          </div>
        ))}
        {optionMentions.length > 2 && (
          <div className="w-6 h-6 rounded-full bg-black/60 text-white text-[10px] flex items-center justify-center border border-white shadow-sm">
            +{optionMentions.length - 2}
          </div>
        )}
      </div>
    );
  };

  // If no media, render a text-based option with horizontal progress bar
  if (!media) {
    return (
      <motion.div 
        className={cn(
          "relative w-full rounded-lg overflow-hidden cursor-pointer transition-all duration-300",
          "bg-gradient-to-br from-gray-50 to-gray-100 border-2 hover:shadow-lg",
          isSelected 
            ? "border-blue-500 bg-gradient-to-br from-blue-50 to-blue-100"
            : isWinner && totalVotes > 0
              ? "border-green-500 bg-gradient-to-br from-green-50 to-green-100"
              : "border-gray-200 hover:border-gray-300",
          fullScreen ? "min-h-48 h-full" : "h-24"
        )} 
        onClick={handleClick}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        transition={{ duration: 0.2 }}
      >
        {renderMentionedUsers()}
        {/* Background Progress Bar - Only show when user has voted on mobile */}
        {shouldShowBars && (
          <motion.div 
            className={cn(
              "absolute inset-y-0 left-0 transition-all duration-700 ease-out rounded-r-lg",
              isSelected 
                ? "bg-gradient-to-r from-blue-500/80 via-blue-500/60 to-blue-500/30"
                : isWinner 
                  ? "bg-gradient-to-r from-green-500/80 via-green-500/60 to-green-500/30"
                  : "bg-gradient-to-r from-gray-500/70 via-gray-500/50 to-gray-500/20"
            )}
            initial={{ width: 0 }}
            animate={{ width: `${Math.max(displayPercentage, 15)}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            style={{
              minWidth: '80px'
            }}
          />
        )}
        
        {/* Percentage Display - Only show when user has voted on mobile */}
        {shouldShowBars && (
          <motion.div 
            className="absolute top-2 right-2 bg-black/70 text-white px-2 py-1 rounded-full text-xs font-bold z-10"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5, duration: 0.3 }}
          >
            {Math.round(displayPercentage)}%
          </motion.div>
        )}
        
        
        {/* Content Container */}
        <div className="relative z-10 h-full flex flex-col justify-center items-center p-4">
          {/* Option Text */}
          <p className={cn(
            "text-center font-semibold leading-tight",
            fullScreen ? "text-lg" : "text-sm",
            isSelected 
              ? "text-blue-800"
              : isWinner && totalVotes > 0
                ? "text-green-800"
                : "text-gray-800"
          )}>
            {option.text}
          </p>
        </div>
        
        {/* Winner Badge */}
        {isWinner && totalVotes > 0 && (
          <motion.div 
            className="absolute top-2 right-2 bg-green-600 text-white p-1 rounded-full shadow-lg"
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            <Trophy className="w-3 h-3" />
          </motion.div>
        )}
        
        {/* Selection Ring */}
        {isSelected && (
          <motion.div 
            className="absolute inset-0 ring-2 ring-blue-500 rounded-lg"
            animate={{
              ringOpacity: [0.6, 1, 0.6]
            }}
            transition={{ duration: 1, repeat: Infinity }}
          />
        )}
      </motion.div>
    );
  }

  const heightClass = fullScreen ? "h-full min-h-48" : "h-40";

  if (media.type === 'video') {
    return (
      <motion.div 
        className={cn("relative w-full rounded-lg overflow-hidden group cursor-pointer hover:scale-105 transition-transform duration-300", heightClass)} 
        onClick={handleClick}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        transition={{ duration: 0.2 }}
      >
        {renderMentionedUsers()}
        
        {/* 🚀 OPTIMIZADO: Placeholder instantáneo con gradiente mientras carga */}
        <div 
          className={cn(
            "absolute inset-0 bg-gradient-to-br from-gray-700 via-gray-800 to-gray-900 flex items-center justify-center transition-opacity duration-300",
            imageLoaded ? "opacity-0 pointer-events-none" : "opacity-100"
          )}
        >
          <Play className="w-12 h-12 text-white/30" />
        </div>
        
        {/* Thumbnail del video - usando la mejor fuente disponible (cacheado) */}
        {thumbnailSrc && (
          <img 
            src={cachedThumbnailSrc || thumbnailSrc} 
            alt="Video thumbnail"
            loading="eager"
            fetchpriority="high"
            decoding="async"
            onLoad={() => setImageLoaded(true)}
            onError={() => {
              setImageError(true);
              // Intentar con media.url como último recurso (poster del video)
              if (media.url && thumbnailSrc !== media.url) {
                setThumbnailSrc(null);
              }
            }}
            className={cn(
              "absolute inset-0 w-full h-full object-cover transition-opacity duration-300",
              imageLoaded ? "opacity-100" : "opacity-0"
            )}
            style={media.transform ? {
              objectPosition: `${media.transform.position?.x || 50}% ${media.transform.position?.y || 50}%`,
              transform: `scale(${media.transform.scale || 1})`,
              transformOrigin: 'center center'
            } : {}}
          />
        )}
        
        {/* Fallback: Video element con poster para generar thumbnail on-demand (cacheado offline) */}
        {(!thumbnailSrc || imageError) && !imageLoaded && (
          <video
            src={cachedVideoUrl || media.url}
            poster={cachedThumbnailSrc || thumbnailSrc || undefined}
            muted
            playsInline
            preload="metadata"
            onLoadedData={(e) => {
              // Cuando carga metadata, el browser ya tiene el primer frame
              setImageLoaded(true);
            }}
            className="absolute inset-0 w-full h-full object-cover"
            style={media.transform ? {
              objectPosition: `${media.transform.position?.x || 50}% ${media.transform.position?.y || 50}%`,
              transform: `scale(${media.transform.scale || 1})`,
              transformOrigin: 'center center'
            } : {}}
          />
        )}
        
        {/* Enhanced Progress Bar - Only show when user has voted on mobile */}
        {shouldShowBars && (
          <motion.div 
            className={cn(
              "absolute inset-x-0 bottom-0 transition-all duration-700 ease-out rounded-t-lg",
              isSelected 
                ? "bg-gradient-to-t from-blue-500/80 via-blue-500/60 to-blue-500/30"
                : isWinner 
                  ? "bg-gradient-to-t from-green-500/80 via-green-500/60 to-green-500/30"
                  : "bg-gradient-to-t from-gray-500/70 via-gray-500/50 to-gray-500/20"
            )}
            initial={{ height: 0 }}
            animate={{ height: `${Math.max(displayPercentage, 15)}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            style={{ 
              transformOrigin: 'bottom',
              minHeight: '60px'
            }}
          />
        )}
        
        {/* Percentage Display for videos - Only show when user has voted on mobile */}
        {shouldShowBars && (
          <motion.div 
            className="absolute top-2 right-2 bg-black/70 text-white px-2 py-1 rounded-full text-xs font-bold z-10"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5, duration: 0.3 }}
          >
            {Math.round(displayPercentage)}%
          </motion.div>
        )}
        {/* Selection Ring with pulse */}
        {isSelected && (
          <motion.div 
            className="absolute inset-0 ring-3 ring-blue-500 rounded-lg"
            animate={{
              ringWidth: ["3px", "5px", "3px"],
              ringOpacity: [0.6, 1, 0.6]
            }}
            transition={{ duration: 1, repeat: Infinity }}
          />
        )}
      </motion.div>
    );
  }

  return (
    <motion.div 
      className={cn("relative w-full rounded-lg overflow-hidden group cursor-pointer hover:scale-105 transition-transform duration-300", heightClass)} 
      onClick={handleClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      {renderMentionedUsers()}
      <img 
        src={cachedImageUrl || media.url} 
        alt="Poll option"
        loading="lazy"
        decoding="async"
        onLoad={(e) => {
          setImageLoaded(true);
          e.target.decode?.().then(() => setImageDecoded(true)).catch(() => setImageDecoded(true));
        }}
        className={cn(
          "w-full h-full object-cover transition-all duration-500",
          !imageDecoded && "scale-105 blur-lg"
        )}
        style={media.transform ? {
          objectPosition: `${media.transform.position?.x || 50}% ${media.transform.position?.y || 50}%`,
          transform: `scale(${imageDecoded ? (media.transform.scale || 1) : 1.05})`,
          transformOrigin: 'center center',
          filter: imageDecoded ? 'none' : 'blur(20px)',
        } : {
          filter: imageDecoded ? 'none' : 'blur(20px)',
        }}
      />
      
      {/* Progress Bar Background - Only show when user has voted on mobile */}
      {shouldShowBars && (
        <motion.div 
          className={cn(
            "absolute inset-x-0 bottom-0 transition-all duration-700 ease-out rounded-t-lg",
            isSelected 
              ? "bg-gradient-to-t from-blue-500/80 via-blue-500/60 to-blue-500/30"
              : isWinner 
                ? "bg-gradient-to-t from-green-500/80 via-green-500/60 to-green-500/30"
                : "bg-gradient-to-t from-gray-500/70 via-gray-500/50 to-gray-500/20"
          )}
          initial={{ height: 0 }}
          animate={{ height: `${Math.max(displayPercentage, 15)}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
          style={{ 
            transformOrigin: 'bottom',
            minHeight: '60px'
          }}
        />
      )}
      
      {/* Percentage Display - Only show when user has voted on mobile */}
      {shouldShowBars && (
        <motion.div 
          className="absolute top-2 right-2 bg-black/70 text-white px-2 py-1 rounded-full text-xs font-bold z-10"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, duration: 0.3 }}
        >
          {Math.round(displayPercentage)}%
        </motion.div>
      )}
      {/* Winner Badge - Moved to progress bar area */}
      {isWinner && totalVotes > 0 && (
        <motion.div 
          className="absolute bottom-3 left-3 bg-green-600 text-white px-3 py-1.5 rounded-full text-sm font-semibold flex items-center gap-1.5 shadow-lg z-10"
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        >
          <Trophy className="w-4 h-4" />
        </motion.div>
      )}

      {/* Hover Overlay */}
      <div className={cn(
        "absolute inset-0 transition-all duration-300 group-hover:bg-black/10"
      )} />

      {/* User Avatar and Percentage Overlay */}
      <div className="absolute top-2 right-2 flex flex-col items-center gap-1">
        <button
          className="group relative transition-transform duration-200 hover:scale-110"
          onClick={(e) => {
            e.stopPropagation();
            if (option.user?.username) {
              navigate(`/profile/${option.user.username}`);
            }
          }}
        >
          <Avatar className={cn(
            "w-8 h-8 ring-2 transition-all cursor-pointer",
            isSelected 
              ? "ring-blue-400"
              : isWinner
                ? "ring-green-400"
                : "ring-white/50"
          )}>
            <AvatarImage src={option.user?.avatar} />
            <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white font-bold text-xs">
              {option.user?.displayName?.charAt(0) || option.id.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          {option.user?.verified && (
            <CheckCircle className="w-3 h-3 text-blue-500 fill-current -mt-1" />
          )}
        </button>
      </div>

      {/* Winner Badge */}
      {isWinner && totalVotes > 0 && (
        <motion.div 
          className="absolute top-2 left-2 bg-green-600 text-white px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-1 shadow-lg"
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        >
          <Trophy className="w-3 h-3" />
        </motion.div>
      )}

      {/* Selection Ring */}
      {isSelected && (
        <motion.div 
          className="absolute inset-0 ring-3 ring-blue-500 rounded-lg"
          animate={{
            ringOpacity: [0.6, 1, 0.6]
          }}
          transition={{ duration: 1, repeat: Infinity }}
        />
      )}
    </motion.div>
  );
};

const PollCard = ({ poll, onVote, onLike, onShare, onComment, onSave, fullScreen = false }) => {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const { getSocialProof, socialProofData } = useAddiction();
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [socialProof, setSocialProof] = useState(null);
  const [showHashtags, setShowHashtags] = useState(false);
  const { shareModal, sharePoll, closeShareModal } = useShare();
  
  // Story state for author avatar ring
  const [authorHasStories, setAuthorHasStories] = useState(false);
  const [authorStoriesData, setAuthorStoriesData] = useState(null);
  const [showAuthorStoryViewer, setShowAuthorStoryViewer] = useState(false);
  
  // Load author stories status
  useEffect(() => {
    const loadAuthorStories = async () => {
      try {
        const authorId = poll.author?.id;
        if (!authorId) return;
        const storiesResponse = await storyService.getUserStories(authorId);
        if (storiesResponse && storiesResponse.total_stories > 0) {
          setAuthorHasStories(true);
          setAuthorStoriesData(storiesResponse);
        } else {
          setAuthorHasStories(false);
          setAuthorStoriesData(null);
        }
      } catch (error) {
        console.error('Error loading author stories in PollCard:', error);
        setAuthorHasStories(false);
        setAuthorStoriesData(null);
      }
    };
    loadAuthorStories();
  }, [poll.author?.id]);
  
  // Convert layout ID to CSS grid classes for feed
  const getLayoutGridClass = () => {
    const layout = poll.layout || 'vertical'; // Default to vertical if no layout
    
    // Debug logging for horizontal layout issues
    if (poll.title && poll.title.includes('ARRIBA Y ABAJO')) {
      console.log(`🔥 POLLCARD DEBUG - Poll: "${poll.title}"`);
      console.log(`   Layout from DB: "${layout}"`);
      console.log(`   Will use grid-cols-1 for horizontal layout`);
    }
    
    switch (layout) {
      case 'off':
        return 'grid-cols-1';
      case 'vertical': // "Lado a lado" - 2 elementos horizontalmente
        return 'grid-cols-2';
      case 'horizontal': // "Arriba y abajo" - 2 elementos verticalmente
        console.log(`🔥 POLLCARD HORIZONTAL: Using grid-cols-1 with grid-template-rows`);
        return 'grid-cols-1'; // Use 1 column, styles will add rows
      case 'triptych-vertical': // "Lado a lado" - 3 elementos horizontalmente
        return 'grid-cols-3';
      case 'triptych-horizontal': // "Arriba y abajo" - 3 elementos verticalmente
        return 'grid-cols-1'; // Use 1 column, styles will add rows
      case 'grid-2x2':
        return 'grid-cols-2';
      case 'grid-3x2': // 3 columnas x 2 filas
        return 'grid-cols-3';
      case 'horizontal-3x2': // 2 columnas x 3 filas
        return 'grid-cols-2';
      default:
        return 'grid-cols-2'; // Default fallback
    }
  };

  // Get inline grid style for layouts that need specific row configuration
  const getGridStyle = () => {
    const layout = poll.layout || 'vertical';
    const baseStyle = { gap: '12px' }; // 3 = 12px in Tailwind
    
    // Debug logging for horizontal layout
    if (poll.title && poll.title.includes('ARRIBA Y ABAJO')) {
      console.log(`🔥 POLLCARD getGridStyle called for: "${poll.title}"`);
      console.log(`   Layout: "${layout}"`);
    }
    
    switch (layout) {
      case 'horizontal': // "Arriba y abajo" - 2 elementos verticalmente
        const horizontalStyle = { ...baseStyle, gridTemplateRows: 'repeat(2, 1fr)' };
        if (poll.title && poll.title.includes('ARRIBA Y ABAJO')) {
          console.log(`   Applying horizontal style:`, horizontalStyle);
        }
        return horizontalStyle;
      case 'triptych-horizontal': // "Arriba y abajo" - 3 elementos verticalmente  
        return { ...baseStyle, gridTemplateRows: 'repeat(3, 1fr)' };
      case 'grid-2x2':
        return { ...baseStyle, gridTemplateRows: 'repeat(2, 1fr)' };
      case 'grid-3x2': // 3 columnas x 2 filas
        return { ...baseStyle, gridTemplateRows: 'repeat(2, 1fr)' };
      case 'horizontal-3x2': // 2 columnas x 3 filas
        return { ...baseStyle, gridTemplateRows: 'repeat(3, 1fr)' };
      default:
        return baseStyle;
    }
  };
  
  // Get social proof for this poll from socialProofData
  const currentSocialProof = socialProofData[poll.id] || socialProof;

  const handleVote = async (optionId) => {
    if (!poll.userVote) {
      onVote(poll.id, optionId);
    }
  };

  const handleLike = async () => {
    onLike(poll.id);
  };

  const handleShare = async () => {
    // Intentar usar Web Share API primero (mejor para móviles)
    if (navigator.share) {
      try {
        await navigator.share({
          title: poll.question || 'Vota en esta encuesta',
          text: 'Mira esta increíble votación',
          url: `${window.location.origin}/poll/${poll.id}`,
        });
        // Si Web Share API funciona, también ejecutar callback para estadísticas
        onShare && onShare(poll.id);
        return;
      } catch (err) {
        // Si el usuario cancela el share, no mostrar error
        if (err.name !== 'AbortError') {
          console.log('Error al compartir:', err);
        }
      }
    }
    
    // Si Web Share API no está disponible, abrir modal de compartir
    sharePoll(poll);
    // También ejecutar callback para estadísticas
    onShare && onShare(poll.id);
  };

  const handleSave = async () => {
    if (onSave) {
      onSave(poll.id);
    }
  };

  const handleComment = () => {
    setShowCommentsModal(true);
  };

  // Handle avatar click - open stories if unviewed, go to profile if all viewed
  const handleAvatarClick = (e) => {
    e.stopPropagation();
    
    // If has stories and has unviewed stories, open story viewer
    if (authorStoriesData && authorStoriesData.has_unviewed) {
      audioManager.pause(); // Pause feed audio when opening stories
      setShowAuthorStoryViewer(true);
    } else {
      // Navigate to profile if no stories or all stories viewed
      const authorId = poll.author?.id;
      // If it's the current user, navigate without param so isOwnProfile works
      if (authUser && (authorId === authUser.id)) {
        navigate('/profile');
      } else {
        const username = poll.author?.username || poll.author?.display_name?.toLowerCase().replace(/\s+/g, '_');
        if (username) {
          navigate(`/profile/${username}`);
        }
      }
    }
  };
  
  // Handle story viewer close - reload stories to update viewed status
  const handleStoryViewerClose = async () => {
    setShowAuthorStoryViewer(false);
    audioManager.resume(); // Resume feed audio when closing stories
    // Reload stories to update viewed status
    try {
      const authorId = poll.author?.id;
      if (authorId) {
        const storiesResponse = await storyService.getUserStories(authorId);
        if (storiesResponse && storiesResponse.total_stories > 0) {
          setAuthorHasStories(true);
          setAuthorStoriesData(storiesResponse);
        } else {
          setAuthorHasStories(false);
          setAuthorStoriesData(null);
        }
      }
    } catch (error) {
      console.error('Error reloading author stories in PollCard:', error);
    }
  };

  const formatNumber = (num) => {
    // Handle undefined, null, or non-numeric values
    if (num === undefined || num === null || isNaN(num)) {
      return '0';
    }
    
    const numValue = Number(num);
    if (numValue >= 1000000) {
      return `${(numValue / 1000000).toFixed(1)}M`;
    }
    if (numValue >= 1000) {
      return `${(numValue / 1000).toFixed(1)}K`;
    }
    return numValue.toString();
  };

  // YouTube-style normalized percentages that always total 100%
  const normalizedPercentages = useMemo(() => {
    if (!poll.options || poll.options.length === 0 || poll.totalVotes === 0) {
      return poll.options?.map(() => 0) || [];
    }

    // Calculate raw percentages
    const rawPercentages = poll.options.map(option => (option.votes / poll.totalVotes) * 100);
    
    // Round all percentages
    const roundedPercentages = rawPercentages.map(p => Math.round(p));
    
    // Calculate the difference from 100%
    const currentTotal = roundedPercentages.reduce((sum, p) => sum + p, 0);
    const difference = 100 - currentTotal;
    
    // Adjust the largest percentage to make total exactly 100%
    if (difference !== 0 && roundedPercentages.length > 0) {
      const maxIndex = rawPercentages.indexOf(Math.max(...rawPercentages));
      roundedPercentages[maxIndex] = Math.max(0, roundedPercentages[maxIndex] + difference);
    }
    
    // Validation: Ensure total is exactly 100% (for debugging)
    const finalTotal = roundedPercentages.reduce((sum, p) => sum + p, 0);
    if (process.env.NODE_ENV === 'development' && finalTotal !== 100 && poll.totalVotes > 0) {
      console.warn(`Poll ${poll.id} percentages don't sum to 100%: ${finalTotal}%`, {
        roundedPercentages,
        rawPercentages,
        totalVotes: poll.totalVotes
      });
    }
    
    return roundedPercentages;
  }, [poll.options, poll.totalVotes, poll.id]);

  const getPercentage = (votes, optionIndex) => {
    if (poll.totalVotes === 0) return 0;
    return normalizedPercentages[optionIndex] || 0;
  };

  const getPercentageDisplay = (votes, optionIndex) => {
    if (poll.totalVotes === 0) return "0%";
    const percentage = normalizedPercentages[optionIndex] || 0;
    return `${percentage}%`;
  };

  // Extract hashtags from title
  const extractHashtags = (text) => {
    if (!text) return [];
    const hashtagRegex = /#[\w\u00c0-\u024f\u1e00-\u1eff]+/gi;
    return text.match(hashtagRegex) || [];
  };

  // Remove hashtags from title for clean display
  const getCleanTitle = (text) => {
    if (!text) return '';
    return text.replace(/#[\w\u00c0-\u024f\u1e00-\u1eff]+/gi, '').trim();
  };

  const hashtags = useMemo(() => extractHashtags(poll.title), [poll.title]);
  const cleanTitle = useMemo(() => getCleanTitle(poll.title), [poll.title]);

  const toggleHashtags = () => {
    setShowHashtags(!showHashtags);
  };

  const winningOption = useMemo(() => {
    if (!poll.options || poll.options.length === 0) {
      return null;
    }
    return poll.options.reduce((max, option) => 
      option.votes > max.votes ? option : max
    );
  }, [poll.options]);

  if (fullScreen) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="w-full h-full max-h-[90vh] group bg-white/95 backdrop-blur-sm border border-white/20 shadow-2xl overflow-hidden flex flex-col rounded-xl relative">
          <CardContent className="p-0 flex flex-col h-full">
            {/* Header - Compact for full screen */}
            <div className="flex items-center justify-between p-4 pb-3 flex-shrink-0 bg-white/90 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <button
                  className="group relative w-10 h-10 rounded-full"
                  onClick={handleAvatarClick}
                >
                  {authorHasStories && (
                    <div className={`absolute inset-0 rounded-full ${
                      authorStoriesData?.has_unviewed
                        ? 'bg-gradient-to-tr from-[#6366F1] via-[#8B5CF6] to-[#B061FF]'
                        : 'bg-gray-300'
                    }`}
                      style={{
                        WebkitMaskImage: 'radial-gradient(circle, transparent 18.5px, black 19px)',
                        maskImage: 'radial-gradient(circle, transparent 18.5px, black 19px)'
                      }}
                    />
                  )}
                  <div className="absolute rounded-full overflow-hidden" style={{ inset: '3.5px' }}>
                    <Avatar className="w-full h-full cursor-pointer">
                      <AvatarImage src={resolveAssetUrl(poll.author?.avatar_url) || "https://github.com/shadcn.png"} className="object-cover" />
                      <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white font-semibold text-sm">
                        {(poll.author?.display_name || poll.author?.username || 'U').charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                </button>
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm">{poll.author?.display_name || poll.author?.username || 'Usuario'}</h3>
                  <p className="text-xs text-gray-500">{poll.timeAgo}</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" className="hover:bg-gray-100 h-8 w-8 p-0">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </div>

            {/* Removed Social Proof Badge */}

            {/* Poll Title - Compact */}
            <div className="px-4 pb-3 flex-shrink-0 bg-white/90 backdrop-blur-sm">
              <h2 
                className="text-base font-bold text-gray-900 leading-tight line-clamp-2 cursor-pointer hover:text-blue-600 transition-colors"
                onClick={toggleHashtags}
              >
                {renderTextWithHashtags(cleanTitle || poll.title, navigate)}
              </h2>
              
              {/* Hashtags that appear when title is clicked */}
              {showHashtags && hashtags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {hashtags.map((tag, index) => (
                    <span
                      key={`tag-${tag}-${index}`}
                      className="inline-block px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-800 text-xs font-medium rounded-full cursor-pointer transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        // Navigate to hashtag search
                        navigate(`/search?q=${encodeURIComponent(tag)}&filter=hashtags`);
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              
              {/* Option Descriptions Summary */}
              {poll.options && poll.options.some(opt => opt.text && opt.text.trim()) && (
                <div className="mt-2">
                  <div className="flex flex-wrap gap-1">
                    {poll.options.filter(opt => opt.text && opt.text.trim()).slice(0, 2).map((option, index) => (
                      <span key={option.id || `opt-desc-${index}`} className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded-full">
                        {option.text.length > 20 ? `${option.text.substring(0, 20)}...` : option.text}
                      </span>
                    ))}
                    {poll.options.filter(opt => opt.text && opt.text.trim()).length > 2 && (
                      <span className="text-xs text-gray-500">
                        +{poll.options.filter(opt => opt.text && opt.text.trim()).length - 2} más
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Mentioned users moved to options */}
              



            </div>

            {/* Media Grid - Takes most space */}
            <div className="px-4 pb-4 flex-1 flex flex-col justify-center min-h-0">
              <div className={`grid ${getLayoutGridClass()} h-full max-h-80`} style={getGridStyle()}>
                {poll.options.map((option, index) => {
                  const percentage = getPercentage(option.votes, index);
                  const isWinner = option.id === winningOption.id && poll.totalVotes > 0;
                  const isSelected = poll.userVote === option.id;

                  return (
                    <div key={option.id} className="space-y-2 flex flex-col h-full min-h-0">
                      {/* Media Preview - Responsive height */}
                      <div className="relative flex-1 min-h-[120px]">
                        <MediaPreview 
                          media={option.media}
                          isWinner={isWinner}
                          isSelected={isSelected}
                          onClick={() => handleVote(option.id)}
                          percentage={percentage}
                          option={option}
                          totalVotes={poll.totalVotes}
                          userVote={poll.userVote}
                          fullScreen={true}
                          globalMentions={poll.mentioned_users}
                        />
                      </div>
                      
                      {/* Option Text */}
                      <div className="px-1 flex-shrink-0">
                        <div className="text-center">
                          <p className={cn(
                            "text-xs font-medium leading-tight text-center line-clamp-2",
                            isSelected 
                              ? "text-blue-800"
                              : isWinner && poll.totalVotes > 0
                                ? "text-green-800"
                                : "text-gray-800"
                          )}>
                            {option.text}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Vote Count - Compact */}
            <div className="px-4 pb-2 flex-shrink-0 bg-white/90 backdrop-blur-sm">
              <p className="text-xs text-gray-600 font-medium">
                {formatNumber(poll.totalVotes)} votos
              </p>
            </div>

            {/* Social Actions - Compact and sticky */}
            <div className="flex items-center justify-between px-4 py-3 bg-white/95 backdrop-blur-sm border-t border-gray-100 flex-shrink-0">
              <div className="flex items-center gap-4">
                <motion.div whileTap={{ scale: 0.95 }}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleLike}
                    className={cn(
                      "flex items-center gap-2 hover:scale-105 transition-transform h-8 px-2",
                      poll.userLiked 
                        ? "text-red-600 hover:text-red-700" 
                        : "text-gray-600 hover:text-red-600"
                    )}
                  >
                    <Heart className={cn(
                      "w-4 h-4 transition-all",
                      poll.userLiked && "fill-current"
                    )} />
                    <span className="font-medium text-xs">{formatNumber(poll.likes)}</span>
                  </Button>
                </motion.div>
                
                <motion.div whileTap={{ scale: 0.95 }}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleComment}
                    className="flex items-center gap-2 text-gray-600 hover:text-blue-600 hover:scale-105 transition-transform h-8 px-2"
                  >
                    <MessageCircle className="w-4 h-4" />
                    {(poll.comments_enabled !== false && poll.commentsEnabled !== false) && (
                      <span className="font-medium text-xs">{formatNumber(poll.comments)}</span>
                    )}
                  </Button>
                </motion.div>
              </div>

              <div className="flex items-center gap-2">
                <motion.div whileTap={{ scale: 0.95 }}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleShare}
                    className="flex items-center gap-2 text-gray-600 hover:text-green-600 hover:scale-105 transition-transform h-8 px-2"
                  >
                    <Share2 className="w-4 h-4" />
                    <span className="font-medium text-xs">{formatNumber(poll.shares)}</span>
                  </Button>
                </motion.div>

                {onSave && (
                  <motion.div whileTap={{ scale: 0.95 }}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleSave}
                      className="flex items-center gap-2 text-gray-600 hover:text-blue-600 hover:scale-105 transition-transform h-8 px-2"
                    >
                      <Bookmark className="w-4 h-4" />
                      <span className="font-medium text-xs">Guardar</span>
                    </Button>
                  </motion.div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <CommentsModal
          isOpen={showCommentsModal}
          onClose={() => setShowCommentsModal(false)}
          pollId={poll.id}
          pollTitle={poll.title}
          pollAuthor={poll.author}
        />

        <ShareModal
          isOpen={shareModal.isOpen}
          onClose={closeShareModal}
          content={shareModal.content}
        />
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="group hover:shadow-2xl transition-all duration-500 transform bg-gradient-to-br from-white to-gray-50 border-0 shadow-lg overflow-hidden relative">
        <CardContent className="p-0">
          {/* Header */}
          <div className="flex items-center justify-between p-4 pb-2">
            <div className="flex items-center gap-3">
              <button
                className="group relative w-12 h-12 rounded-full"
                onClick={handleAvatarClick}
              >
                {authorHasStories && (
                  <div className={`absolute inset-0 rounded-full ${
                    authorStoriesData?.has_unviewed
                      ? 'bg-gradient-to-tr from-[#6366F1] via-[#8B5CF6] to-[#B061FF]'
                      : 'bg-gray-300'
                  }`}
                    style={{
                      WebkitMaskImage: 'radial-gradient(circle, transparent 22.5px, black 23px)',
                      maskImage: 'radial-gradient(circle, transparent 22.5px, black 23px)'
                    }}
                  />
                )}
                <div className="absolute rounded-full overflow-hidden" style={{ inset: '3.5px' }}>
                  <Avatar className="w-full h-full cursor-pointer">
                    <AvatarImage src={resolveAssetUrl(poll.author?.avatar_url) || "https://github.com/shadcn.png"} className="object-cover" />
                    <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white font-semibold">
                      {(poll.author?.display_name || poll.author?.username || 'U').charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </div>
              </button>
              <div>
                <h3 className="font-semibold text-gray-900">{poll.author?.display_name || poll.author?.username || 'Usuario'}</h3>
                <p className="text-sm text-gray-500">{poll.timeAgo}</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="hover:bg-gray-100">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </div>

          {/* Social Proof Badge - REMOVED: Component deleted during cleanup */}
          {/* {currentSocialProof && (
            <div className="px-4 pb-3">
              <SocialProofBadge 
                pollId={poll.id}
                socialProof={currentSocialProof}
                onLoadProof={getSocialProof}
              />
            </div>
          )} */}

          {/* Poll Title */}
          <div className="px-4 pb-4">
            <h2 
              className="text-xl font-bold text-gray-900 leading-tight cursor-pointer hover:text-blue-600 transition-colors"
              onClick={toggleHashtags}
            >
              {renderTextWithHashtags(cleanTitle || poll.title, navigate)}
            </h2>
            
            {/* Hashtags that appear when title is clicked */}
            {showHashtags && hashtags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {hashtags.map((tag, index) => (
                  <span
                    key={`tag-${tag}-${index}`}
                    className="inline-block px-3 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-800 text-sm font-medium rounded-full cursor-pointer transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      // Navigate to hashtag search
                      navigate(`/search?q=${encodeURIComponent(tag)}&filter=hashtags`);
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Mentioned users moved to options */}

          {/* Media Grid - Similar to second reference image */}
          <div className="px-4 pb-4">
            <div className={`grid ${getLayoutGridClass()}`} style={getGridStyle()}>
              {poll.options.map((option, index) => {
                const percentage = getPercentage(option.votes, index);
                const isWinner = option.id === winningOption.id && poll.totalVotes > 0;
                const isSelected = poll.userVote === option.id;

                return (
                  <div key={option.id} className="space-y-2">
                    {/* Media Preview with Overlay Progress */}
                    <MediaPreview 
                      media={option.media}
                      isWinner={isWinner}
                      isSelected={isSelected}
                      onClick={() => handleVote(option.id)}
                      percentage={percentage}
                      option={option}
                      totalVotes={poll.totalVotes}
                      userVote={poll.userVote}
                    />
                    
                    {/* Option Text */}
                    <div className="px-1">
                      <div className="text-center">
                        <p className={cn(
                          "text-sm font-medium leading-tight text-center",
                          isSelected 
                            ? "text-blue-800"
                            : isWinner && poll.totalVotes > 0
                              ? "text-green-800"
                              : "text-gray-800"
                        )}>
                          {option.text}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Vote Count */}
          <div className="px-4 pb-3">
            <p className="text-sm text-gray-600 font-medium">
              {formatNumber(poll.totalVotes)} votos
            </p>
          </div>

          {/* Social Actions */}
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50/50 border-t border-gray-100">
            <div className="flex items-center gap-6">
              <motion.div whileTap={{ scale: 0.95 }}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLike}
                  className={cn(
                    "flex items-center gap-2 hover:scale-105 transition-transform",
                    poll.userLiked 
                      ? "text-red-600 hover:text-red-700" 
                      : "text-gray-600 hover:text-red-600"
                  )}
                >
                  <Heart className={cn(
                    "w-5 h-5 transition-all",
                    poll.userLiked && "fill-current"
                  )} />
                  <span className="font-medium">{formatNumber(poll.likes)}</span>
                </Button>
              </motion.div>
              
              <motion.div whileTap={{ scale: 0.95 }}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleComment}
                  className="flex items-center gap-2 text-gray-600 hover:text-blue-600 hover:scale-105 transition-transform"
                >
                  <MessageCircle className="w-5 h-5" />
                  {(poll.comments_enabled !== false && poll.commentsEnabled !== false) && (
                    <span className="font-medium">{formatNumber(poll.comments)}</span>
                  )}
                </Button>
              </motion.div>
            </div>

            <div className="flex items-center gap-2">
              <motion.div whileTap={{ scale: 0.95 }}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleShare}
                  className="flex items-center gap-2 text-gray-600 hover:text-green-600 hover:scale-105 transition-transform"
                >
                  <Share2 className="w-5 h-5" />
                  <span className="font-medium">{formatNumber(poll.shares)}</span>
                </Button>
              </motion.div>

              {onSave && (
                <motion.div whileTap={{ scale: 0.95 }}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSave}
                    className="flex items-center gap-2 text-gray-600 hover:text-blue-600 hover:scale-105 transition-transform"
                  >
                    <Bookmark className="w-5 h-5" />
                    <span className="font-medium">Guardar</span>
                  </Button>
                </motion.div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modal de comentarios */}
      <CommentsModal
        isOpen={showCommentsModal}
        onClose={() => setShowCommentsModal(false)}
        pollId={poll.id}
        pollTitle={poll.title}
        pollAuthor={poll.author}
      />

      <ShareModal
        isOpen={shareModal.isOpen}
        onClose={closeShareModal}
        content={shareModal.content}
      />
      
      {/* Story Viewer - Portal to escape stacking context */}
      {showAuthorStoryViewer && authorStoriesData && createPortal(
        <StoriesViewer
          storiesGroups={[authorStoriesData]}
          onClose={handleStoryViewerClose}
          initialUserIndex={0}
        />,
        document.body
      )}
    </motion.div>
  );
};

export default React.memo(PollCard);