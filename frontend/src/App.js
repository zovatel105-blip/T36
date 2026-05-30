import React, { useState, useEffect, Suspense, lazy } from "react";
import "./App.css";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import ResponsiveLayout from './components/ResponsiveLayout';
import FeedPage from './pages/FeedPage';

// 🚀 LAZY LOAD: todas las páginas secundarias se cargan bajo demanda
const FeedV2Page = lazy(() => import('./pages/FeedV2Page'));
const ExplorePage = lazy(() => import('./pages/ExplorePage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const MessagesPage = lazy(() => import('./pages/MessagesPage'));
const MessagesMainPage = lazy(() => import('./pages/messages/MessagesMainPage'));
const FollowersPage = lazy(() => import('./pages/messages/FollowersPage'));
const ActivityPage = lazy(() => import('./pages/messages/ActivityPage'));
const RequestsPage = lazy(() => import('./pages/messages/RequestsPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const EditProfilePage = lazy(() => import('./pages/EditProfilePage'));
const ChangePasswordPage = lazy(() => import('./pages/ChangePasswordPage'));
const AudioDetailPage = lazy(() => import('./pages/AudioDetailPage'));
const SearchPage = lazy(() => import('./pages/SearchPage'));
const ContentCreationPage = lazy(() => import('./pages/ContentCreationPage'));
const ContentPublishPage = lazy(() => import('./pages/ContentPublishPage'));
const VSExperiencePage = lazy(() => import('./pages/VSExperiencePage'));
const MomentCreationPage = lazy(() => import('./pages/MomentCreationPage'));
const FollowingPage = lazy(() => import('./pages/FollowingPage'));
const AuthPage = lazy(() => import('./pages/AuthPage'));
const StoryCapturePage = lazy(() => import('./pages/StoryCapturePage'));
const StoryEditPage = lazy(() => import('./pages/StoryEditPage'));
const CompletedBattlesPage = lazy(() => import('./pages/CompletedBattlesPage'));
const ActiveChallengesPage = lazy(() => import('./pages/ActiveChallengesPage'));
const ChallengeCreationPage = lazy(() => import('./pages/ChallengeCreationPage'));
const PostViewerPage = lazy(() => import('./pages/PostViewerPage'));
const LivePage = lazy(() => import('./pages/LivePage'));
const LiveViewerPage = lazy(() => import('./pages/LiveViewerPage'));
const LiveBroadcastPage = lazy(() => import('./pages/LiveBroadcastPage'));
import { Toaster } from './components/ui/toaster';
// Mock data imports removed - using real backend services
import { useToast } from './hooks/use-toast';
import { TikTokProvider, useTikTok } from './contexts/TikTokContext';

// Import Authentication and Addiction
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AddictionProvider } from './contexts/AddictionContext';
import { FollowProvider } from './contexts/FollowContext';
import { UploadProvider } from './contexts/UploadContext';
import { CoinsProvider } from './contexts/CoinsContext';

// ✅ Configuración automática de entorno
import AppConfig from './config/config';

// 📱 Pantalla "Coming Soon" para escritorio
import ComingSoon from './components/ComingSoon';

// 📱 Capacitor Status Bar Plugin
import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';

// 🔔 Push Notifications Hook
import { usePushNotifications } from './hooks/usePushNotifications';

// 📲 Local Notifications Hook
import { useLocalNotifications } from './hooks/useLocalNotifications';

// 📱 Dynamic Status Bar Color Hook
import { useStatusBarColor } from './hooks/useStatusBarColor';

// 📱 Safe-Area Calculator Hook (para Android WebView)
import { useSafeArea } from './hooks/useSafeArea';

// 📱 App Lifecycle Hook (pausa audio/video cuando la app pasa a background)
import { useAppLifecycle } from './hooks/useAppLifecycle';

// 🔙 Back Button Hook (Android hardware back / gesto atrás – estilo TikTok)
import { useBackButton } from './hooks/useBackButton';

// 🔁 Auto-flush de acciones encoladas offline cuando recuperamos conexión
import OfflineQueueFlusher from './components/common/OfflineQueueFlusher';

// 💾 Caché de media (thumbnails/videos) en Capacitor Filesystem
import mediaCache from './services/mediaCacheService';

// Umbral para considerar el dispositivo como móvil/tablet (px)
const MOBILE_BREAKPOINT = 1024;

const detectMobileDevice = () => {
  if (typeof window === 'undefined') return true;
  const ua = (navigator.userAgent || navigator.vendor || '').toLowerCase();
  const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile|tablet/i;
  const isMobileUA = mobileRegex.test(ua);
  const isTouch = typeof window.ontouchstart !== 'undefined' || (navigator.maxTouchPoints || 0) > 1;
  const isSmallScreen = window.innerWidth < MOBILE_BREAKPOINT;
  // Considerar móvil si el UA lo indica, si tiene pantalla pequeña, o si es táctil con pantalla no muy grande
  return isMobileUA || isSmallScreen || (isTouch && window.innerWidth < 1280);
};

const useIsMobileDevice = () => {
  const [isMobile, setIsMobile] = useState(detectMobileDevice);

  useEffect(() => {
    const handleResize = () => setIsMobile(detectMobileDevice());
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  return isMobile;
};

function AppContent() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { isTikTokMode } = useTikTok();
  const { isAuthenticated, loading: authLoading, token } = useAuth();
  const [configInitialized, setConfigInitialized] = useState(false);

  // 📱 Cambiar color de barra de estado según la página
  useStatusBarColor();

  // 📱 Calcular y aplicar safe-area dinámicamente (Android WebView)
  useSafeArea();

  // 📱 Pausar audio y vídeo cuando la app pasa a background o se cierra
  useAppLifecycle();

  // 💾 Inicializar caché de media (filesystem en APK, no-op en web).
  //    Idempotente, una sola vez.
  React.useEffect(() => {
    mediaCache.init().catch((e) => {
      // eslint-disable-next-line no-console
      console.warn('[mediaCache] init skipped:', e?.message);
    });
  }, []);

  // 🔙 Botón/gesto atrás (Android/iOS nativo) – cierra modales, sale de la
  //    vista TikTok superpuesta (perfil/búsqueda/audio) y respeta el historial
  //    para volver a la pantalla anterior en lugar de saltar siempre al feed.
  useBackButton();

  // 📲 Notificaciones locales (funciona sin Firebase)
  useLocalNotifications(isAuthenticated, token);

  // 🔔 Push Notifications con Firebase (deshabilitado hasta configurar Firebase)
  // Cuando configures Firebase, comenta la línea de arriba (useLocalNotifications)
  // y descomenta esta línea:
  // usePushNotifications(isAuthenticated, token);

  // ✅ Inicializar configuración automática de entorno al inicio
  useEffect(() => {
    const initializeAppConfig = async () => {
      try {
        console.log('🚀 Inicializando configuración automática de entorno...');
        await AppConfig.initialize();
        setConfigInitialized(true);
        console.log('✅ Configuración de entorno lista para usar');
      } catch (error) {
        console.error('❌ Error inicializando configuración:', error);
        // Continúa con configuración de fallback
        setConfigInitialized(true);
      }
    };

    initializeAppConfig();
  }, []);

  // 📱 StatusBar inicial - solo colores, NO overlay (lo maneja capacitor.config.json)
  useEffect(() => {
    const setupStatusBar = async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          await StatusBar.setBackgroundColor({ color: '#000000' });
          await StatusBar.setStyle({ style: Style.Light });
          console.log('✅ StatusBar colores configurados');
        } catch (error) {
          console.error('❌ Error StatusBar:', error);
        }
      }
    };
    setupStatusBar();
  }, []);

  // 🎵 CLEANUP GLOBAL: Detener audio en navegación de rutas
  React.useEffect(() => {
    const handleRouteChange = async () => {
      try {
        console.log('🔄 Route changing - Stopping audio');
        const audioManager = (await import('./services/AudioManager')).default;
        await audioManager.stop();
      } catch (error) {
        console.error('❌ Error stopping audio on route change:', error);
      }
    };

    // Escuchar cambios de ruta
    const unsubscribe = navigate && (() => {
      // Este efecto se ejecutará en cada renderizado cuando cambie la ruta
      handleRouteChange();
    });

    return () => {
      if (unsubscribe && typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [navigate, window.location.pathname]);

  const handleCreatePoll = async (pollData) => {
    // Poll creation now handled by backend services in ContentCreationPage
    console.log('Poll creation triggered:', pollData);

    toast({
      title: "¡Votación creada!",
      description: "Tu votación ha sido publicada exitosamente",
    });
  };

  // Show loading while checking auth or initializing config
  if (authLoading || !configInitialized) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500 mx-auto mb-4"></div>
          <p className="text-gray-600">{!configInitialized ? 'Configurando entorno...' : 'Cargando...'}</p>
        </div>
      </div>
    );
  }

  // Check if user is authenticated
  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route path="*" element={<Navigate to="/auth" replace />} />
      </Routes>
    );
  }

  return (
    <ResponsiveLayout onCreatePoll={handleCreatePoll}>
      <Suspense fallback={<div className="flex items-center justify-center h-screen bg-black"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500" /></div>}>
        <Routes>
        {/* Redirect root to feed */}
        <Route path="/" element={<Navigate to="/feed" replace />} />
        <Route path="/feed" element={<FeedPage />} />
        <Route path="/feed-v2" element={<FeedV2Page />} />
        <Route path="/explore" element={<ExplorePage />} />

        {/* Main pages */}
        <Route path="/profile/:username" element={<ProfilePage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/messages/:conversationId" element={<MessagesPage />} />
        <Route path="/messages" element={<MessagesMainPage />} />
        <Route path="/messages/followers" element={<FollowersPage />} />
        <Route path="/messages/activity" element={<ActivityPage />} />
        <Route path="/messages/requests" element={<RequestsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/edit-profile" element={<EditProfilePage />} />
        <Route path="/change-password" element={<ChangePasswordPage />} />
        <Route path="/audio/:audioId" element={<AudioDetailPage />} />
        <Route path="/search" element={<SearchPage />} />
        {/* /create route redirects to /content-creation in VS mode (MVP VS-only).
            ContentSelectionPage está oculta porque solo hay 1 opción (VS). */}
        <Route
          path="/create"
          element={<Navigate to="/content-creation" state={{ creationMode: 'vs' }} replace />}
        />
        <Route path="/content-creation" element={<ContentCreationPage />} />
        <Route path="/content-publish" element={<ContentPublishPage />} />
        {/* /vs-create route removed — replaced by /content-creation with state.creationMode='vs' */}
        <Route path="/vs-experience" element={<VSExperiencePage />} />
        <Route path="/moment-create" element={<MomentCreationPage />} />
        <Route path="/following" element={<FollowingPage />} />
        <Route path="/story-creation" element={<StoryCapturePage />} />
        <Route path="/story-edit" element={<StoryEditPage />} />
        <Route path="/explore/completed" element={<CompletedBattlesPage />} />
        <Route path="/explore/active" element={<ActiveChallengesPage />} />
        <Route path="/challenges/create" element={<ChallengeCreationPage />} />
        <Route path="/post/:postId" element={<PostViewerPage />} />
        <Route path="/poll/:postId" element={<PostViewerPage />} />

        {/* 🔴 LIVE Streaming */}
        <Route path="/live" element={<LivePage />} />
        <Route path="/live/broadcast/:roomId" element={<LiveBroadcastPage />} />
        <Route path="/live/:roomId" element={<LiveViewerPage />} />
        </Routes>
      </Suspense>
    </ResponsiveLayout>
  );
}

function App() {
  const isMobile = useIsMobileDevice();

  // 🖥️ En ordenadores/pantallas grandes mostramos la pantalla "Coming Soon"
  if (!isMobile) {
    return <ComingSoon />;
  }

  return (
    <BrowserRouter>
      <AuthProvider>
        <TikTokProvider>
          <AddictionProvider>
            <FollowProvider>
              <UploadProvider>
                <CoinsProvider>
                  <AppContent />
                  {/* OfflineBanner removed from global mount — ahora se muestra
                      solo en FeedPage/FollowingPage como FeedOfflineToast */}
                  <OfflineQueueFlusher />
                  <Toaster />
                </CoinsProvider>
              </UploadProvider>
            </FollowProvider>
          </AddictionProvider>
        </TikTokProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
