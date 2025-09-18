#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
DBIO Service Wrapper for OpenASP System
Provides centralized database operations using DBIO module
"""

import os
import sys
import logging
from typing import Dict, Any, Optional, List
from datetime import datetime
import threading

# Add DBIO path
sys.path.append('/home/aspuser/app')

logger = logging.getLogger(__name__)

class DBIOService:
    """
    Centralized DBIO service for OpenASP system.
    Provides unified database operations with connection pooling and caching.
    """
    
    _instance = None
    _lock = threading.Lock()
    
    def __new__(cls):
        """Singleton pattern implementation"""
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        """Initialize DBIO service with configuration"""
        if hasattr(self, '_initialized'):
            return
            
        self._initialized = True
        self._dbio_manager = None
        self._config = self._load_configuration()
        self._init_dbio_manager()
        
        logger.info("DBIO Service initialized successfully")
    
    def _load_configuration(self) -> Dict[str, Any]:
        """Load environment-based and asp.conf configuration"""
        # Load from asp.conf file
        asp_config = self._load_asp_config()
        
        return {
            'backend': 'postgresql',
            'postgresql': {
                'host': os.getenv('DB_HOST', 'localhost'),
                'port': int(os.getenv('DB_PORT', '5432')),
                'database': os.getenv('DB_NAME', 'ofasp'),
                'user': os.getenv('DB_USER', 'aspuser'),
                'password': os.getenv('DB_PASSWORD', 'aspuser123'),
                'pool_size': int(os.getenv('DB_POOL_SIZE', '10')),
                'max_overflow': int(os.getenv('DB_MAX_OVERFLOW', '5'))
            },
            'catalog': {
                'table_name': asp_config.get('CATLOG_TABLE', 'catalog_objects'),
                'use_hierarchical': asp_config.get('USE_HIERARCHICAL_SCHEMA', 'false').lower() == 'true'
            },
            'cache': {
                'enabled': os.getenv('CACHE_ENABLED', 'true').lower() == 'true',
                'ttl': int(os.getenv('CACHE_TTL', '300')),  # 5 minutes default
                'type': os.getenv('CACHE_TYPE', 'memory')
            },
            'logging': {
                'level': os.getenv('LOG_LEVEL', 'INFO'),
                'enable_sql_logging': os.getenv('SQL_LOGGING', 'false').lower() == 'true'
            }
        }
    
    def _load_asp_config(self) -> Dict[str, str]:
        """Load configuration from asp.conf file"""
        config_file = '/home/aspuser/app/config/asp.conf'
        config = {}
        
        try:
            if os.path.exists(config_file):
                with open(config_file, 'r', encoding='utf-8') as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith('#') and '=' in line:
                            key, value = line.split('=', 1)
                            config[key.strip()] = value.strip()
                            
            logger.debug(f"Loaded ASP config: {config}")
            return config
            
        except Exception as e:
            logger.warning(f"Failed to load asp.conf: {e}")
            return {}
    
    def _init_dbio_manager(self):
        """Initialize database connection based on catalog table configuration"""
        try:
            # Check if we should use hierarchical schema or catalog_objects table
            catalog_table = self._config['catalog']['table_name']
            use_hierarchical = self._config['catalog']['use_hierarchical']
            
            if catalog_table == 'catalog_objects' and not use_hierarchical:
                # Use direct catalog_objects table access
                self._use_direct_catalog = True
                self._init_direct_catalog_connection()
            else:
                # Use DBIO manager for hierarchical schema
                self._use_direct_catalog = False
                from dbio import DBIOManager
                self._dbio_manager = DBIOManager(self._config)
                
            logger.info(f"DBIO Service initialized - Direct catalog: {self._use_direct_catalog}, Table: {catalog_table}")
            
        except Exception as e:
            logger.error(f"Failed to initialize DBIO Service: {e}")
            raise
    
    def _init_direct_catalog_connection(self):
        """Initialize direct PostgreSQL connection for catalog_objects table"""
        import psycopg2
        from psycopg2 import pool
        
        # Database connection parameters
        conn_params = {
            'host': self._config['postgresql']['host'],
            'port': self._config['postgresql']['port'],
            'database': self._config['postgresql']['database'],
            'user': self._config['postgresql']['user'],
            'password': self._config['postgresql']['password']
        }
        
        # Create connection pool
        self._direct_pool = psycopg2.pool.ThreadedConnectionPool(
            minconn=1,
            maxconn=self._config['postgresql']['pool_size'],
            **conn_params
        )
        
        logger.info("Direct catalog_objects connection pool initialized")
    
    def get_catalog_info(self) -> Dict[str, Any]:
        """
        Get complete catalog information from PostgreSQL
        
        Returns:
            Dictionary with complete catalog structure
        """
        try:
            if self._use_direct_catalog:
                return self._get_catalog_info_direct()
            else:
                if not self._dbio_manager:
                    raise RuntimeError("DBIO Manager not initialized")
                
                catalog_data = self._dbio_manager.get_catalog_info()
                logger.debug(f"Retrieved catalog with {len(catalog_data)} volumes")
                return catalog_data
            
        except Exception as e:
            logger.error(f"Error getting catalog info: {e}")
            raise
    
    def _get_catalog_info_direct(self) -> Dict[str, Any]:
        """Get catalog info directly from catalog_objects table"""
        import psycopg2.extras
        
        conn = self._direct_pool.getconn()
        try:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
                table_name = self._config['catalog']['table_name']
                cursor.execute(f"""
                    SELECT volume, library, object_name, object_type, 
                           pgmtype, maptype, jobtype, copybooktype,
                           encoding, reclen, rectype, created, updated, layoutdata
                    FROM aspuser.{table_name}
                    ORDER BY volume, library, object_name
                """)
                
                results = cursor.fetchall()
                
                # Build hierarchical structure
                catalog = {}
                for row in results:
                    volume = row['volume']
                    library = row['library']
                    object_name = row['object_name']
                    
                    # Ensure volume exists
                    if volume not in catalog:
                        catalog[volume] = {}
                    
                    # Ensure library exists
                    if library not in catalog[volume]:
                        catalog[volume][library] = {}
                    
                    # Build object data
                    object_data = {
                        'TYPE': row['object_type']
                    }
                    
                    # Add timestamps if available
                    if row['created']:
                        object_data['CREATED'] = row['created'].isoformat() + 'Z'
                    if row['updated']:
                        object_data['UPDATED'] = row['updated'].isoformat() + 'Z'
                    
                    # Add type-specific attributes
                    if row['object_type'] == 'DATASET':
                        if row['rectype']:
                            object_data['RECTYPE'] = row['rectype']
                        if row['reclen']:
                            object_data['RECLEN'] = row['reclen']
                        if row['encoding']:
                            object_data['ENCODING'] = row['encoding']
                    elif row['object_type'] == 'PGM':
                        if row['pgmtype']:
                            object_data['PGMTYPE'] = row['pgmtype']
                    elif row['object_type'] == 'MAP':
                        if row['maptype']:
                            object_data['MAPTYPE'] = row['maptype']
                    elif row['object_type'] == 'JOB':
                        if row['jobtype']:
                            object_data['JOBTYPE'] = row['jobtype']
                    
                    # Add layoutdata if available
                    if row['layoutdata']:
                        object_data.update(row['layoutdata'])
                    
                    catalog[volume][library][object_name] = object_data
                
                logger.debug(f"Retrieved catalog with {len(catalog)} volumes from {table_name}")
                return catalog
                
        finally:
            self._direct_pool.putconn(conn)
    
    def update_catalog_info(self, volume: str, library: str, object_name: str, 
                          object_type: str = "DATASET", **kwargs) -> bool:
        """
        Update catalog information in PostgreSQL
        
        Args:
            volume: Volume name
            library: Library name  
            object_name: Object name
            object_type: Type of object
            **kwargs: Additional attributes
            
        Returns:
            True if successful, False otherwise
        """
        try:
            if self._use_direct_catalog:
                return self._update_catalog_info_direct(volume, library, object_name, object_type, **kwargs)
            else:
                if not self._dbio_manager:
                    raise RuntimeError("DBIO Manager not initialized")
                
                result = self._dbio_manager.update_catalog_info(
                    volume, library, object_name, object_type, **kwargs
                )
                
                if result:
                    logger.info(f"[CATALOG] Updated in PostgreSQL: {volume}/{library}/{object_name}")
                    return True
                else:
                    logger.warning(f"[CATALOG] Update returned False: {volume}/{library}/{object_name}")
                    return False
                
        except Exception as e:
            logger.error(f"Error updating catalog: {e}")
            raise
    
    def _update_catalog_info_direct(self, volume: str, library: str, object_name: str, 
                                   object_type: str = "DATASET", **kwargs) -> bool:
        """Update catalog info directly in catalog_objects table"""
        import psycopg2.extras
        
        conn = self._direct_pool.getconn()
        try:
            with conn.cursor() as cursor:
                table_name = self._config['catalog']['table_name']
                
                # Check if record exists
                cursor.execute(f"""
                    SELECT id FROM aspuser.{table_name}
                    WHERE volume = %s AND library = %s AND object_name = %s
                """, (volume, library, object_name))
                
                existing = cursor.fetchone()
                
                if existing:
                    # Update existing record
                    update_fields = []
                    update_values = []
                    
                    # Add object type
                    update_fields.append("object_type = %s")
                    update_values.append(object_type)
                    
                    # Add type-specific fields
                    if object_type == "DATASET":
                        if "RECTYPE" in kwargs:
                            update_fields.append("rectype = %s")
                            update_values.append(kwargs["RECTYPE"])
                        if "RECLEN" in kwargs:
                            update_fields.append("reclen = %s")
                            update_values.append(kwargs["RECLEN"])
                        if "ENCODING" in kwargs:
                            update_fields.append("encoding = %s")
                            update_values.append(kwargs["ENCODING"])
                    elif object_type == "PGM":
                        if "PGMTYPE" in kwargs:
                            update_fields.append("pgmtype = %s")
                            update_values.append(kwargs["PGMTYPE"])
                    elif object_type == "MAP":
                        if "MAPTYPE" in kwargs:
                            update_fields.append("maptype = %s")
                            update_values.append(kwargs["MAPTYPE"])
                    elif object_type == "JOB":
                        if "JOBTYPE" in kwargs:
                            update_fields.append("jobtype = %s")
                            update_values.append(kwargs["JOBTYPE"])
                    
                    # Store additional data in layoutdata as JSONB
                    extra_data = {k: v for k, v in kwargs.items() 
                                 if k not in ["RECTYPE", "RECLEN", "ENCODING", "PGMTYPE", "MAPTYPE", "JOBTYPE"]}
                    if extra_data:
                        update_fields.append("layoutdata = %s")
                        update_values.append(psycopg2.extras.Json(extra_data))
                    
                    # Add timestamp
                    update_fields.append("updated = CURRENT_TIMESTAMP")
                    
                    # Build and execute update query
                    update_values.extend([volume, library, object_name])
                    query = f"""
                        UPDATE aspuser.{table_name}
                        SET {', '.join(update_fields)}
                        WHERE volume = %s AND library = %s AND object_name = %s
                    """
                    cursor.execute(query, update_values)
                else:
                    # Insert new record
                    insert_fields = ["volume", "library", "object_name", "object_type"]
                    insert_values = [volume, library, object_name, object_type]
                    
                    # Add type-specific fields
                    if object_type == "DATASET":
                        insert_fields.extend(["rectype", "reclen", "encoding"])
                        insert_values.extend([
                            kwargs.get("RECTYPE", "FB"),
                            kwargs.get("RECLEN", 80),
                            kwargs.get("ENCODING", "utf-8")
                        ])
                    elif object_type == "PGM":
                        if "PGMTYPE" in kwargs:
                            insert_fields.append("pgmtype")
                            insert_values.append(kwargs["PGMTYPE"])
                    elif object_type == "MAP":
                        if "MAPTYPE" in kwargs:
                            insert_fields.append("maptype")
                            insert_values.append(kwargs["MAPTYPE"])
                    elif object_type == "JOB":
                        if "JOBTYPE" in kwargs:
                            insert_fields.append("jobtype")
                            insert_values.append(kwargs["JOBTYPE"])
                    
                    # Store additional data in layoutdata
                    extra_data = {k: v for k, v in kwargs.items() 
                                 if k not in ["RECTYPE", "RECLEN", "ENCODING", "PGMTYPE", "MAPTYPE", "JOBTYPE"]}
                    if extra_data:
                        insert_fields.append("layoutdata")
                        insert_values.append(psycopg2.extras.Json(extra_data))
                    
                    # Build and execute insert query
                    placeholders = ', '.join(['%s'] * len(insert_values))
                    query = f"""
                        INSERT INTO aspuser.{table_name} ({', '.join(insert_fields)})
                        VALUES ({placeholders})
                    """
                    cursor.execute(query, insert_values)
                
                conn.commit()
                logger.info(f"[CATALOG] Updated in PostgreSQL {table_name}: {volume}/{library}/{object_name}")
                return True
                
        except Exception as e:
            conn.rollback()
            logger.error(f"Error updating catalog directly: {e}")
            raise
        finally:
            self._direct_pool.putconn(conn)
    
    def get_object_info(self, volume: str, library: str, object_name: str) -> Optional[Dict[str, Any]]:
        """
        Get specific object information
        
        Args:
            volume: Volume name
            library: Library name
            object_name: Object name
            
        Returns:
            Object information dictionary or None if not found
        """
        try:
            if not self._dbio_manager:
                raise RuntimeError("DBIO Manager not initialized")
            
            # Use DBIO manager's get_object method
            catalog_data = self._dbio_manager.get_catalog_info()
            return catalog_data.get(volume, {}).get(library, {}).get(object_name, {})
            
        except Exception as e:
            logger.error(f"Error getting object info: {e}")
            return None
    
    def list_objects(self, volume: str = None, library: str = None, 
                    object_type: str = None) -> List[Dict[str, Any]]:
        """
        List objects with optional filters
        
        Args:
            volume: Optional volume filter
            library: Optional library filter
            object_type: Optional object type filter
            
        Returns:
            List of object dictionaries
        """
        try:
            if not self._dbio_manager:
                raise RuntimeError("DBIO Manager not initialized")
            
            # Get all objects and filter
            catalog_data = self._dbio_manager.get_catalog_info()
            objects = []
            
            for vol_name, vol_data in catalog_data.items():
                if volume and vol_name != volume:
                    continue
                    
                for lib_name, lib_data in vol_data.items():
                    if library and lib_name != library:
                        continue
                        
                    for obj_name, obj_data in lib_data.items():
                        if object_type and obj_data.get('TYPE') != object_type:
                            continue
                            
                        obj_info = {
                            'volume': vol_name,
                            'library': lib_name,
                            'object_name': obj_name,
                            **obj_data
                        }
                        objects.append(obj_info)
            
            return objects
            
        except Exception as e:
            logger.error(f"Error listing objects: {e}")
            return []
    
    def delete_object(self, volume: str, library: str, object_name: str) -> bool:
        """
        Delete object from catalog
        
        Args:
            volume: Volume name
            library: Library name
            object_name: Object name
            
        Returns:
            True if successful, False otherwise
        """
        try:
            if not self._dbio_manager:
                raise RuntimeError("DBIO Manager not initialized")
            
            # Use DBIO manager's delete functionality
            result = self._dbio_manager.delete_object(volume, library, object_name)
            
            if result:
                logger.info(f"[CATALOG] Deleted from PostgreSQL: {volume}/{library}/{object_name}")
                return True
            else:
                logger.warning(f"[CATALOG] Delete returned False: {volume}/{library}/{object_name}")
                return False
                
        except Exception as e:
            logger.error(f"Error deleting object: {e}")
            return False
    
    def get_statistics(self) -> Dict[str, Any]:
        """
        Get database statistics
        
        Returns:
            Statistics dictionary
        """
        try:
            if not self._dbio_manager:
                raise RuntimeError("DBIO Manager not initialized")
            
            return self._dbio_manager.get_statistics()
            
        except Exception as e:
            logger.error(f"Error getting statistics: {e}")
            return {
                'error': str(e),
                'timestamp': datetime.utcnow().isoformat()
            }
    
    def health_check(self) -> Dict[str, Any]:
        """
        Perform health check on DBIO service
        
        Returns:
            Health status dictionary
        """
        try:
            if not self._dbio_manager:
                return {
                    'status': 'unhealthy',
                    'error': 'DBIO Manager not initialized',
                    'timestamp': datetime.utcnow().isoformat()
                }
            
            # Test database connection
            stats = self.get_statistics()
            
            return {
                'status': 'healthy',
                'service': 'dbio-service',
                'backend': self._config.get('backend'),
                'database': self._config.get('postgresql', {}).get('database'),
                'connection_pool': stats.get('connection_pool_size', 0),
                'timestamp': datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            return {
                'status': 'unhealthy',
                'error': str(e),
                'timestamp': datetime.utcnow().isoformat()
            }
    
    
    def close(self):
        """Close DBIO service and cleanup resources"""
        try:
            if self._dbio_manager:
                # Close DBIO manager if it has a close method
                if hasattr(self._dbio_manager, 'close'):
                    self._dbio_manager.close()
                    
            logger.info("DBIO Service closed successfully")
            
        except Exception as e:
            logger.error(f"Error closing DBIO service: {e}")


# Global service instance
_dbio_service = None

def get_dbio_service() -> DBIOService:
    """
    Get singleton DBIO service instance
    
    Returns:
        DBIOService instance
    """
    global _dbio_service
    if _dbio_service is None:
        _dbio_service = DBIOService()
    return _dbio_service

# Convenience functions for backward compatibility
def get_catalog_info() -> Dict[str, Any]:
    """Get catalog info using DBIO service"""
    service = get_dbio_service()
    return service.get_catalog_info()

def update_catalog_info(volume: str, library: str, object_name: str, 
                       object_type: str = "DATASET", **kwargs) -> bool:
    """Update catalog info using DBIO service"""
    service = get_dbio_service()
    return service.update_catalog_info(volume, library, object_name, object_type, **kwargs)

def get_object_info(volume: str, library: str, object_name: str) -> Optional[Dict[str, Any]]:
    """Get object info using DBIO service"""
    service = get_dbio_service()
    return service.get_object_info(volume, library, object_name)