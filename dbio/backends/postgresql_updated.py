"""
Updated PostgreSQL Backend for DBIO - OpenASP Catalog System
Designed for the new hierarchical schema: aspuser.volumes -> libraries -> objects
"""

import logging
import psycopg2
from psycopg2 import pool
from psycopg2.extras import RealDictCursor, Json
from typing import Dict, Any, Optional, List
import json
from datetime import datetime

from .base import BaseBackend, TransactionMixin
from ..exceptions import ConnectionError, ValidationError, TransactionError

logger = logging.getLogger(__name__)


class PostgreSQLBackend(BaseBackend, TransactionMixin):
    """PostgreSQL implementation for OpenASP catalog storage with new schema."""
    
    def __init__(self, config: Dict[str, Any]):
        """
        Initialize PostgreSQL backend.
        
        Args:
            config: PostgreSQL configuration
        """
        super().__init__(config)
        self.connection_pool = None
        self.current_connection = None
        self._init_connection_pool()
    
    def _init_connection_pool(self):
        """Initialize connection pool."""
        try:
            conn_params = {
                'host': self.config.get('host', 'localhost'),
                'port': self.config.get('port', 5432),
                'database': self.config.get('database', 'ofasp'),
                'user': self.config.get('user', 'aspuser'),
                'password': self.config.get('password', 'aspuser123'),
            }
            
            pool_size = self.config.get('pool_size', 10)
            max_overflow = self.config.get('max_overflow', 5)
            
            self.connection_pool = psycopg2.pool.ThreadedConnectionPool(
                minconn=1,
                maxconn=pool_size + max_overflow,
                **conn_params
            )
            
            logger.info("PostgreSQL connection pool initialized for OpenASP catalog")
            
        except Exception as e:
            logger.error(f"Failed to initialize PostgreSQL pool: {e}")
            raise ConnectionError(f"Cannot connect to PostgreSQL: {str(e)}")
    
    def _get_connection(self):
        """Get connection from pool."""
        if self.current_connection:
            return self.current_connection
        return self.connection_pool.getconn()
    
    def _put_connection(self, conn):
        """Return connection to pool."""
        if self.current_connection:
            return  # Don't return transaction connections
        self.connection_pool.putconn(conn)
    
    def get_all_objects(self) -> Dict[str, Any]:
        """
        Get all objects in catalog.json format.
        Returns the hierarchical structure: {volume: {library: {object: {...}}}}
        """
        conn = self._get_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cursor:
                # Get all objects with their hierarchical information
                cursor.execute("""
                    SELECT 
                        v.volume_name,
                        l.library_name,
                        o.object_name,
                        o.object_type,
                        o.file_size,
                        o.created_at,
                        o.updated_at,
                        -- Program specific fields
                        p.pgm_type,
                        p.encoding as pgm_encoding,
                        p.compile_date,
                        -- Dataset specific fields  
                        d.rec_type,
                        d.rec_len,
                        d.encoding as dataset_encoding,
                        -- Map specific fields
                        m.map_type,
                        m.width,
                        m.height,
                        -- Copybook specific fields
                        cb.copybook_type,
                        cb.encoding as copybook_encoding,
                        -- Job specific fields
                        j.job_type,
                        j.schedule_info,
                        -- Layout specific fields
                        lay.layout_type,
                        lay.layout_data
                    FROM aspuser.objects o
                    JOIN aspuser.libraries l ON o.library_id = l.library_id
                    JOIN aspuser.volumes v ON o.volume_id = v.volume_id
                    LEFT JOIN aspuser.programs p ON o.object_id = p.object_id
                    LEFT JOIN aspuser.datasets d ON o.object_id = d.object_id
                    LEFT JOIN aspuser.maps m ON o.object_id = m.object_id
                    LEFT JOIN aspuser.copybooks cb ON o.object_id = cb.object_id
                    LEFT JOIN aspuser.jobs j ON o.object_id = j.object_id
                    LEFT JOIN aspuser.layouts lay ON o.object_id = lay.object_id
                    ORDER BY v.volume_name, l.library_name, o.object_name
                """)
                
                results = cursor.fetchall()
                
                # Build hierarchical structure
                catalog = {}
                for row in results:
                    volume_name = row['volume_name']
                    library_name = row['library_name']
                    object_name = row['object_name']
                    
                    # Ensure volume exists
                    if volume_name not in catalog:
                        catalog[volume_name] = {}
                    
                    # Ensure library exists
                    if library_name not in catalog[volume_name]:
                        catalog[volume_name][library_name] = {}
                    
                    # Build object data based on type
                    object_data = {
                        'TYPE': row['object_type'],
                        'CREATED': row['created_at'].isoformat() + 'Z' if row['created_at'] else None,
                        'UPDATED': row['updated_at'].isoformat() + 'Z' if row['updated_at'] else None,
                    }
                    
                    # Add type-specific attributes
                    if row['object_type'] == 'PGM':
                        if row['pgm_type']:
                            object_data['PGMTYPE'] = row['pgm_type']
                        if row['pgm_encoding']:
                            object_data['ENCODING'] = row['pgm_encoding']
                        if row['compile_date']:
                            object_data['COMPILED'] = row['compile_date'].isoformat() + 'Z'
                    
                    elif row['object_type'] == 'DATASET':
                        if row['rec_type']:
                            object_data['RECTYPE'] = row['rec_type']
                        if row['rec_len']:
                            object_data['RECLEN'] = row['rec_len']
                        if row['dataset_encoding']:
                            object_data['ENCODING'] = row['dataset_encoding']
                    
                    elif row['object_type'] == 'MAP':
                        if row['map_type']:
                            object_data['MAPTYPE'] = row['map_type']
                        if row['width']:
                            object_data['WIDTH'] = row['width']
                        if row['height']:
                            object_data['HEIGHT'] = row['height']
                    
                    elif row['object_type'] == 'COPYBOOK':
                        if row['copybook_type']:
                            object_data['COPYBOOKTYPE'] = row['copybook_type']
                        if row['copybook_encoding']:
                            object_data['ENCODING'] = row['copybook_encoding']
                    
                    elif row['object_type'] == 'JOB':
                        if row['job_type']:
                            object_data['JOBTYPE'] = row['job_type']
                        if row['schedule_info']:
                            object_data['SCHEDULE'] = row['schedule_info']
                    
                    elif row['object_type'] == 'LAYOUT':
                        if row['layout_type']:
                            object_data['LAYOUTTYPE'] = row['layout_type']
                        if row['layout_data']:
                            try:
                                object_data['LAYOUTDATA'] = json.loads(row['layout_data']) if isinstance(row['layout_data'], str) else row['layout_data']
                            except:
                                object_data['LAYOUTDATA'] = row['layout_data']
                    
                    # Add file size if available
                    if row['file_size']:
                        object_data['SIZE'] = row['file_size']
                    
                    catalog[volume_name][library_name][object_name] = object_data
                
                return catalog
                    
        except Exception as e:
            logger.error(f"Error getting all objects: {e}")
            raise
        finally:
            self._put_connection(conn)
    
    def get_object(self, volume: str, library: str, object_name: str) -> Optional[Dict[str, Any]]:
        """Get a specific object with all its attributes."""
        conn = self._get_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cursor:
                cursor.execute("""
                    SELECT 
                        o.object_type,
                        o.file_size,
                        o.created_at,
                        o.updated_at,
                        -- Program specific fields
                        p.pgm_type,
                        p.encoding as pgm_encoding,
                        p.compile_date,
                        -- Dataset specific fields  
                        d.rec_type,
                        d.rec_len,
                        d.encoding as dataset_encoding,
                        -- Map specific fields
                        m.map_type,
                        m.width,
                        m.height,
                        -- Copybook specific fields
                        cb.copybook_type,
                        cb.encoding as copybook_encoding,
                        -- Job specific fields
                        j.job_type,
                        j.schedule_info,
                        -- Layout specific fields
                        lay.layout_type,
                        lay.layout_data
                    FROM aspuser.objects o
                    JOIN aspuser.libraries l ON o.library_id = l.library_id
                    JOIN aspuser.volumes v ON o.volume_id = v.volume_id
                    LEFT JOIN aspuser.programs p ON o.object_id = p.object_id
                    LEFT JOIN aspuser.datasets d ON o.object_id = d.object_id
                    LEFT JOIN aspuser.maps m ON o.object_id = m.object_id
                    LEFT JOIN aspuser.copybooks cb ON o.object_id = cb.object_id
                    LEFT JOIN aspuser.jobs j ON o.object_id = j.object_id
                    LEFT JOIN aspuser.layouts lay ON o.object_id = lay.object_id
                    WHERE v.volume_name = %s AND l.library_name = %s AND o.object_name = %s
                """, (volume, library, object_name))
                
                row = cursor.fetchone()
                if not row:
                    return None
                
                # Build object data
                object_data = {
                    'TYPE': row['object_type'],
                    'CREATED': row['created_at'].isoformat() + 'Z' if row['created_at'] else None,
                    'UPDATED': row['updated_at'].isoformat() + 'Z' if row['updated_at'] else None,
                }
                
                # Add type-specific attributes (same logic as get_all_objects)
                if row['object_type'] == 'PGM':
                    if row['pgm_type']:
                        object_data['PGMTYPE'] = row['pgm_type']
                    if row['pgm_encoding']:
                        object_data['ENCODING'] = row['pgm_encoding']
                    if row['compile_date']:
                        object_data['COMPILED'] = row['compile_date'].isoformat() + 'Z'
                
                elif row['object_type'] == 'DATASET':
                    if row['rec_type']:
                        object_data['RECTYPE'] = row['rec_type']
                    if row['rec_len']:
                        object_data['RECLEN'] = row['rec_len']
                    if row['dataset_encoding']:
                        object_data['ENCODING'] = row['dataset_encoding']
                
                elif row['object_type'] == 'MAP':
                    if row['map_type']:
                        object_data['MAPTYPE'] = row['map_type']
                    if row['width']:
                        object_data['WIDTH'] = row['width']
                    if row['height']:
                        object_data['HEIGHT'] = row['height']
                
                elif row['object_type'] == 'COPYBOOK':
                    if row['copybook_type']:
                        object_data['COPYBOOKTYPE'] = row['copybook_type']
                    if row['copybook_encoding']:
                        object_data['ENCODING'] = row['copybook_encoding']
                
                elif row['object_type'] == 'JOB':
                    if row['job_type']:
                        object_data['JOBTYPE'] = row['job_type']
                    if row['schedule_info']:
                        object_data['SCHEDULE'] = row['schedule_info']
                
                elif row['object_type'] == 'LAYOUT':
                    if row['layout_type']:
                        object_data['LAYOUTTYPE'] = row['layout_type']
                    if row['layout_data']:
                        try:
                            object_data['LAYOUTDATA'] = json.loads(row['layout_data']) if isinstance(row['layout_data'], str) else row['layout_data']
                        except:
                            object_data['LAYOUTDATA'] = row['layout_data']
                
                # Add file size if available
                if row['file_size']:
                    object_data['SIZE'] = row['file_size']
                
                return object_data
                
        except Exception as e:
            logger.error(f"Error getting object {volume}.{library}.{object_name}: {e}")
            raise
        finally:
            self._put_connection(conn)
    
    def update_object(self, volume: str, library: str, object_name: str, 
                     attributes: Dict[str, Any]) -> bool:
        """Update or create an object."""
        conn = self._get_connection()
        try:
            with conn.cursor() as cursor:
                object_type = attributes.get('TYPE', 'DATASET')
                
                # Begin transaction if not already in one
                if not self.current_connection:
                    cursor.execute("BEGIN")
                
                # Get or create volume
                cursor.execute("""
                    INSERT INTO aspuser.volumes (volume_name, volume_path)
                    VALUES (%s, %s)
                    ON CONFLICT (volume_name) DO NOTHING
                    RETURNING volume_id
                """, (volume, f'/volume/{volume}'))
                
                result = cursor.fetchone()
                if not result:
                    cursor.execute("SELECT volume_id FROM aspuser.volumes WHERE volume_name = %s", (volume,))
                    result = cursor.fetchone()
                volume_id = result[0]
                
                # Get or create library
                cursor.execute("""
                    INSERT INTO aspuser.libraries (volume_id, library_name, library_path)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (volume_id, library_name) DO NOTHING
                    RETURNING library_id
                """, (volume_id, library, f'/volume/{volume}/{library}'))
                
                result = cursor.fetchone()
                if not result:
                    cursor.execute("SELECT library_id FROM aspuser.libraries WHERE volume_id = %s AND library_name = %s", (volume_id, library))
                    result = cursor.fetchone()
                library_id = result[0]
                
                # Update or insert object
                object_path = f'/volume/{volume}/{library}/{object_name}'
                file_size = attributes.get('SIZE', 0)
                
                cursor.execute("""
                    INSERT INTO aspuser.objects (volume_id, library_id, object_name, object_type, object_path, file_size)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    ON CONFLICT (volume_id, library_id, object_name) 
                    DO UPDATE SET 
                        object_type = EXCLUDED.object_type,
                        object_path = EXCLUDED.object_path,
                        file_size = EXCLUDED.file_size,
                        updated_at = CURRENT_TIMESTAMP
                    RETURNING object_id
                """, (volume_id, library_id, object_name, object_type, object_path, file_size))
                
                object_id = cursor.fetchone()[0]
                
                # Handle type-specific attributes
                if object_type == 'PGM':
                    pgm_type = attributes.get('PGMTYPE', 'UNKNOWN')
                    encoding = attributes.get('ENCODING', 'UTF-8')
                    
                    cursor.execute("""
                        INSERT INTO aspuser.programs (object_id, pgm_type, encoding)
                        VALUES (%s, %s, %s)
                        ON CONFLICT (object_id) 
                        DO UPDATE SET 
                            pgm_type = EXCLUDED.pgm_type,
                            encoding = EXCLUDED.encoding,
                            updated_at = CURRENT_TIMESTAMP
                    """, (object_id, pgm_type, encoding))
                
                elif object_type == 'DATASET':
                    rec_type = attributes.get('RECTYPE', 'FB')
                    rec_len = attributes.get('RECLEN', 80)
                    encoding = attributes.get('ENCODING', 'UTF-8')
                    
                    cursor.execute("""
                        INSERT INTO aspuser.datasets (object_id, rec_type, rec_len, encoding)
                        VALUES (%s, %s, %s, %s)
                        ON CONFLICT (object_id) 
                        DO UPDATE SET 
                            rec_type = EXCLUDED.rec_type,
                            rec_len = EXCLUDED.rec_len,
                            encoding = EXCLUDED.encoding,
                            updated_at = CURRENT_TIMESTAMP
                    """, (object_id, rec_type, rec_len, encoding))
                
                elif object_type == 'MAP':
                    map_type = attributes.get('MAPTYPE', 'SMED')
                    width = attributes.get('WIDTH', 0)
                    height = attributes.get('HEIGHT', 0)
                    
                    cursor.execute("""
                        INSERT INTO aspuser.maps (object_id, map_type, width, height)
                        VALUES (%s, %s, %s, %s)
                        ON CONFLICT (object_id) 
                        DO UPDATE SET 
                            map_type = EXCLUDED.map_type,
                            width = EXCLUDED.width,
                            height = EXCLUDED.height,
                            updated_at = CURRENT_TIMESTAMP
                    """, (object_id, map_type, width, height))
                
                elif object_type == 'COPYBOOK':
                    copybook_type = attributes.get('COPYBOOKTYPE', 'COBOL')
                    encoding = attributes.get('ENCODING', 'UTF-8')
                    
                    cursor.execute("""
                        INSERT INTO aspuser.copybooks (object_id, copybook_type, encoding)
                        VALUES (%s, %s, %s)
                        ON CONFLICT (object_id) 
                        DO UPDATE SET 
                            copybook_type = EXCLUDED.copybook_type,
                            encoding = EXCLUDED.encoding,
                            updated_at = CURRENT_TIMESTAMP
                    """, (object_id, copybook_type, encoding))
                
                elif object_type == 'JOB':
                    job_type = attributes.get('JOBTYPE', 'BATCH')
                    schedule_info = attributes.get('SCHEDULE', '')
                    
                    cursor.execute("""
                        INSERT INTO aspuser.jobs (object_id, job_type, schedule_info)
                        VALUES (%s, %s, %s)
                        ON CONFLICT (object_id) 
                        DO UPDATE SET 
                            job_type = EXCLUDED.job_type,
                            schedule_info = EXCLUDED.schedule_info,
                            updated_at = CURRENT_TIMESTAMP
                    """, (object_id, job_type, schedule_info))
                
                elif object_type == 'LAYOUT':
                    layout_type = attributes.get('LAYOUTTYPE', 'SCREEN')
                    layout_data = json.dumps(attributes.get('LAYOUTDATA', {}))
                    
                    cursor.execute("""
                        INSERT INTO aspuser.layouts (object_id, layout_type, layout_data)
                        VALUES (%s, %s, %s)
                        ON CONFLICT (object_id) 
                        DO UPDATE SET 
                            layout_type = EXCLUDED.layout_type,
                            layout_data = EXCLUDED.layout_data,
                            updated_at = CURRENT_TIMESTAMP
                    """, (object_id, layout_type, layout_data))
                
                # Commit transaction if we started it
                if not self.current_connection:
                    cursor.execute("COMMIT")
                
                logger.debug(f"Updated object {volume}.{library}.{object_name}")
                return True
                
        except Exception as e:
            if not self.current_connection:
                cursor.execute("ROLLBACK")
            logger.error(f"Error updating object {volume}.{library}.{object_name}: {e}")
            raise
        finally:
            self._put_connection(conn)
    
    def delete_object(self, volume: str, library: str, object_name: str) -> bool:
        """Delete an object."""
        conn = self._get_connection()
        try:
            with conn.cursor() as cursor:
                cursor.execute("""
                    DELETE FROM aspuser.objects 
                    WHERE volume_id = (SELECT volume_id FROM aspuser.volumes WHERE volume_name = %s)
                      AND library_id = (SELECT library_id FROM aspuser.libraries l 
                                       JOIN aspuser.volumes v ON l.volume_id = v.volume_id
                                       WHERE v.volume_name = %s AND l.library_name = %s)
                      AND object_name = %s
                """, (volume, volume, library, object_name))
                
                deleted = cursor.rowcount > 0
                
                if not self.current_connection:
                    conn.commit()
                
                logger.debug(f"Deleted object {volume}.{library}.{object_name}")
                return deleted
                
        except Exception as e:
            if not self.current_connection:
                conn.rollback()
            logger.error(f"Error deleting object {volume}.{library}.{object_name}: {e}")
            raise
        finally:
            self._put_connection(conn)
    
    def query_objects(self, filters: Optional[Dict[str, Any]] = None,
                     sort: Optional[List[tuple]] = None,
                     limit: Optional[int] = None) -> List[Dict[str, Any]]:
        """Query objects with filters and sorting."""
        conn = self._get_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cursor:
                query = """
                    SELECT v.volume_name, l.library_name, o.object_name, o.object_type,
                           o.created_at, o.updated_at, o.file_size
                    FROM aspuser.objects o
                    JOIN aspuser.libraries l ON o.library_id = l.library_id
                    JOIN aspuser.volumes v ON o.volume_id = v.volume_id
                    WHERE 1=1
                """
                params = []
                
                # Apply filters
                if filters:
                    for key, value in filters.items():
                        if key == 'object_type':
                            query += " AND o.object_type = %s"
                            params.append(value)
                        elif key == 'volume':
                            query += " AND v.volume_name = %s"
                            params.append(value)
                        elif key == 'library':
                            query += " AND l.library_name = %s"
                            params.append(value)
                
                # Apply sorting
                if sort:
                    order_clauses = []
                    for field, direction in sort:
                        if field in ['volume_name', 'library_name', 'object_name', 'object_type']:
                            if field == 'volume_name':
                                order_clauses.append(f"v.volume_name {direction}")
                            elif field == 'library_name':
                                order_clauses.append(f"l.library_name {direction}")
                            else:
                                order_clauses.append(f"o.{field} {direction}")
                    if order_clauses:
                        query += f" ORDER BY {', '.join(order_clauses)}"
                
                # Apply limit
                if limit:
                    query += " LIMIT %s"
                    params.append(limit)
                
                cursor.execute(query, params)
                return [dict(row) for row in cursor.fetchall()]
                
        except Exception as e:
            logger.error(f"Error querying objects: {e}")
            raise
        finally:
            self._put_connection(conn)
    
    def search_objects(self, query: str, object_type: Optional[str] = None) -> List[Dict[str, Any]]:
        """Full-text search across objects."""
        conn = self._get_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cursor:
                sql = """
                    SELECT v.volume_name, l.library_name, o.object_name, o.object_type
                    FROM aspuser.objects o
                    JOIN aspuser.libraries l ON o.library_id = l.library_id
                    JOIN aspuser.volumes v ON o.volume_id = v.volume_id
                    WHERE o.object_name ILIKE %s
                """
                params = [f'%{query}%']
                
                if object_type:
                    sql += " AND o.object_type = %s"
                    params.append(object_type)
                
                sql += " ORDER BY o.object_name"
                
                cursor.execute(sql, params)
                return [dict(row) for row in cursor.fetchall()]
                
        except Exception as e:
            logger.error(f"Error searching objects: {e}")
            raise
        finally:
            self._put_connection(conn)
    
    def get_statistics(self) -> Dict[str, Any]:
        """Get backend statistics."""
        conn = self._get_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cursor:
                # Object counts by type
                cursor.execute("""
                    SELECT object_type, COUNT(*) as count
                    FROM aspuser.objects
                    GROUP BY object_type
                """)
                object_counts = {row['object_type']: row['count'] for row in cursor.fetchall()}
                
                # Volume/Library counts
                cursor.execute("SELECT COUNT(*) FROM aspuser.volumes")
                volume_count = cursor.fetchone()['count']
                
                cursor.execute("SELECT COUNT(*) FROM aspuser.libraries")
                library_count = cursor.fetchone()['count']
                
                # Total objects
                cursor.execute("SELECT COUNT(*) FROM aspuser.objects")
                total_objects = cursor.fetchone()['count']
                
                return {
                    'backend': 'postgresql',
                    'total_objects': total_objects,
                    'volumes': volume_count,
                    'libraries': library_count,
                    'objects_by_type': object_counts,
                    'connection_pool_size': self.connection_pool.maxconn if self.connection_pool else 0,
                    'timestamp': datetime.utcnow().isoformat()
                }
                
        except Exception as e:
            logger.error(f"Error getting statistics: {e}")
            raise
        finally:
            self._put_connection(conn)
    
    def bulk_operations(self, operations: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Perform bulk operations."""
        conn = self._get_connection()
        stats = {'created': 0, 'updated': 0, 'deleted': 0, 'errors': 0}
        
        try:
            with conn.cursor() as cursor:
                # Begin transaction for bulk operations
                if not self.current_connection:
                    conn.autocommit = False
                
                for operation in operations:
                    try:
                        op_type = operation.get('type')
                        volume = operation.get('volume')
                        library = operation.get('library')
                        object_name = operation.get('object_name')
                        
                        if op_type == 'update':
                            attributes = operation.get('attributes', {})
                            success = self.update_object(volume, library, object_name, attributes)
                            if success:
                                stats['updated'] += 1
                            
                        elif op_type == 'delete':
                            success = self.delete_object(volume, library, object_name)
                            if success:
                                stats['deleted'] += 1
                            
                    except Exception as e:
                        logger.error(f"Error in bulk operation: {e}")
                        stats['errors'] += 1
                
                if not self.current_connection:
                    conn.commit()
                    
        except Exception as e:
            if not self.current_connection:
                conn.rollback()
            logger.error(f"Error in bulk operations: {e}")
            raise
        finally:
            if not self.current_connection:
                conn.autocommit = True
            self._put_connection(conn)
        
        return stats
    
    def health_check(self) -> Dict[str, Any]:
        """Check PostgreSQL backend health."""
        try:
            conn = self._get_connection()
            with conn.cursor() as cursor:
                cursor.execute("SELECT 1")
                result = cursor.fetchone()
                
            self._put_connection(conn)
            
            return {
                'status': 'healthy',
                'backend': 'postgresql',
                'database': 'ofasp',
                'schema': 'aspuser',
                'connection': 'ok',
                'query_test': 'ok' if result else 'failed',
                'timestamp': datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            return {
                'status': 'unhealthy',
                'backend': 'postgresql',
                'error': str(e),
                'timestamp': datetime.utcnow().isoformat()
            }
    
    # Transaction support methods
    def begin_transaction(self):
        """Begin a transaction."""
        if self.current_connection:
            raise TransactionError("Transaction already active")
        
        self.current_connection = self.connection_pool.getconn()
        self.current_connection.autocommit = False
        logger.debug("Transaction started")
    
    def commit_transaction(self):
        """Commit current transaction."""
        if not self.current_connection:
            raise TransactionError("No active transaction")
        
        try:
            self.current_connection.commit()
            logger.debug("Transaction committed")
        finally:
            self.current_connection.autocommit = True
            self.connection_pool.putconn(self.current_connection)
            self.current_connection = None
    
    def rollback_transaction(self):
        """Rollback current transaction."""
        if not self.current_connection:
            raise TransactionError("No active transaction")
        
        try:
            self.current_connection.rollback()
            logger.debug("Transaction rolled back")
        finally:
            self.current_connection.autocommit = True
            self.connection_pool.putconn(self.current_connection)
            self.current_connection = None
    
    def close(self):
        """Close connection pool."""
        if self.current_connection:
            self.rollback_transaction()
        
        if self.connection_pool:
            self.connection_pool.closeall()
            logger.info("PostgreSQL connection pool closed")
    
    def import_catalog(self, catalog_data: Dict[str, Any], merge: bool = False) -> Dict[str, Any]:
        """
        Import catalog data from dictionary.
        
        Args:
            catalog_data: Complete catalog structure
            merge: If True, merge with existing; if False, replace
            
        Returns:
            Import statistics
        """
        conn = self._get_connection()
        stats = {'volumes': 0, 'libraries': 0, 'objects': 0, 'errors': 0}
        
        try:
            with conn.cursor() as cursor:
                # Begin transaction
                if not self.current_connection:
                    cursor.execute("BEGIN")
                
                # Clear existing data if not merging
                if not merge:
                    cursor.execute("DELETE FROM aspuser.layouts")
                    cursor.execute("DELETE FROM aspuser.jobs") 
                    cursor.execute("DELETE FROM aspuser.copybooks")
                    cursor.execute("DELETE FROM aspuser.maps")
                    cursor.execute("DELETE FROM aspuser.datasets")
                    cursor.execute("DELETE FROM aspuser.programs")
                    cursor.execute("DELETE FROM aspuser.objects")
                    cursor.execute("DELETE FROM aspuser.libraries")
                    cursor.execute("DELETE FROM aspuser.volumes")
                
                # Import data
                for volume_name, volume_data in catalog_data.items():
                    if not isinstance(volume_data, dict):
                        continue
                        
                    try:
                        stats['volumes'] += 1
                        
                        for library_name, library_data in volume_data.items():
                            if not isinstance(library_data, dict):
                                continue
                                
                            try:
                                stats['libraries'] += 1
                                
                                for object_name, object_data in library_data.items():
                                    if not isinstance(object_data, dict):
                                        continue
                                        
                                    try:
                                        # Use update_object to handle the import
                                        result = self.update_object(volume_name, library_name, object_name, object_data)
                                        if result:
                                            stats['objects'] += 1
                                        else:
                                            stats['errors'] += 1
                                    except Exception as e:
                                        logger.error(f"Error importing object {volume_name}.{library_name}.{object_name}: {e}")
                                        stats['errors'] += 1
                                        
                            except Exception as e:
                                logger.error(f"Error importing library {volume_name}.{library_name}: {e}")
                                stats['errors'] += 1
                                
                    except Exception as e:
                        logger.error(f"Error importing volume {volume_name}: {e}")
                        stats['errors'] += 1
                
                # Commit transaction if we started it
                if not self.current_connection:
                    cursor.execute("COMMIT")
                    
                logger.info(f"Catalog import completed: {stats}")
                return stats
                
        except Exception as e:
            logger.error(f"Error during catalog import: {e}")
            if not self.current_connection:
                conn.rollback()
            raise
        finally:
            self._put_connection(conn)