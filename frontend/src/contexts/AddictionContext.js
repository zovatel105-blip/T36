import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import AppConfig from '../config/config';
import { addictionAPI, behaviorTracker } from '../services/addictionApi';
import { useAuth } from './AuthContext';

const AddictionContext = createContext();

export const useAddiction = () => {
  const context = useContext(AddictionContext);
  if (!context) {
    throw new Error('useAddiction must be used within an AddictionProvider');
  }
  return context;
};

export const AddictionProvider = ({ children }) => {
  const { isAuthenticated, user, apiRequest } = useAuth();
  
  // User Profile State
  const [userProfile, setUserProfile] = useState(null);
  const [userAchievements, setUserAchievements] = useState([]);
  const [userStreaks, setUserStreaks] = useState([]);
  
  // Addiction Metrics
  const [addictionScore, setAddictionScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [xp, setXp] = useState(0);
  const [streak, setStreak] = useState(0);
  
  // FOMO & Social
  const [fomoContent, setFomoContent] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [socialProofData, setSocialProofData] = useState({});
  
  // UI States
  const [showRewardPopup, setShowRewardPopup] = useState(false);
  const [rewardData, setRewardData] = useState(null);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [showAchievement, setShowAchievement] = useState(false);
  const [achievementData, setAchievementData] = useState(null);
  
  // Dopamine Effects
  const [dopamineHits, setDopamineHits] = useState(0);
  const [showJackpot, setShowJackpot] = useState(false);
  const [jackpotData, setJackpotData] = useState(null);

  // Initialize user when authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      initializeAuthenticatedUser();
    } else {
      // Reset state when not authenticated
      resetAddictionState();
    }
  }, [isAuthenticated, user]);

  // Auto-refresh data using configurable interval when authenticated
  useEffect(() => {
    if (isAuthenticated && userProfile) {
      const dataInterval = setInterval(() => {
        refreshUserData();
      }, AppConfig.REFRESH_INTERVAL);

      return () => clearInterval(dataInterval);
    }
  }, [isAuthenticated, userProfile]);

  const resetAddictionState = () => {
    setUserProfile(null);
    setUserAchievements([]);
    setUserStreaks([]);
    setAddictionScore(0);
    setLevel(1);
    setXp(0);
    setStreak(0);
    setFomoContent([]);
    setLeaderboard([]);
    setSocialProofData({});
    setDopamineHits(0);
  };

  const initializeAuthenticatedUser = async () => {
    if (!isAuthenticated || !user) return;
    
    try {
      // Get or create user profile
      let profile = await apiRequest('/api/user/profile');
      
      if (!profile) {
        // Create profile if it doesn't exist
        profile = await apiRequest('/api/user/profile', {
          method: 'POST',
          body: JSON.stringify({ username: user.username })
        });
      }
      
      setUserProfile(profile);
      setLevel(profile.level);
      setXp(profile.xp);
      setStreak(profile.current_streak);
      
      if (profile.addiction_metrics) {
        setAddictionScore(profile.addiction_metrics.addiction_score);
      }
      
      // Temporarily disable loading of unimplemented endpoints
      // TODO: Re-enable when endpoints are implemented
      // await Promise.all([
      //   loadUserAchievements(),
      //   loadUserStreaks(),
      //   loadFOMOContent(),
      //   loadLeaderboard()
      // ]);
      
      // Set default values instead
      setUserAchievements([]);
      setUserStreaks([]);
      setFomoContent([]);
      setLeaderboard([]);
      
    } catch (error) {
      console.error('Failed to initialize authenticated user:', error);
      // Set default values on error
      setUserProfile(null);
      setLevel(1);
      setXp(0);
      setStreak(0);
      setAddictionScore(0);
      setUserAchievements([]);
      setUserStreaks([]);
      setFomoContent([]);
      setLeaderboard([]);
    }
  };

  const refreshUserData = async () => {
    if (!isAuthenticated || !user) return;
    
    try {
      const profile = await apiRequest('/api/user/profile');
      setUserProfile(profile);
      setLevel(profile.level);
      setXp(profile.xp);
      setStreak(profile.current_streak);
      
      if (profile.addiction_metrics) {
        setAddictionScore(profile.addiction_metrics.addiction_score);
      }
    } catch (error) {
      console.error('Failed to refresh user data:', error);
    }
  };

  const loadUserAchievements = async () => {
    if (!isAuthenticated) return;
    
    try {
      const achievements = await apiRequest('/api/user/achievements');
      setUserAchievements(achievements);
    } catch (error) {
      console.error('Failed to load achievements:', error);
    }
  };

  const loadUserStreaks = async () => {
    if (!isAuthenticated) return;
    
    try {
      const streaks = await apiRequest('/api/user/streaks');
      setUserStreaks(streaks);
    } catch (error) {
      console.error('Failed to load streaks:', error);
    }
  };

  const loadFOMOContent = async () => {
    try {
      const content = await apiRequest('/api/fomo/content');
      setFomoContent(content);
    } catch (error) {
      console.error('Failed to load FOMO content:', error);
    }
  };

  const loadLeaderboard = async () => {
    try {
      const board = await apiRequest('/api/leaderboard');
      setLeaderboard(board);
    } catch (error) {
      console.error('Failed to load leaderboard:', error);
    }
  };

  const getSocialProof = async (pollId) => {
    try {
      const proof = await apiRequest(`/api/social-proof/${pollId}`);
      setSocialProofData(prev => ({
        ...prev,
        [pollId]: proof
      }));
      return proof;
    } catch (error) {
      console.error('Failed to get social proof:', error);
      return null;
    }
  };

  // Action tracking with dopamine hits - TEMPORARILY DISABLED
  const trackAction = async (actionType, context = {}) => {
    if (!isAuthenticated || !user) {
      console.log('Not authenticated, skipping action tracking');
      return;
    }

    try {
      // Temporarily disable behavior tracking to avoid 404 errors
      // TODO: Re-enable when behavior tracking endpoints are implemented
      console.log(`Action tracked locally: ${actionType}`, context);
      
      // Simple local tracking without API calls
      setDopamineHits(prev => prev + 1);
      
      // Simulate basic XP gain without backend
      setXp(prev => prev + 10);
      
      return { success: true, xp_gained: 10 };
      
    } catch (error) {
      console.error('Failed to track action:', error);
      return { success: false, error: error.message };
    }
  };

  const triggerJackpot = async () => {
    if (!isAuthenticated || !user) return;
    
    try {
      const jackpot = await apiRequest('/api/user/jackpot', {
        method: 'POST'
      });
      setJackpotData(jackpot);
      setShowJackpot(true);
      
      // Refresh user data
      refreshUserData();
      
      setTimeout(() => setShowJackpot(false), AppConfig.AUTO_HIDE_TIMEOUT);
    } catch (error) {
      console.error('Failed to trigger jackpot:', error);
    }
  };

  // Progress calculations
  const getXpToNextLevel = () => {
    const nextLevelXp = (level ** 2) * 100 + level * 50;
    return Math.max(0, nextLevelXp - xp);
  };

  const getXpProgress = () => {
    const currentLevelXp = ((level - 1) ** 2) * 100 + (level - 1) * 50;
    const nextLevelXp = (level ** 2) * 100 + level * 50;
    const currentProgress = xp - currentLevelXp;
    const totalNeeded = nextLevelXp - currentLevelXp;
    return Math.max(0, Math.min(100, (currentProgress / totalNeeded) * 100));
  };

  const value = useMemo(() => ({
    userProfile,
    userAchievements,
    userStreaks,
    addictionScore,
    level,
    xp,
    streak,
    dopamineHits,
    fomoContent,
    leaderboard,
    socialProofData,
    showRewardPopup,
    rewardData,
    showLevelUp,
    showAchievement,
    achievementData,
    showJackpot,
    jackpotData,
    trackAction,
    getSocialProof,
    refreshUserData,
    triggerJackpot,
    getXpToNextLevel,
    getXpProgress,
    setShowRewardPopup,
    setShowLevelUp,
    setShowAchievement,
    setShowJackpot,
    isAuthenticated
  }), [userProfile, userAchievements, userStreaks, addictionScore, level, xp, streak,
      dopamineHits, fomoContent, leaderboard, socialProofData, showRewardPopup, rewardData,
      showLevelUp, showAchievement, achievementData, showJackpot, jackpotData,
      trackAction, getSocialProof, refreshUserData, triggerJackpot,
      getXpToNextLevel, getXpProgress, isAuthenticated,
      setShowRewardPopup, setShowLevelUp, setShowAchievement, setShowJackpot]);

  return (
    <AddictionContext.Provider value={value}>
      {children}
    </AddictionContext.Provider>
  );
};