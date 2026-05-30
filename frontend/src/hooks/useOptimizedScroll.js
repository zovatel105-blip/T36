import { useCallback, useEffect, useState, useRef } from 'react';

/**
 * Ultra-optimized scroll hook for TikTok-like experiences
 * Features: momentum detection, adaptive debouncing, GPU acceleration
 */
export const useOptimizedScroll = (containerRef, itemsLength) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);
  const [scrollMetrics, setScrollMetrics] = useState({
    velocity: 0,
    direction: 0,
    momentum: 0
  });

  const metricsRef = useRef({ lastScrollTop: 0, lastTime: Date.now() });
  const rafRef = useRef(null);
  const timeoutRef = useRef(null);
  const velocityRef = useRef(0); // ref to avoid re-attaching listener on velocity change

  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const currentScrollTop = container.scrollTop;
    const currentTime = Date.now();
    const containerHeight = container.clientHeight;
    
    const deltaY = currentScrollTop - metricsRef.current.lastScrollTop;
    const deltaTime = currentTime - metricsRef.current.lastTime;
    const velocity = deltaTime > 0 ? Math.abs(deltaY) / deltaTime : 0;
    const direction = deltaY > 0 ? 1 : deltaY < 0 ? -1 : 0;

    velocityRef.current = velocity;

    setScrollMetrics(prev => ({
      velocity,
      direction,
      momentum: Math.max(prev.momentum * 0.9, velocity)
    }));

    metricsRef.current.lastScrollTop = currentScrollTop;
    metricsRef.current.lastTime = currentTime;

    const exactIndex = currentScrollTop / containerHeight;
    const newIndex = Math.round(exactIndex);
    const threshold = velocity > 50 ? 0.2 : 0.3;

    if (Math.abs(exactIndex - newIndex) < threshold && 
        newIndex >= 0 && 
        newIndex < itemsLength &&
        newIndex !== activeIndex) {
      setActiveIndex(newIndex);
    }
  }, [containerRef, itemsLength, activeIndex]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const optimizedScrollHandler = () => {
      setIsScrolling(true);
      
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      rafRef.current = requestAnimationFrame(() => {
        handleScroll();
        
        const delay = velocityRef.current > 100 ? 150 : 50;
        
        timeoutRef.current = setTimeout(() => {
          setIsScrolling(false);
          
          const scrollTop = container.scrollTop;
          const containerHeight = container.clientHeight;
          const targetIndex = Math.round(scrollTop / containerHeight);
          const currentPosition = scrollTop / containerHeight;
          
          if (Math.abs(currentPosition - targetIndex) > 0.2) {
            container.scrollTo({
              top: targetIndex * containerHeight,
              behavior: 'smooth'
            });
          }
        }, delay);
      });
    };

    container.addEventListener('scroll', optimizedScrollHandler, {
      passive: true,
      capture: false
    });
    
    return () => {
      container.removeEventListener('scroll', optimizedScrollHandler);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [handleScroll]); // removed scrollMetrics.velocity, use ref instead

  // Smart navigation functions
  const scrollToIndex = useCallback((targetIndex, behavior = 'smooth') => {
    const container = containerRef.current;
    if (!container || targetIndex < 0 || targetIndex >= itemsLength) return;

    container.scrollTo({
      top: targetIndex * container.clientHeight,
      behavior
    });

    // Update active index immediately for instant feedback
    if (behavior === 'smooth') {
      setTimeout(() => setActiveIndex(targetIndex), 150);
    } else {
      setActiveIndex(targetIndex);
    }
  }, [containerRef, itemsLength]);

  const scrollNext = useCallback(() => {
    const nextIndex = Math.min(activeIndex + 1, itemsLength - 1);
    if (nextIndex !== activeIndex) {
      scrollToIndex(nextIndex);
    }
  }, [activeIndex, itemsLength, scrollToIndex]);

  const scrollPrevious = useCallback(() => {
    const prevIndex = Math.max(activeIndex - 1, 0);
    if (prevIndex !== activeIndex) {
      scrollToIndex(prevIndex);
    }
  }, [activeIndex, scrollToIndex]);

  return {
    activeIndex,
    isScrolling,
    scrollMetrics,
    scrollToIndex,
    scrollNext,
    scrollPrevious,
    // Helper functions
    canScrollNext: activeIndex < itemsLength - 1,
    canScrollPrevious: activeIndex > 0,
    progress: itemsLength > 0 ? (activeIndex + 1) / itemsLength : 0
  };
};

export default useOptimizedScroll;