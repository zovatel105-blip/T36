/**
 * Datos MOCK para probar fluidez de TikTokScrollView
 * Sin necesidad de backend/MongoDB
 * 
 * Uso: Importar en FeedPage.jsx temporalmente para testing
 */

export const MOCK_POLLS = Array.from({ length: 30 }, (_, i) => ({
  id: `mock_${i}`,
  title: `Publicación de prueba #${i + 1}`,
  author: {
    id: 'user_1',
    username: 'testuser',
    display_name: 'Usuario de Prueba',
    avatar_url: 'https://ui-avatars.com/api/?name=Test+User&background=random',
    is_verified: false
  },
  authorUser: {
    id: 'user_1',
    username: 'testuser',
    display_name: 'Usuario de Prueba',
    avatar_url: 'https://ui-avatars.com/api/?name=Test+User&background=random',
    is_verified: false
  },
  created_at: new Date(Date.now() - i * 3600000).toISOString(),
  layout: 'vs',
  status: 'active',
  is_active: true,
  total_votes: Math.floor(Math.random() * 1000),
  likes_count: Math.floor(Math.random() * 500),
  comments_count: Math.floor(Math.random() * 100),
  options: [
    {
      id: `opt_a_${i}`,
      text: 'Opción A',
      votes: Math.floor(Math.random() * 500),
      media_type: 'video',
      media_url: 'https://www.w3schools.com/html/mov_bbb.mp4',
      optimized_media_url: 'https://www.w3schools.com/html/mov_bbb.mp4',
      thumbnail_url: '',
      duration: 10
    },
    {
      id: `opt_b_${i}`,
      text: 'Opción B',
      votes: Math.floor(Math.random() * 500),
      media_type: 'video',
      media_url: 'https://www.w3schools.com/html/movie.mp4',
      optimized_media_url: 'https://www.w3schools.com/html/movie.mp4',
      thumbnail_url: '',
      duration: 15
    }
  ],
  music: null,
  is_challenge: false,
  userVote: null,
  userLiked: false,
  timeAgo: `hace ${i} horas`
}));

export default MOCK_POLLS;