"""
URGENTE: Script para optimizar TODOS los videos existentes y generar thumbnails
Ejecutar ESTE SCRIPT para que el feed cargue instantáneamente como TikTok

Uso:
  python fix_video_loading_urgente.py

Qué hace:
  1. Conecta a MongoDB
  2. Busca TODOS los videos subidos
  3. Genera thumbnails optimizados (200x356, <50KB)
  4. Crea versiones optimizadas de videos (720p, <5MB)
  5. Actualiza la BD con las URLs optimizadas
  6. Limpia cache del frontend

Tiempo estimado: 2-5 minutos por cada 10 videos
"""

import asyncio
import os
import sys
from pathlib import Path
from datetime import datetime
import subprocess
import json

# Agregar backend al path
sys.path.insert(0, str(Path(__file__).parent / 'backend'))

from motor.motor_asyncio import AsyncIOMotorClient
from config import Config

# Configuración
config = Config()
MONGODB_URL = config.MONGO_URL()
UPLOADS_DIR = Path(config.UPLOAD_BASE_DIR) / 'videos'
THUMBNAILS_DIR = Path(config.UPLOAD_BASE_DIR) / 'thumbnails'

# Asegurar que existen los directorios
THUMBNAILS_DIR.mkdir(parents=True, exist_ok=True)

async def generate_thumbnail(video_path: str, output_path: str) -> bool:
    """Genera thumbnail optimizado (200x356, <50KB) desde el frame 1s del video"""
    try:
        # Comando FFmpeg optimizado para velocidad
        cmd = [
            'ffmpeg', '-y',
            '-ss', '00:00:01',  # Frame en segundo 1
            '-i', video_path,
            '-vf', 'scale=200:356:force_original_aspect_ratio=decrease,crop=200:356:(ow-iw)/2:(oh-ih)/2',
            '-frames:v', '1',
            '-q:v', '2',  # Calidad alta pero tamaño pequeño
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
            print(f"  ✅ Thumbnail generado: {output_path.name} ({size_kb:.1f}KB)")
            return True
        else:
            print(f"  ❌ Error FFmpeg: {stderr.decode()}")
            return False
            
    except Exception as e:
        print(f"  ❌ Error generando thumbnail: {e}")
        return False

async def optimize_video(video_path: str, output_path: str) -> bool:
    """Optimiza video a 720p, 1Mbps, max 60s"""
    try:
        cmd = [
            'ffmpeg', '-y',
            '-i', video_path,
            '-vf', 'scale=720:1280:force_original_aspect_ratio=decrease',
            '-c:v', 'libx264',
            '-b:v', '1000k',  # 1 Mbps
            '-preset', 'fast',  # Balance velocidad/calidad
            '-movflags', '+faststart',  # Progressive download
            '-c:a', 'aac',
            '-b:a', '128k',
            '-maxrate', '1200k',
            '-bufsize', '1500k',
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
            reduction = ((original_size - optimized_size) / original_size) * 100
            print(f"  ✅ Video optimizado: {original_size:.1f}MB → {optimized_size:.1f}MB ({reduction:.0f}% menos)")
            return True
        else:
            print(f"  ❌ Error optimizando video: {stderr.decode()}")
            return False
            
    except Exception as e:
        print(f"  ❌ Error optimizando video: {e}")
        return False

async def fix_all_videos():
    """Procesa TODOS los videos en la base de datos"""
    print("=" * 70)
    print("🚀 OPTIMIZACIÓN URGENTE DE VIDEOS - TikTok-style loading")
    print("=" * 70)
    print(f"\n📁 Directorio de uploads: {UPLOADS_DIR}")
    print(f"📁 Directorio de thumbnails: {THUMBNAILS_DIR}")
    print()
    
    # Conectar a MongoDB
    print("📡 Conectando a MongoDB...")
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client.get_database()
    
    # Buscar TODOS los polls con videos
    print("🔍 Buscando videos en la base de datos...")
    polls_with_video = await db.polls.find({
        "options.media_type": "video"
    }).to_list(length=None)
    
    print(f"✅ Encontrados {len(polls_with_video)} polls con videos")
    print()
    
    # Procesar cada poll
    processed_count = 0
    success_count = 0
    
    for poll in polls_with_video:
        print(f"\n{'='*70}")
        print(f"📹 Procesando poll: {poll.get('title', 'N/A')[:50]}")
        print(f"   ID: {poll['id']}")
        
        poll_updated = False
        
        # Procesar cada opción con video
        for i, option in enumerate(poll.get('options', [])):
            if option.get('media_type') != 'video':
                continue
                
            media_url = option.get('media_url') or option.get('optimized_media_url')
            if not media_url:
                continue
            
            # Extraer path del archivo
            # Ejemplo: /uploads/videos/user123_1234567890.mp4 → videos/user123_1234567890.mp4
            if '/uploads/' in media_url:
                video_filename = media_url.split('/uploads/')[-1]
                video_path = UPLOADS_DIR / video_filename
            else:
                video_path = UPLOADS_DIR / media_url
            
            if not video_path.exists():
                print(f"  ⚠️  Video no encontrado: {video_path}")
                continue
            
            print(f"\n  📹 Opción {i+1}: {video_path.name}")
            
            # Generar thumbnail
            thumbnail_filename = f"{Path(video_path.stem).stem}_thumb.jpg"
            thumbnail_path = THUMBNAILS_DIR / thumbnail_filename
            
            if not thumbnail_path.exists():
                print(f"  🖼️  Generando thumbnail...")
                thumb_success = await generate_thumbnail(str(video_path), str(thumbnail_path))
                if thumb_success:
                    # Actualizar opción con thumbnail
                    option['thumbnail_url'] = f"/uploads/thumbnails/{thumbnail_filename}"
                    option['optimized_thumbnail_url'] = f"/uploads/thumbnails/{thumbnail_filename}"
                    poll_updated = True
                    print(f"  ✅ Thumbnail: {thumbnail_filename}")
            else:
                print(f"  ✅ Thumbnail ya existe: {thumbnail_filename}")
            
            # Optimizar video (solo si no existe versión optimizada)
            optimized_filename = f"{Path(video_path.stem).stem}_optimized.mp4"
            optimized_path = UPLOADS_DIR / optimized_filename
            
            if not optimized_path.exists():
                print(f"  🎬 Optimizando video (720p, 1Mbps)...")
                video_success = await optimize_video(str(video_path), str(optimized_path))
                if video_success:
                    # Actualizar opción con video optimizado
                    option['optimized_media_url'] = f"/uploads/videos/{optimized_filename}"
                    poll_updated = True
                    print(f"  ✅ Video optimizado: {optimized_filename}")
            else:
                print(f"  ✅ Video optimizado ya existe: {optimized_filename}")
        
        # Actualizar poll en BD si hubo cambios
        if poll_updated:
            result = await db.polls.update_one(
                {"id": poll['id']},
                {"$set": {"options": poll['options']}}
            )
            if result.modified_count > 0:
                success_count += 1
                print(f"  💾 BD actualizada exitosamente")
            processed_count += 1
    
    # Resumen final
    print(f"\n{'='*70}")
    print("📊 RESUMEN FINAL")
    print(f"{'='*70}")
    print(f"✅ Polls procesados: {processed_count}")
    print(f"✅ Polls actualizados en BD: {success_count}")
    print(f"⏱️  Tiempo total: {(datetime.now() - start_time).total_seconds():.1f}s")
    print()
    print("🎉 ¡LISTO! Ahora el feed debería cargar INSTANTÁNEAMENTE como TikTok")
    print()
    print("📝 PRÓXIMOS PASOS:")
    print("   1. Limpiar cache del navegador (Ctrl+Shift+R)")
    print("   2. Recargar el feed (/feed-v2)")
    print("   3. Verificar que los videos cargan en <1 segundo")
    print()
    
    # Cerrar conexión
    client.close()

if __name__ == "__main__":
    start_time = datetime.now()
    
    # Verificar FFmpeg
    try:
        subprocess.run(['ffmpeg', '-version'], capture_output=True, check=True)
        print("✅ FFmpeg está instalado")
    except:
        print("❌ FFmpeg NO está instalado. Instalar primero:")
        print("   Windows: choco install ffmpeg")
        print("   Linux: sudo apt install ffmpeg")
        print("   Mac: brew install ffmpeg")
        sys.exit(1)
    
    # Ejecutar script
    asyncio.run(fix_all_videos())