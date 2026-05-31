/**
 * FeedV2Page — página de prueba del Feed V2 (sólo VS).
 *
 * Ruta: /feed-v2 — accesible desde Settings ("Probar Feed V2 (beta)").
 *
 * Arquitectura (UI vs Core):
 *   - Motor fluido: VSFeedSwiper (Swiper Virtual) controla virtualización,
 *     scroll e infinite-scroll.
 *   - UI bonita: se reutiliza `TikTokPollCard` (del feed principal) vía
 *     `VSSlidePretty`, inyectada con el render-prop `renderSlide`.
 *
 * Optimizaciones de fluidez:
 *   - Handlers estables (no dependen de `polls`; leen vía `pollsRef`) →
 *     `renderSlide` permanece estable entre renders.
 *   - Interacciones (guardados/comentados/compartidos) en FeedInteractionContext
 *     → no recrean `renderSlide`.
 *   - Protección de carreras por pollId (pendingActionsRef).
 *   - Guard anti-stale (reqIdRef) + abort en unmount → sin setState tras
 *     desmontar.
 *
 * Paginación: offset/limit (el backend ordena por created_at DESC con
 * .skip().limit(); no soporta cursor `before`).
 */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import VSFeedSwiper from '../components/feedV2/VSFeedSwiper';
import VSFeedTopBar from '../components/feedV2/VSFeedTopBar';
import VSSlidePretty from '../components/feedV2/VSSlidePretty';
import FeedSkeleton from '../components/FeedSkeleton';
import { FeedInteractionProvider } from '../contexts/FeedInteractionContext';
import pollService from '../services/pollService';
import feedMediaPrefetcher from '../services/feedMediaPrefetcher';
import thumbnailPrefetch from '../services/thumbnailPrefetchService';
import { useTikTok } from '../contexts/TikTokContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/use-toast';
import { useAddiction } from '../contexts/AddictionContext';
import { setFastScrolling } from '../utils/scrollVelocityTracker';

const PAGE_SIZE = 20;
const SHOW_SKELETON_UNTIL_MS = 300; // Mostrar skeleton mínimo 300ms para transición suave

export default function FeedV2Page() {
  const navigate = useNavigate();
  const { enterTikTokMode, exitTikTokMode, hideRightNavigationBar, showRightNavigationBar } = useTikTok();
  const [polls, setPolls] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [muted, setMuted] = useState(true);
  const [showSkeleton, setShowSkeleton] = useState(true);

  const { isAuthenticated, user } = useAuth();
  const { toast } = useToast();
  const { trackAction } = useAddiction();
  
  // Timer para mostrar skeleton mínimo (evita flash si carga es rápida)
  const skeletonTimerRef = useRef(null);

  // Refs de control (no provocan re-render)
  const loadingRef = useRef(false);       // evita load-more concurrente
  const offsetRef = useRef(0);            // offset de paginación
  const pollsRef = useRef([]);            // espejo de `polls` para handlers estables
  const pendingActionsRef = useRef(new Set()); // protección de carreras por pollId
  const reqIdRef = useRef(0);             // token para descartar respuestas obsoletas
  const mountedRef = useRef(true);        // ignora setState tras desmontar

  // Mantener pollsRef sincronizado
  useEffect(() => {
    pollsRef.current = polls;
  }, [polls]);
  
  // Control del skeleton loading
  useEffect(() => {
    // Iniciar timer para ocultar skeleton después de carga inicial
    skeletonTimerRef.current = setTimeout(() => {
      setShowSkeleton(false);
    }, SHOW_SKELETON_UNTIL_MS);
    
    return () => {
      if (skeletonTimerRef.current) {
        clearTimeout(skeletonTimerRef.current);
      }
    };
  }, []);

  // ── Prefetch para carga INSTANTÁNEA al hacer scroll ───────────────────────
  // Estrategia (combinación barata + agresiva):
  //   1) Pósters/thumbnails de los próximos slides → aparición visual instantánea.
  //   2) Primeros bytes (hasta 25MB) de los próximos vídeos → reproducción
  //      inmediata cuando el slide se vuelve activo (PollOptionMedia lee de
  //      mediaCache vía useCachedSrc).
  //   3) Cancela prefetches de slides lejanos → libera ancho de banda.
  const prefetchAround = useCallback((index) => {
    const list = pollsRef.current;
    if (!list || list.length === 0) return;
    // Profundidad de prefetch de VÍDEO adaptativa a la red: en 4G precargamos
    // agresivo (sin esperas); en redes lentas reducimos para NO saturar la
    // conexión y que el vídeo ACTIVO no se atasque (el sobre-prefetch puede
    // causar el propio atasco que queremos evitar). Los pósters son baratos.
    let videoAhead = 3;
    try {
      const c = navigator.connection;
      if (c?.saveData) videoAhead = 1;
      else if (c?.effectiveType === '3g') videoAhead = 2;
      else if (c?.effectiveType === '2g' || c?.effectiveType === 'slow-2g') videoAhead = 1;
      else videoAhead = 3; // 4g / desconocido
    } catch (_) {}
    const THUMB_AHEAD = 8; // pósters: baratos, precargamos más para 0 esperas visuales
    // Diferir el trabajo de prefetch fuera del frame de la animación de snap
    // (crear Image(), iniciar fetch...) → scroll más fluido, sin micro-jank.
    const run = () => {
      try { thumbnailPrefetch.prefetchAroundIndex(list, index, THUMB_AHEAD); } catch (_) {}
      try { feedMediaPrefetcher.prefetchVideosAroundIndex(list, index, videoAhead); } catch (_) {}
      try { feedMediaPrefetcher.cancelDistantPolls(index, 4); } catch (_) {}
    };
    if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(run, { timeout: 500 });
    } else {
      setTimeout(run, 60);
    }
  }, []);

  // ── Carga (offset pagination) ────────────────────────────────────────────
  const loadPolls = useCallback(async (isInitial) => {
    if (isInitial) {
      setIsLoading(true);
      offsetRef.current = 0;
    } else {
      setIsLoadingMore(true);
    }
    const reqId = ++reqIdRef.current;
    try {
      const data = await pollService.getPollsForFrontend({
        limit: PAGE_SIZE,
        offset: isInitial ? 0 : offsetRef.current,
      });
      // Descartar si llegó una petición más nueva o el componente se desmontó
      if (!mountedRef.current || reqId !== reqIdRef.current) return;

      const vsOnly = (data || []).filter((p) => p?.layout === 'vs' || p?.vs_id);

      if (isInitial) {
        setPolls(vsOnly);
        offsetRef.current = vsOnly.length;
        setHasMore(vsOnly.length >= PAGE_SIZE);
        setError(null);
        // Prefetch inmediato del contenido inicial (póster + vídeos delante)
        pollsRef.current = vsOnly;
        prefetchAround(0);
        
        // Ocultar skeleton cuando hay datos
        if (vsOnly.length > 0 && skeletonTimerRef.current) {
          clearTimeout(skeletonTimerRef.current);
          skeletonTimerRef.current = setTimeout(() => {
            setShowSkeleton(false);
          }, 100);
        }
      } else if (vsOnly.length === 0) {
        setHasMore(false);
      } else {
        setPolls((prev) => {
          const seen = new Set(prev.map((p) => p.id));
          const fresh = vsOnly.filter((p) => !seen.has(p.id));
          const merged = [...prev, ...fresh];
          // Pósters de la nueva página listos al instante (barato, deduplicado)
          pollsRef.current = merged;
          try { feedMediaPrefetcher.prefetchLightweightForAll?.(merged); } catch (_) {}
          return merged;
        });
        offsetRef.current += vsOnly.length;
        if (vsOnly.length < PAGE_SIZE) setHasMore(false);
      }
    } catch (err) {
      if (!mountedRef.current || reqId !== reqIdRef.current) return;
      console.error('[FeedV2Page] load failed:', err);
      if (isInitial) setError(err.message || 'Error al cargar el feed');
    } finally {
      if (mountedRef.current && reqId === reqIdRef.current) {
        if (isInitial) setIsLoading(false);
        else setIsLoadingMore(false);
      }
    }
  }, [prefetchAround]);

  const handleLoadMore = useCallback(() => {
    if (loadingRef.current || !hasMore) return;
    loadingRef.current = true;
    loadPolls(false).finally(() => {
      loadingRef.current = false;
    });
  }, [hasMore, loadPolls]);

  // ── Handlers de interacción (estables: leen pollsRef, no `polls`) ──────────
  const handleVote = useCallback(async (pollId, optionId) => {
    if (!isAuthenticated) {
      toast?.({ title: 'Inicia sesión', description: 'Necesitas una cuenta para votar', variant: 'destructive' });
      return;
    }
    if (pendingActionsRef.current.has(pollId)) return;
    pendingActionsRef.current.add(pollId);
    const targetPoll = pollsRef.current.find((p) => p.id === pollId);
    const isChallenge = targetPoll?.is_challenge && targetPoll?.challenge_id;
    const isVS = targetPoll?.layout === 'vs' || !!targetPoll?.vs_id;
    try {
      // Optimistic update
      setPolls((prev) => prev.map((poll) => {
        if (poll.id === pollId) {
          if (poll.userVote) return poll;
          return {
            ...poll,
            userVote: optionId,
            options: poll.options.map((opt) => ({ ...opt, votes: opt.id === optionId ? opt.votes + 1 : opt.votes })),
            totalVotes: (poll.totalVotes || 0) + 1,
          };
        }
        return poll;
      }));

      if (isChallenge) {
        await pollService.voteOnChallenge(targetPoll.challenge_id, optionId);
      } else if (!isVS) {
        // VS: el voto ya se persiste en la capa VS; no re-votamos ni refrescamos
        // (refrescar desmontaría los <video> y "ralentizaría" el post).
        await pollService.voteOnPoll(pollId, optionId, { optimistic: { option_id: optionId, queued: true } });
      }
      trackAction?.('vote');

      if (!isChallenge && !isVS) {
        const updatedPoll = await pollService.refreshPoll(pollId);
        if (mountedRef.current && updatedPoll) {
          setPolls((prev) => prev.map((p) => (p.id === pollId ? updatedPoll : p)));
        }
      }
    } catch (err) {
      console.error('[FeedV2] vote failed:', err);
      // Rollback optimista
      setPolls((prev) => prev.map((poll) => {
        if (poll.id === pollId && poll.userVote === optionId) {
          return {
            ...poll,
            userVote: null,
            options: poll.options.map((opt) => ({ ...opt, votes: opt.id === optionId ? opt.votes - 1 : opt.votes })),
            totalVotes: (poll.totalVotes || 1) - 1,
          };
        }
        return poll;
      }));
    } finally {
      pendingActionsRef.current.delete(pollId);
    }
  }, [isAuthenticated, toast, trackAction]);

  const handleLike = useCallback(async (pollId) => {
    if (!isAuthenticated) {
      toast?.({ title: 'Inicia sesión', description: 'Necesitas una cuenta para dar like', variant: 'destructive' });
      return;
    }
    const likeKey = `like:${pollId}`;
    if (pendingActionsRef.current.has(likeKey)) return;
    pendingActionsRef.current.add(likeKey);
    let wasLiked = false;
    let optimisticLikes = 0;
    try {
      setPolls((prev) => prev.map((poll) => {
        if (poll.id === pollId) {
          wasLiked = poll.userLiked;
          optimisticLikes = poll.userLiked ? poll.likes - 1 : poll.likes + 1;
          return { ...poll, userLiked: !poll.userLiked, likes: optimisticLikes };
        }
        return poll;
      }));
      const result = await pollService.toggleLike(pollId, { optimistic: { liked: !wasLiked, likes: optimisticLikes } });
      trackAction?.('like');
      if (mountedRef.current) {
        setPolls((prev) => prev.map((poll) => (poll.id === pollId ? { ...poll, userLiked: result.liked, likes: result.likes } : poll)));
      }
    } catch (err) {
      console.error('[FeedV2] like failed:', err);
      setPolls((prev) => prev.map((poll) => {
        if (poll.id === pollId) {
          return { ...poll, userLiked: !poll.userLiked, likes: poll.userLiked ? poll.likes + 1 : poll.likes - 1 };
        }
        return poll;
      }));
    } finally {
      pendingActionsRef.current.delete(likeKey);
    }
  }, [isAuthenticated, toast, trackAction]);

  const handleShare = useCallback(async (pollId) => {
    try {
      const result = await pollService.sharePoll(pollId);
      if (mountedRef.current) {
        setPolls((prev) => prev.map((poll) => (poll.id === pollId ? { ...poll, shares: result.shares } : poll)));
      }
      trackAction?.('share');
    } catch (err) {
      console.warn('[FeedV2] share persist failed:', err);
    }
  }, [trackAction]);

  const handleSave = useCallback(async (pollId) => {
    // TikTokPollCard ya actualiza el Set de guardados; aquí solo persistimos.
    try {
      const token = localStorage.getItem('token');
      const baseUrl = process.env.REACT_APP_BACKEND_URL || window.location.origin;
      const response = await fetch(`${baseUrl}/api/polls/${pollId}/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error(`save failed: ${response.status}`);
    } catch (err) {
      console.warn('[FeedV2] save persist failed:', err);
      toast?.({ title: 'Error', description: 'No se pudo guardar la publicación', variant: 'destructive' });
    }
  }, [toast]);

  const handleComment = useCallback(() => {
    trackAction?.('create');
  }, [trackAction]);

  // Cambio de slide activo → prefetch proactivo del contenido siguiente.
  const handleActiveIndexChange = useCallback((idx) => {
    prefetchAround(idx);
    
    // Cancelación agresiva de prefetches lejanos (TikTok-style)
    // Cuando el usuario hace scroll, cancelamos TODO lo que esté a más de 2 slides
    // para liberar bandwidth inmediatamente para el slide activo
    try {
      const aborted = feedMediaPrefetcher?.cancelDistantPolls?.(idx, 2);
      if (aborted > 0) {
        console.log(`🚫 Cancelled ${aborted} distant prefetches`);
      }
    } catch (_) {}
    
    // Liberar fast-scrolling tras un brief delay si no hay más swipes
    try {
      setFastScrolling(false);
    } catch (_) {}
  }, [prefetchAround]);

  // ── renderSlide estable: solo depende de handlers estables + user ─────────
  const renderSlide = useCallback((poll, { isActive, distanceFromActive, index }) => (
    <VSSlidePretty
      poll={poll}
      isActive={isActive}
      distanceFromActive={distanceFromActive}
      index={index}
      total={pollsRef.current.length}
      currentUser={user}
      onVote={handleVote}
      onLike={handleLike}
      onShare={handleShare}
      onComment={handleComment}
      onSave={handleSave}
    />
  ), [user, handleVote, handleLike, handleShare, handleComment, handleSave]);

  // ── Ciclo de vida ─────────────────────────────────────────────────────────
  // Efecto SOLO de montaje/desmontaje (corre una única vez). El reqIdRef se
  // invalida únicamente al desmontar de verdad — NO en cada re-run del efecto
  // del modo TikTok (cuyas deps pueden cambiar de identidad entre renders).
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      reqIdRef.current++; // invalida respuestas en vuelo solo al desmontar
      try { feedMediaPrefetcher.cancelAll?.(); } catch (_) {} // libera prefetches
    };
  }, []);

  // Modo TikTok inmersivo (independiente del ciclo de vida de las peticiones)
  useEffect(() => {
    enterTikTokMode?.();
    hideRightNavigationBar?.();
    return () => {
      exitTikTokMode?.();
      showRightNavigationBar?.();
    };
  }, [enterTikTokMode, exitTikTokMode, hideRightNavigationBar, showRightNavigationBar]);

  // Carga inicial (una sola vez)
  useEffect(() => {
    loadPolls(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFirstInteraction = useCallback((event) => {
    // No desmutear si el tap fue en el botón de mute del TopBar
    const isMuteBtn = event.target?.closest?.('[data-testid="feed-v2-mute-btn"]');
    if (!isMuteBtn && muted) setMuted(false);
  }, [muted]);

  // ── Estados de UI ──────────────────────────────────────────────────────────
  // Mostrar skeleton durante la carga inicial (TikTok-style)
  if (showSkeleton && isLoading) {
    return <FeedSkeleton count={3} />;
  }
  
  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center gap-4" data-testid="feed-v2-loading">
        <Loader2 className="w-10 h-10 text-white animate-spin" />
        <div className="text-white/60 text-sm">Cargando Feed V2…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center gap-4 px-6 text-center" data-testid="feed-v2-error">
        <div className="text-white text-base">No se pudo cargar el feed</div>
        <div className="text-white/50 text-sm">{error}</div>
        <div className="flex gap-3 mt-2">
          <button
            onClick={() => loadPolls(true)}
            className="px-4 py-2 rounded-full bg-white/15 text-white text-sm"
            data-testid="feed-v2-error-retry"
          >
            Reintentar
          </button>
          <button
            onClick={() => navigate('/feed')}
            className="px-4 py-2 rounded-full bg-white/10 text-white text-sm"
            data-testid="feed-v2-error-back"
          >
            Volver al feed normal
          </button>
        </div>
      </div>
    );
  }

  if (polls.length === 0) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center gap-4 px-6 text-center" data-testid="feed-v2-empty">
        <div className="text-white text-base">No hay publicaciones VS</div>
        <div className="text-white/50 text-sm">Crea un VS para verlo aquí</div>
        <button
          onClick={() => navigate('/feed')}
          className="mt-2 px-4 py-2 rounded-full bg-white/10 text-white text-sm"
          data-testid="feed-v2-empty-back"
        >
          Volver al feed normal
        </button>
      </div>
    );
  }

  return (
    <FeedInteractionProvider>
      <div
        className="fixed inset-0 bg-black"
        data-testid="feed-v2-page"
        onPointerDown={muted ? handleFirstInteraction : undefined}
      >
        <VSFeedSwiper
          polls={polls}
          initialIndex={0}
          muted={muted}
          hasMore={hasMore}
          isLoadingMore={isLoadingMore}
          onReachEnd={handleLoadMore}
          onActiveIndexChange={handleActiveIndexChange}
          renderSlide={renderSlide}
        />

        <VSFeedTopBar
          muted={muted}
          onToggleMute={() => setMuted((m) => !m)}
          onBack={() => navigate('/feed')}
        />
      </div>
    </FeedInteractionProvider>
  );
}
