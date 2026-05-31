"""
URGENTE: Script para optimizar videos y generar thumbnails
Ejecutar para que el feed cargue instantáneamente como TikTok
"""

import asyncio
import os
import sys
from pathlib import Path
from datetime import datetime
import subprocess
import json
from motor.motor_asyncio import AsyncIOMotorClient

# Configuración HARDCODEADA (evita problemas de config)
MONGODB_URL = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
UPLOAD_BASE = Path('C:/Users/mackb/Desktop/mi-proyecto/backend/uploads')
UPLOADS_DIR = UPLOAD_BASE / 'videos'
THUMBNAILS_DIR = UPLOAD_BASE / 'thumbnails'

# Asegurar que existen los directorios
THUMBNAILS_DIR.mkdir(parents=True, exist_ok=True)
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

async def generate_thumbnail(video_path: str, output_path: str) -> bool:
    """Genera thumbnail optimizado (200x356, <50KB)"""
    try:
        cmd = [
            'ffmpeg', '-y',
            '-ss', '00:00:01',
            '-i', video_path,
            '-vf', 'scale=200:356:force_original_aspect_ratio=decrease,crop=200:356:(ow-iw)/2:(oh-ih)/2',
            '-frames:v', '1',
            '-q:v', '2',
            '-f', 'mjpeg',
            output_path
        ]
        
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await process.communicate()
        
        if process.returncode == 0:
            size_kb = os.path.getsize(output_path) / 1024
            print(f"  OK Thumbnail: {output_path.name} ({size_kb:.1f}KB)")
            return True
        else:
            print(f"  ERROR FFmpeg: {stderr.decode()[:200]}")
            return False
            
    except Exception as e:
        print(f"  ERROR: {e}")
        return False

async def optimize_video(video_path: str, output_path: str) -> bool:
    """Optimiza video a 720p, 1Mbps"""
    try:
        cmd = [
            'ffmpeg', '-y',
            '-i', video_path,
            '-vf', 'scale=720:1280:force_original_aspect_ratio=decrease',
            '-c:v', 'libx264',
            '-b:v', '1000k',
            '-preset', 'fast',
            '-movflags', '+faststart',
            '-c:a', 'aac',
            '-b:a', '128k',
            output_path
        ]
        
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await process.communicate()
        
        if process.returncode == 0:
            original_size = os.path.getsize(video_path) / (1024 * 1024)
            optimized_size = os.path.getsize(output_path) / (1024 * 1024)
            reduction = ((original_size - optimized_size) / original_size) * 100 if original_size > 0 else 0
            print(f"  OK Video: {original_size:.1f}MB -> {optimized_size:.1f}MB ({reduction:.0f}% menos)")
            return True
        else:
            print(f"  ERROR optimizando: {stderr.decode()[:200]}")
            return False
            
    except Exception as e:
        print(f"  ERROR: {e}")
        return False

async def fix_all_videos():
    """Procesa TODOS los videos en la BD"""
    print("=" * 70)
    print("OPTIMIZACION DE VIDEOS - TikTok-style loading")
    print("=" * 70)
    print(f"\nUploads: {UPLOADS_DIR}")
    print(f"Thumbnails: {THUMBNAILS_DIR}")
    print()
    
    # Conectar a MongoDB
    print("Conectando a MongoDB...")
    try:
        client = AsyncIOMotorClient(MONGODB_URL, serverSelectionTimeoutMS=5000)
        await client.admin.command('ping')  # Test connection
        db = client.get_database()
        print("OK Conectado a MongoDB")
    except Exception as e:
        print(f"ERROR conectando a MongoDB: {e}")
        print("Asegurate de que MongoDB este corriendo en localhost:27017")
        return
    
    # Buscar polls con videos
    print("\nBuscando videos en la BD...")
    try:
        polls_with_video = await db.polls.find({
            "options.media_type": "video"
        }).to_list(length=None)
        
        print(f"OK Encontrados {len(polls_with_video)} polls con videos")
    except Exception as e:
        print(f"ERROR buscando polls: {e}")
        return
    
    if not polls_with_video:
        print("\nNo hay videos para procesar")
        return
    
    # Procesar cada poll
    processed_count = 0
    success_count = 0
    start_time = datetime.now()
    
    for poll in polls_with_video:
        print(f"\n{'='*70}")
        print(f"Poll: {poll.get('title', 'N/A')[:50]}")
        print(f"ID: {poll['id']}")
        
        poll_updated = False
        
        for i, option in enumerate(poll.get('options', [])):
            if option.get('media_type') != 'video':
                continue
                
            media_url = option.get('media_url') or option.get('optimized_media_url')
            if not media_url:
                continue
            
            # Extraer path del archivo
            if '/uploads/' in media_url:
                video_filename = media_url.split('/uploads/')[-1]
                video_path = UPLOADS_DIR / video_filename
            else:
                video_filename = media_url.replace('/uploads/videos/', '')
                video_path = UPLOADS_DIR / video_filename
            
            if not video_path.exists():
                print(f"  WARN Video no encontrado: {video_path.name}")
                continue
            
            print(f"\n  Opcion {i+1}: {video_path.name}")
            
            # Generar thumbnail
            thumbnail_filename = f"{Path(video_path.stem).stem}_thumb.jpg"
            thumbnail_path = THUMBNAILS_DIR / thumbnail_filename
            
            if not thumbnail_path.exists():
                print(f"  Generando thumbnail...")
                thumb_success = await generate_thumbnail(str(video_path), str(thumbnail_path))
                if thumb_success:
                    option['thumbnail_url'] = f"/uploads/thumbnails/{thumbnail_filename}"
                    option['optimized_thumbnail_url'] = f"/uploads/thumbnails/{thumbnail_filename}"
                    poll_updated = True
            else:
                print(f"  OK Thumbnail ya existe")
            
            # Optimizar video
            optimized_filename = f"{Path(video_path.stem).stem}_optimized.mp4"
            optimized_path = UPLOADS_DIR / optimized_filename
            
            if not optimized_path.exists():
                print(f"  Optimizando video (720p, 1Mbps)...")
                video_success = await optimize_video(str(video_path), str(optimized_path))
                if video_success:
                    option['optimized_media_url'] = f"/uploads/videos/{optimized_filename}"
                    poll_updated = True
            else:
                print(f"  OK Video optimizado ya existe")
        
        # Actualizar poll en BD
        if poll_updated:
            try:
                result = await db.polls.update_one(
                    {"id": poll['id']},
                    {"$set": {"options": poll['options']}}
                )
                if result.modified_count > 0:
                    success_count += 1
                    print(f"  OK BD actualizada")
                processed_count += 1
            except Exception as e:
                print(f"  ERROR actualizando BD: {e}")
    
    # Resumen
    print(f"\n{'='*70}")
    print("RESUMEN")
    print(f"{'='*70}")
    print(f"Polls procesados: {processed_count}")
    print(f"Polls actualizados: {success_count}")
    print(f"Tiempo: {(datetime.now() - start_time).total_seconds():.1f}s")
    print()
    print("LISTO! Ahora el feed deberia cargar instantaneamente")
    print()
    print("PROXIMOS PASOS:")
    print("  1. Limpiar cache del navegador (Ctrl+Shift+R)")
    print("  2. Recargar el feed (/feed-v2)")
    print("  3. Verificar carga rapida de videos")
    print()
    
    client.close()

if __name__ == "__main__":
    # Verificar FFmpeg
    try:
        subprocess.run(['ffmpeg', '-version'], capture_output=True, check=True, timeout=5)
        print("OK FFmpeg instalado")
    except:
        print("ERROR: FFmpeg no instalado")
        print("  Windows: choco install ffmpeg")
        print("  Descargar: https://ffmpeg.org/download.html")
        sys.exit(1)
    
    # Ejecutar
    asyncio.run(fix_all_videos())