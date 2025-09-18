#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PostgreSQL Catalog Management Module for OpenASP
Provides database-backed catalog operations for ASP objects
"""

import os
import psycopg2
from psycopg2.extras import RealDictCursor
import json
from datetime import datetime
from typing import Dict, Optional, Any, List
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class PostgreSQLCatalog:
    """PostgreSQL-based catalog management for ASP objects"""
    
    def __init__(self):
        """Initialize PostgreSQL connection"""
        self.db_config = {
            'host': os.getenv('DB_HOST', 'localhost'),
            'port': os.getenv('DB_PORT', '5432'),
            'database': os.getenv('DB_NAME', 'ofasp'),
            'user': os.getenv('DB_USER', 'aspuser'),
            'password': os.getenv('DB_PASSWORD', 'aspuser123')
        }
        self.connection = None
        self.cursor = None
        
    def connect(self):
        """Establish database connection"""
        try:
            self.connection = psycopg2.connect(**self.db_config)
            self.cursor = self.connection.cursor(cursor_factory=RealDictCursor)
            logger.info("PostgreSQL catalog connection established")
            return True
        except Exception as e:
            logger.error(f"Failed to connect to PostgreSQL: {e}")
            return False
    
    def disconnect(self):
        """Close database connection"""
        if self.cursor:
            self.cursor.close()
        if self.connection:
            self.connection.close()
            
    def ensure_tables_exist(self):
        """Ensure catalog tables exist in database"""
        try:
            # Check if volumes table exists
            self.cursor.execute("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = 'volumes'
                );
            """)
            
            if not self.cursor.fetchone()['exists']:
                # Execute the catalog schema SQL
                schema_file = '/home/aspuser/app/database/catalog_schema.sql'
                if os.path.exists(schema_file):
                    with open(schema_file, 'r') as f:
                        schema_sql = f.read()
                    self.cursor.execute(schema_sql)
                    self.connection.commit()
                    logger.info("Catalog tables created successfully")
            return True
        except Exception as e:
            logger.error(f"Failed to ensure tables exist: {e}")
            return False
    
    def get_catalog_info(self) -> Dict:
        """Get complete catalog information as hierarchical dictionary (JSON compatible)"""
        try:
            if not self.connect():
                return {}
                
            self.cursor.execute("""
                SELECT catalog FROM catalog_json_view;
            """)
            
            result = self.cursor.fetchone()
            if result and result['catalog']:
                return result['catalog']
            return {}
            
        except Exception as e:
            logger.error(f"Failed to get catalog info: {e}")
            return {}
        finally:
            self.disconnect()
    
    def update_catalog_info(self, volume: str, library: str, object_name: str, 
                           object_type: str = "DATASET", **kwargs) -> bool:
        """
        Update or create catalog entry in PostgreSQL
        
        Args:
            volume: Volume name (e.g., 'DISK01')
            library: Library name (e.g., 'TESTLIB')
            object_name: Object name (e.g., 'MYFILE')
            object_type: Type of object ('DATASET', 'PGM', 'MAP', 'JOB', 'COPYBOOK', 'LAYOUT')
            **kwargs: Additional attributes based on object type
        
        Returns:
            True if successful, False otherwise
        """
        try:
            if not self.connect():
                return False
            
            # Build attributes JSON
            attributes = {
                'DESCRIPTION': kwargs.get('DESCRIPTION', f'{object_name} {object_type.lower()}')
            }
            
            # Add type-specific attributes
            if object_type == 'DATASET':
                attributes.update({
                    'RECTYPE': kwargs.get('RECTYPE', 'FB'),
                    'RECLEN': kwargs.get('RECLEN', 80),
                    'ENCODING': kwargs.get('ENCODING', 'utf-8'),
                    'RECFM': kwargs.get('RECFM'),
                    'LRECL': kwargs.get('LRECL')
                })
            elif object_type == 'PGM':
                attributes.update({
                    'PGMTYPE': kwargs.get('PGMTYPE', 'COBOL'),
                    'PGMNAME': kwargs.get('PGMNAME'),
                    'VERSION': kwargs.get('VERSION', '1.0'),
                    'CLASSFILE': kwargs.get('CLASSFILE'),
                    'JARFILE': kwargs.get('JARFILE'),
                    'SOURCEFILE': kwargs.get('SOURCEFILE'),
                    'SHELLFILE': kwargs.get('SHELLFILE')
                })
            elif object_type == 'MAP':
                attributes.update({
                    'MAPTYPE': kwargs.get('MAPTYPE', 'SMED'),
                    'MAPFILE': kwargs.get('MAPFILE'),
                    'ROWS': kwargs.get('ROWS', 24),
                    'COLS': kwargs.get('COLS', 80)
                })
            elif object_type == 'JOB':
                attributes.update({
                    'JOBTYPE': kwargs.get('JOBTYPE', 'BATCH'),
                    'SCHEDULE': kwargs.get('SCHEDULE', 'MANUAL'),
                    'COMMAND': kwargs.get('COMMAND')
                })
            
            # Add any additional kwargs
            for key, value in kwargs.items():
                if key not in attributes:
                    attributes[key] = value
            
            # Call stored procedure to update catalog
            self.cursor.execute("""
                SELECT update_catalog_entry(%s, %s, %s, %s, %s::jsonb);
            """, (volume, library, object_name, object_type, json.dumps(attributes)))
            
            self.connection.commit()
            logger.info(f"Catalog updated: {volume}/{library}/{object_name} ({object_type})")
            return True
            
        except Exception as e:
            logger.error(f"Failed to update catalog: {e}")
            if self.connection:
                self.connection.rollback()
            return False
        finally:
            self.disconnect()
    
    def get_object_info(self, volume: str, library: str, object_name: str) -> Dict:
        """Get catalog information for a specific object"""
        try:
            if not self.connect():
                return {}
                
            self.cursor.execute("""
                SELECT attributes 
                FROM catalog_view
                WHERE volume_name = %s 
                AND library_name = %s 
                AND object_name = %s;
            """, (volume, library, object_name))
            
            result = self.cursor.fetchone()
            if result and result['attributes']:
                return result['attributes']
            return {}
            
        except Exception as e:
            logger.error(f"Failed to get object info: {e}")
            return {}
        finally:
            self.disconnect()
    
    def delete_object(self, volume: str, library: str, object_name: str) -> bool:
        """Delete an object from the catalog"""
        try:
            if not self.connect():
                return False
                
            self.cursor.execute("""
                DELETE FROM objects 
                WHERE library_id = (
                    SELECT library_id FROM libraries 
                    WHERE library_name = %s 
                    AND volume_id = (
                        SELECT volume_id FROM volumes 
                        WHERE volume_name = %s
                    )
                )
                AND object_name = %s;
            """, (library, volume, object_name))
            
            self.connection.commit()
            rows_deleted = self.cursor.rowcount
            
            if rows_deleted > 0:
                logger.info(f"Deleted from catalog: {volume}/{library}/{object_name}")
                return True
            else:
                logger.warning(f"Object not found in catalog: {volume}/{library}/{object_name}")
                return False
                
        except Exception as e:
            logger.error(f"Failed to delete object: {e}")
            if self.connection:
                self.connection.rollback()
            return False
        finally:
            self.disconnect()
    
    def list_objects(self, volume: str = None, library: str = None, 
                    object_type: str = None) -> List[Dict]:
        """List objects with optional filters"""
        try:
            if not self.connect():
                return []
                
            query = """
                SELECT volume_name, library_name, object_name, attributes
                FROM catalog_view
                WHERE 1=1
            """
            params = []
            
            if volume:
                query += " AND volume_name = %s"
                params.append(volume)
            if library:
                query += " AND library_name = %s"
                params.append(library)
            if object_type:
                query += " AND (attributes->>'TYPE') = %s"
                params.append(object_type)
                
            query += " ORDER BY volume_name, library_name, object_name"
            
            self.cursor.execute(query, params)
            results = self.cursor.fetchall()
            
            objects = []
            for row in results:
                obj = {
                    'volume': row['volume_name'],
                    'library': row['library_name'],
                    'name': row['object_name']
                }
                if row['attributes']:
                    obj.update(row['attributes'])
                objects.append(obj)
                
            return objects
            
        except Exception as e:
            logger.error(f"Failed to list objects: {e}")
            return []
        finally:
            self.disconnect()
    
    def migrate_from_json(self, json_file_path: str) -> bool:
        """Migrate existing catalog.json to PostgreSQL"""
        try:
            if not os.path.exists(json_file_path):
                logger.warning(f"JSON file not found: {json_file_path}")
                return False
                
            with open(json_file_path, 'r', encoding='utf-8') as f:
                catalog_data = json.load(f)
            
            migrated_count = 0
            for volume, libraries in catalog_data.items():
                if not isinstance(libraries, dict):
                    continue
                    
                for library, objects in libraries.items():
                    if not isinstance(objects, dict):
                        continue
                        
                    for object_name, attributes in objects.items():
                        if not isinstance(attributes, dict):
                            continue
                            
                        object_type = attributes.get('TYPE', 'DATASET')
                        if self.update_catalog_info(volume, library, object_name, 
                                                   object_type, **attributes):
                            migrated_count += 1
            
            logger.info(f"Migrated {migrated_count} objects from JSON to PostgreSQL")
            return True
            
        except Exception as e:
            logger.error(f"Failed to migrate from JSON: {e}")
            return False

# Create a singleton instance
_catalog_instance = None

def get_postgresql_catalog():
    """Get singleton PostgreSQL catalog instance"""
    global _catalog_instance
    if _catalog_instance is None:
        _catalog_instance = PostgreSQLCatalog()
    return _catalog_instance

# Backward compatible functions
def get_catalog_info():
    """Get catalog info (PostgreSQL or JSON fallback)"""
    catalog = get_postgresql_catalog()
    result = catalog.get_catalog_info()
    
    # Fallback to JSON if PostgreSQL fails
    if not result:
        json_path = os.getenv('CATALOG_FILE', '/home/aspuser/app/config/catalog.json')
        if os.path.exists(json_path):
            try:
                with open(json_path, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except:
                pass
    return result

def update_catalog_info(volume, library, object_name, object_type="DATASET", **kwargs):
    """Update catalog info (PostgreSQL with JSON fallback)"""
    catalog = get_postgresql_catalog()
    
    # Try PostgreSQL first
    if catalog.update_catalog_info(volume, library, object_name, object_type, **kwargs):
        return True
    
    # Fallback to JSON update
    logger.warning("PostgreSQL update failed, falling back to JSON")
    json_path = os.getenv('CATALOG_FILE', '/home/aspuser/app/config/catalog.json')
    
    try:
        # Read existing catalog
        if os.path.exists(json_path):
            with open(json_path, 'r', encoding='utf-8') as f:
                catalog_data = json.load(f)
        else:
            catalog_data = {}
        
        # Update catalog structure
        if volume not in catalog_data:
            catalog_data[volume] = {}
        if library not in catalog_data[volume]:
            catalog_data[volume][library] = {}
        if object_name not in catalog_data[volume][library]:
            catalog_data[volume][library][object_name] = {}
        
        # Update object
        catalog_data[volume][library][object_name]["TYPE"] = object_type
        catalog_data[volume][library][object_name]["UPDATED"] = datetime.now().isoformat() + "Z"
        
        # Add attributes
        for key, value in kwargs.items():
            catalog_data[volume][library][object_name][key] = value
        
        # Write back
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(catalog_data, f, indent=2, ensure_ascii=False)
        
        return True
    except Exception as e:
        logger.error(f"JSON fallback also failed: {e}")
        return False

def get_object_info(volume, library, object_name):
    """Get object info from catalog"""
    catalog = get_postgresql_catalog()
    return catalog.get_object_info(volume, library, object_name)