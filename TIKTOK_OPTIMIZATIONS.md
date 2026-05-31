# 🚀 Optimizaciones TikTok-Style Implementadas

Este documento detalla todas las optimizaciones implementadas para lograr la fluidez de TikTok Web en el scrolling y carga de publicaciones.

## 📋 Resumen de Mejoras

### 1. **Scroll Fluido Tipo TikTok** ✅

#### VSFeedSwiper.jsx
- **Threshold reducido**: de 5px a 3px para mayor sensibilidad
- **Long swipes ratio**: de 0.4 a 0.35 (más sensible para flick rápido)
- **Long swipes ms**: de 300ms a 250ms (respuesta más rápida)
- **Mouse wheel sensitivity**: aumentada a 1.2 con threshold de 15px
- **Transición dinámica**: duración ajustada según velocidad del swipe (180-320ms)
- **Ventana de renderizado asimétrica**: 1 slide atrás, 4 adelante
- **Cancelación agresiva**: cancela prefetches a más de 2 slides de distancia

#### scrollVelocityTracker.js
- **Detección de cascada**: 3+ swipes en 800ms activa fast-scrolling
- **Threshold de velocidad**: reducido de 1.2 a 1.0 px/ms
- **Release delay**: reducido de 250ms a 200ms para respuesta más rápida
- **Historial de swipes**: tracking para detección de patrones

### 2. **Prefetch Inteligente** ✅

#### feedMediaPrefetcher.js
- **Cancelación agresiva**: aborta prefetches lejanos durante fast-scroll
- **Prefetch adaptativo**: ajusta profundidad según velocidad de red
- **Audio prefetch**: cachea audios para reproducción offline
- **Video prefetch**: solo los próximos 4 slides (configurable)
- **Thumbnail prefetch**: 8 slides adelante (barato y efectivo)

#### FeedV2Page.jsx
- **Cancelación en cada cambio de slide**: libera bandwidth para el slide activo
- **Liberación de fast-scrolling**: notifica al tracker tras cada swipe

### 3. **GPU Acceleration** ✅

#### useUltraSmoothFeed.js
- **Will-change optimizado**: transform + opacity en slides activos
- **Contain: paint layout**: limita repaint area
- **Transform translateZ(0)**: fuerza composición por capa GPU
- **Backface-visibility: hidden**: optimiza rendering 3D
- **Preconnect a CDN**: reduce latencia de medios
- **CSS easing TikTok-style**: cubic-bezier(0.25, 0.1, 0.25, 1)

#### VSFeedSwiper.jsx (CSS inyectado)
```css
.snaptok-swiper .swiper-slide {
  contain: layout style paint;
  content-visibility: auto;
  transform: translateZ(0);
  backface-visibility: hidden;
  will-change: transform;
}

.snaptok-swiper .swiper-wrapper {
  transition-timing-function: cubic-bezier(0.25, 0.1, 0.25, 1);
}
```

### 4. **Skeleton Loading Instantáneo** ✅

#### FeedSkeleton.jsx (NUEVO)
- **Carga visual inmediata**: 3 slides placeholder animados
- **Shimmer effect**: gradientes animados para sensación de rapidez
- **Mismo layout que contenido real**: evita layout shift
- **Tiempo mínimo de muestra**: 300ms (evita flash si carga es rápida)
- **Altura 100dvh**: sin shifts de viewport

#### FeedV2Page.jsx
- **Doble estado de carga**: skeleton + loading spinner
- **Transición suave**: skeleton → contenido real
- **Timer de control**: oculta skeleton tras carga o 300ms mínimo

### 5. **Decoder Budget Dinámico** ✅

#### PollOptionMedia.jsx
- **Detección de hardware**: núcleos + memoria para calcular budget
- **Android gama media**: 2-4 decoders H.264 simultáneos máx.
- **Layout VS**: máximo 1 slide de distancia (2 videos)
- **Layout normal**: máximo 2 slides de distancia (3 videos)
- **Redes lentas**: solo video activo (distance = 0)

### 6. **Video Crossfade & Warm-up** ✅

#### PollOptionMedia.jsx
- **Poster crossfade**: opacity transition 0.2s al mostrar video
- **Video warm-up**: play() + pause() en distance=1 para forzar primer frame
- **requestVideoFrameCallback**: sabe cuándo el primer frame está en GPU
- **Background pause**: pausa video cuando app va a segundo plano
- **Scroll-back resume**: videoTimeCache guarda posición por 30s

### 7. **Configuración Centralizada** ✅

#### config/tiktokOptimizations.js (NUEVO)
Todos los thresholds y timings en un solo lugar:
- `SCROLL_CONFIG`: velocidades, thresholds, sensibilidades
- `TRANSITION_CONFIG`: duraciones, easing functions
- `PREFETCH_CONFIG`: distancias, tamaños máximos
- `VIDEO_CONFIG`: budgets, warm-up delays
- `RENDER_WINDOW_CONFIG`: ventana de renderizado
- `SKELETON_CONFIG`: tiempos, cantidades
- `GPU_CONFIG`: optimizaciones CSS
- `NETWORK_CONFIG`: adaptación por tipo de red

## 📊 Métricas de Rendimiento

### Antes vs Después

| Métrica | Antes | Después | Mejora |
|---------|-------|---------|--------|
| **Threshold swipe** | 5px | 3px | 40% más sensible |
| **Long swipe ratio** | 0.4 | 0.35 | 12.5% más rápido |
| **Long swipe ms** | 300ms | 250ms | 17% más rápido |
| **Fast-scroll release** | 250ms | 200ms | 20% más rápido |
| **Ventana prefetch** | 3 slides | 4 slides | 33% más buffer |
| **Cancelación distante** | 4 slides | 2 slides | 50% más agresiva |
| **Videos simultáneos** | 5-6 | 2-3 | 50-60% menos |
| **Skeleton display** | N/A | 300ms | Carga instantánea |

### Velocidad de Transición Dinámica

```javascript
// TikTok-style: más rápido = menos duración
const duration = Math.max(
  180, // mínimo
  Math.min(
    320, // máximo
    320 - (velocity * 30) // reduce 30ms por px/ms
  )
);
```

**Ejemplos:**
- Swipe lento (0.5 px/ms): 305ms
- Swipe normal (1.0 px/ms): 290ms
- Swipe rápido (2.0 px/ms): 260ms
- Swipe muy rápido (4.0 px/ms): 200ms

## 🎯 Cómo Funciona el Fast-Scroll Detection

```
Usuario hace swipe → scrollVelocityTracker.recordSwipe(velocity)
                     ↓
¿velocity > 1.0 px/ms? → SÍ → setFastScrolling(true)
                     ↓
¿3+ swipes en 800ms? → SÍ → setFastScrolling(true)
                     ↓
Durante fast-scrolling:
  - Slots a distance > 0 suspenden HLS
  - Prefetches lejanos se cancelan
  - Solo slot activo carga video completo
                     ↓
Usuario deja de scrollear
                     ↓
200ms sin swipes → setFastScrolling(false)
                     ↓
Slots vecinos reanudan prefetch
```

## 🔄 Flujo de Prefetch con Cancelación

```
Slide activo: index 5
                     ↓
Prefetch: índices 5, 6, 7, 8, 9 (5 slides)
                     ↓
Usuario hace swipe → index 6
                     ↓
Cancelar: índices 8, 9 (distance > 2)
Mantener: índices 5, 6, 7, 8 (distance ≤ 2)
                     ↓
Prefetch: índices 6, 7, 8, 9, 10
                     ↓
Repetir en cada cambio de slide
```

## 🎨 Skeleton Loading - Timeline

```
T=0ms:    Usuario navega a /feed
          ↓
T=0ms:    Muestra FeedSkeleton (3 slides animados)
          ↓
T=0-150ms: Carga de datos en background
          ↓
T=150ms:  Datos llegan (ejemplo)
          ↓
T=150-300ms: Skeleton permanece (mínimo 300ms)
          ↓
T=300ms:  Transición suave a contenido real
```

**Beneficio:** El usuario siempre ve algo inmediatamente, incluso si la carga es rápida. Evita el "flash" de loading spinner.

## 📱 Adaptación por Tipo de Red

```javascript
// 2G / slow-2g / saveData
- Prefetch: 1 slide adelante
- Videos: solo activo (distance=0)
- Thumbnails: 3 adelante

// 3G
- Prefetch: 2 slides adelante
- Videos: activo + 1 (distance≤1)
- Thumbnails: 5 adelante

// 4G / WiFi
- Prefetch: 4 slides adelante
- Videos: activo + 2 (distance≤2)
- Thumbnails: 8 adelante
```

## 🔧 Cómo Ajustar los Thresholds

Todos los valores están en `config/tiktokOptimizations.js`. Para ajustar:

1. **Scroll más sensible**: reducir `FAST_SCROLL_VELOCITY_THRESHOLD`
2. **Transiciones más rápidas**: reducir `MIN_TRANSITION_DURATION_MS`
3. **Más prefetch**: aumentar `PREFETCH_AHEAD_COUNT`
4. **Menos consumo de datos**: reducir `WINDOW_AHEAD`
5. **Más videos simultáneos**: aumentar `MAX_VIDEO_TAG_DISTANCE`

## 🧪 Testing Recomendado

### Dispositivos de Prueba
- ✅ Android gama media (4GB RAM, Snapdragon 660+)
- ✅ iOS 13+ (iPhone 7+)
- ✅ Chrome/Android WebView
- ✅ Safari iOS

### Escenarios
1. **Fast scroll continuo**: 10+ swipes rápidos
2. **Scroll intermitente**: swipe → pausa → swipe
3. **Carga inicial**: navegar a /feed desde cold start
4. **Scroll-back**: bajar 20 posts → volver arriba
5. **Red lenta**: simular 3G en DevTools
6. **Offline**: modo avión → verificar cache

## 📚 Referencias

- [TikTok Engineering Blog](https://www.tiktok.com/engineering)
- [Swiper.js Documentation](https://swiperjs.com/swiper-api)
- [Web Performance APIs](https://web.dev/performance/)
- [GPU Acceleration in CSS](https://developers.google.com/web/updates/2016/12/chrome-56-deprecations#gpu_accelerated_css_filters)

## 🚀 Próximas Mejoras (Opcional)

1. **Service Worker**: cache offline de medios
2. **Virtualización mejorada**: react-window para listas grandes
3. **Image CDN**: optimización automática de thumbnails
4. **HTTP/3**: reducir latencia de red
5. **WebP/AVIF**: formatos de imagen modernos
6. **Lazy hydration**: React Suspense para modales

---

**Implementado en:** Diciembre 2024  
**Basado en:** Análisis de TikTok Web + ingeniería inversa de patrones de scroll  
**Objetivo:** 60 FPS constantes, 0 jank, carga instantánea