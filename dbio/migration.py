"""
Migration Manager for DBIO - Handles data migration between backends
"""

import json
import logging
import os
import shutil
from datetime import datetime
from typing import Dict, Any, Optional, List
from pathlib import Path

from .core import DBIOManager
from .backends import JSONFileBackend, PostgreSQLBackend
from .exceptions import MigrationError

logger = logging.getLogger(__name__)


class MigrationManager:
    """Manages migration of catalog data between different backends."""
    
    def __init__(self, source_config: Dict[str, Any], target_config: Dict[str, Any]):
        """
        Initialize migration manager.
        
        Args:
            source_config: Source backend configuration
            target_config: Target backend configuration
        """
        self.source_config = source_config
        self.target_config = target_config
        self.migration_log = []
    
    def migrate_catalog(self, backup_before: bool = True, 
                       validate_after: bool = True,
                       dry_run: bool = False) -> Dict[str, Any]:
        """
        Migrate catalog from source to target backend.
        
        Args:
            backup_before: Create backup before migration
            validate_after: Validate data after migration
            dry_run: Only simulate migration without actual changes
            
        Returns:
            Migration statistics and results
        """
        migration_id = f"migration_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"
        stats = {
            'migration_id': migration_id,
            'started_at': datetime.utcnow().isoformat(),
            'dry_run': dry_run,
            'backup_created': False,
            'source_objects': 0,
            'target_objects': 0,
            'errors': [],
            'warnings': []
        }
        
        try:
            # Initialize backends
            source_manager = DBIOManager(self.source_config)
            
            if not dry_run:
                target_manager = DBIOManager(self.target_config)
            
            # Create backup if requested
            if backup_before and not dry_run:
                backup_path = self._create_backup(source_manager, migration_id)
                stats['backup_path'] = backup_path
                stats['backup_created'] = True
            
            # Get source data
            logger.info("Reading source catalog data...")
            source_catalog = source_manager.get_catalog_info()
            stats['source_objects'] = self._count_objects(source_catalog)
            
            if dry_run:
                logger.info(f"DRY RUN: Would migrate {stats['source_objects']} objects")
                stats['completed_at'] = datetime.utcnow().isoformat()
                return stats
            
            # Import to target
            logger.info("Importing to target backend...")
            import_stats = target_manager.import_catalog(source_catalog, merge=False)
            stats.update(import_stats)
            
            # Validate if requested
            if validate_after:
                validation_result = self._validate_migration(source_manager, target_manager)
                stats['validation'] = validation_result
                
                if not validation_result['success']:
                    stats['errors'].append("Migration validation failed")
            
            stats['completed_at'] = datetime.utcnow().isoformat()
            stats['success'] = len(stats['errors']) == 0
            
            logger.info(f"Migration {migration_id} completed successfully")
            return stats
            
        except Exception as e:
            error_msg = f"Migration failed: {str(e)}"
            logger.error(error_msg)
            stats['errors'].append(error_msg)
            stats['success'] = False
            stats['completed_at'] = datetime.utcnow().isoformat()
            raise MigrationError(error_msg)
    
    def _create_backup(self, source_manager: DBIOManager, migration_id: str) -> str:
        """Create backup of source data."""
        backup_dir = Path(self.target_config.get('backup_location', '/tmp/catalog_backups'))
        backup_dir.mkdir(parents=True, exist_ok=True)
        
        backup_file = backup_dir / f"catalog_backup_{migration_id}.json"
        
        # Export source data
        source_manager.export_to_json(str(backup_file))
        
        # Also backup the original JSON file if it exists
        if self.source_config.get('backend') == 'json_file':
            json_path = self.source_config.get('json_file', {}).get('file_path')
            if json_path and os.path.exists(json_path):
                json_backup = backup_dir / f"catalog_original_{migration_id}.json"
                shutil.copy2(json_path, json_backup)
        
        logger.info(f"Backup created: {backup_file}")
        return str(backup_file)
    
    def _count_objects(self, catalog: Dict[str, Any]) -> int:
        """Count total objects in catalog."""
        count = 0
        for volume_data in catalog.values():
            for library_data in volume_data.values():
                count += len(library_data)
        return count
    
    def _validate_migration(self, source_manager: DBIOManager, 
                          target_manager: DBIOManager) -> Dict[str, Any]:
        """Validate that migration was successful."""
        try:
            source_catalog = source_manager.get_catalog_info()
            target_catalog = target_manager.get_catalog_info()
            
            source_count = self._count_objects(source_catalog)
            target_count = self._count_objects(target_catalog)
            
            validation = {
                'success': True,
                'source_objects': source_count,
                'target_objects': target_count,
                'count_match': source_count == target_count,
                'differences': []
            }
            
            # Check for differences
            differences = self._find_differences(source_catalog, target_catalog)
            validation['differences'] = differences
            
            if differences or source_count != target_count:
                validation['success'] = False
            
            return validation
            
        except Exception as e:
            logger.error(f"Validation error: {e}")
            return {
                'success': False,
                'error': str(e),
                'timestamp': datetime.utcnow().isoformat()
            }
    
    def _find_differences(self, source: Dict[str, Any], target: Dict[str, Any]) -> List[str]:
        """Find differences between source and target catalogs."""
        differences = []
        
        # Check all source objects exist in target
        for volume_name, volume_data in source.items():
            if volume_name not in target:
                differences.append(f"Missing volume: {volume_name}")
                continue
                
            for library_name, library_data in volume_data.items():
                if library_name not in target[volume_name]:
                    differences.append(f"Missing library: {volume_name}.{library_name}")
                    continue
                
                for object_name, object_data in library_data.items():
                    if object_name not in target[volume_name][library_name]:
                        differences.append(f"Missing object: {volume_name}.{library_name}.{object_name}")
                        continue
                    
                    # Compare key attributes
                    target_object = target[volume_name][library_name][object_name]
                    if object_data.get('TYPE') != target_object.get('TYPE'):
                        differences.append(f"Type mismatch: {volume_name}.{library_name}.{object_name}")
        
        # Check for extra objects in target
        for volume_name, volume_data in target.items():
            if volume_name not in source:
                differences.append(f"Extra volume in target: {volume_name}")
                continue
                
            for library_name, library_data in volume_data.items():
                if library_name not in source[volume_name]:
                    differences.append(f"Extra library in target: {volume_name}.{library_name}")
                    continue
                
                for object_name in library_data.keys():
                    if object_name not in source[volume_name][library_name]:
                        differences.append(f"Extra object in target: {volume_name}.{library_name}.{object_name}")
        
        return differences
    
    def rollback_migration(self, backup_path: str) -> Dict[str, Any]:
        """
        Rollback migration using backup.
        
        Args:
            backup_path: Path to backup file
            
        Returns:
            Rollback statistics
        """
        try:
            if not os.path.exists(backup_path):
                raise MigrationError(f"Backup file not found: {backup_path}")
            
            # Load backup data
            with open(backup_path, 'r', encoding='utf-8') as f:
                backup_data = json.load(f)
            
            # Initialize target manager
            target_manager = DBIOManager(self.target_config)
            
            # Import backup data
            stats = target_manager.import_catalog(backup_data, merge=False)
            
            logger.info(f"Migration rollback completed from {backup_path}")
            return {
                'rollback_completed': True,
                'backup_path': backup_path,
                'restored_objects': stats.get('objects', 0),
                'timestamp': datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            error_msg = f"Rollback failed: {str(e)}"
            logger.error(error_msg)
            raise MigrationError(error_msg)
    
    def sync_backends(self, direction: str = 'source_to_target') -> Dict[str, Any]:
        """
        Sync data between backends.
        
        Args:
            direction: 'source_to_target' or 'target_to_source'
            
        Returns:
            Sync statistics
        """
        try:
            source_manager = DBIOManager(self.source_config)
            target_manager = DBIOManager(self.target_config)
            
            if direction == 'source_to_target':
                catalog_data = source_manager.get_catalog_info()
                stats = target_manager.import_catalog(catalog_data, merge=True)
            else:
                catalog_data = target_manager.get_catalog_info()
                stats = source_manager.import_catalog(catalog_data, merge=True)
            
            stats['sync_direction'] = direction
            stats['timestamp'] = datetime.utcnow().isoformat()
            
            logger.info(f"Backend sync completed: {direction}")
            return stats
            
        except Exception as e:
            error_msg = f"Backend sync failed: {str(e)}"
            logger.error(error_msg)
            raise MigrationError(error_msg)


class HybridBackend:
    """
    Hybrid backend that reads from one source and writes to multiple targets.
    Useful during migration periods.
    """
    
    def __init__(self, read_backend: DBIOManager, write_backends: List[DBIOManager]):
        """
        Initialize hybrid backend.
        
        Args:
            read_backend: Backend to read from
            write_backends: List of backends to write to
        """
        self.read_backend = read_backend
        self.write_backends = write_backends
        self.write_errors = []
    
    def get_catalog_info(self) -> Dict[str, Any]:
        """Read from primary backend."""
        return self.read_backend.get_catalog_info()
    
    def update_catalog_info(self, volume: str, library: str, object_name: str,
                          object_type: str = "DATASET", **kwargs) -> bool:
        """Write to all backends."""
        success = True
        self.write_errors = []
        
        for backend in self.write_backends:
            try:
                backend.update_catalog_info(volume, library, object_name, object_type, **kwargs)
            except Exception as e:
                self.write_errors.append(f"Backend write error: {str(e)}")
                success = False
                logger.error(f"Hybrid write error: {e}")
        
        return success
    
    def get_write_errors(self) -> List[str]:
        """Get any write errors from last operation."""
        return self.write_errors.copy()