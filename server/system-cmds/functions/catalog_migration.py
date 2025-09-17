"""
Catalog Migration Utility Functions
Provides command-line tools and utilities for managing catalog migrations.
"""

import json
import logging
import os
import sys
from datetime import datetime
from typing import Dict, Any, Optional
from pathlib import Path

# Import DBIO components
sys.path.append('/home/aspuser/app')
sys.path.append('/home/aspuser/app/config')

try:
    from dbio.core import DBIOManager
    from dbio.migration import MigrationManager
    from config.catalog_backend_config import (
        get_catalog_backend_config,
        switch_to_postgresql,
        switch_to_json,
        enable_dual_write_migration,
        disable_migration,
        get_migration_status
    )
    DBIO_AVAILABLE = True
except ImportError as e:
    print(f"[ERROR] DBIO components not available: {e}")
    DBIO_AVAILABLE = False

logger = logging.getLogger(__name__)


def migrate_catalog_to_postgresql(dry_run: bool = False, 
                                backup: bool = True,
                                validate: bool = True) -> Dict[str, Any]:
    """
    Migrate catalog from JSON to PostgreSQL backend.
    
    Args:
        dry_run: Only simulate migration without actual changes
        backup: Create backup before migration
        validate: Validate data after migration
        
    Returns:
        Migration statistics and results
    """
    if not DBIO_AVAILABLE:
        raise RuntimeError("DBIO components not available")
    
    config = get_catalog_backend_config()
    
    # Prepare source (JSON) and target (PostgreSQL) configurations
    source_config = config.get_backend_config("json_file")
    target_config = config.get_backend_config("postgresql")
    
    # Create migration manager
    migration_manager = MigrationManager(source_config, target_config)
    
    # Perform migration
    try:
        result = migration_manager.migrate_catalog(
            backup_before=backup,
            validate_after=validate,
            dry_run=dry_run
        )
        
        if not dry_run and result.get('success', False):
            logger.info("Migration completed successfully")
            print("[SUCCESS] Catalog migration to PostgreSQL completed")
            
            # Optionally switch to PostgreSQL backend
            if not config.is_migration_mode():
                print("[INFO] You can now switch to PostgreSQL backend using: switch_to_postgresql()")
        else:
            logger.info(f"Migration dry run completed: {result}")
        
        return result
        
    except Exception as e:
        logger.error(f"Migration failed: {e}")
        print(f"[ERROR] Migration failed: {e}")
        raise


def enable_migration_mode() -> bool:
    """
    Enable migration mode for gradual transition.
    
    In migration mode:
    - Reads come from JSON (reliable)
    - Writes go to both JSON and PostgreSQL (dual-write)
    
    Returns:
        True if successful
    """
    if not DBIO_AVAILABLE:
        print("[ERROR] DBIO components not available")
        return False
    
    try:
        result = enable_dual_write_migration()
        if result:
            print("[SUCCESS] Migration mode enabled")
            print("[INFO] All reads from JSON, writes to both JSON and PostgreSQL")
            print("[INFO] Use 'disable_migration()' to exit migration mode")
        else:
            print("[ERROR] Failed to enable migration mode")
        
        return result
        
    except Exception as e:
        print(f"[ERROR] Failed to enable migration mode: {e}")
        return False


def disable_migration_mode() -> bool:
    """
    Disable migration mode.
    
    Returns:
        True if successful
    """
    if not DBIO_AVAILABLE:
        print("[ERROR] DBIO components not available")
        return False
    
    try:
        result = disable_migration()
        if result:
            print("[SUCCESS] Migration mode disabled")
        else:
            print("[ERROR] Failed to disable migration mode")
        
        return result
        
    except Exception as e:
        print(f"[ERROR] Failed to disable migration mode: {e}")
        return False


def sync_backends(direction: str = "json_to_postgresql") -> Dict[str, Any]:
    """
    Synchronize data between backends.
    
    Args:
        direction: 'json_to_postgresql' or 'postgresql_to_json'
        
    Returns:
        Sync statistics
    """
    if not DBIO_AVAILABLE:
        raise RuntimeError("DBIO components not available")
    
    config = get_catalog_backend_config()
    
    # Map direction to backend configs
    direction_map = {
        "json_to_postgresql": ("json_file", "postgresql"),
        "postgresql_to_json": ("postgresql", "json_file")
    }
    
    if direction not in direction_map:
        raise ValueError(f"Invalid direction: {direction}")
    
    source_backend, target_backend = direction_map[direction]
    source_config = config.get_backend_config(source_backend)
    target_config = config.get_backend_config(target_backend)
    
    # Perform sync
    migration_manager = MigrationManager(source_config, target_config)
    
    try:
        result = migration_manager.sync_backends("source_to_target")
        print(f"[SUCCESS] Synchronized {direction}: {result.get('objects', 0)} objects")
        return result
        
    except Exception as e:
        print(f"[ERROR] Sync failed: {e}")
        raise


def rollback_migration(backup_path: str) -> Dict[str, Any]:
    """
    Rollback migration using backup file.
    
    Args:
        backup_path: Path to backup JSON file
        
    Returns:
        Rollback statistics
    """
    if not DBIO_AVAILABLE:
        raise RuntimeError("DBIO components not available")
    
    if not os.path.exists(backup_path):
        raise FileNotFoundError(f"Backup file not found: {backup_path}")
    
    config = get_catalog_backend_config()
    
    # We'll restore to the current active backend
    target_config = config.get_active_backend_config()
    source_config = config.get_backend_config("json_file")  # Backup is always JSON
    
    migration_manager = MigrationManager(source_config, target_config)
    
    try:
        result = migration_manager.rollback_migration(backup_path)
        print(f"[SUCCESS] Migration rollback completed from {backup_path}")
        return result
        
    except Exception as e:
        print(f"[ERROR] Rollback failed: {e}")
        raise


def validate_migration() -> Dict[str, Any]:
    """
    Validate that JSON and PostgreSQL backends have consistent data.
    
    Returns:
        Validation results
    """
    if not DBIO_AVAILABLE:
        raise RuntimeError("DBIO components not available")
    
    config = get_catalog_backend_config()
    json_config = config.get_backend_config("json_file")
    postgresql_config = config.get_backend_config("postgresql")
    
    try:
        # Create managers for both backends
        json_manager = DBIOManager(json_config)
        postgresql_manager = DBIOManager(postgresql_config)
        
        # Get data from both backends
        json_catalog = json_manager.get_catalog_info()
        postgresql_catalog = postgresql_manager.get_catalog_info()
        
        # Count objects
        json_count = _count_objects(json_catalog)
        postgresql_count = _count_objects(postgresql_catalog)
        
        # Find differences
        differences = _find_catalog_differences(json_catalog, postgresql_catalog)
        
        result = {
            'json_objects': json_count,
            'postgresql_objects': postgresql_count,
            'count_match': json_count == postgresql_count,
            'differences': differences,
            'validation_passed': len(differences) == 0 and json_count == postgresql_count,
            'timestamp': datetime.utcnow().isoformat()
        }
        
        if result['validation_passed']:
            print("[SUCCESS] Migration validation passed - backends are in sync")
        else:
            print(f"[WARNING] Migration validation failed:")
            print(f"  JSON objects: {json_count}")
            print(f"  PostgreSQL objects: {postgresql_count}")
            print(f"  Differences: {len(differences)}")
            for diff in differences[:10]:  # Show first 10 differences
                print(f"    - {diff}")
        
        # Cleanup
        json_manager.close()
        postgresql_manager.close()
        
        return result
        
    except Exception as e:
        print(f"[ERROR] Validation failed: {e}")
        raise


def _count_objects(catalog: Dict[str, Any]) -> int:
    """Count total objects in catalog."""
    count = 0
    for volume_data in catalog.values():
        if isinstance(volume_data, dict):
            for library_data in volume_data.values():
                if isinstance(library_data, dict):
                    count += len(library_data)
    return count


def _find_catalog_differences(source: Dict[str, Any], target: Dict[str, Any]) -> list:
    """Find differences between two catalog structures."""
    differences = []
    
    # Check source objects exist in target
    for volume_name, volume_data in source.items():
        if not isinstance(volume_data, dict):
            continue
            
        if volume_name not in target:
            differences.append(f"Missing volume in target: {volume_name}")
            continue
            
        for library_name, library_data in volume_data.items():
            if not isinstance(library_data, dict):
                continue
                
            if library_name not in target[volume_name]:
                differences.append(f"Missing library in target: {volume_name}.{library_name}")
                continue
            
            for object_name, object_data in library_data.items():
                if object_name not in target[volume_name][library_name]:
                    differences.append(f"Missing object in target: {volume_name}.{library_name}.{object_name}")
                    continue
                
                # Compare TYPE attribute
                source_type = object_data.get('TYPE', 'UNKNOWN') if isinstance(object_data, dict) else 'UNKNOWN'
                target_obj = target[volume_name][library_name][object_name]
                target_type = target_obj.get('TYPE', 'UNKNOWN') if isinstance(target_obj, dict) else 'UNKNOWN'
                
                if source_type != target_type:
                    differences.append(f"Type mismatch {volume_name}.{library_name}.{object_name}: {source_type} != {target_type}")
    
    return differences


def print_migration_status():
    """Print current migration status in a readable format."""
    if not DBIO_AVAILABLE:
        print("[ERROR] DBIO components not available")
        return
    
    try:
        status = get_migration_status()
        
        print("\n=== Catalog Backend Migration Status ===")
        print(f"Migration Mode: {'ENABLED' if status['migration_mode'] else 'DISABLED'}")
        print(f"Active Backend: {status['active_backend']}")
        print(f"Available Backends: {', '.join(status['available_backends'])}")
        
        if status['migration_mode']:
            migration_config = status.get('migration_config', {})
            print(f"Read Backend: {migration_config.get('read_backend', 'unknown')}")
            print(f"Write Backends: {', '.join(migration_config.get('write_backends', []))}")
            print(f"Started: {migration_config.get('started_at', 'unknown')}")
        
        print("\n--- Backend Health ---")
        backend_health = status.get('backend_health', {})
        for backend_name, health in backend_health.items():
            status_indicator = "✓" if health.get('status') == 'healthy' else "✗"
            print(f"{backend_name}: {status_indicator} {health.get('status', 'unknown')}")
            if health.get('error'):
                print(f"  Error: {health['error']}")
        
        print(f"\nTimestamp: {status['timestamp']}")
        print("=" * 45)
        
    except Exception as e:
        print(f"[ERROR] Failed to get migration status: {e}")


# CLI interface functions
def main():
    """Command-line interface for catalog migration."""
    if len(sys.argv) < 2:
        print_usage()
        return
    
    command = sys.argv[1].lower()
    
    try:
        if command == "status":
            print_migration_status()
            
        elif command == "migrate":
            dry_run = "--dry-run" in sys.argv
            no_backup = "--no-backup" in sys.argv
            no_validate = "--no-validate" in sys.argv
            
            result = migrate_catalog_to_postgresql(
                dry_run=dry_run,
                backup=not no_backup,
                validate=not no_validate
            )
            
            if dry_run:
                print(f"[DRY RUN] Would migrate {result.get('source_objects', 0)} objects")
            
        elif command == "enable-migration":
            enable_migration_mode()
            
        elif command == "disable-migration":
            disable_migration_mode()
            
        elif command == "switch-to-postgresql":
            if switch_to_postgresql():
                print("[SUCCESS] Switched to PostgreSQL backend")
            else:
                print("[ERROR] Failed to switch to PostgreSQL")
                
        elif command == "switch-to-json":
            if switch_to_json():
                print("[SUCCESS] Switched to JSON backend")
            else:
                print("[ERROR] Failed to switch to JSON")
                
        elif command == "validate":
            validate_migration()
            
        elif command == "sync":
            direction = sys.argv[2] if len(sys.argv) > 2 else "json_to_postgresql"
            sync_backends(direction)
            
        elif command == "rollback":
            if len(sys.argv) < 3:
                print("[ERROR] Rollback requires backup file path")
                print("Usage: catalog_migration.py rollback <backup_path>")
                return
            
            backup_path = sys.argv[2]
            rollback_migration(backup_path)
            
        else:
            print(f"[ERROR] Unknown command: {command}")
            print_usage()
            
    except Exception as e:
        print(f"[ERROR] Command failed: {e}")
        sys.exit(1)


def print_usage():
    """Print usage information."""
    print("\nCatalog Migration Utility")
    print("=" * 30)
    print("Usage: python catalog_migration.py <command> [options]")
    print("\nCommands:")
    print("  status                    - Show current migration status")
    print("  migrate [--dry-run]       - Migrate JSON to PostgreSQL")
    print("  enable-migration          - Enable dual-write migration mode")
    print("  disable-migration         - Disable migration mode")
    print("  switch-to-postgresql      - Switch to PostgreSQL backend")
    print("  switch-to-json            - Switch to JSON backend")
    print("  validate                  - Validate consistency between backends")
    print("  sync <direction>          - Sync data between backends")
    print("  rollback <backup_path>    - Rollback using backup file")
    print("\nSync directions:")
    print("  json_to_postgresql        - Copy JSON data to PostgreSQL")
    print("  postgresql_to_json        - Copy PostgreSQL data to JSON")
    print("\nMigration options:")
    print("  --dry-run                 - Simulate migration without changes")
    print("  --no-backup               - Skip backup creation")
    print("  --no-validate             - Skip post-migration validation")
    print("\nExamples:")
    print("  python catalog_migration.py status")
    print("  python catalog_migration.py migrate --dry-run")
    print("  python catalog_migration.py enable-migration")
    print("  python catalog_migration.py switch-to-postgresql")


if __name__ == "__main__":
    main()