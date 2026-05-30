"""
✅ Configuración automática de entorno para backend Emergent.sh
Detecta automáticamente URLs de MongoDB y configuraciones según el entorno
"""
import os
import socket
import requests
from typing import Optional, Dict, Any
import logging

logger = logging.getLogger(__name__)


class EnvironmentDetector:
    """Detecta y configura automáticamente el entorno de ejecución"""
    
    def __init__(self):
        self.hostname = self._get_hostname()
        self.environment = self._detect_environment()
        self.config = self._generate_config()
        
    def _get_hostname(self) -> str:
        """Obtiene el hostname actual"""
        try:
            # Intenta obtener hostname del contenedor/sistema
            hostname = socket.gethostname()
            
            # Si está en Kubernetes, puede tener variables de entorno específicas
            k8s_hostname = os.getenv('HOSTNAME')
            if k8s_hostname:
                hostname = k8s_hostname
                
            # Intenta obtener el dominio desde variables de Emergent
            emergent_domain = os.getenv('EMERGENT_DOMAIN')
            if emergent_domain:
                return emergent_domain
                
            return hostname
        except Exception as e:
            logger.warning(f"Error obteniendo hostname: {e}")
            return "localhost"
    
    def _detect_environment(self) -> Dict[str, Any]:
        """Detecta el tipo de entorno actual"""
        env_info = {
            'type': 'unknown',
            'is_local': False,
            'is_emergent': False,
            'is_kubernetes': False,
            'subdomain': None,
            'account': None
        }
        
        # Detectar entorno local
        if (self.hostname in ['localhost', '127.0.0.1'] or 
            self.hostname.startswith('localhost') or
            os.getenv('ENVIRONMENT') == 'local'):
            env_info.update({
                'type': 'local',
                'is_local': True
            })
            return env_info
        
        # Detectar entorno Kubernetes
        if (os.path.exists('/var/run/secrets/kubernetes.io') or
            os.getenv('KUBERNETES_SERVICE_HOST')):
            env_info['is_kubernetes'] = True
        
        # Detectar entorno Emergent.sh
        emergent_patterns = [
            '.emergent.sh',
            'emergent',
            os.getenv('EMERGENT_ACCOUNT')
        ]
        
        for pattern in emergent_patterns:
            if pattern and pattern in self.hostname:
                env_info.update({
                    'type': 'emergent',
                    'is_emergent': True,
                    'subdomain': self._extract_subdomain(),
                    'account': self._extract_account()
                })
                break
        
        # Si está en Kubernetes pero no hemos detectado Emergent, probablemente sea Emergent
        if env_info['is_kubernetes'] and not env_info['is_emergent']:
            # Intenta obtener información de la cuenta desde variables de entorno
            subdomain = (os.getenv('EMERGENT_SUBDOMAIN') or 
                        os.getenv('EMERGENT_ACCOUNT') or 
                        os.getenv('APP_NAME') or
                        'default')
            
            env_info.update({
                'type': 'emergent',
                'is_emergent': True,
                'subdomain': subdomain,
                'account': subdomain
            })
        
        return env_info
    
    def _extract_subdomain(self) -> Optional[str]:
        """Extrae el subdominio de Emergent.sh"""
        try:
            # Desde hostname
            if '.emergent.sh' in self.hostname:
                return self.hostname.split('.')[0]
            
            # Desde variables de entorno
            return os.getenv('EMERGENT_SUBDOMAIN')
        except Exception:
            return None
    
    def _extract_account(self) -> Optional[str]:
        """Extrae la cuenta de Emergent.sh"""
        subdomain = self._extract_subdomain()
        if subdomain:
            return subdomain
        
        return os.getenv('EMERGENT_ACCOUNT', os.getenv('USER'))
    
    def _generate_config(self) -> Dict[str, str]:
        """Genera la configuración basada en el entorno detectado"""
        config = {}
        
        if self.environment['type'] == 'local':
            # Configuración para desarrollo local
            config.update({
                'MONGO_URL': 'mongodb://localhost:27017',
                'DB_NAME': 'social_media_app',
                'FRONTEND_URL': 'http://localhost:3000',
                'CORS_ORIGINS': 'http://localhost:3000',
                'SECRET_KEY': 'local-development-key-not-for-production'
            })
            
        elif self.environment['type'] == 'emergent':
            # Configuración para Emergent.sh
            account = self.environment.get('account', 'default')
            subdomain = self.environment.get('subdomain', account)
            
            # Usar variables de entorno existentes si están disponibles
            mongo_url = (os.getenv('MONGO_URL') or 
                        f'mongodb://mongo.{subdomain}.emergent.sh:27017' if subdomain != 'default' 
                        else 'mongodb://localhost:27017')
            
            frontend_url = (os.getenv('FRONTEND_URL') or 
                           f'https://{subdomain}.emergent.sh' if subdomain != 'default'
                           else 'http://localhost:3000')
            
            config.update({
                'MONGO_URL': mongo_url,
                'DB_NAME': os.getenv('DB_NAME', f'{account}_social_media'),
                'FRONTEND_URL': frontend_url,
                'CORS_ORIGINS': os.getenv('CORS_ORIGINS', frontend_url),
                'SECRET_KEY': os.getenv('SECRET_KEY') or self._generate_secret_key(account)
            })
            
            # Intenta obtener configuración dinámica si está disponible
            try:
                dynamic_config = self._fetch_dynamic_config(subdomain)
                if dynamic_config:
                    config.update(dynamic_config)
            except Exception as e:
                logger.warning(f"No se pudo obtener configuración dinámica: {e}")
        
        else:
            # Configuración por defecto con fallbacks
            config.update({
                'MONGO_URL': os.getenv('MONGO_URL', 'mongodb://localhost:27017'),
                'DB_NAME': os.getenv('DB_NAME', 'social_media_app'),
                'FRONTEND_URL': os.getenv('FRONTEND_URL', 'http://localhost:3000'),
                'CORS_ORIGINS': os.getenv('CORS_ORIGINS', 'http://localhost:3000'),
                'SECRET_KEY': os.getenv('SECRET_KEY', 'fallback-secret-key-for-development-only')
            })
        
        return config
    
    def _fetch_dynamic_config(self, subdomain: str) -> Optional[Dict[str, str]]:
        """Obtiene configuración dinámica desde el servicio central de Emergent (no bloqueante)"""
        try:
            import socket
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(2)
            result = sock.connect_ex(('config.emergent.sh', 443))
            sock.close()
            if result != 0:
                logger.debug("config.emergent.sh no responde - saltando fetch dinámico")
                return None
        except Exception:
            return None
        try:
            import httpx
            try:
                with httpx.Client(timeout=3.0) as hc:
                    response = hc.get(
                        f'https://config.emergent.sh/backend-config?subdomain={subdomain}'
                    )
                    if response.status_code == 200:
                        return response.json()
            except ImportError:
                response = requests.get(
                    f'https://config.emergent.sh/backend-config?subdomain={subdomain}',
                    timeout=3
                )
                if response.status_code == 200:
                    return response.json()
        except Exception as e:
            logger.debug(f"Error obteniendo configuración dinámica: {e}")
        return None
    
    def _generate_secret_key(self, account: str) -> str:
        """Genera una clave secreta única para la cuenta"""
        import hashlib
        base_key = f"emergent-{account}-secret-key"
        return hashlib.sha256(base_key.encode()).hexdigest()
    
    def get_config_value(self, key: str, fallback: Any = None) -> Any:
        """Obtiene un valor de configuración con fallback"""
        # Prioridad: Variable de entorno -> Configuración detectada -> Fallback
        env_value = os.getenv(key)
        if env_value is not None:
            return env_value
        
        return self.config.get(key, fallback)
    
    def print_environment_info(self):
        """Imprime información del entorno detectado"""
        print(f"🌍 Entorno detectado: {self.environment['type'].upper()}")
        print(f"🏠 Hostname: {self.hostname}")
        print(f"🔧 Configuración:")
        for key, value in self.config.items():
            # No mostrar claves secretas completas en logs
            if 'SECRET' in key or 'PASSWORD' in key:
                value = value[:10] + "..." if len(str(value)) > 10 else value
            print(f"   {key}: {value}")


# Instancia global del detector
_detector = None

def get_environment_detector() -> EnvironmentDetector:
    """Obtiene la instancia global del detector de entorno"""
    global _detector
    if _detector is None:
        _detector = EnvironmentDetector()
        _detector.print_environment_info()
    return _detector

def get_config_value(key: str, fallback: Any = None) -> Any:
    """Helper para obtener valores de configuración"""
    detector = get_environment_detector()
    return detector.get_config_value(key, fallback)