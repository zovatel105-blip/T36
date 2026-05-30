"""
Database Optimizer - TikTok-level performance
Optimizes MongoDB queries for 50K+ concurrent users
"""

from motor.motor_asyncio import AsyncIOMotorClient
from typing import Dict, List, Optional, Any
import asyncio
from datetime import datetime, timedelta
import json

class DatabaseOptimizer:
    """Ultra-fast database operations for social media scale"""
    
    def __init__(self, db):
        self.db = db
        self.cache = {}
        self.cache_ttl = 300  # 5 minutes
        self._index_count = 0
        
    async def initialize_indexes(self):
        """Create optimal indexes for TikTok-style queries"""
        
        print("🔧 Creating performance indexes...")
        
        # Polls collection - Critical indexes
        await self.db.polls.create_index([
            ("is_active", 1),
        self._index_count += 1
            ("created_at", -1)
        ], name="active_polls_by_date")
        
        await self.db.polls.create_index([
            ("author_id", 1),
        self._index_count += 1
            ("created_at", -1)
        ], name="user_polls_by_date")
        
        await self.db.polls.create_index([
            ("total_votes", -1),
        self._index_count += 1
            ("created_at", -1)
        ], name="trending_polls")
        
        await self.db.polls.create_index([
            ("likes_count", -1),
        self._index_count += 1
            ("created_at", -1)
        ], name="popular_polls")
        
        # 🔥 CRITICAL: challenge_pending filter usado en TODOS los feeds
        await self.db.polls.create_index([
            ("is_active", 1),
        self._index_count += 1
            ("challenge_pending", 1),
            ("created_at", -1)
        ], name="feed_active_no_challenge")
        
        # 🔥 CRITICAL: status filter usado en todos los feeds
        await self.db.polls.create_index([
            ("status", 1),
        self._index_count += 1
            ("is_active", 1),
            ("created_at", -1)
        ], name="feed_status_filter")
        
        # 🔥 CRITICAL: vs_id filter para VS-only queries
        await self.db.polls.create_index([
            ("vs_id", 1),
        self._index_count += 1
            ("is_active", 1),
            ("created_at", -1)
        ], name="vs_active_polls")
        
        # 🔥 CRITICAL: mencionados en opciones (get_mentioned_polls)
        await self.db.polls.create_index([
            ("options.mentioned_users", 1),
        self._index_count += 1
            ("is_active", 1),
            ("created_at", -1)
        ], name="mentioned_users_polls")
        
        # Users collection
        await self.db.users.create_index([("id", 1)], unique=True)
        self._index_count += 1
        await self.db.users.create_index([("username", 1)], unique=True)
        self._index_count += 1
        await self.db.users.create_index([("email", 1)], unique=True)
        self._index_count += 1
        
        # Votes collection - for fast user vote lookup
        await self.db.votes.create_index([
            ("user_id", 1),
        self._index_count += 1
            ("poll_id", 1)
        ], name="user_poll_votes")
        
        await self.db.votes.create_index([
            ("poll_id", 1),
        self._index_count += 1
            ("option_id", 1)
        ], name="poll_option_votes")
        
        # Likes collection
        await self.db.poll_likes.create_index([
            ("user_id", 1),
        self._index_count += 1
            ("poll_id", 1)
        ], name="user_poll_likes")
        
        await self.db.poll_likes.create_index([
            ("poll_id", 1)
        self._index_count += 1
        ], name="poll_likes")
        
        # Comments collection
        await self.db.comments.create_index([
            ("poll_id", 1),
        self._index_count += 1
            ("created_at", -1)
        ], name="poll_comments")
        
        # 🔥 Comment likes - usado en cada like check
        await self.db.comment_likes.create_index([
            ("comment_id", 1),
        self._index_count += 1
            ("user_id", 1)
        ], name="comment_likes_check")
        
        # 🔥 Login attempts - rate limiting
        await self.db.login_attempts.create_index([
            ("email", 1),
        self._index_count += 1
            ("created_at", -1)
        ], name="login_attempts_email")
        
        await self.db.login_attempts.create_index([
            ("ip_address", 1),
        self._index_count += 1
            ("created_at", -1)
        ], name="login_attempts_ip")
        
        # 🔥 Conversations - participant lookup
        await self.db.conversations.create_index([
            ("participants", 1),
        self._index_count += 1
            ("last_message_at", -1)
        ], name="conversations_participants")
        
        # 🔥 Messages - conversation listing
        await self.db.messages.create_index([
            ("conversation_id", 1),
        self._index_count += 1
            ("created_at", -1)
        ], name="messages_conversation")
        
        # 🔥 Chat requests
        await self.db.chat_requests.create_index([
            ("sender_id", 1),
        self._index_count += 1
            ("status", 1),
            ("created_at", -1)
        ], name="chat_requests_sender")
        
        await self.db.chat_requests.create_index([
            ("receiver_id", 1),
        self._index_count += 1
            ("status", 1),
            ("created_at", -1)
        ], name="chat_requests_receiver")
        
        # 🔥 Request views
        await self.db.request_views.create_index([
            ("user_id", 1),
        self._index_count += 1
            ("request_id", 1)
        ], name="request_views_user")
        
        # 🔥 Follower views
        await self.db.follower_views.create_index([
            ("user_id", 1)
        self._index_count += 1
        ], name="follower_views_user")
        
        # 🔥 Activity views
        await self.db.activity_views.create_index([
            ("user_id", 1)
        self._index_count += 1
        ], name="activity_views_user")
        
        # 🔥 Uploaded files - thumbnail lookup
        await self.db.uploaded_files.create_index([
            ("filename", 1)
        self._index_count += 1
        ], name="uploaded_files_filename")
        
        # 🔥 User audio
        await self.db.user_audio.create_index([
            ("uploader_id", 1),
        self._index_count += 1
            ("created_at", -1)
        ], name="user_audio_uploader")
        
        # 🔥 Poll shares
        await self.db.poll_shares.create_index([
            ("user_id", 1),
        self._index_count += 1
            ("created_at", -1)
        ], name="poll_shares_user")
        
        # 🔥 Search history
        await self.db.search_history.create_index([
            ("user_id", 1),
        self._index_count += 1
            ("created_at", -1)
        ], name="search_history_user")
        
        # 🔥 User devices
        await self.db.user_devices.create_index([
            ("user_id", 1)
        self._index_count += 1
        ], name="user_devices_user")
        
        # 🔥 Security notifications
        await self.db.security_notifications.create_index([
            ("user_id", 1),
        self._index_count += 1
            ("created_at", -1)
        ], name="security_notifications_user")
        
        # 🔥 User audio use
        await self.db.user_audio_use.create_index([
            ("audio_id", 1)
        self._index_count += 1
        ], name="user_audio_use_audio")
        
        # 🔥 Follows - get_following_polls
        await self.db.follows.create_index([
            ("follower_id", 1),
        self._index_count += 1
            ("following_id", 1)
        ], name="follows_follower_following")
        
        # 🔥 Saved polls
        await self.db.saved_polls.create_index([
            ("user_id", 1),
        self._index_count += 1
            ("poll_id", 1)
        ], name="saved_polls_user_poll")
        
        print(f"✅ {self._index_count} performance indexes created successfully")
    
    async def get_optimized_feed(
        self, 
        user_id: str, 
        limit: int = 20, 
        offset: int = 0,
        algorithm: str = "for_you"
    ) -> List[Dict]:
        """
        Ultra-optimized feed query - Single aggregation pipeline
        Replaces multiple queries with one efficient aggregation
        """
        
        cache_key = f"feed_{algorithm}_{user_id}_{limit}_{offset}"
        
        # Check cache first
        if cache_key in self.cache:
            cached_data, timestamp = self.cache[cache_key]
            if datetime.now().timestamp() - timestamp < self.cache_ttl:
                return cached_data
        
        try:
            # Single aggregation pipeline for maximum efficiency
            pipeline = [
                # Stage 1: Filter active polls
                {
                    "$match": {
                        "is_active": True
                    }
                },
                
                # Stage 2: Sort by algorithm
                {
                    "$sort": self._get_sort_criteria(algorithm)
                },
                
                # Stage 3: Pagination
                {
                    "$skip": offset
                },
                {
                    "$limit": limit
                },
                
                # Stage 4: Lookup author info (single join)
                {
                    "$lookup": {
                        "from": "users",
                        "localField": "author_id",
                        "foreignField": "id",
                        "as": "author",
                        "pipeline": [
                            {
                                "$project": {
                                    "id": 1,
                                    "username": 1,
                                    "display_name": 1,
                                    "avatar_url": 1,
                                    "is_verified": 1
                                }
                            }
                        ]
                    }
                },
                
                # Stage 5: Lookup user vote (single join)
                {
                    "$lookup": {
                        "from": "votes",
                        "let": { "poll_id": "$id" },
                        "pipeline": [
                            {
                                "$match": {
                                    "$expr": {
                                        "$and": [
                                            { "$eq": ["$poll_id", "$$poll_id"] },
                                            { "$eq": ["$user_id", user_id] }
                                        ]
                                    }
                                }
                            },
                            { "$project": { "option_id": 1 } }
                        ],
                        "as": "user_vote"
                    }
                },
                
                # Stage 6: Lookup user like (single join)  
                {
                    "$lookup": {
                        "from": "poll_likes",
                        "let": { "poll_id": "$id" },
                        "pipeline": [
                            {
                                "$match": {
                                    "$expr": {
                                        "$and": [
                                            { "$eq": ["$poll_id", "$$poll_id"] },
                                            { "$eq": ["$user_id", user_id] }
                                        ]
                                    }
                                }
                            }
                        ],
                        "as": "user_like"
                    }
                },
                
                # Stage 7: Project final structure
                {
                    "$project": {
                        "id": 1,
                        "title": 1,
                        "author": { "$arrayElemAt": ["$author", 0] },
                        "options": {
                            "$slice": ["$options", 4]  # Limit options for performance
                        },
                        "created_at": 1,
                        "total_votes": { "$ifNull": ["$total_votes", 0] },
                        "likes_count": { "$ifNull": ["$likes_count", 0] },
                        "comments_count": { "$ifNull": ["$comments_count", 0] },
                        "layout": 1,
                        "music": 1,
                        "userVote": {
                            "$ifNull": [
                                { "$arrayElemAt": ["$user_vote.option_id", 0] },
                                None
                            ]
                        },
                        "userLiked": { "$gt": [{ "$size": "$user_like" }, 0] }
                    }
                }
            ]
            
            # Execute aggregation
            cursor = self.db.polls.aggregate(pipeline, allowDiskUse=True)
            results = await cursor.to_list(limit)
            
            # Cache results
            self.cache[cache_key] = (results, datetime.now().timestamp())
            
            return results
            
        except Exception as e:
            print(f"❌ Optimized feed query failed: {str(e)}")
            raise
    
    def _get_sort_criteria(self, algorithm: str) -> Dict:
        """Get sorting criteria based on algorithm"""
        
        algorithms = {
            "for_you": {
                "total_votes": -1,
                "likes_count": -1, 
                "created_at": -1
            },
            "following": {
                "created_at": -1
            },
            "trending": {
                "likes_count": -1,
                "total_votes": -1,
                "created_at": -1
            },
            "recent": {
                "created_at": -1
            }
        }
        
        return algorithms.get(algorithm, algorithms["for_you"])
    
    async def batch_user_data(self, user_ids: List[str]) -> Dict[str, Dict]:
        """
        Batch load user data to avoid N+1 queries
        """
        
        cache_key = f"users_batch_{hash(tuple(sorted(user_ids)))}"
        
        # Check cache
        if cache_key in self.cache:
            cached_data, timestamp = self.cache[cache_key]
            if datetime.now().timestamp() - timestamp < self.cache_ttl:
                return cached_data
        
        try:
            cursor = self.db.users.find(
                {"id": {"$in": user_ids}},
                {
                    "id": 1,
                    "username": 1,
                    "display_name": 1,
                    "avatar_url": 1,
                    "is_verified": 1
                }
            )
            
            users = await cursor.to_list(len(user_ids))
            users_dict = {user["id"]: user for user in users}
            
            # Cache results
            self.cache[cache_key] = (users_dict, datetime.now().timestamp())
            
            return users_dict
            
        except Exception as e:
            print(f"❌ Batch user data failed: {str(e)}")
            return {}
    
    async def batch_user_interactions(
        self, 
        user_id: str, 
        poll_ids: List[str]
    ) -> Dict[str, Dict]:
        """
        Batch load user interactions (votes, likes) for multiple polls
        """
        
        try:
            # Get votes and likes in parallel
            votes_task = self.db.votes.find(
                {
                    "user_id": user_id,
                    "poll_id": {"$in": poll_ids}
                },
                {"poll_id": 1, "option_id": 1}
            ).to_list(len(poll_ids))
            
            likes_task = self.db.poll_likes.find(
                {
                    "user_id": user_id,
                    "poll_id": {"$in": poll_ids}
                },
                {"poll_id": 1}
            ).to_list(len(poll_ids))
            
            votes, likes = await asyncio.gather(votes_task, likes_task)
            
            # Convert to dictionaries
            votes_dict = {vote["poll_id"]: vote["option_id"] for vote in votes}
            likes_set = {like["poll_id"] for like in likes}
            
            return {
                "votes": votes_dict,
                "likes": likes_set
            }
            
        except Exception as e:
            print(f"❌ Batch interactions failed: {str(e)}")
            return {"votes": {}, "likes": set()}
    
    async def update_counters_batch(self, updates: List[Dict]):
        """
        Batch update counters to avoid multiple database hits
        """
        
        try:
            bulk_ops = []
            
            for update in updates:
                poll_id = update["poll_id"]
                counter_type = update["type"]  # "likes", "votes", "comments"
                increment = update.get("increment", 1)
                
                bulk_ops.append({
                    "updateOne": {
                        "filter": {"id": poll_id},
                        "update": {"$inc": {f"{counter_type}_count": increment}}
                    }
                })
            
            if bulk_ops:
                await self.db.polls.bulk_write(bulk_ops)
        self._index_count += 1
                print(f"✅ Updated {len(bulk_ops)} counters in batch")
            
        except Exception as e:
            print(f"❌ Batch counter update failed: {str(e)}")
    
    async def get_trending_polls(
        self, 
        time_window_hours: int = 24,
        limit: int = 50
    ) -> List[Dict]:
        """
        Get trending polls using optimized aggregation
        """
        
        try:
            since_time = datetime.utcnow() - timedelta(hours=time_window_hours)
            
            pipeline = [
                {
                    "$match": {
                        "is_active": True,
                        "created_at": {"$gte": since_time}
                    }
                },
                {
                    "$addFields": {
                        "trending_score": {
                            "$add": [
                                {"$multiply": ["$likes_count", 2]},  # Likes worth 2x
                                "$total_votes",
                                {"$multiply": ["$comments_count", 3]}  # Comments worth 3x
                            ]
                        }
                    }
                },
                {
                    "$sort": {"trending_score": -1}
                },
                {
                    "$limit": limit
                },
                {
                    "$lookup": {
                        "from": "users",
                        "localField": "author_id", 
                        "foreignField": "id",
                        "as": "author"
                    }
                },
                {
                    "$project": {
                        "id": 1,
                        "title": 1,
                        "author": {"$arrayElemAt": ["$author", 0]},
                        "total_votes": 1,
                        "likes_count": 1,
                        "comments_count": 1,
                        "trending_score": 1,
                        "created_at": 1
                    }
                }
            ]
            
            cursor = self.db.polls.aggregate(pipeline)
            return await cursor.to_list(limit)
            
        except Exception as e:
            print(f"❌ Trending polls query failed: {str(e)}")
            return []
    
    def clear_cache(self):
        """Clear query cache"""
        self.cache.clear()
        print("🧹 Database query cache cleared")
    
    def get_cache_stats(self) -> Dict:
        """Get cache statistics"""
        return {
            "cache_size": len(self.cache),
            "cache_ttl_seconds": self.cache_ttl
        }

# Global instance
db_optimizer = None

def init_db_optimizer(db):
    """Initialize database optimizer"""
    global db_optimizer
    db_optimizer = DatabaseOptimizer(db)
    
    # Initialize indexes in background
    asyncio.create_task(db_optimizer.initialize_indexes())
    
    return db_optimizer