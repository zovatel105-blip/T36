import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { useAuth } from './AuthContext';

const FollowContext = createContext();

export const useFollow = () => {
  const context = useContext(FollowContext);
  if (!context) {
    throw new Error('useFollow must be used within a FollowProvider');
  }
  return context;
};

export const FollowProvider = ({ children }) => {
  const { apiRequest } = useAuth();
  const [followingUsers, setFollowingUsers] = useState(new Map()); // userId -> isFollowing boolean
  const [followsMeUsers, setFollowsMeUsers] = useState(new Map()); // userId -> followsMe boolean
  const [userCache, setUserCache] = useState(new Map()); // username -> user object cache
  const [followStateVersion, setFollowStateVersion] = useState(0); // Version para forzar re-renders
  const [refreshTrigger, setRefreshTrigger] = useState(0); // Trigger adicional para forzar refreshes

  // Función para incrementar la versión cuando cambie el estado de seguimiento
  const incrementFollowStateVersion = useCallback(() => {
    console.log('🔄 INCREMENTING FOLLOW STATE VERSION');
    setFollowStateVersion(prev => {
      console.log('  Previous version:', prev);
      const newVersion = prev + 1;
      console.log('  New version:', newVersion);
      console.log('  This should trigger useEffect in all ProfilePage instances');
      return newVersion;
    });
    // También incrementar el refresh trigger para asegurar updates
    setRefreshTrigger(prev => prev + 1);
  }, []); // Sin dependencias para evitar recreación

  const getUserByUsername = async (username) => {
    try {
      // Check cache first
      if (userCache.has(username)) {
        return userCache.get(username);
      }

      // Search for user
      const response = await apiRequest(`/api/users/search?q=${encodeURIComponent(username)}`);
      const user = response.find(u => u.username === username);
      
      if (user) {
        // Cache the result
        setUserCache(prev => new Map(prev.set(username, user)));
        return user;
      }
      
      return null;
    } catch (error) {
      console.error('Error searching user:', error);
      return null;
    }
  };

  const followUser = async (userIdOrUsername) => {
    try {
      let userId = userIdOrUsername;
      let originalKey = userIdOrUsername;  // Mantener la clave original también
      
      // If it looks like a username (no UUID format), try to resolve it to ID
      if (!userIdOrUsername.includes('-') && userIdOrUsername.length > 5) {
        const user = await getUserByUsername(userIdOrUsername);
        if (user) {
          userId = user.id;
        } else {
          return { success: false, error: 'Usuario no encontrado' };
        }
      }

      const response = await apiRequest(`/api/users/${userId}/follow`, {
        method: 'POST',
      });
      
      if (response.message) {
        console.log('✅ FOLLOW USER SUCCESS - ABOUT TO INCREMENT VERSION');
        console.log('  User followed:', userId);
        console.log('  Response message:', response.message);
        
        // Update local state with both keys to ensure compatibility
        setFollowingUsers(prev => {
          const newMap = new Map(prev);
          newMap.set(userId, true);  // Set with resolved user ID
          newMap.set(originalKey, true);  // Set with original key (username)
          return newMap;
        });
        // Incrementar versión para forzar re-renders globales
        console.log('🔄 CALLING incrementFollowStateVersion for FOLLOW');
        incrementFollowStateVersion();
        return { success: true, message: response.message };
      }
    } catch (error) {
      console.error('Error following user:', error);
      return { success: false, error: error.message };
    }
  };

  const unfollowUser = async (userIdOrUsername) => {
    try {
      let userId = userIdOrUsername;
      let originalKey = userIdOrUsername;
      
      // If it looks like a username, try to resolve it to ID
      if (!userIdOrUsername.includes('-') && userIdOrUsername.length > 5) {
        const user = await getUserByUsername(userIdOrUsername);
        if (user) {
          userId = user.id;
        }
      }
      
      const response = await apiRequest(`/api/users/${userId}/follow`, {
        method: 'DELETE',
      });
      
      if (response.message) {
        console.log('✅ UNFOLLOW USER SUCCESS - ABOUT TO INCREMENT VERSION');
        console.log('  User unfollowed:', userId);
        console.log('  Response message:', response.message);
        
        // Update local state with both keys
        setFollowingUsers(prev => {
          const newMap = new Map(prev);
          newMap.set(userId, false);  // Set with resolved user ID
          newMap.set(originalKey, false);  // Set with original key
          return newMap;
        });
        // Incrementar versión para forzar re-renders globales
        console.log('🔄 CALLING incrementFollowStateVersion for UNFOLLOW');
        incrementFollowStateVersion();
        return { success: true, message: response.message };
      }
    } catch (error) {
      console.error('Error unfollowing user:', error);
      return { success: false, error: error.message };
    }
  };

  const getFollowStatus = async (userIdOrUsername) => {
    try {
      let userId = userIdOrUsername;
      let originalKey = userIdOrUsername;
      
      // If it looks like a username, try to resolve it to ID
      if (!userIdOrUsername.includes('-') && userIdOrUsername.length > 5) {
        const user = await getUserByUsername(userIdOrUsername);
        if (user) {
          userId = user.id;
        } else {
          return { is_following: false, follow_id: null };
        }
      }

      const response = await apiRequest(`/api/users/${userId}/follow-status`);
      
      // Update local state immediately with the response
      setFollowingUsers(prev => {
        const newMap = new Map(prev);
        newMap.set(userId, response.is_following);
        newMap.set(originalKey, response.is_following);
        return newMap;
      });

      // Update follows_me state
      if (response.follows_me !== undefined) {
        setFollowsMeUsers(prev => {
          const newMap = new Map(prev);
          newMap.set(userId, response.follows_me);
          newMap.set(originalKey, response.follows_me);
          return newMap;
        });
      }
      
      return response;
    } catch (error) {
      console.error('Error getting follow status:', error);
      return { is_following: false, follow_id: null };
    }
  };

  const isFollowing = (userId) => {
    return followingUsers.get(userId) || false;
  };

  const followsMe = (userId) => {
    return followsMeUsers.get(userId) || false;
  };

  const getFollowingUsers = async () => {
    try {
      const response = await apiRequest('/api/users/following');
      // Update local cache
      const followingMap = new Map();
      response.following.forEach(user => {
        followingMap.set(user.id, true);
      });
      setFollowingUsers(followingMap);
      return response;
    } catch (error) {
      console.error('Error getting following users:', error);
      return { following: [], total: 0 };
    }
  };

  const getUserFollowers = useCallback(async (userIdOrUsername) => {
    try {
      let userId = userIdOrUsername;
      let originalKey = userIdOrUsername;
      
      // If it looks like a username (no UUID format), try to resolve it to ID
      if (!userIdOrUsername.includes('-') && userIdOrUsername.length > 5) {
        console.log('🔍 RESOLVING USERNAME TO UUID: getUserFollowers');
        console.log('  Original input (username):', userIdOrUsername);
        
        const user = await getUserByUsername(userIdOrUsername);
        if (user) {
          userId = user.id;
          console.log('  Resolved UUID:', userId);
        } else {
          console.error('❌ USERNAME NOT FOUND:', userIdOrUsername);
          return { followers: [], total: 0 };
        }
      }
      
      console.log('🌐 API CALL: getUserFollowers');
      console.log('  Endpoint:', `/api/users/${userId}/followers`);
      console.log('  User ID (UUID):', userId);
      console.log('  Original input:', originalKey);
      
      const response = await apiRequest(`/api/users/${userId}/followers`);
      
      console.log('📡 API RESPONSE: getUserFollowers');
      console.log('  Status: Success');
      console.log('  Response:', response);
      console.log('  Followers count:', response.followers ? response.followers.length : 'undefined');
      
      return response;
    } catch (error) {
      console.error('❌ API ERROR: getUserFollowers:', error);
      console.error('  Original input:', userIdOrUsername);
      console.error('  Error details:', error.message);
      return { followers: [], total: 0 };
    }
  }, [apiRequest]);

  const getUserFollowing = useCallback(async (userIdOrUsername) => {
    try {
      let userId = userIdOrUsername;
      let originalKey = userIdOrUsername;
      
      // If it looks like a username (no UUID format), try to resolve it to ID
      if (!userIdOrUsername.includes('-') && userIdOrUsername.length > 5) {
        console.log('🔍 RESOLVING USERNAME TO UUID: getUserFollowing');
        console.log('  Original input (username):', userIdOrUsername);
        
        const user = await getUserByUsername(userIdOrUsername);
        if (user) {
          userId = user.id;
          console.log('  Resolved UUID:', userId);
        } else {
          console.error('❌ USERNAME NOT FOUND:', userIdOrUsername);
          return { following: [], total: 0 };
        }
      }
      
      console.log('🌐 API CALL: getUserFollowing');
      console.log('  Endpoint:', `/api/users/${userId}/following`);
      console.log('  User ID (UUID):', userId);
      console.log('  Original input:', originalKey);
      
      const response = await apiRequest(`/api/users/${userId}/following`);
      
      console.log('📡 API RESPONSE: getUserFollowing');
      console.log('  Status: Success');
      console.log('  Response:', response);
      console.log('  Following count:', response.following ? response.following.length : 'undefined');
      
      return response;
    } catch (error) {
      console.error('❌ API ERROR: getUserFollowing:', error);
      console.error('  Original input:', userIdOrUsername);
      console.error('  Error details:', error.message);
      return { following: [], total: 0 };
    }
  }, [apiRequest]);

  const value = useMemo(() => ({
    followUser,
    unfollowUser,
    getFollowStatus,
    isFollowing,
    followsMe,
    getFollowingUsers,
    getUserFollowers,
    getUserFollowing,
    getUserByUsername,
    followingUsers,
    followStateVersion,
    refreshTrigger
  }), [followUser, unfollowUser, getFollowStatus, isFollowing, followsMe,
      getFollowingUsers, getUserFollowers, getUserFollowing, getUserByUsername,
      followingUsers, followStateVersion, refreshTrigger]);

  return (
    <FollowContext.Provider value={value}>
      {children}
    </FollowContext.Provider>
  );
};