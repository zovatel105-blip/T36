import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

const TikTokContext = createContext();

export const useTikTok = () => {
  const context = useContext(TikTokContext);
  if (!context) {
    throw new Error('useTikTok must be used within a TikTokProvider');
  }
  return context;
};

export const TikTokProvider = ({ children }) => {
  const [isTikTokMode, setIsTikTokMode] = useState(false);
  const [hideRightNavigation, setHideRightNavigation] = useState(false);
  const [hideBottomNav, setHideBottomNav] = useState(false);
  const [commentInputConfig, setCommentInputConfig] = useState(null);

  const enterTikTokMode = useCallback(() => {
    setIsTikTokMode(true);
    document.body.style.overflow = 'hidden';
  }, []);

  const exitTikTokMode = useCallback(() => {
    setIsTikTokMode(false);
    setHideRightNavigation(false);
    setHideBottomNav(false);
    document.body.style.overflow = 'auto';
  }, []);

  const toggleTikTokMode = useCallback(() => {
    if (isTikTokMode) {
      exitTikTokMode();
    } else {
      enterTikTokMode();
    }
  }, [isTikTokMode, enterTikTokMode, exitTikTokMode]);

  const hideRightNavigationBar = useCallback(() => {
    setHideRightNavigation(true);
  }, []);

  const showRightNavigationBar = useCallback(() => {
    setHideRightNavigation(false);
  }, []);

  const hideBottomNavigationBar = useCallback(() => {
    setHideBottomNav(true);
  }, []);

  const showBottomNavigationBar = useCallback(() => {
    setHideBottomNav(false);
  }, []);

  const value = useMemo(() => ({
    isTikTokMode,
    hideRightNavigation,
    hideBottomNav,
    commentInputConfig,
    setCommentInputConfig,
    enterTikTokMode,
    exitTikTokMode,
    toggleTikTokMode,
    hideRightNavigationBar,
    showRightNavigationBar,
    hideBottomNavigationBar,
    showBottomNavigationBar
  }), [isTikTokMode, hideRightNavigation, hideBottomNav, commentInputConfig, setCommentInputConfig,
      enterTikTokMode, exitTikTokMode, toggleTikTokMode, hideRightNavigationBar, showRightNavigationBar,
      hideBottomNavigationBar, showBottomNavigationBar]);

  return (
    <TikTokContext.Provider value={value}>
      {children}
    </TikTokContext.Provider>
  );
};

export default TikTokContext;