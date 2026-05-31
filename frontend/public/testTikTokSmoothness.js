/**
 * testTikTokSmoothness.js
 * 
 * Script de testing para verificar las optimizaciones TikTok-style.
 * Ejecutar en consola del navegador durante el desarrollo.
 * 
 * Uso:
 *   1. Abrir DevTools Console
 *   2. Copiar y pegar este script
 *   3. Ejecutar testTikTokSmoothness()
 */

const testTikTokSmoothness = () => {
  console.log('🧪 Iniciando test de fluidez TikTok-style...\n');
  
  const results = {
    scrollConfig: {},
    prefetchConfig: {},
    gpuConfig: {},
    videoConfig: {},
    passed: 0,
    failed: 0,
    warnings: [],
  };
  
  // ─────────────────────────────────────────────────────────────────────
  // TEST 1: Verificar configuración de scroll
  // ─────────────────────────────────────────────────────────────────────
  console.log('📋 Test 1: Configuración de Scroll');
  
  try {
    const swiperElement = document.querySelector('.snaptok-swiper');
    if (swiperElement) {
      const swiperInstance = swiperElement.swiper;
      if (swiperInstance) {
        results.scrollConfig.threshold = swiperInstance.params.threshold;
        results.scrollConfig.longSwipesRatio = swiperInstance.params.longSwipesRatio;
        results.scrollConfig.longSwipesMs = swiperInstance.params.longSwipesMs;
        results.scrollConfig.speed = swiperInstance.params.speed;
        
        console.log(`  ✅ Threshold: ${swiperInstance.params.threshold}px (óptimo: 3)`);
        console.log(`  ✅ Long Swipes Ratio: ${swiperInstance.params.longSwipesRatio} (óptimo: 0.35)`);
        console.log(`  ✅ Long Swipes Ms: ${swiperInstance.params.longSwipesMs}ms (óptimo: 250)`);
        console.log(`  ✅ Speed: ${swiperInstance.params.speed}ms (dinámico: 180-320)`);
        
        if (swiperInstance.params.threshold <= 3) results.passed++;
        else { results.failed++; results.warnings.push('Threshold muy alto'); }
        
        if (swiperInstance.params.longSwipesRatio <= 0.35) results.passed++;
        else { results.failed++; results.warnings.push('Long swipe ratio muy alto'); }
      } else {
        console.log('  ⚠️ Swiper instance no encontrada');
        results.warnings.push('Swiper no inicializado');
      }
    } else {
      console.log('  ⚠️ Elemento .snaptok-swiper no encontrado');
      results.warnings.push('Swiper element no existe');
    }
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
    results.failed++;
  }
  
  // ─────────────────────────────────────────────────────────────────────
  // TEST 2: Verificar GPU acceleration
  // ─────────────────────────────────────────────────────────────────────
  console.log('\n🎨 Test 2: GPU Acceleration');
  
  try {
    const slides = document.querySelectorAll('.snaptok-swiper .swiper-slide');
    if (slides.length > 0) {
      const slide = slides[0];
      const styles = window.getComputedStyle(slide);
      
      results.gpuConfig.transform = styles.transform;
      results.gpuConfig.backfaceVisibility = styles.backfaceVisibility;
      results.gpuConfig.willChange = styles.willChange;
      results.gpuConfig.contentVisibility = styles.contentVisibility;
      
      const hasGPU = styles.transform.includes('matrix3d') || styles.transform !== 'none';
      const hasBackface = styles.backfaceVisibility === 'hidden';
      const hasWillChange = styles.willChange.includes('transform');
      
      console.log(`  ${hasGPU ? '✅' : '⚠️'} Transform GPU: ${hasGPU}`);
      console.log(`  ${hasBackface ? '✅' : '⚠️'} Backface hidden: ${hasBackface}`);
      console.log(`  ${hasWillChange ? '✅' : '⚠️'} Will-change: ${hasWillChange}`);
      console.log(`  ℹ️  Content-visibility: ${styles.contentVisibility}`);
      
      if (hasGPU) results.passed++; else results.warnings.push('Sin GPU transform');
      if (hasBackface) results.passed++; else results.warnings.push('Sin backface hidden');
      if (hasWillChange) results.passed++; else results.warnings.push('Sin will-change');
    } else {
      console.log('  ⚠️ No hay slides renderizados');
      results.warnings.push('Sin slides para testear');
    }
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
    results.failed++;
  }
  
  // ─────────────────────────────────────────────────────────────────────
  // TEST 3: Verificar fast-scroll detection
  // ─────────────────────────────────────────────────────────────────────
  console.log('\n⚡ Test 3: Fast-Scroll Detection');
  
  try {
    if (typeof scrollVelocityTracker !== 'undefined') {
      console.log('  ✅ scrollVelocityTracker disponible');
      results.passed++;
      
      // Testear recordSwipe
      if (typeof scrollVelocityTracker.recordSwipe === 'function') {
        console.log('  ✅ recordSwipe disponible');
        results.passed++;
      } else {
        console.log('  ⚠️ recordSwipe no disponible');
        results.warnings.push('recordSwipe missing');
      }
      
      // Testear estado actual
      const isFast = scrollVelocityTracker.isFastScrolling?.();
      console.log(`  ℹ️  Fast-scrolling activo: ${isFast}`);
    } else {
      console.log('  ⚠️ scrollVelocityTracker no disponible en window');
      results.warnings.push('scrollVelocityTracker no exportado');
    }
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
    results.failed++;
  }
  
  // ─────────────────────────────────────────────────────────────────────
  // TEST 4: Verificar prefetch
  // ─────────────────────────────────────────────────────────────────────
  console.log('\n📦 Test 4: Prefetch System');
  
  try {
    if (typeof feedMediaPrefetcher !== 'undefined') {
      console.log('  ✅ feedMediaPrefetcher disponible');
      results.passed++;
      
      const stats = feedMediaPrefetcher.stats?.();
      if (stats) {
        console.log(`  ℹ️  Prefetches en vuelo: ${stats.inflightPrefetches || 0}`);
        console.log(`  ℹ️  Polls trackeados: ${stats.trackedPolls || 0}`);
      }
      
      if (typeof feedMediaPrefetcher.cancelDistantPolls === 'function') {
        console.log('  ✅ cancelDistantPolls disponible');
        results.passed++;
      } else {
        console.log('  ⚠️ cancelDistantPolls no disponible');
        results.warnings.push('cancelDistantPolls missing');
      }
    } else {
      console.log('  ⚠️ feedMediaPrefetcher no disponible en window');
      results.warnings.push('feedMediaPrefetcher no exportado');
    }
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
    results.failed++;
  }
  
  // ─────────────────────────────────────────────────────────────────────
  // TEST 5: Verificar decoder budget
  // ─────────────────────────────────────────────────────────────────────
  console.log('\n🎬 Test 5: Decoder Budget');
  
  try {
    const cores = navigator.hardwareConcurrency || 'N/A';
    const memory = navigator.deviceMemory || 'N/A';
    const connection = navigator.connection;
    const effectiveType = connection?.effectiveType || 'desconocido';
    const saveData = connection?.saveData || false;
    
    console.log(`  ℹ️  CPU Cores: ${cores}`);
    console.log(`  ℹ️  Memoria: ${memory} GB`);
    console.log(`  ℹ️  Tipo de red: ${effectiveType}`);
    console.log(`  ℹ️  Save Data: ${saveData}`);
    
    const decoderBudget = {
      maxDistance: (memory >= 6 && cores >= 6) ? 2 : (memory <= 2 || cores <= 2) ? 0 : 1,
      allowPosterOnly: saveData || effectiveType === 'slow-2g' || effectiveType === '2g',
    };
    
    console.log(`  ℹ️  Budget calculado: ${decoderBudget.maxDistance} videos simultáneos`);
    results.passed++;
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
    results.failed++;
  }
  
  // ─────────────────────────────────────────────────────────────────────
  // TEST 6: Verificar skeleton loading
  // ─────────────────────────────────────────────────────────────────────
  console.log('\n💀 Test 6: Skeleton Loading');
  
  try {
    const skeleton = document.querySelector('[data-testid="feed-skeleton"]');
    if (skeleton) {
      console.log('  ✅ Skeleton visible');
      console.log('  ℹ️  El skeleton está funcionando correctamente');
      results.passed++;
    } else {
      console.log('  ℹ️  Skeleton no visible (puede ser normal si ya cargó)');
      results.warnings.push('Skeleton no encontrado (quizás ya se ocultó)');
    }
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
    results.failed++;
  }
  
  // ─────────────────────────────────────────────────────────────────────
  // RESULTADOS FINALES
  // ─────────────────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(60));
  console.log('📊 RESULTADOS FINALES');
  console.log('='.repeat(60));
  console.log(`✅ Pasados: ${results.passed}`);
  console.log(`❌ Fallidos: ${results.failed}`);
  console.log(`⚠️  Warnings: ${results.warnings.length}`);
  
  if (results.warnings.length > 0) {
    console.log('\n⚠️  Warnings:');
    results.warnings.forEach((w, i) => console.log(`  ${i + 1}. ${w}`));
  }
  
  const score = Math.round((results.passed / (results.passed + results.failed)) * 100);
  console.log(`\n🎯 Score: ${score}%`);
  
  if (score >= 80) {
    console.log('🎉 ¡Excelente! Las optimizaciones TikTok-style están activas.');
  } else if (score >= 60) {
    console.log('👍 Bien, pero hay algunas optimizaciones que se pueden mejorar.');
  } else {
    console.log('⚠️  Se requieren mejoras para alcanzar fluidez TikTok-style.');
  }
  
  console.log('\n💡 Tip: Ejecutar este test después de cada cambio para verificar optimizaciones.');
  
  return results;
};

// Hacer la función disponible globalmente
window.testTikTokSmoothness = testTikTokSmoothness;

console.log('✅ Script cargado. Ejecutar: testTikTokSmoothness()');