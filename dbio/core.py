"""
Core DBIO Manager - Main interface for catalog operations
"""

import logging
from typing import Dict, Any, Optional, List
from datetime import datetime
import json
from pathlib import Path

from .backends.base import BaseBackend
from .backends import PostgreSQLBackend, MySQLBackend, SQLiteBackend, JSONFileBackend
from .cache import CacheManager
from .exceptions import BackendNotFoundError, DBIOException

logger = logging.getLogger(__name__)


class DBIOManager:
    """
    Main database I/O manager with pluggable backends.
    Provides a consistent interface for catalog operations regardless of backend.
    """
    
    BACKEND_CLASSES = {
        'postgresql': PostgreSQLBackend,
        'mysql': MySQLBackend,
        'sqlite': SQLiteBackend,
        'json_file': JSONFileBackend
    }
    
    def __init__(self, config: Dict[str, Any]):
        """
        Initialize DBIO Manager with configuration.
        
        Args:
            config: Configuration dictionary containing backend settings
        """
        self.config = config
        self.backend = self._create_backend(config)
        self.cache = None
        
        # Initialize cache if enabled
        if config.get('cache', {}).get('enabled', False):
            self.cache = CacheManager(config.get('cache', {}))
            
        logger.info(f"DBIO Manager initialized with backend: {config.get('backend', 'json_file')}")
    
    def _create_backend(self, config: Dict[str, Any]) -> BaseBackend:
        """Create and configure the appropriate backend."""
        backend_type = config.get('backend', 'json_file')
        
        if backend_type not in self.BACKEND_CLASSES:
            raise BackendNotFoundError(f"Unknown backend type: {backend_type}")
        
        backend_class = self.BACKEND_CLASSES[backend_type]
        backend_config = config.get(backend_type, {})
        
        return backend_class(backend_config)
    
    def get_catalog_info(self) -> Dict[str, Any]:
        """
        Get complete catalog information.
        Maintains compatibility with existing catalog.json structure.
        
        Returns:
            Dictionary with complete catalog structure
        """
        cache_key = "catalog:all"
        
        # Try cache first
        if self.cache:
            cached_data = self.cache.get(cache_key)
            if cached_data:
                logger.debug("Returning cached catalog data")
                return cached_data
        
        # Get from backend
        try:
            catalog_data = self.backend.get_all_objects()
            
            # Cache the result
            if self.cache:
                self.cache.set(cache_key, catalog_data)
            
            return catalog_data
            
        except Exception as e:
            logger.error(f"Error getting catalog info: {e}")
            raise DBIOException(f"Failed to get catalog info: {str(e)}")
    
    def update_catalog_info(self, volume: str, library: str, object_name: str, 
                          object_type: str = "DATASET", **kwargs) -> bool:
        """
        Update catalog information for an object.
        Maintains compatibility with existing function signature.
        
        Args:
            volume: Volume name
            library: Library name
            object_name: Object name
            object_type: Type of object (DATASET, PGM, MAP, etc.)
            **kwargs: Additional attributes
            
        Returns:
            True if successful
        """
        try:
            # Prepare attributes
            attributes = {
                'TYPE': object_type,
                'UPDATED': datetime.utcnow().isoformat() + 'Z',
                **kwargs
            }
            
            # Add CREATED timestamp if not exists
            existing = self.backend.get_object(volume, library, object_name)
            if not existing:
                attributes['CREATED'] = attributes['UPDATED']
            
            # Update in backend
            success = self.backend.update_object(volume, library, object_name, attributes)
            
            # Invalidate cache
            if self.cache and success:
                self.cache.invalidate(f"catalog:*")
                self.cache.invalidate(f"object:{volume}:{library}:{object_name}")
            
            return success
            
        except Exception as e:
            logger.error(f"Error updating catalog info: {e}")
            raise DBIOException(f"Failed to update catalog info: {str(e)}")
    
    def delete_catalog_entry(self, volume: str, library: str, object_name: str) -> bool:
        """
        Delete a catalog entry.
        
        Args:
            volume: Volume name
            library: Library name
            object_name: Object name
            
        Returns:
            True if successful
        """
        try:
            success = self.backend.delete_object(volume, library, object_name)
            
            # Invalidate cache
            if self.cache and success:
                self.cache.invalidate(f"catalog:*")
                self.cache.invalidate(f"object:{volume}:{library}:{object_name}")
            
            return success
            
        except Exception as e:
            logger.error(f"Error deleting catalog entry: {e}")
            raise DBIOException(f"Failed to delete catalog entry: {str(e)}")
    
    def query_objects(self, filters: Optional[Dict[str, Any]] = None, 
                     sort: Optional[List[tuple]] = None,
                     limit: Optional[int] = None) -> List[Dict[str, Any]]:
        """
        Query objects with filters and sorting.
        
        Args:
            filters: Dictionary of filters to apply
            sort: List of (field, direction) tuples
            limit: Maximum number of results
            
        Returns:
            List of matching objects
        """
        cache_key = f"query:{json.dumps(filters or {})}:{json.dumps(sort or [])}:{limit}"
        
        # Try cache first
        if self.cache:
            cached_data = self.cache.get(cache_key)
            if cached_data:
                return cached_data
        
        # Query backend
        try:
            results = self.backend.query_objects(filters, sort, limit)
            
            # Cache results
            if self.cache:
                self.cache.set(cache_key, results, ttl=60)  # Short TTL for queries
            
            return results
            
        except Exception as e:
            logger.error(f"Error querying objects: {e}")
            raise DBIOException(f"Failed to query objects: {str(e)}")
    
    def search_objects(self, query: str, object_type: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Full-text search across objects.
        
        Args:
            query: Search query
            object_type: Optional filter by object type
            
        Returns:
            List of matching objects
        """
        try:
            return self.backend.search_objects(query, object_type)
        except Exception as e:
            logger.error(f"Error searching objects: {e}")
            raise DBIOException(f"Failed to search objects: {str(e)}")
    
    def bulk_operations(self, operations: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Perform bulk operations for efficiency.
        
        Args:
            operations: List of operations to perform
            
        Returns:
            Summary of results
        """
        try:
            results = self.backend.bulk_operations(operations)
            
            # Invalidate all cache on bulk operations
            if self.cache:
                self.cache.invalidate("*")
            
            return results
            
        except Exception as e:
            logger.error(f"Error in bulk operations: {e}")
            raise DBIOException(f"Failed to perform bulk operations: {str(e)}")
    
    def get_statistics(self) -> Dict[str, Any]:
        """Get catalog statistics."""
        cache_key = "stats:catalog"
        
        # Try cache first
        if self.cache:
            cached_data = self.cache.get(cache_key)
            if cached_data:
                return cached_data
        
        try:
            stats = self.backend.get_statistics()
            
            # Cache stats for longer
            if self.cache:
                self.cache.set(cache_key, stats, ttl=300)
            
            return stats
            
        except Exception as e:
            logger.error(f"Error getting statistics: {e}")
            raise DBIOException(f"Failed to get statistics: {str(e)}")
    
    def export_to_json(self, filepath: str) -> bool:
        """
        Export complete catalog to JSON file.
        Useful for backups and migrations.
        
        Args:
            filepath: Path to output file
            
        Returns:
            True if successful
        """
        try:
            catalog_data = self.get_catalog_info()
            
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(catalog_data, f, indent=2, ensure_ascii=False)
            
            logger.info(f"Catalog exported to {filepath}")
            return True
            
        except Exception as e:
            logger.error(f"Error exporting catalog: {e}")
            raise DBIOException(f"Failed to export catalog: {str(e)}")
    
    def import_from_json(self, filepath: str, merge: bool = False) -> Dict[str, Any]:
        """
        Import catalog from JSON file.
        
        Args:
            filepath: Path to input file
            merge: If True, merge with existing data; if False, replace
            
        Returns:
            Import statistics
        """
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                catalog_data = json.load(f)
            
            stats = self.backend.import_catalog(catalog_data, merge)
            
            # Clear all cache after import
            if self.cache:
                self.cache.clear()
            
            logger.info(f"Catalog imported from {filepath}: {stats}")
            return stats
            
        except Exception as e:
            logger.error(f"Error importing catalog: {e}")
            raise DBIOException(f"Failed to import catalog: {str(e)}")
    
    def get_object_info(self, volume: str, library: str, object_name: str) -> Dict[str, Any]:
        """
        Get catalog information for a specific object.
        Provides compatibility with existing get_object_info function signature.
        
        Args:
            volume: Volume name
            library: Library name
            object_name: Object name
            
        Returns:
            Object attributes dictionary or empty dict if not found
        """
        try:
            return self.backend.get_object(volume, library, object_name) or {}
        except Exception as e:
            logger.error(f"Error getting object info: {e}")
            return {}
    
    def get_file_info(self, volume: str, filename: str) -> Dict[str, Any]:
        """
        Legacy function: Get catalog information for a specific file.
        Provides backward compatibility with existing get_file_info function signature.
        
        Args:
            volume: Volume name
            filename: Filename (may include library as LIB/FILE format)
            
        Returns:
            Object attributes dictionary or default dataset attributes
        """
        try:
            # Parse library/filename if in format LIB/FILE
            if '/' in filename:
                library, object_name = filename.split('/', 1)
                return self.get_object_info(volume, library, object_name)
            else:
                # Search through all libraries for the file
                catalog = self.get_catalog_info()
                volume_data = catalog.get(volume, {})
                for library, objects in volume_data.items():
                    if filename in objects:
                        return objects[filename]
                
                # Return default for dataset if not found
                return {
                    "TYPE": "DATASET",
                    "RECTYPE": "FB",
                    "RECLEN": 80,
                    "ENCODING": "utf-8"
                }
        except Exception as e:
            logger.error(f"Error getting file info: {e}")
            return {
                "TYPE": "DATASET",
                "RECTYPE": "FB", 
                "RECLEN": 80,
                "ENCODING": "utf-8"
            }

    def health_check(self) -> Dict[str, Any]:
        """Check DBIO manager and backend health."""
        try:
            return self.backend.health_check()
        except Exception as e:
            logger.error(f"Error in health check: {e}")
            raise DBIOException(f"Health check failed: {str(e)}")
    
    def import_catalog(self, catalog_data: Dict[str, Any], merge: bool = False) -> Dict[str, Any]:
        """
        Import catalog data from dictionary.
        
        Args:
            catalog_data: Complete catalog structure
            merge: If True, merge with existing; if False, replace
            
        Returns:
            Import statistics
        """
        try:
            stats = self.backend.import_catalog(catalog_data, merge)
            
            # Clear all cache after import
            if self.cache:
                self.cache.clear()
            
            return stats
        except Exception as e:
            logger.error(f"Error importing catalog: {e}")
            raise DBIOException(f"Failed to import catalog: {str(e)}")
    
    def close(self):
        """Close connections and cleanup resources."""
        if self.backend:
            self.backend.close()
        if self.cache:
            self.cache.close()


# Backward compatibility functions
def get_catalog_info(config: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Backward compatible get_catalog_info function.
    
    Args:
        config: Optional DBIO configuration. If not provided, uses default PostgreSQL config.
        
    Returns:
        Complete catalog structure as dictionary
    """
    if config is None:
        config = {
            'backend': 'postgresql',
            'postgresql': {
                'host': 'localhost',
                'port': 5432,
                'database': 'ofasp',
                'user': 'aspuser',
                'password': 'aspuser123'
            }
        }
    
    try:
        manager = DBIOManager(config)
        catalog = manager.get_catalog_info()
        manager.close()
        return catalog
    except Exception as e:
        logger.error(f"Error in get_catalog_info: {e}")
        return {}


def update_catalog_info(volume: str, library: str, object_name: str, 
                       object_type: str = "DATASET", 
                       config: Optional[Dict[str, Any]] = None,
                       **kwargs) -> bool:
    """
    Backward compatible update_catalog_info function.
    
    Args:
        volume: Volume name
        library: Library name
        object_name: Object name
        object_type: Type of object (DATASET, PGM, MAP, etc.)
        config: Optional DBIO configuration
        **kwargs: Additional object attributes
        
    Returns:
        True if successful
    """
    if config is None:
        config = {
            'backend': 'postgresql',
            'postgresql': {
                'host': 'localhost',
                'port': 5432,
                'database': 'ofasp',
                'user': 'aspuser',
                'password': 'aspuser123'
            }
        }
    
    try:
        manager = DBIOManager(config)
        success = manager.update_catalog_info(volume, library, object_name, object_type, **kwargs)
        manager.close()
        return success
    except Exception as e:
        logger.error(f"Error in update_catalog_info: {e}")
        return False


def get_object_info(volume: str, library: str, object_name: str,
                   config: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Backward compatible get_object_info function.
    
    Args:
        volume: Volume name
        library: Library name
        object_name: Object name
        config: Optional DBIO configuration
        
    Returns:
        Object attributes dictionary or empty dict if not found
    """
    if config is None:
        config = {
            'backend': 'postgresql',
            'postgresql': {
                'host': 'localhost',
                'port': 5432,
                'database': 'ofasp',
                'user': 'aspuser',
                'password': 'aspuser123'
            }
        }
    
    try:
        manager = DBIOManager(config)
        obj_info = manager.get_object_info(volume, library, object_name)
        manager.close()
        return obj_info
    except Exception as e:
        logger.error(f"Error in get_object_info: {e}")
        return {}


def get_file_info(volume: str, filename: str,
                 config: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Backward compatible get_file_info function.
    
    Args:
        volume: Volume name
        filename: Filename (may include library as LIB/FILE format)
        config: Optional DBIO configuration
        
    Returns:
        Object attributes dictionary or default dataset attributes
    """
    if config is None:
        config = {
            'backend': 'postgresql',
            'postgresql': {
                'host': 'localhost',
                'port': 5432,
                'database': 'ofasp',
                'user': 'aspuser',
                'password': 'aspuser123'
            }
        }
    
    try:
        manager = DBIOManager(config)
        file_info = manager.get_file_info(volume, filename)
        manager.close()
        return file_info
    except Exception as e:
        logger.error(f"Error in get_file_info: {e}")
        return {
            "TYPE": "DATASET",
            "RECTYPE": "FB",
            "RECLEN": 80,
            "ENCODING": "utf-8"
        }