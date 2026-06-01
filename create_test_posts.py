"""
Script para crear 20-30 publicaciones de prueba con videos ligeros
Para probar la fluidez real de TikTokScrollView con suficiente contenido
"""

import asyncio
from datetime import datetime, timedelta
import random
from motor.motor_asyncio import AsyncIOMotorClient
import os
from pathlib import Path

# Configuración
MONGODB_URL = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
db_name = 'votatok'

# Videos de prueba (usamos videos de muestra de internet)
SAMPLE_VIDEOS = [
    # Videos cortos de muestra (puedes reemplazar con URLs reales)
    {
        'url': 'https://www.w3schools.com/html/mov_bbb.mp4',
        'title': 'Video de prueba 1',
        'duration': 10
    },
    {
        'url': 'https://www.w3schools.com/html/movie.mp4',
        'title': 'Video de prueba 2',
        'duration': 15
    },
]

# Textos para publicaciones
TITLES = [
    "¿Cuál te gusta más?",
    "Elige tu favorito",
    "¿Quién gana?",
    "Vota por el mejor",
    "¿Cuál prefieres?",
    "¡Ayúdame a decidir!",
    "¿Team A o Team B?",
    "¿Cuál está mejor?",
    "Votación del día",
    "¿Qué opinas?",
]

async def create_test_posts():
    """Crea 20-30 publicaciones de prueba"""
    
    print("=" * 70)
    print("CREANDO PUBLICACIONES DE PRUEBA")
    print("=" * 70)
    
    # Conectar a MongoDB
    print("\nConectando a MongoDB...")
    try:
        client = AsyncIOMotorClient(MONGODB_URL, serverSelectionTimeoutMS=5000)
        await client.admin.command('ping')
        db = client[db_name]
        print("OK Conectado")
    except Exception as e:
        print(f"ERROR: {e}")
        print("Asegúrate de que MongoDB esté corriendo")
        return
    
    # Limpiar publicaciones existentes (opcional)
    print("\nLimpiando publicaciones existentes...")
    result = await db.polls.delete_many({})
    print(f"OK Eliminadas {result.deleted_count} publicaciones")
    
    # Crear 20 publicaciones nuevas
    print("\nCreando 20 publicaciones de prueba...")
    
    now = datetime.now()
    created_posts = []
    
    for i in range(20):
        # Seleccionar video aleatorio
        video_data = random.choice(SAMPLE_VIDEOS)
        
        # Crear publicación tipo VS (comparación)
        poll = {
            'id': f'test_poll_{i+1}',
            'title': f'{random.choice(TITLES)} #{i+1}',
            'author_id': 'test_user_1',
            'created_at': now - timedelta(hours=i),
            'layout': 'vs',
            'status': 'active',
            'is_active': True,
            'total_votes': random.randint(10, 1000),
            'likes_count': random.randint(5, 500),
            'comments_count': random.randint(0, 100),
            'options': [
                {
                    'id': f'opt_a_{i}',
                    'text': f'Opción A',
                    'votes': random.randint(5, 500),
                    'media_type': 'video',
                    'media_url': video_data['url'],
                    'optimized_media_url': video_data['url'],
                    'thumbnail_url': '',
                    'duration': video_data['duration']
                },
                {
                    'id': f'opt_b_{i}',
                    'text': f'Opción B',
                    'votes': random.randint(5, 500),
                    'media_type': 'video',
                    'media_url': video_data['url'],
                    'optimized_media_url': video_data['url'],
                    'thumbnail_url': '',
                    'duration': video_data['duration']
                }
            ],
            'music': None,
            'is_challenge': False,
        }
        
        created_posts.append(poll)
        
        if (i + 1) % 5 == 0:
            print(f"  Creadas {i+1}/20 publicaciones...")
    
    # Insertar todas las publicaciones
    if created_posts:
        result = await db.polls.insert_many(created_posts)
        print(f"\nOK {len(result.inserted_ids)} publicaciones creadas exitosamente")
    
    # Crear usuario de prueba si no existe
    print("\nCreando usuario de prueba...")
    user = {
        'id': 'test_user_1',
        'username': 'testuser',
        'display_name': 'Usuario de Prueba',
        'email': 'test@example.com',
        'avatar_url': 'https://ui-avatars.com/api/?name=Test+User&background=random',
        'is_verified': False,
        'created_at': now,
        'bio': 'Usuario de prueba para testing',
        'followers_count': 0,
        'following_count': 0,
    }
    
    await db.users.update_one(
        {'id': 'test_user_1'},
        {'$set': user},
        upsert=True
    )
    print("OK Usuario de prueba creado/actualizado")
    
    # Resumen
    print("\n" + "=" * 70)
    print("RESUMEN")
    print("=" * 70)
    total_polls = await db.polls.count_documents({})
    print(f"Total publicaciones en BD: {total_polls}")
    print(f"Publicaciones de prueba creadas: {len(created_posts)}")
    print()
    print("AHORA PUEDES PROBAR LA FLUIDEZ:")
    print("  1. Abre http://localhost:3000/feed")
    print("  2. Haz scroll hacia abajo (deberías tener 20 publicaciones)")
    print("  3. Los videos son de muestra (w3schools.com)")
    print("  4. Debería ser FLUIDO como TikTok Web")
    print()
    
    client.close()

if __name__ == "__main__":
    asyncio.run(create_test_posts())