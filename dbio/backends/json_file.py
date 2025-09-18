"""
JSON File Backend for DBIO - Backward compatibility implementation
"""

import json
import logging
import os
import threading
from typing import Dict, Any, Optional, List
from datetime import datetime
import copy
import fcntl

from .base import BaseBackend
from ..exceptions import ValidationError, DBIOException

logger = logging.getLogger(__name__)


class JSONFileBackend(BaseBackend):
    """JSON file implementation - maintains compatibility with existing catalog.json."""
    
    def __init__(self, config: Dict[str, Any]):
        """
        Initialize JSON file backend.
        
        Args:
            config: Configuration containing file_path
        """
        super().__init__(config)
        self.file_path = config.get('file_path', '/home/aspuser/app/config/catalog.json')
        self.backup_path = config.get('backup_path', self.file_path + '.backup')
        self.lock = threading.RLock()
        
        # Ensure directory exists
        os.makedirs(os.path.dirname(self.file_path), exist_ok=True)
        
        # Initialize empty catalog if file doesn't exist
        if not os.path.exists(self.file_path):
            self._save_catalog({})
    
    def _load_catalog(self) -> Dict[str, Any]:
        """Load catalog from JSON file with file locking."""
        with self.lock:
            try:
                with open(self.file_path, 'r', encoding='utf-8') as f:
                    # Use file locking to prevent corruption
                    fcntl.flock(f.fileno(), fcntl.LOCK_SH)
                    try:
                        data = json.load(f)
                        return data if isinstance(data, dict) else {}
                    finally:
                        fcntl.flock(f.fileno(), fcntl.LOCK_UN)
                        
            except (FileNotFoundError, json.JSONDecodeError) as e:
                logger.warning(f"Error loading catalog, returning empty: {e}")
                return {}
    
    def _save_catalog(self, catalog: Dict[str, Any]) -> bool:
        """Save catalog to JSON file with atomic write and backup."""
        with self.lock:
            try:
                # Create backup first
                if os.path.exists(self.file_path):
                    os.rename(self.file_path, self.backup_path)
                
                # Atomic write using temporary file
                temp_path = self.file_path + '.tmp'
                with open(temp_path, 'w', encoding='utf-8') as f:
                    fcntl.flock(f.fileno(), fcntl.LOCK_EX)
                    try:
                        json.dump(catalog, f, indent=2, ensure_ascii=False)
                        f.flush()
                        os.fsync(f.fileno())
                    finally:
                        fcntl.flock(f.fileno(), fcntl.LOCK_UN)
                
                # Atomic move
                os.rename(temp_path, self.file_path)
                
                # Remove old backup after successful write
                if os.path.exists(self.backup_path):
                    os.remove(self.backup_path)
                
                return True
                
            except Exception as e:
                logger.error(f"Error saving catalog: {e}")
                # Restore from backup if possible
                if os.path.exists(self.backup_path):
                    os.rename(self.backup_path, self.file_path)
                raise DBIOException(f"Failed to save catalog: {str(e)}")
    
    def get_all_objects(self) -> Dict[str, Any]:
        """Get all objects in catalog.json format."""
        return self._load_catalog()
    
    def get_object(self, volume: str, library: str, object_name: str) -> Optional[Dict[str, Any]]:
        """Get a specific object."""
        catalog = self._load_catalog()
        
        if volume in catalog and library in catalog[volume] and object_name in catalog[volume][library]:
            return copy.deepcopy(catalog[volume][library][object_name])
        
        return None
    
    def update_object(self, volume: str, library: str, object_name: str, 
                     attributes: Dict[str, Any]) -> bool:
        """Update or create an object."""
        catalog = self._load_catalog()
        
        # Ensure volume exists
        if volume not in catalog:
            catalog[volume] = {}
        
        # Ensure library exists
        if library not in catalog[volume]:
            catalog[volume][library] = {}
        
        # Get existing object or create new
        if object_name not in catalog[volume][library]:
            catalog[volume][library][object_name] = {}
        
        # Update attributes
        existing = catalog[volume][library][object_name]
        
        # Preserve CREATED timestamp if it exists
        if 'CREATED' in existing and 'CREATED' not in attributes:
            attributes['CREATED'] = existing['CREATED']
        
        # Update object
        catalog[volume][library][object_name].update(attributes)
        
        # Save catalog
        return self._save_catalog(catalog)
    
    def delete_object(self, volume: str, library: str, object_name: str) -> bool:
        """Delete an object."""
        catalog = self._load_catalog()
        
        if (volume in catalog and 
            library in catalog[volume] and 
            object_name in catalog[volume][library]):
            
            del catalog[volume][library][object_name]
            
            # Clean up empty structures
            if not catalog[volume][library]:
                del catalog[volume][library]
                if not catalog[volume]:
                    del catalog[volume]
            
            return self._save_catalog(catalog)
        
        return False
    
    def query_objects(self, filters: Optional[Dict[str, Any]] = None,
                     sort: Optional[List[tuple]] = None,
                     limit: Optional[int] = None) -> List[Dict[str, Any]]:
        """Query objects with filters and sorting."""
        catalog = self._load_catalog()
        results = []
        
        # Flatten catalog structure for querying
        for volume_name, volume_data in catalog.items():
            for library_name, library_data in volume_data.items():
                for object_name, object_data in library_data.items():
                    result = {
                        'volume_name': volume_name,
                        'library_name': library_name,
                        'object_name': object_name,
                        'attributes': copy.deepcopy(object_data)
                    }
                    results.append(result)
        
        # Apply filters
        if filters:
            filtered_results = []
            for result in results:
                match = True
                for key, value in filters.items():
                    if key == 'object_type':
                        if result['attributes'].get('TYPE') != value:
                            match = False
                            break
                    elif key == 'volume':
                        if result['volume_name'] != value:
                            match = False
                            break
                    elif key == 'library':
                        if result['library_name'] != value:
                            match = False
                            break
                    else:
                        if str(result['attributes'].get(key, '')) != str(value):
                            match = False
                            break
                
                if match:
                    filtered_results.append(result)
            
            results = filtered_results
        
        # Apply sorting
        if sort:
            for field, direction in reversed(sort):  # Apply in reverse order
                reverse = direction.upper() == 'DESC'
                
                if field in ['volume_name', 'library_name', 'object_name']:
                    results.sort(key=lambda x: x[field], reverse=reverse)
                else:
                    results.sort(key=lambda x: x['attributes'].get(field, ''), reverse=reverse)
        
        # Apply limit
        if limit and limit > 0:
            results = results[:limit]
        
        return results
    
    def search_objects(self, query: str, object_type: Optional[str] = None) -> List[Dict[str, Any]]:
        """Full-text search across objects (simple implementation)."""
        query_lower = query.lower()
        filters = {}
        
        if object_type:
            filters['object_type'] = object_type
        
        all_objects = self.query_objects(filters)
        results = []
        
        for obj in all_objects:
            # Search in object name and description
            searchable_text = (
                obj['object_name'].lower() + ' ' +
                obj['attributes'].get('DESCRIPTION', '').lower()
            )
            
            if query_lower in searchable_text:
                # Simple ranking based on position of match
                rank = 1.0
                if query_lower in obj['object_name'].lower():
                    rank += 0.5
                if query_lower in obj['attributes'].get('DESCRIPTION', '').lower():
                    rank += 0.3
                
                obj['rank'] = rank
                results.append(obj)
        
        # Sort by rank (descending)
        results.sort(key=lambda x: x.get('rank', 0), reverse=True)
        
        return results
    
    def bulk_operations(self, operations: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Perform bulk operations."""
        stats = {'created': 0, 'updated': 0, 'deleted': 0, 'errors': 0}
        catalog = self._load_catalog()
        
        for operation in operations:
            try:
                op_type = operation.get('type')
                volume = operation.get('volume')
                library = operation.get('library')
                object_name = operation.get('object_name')
                
                if op_type == 'update':
                    # Check if object exists
                    exists = (volume in catalog and 
                             library in catalog[volume] and 
                             object_name in catalog[volume][library])
                    
                    # Ensure structure exists
                    if volume not in catalog:
                        catalog[volume] = {}
                    if library not in catalog[volume]:
                        catalog[volume][library] = {}
                    if object_name not in catalog[volume][library]:
                        catalog[volume][library][object_name] = {}
                    
                    # Update attributes
                    attributes = operation.get('attributes', {})
                    existing = catalog[volume][library][object_name]
                    
                    # Preserve CREATED timestamp
                    if 'CREATED' in existing and 'CREATED' not in attributes:
                        attributes['CREATED'] = existing['CREATED']
                    
                    catalog[volume][library][object_name].update(attributes)
                    
                    if exists:
                        stats['updated'] += 1
                    else:
                        stats['created'] += 1
                
                elif op_type == 'delete':
                    if (volume in catalog and 
                        library in catalog[volume] and 
                        object_name in catalog[volume][library]):
                        
                        del catalog[volume][library][object_name]
                        
                        # Clean up empty structures
                        if not catalog[volume][library]:
                            del catalog[volume][library]
                            if not catalog[volume]:
                                del catalog[volume]
                        
                        stats['deleted'] += 1
                
            except Exception as e:
                logger.error(f"Error in bulk operation: {e}")
                stats['errors'] += 1
        
        # Save once after all operations
        if self._save_catalog(catalog):
            return stats
        else:
            raise DBIOException("Failed to save catalog after bulk operations")
    
    def get_statistics(self) -> Dict[str, Any]:
        """Get backend statistics."""
        catalog = self._load_catalog()
        
        # Count objects by type
        object_counts = {}
        total_objects = 0
        recent_updates = 0
        cutoff_time = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        
        for volume_data in catalog.values():
            for library_data in volume_data.values():
                for object_data in library_data.values():
                    total_objects += 1
                    
                    obj_type = object_data.get('TYPE', 'UNKNOWN')
                    object_counts[obj_type] = object_counts.get(obj_type, 0) + 1
                    
                    # Check for recent updates
                    updated_str = object_data.get('UPDATED', '')
                    if updated_str:
                        try:
                            updated = datetime.fromisoformat(updated_str.replace('Z', '+00:00'))
                            if updated >= cutoff_time:
                                recent_updates += 1
                        except:
                            pass
        
        return {
            'backend': 'json_file',
            'total_objects': total_objects,
            'volumes': len(catalog),
            'libraries': sum(len(vol_data) for vol_data in catalog.values()),
            'objects_by_type': object_counts,
            'recent_updates_24h': recent_updates,
            'file_size_bytes': os.path.getsize(self.file_path) if os.path.exists(self.file_path) else 0,
            'timestamp': datetime.utcnow().isoformat()
        }
    
    def import_catalog(self, catalog_data: Dict[str, Any], merge: bool = False) -> Dict[str, Any]:
        """Import catalog data from dictionary."""
        if merge:
            existing_catalog = self._load_catalog()
            # Deep merge logic
            for volume, volume_data in catalog_data.items():
                if volume not in existing_catalog:
                    existing_catalog[volume] = {}
                for library, library_data in volume_data.items():
                    if library not in existing_catalog[volume]:
                        existing_catalog[volume][library] = {}
                    existing_catalog[volume][library].update(library_data)
            catalog_to_save = existing_catalog
        else:
            catalog_to_save = catalog_data
        
        # Count statistics
        stats = {'volumes': 0, 'libraries': 0, 'objects': 0, 'errors': 0}
        
        for volume_name, volume_data in catalog_to_save.items():
            stats['volumes'] += 1
            for library_name, library_data in volume_data.items():
                stats['libraries'] += 1
                stats['objects'] += len(library_data)
        
        # Save catalog
        if self._save_catalog(catalog_to_save):
            return stats
        else:
            stats['errors'] = 1
            return stats
    
    def health_check(self) -> Dict[str, Any]:
        """Check JSON file backend health."""
        try:
            # Test read
            catalog = self._load_catalog()
            
            # Test write (create temporary backup)
            backup_test = self.file_path + '.health_test'
            with open(backup_test, 'w', encoding='utf-8') as f:
                json.dump({'test': True}, f)
            os.remove(backup_test)
            
            return {
                'status': 'healthy',
                'backend': 'json_file',
                'file_exists': os.path.exists(self.file_path),
                'file_readable': True,
                'file_writable': True,
                'object_count': sum(
                    sum(len(lib_data) for lib_data in vol_data.values())
                    for vol_data in catalog.values()
                ),
                'timestamp': datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            return {
                'status': 'unhealthy',
                'backend': 'json_file',
                'error': str(e),
                'file_exists': os.path.exists(self.file_path),
                'timestamp': datetime.utcnow().isoformat()
            }