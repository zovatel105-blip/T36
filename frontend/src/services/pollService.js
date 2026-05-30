/**
 * Poll Service - Handles all poll-related API calls
 * Replaces mock data with real backend integration
 */
import { queuedFetch } from './offlineQueueService';
import { filterToVSOnly } from '../utils/postFilters';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

class PollService {
  constructor() {
    this.baseURL = `${BACKEND_URL}/api`;
  }

  // Get auth headers
  getAuthHeaders() {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    };
  }

  // Handle API errors
  async handleResponse(response) {
    if (!response.ok) {
      const errorData = await response.json();
      
      // Handle Pydantic validation errors (422 responses)
      if (Array.isArray(errorData.detail)) {
        const errorMessages = errorData.detail.map(err => err.msg || JSON.stringify(err)).join(', ');
        throw new Error(errorMessages);
      }
      
      throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }
    return response.json();
  }

  // Get polls with pagination and filters
  async getPolls(options = {}) {
    const { 
      limit = 20, 
      offset = 0, 
      category = null, 
      featured = null,
      vs_only = true
    } = options;

    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
    });

    if (category) params.append('category', category);
    if (featured !== null) params.append('featured', featured.toString());
    if (vs_only) params.append('vs_only', 'true');

    try {
      const headers = this.getAuthHeaders();
      
      // ⚡ ALWAYS TRY ULTRA-FAST ENDPOINT FIRST (3-5x faster)
      try {
        const ultraFastUrl = `${this.baseURL}/polls/ultra-fast?${params}`;
        
        const ultraResponse = await fetch(ultraFastUrl, {
          method: 'GET',
          headers: headers,
        });

        if (ultraResponse.ok) {
          const ultraResult = await ultraResponse.json();
          const data = ultraResult.polls || ultraResult;
          return data;
        }
      } catch (ultraError) {
        // Silent fallback
      }
      
      // FALLBACK: Standard endpoint
      const url = `${this.baseURL}/polls?${params}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: headers,
      });

      const data = await this.handleResponse(response);
      
      return data;
    } catch (error) {
      console.error('❌ Error fetching polls:', error);
      throw error;
    }
  }

  // 🚀 Cursor-based pagination (efficient deep scroll)
  async getPollsCursor(cursor = null, limit = 10, vs_only = true) {
    const params = new URLSearchParams({
      limit: limit.toString(),
      vs_only: vs_only.toString(),
    });
    if (cursor) params.append('cursor', cursor);

    try {
      const response = await fetch(`${this.baseURL}/polls/cursor?${params}`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Cursor pagination error: ${response.status}`);
      }

      const result = await response.json();
      return {
        polls: result.polls || [],
        nextCursor: result.next_cursor || null,
        hasMore: result.has_more || false
      };
    } catch (error) {
      console.error('❌ Cursor pagination error:', error);
      return { polls: [], nextCursor: null, hasMore: false };
    }
  }

  // ⚡ Preload next batch for infinite scroll
  async preloadNextBatch(currentOffset = 0, batchSize = 5) {
    try {
      const response = await fetch(
        `${this.baseURL}/polls/preload?current_offset=${currentOffset}&batch_size=${batchSize}`,
        { method: 'GET', headers: this.getAuthHeaders() }
      );
      if (response.ok) {
        return await response.json();
      }
    } catch (e) {
      // Silent
    }
    return { polls: [] };
  }

  // Get a specific poll by ID
  async getPollById(pollId) {
    try {
      const response = await fetch(`${this.baseURL}/polls/${pollId}`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      return await this.handleResponse(response);
    } catch (error) {
      console.error('Error fetching poll:', error);
      throw error;
    }
  }

  // Create a new poll
  async createPoll(pollData) {
    try {
      const response = await fetch(`${this.baseURL}/polls`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(pollData),
      });

      return await this.handleResponse(response);
    } catch (error) {
      console.error('Error creating poll:', error);
      throw error;
    }
  }

  // Vote on a poll
  // Accepts optional { optimistic } to support offline queue.
  async voteOnPoll(pollId, optionId, { optimistic } = {}) {
    try {
      const token = localStorage.getItem('token');
      const result = await queuedFetch({
        type: 'vote',
        resourceKey: `poll:${pollId}:vote`, // votes NO se deduplican, pero guardamos clave
        endpoint: `${this.baseURL}/polls/${pollId}/vote`,
        method: 'POST',
        body: { option_id: optionId },
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        optimistic: optimistic || {},
        requiresAuth: true,
      });
      return result;
    } catch (error) {
      console.error('Error voting on poll:', error);
      throw error;
    }
  }

  // Vote on a challenge (votes go to specific participant)
  async voteOnChallenge(challengeId, participantId) {
    try {
      const response = await fetch(`${this.baseURL}/challenges/${challengeId}/vote`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ participant_id: participantId }),
      });

      return await this.handleResponse(response);
    } catch (error) {
      console.error('Error voting on challenge:', error);
      throw error;
    }
  }

  // Toggle like on a poll
  // Accepts optional { optimistic } so que la UI no se revierta cuando la
  // acción es encolada offline. Si offline, el resource_key permite que dos
  // toggles consecutivos se cancelen en el queue.
  async toggleLike(pollId, { optimistic } = {}) {
    try {
      const token = localStorage.getItem('token');
      const result = await queuedFetch({
        type: 'like_toggle',
        resourceKey: `poll:${pollId}:like`,
        endpoint: `${this.baseURL}/polls/${pollId}/like`,
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        optimistic: optimistic || {},
        requiresAuth: true,
      });
      return result;
    } catch (error) {
      console.error('Error toggling like:', error);
      throw error;
    }
  }

  // Share a poll (increment share count)
  async sharePoll(pollId) {
    try {
      const response = await fetch(`${this.baseURL}/polls/${pollId}/share`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
      });

      return await this.handleResponse(response);
    } catch (error) {
      console.error('Error sharing poll:', error);
      throw error;
    }
  }

  // Get polls from followed users only
  async getFollowingPolls(params = {}) {
    try {
      const { limit = 20, offset = 0 } = params;
      
      // Use the new backend endpoint that filters polls by followed users
      const response = await fetch(`${this.baseURL}/polls/following?limit=${limit}&offset=${offset}`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('No estás autenticado');
        }
        throw new Error('Error al obtener publicaciones de usuarios seguidos');
      }

      const followingPolls = await response.json();
      
      // Transform and return the polls (they're already filtered by the backend)
      // 🎯 MVP VS-ONLY: aplicar filtro frontend para mostrar solo publicaciones VS
      return filterToVSOnly(followingPolls.map(poll => this.transformPollData(poll)));
      
    } catch (error) {
      console.error('Error loading following polls:', error);
      throw error;
    }
  }

  // Transform backend poll data to frontend format
  transformPollData(backendPoll) {
    const transformedPoll = {
      id: backendPoll.id,
      title: backendPoll.title,
      author: {
        id: backendPoll.author?.id,
        username: backendPoll.author?.username,
        display_name: backendPoll.author?.display_name,
        avatar_url: backendPoll.author?.avatar_url,
        is_verified: backendPoll.author?.is_verified
      },
      authorUser: {
        id: backendPoll.author?.id,
        username: backendPoll.author?.username,
        displayName: backendPoll.author?.display_name,
        avatar: backendPoll.author?.avatar_url,
        verified: backendPoll.author?.is_verified,
        followers: '1K' // Placeholder for now
      },
      timeAgo: backendPoll.time_ago,
      music: backendPoll.music || null,  // Si no hay música, devolver null (no mostrar "No Music")
      options: backendPoll.options.map(option => {
        // Sanitiza thumbnail: si la BD aún guarda la URL del video como
        // "thumbnail" (datos legacy antes del fix backend), lo descartamos.
        // Así el frontend cae a su renderizado de <video> (primer frame
        // como portada) en lugar de pintar un <img src="video.mp4"> roto.
        const rawMedia = option.media || null;
        const cleanedMedia = rawMedia ? (() => {
          const t = rawMedia.thumbnail;
          const looksLikeVideo = t && /\.(mp4|mov|webm|avi|m4v|mkv)(\?|$)/i.test(t);
          return {
            ...rawMedia,
            url: this.normalizeMediaUrl(rawMedia.url),
            thumbnail: looksLikeVideo ? null : this.normalizeMediaUrl(t),
            transform: rawMedia.transform
          };
        })() : null;
        const rawThumb = option.thumbnail_url;
        const cleanedThumb = (rawThumb && /\.(mp4|mov|webm|avi|m4v|mkv)(\?|$)/i.test(rawThumb)) ? null : rawThumb;
        return {
          id: option.id,
          user: option.user,
          text: option.text,
          votes: option.votes,
          participant_id: option.participant_id || null,  // 🏆 Challenge: participant user_id for voting
          participant_username: option.participant_username || null,
          participant_avatar: option.participant_avatar || null,
          mentioned_users: option.mentioned_users || [],  // ✅ CRITICAL FIX: Include option-specific mentioned_users
          extracted_audio_id: option.extracted_audio_id,  // 🎵 NUEVO: Include extracted_audio_id for carousel audio
          thumbnail_url: cleanedThumb,  // 🖼️ Sanitizado: nunca apunta al video
          media_type: option.media_type,  // 🎥 NUEVO: Include media_type for video detection
          media: cleanedMedia,
          // 🎬 Phase 2: legacy flat fields for video pipeline (MP4 + HLS).
          // mediaUrl.js los lee como fallback si la estructura "media" no existe.
          optimized_media_url: option.optimized_media_url || cleanedMedia?.optimizedUrl || null,
          hls_url: option.hls_url || cleanedMedia?.hls || null,
        };
      }),
      totalVotes: backendPoll.total_votes,
      likes: backendPoll.likes || backendPoll.likes_count || 0,
      shares: backendPoll.shares || backendPoll.shares_count || 0,
      comments: backendPoll.comments_count,
      saves_count: backendPoll.saves_count || 0,  // ✅ CRITICAL FIX: Include saves_count
      userVote: backendPoll.user_vote || backendPoll.userVote || null,
      userLiked: backendPoll.user_liked || backendPoll.userLiked || false,
      isSaved: backendPoll.isSaved || backendPoll.is_saved || false,
      userCommented: backendPoll.userCommented || backendPoll.user_commented || false,
      category: backendPoll.category,
      tags: backendPoll.tags || [],
      is_featured: backendPoll.is_featured,
      layout: backendPoll.layout,  // ✅ CRITICAL FIX: Include layout field for LayoutRenderer
      mentioned_users: backendPoll.mentioned_users || [],  // ✅ CRITICAL FIX: Include mentioned_users for avatar display
      // ✅ VS Experience fields - CRITICAL for multi-question VS polls
      vs_id: backendPoll.vs_id || null,
      vs_questions: backendPoll.vs_questions || [],
      creator_country: backendPoll.creator_country || null,  // Country where VS was created
      vs_orientation: backendPoll.vs_orientation || 'horizontal',  // 'vertical' (lado a lado) o 'horizontal' (arriba-abajo)
      // Post settings - snake_case from backend
      comments_enabled: backendPoll.comments_enabled !== undefined ? backendPoll.comments_enabled : true,
      show_vote_count: backendPoll.show_vote_count !== undefined ? backendPoll.show_vote_count : true,
      // Post settings - camelCase for frontend compatibility
      commentsEnabled: backendPoll.comments_enabled !== undefined ? backendPoll.comments_enabled : true,
      showVoteCount: backendPoll.show_vote_count !== undefined ? backendPoll.show_vote_count : true,
      // 🏆 Challenge fields
      is_challenge: backendPoll.is_challenge || false,
      challenge_id: backendPoll.challenge_id || null,
      challenge_status: backendPoll.challenge_status || null,
      participants: backendPoll.participants || [],
      // 📅 Date fields
      created_at: backendPoll.created_at || null
    };
    
    return transformedPoll;
  }

  // Normalize media URLs - convert relative to absolute
  normalizeMediaUrl(url) {
    if (!url) return null;
    
    // If already absolute, return as is
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    
    // If new API path format, prepend BACKEND_URL
    if (url.startsWith('/api/uploads/')) {
      return `${BACKEND_URL}${url}`;
    }
    
    // If legacy /uploads/ path, convert to API format
    if (url.startsWith('/uploads/')) {
      return `${BACKEND_URL}/api${url}`;
    }
    
    // Default fallback
    return url;
  }

  // Get polls in the format expected by the frontend components
  async getPollsForFrontend(options = {}) {
    try {
      const backendPolls = await this.getPolls(options);
      // Backend ya filtra VS con vs_only=true por defecto, pero mantenemos
      // filterToVSOnly como safety net por si el endpoint fallback (/polls)
      // no soporta el parámetro vs_only.
      const transformed = backendPolls.map(poll => this.transformPollData(poll));
      if (options.vs_only === false) return transformed;
      return filterToVSOnly(transformed);
    } catch (error) {
      console.error('Error fetching polls for frontend:', error);
      throw error;
    }
  }

  // Get user's polls using dedicated endpoint
  async getUserPolls(userId, options = {}) {
    const { limit = 50, offset = 0 } = options;
    try {
      const params = new URLSearchParams({ limit: limit.toString(), offset: offset.toString() });
      const response = await fetch(`${this.baseURL}/users/${userId}/polls?${params}`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });
      
      if (response.ok) {
        const data = await response.json();
        const polls = data.polls || data;
        console.log(`📋 getUserPolls: ${polls.length} polls loaded for user ${userId}`);
        // 🎯 MVP VS-ONLY: filtrar a solo publicaciones VS para perfil
        return filterToVSOnly(polls.map(poll => this.transformPollData(poll)));
      }
      
      // Fallback to general feed if dedicated endpoint fails
      console.warn('⚠️ getUserPolls endpoint failed, falling back to general feed filter');
      const allPolls = await this.getPolls({ limit: 100 });
      // 🎯 MVP VS-ONLY: aplicar filtro VS también en fallback
      return filterToVSOnly(allPolls
        .filter(poll => poll.author?.id === userId || poll.author?.username === userId)
        .map(poll => this.transformPollData(poll)));
    } catch (error) {
      console.error('Error fetching user polls:', error);
      return [];
    }
  }

  // Refresh poll data (useful after voting or liking)
  async refreshPoll(pollId) {
    try {
      const backendPoll = await this.getPollById(pollId);
      return this.transformPollData(backendPoll);
    } catch (error) {
      console.error('Error refreshing poll:', error);
      return null;
    }
  }
  // Update poll
  async updatePoll(pollId, updateData) {
    try {
      const response = await fetch(`${this.baseURL}/polls/${pollId}`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(updateData)
      });

      return await this.handleResponse(response);
    } catch (error) {
      console.error('Error updating poll:', error);
      throw error;
    }
  }

  // Delete poll
  async deletePoll(pollId) {
    try {
      const response = await fetch(`${this.baseURL}/polls/${pollId}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }

      return true;
    } catch (error) {
      console.error('Error deleting poll:', error);
      throw error;
    }
  }

  // Save a poll to user's saved collection
  async savePoll(pollId) {
    try {
      const response = await fetch(`${this.baseURL}/polls/${pollId}/save`, {
        method: 'POST',
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error saving poll:', error);
      throw error;
    }
  }

  // Remove a poll from user's saved collection
  async unsavePoll(pollId) {
    try {
      const response = await fetch(`${this.baseURL}/polls/${pollId}/save`, {
        method: 'DELETE',
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error unsaving poll:', error);
      throw error;
    }
  }

  // Get user's saved polls
  async getSavedPolls() {
    try {
      // Get current user ID from token
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }
      
      // Decode token to get user ID (simple base64 decode of JWT payload)
      const tokenParts = token.split('.');
      if (tokenParts.length !== 3) {
        throw new Error('Invalid token format');
      }
      
      const payload = JSON.parse(atob(tokenParts[1]));
      const userId = payload.sub;
      
      if (!userId) {
        throw new Error('User ID not found in token');
      }
      
      const response = await fetch(`${this.baseURL}/users/${userId}/saved-polls`, {
        method: 'GET',
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      const rawSavedPolls = result.saved_polls || [];
      
      // Transform backend poll data to frontend format
      return rawSavedPolls.map(poll => this.transformPollData(poll));
    } catch (error) {
      console.error('Error getting saved polls:', error);
      throw error;
    }
  }

  // Get user's liked polls
  async getLikedPolls(userId = null, skip = 0, limit = 20) {
    try {
      // Get current user ID from token if not provided
      if (!userId) {
        const token = localStorage.getItem('token');
        if (!token) {
          throw new Error('No authentication token found');
        }
        
        // Decode token to get user ID (simple base64 decode of JWT payload)
        const tokenParts = token.split('.');
        if (tokenParts.length !== 3) {
          throw new Error('Invalid token format');
        }
        
        const payload = JSON.parse(atob(tokenParts[1]));
        userId = payload.sub;
        
        if (!userId) {
          throw new Error('User ID not found in token');
        }
      }
      
      const response = await fetch(`${this.baseURL}/users/${userId}/liked-polls?skip=${skip}&limit=${limit}`, {
        method: 'GET',
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      const rawLikedPolls = result.liked_polls || [];
      
      // Transform backend poll data to frontend format
      return rawLikedPolls.map(poll => this.transformPollData(poll));
    } catch (error) {
      console.error('Error getting liked polls:', error);
      throw error;
    }
  }


  // Get polls where a specific user is mentioned
  async getUserMentionedPolls(userId, limit = 20, offset = 0) {
    try {
      const response = await fetch(`${this.baseURL}/users/${userId}/mentioned-polls?limit=${limit}&offset=${offset}`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }

      const rawMentionedPolls = await response.json();
      
      // Transform backend poll data to frontend format
      return rawMentionedPolls.map(poll => this.transformPollData(poll));
    } catch (error) {
      console.error('Error getting mentioned polls:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const pollService = new PollService();
export default pollService;