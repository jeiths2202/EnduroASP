"""
Cache Manager for DBIO - Redis-based caching layer
"""

import json
import logging
import redis
from typing import Any, Optional
from datetime import datetime

from .exceptions import CacheError

logger = logging.getLogger(__name__)


class CacheManager:
    """Redis-based caching layer for catalog operations."""
    
    def __init__(self, config: dict):
        """
        Initialize cache manager.
        
        Args:
            config: Cache configuration
        """
        self.config = config
        self.redis_client = None
        self.default_ttl = config.get('ttl', 300)  # 5 minutes default
        self.enabled = config.get('enabled', True)
        
        if self.enabled:
            self._init_redis()
    
    def _init_redis(self):
        """Initialize Redis connection."""
        try:
            redis_config = self.config.get('redis', {})
            
            self.redis_client = redis.Redis(
                host=redis_config.get('host', 'localhost'),
                port=redis_config.get('port', 6379),
                db=redis_config.get('db', 0),
                password=redis_config.get('password'),
                socket_timeout=redis_config.get('timeout', 5),
                decode_responses=True,
                health_check_interval=30
            )
            
            # Test connection
            self.redis_client.ping()
            logger.info("Redis cache initialized successfully")
            
        except Exception as e:
            logger.warning(f"Redis cache initialization failed: {e}")
            self.enabled = False
            self.redis_client = None
    
    def _serialize_value(self, value: Any) -> str:
        """Serialize value for Redis storage."""
        return json.dumps(value, ensure_ascii=False, separators=(',', ':'))
    
    def _deserialize_value(self, value: str) -> Any:
        """Deserialize value from Redis."""
        try:
            return json.loads(value)
        except (json.JSONDecodeError, TypeError):
            return value
    
    def get(self, key: str) -> Optional[Any]:
        """
        Get value from cache.
        
        Args:
            key: Cache key
            
        Returns:
            Cached value or None if not found/cache disabled
        """
        if not self.enabled or not self.redis_client:
            return None
        
        try:
            value = self.redis_client.get(key)
            if value is not None:
                return self._deserialize_value(value)
            return None
            
        except Exception as e:
            logger.warning(f"Cache get error for key {key}: {e}")
            return None
    
    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> bool:
        """
        Set value in cache.
        
        Args:
            key: Cache key
            value: Value to cache
            ttl: Time to live in seconds (uses default if None)
            
        Returns:
            True if successful
        """
        if not self.enabled or not self.redis_client:
            return False
        
        try:
            serialized_value = self._serialize_value(value)
            ttl = ttl or self.default_ttl
            
            result = self.redis_client.setex(key, ttl, serialized_value)
            return bool(result)
            
        except Exception as e:
            logger.warning(f"Cache set error for key {key}: {e}")
            return False
    
    def delete(self, key: str) -> bool:
        """
        Delete key from cache.
        
        Args:
            key: Cache key to delete
            
        Returns:
            True if successful
        """
        if not self.enabled or not self.redis_client:
            return False
        
        try:
            result = self.redis_client.delete(key)
            return result > 0
            
        except Exception as e:
            logger.warning(f"Cache delete error for key {key}: {e}")
            return False
    
    def invalidate(self, pattern: str) -> int:
        """
        Invalidate cache entries matching pattern.
        
        Args:
            pattern: Pattern to match (supports * wildcards)
            
        Returns:
            Number of keys deleted
        """
        if not self.enabled or not self.redis_client:
            return 0
        
        try:
            keys = self.redis_client.keys(pattern)
            if keys:
                deleted = self.redis_client.delete(*keys)
                logger.debug(f"Invalidated {deleted} cache entries matching {pattern}")
                return deleted
            return 0
            
        except Exception as e:
            logger.warning(f"Cache invalidation error for pattern {pattern}: {e}")
            return 0
    
    def clear(self) -> bool:
        """
        Clear all cache entries.
        
        Returns:
            True if successful
        """
        if not self.enabled or not self.redis_client:
            return False
        
        try:
            result = self.redis_client.flushdb()
            logger.info("Cache cleared")
            return bool(result)
            
        except Exception as e:
            logger.warning(f"Cache clear error: {e}")
            return False
    
    def get_statistics(self) -> dict:
        """
        Get cache statistics.
        
        Returns:
            Dictionary with cache statistics
        """
        if not self.enabled or not self.redis_client:
            return {
                'enabled': False,
                'status': 'disabled'
            }
        
        try:
            info = self.redis_client.info()
            
            return {
                'enabled': True,
                'status': 'connected',
                'used_memory': info.get('used_memory', 0),
                'used_memory_human': info.get('used_memory_human', '0B'),
                'connected_clients': info.get('connected_clients', 0),
                'total_commands_processed': info.get('total_commands_processed', 0),
                'keyspace_hits': info.get('keyspace_hits', 0),
                'keyspace_misses': info.get('keyspace_misses', 0),
                'hit_rate': self._calculate_hit_rate(info),
                'timestamp': datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.warning(f"Error getting cache statistics: {e}")
            return {
                'enabled': True,
                'status': 'error',
                'error': str(e),
                'timestamp': datetime.utcnow().isoformat()
            }
    
    def _calculate_hit_rate(self, info: dict) -> float:
        """Calculate cache hit rate."""
        hits = info.get('keyspace_hits', 0)
        misses = info.get('keyspace_misses', 0)
        total = hits + misses
        
        if total == 0:
            return 0.0
        
        return round((hits / total) * 100, 2)
    
    def close(self):
        """Close Redis connection."""
        if self.redis_client:
            try:
                self.redis_client.close()
                logger.info("Redis cache connection closed")
            except Exception as e:
                logger.warning(f"Error closing Redis connection: {e}")


class NullCache(CacheManager):
    """Null cache implementation when Redis is not available."""
    
    def __init__(self):
        self.enabled = False
    
    def get(self, key: str) -> None:
        return None
    
    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> bool:
        return False
    
    def delete(self, key: str) -> bool:
        return False
    
    def invalidate(self, pattern: str) -> int:
        return 0
    
    def clear(self) -> bool:
        return False
    
    def get_statistics(self) -> dict:
        return {'enabled': False, 'status': 'disabled'}
    
    def close(self):
        pass