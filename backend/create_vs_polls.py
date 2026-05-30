#!/usr/bin/env python3
"""
Create 20+ VS polls for TikTok-like feed testing
Uses placeholder images (colored SVGs) to avoid external URL dependency
"""
import asyncio
import os
import uuid
from datetime import datetime, timedelta
from motor.motor_asyncio import AsyncIOMotorClient

# Simple colored SVG data URIs (no external deps)
def svg_data_uri(color, label=""):
    """Generate a colored SVG data URI for placeholder images"""
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">'
    svg += f'<rect width="400" height="400" fill="{color}"/>'
    svg += f'<text x="200" y="200" text-anchor="middle" dy=".3em" font-size="24" fill="white" font-family="sans-serif">{label}</text>'
    svg += '</svg>'
    import base64
    return f'data:image/svg+xml;base64,{base64.b64encode(svg.encode()).decode()}'

COLORS = ["#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7", "#DDA0DD", "#98D8C8", "#F7DC6F", "#BB8FCE", "#85C1E9",
           "#F1948A", "#82E0AA", "#F8C471", "#AED6F1", "#D7BDE2", "#A3E4D7", "#FAD7A0", "#ABEBC6", "#D5F5E3", "#FADBD8",
           "#D4E6F1", "#F5CBA7", "#E8DAEF", "#A9CCE3", "#D5DBDB", "#F9E79F", "#A9DFBF", "#F2D7D5", "#D2B4DE", "#AEB6BF"]

VS_POLLS = [
    # (title, option_a, color_a, option_b, color_b, orientation)
    ("\u00bfQui\u00e9n gana?", "Fuego", "#FF4500", "Hielo", "#00BFFF", "horizontal"),
    ("\u00bfCu\u00e1l prefieres?", "D\u00eda", "#FFD700", "Noche", "#2C3E50", "horizontal"),
    ("\u00bfQu\u00e9 es mejor?", "Perros", "#8B4513", "Gatos", "#FF6347", "horizontal"),
    ("\u00bfA d\u00f3nde vas?", "Playa", "#1E90FF", "Monta\u00f1a", "#228B22", "horizontal"),
    ("\u00bfQu\u00e9 comida?", "Pizza", "#FF4500", "Sushi", "#2E8B57", "vertical"),
    ("\u00bfQu\u00e9 g\u00e9nero?", "Rock", "#8B0000", "Reggaeton", "#FFD700", "horizontal"),
    ("\u00bfQu\u00e9 deporte?", "F\u00fatbol", "#00FF00", "Baloncesto", "#FF8C00", "vertical"),
    ("\u00bfVerano o?", "Verano", "#FF6347", "Invierno", "#4682B4", "horizontal"),
    ("\u00bfCaf\u00e9 o?", "Caf\u00e9", "#8B4513", "T\u00e9", "#556B2F", "vertical"),
    ("\u00bfDC o Marvel?", "Marvel", "#FF0000", "DC", "#0000FF", "horizontal"),
    ("\u00bfLibro o?", "Libro", "#DEB887", "Pel\u00edcula", "#4169E1", "vertical"),
    ("\u00bfDulce o?", "Dulce", "#FF69B4", "Salado", "#DAA520", "horizontal"),
    ("\u00bfPlay o?", "PlayStation", "#003087", "Xbox", "#107C10", "vertical"),
    ("\u00bfiOS o Android?", "iOS", "#000000", "Android", "#3DDC84", "horizontal"),
    ("\u00bfGym o?", "Gym", "#FF4500", "Cardio", "#00CED1", "vertical"),
    ("\u00bfProgramar o?", "Programar", "#6A5ACD", "Dormir", "#FFD700", "horizontal"),
    ("\u00bfNetflix o?", "Netflix", "#E50914", "YouTube", "#FF0000", "vertical"),
    ("\u00bfMa\u00f1ana o?", "Ma\u00f1ana", "#FFA500", "Tarde", "#8B4513", "horizontal"),
    ("\u00bfAgua o?", "Agua", "#00BFFF", "Fuego", "#FF4500", "vertical"),
    ("\u00bfSol o?", "Sol", "#FFD700", "Luna", "#C0C0C0", "horizontal"),
    ("\u00bfR\u00e1pido o?", "R\u00e1pido", "#FF0000", "Lento", "#808080", "vertical"),
    ("\u00bfFrio o?", "Frio", "#87CEEB", "Calor", "#FF6347", "horizontal"),
    ("\u00bfCielo o?", "Cielo", "#87CEEB", "Mar", "#00008B", "vertical"),
    ("\u00bfSelva o?", "Selva", "#228B22", "Desierto", "#F4A460", "horizontal"),
    ("\u00bfFiesta o?", "Fiesta", "#FF1493", "Tranqui", "#696969", "vertical"),
]

async def create_polls():
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    client = AsyncIOMotorClient(mongo_url)
    db = client[os.environ.get('DB_NAME', 'social_media_app')]
    
    # Find or create test user
    user = await db.users.find_one({"username": "Kiki"})
    if not user:
        user = await db.users.find_one({})
    if not user:
        print("ERROR: No users in database. Create a user first.")
        return
    
    user_id = user["id"]
    print(f"Using user: {user.get('username', 'unknown')} ({user_id})")
    
    created = 0
    skipped = 0
    
    for i, (title, opt_a, color_a, opt_b, color_b, orientation) in enumerate(VS_POLLS):
        poll_id = str(uuid.uuid4())
        
        existing = await db.polls.find_one({"title": title})
        if existing:
            print(f"  Skipped (exists): {title}")
            skipped += 1
            continue
        
        poll = {
            "id": poll_id,
            "title": title,
            "description": f"VS Duel: {opt_a} vs {opt_b}",
            "layout": "vs",
            "vs_orientation": orientation,
            "vs_id": str(uuid.uuid4()),
            "author_id": user_id,
            "author": {
                "id": user_id,
                "username": user.get("username", "user"),
                "display_name": user.get("display_name", user.get("username", "User")),
                "avatar_url": svg_data_uri("#666", user.get("username", "U")[0].upper())
            },
            "options": [
                {
                    "id": str(uuid.uuid4()),
                    "text": opt_a,
                    "votes": 0,
                    "media_url": svg_data_uri(color_a, opt_a),
                    "media_type": "image",
                    "thumbnail_url": svg_data_uri(color_a, opt_a),
                    "mentioned_users": []
                },
                {
                    "id": str(uuid.uuid4()),
                    "text": opt_b,
                    "votes": 0,
                    "media_url": svg_data_uri(color_b, opt_b),
                    "media_type": "image",
                    "thumbnail_url": svg_data_uri(color_b, opt_b),
                    "mentioned_users": []
                }
            ],
            "total_votes": 0,
            "is_active": True,
            "status": "ready",
            "challenge_pending": False,
            "is_public": True,
            "allow_comments": True,
            "allow_sharing": True,
            "views": 0,
            "likes": 0,
            "likes_count": 0,
            "comments_count": 0,
            "shares_count": 0,
            "saves_count": 0,
            "created_at": datetime.utcnow() - timedelta(minutes=i * 5),
            "expires_at": None,
            "music": None,
            "music_id": None,
            "creator_country": "US"
        }
        
        await db.polls.insert_one(poll)
        created += 1
        print(f"  Created: {title}")
    
    print(f"\nDone! Created: {created} VS polls, Skipped: {skipped}")
    print(f"Total polls in DB: {await db.polls.count_documents({})}")
    client.close()

if __name__ == "__main__":
    asyncio.run(create_polls())
