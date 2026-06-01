import React, { useState, useEffect, useCallback, useRef } from "react";
import { useLocation, useSearchParams } from 'react-router-dom';
import TikTokScrollView from '../components/TikTokScrollView';
import FeedSkeleton from '../components/FeedSkeleton';
import MOCK_POLLS from '../mock/mockPolls';
import PollCard from '../components/PollCard';
import CommentsModal from '../components/CommentsModal';
import ShareModal from '../components/ShareModal';
import CustomLogo from '../components/CustomLogo';
import LogoWithQuickActions from '../components/LogoWithQuickActions';
// import StoriesContainer from '../components/StoriesContainer'; // Removed - Stories feature disabled
import pollService from '../services/pollService';
import savedPollsService from '../services/savedPollsService';
import feedCache from '../services/feedCacheService';
import thumbnailPrefetch from '../services/thumbnailPrefetchService';
import feedMediaPrefetcher from '../services/feedMediaPrefetcher';
import audioMetadataCacheStore from '../services/audioMetadataCacheService';
import FeedOfflineToast from '../components/common/FeedOfflineToast';
import { useToast } from '../hooks/use-toast';
import { useAddiction } from '../contexts/AddictionContext';
import { useTikTok } from '../contexts/TikTokContext';
import { useShare } from '../hooks/useShare';
import { useAuth } from '../contexts/AuthContext';
import useLivePoll from '../hooks/useLivePoll';
import useNetworkStatus from '../hooks/useNetworkStatus';
import {
  getFeedSnapshot,
  setFeedSnapshot,
  updateFeedSnapshotActiveIndex,
} from '../lib/feedSnapshot';
import { Plus } from 'lucide-react';
import { cn } from '../lib/utils';
import { useTranslation } from '../hooks/useTranslation';
import { isVSPost } from '../utils/postFilters';

const FeedPage = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // 🎯 Hidratación desde snapshot — si el usuario ya estaba viendo el feed y
  // vuelve (navegó a profile, búsqueda, etc.), restauramos polls + posición.
  const hydratedSnapshot = getFeedSnapshot();
  const hasHydrated = useRef(Boolean(hydratedSnapshot && hydratedSnapshot.polls?.length));

  // ⚡ SKELETON: generar N placeholders instantáneos para renderizar
  // TikTokScrollView en el mismo frame, SIN esperar al backend.
  // El fetch real reemplaza estos skeletons progresivamente.
  // En conexión lenta usamos más skeletons para dar margen; en rápida menos.
  const { isOnline, isSlowConnection, effectiveType } = useNetworkStatus();
  const SKELETON_COUNT = isSlowConnection ? 20 : 15;
  const generateSkeletons = () => Array.from({ length: SKELETON_COUNT }, (_, i) => ({
    id: `skeleton-${i}`,
    isSkeleton: true,
    title: '',
    options: [],
    author: {},
    totalVotes: 0,
    likes: 0,
    shares: 0,
    comments_count: 0,
    saves_count: 0,
    music: null,
    layout: null,
    created_at: new Date().toISOString(),
  }));

  const [polls, setPolls] = useState(MOCK_POLLS); // 🚀 INSTANTÁNEO - 30 publicaciones listas
  const [isLoading, setIsLoading] = useState(false); // ✅ Ya no necesitamos loading
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [showSkeleton, setShowSkeleton] = useState(false); // ✅ No mostrar skeletons con mock
  const [skeletonCount, setSkeletonCount] = useState(6);

  const [savedPolls, setSavedPolls] = useState(
    hydratedSnapshot?.savedPolls ? new Set(hydratedSnapshot.savedPolls) : new Set()
  );
  
  // 🚀 SPEED OPTIMIZATION: Simple cache for faster subsequent loads
  const [pollsCache, setPollsCache] = useState(() => new Map());
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [selectedPollId, setSelectedPollId] = useState(null);
  const [selectedPollTitle, setSelectedPollTitle] = useState('');
  const [selectedPollAuthor, setSelectedPollAuthor] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [preSelectedAudio, setPreSelectedAudio] = useState(null);

  // 🎯 initialIndex proviene del snapshot para continuar donde lo dejó.
  const [initialIndex, setInitialIndex] = useState(
    hydratedSnapshot?.activeIndex ?? 0
  );
  // activeIndex en vivo, sincronizado con TikTokScrollView
  const activeIndexRef = useRef(hydratedSnapshot?.activeIndex ?? 0);

  const { toast } = useToast();
  const { trackAction } = useAddiction();
  const { enterTikTokMode, exitTikTokMode, isTikTokMode } = useTikTok();
  const { shareModal, sharePoll, closeShareModal } = useShare();
  const { isAuthenticated, user } = useAuth();

  // Detect if we're on mobile or desktop
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

  // 🚀 OFFLINE-FIRST: Cada vez que cambia la lista de polls, persistir en
  // el filesystem nativo (Capacitor) los thumbnails/avatares/posters de TODOS
  // los posts. Es barato (archivos pequeños) y crítico para que el feed se
  // vea correctamente al abrir la APK sin conexión, igual que Instagram.
  // Los vídeos pesados se prefetchan a demanda en handleActiveItemChange.
  useEffect(() => {
    if (!polls || polls.length === 0) return;
    feedMediaPrefetcher.prefetchLightweightForAll(polls);
    // También prefetch los vídeos del primer post + los siguientes 4 (los que
    // el usuario verá inmediatamente al abrir la app).
    feedMediaPrefetcher.prefetchVideosAroundIndex(polls, 0, 4);
  }, [polls]);

  // 🎵 OFFLINE-FIRST: Pre-fetchear metadatos de TODOS los audios extraídos
  // del feed cuando hay red, para que el player funcione offline en cualquier
  // post (incluso los que el usuario aún no ha visualizado). Sin esto, el
  // primer slide del carrusel offline aparece con player roto porque el
  // /api/audio/{id} no responde sin red.
  useEffect(() => {
    if (!polls || polls.length === 0) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

    const audioIds = new Set();
    for (const p of polls) {
      if (Array.isArray(p?.options)) {
        for (const opt of p.options) {
          if (opt?.extracted_audio_id) audioIds.add(opt.extracted_audio_id);
        }
      }
      if (p?.music_id) audioIds.add(p.music_id);
    }
    if (audioIds.size === 0) return;

    // Lanzar en background, sin bloquear render. Cap concurrency para no
    // saturar la red en redes móviles lentas.
    const ids = Array.from(audioIds);
    const CONCURRENCY = 4;
    let i = 0;
    const worker = async () => {
      while (i < ids.length) {
        const id = ids[i++];
        try {
          // Si ya está en disco y reciente, get() devuelve hit y nos saltamos red.
          const existing = await audioMetadataCacheStore.get(id);
          if (existing && existing.public_url) continue;
          const res = await fetch(
            `${process.env.REACT_APP_BACKEND_URL}/api/audio/${id}`,
            { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } },
          );
          if (!res.ok) continue;
          const data = await res.json();
          const audioData = data?.audio || data;
          if (audioData) {
            audioMetadataCacheStore.set(id, audioData).catch(() => {});
          }
        } catch { /* offline / error → ignorar */ }
      }
    };
    Promise.all(Array.from({ length: CONCURRENCY }, () => worker())).catch(() => {});
  }, [polls]);

  // Load polls from backend — SIN SPINNER, reemplaza skeletons silenciosamente
  useEffect(() => {
    const loadPolls = async () => {
      if (hasHydrated.current && !searchParams.get('post')) {
        hasHydrated.current = false;
        skeletonsRenderedRef.current = true;
        // Background refresh incluso para snapshot
        pollService.getPollsForFrontend({ limit: 30 }).then(fresh => {
          if (Array.isArray(fresh) && fresh.length > 0) setPolls(fresh);
        }).catch(() => {});
        return;
      }

      const cacheKey = 'feed_initial_30';
      
      // ⚡ FASE 1: Intentar cache en memoria (ultra rápido)
      const cachedPolls = pollsCache.get(cacheKey);
      if (cachedPolls && (Date.now() - cachedPolls.timestamp) < 120000) {
        if (cachedPolls.data.some(p => !p.isSkeleton)) {
          setPolls(cachedPolls.data);
        }
        // Fetch fresco en background
        pollService.getPollsForFrontend({ limit: 30 }).then(freshData => {
          if (!Array.isArray(freshData) || freshData.length === 0) return;
          setPollsCache(prev => new Map(prev.set(cacheKey, { data: freshData, timestamp: Date.now() })));
          setPolls(freshData);
          feedCache.setCachedFeed(freshData, 'main').catch(() => {});
        }).catch(() => {});
        skeletonsRenderedRef.current = true;
        return;
      }

      // ⚡ FASE 2: Intentar cache persistente (disco)
      try {
        const diskCache = await feedCache.getCachedFeed('main');
        if (diskCache && diskCache.polls.length > 0) {
          setPollsCache(prev => new Map(prev.set(cacheKey, { data: diskCache.polls, timestamp: Date.now() })));
          setPolls(diskCache.polls);
          // Refresh en background
          pollService.getPollsForFrontend({ limit: 30 }).then(freshData => {
            if (!Array.isArray(freshData) || freshData.length === 0) return;
            setPollsCache(prev => new Map(prev.set(cacheKey, { data: freshData, timestamp: Date.now() })));
            setPolls(freshData);
            feedCache.setCachedFeed(freshData, 'main').catch(() => {});
          }).catch(() => {});
          skeletonsRenderedRef.current = true;
          return;
        }
      } catch (_) {}

      // ⚡ FASE 3: No hay cache — los skeletons ya están visibles.
      // Fetch desde red en background.
      try {
        const pollsData = await pollService.getPollsForFrontend({ limit: 30 });
        if (Array.isArray(pollsData) && pollsData.length > 0) {
          setPollsCache(prev => new Map(prev.set(cacheKey, { data: pollsData, timestamp: Date.now() })));
          setPolls(pollsData);
          feedCache.setCachedFeed(pollsData, 'main').catch(() => {});
          
          // Check for specific post in URL
          const postId = searchParams.get('post');
          if (postId) {
            const postIndex = pollsData.findIndex(poll => poll.id === postId);
            if (postIndex !== -1) {
              setInitialIndex(postIndex);
            }
          }
        }
      } catch (err) {
        // Fallback a cache de disco aunque sea viejo
        try {
          const fallback = await feedCache.getCachedFeed('main');
          if (fallback && fallback.polls.length > 0) {
            setPolls(fallback.polls);
            return;
          }
        } catch (_) {}
        setError(err.message);
      }
      skeletonsRenderedRef.current = true;
    };

    loadPolls();
  }, [isAuthenticated, toast]);

  // 🔄 Handler de pull-to-refresh: fuerza recarga desde la red (salta caches)
  // y reemplaza el feed por los datos más frescos. Se invoca cuando el
  // usuario arrastra hacia abajo estando en el primer slide.
  const handleRefresh = useCallback(async () => {
    try {
      console.log('🔄 [FeedPage] Pull-to-refresh triggered');
      setCurrentPage(0);
      setHasMoreContent(true);
      const freshData = await pollService.getPollsForFrontend({ limit: 30 });
      // 🔧 OFFLINE FIX: si el refresh devuelve [] no sobrescribimos el feed
      // (mantenemos los posts cacheados visibles para el usuario).
      if (!Array.isArray(freshData) || freshData.length === 0) {
        console.warn('⚠️ [FeedPage] Pull-to-refresh devolvió 0 posts — manteniendo feed actual');
        toast({
          title: 'No hay nuevas votaciones',
          description: 'Revisa tu conexión o vuelve más tarde.',
        });
        return;
      }
      const cacheKey = 'feed_initial_30';
      setPollsCache(prev => new Map(prev.set(cacheKey, {
        data: freshData,
        timestamp: Date.now()
      })));
      setPolls(freshData);
      feedCache.setCachedFeed(freshData, 'main').catch(() => {});
      console.log(`✅ [FeedPage] Refresh complete: ${freshData.length} polls`);
    } catch (err) {
      console.error('[FeedPage] Refresh error:', err);
      toast({
        title: 'No se pudo actualizar',
        description: 'Revisa tu conexión e inténtalo de nuevo.',
        variant: 'destructive',
      });
    }
  }, [toast]);

  // 🏠 Listener: doble click en Home dispara este evento global → refresh + scroll arriba
  useEffect(() => {
    const onDoubleTapRefresh = () => {
      console.log('🏠 [FeedPage] doubleTapRefresh recibido — refrescando feed y volviendo al inicio');
      setInitialIndex(0);
      activeIndexRef.current = 0;
      handleRefresh();
      toast({
        title: '🔄 Actualizando feed…',
        duration: 1500,
      });
    };
    window.addEventListener('feed:doubleTapRefresh', onDoubleTapRefresh);
    return () => window.removeEventListener('feed:doubleTapRefresh', onDoubleTapRefresh);
  }, [handleRefresh, toast]);

  // 📸 Guardar snapshot del feed (polls + pagination + savedPolls) para poder
  // restaurar la posición cuando el usuario navega a otra página y vuelve.
  useEffect(() => {
    if (!polls || polls.length === 0) return;
    if (isLoading) return;
    setFeedSnapshot({
      polls,
      currentPage,
      hasMoreContent,
      savedPolls: Array.from(savedPolls),
      activeIndex: activeIndexRef.current,
    });
  }, [polls, currentPage, hasMoreContent, savedPolls, isLoading]);

  // 🎯 Callback desde TikTokScrollView: actualiza el índice activo en vivo
  // y lo persiste en el snapshot para la próxima vuelta.
  const handleActiveIndexChange = useCallback((newIndex) => {
    activeIndexRef.current = newIndex;
    updateFeedSnapshotActiveIndex(newIndex);
    // 📥 Prefetch silencioso de los thumbnails de los proximos 3 posts.
    // Asi cuando el usuario llegue a ellos la imagen ya esta en el HTTP
    // cache del WebView → carga instantanea, no se ven rectangulos grises.
    try {
      thumbnailPrefetch.prefetchAroundIndex(polls, newIndex, 3);
    } catch (err) {
      // No bloquear UX si el prefetch falla
      console.debug('[FeedPage] thumbnail prefetch skipped:', err?.message);
    }
    // 💾 Prefetch PERSISTENTE de los vídeos de los próximos posts.
    // En conexión lenta reducimos el lookahead para no saturar ancho de banda.
    const videoLookahead = isSlowConnection ? 2 : 4;
    try {
      feedMediaPrefetcher.prefetchVideosAroundIndex(polls, newIndex, videoLookahead);
    } catch (err) {
      console.debug('[FeedPage] video prefetch skipped:', err?.message);
    }
  }, [polls, isSlowConnection]);

  // 📥 Al cargar/cambiar la lista de polls, prefetchar los primeros 3 thumbnails
  // inmediatamente (antes siquiera de que el usuario scrollee) — esto es lo que
  // hace que el feed se sienta "instantaneo" como TikTok/Instagram.
  useEffect(() => {
    if (!polls || polls.length === 0) return;
    const startIdx = activeIndexRef.current ?? 0;
    try {
      thumbnailPrefetch.prefetchAroundIndex(polls, startIdx, 3);
    } catch (_) {
      /* noop */
    }
  }, [polls]);

  // 🔴 LIVE REFRESH estilo TikTok/Instagram — refrescar contadores de posts visibles cada 15s.
  //
  // Estrategia: re-pedir los primeros N polls (los más probables de estar en pantalla)
  // y mergear SOLO los contadores (likes, comentarios, votos, shares, views), preservando
  // el resto del estado local (userLiked, userVote, media, etc.) para no interrumpir
  // reproducción de vídeo ni pisar optimistic updates.
  const refreshVisiblePollStats = useCallback(async () => {
    // Evitar refrescos inútiles
    if (isLoading) return;
    if (!polls || polls.length === 0) return;
    if (showCommentsModal) return; // el modal de comentarios ya se auto-refresca

    try {
      const TOP_N = Math.min(polls.length, 8);
      const topIds = polls.slice(0, TOP_N).map((p) => p.id);

      // Pedir en paralelo, con tolerancia a fallos individuales
      const freshResults = await Promise.all(
        topIds.map((id) => pollService.refreshPoll(id).catch(() => null))
      );

      const freshById = new Map();
      freshResults.forEach((fresh) => {
        if (fresh && fresh.id) freshById.set(fresh.id, fresh);
      });

      if (freshById.size === 0) return;

      setPolls((prev) =>
        prev.map((p) => {
          const fresh = freshById.get(p.id);
          if (!fresh) return p;
          // Merge de contadores. Mantenemos userLiked/userVote locales (optimistic).
          const mergedOptions = Array.isArray(p.options)
            ? p.options.map((opt) => {
                const fOpt = fresh.options?.find((o) => o.id === opt.id);
                if (!fOpt) return opt;
                return {
                  ...opt,
                  votes: typeof fOpt.votes === 'number' ? fOpt.votes : opt.votes,
                };
              })
            : p.options;

          return {
            ...p,
            likes: typeof fresh.likes === 'number' ? fresh.likes : p.likes,
            comments: typeof fresh.comments === 'number' ? fresh.comments : p.comments,
            shares: typeof fresh.shares === 'number' ? fresh.shares : p.shares,
            totalVotes:
              typeof fresh.totalVotes === 'number' ? fresh.totalVotes : p.totalVotes,
            saves_count:
              typeof fresh.saves_count === 'number' ? fresh.saves_count : p.saves_count,
            options: mergedOptions,
          };
        })
      );
    } catch (_) {
      // silencioso
    }
  }, [polls, isLoading, showCommentsModal]);

  useLivePoll(refreshVisiblePollStats, 15000, {
    enabled: !isLoading && polls.length > 0 && isAuthenticated,
    pauseWhenHidden: true,
    refreshOnFocus: true,
  });

  // Preload more content when user is near the end
  const loadMorePolls = useCallback(async () => {
    if (isLoadingMore || !hasMoreContent) return;

    setIsLoadingMore(true);

    try {
      const nextPage = currentPage + 1;
      const pollsData = await pollService.getPollsForFrontend({ 
        limit: 20,
        offset: nextPage * 30
      });

      if (!Array.isArray(pollsData) || pollsData.length === 0) {
        setHasMoreContent(false);
        return;
      }

      const existingIds = new Set(polls.map(poll => poll.id));
      const newPolls = pollsData.filter(poll => !existingIds.has(poll.id));

      if (newPolls.length > 0) {
        setPolls(prevPolls => [...prevPolls, ...newPolls]);
        setCurrentPage(nextPage);
      }

      if (pollsData.length < 20) {
        setHasMoreContent(false);
      }

    } catch (error) {
      console.error('❌ Error loading more polls:', error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMoreContent, pollService, currentPage, polls, setPolls, setIsLoadingMore, setCurrentPage, setHasMoreContent]);

  // Handle navigation state for pre-selected audio
  useEffect(() => {
    if (location.state?.createPoll) {
      setShowCreateModal(true);
      setPreSelectedAudio(location.state.selectedAudio);
      // Clear the state to prevent reopening on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Activar modo TikTok solo en móvil
  useEffect(() => {
    if (isMobile) {
      enterTikTokMode();
    } else {
      exitTikTokMode();
    }
    
    // Limpiar al desmontar
    return () => {
      if (isMobile) {
        exitTikTokMode();
      }
    };
  }, [isMobile, enterTikTokMode, exitTikTokMode]);

  const handleVote = useCallback(async (pollId, optionId) => {
    if (!isAuthenticated) {
      toast({
        title: t('feed.toast.loginRequired'),
        description: t('feed.toast.loginToVote'),
        variant: "destructive",
      });
      return;
    }

    try {
      // Find the poll to check if it's a challenge
      const targetPoll = polls.find(p => p.id === pollId);
      const isChallenge = targetPoll?.is_challenge && targetPoll?.challenge_id;
      // 🎬 Para posts VS, VSLayout ya envía el voto al endpoint específico
      // /api/vs/{vs_id}/vote y actualiza sus propios stats. Re-votar contra
      // /api/polls/{id}/vote + refreshPoll provoca un setPolls que sustituye
      // el objeto poll entero y desmonta los <video> (el post "se queda
      // lento" al votar en VS con video). Saltamos esa ruta para VS.
      const isVS = isVSPost(targetPoll);

      // Optimistic update
      setPolls(prev => prev.map(poll => {
        if (poll.id === pollId) {
          // Don't allow multiple votes
          if (poll.userVote) return poll;
          
          return {
            ...poll,
            userVote: optionId,
            options: poll.options.map(opt => ({
              ...opt,
              votes: opt.id === optionId ? opt.votes + 1 : opt.votes
            })),
            totalVotes: poll.totalVotes + 1
          };
        }
        return poll;
      }));

      // Send vote to backend - use challenge endpoint for challenges
      let voteResult;
      if (isChallenge) {
        // For challenges, optionId is the participant_id (user_id)
        voteResult = await pollService.voteOnChallenge(targetPoll.challenge_id, optionId);
      } else if (isVS) {
        // VS posts: el voto ya se persistió desde VSLayout en
        // /api/vs/{vs_id}/vote. No volvemos a votar aquí ni refrescamos.
        voteResult = { ok: true, vs: true };
      } else {
        voteResult = await pollService.voteOnPoll(pollId, optionId, {
          optimistic: { option_id: optionId, queued: true },
        });
      }

      // Track action for addiction system
      await trackAction('vote');

      toast({
        title: voteResult?.queued ? "Voto en cola" : "¡Voto registrado!",
        description: voteResult?.queued
          ? "Sin conexión. Se enviará automáticamente cuando vuelvas a estar online."
          : isChallenge 
            ? `Tu voto ha sido contabilizado para ${targetPoll.options.find(o => o.id === optionId)?.text || 'el participante'}`
            : "Tu voto ha sido contabilizado exitosamente",
      });

      // Refresh poll data to get accurate counts (skip for challenges - they use synthetic IDs)
      // y skip si la acción quedó encolada offline (no hay data fresca que buscar)
      // 🎬 Skip también para VS: VSLayout ya gestiona los stats internos via
      // /api/vs/{vs_id} y refrescar aquí desmonta los <video>.
      if (!isChallenge && !isVS && !voteResult?.queued) {
        const updatedPoll = await pollService.refreshPoll(pollId);
        if (updatedPoll) {
          setPolls(prev => prev.map(poll => 
            poll.id === pollId ? updatedPoll : poll
          ));
        }
      }
    } catch (error) {
      console.error('Error voting:', error);
      
      // Revert optimistic update
      setPolls(prev => prev.map(poll => {
        if (poll.id === pollId && poll.userVote === optionId) {
          return {
            ...poll,
            userVote: null,
            options: poll.options.map(opt => ({
              ...opt,
              votes: opt.id === optionId ? opt.votes - 1 : opt.votes
            })),
            totalVotes: poll.totalVotes - 1
          };
        }
        return poll;
      }));
      
      toast({
        title: t('feed.toast.errorVote'),
        description: error.message || "No se pudo registrar tu voto. Intenta de nuevo.",
        variant: "destructive",
      });
    }
  }, [isAuthenticated, toast, t, polls, pollService, trackAction, setPolls]);

  const handleLike = useCallback(async (pollId) => {
    if (!isAuthenticated) {
      toast({
        title: t('feed.toast.loginRequired'),
        description: t('feed.toast.loginToLike'),
        variant: "destructive",
      });
      return;
    }

    try {
      // Optimistic update
      let wasLiked = false;
      let optimisticLikes = 0;
      setPolls(prev => prev.map(poll => {
        if (poll.id === pollId) {
          wasLiked = poll.userLiked;
          optimisticLikes = poll.userLiked ? poll.likes - 1 : poll.likes + 1;
          return {
            ...poll,
            userLiked: !poll.userLiked,
            likes: optimisticLikes
          };
        }
        return poll;
      }));

      // Send like to backend. Pasamos optimistic para que, si la acción se
      // encola por falta de red, el servicio devuelva { liked, likes, queued }
      // y el sync posterior no rompa el estado.
      const result = await pollService.toggleLike(pollId, {
        optimistic: { liked: !wasLiked, likes: optimisticLikes },
      });

      // Track action for addiction system
      await trackAction('like');

      // Update with actual server response (o con el optimista si queued)
      setPolls(prev => prev.map(poll => {
        if (poll.id === pollId) {
          return {
            ...poll,
            userLiked: result.liked,
            likes: result.likes
          };
        }
        return poll;
      }));

      if (result.queued) {
        toast({
          title: t('feed.likeOfflineTitle') || t('feed.toast.likeOfflineTitle'),
          description: t('feed.toast.likeOfflineDesc'),
        });
      } else {
        toast({
          title: result.liked ? t('feed.toast.liked') : t('feed.toast.unliked'),
          description: result.liked ? t('feed.toast.likedDesc') : t('feed.toast.unlikedDesc'),
        });
      }
    } catch (error) {
      console.error('Error liking poll:', error);
      
      // Revert optimistic update
      setPolls(prev => prev.map(poll => {
        if (poll.id === pollId) {
          return {
            ...poll,
            userLiked: !poll.userLiked,
            likes: poll.userLiked ? poll.likes + 1 : poll.likes - 1
          };
        }
        return poll;
      }));
      
      toast({
        title: t('feed.toast.error'),
        description: error.message || "No se pudo procesar el like. Intenta de nuevo.",
        variant: "destructive",
      });
    }
  }, [isAuthenticated, toast, t, pollService, trackAction, setPolls]);

  const handleShare = useCallback(async (pollId) => {
    if (!isAuthenticated) {
      toast({
        title: t('feed.toast.loginRequired'),
        description: t('feed.toast.loginToShare'),
        variant: "destructive",
      });
      return;
    }

    try {
      // Increment share count on backend
      const result = await pollService.sharePoll(pollId);
      
      // Update local state
      setPolls(prev => prev.map(poll => {
        if (poll.id === pollId) {
          return {
            ...poll,
            shares: result.shares
          };
        }
        return poll;
      }));
      
      await trackAction('share');
      
      // Obtener el poll para el modal
      const poll = polls.find(p => p.id === pollId);
      if (!poll) return;
      
      // Intentar usar Web Share API primero (mejor para móviles)
      if (navigator.share) {
        try {
          await navigator.share({
            title: poll.title || 'Vota en esta encuesta',
            text: t('feed.shareText'),
            url: `${window.location.origin}/poll/${pollId}`,
          });
          toast({
            title: t('feed.toast.shared'),
            description: t('feed.toast.sharedDesc'),
          });
          return;
        } catch (err) {
          // Si el usuario cancela el share, no mostrar error
          if (err.name !== 'AbortError') {
            console.log('Error al compartir:', err);
            // Si Web Share API falla, usar modal
            sharePoll(poll);
          }
        }
      } else {
        // Si Web Share API no está disponible, usar modal
        sharePoll(poll);
      }
    } catch (error) {
      console.error('Error sharing poll:', error);
      toast({
        title: t('feed.toast.errorShare'),
        description: error.message || t('feed.toast.shareError'),
        variant: "destructive",
      });
    }
  }, [isAuthenticated, toast, t, pollService, setPolls, trackAction, polls, sharePoll]);

  const handleComment = useCallback(async (pollId) => {
    await trackAction('create');
    const poll = polls.find(p => p.id === pollId);
    if (poll) {
      setSelectedPollId(pollId);
      setSelectedPollTitle(poll.title);
      setSelectedPollAuthor(poll.author);
      setShowCommentsModal(true);
    }
  }, [trackAction, polls, setSelectedPollId, setSelectedPollTitle, setSelectedPollAuthor, setShowCommentsModal]);

  const handleSave = useCallback(async (pollId) => {
    console.log('🔖 FeedPage: handleSave called with pollId:', pollId);
    console.log('🔖 FeedPage: process.env.REACT_APP_BACKEND_URL:', process.env.REACT_APP_BACKEND_URL);
    console.log('🔖 FeedPage: window.location.origin:', window.location.origin);
    
    // Determinar si estamos guardando o desgurdando
    const isSaved = savedPolls.has(pollId);
    const action = isSaved ? 'unsave' : 'save';
    
    // Optimistic update: actualizar el estado de guardado inmediatamente
    setSavedPolls(prev => {
      const newSet = new Set(prev);
      if (isSaved) {
        newSet.delete(pollId);
      } else {
        newSet.add(pollId);
      }
      return newSet;
    });
    
    try {
      // Test with raw fetch and explicit URL first
      const token = localStorage.getItem('token');
      console.log('🔖 FeedPage: Token exists:', !!token);
      console.log('🔖 FeedPage: Token length:', token ? token.length : 0);
      
      const baseUrl = process.env.REACT_APP_BACKEND_URL || window.location.origin;
      const method = isSaved ? 'DELETE' : 'POST';
      const url = `${baseUrl}/api/polls/${pollId}/save`;
      console.log('🔖 FeedPage: Making request to:', url);
      console.log('🔖 FeedPage: Method:', method);
      console.log('🔖 FeedPage: Base URL used:', baseUrl);
      
      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      
      console.log('🔖 FeedPage: Response status:', response.status);
      console.log('🔖 FeedPage: Response ok:', response.ok);
      console.log('🔖 FeedPage: Response URL:', response.url);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('🔖 FeedPage: Error response:', errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const result = await response.json();
      console.log('🔖 FeedPage: Success result:', result);
      
      // Actualizar el contador con el valor del servidor
      if (result.saves_count !== undefined) {
        setPolls(prevPolls => 
          prevPolls.map(poll => 
            poll.id === pollId 
              ? { ...poll, saves_count: result.saves_count }
              : poll
          )
        );
        console.log('🔖 FeedPage: Updated saves_count to:', result.saves_count);
      }
      
      toast({
        title: result.saved ? "¡Publicación guardada!" : "Publicación removida",
        description: result.saved 
          ? "La publicación ha sido guardada en tu colección"
          : "La publicación ha sido removida de tu colección",
        duration: 3000,
      });
      
      await trackAction('save');
      
    } catch (error) {
      console.error('❌ FeedPage: Complete error object:', error);
      console.error('❌ FeedPage: Error name:', error.name);
      console.error('❌ FeedPage: Error message:', error.message);
      console.error('❌ FeedPage: Error stack:', error.stack);
      
      // Revertir estado de guardado en caso de error
      setSavedPolls(prev => {
        const newSet = new Set(prev);
        if (isSaved) {
          newSet.add(pollId);
        } else {
          newSet.delete(pollId);
        }
        return newSet;
      });
      
      toast({
        title: t('feed.toast.error'),
        description: `No se pudo guardar: ${error.message}`,
        variant: "destructive",
        duration: 5000,  
      });
    }
  }, [savedPolls, toast, t, trackAction, setPolls, setSavedPolls]);

  const handleExitTikTok = () => {
    // No hacer nada, ya que queremos mantener siempre el modo TikTok en el feed
    // Opcional: podrías navegar a otra página si quisieras
    return;
  };

  const handleCreatePoll = useCallback(async (newPoll) => {
    if (!isAuthenticated) {
      toast({
        title: t('feed.toast.loginRequired'),
        description: t('feed.toast.loginToCreate'),
        variant: "destructive",
      });
      return;
    }

    try {
      // Handle new poll creation
      const transformedPoll = pollService.transformPollData(newPoll);
      
      // Agregar la nueva votación al inicio de la lista
      setPolls(prev => [transformedPoll, ...prev]);
      
      // Trigger addiction system
      await trackAction('create');
    } catch (error) {
      console.error('Error handling new poll:', error);
      toast({
        title: t('feed.toast.addError'),
        description: error.message || t('feed.toast.addErrorDesc'),
        variant: "destructive",
      });
    }
  }, [isAuthenticated, toast, t, pollService, setPolls, trackAction]);

  if (process.env.NODE_ENV === 'development') {
    console.log('🎬 FeedPage RENDER START:');
    console.log('📊 Current polls.length:', polls.length);
    console.log('💾 isLoading:', isLoading, 'error:', error);
    console.log('🔍 First 2 polls:', polls.slice(0, 2).map(p => ({ 
      id: p?.id, 
      title: p?.title?.substring(0, 50), 
      hasOptions: !!p?.options?.length,
      hasAuthor: !!(p?.author || p?.authorUser)
    })));
  }

  // ⚡ SIN SPINNER: el feed se renderiza siempre con skeletons como fallback
  // El error solo bloquea si no tenemos NINGÚN poll (ni siquiera skeletons)
  if (error && polls.every(p => p.isSkeleton)) {
    const offlineMode = !isOnline;
    return (
      <>
        <div className="fixed top-4 right-4 z-[9999] flex items-center justify-center w-10 h-10"
          style={{ position: 'fixed', top: 'max(16px, calc(var(--safe-area-inset-top) + 8px))', right: '16px', zIndex: 9999 }}>
          <LogoWithQuickActions size={95} />
        </div>
        <FeedOfflineToast />
        <div className="fixed inset-0 z-50 bg-gradient-to-b from-zinc-900 via-zinc-950 to-black flex items-center justify-center">
          <div className="text-center px-6 max-w-sm">
            <div className={cn("w-32 h-32 rounded-full flex items-center justify-center mx-auto mb-8",
              offlineMode ? "bg-gradient-to-br from-zinc-700 to-zinc-900" : "bg-gray-800")}>
              {offlineMode ? (
                <svg className="w-16 h-16 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636L5.636 18.364m12.728 0L5.636 5.636M12 4a8 8 0 100 16 8 8 0 000-16z" />
                </svg>
              ) : (
                <svg className="w-16 h-16 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              )}
            </div>
            <h3 className="text-3xl font-bold text-white mb-4">
              {offlineMode ? t('feed.offlineTitle') : t('feed.errorTitle')}
            </h3>
            <p className="text-white/70 text-base mb-6">{offlineMode ? t('feed.offlineDesc') : error}</p>
            <button onClick={() => window.location.reload()} className="px-6 py-3 bg-purple-500 text-white rounded-full font-medium hover:bg-purple-600 transition-colors">
              {t('feed.retry')}
            </button>
          </div>
        </div>
      </>
    );
  }

  // Si no hay autenticación, redirigir o mostrar login
  if (!isAuthenticated && !polls.some(p => !p.isSkeleton)) {
    return (
      <>
        {/* Logo fijo SIEMPRE VISIBLE - Auth Required */}
        <div 
          className="fixed top-4 right-4 z-[9999] flex items-center justify-center w-10 h-10"
          style={{ 
            position: 'fixed',
            top: 'max(16px, calc(var(--safe-area-inset-top) + 8px))',
            right: '16px',
            zIndex: 9999,
          }}
        >
          <LogoWithQuickActions size={95} />
        </div>

        {/* 🛜 Toast "Sin conexión" — sólo en Feed (Para Ti) */}
        <FeedOfflineToast />
        
        <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
          <div className="text-center px-6">
            <div className="w-32 h-32 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-8">
              <svg className="w-16 h-16 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h3 className="text-3xl font-bold text-white mb-4">{t('feed.loginTitle')}</h3>
            <p className="text-white/70 text-lg mb-6">{t('feed.loginToViewFeed')}</p>
            <button 
              onClick={() => window.location.href = '/auth'}
              className="px-6 py-3 bg-purple-500 text-white rounded-full font-medium hover:bg-purple-600 transition-colors"
            >
              {t('feed.goToLogin')}
            </button>
          </div>
        </div>
      </>
    );
  }
  
  if (process.env.NODE_ENV === 'development') {
    console.log('🚨 DEBUG: Checking polls state before empty check:');
    console.log('📊 Current polls.length:', polls.length);
    console.log('🔍 Current polls sample:', polls.slice(0, 3).map(p => ({ 
      id: p?.id, 
      title: p?.title, 
      author: p?.author?.username || p?.authorUser?.username,
      type: typeof p
    })));
  }
  console.log('💾 isLoading:', isLoading, 'error:', error);
  
  if (polls.length === 0) {
    // Si estamos offline y sin caché → UI dedicada de "Sin conexión"
    const offlineMode = !isOnline;
    return (
      <>
        {/* Logo fijo SIEMPRE VISIBLE - Empty State */}
        <div 
          className="fixed top-4 right-4 z-[9999] flex items-center justify-center w-10 h-10"
          style={{ 
            position: 'fixed',
            top: 'max(16px, calc(var(--safe-area-inset-top) + 8px))',
            right: '16px',
            zIndex: 9999,
          }}
        >
          <LogoWithQuickActions size={95} />
        </div>

        {/* 🛜 Toast "Sin conexión" — sólo en Feed (Para Ti) */}
        <FeedOfflineToast />
        
        <div className="fixed inset-0 z-50 bg-gradient-to-b from-zinc-900 via-zinc-950 to-black flex items-center justify-center">
          <div className="text-center px-6 max-w-sm">
            <div className={cn(
              "w-32 h-32 rounded-full flex items-center justify-center mx-auto mb-8",
              offlineMode
                ? "bg-gradient-to-br from-zinc-700 to-zinc-900"
                : "bg-gray-800"
            )}>
              {offlineMode ? (
                <svg className="w-16 h-16 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636L5.636 18.364m12.728 0L5.636 5.636M12 4a8 8 0 100 16 8 8 0 000-16z" />
                </svg>
              ) : (
                <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              )}
            </div>
            <h3 className="text-3xl font-bold text-white mb-4">
              {offlineMode ? t('feed.offlineTitle') : t('feed.emptyTitle')}
            </h3>
            <p className="text-white/70 text-base mb-6">
              {offlineMode
                ? t('feed.offlineEmptyDesc')
                : t('feed.emptyDesc')}
            </p>
            {offlineMode && (
              <button 
                onClick={() => window.location.reload()}
                className="px-6 py-3 bg-purple-500 text-white rounded-full font-medium hover:bg-purple-600 transition-colors"
              >
                {t('feed.retry')}
              </button>
            )}
          </div>
        </div>
      </>
    );
  }

  // Renderizado móvil (TikTok mode)
  if (isMobile || isTikTokMode) {
    return (
      <>
        {/* Logo fijo SIEMPRE VISIBLE - Mobile TikTok Mode */}
        <div 
          className="fixed top-4 right-4 z-[9999] flex items-center justify-center w-10 h-10"
          style={{ 
            position: 'fixed',
            top: 'max(16px, calc(var(--safe-area-inset-top) + 8px))',
            right: '16px',
            zIndex: 9999,
          }}
        >
          <LogoWithQuickActions size={95} />
        </div>

        {/* Stories overlay - REMOVED (Stories feature disabled) */}
        
        {/* 🚀 ALWAYS USE OPTIMIZED TikTokScrollView - Contenido INSTANTÁNEO */}
        <TikTokScrollView
          polls={polls}
          onVote={handleVote}
          onLike={handleLike}
          onShare={handleShare}
          onComment={handleComment}
          onSave={handleSave}
          onExitTikTok={handleExitTikTok}
          onCreatePoll={handleCreatePoll}
          onLoadMore={loadMorePolls}
          isLoadingMore={isLoadingMore}
          hasMoreContent={true}
          showLogo={false}
          initialIndex={initialIndex}
          onActiveIndexChange={handleActiveIndexChange}
          onRefresh={handleRefresh}
        />
      </>
    );
  }

  // Renderizado desktop (Web layout similar a TikTok web)
  return (
    <>
      {/* Logo fijo SIEMPRE VISIBLE - Desktop Mode */}
      <div 
        className="fixed top-4 right-4 z-[9999] flex items-center justify-center w-10 h-10"
        style={{ 
          position: 'fixed',
          top: '16px',
          right: '16px',
          zIndex: 9999,
        }}
      >
        <LogoWithQuickActions size={42} />
      </div>
      
      <div className="min-h-screen bg-gray-50 pt-6 relative">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('feed.title')}</h1>
          <p className="text-gray-600">{t('feed.subtitle')}</p>
        </div>

        {/* Stories Section - REMOVED (Stories feature disabled) */}

        {/* Feed Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {polls.filter(p => !p.isSkeleton).map((poll) => (
            <div key={poll.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
              <PollCard
                poll={poll}
                onVote={handleVote}
                onLike={handleLike}
                onShare={handleShare}
                onComment={handleComment}
                onSave={handleSave}
                fullScreen={false}
              />
            </div>
          ))}
        </div>

        {/* Load More Button */}
        <div className="text-center mt-12 mb-8">
          <button className="px-8 py-3 bg-pink-500 text-white rounded-full font-medium hover:bg-pink-600 transition-colors">
            {t('feed.loadMore')}
          </button>
        </div>
      </div>

      {/* Comments Modal */}
      <CommentsModal
        isOpen={showCommentsModal}
        onClose={() => setShowCommentsModal(false)}
        pollId={selectedPollId}
        pollTitle={selectedPollTitle}
        pollAuthor={selectedPollAuthor}
      />

      {/* Share Modal */}
      <ShareModal
        isOpen={shareModal.isOpen}
        onClose={closeShareModal}
        content={shareModal.content}
      />

      {/* Create Poll Modal - REMOVED */}

      {/* Floating Create Button */}
      {isAuthenticated && !isLoading && (
        <button
          onClick={() => setShowCreateModal(true)}
          className={`fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center z-40 ${isMobile ? 'bottom-20' : 'bottom-6'}`}
          aria-label={t('feed.createPollAria')}
        >
          <Plus className="w-7 h-7" />
        </button>
      )}
    </>
  );
};

export default FeedPage;