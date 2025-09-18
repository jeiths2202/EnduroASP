#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PostgreSQL-based Session Manager for Enterprise Terminal Sessions
Replaces file-based session storage with PostgreSQL database
"""

import os
import sys
import json
import threading
import time
import uuid
import psycopg2
import psycopg2.extras
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any
import logging

# Setup logging
logger = logging.getLogger(__name__)

class PostgreSQLSessionManager:
    """PostgreSQL-based session manager for enterprise terminal sessions"""
    
    def __init__(self, db_config=None):
        self.lock = threading.RLock()
        
        # Default database configuration
        self.db_config = db_config or {
            'host': 'localhost',
            'port': 5432,
            'database': 'ofasp',
            'user': 'aspuser',
            'password': 'aspuser123'
        }
        
        # Test database connection
        self._test_connection()
    
    def _test_connection(self):
        """Test database connection and create table if needed"""
        try:
            with self._get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        SELECT EXISTS (
                            SELECT FROM information_schema.tables 
                            WHERE (table_schema = 'public' OR table_schema = 'aspuser')
                            AND table_name = 'asp_terminal'
                        )
                    """)
                    table_exists = cur.fetchone()[0]
                    
                    if not table_exists:
                        logger.warning("asp_terminal table does not exist. Please run create_asp_terminal_table.sql")
                        raise Exception("asp_terminal table not found")
                    
                    logger.info("PostgreSQL connection successful, asp_terminal table exists")
        except Exception as e:
            logger.error(f"Database connection failed: {e}")
            raise
    
    def _get_connection(self):
        """Get database connection"""
        conn = psycopg2.connect(**self.db_config)
        # Set search path to include aspuser schema
        with conn.cursor() as cur:
            cur.execute("SET search_path TO aspuser, public")
        return conn
    
    def _format_conn_time(self, dt=None):
        """Format datetime to yyyy/mm/dd-hh:mm:ss format"""
        if dt is None:
            dt = datetime.now()
        return dt.strftime('%Y/%m/%d-%H:%M:%S')
    
    def _parse_conn_time(self, conn_time_str):
        """Parse yyyy/mm/dd-hh:mm:ss format to datetime"""
        try:
            return datetime.strptime(conn_time_str, '%Y/%m/%d-%H:%M:%S')
        except:
            return datetime.now()
    
    def create_session(self, wsname: str, user_id: str, terminal_id: str = None, 
                      display_mode: str = 'legacy', encoding: str = 'sjis') -> str:
        """Create new workstation session in PostgreSQL"""
        with self.lock:
            try:
                session_id = f"ws_{wsname}_{uuid.uuid4().hex[:8]}"
                terminal_id = terminal_id or wsname
                conn_time = self._format_conn_time()
                
                with self._get_connection() as conn:
                    with conn.cursor() as cur:
                        # Check if session already exists
                        cur.execute(
                            "SELECT wsname FROM asp_terminal WHERE wsname = %s",
                            (wsname,)
                        )
                        
                        if cur.fetchone():
                            # Update existing session
                            cur.execute("""
                                UPDATE asp_terminal 
                                SET username = %s, terminal_id = %s, session_id = %s,
                                    display_mode = %s, encoding = %s, status = '1',
                                    conn_time = %s, login_time = CURRENT_TIMESTAMP,
                                    last_activity = CURRENT_TIMESTAMP
                                WHERE wsname = %s
                            """, (user_id, terminal_id, session_id, display_mode, 
                                 encoding, conn_time, wsname))
                        else:
                            # Insert new session
                            cur.execute("""
                                INSERT INTO asp_terminal 
                                (wsname, username, conn_time, status, terminal_id, session_id,
                                 display_mode, encoding, login_time, last_activity)
                                VALUES (%s, %s, %s, '1', %s, %s, %s, %s, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                            """, (wsname, user_id, conn_time, terminal_id, session_id,
                                 display_mode, encoding))
                        
                        conn.commit()
                        logger.info(f"Created/Updated session {session_id} for {wsname} (user: {user_id})")
                        return session_id
                        
            except Exception as e:
                logger.error(f"Failed to create session: {e}")
                raise
    
    def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get session by session ID"""
        try:
            with self._get_connection() as conn:
                with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                    cur.execute(
                        "SELECT * FROM asp_terminal WHERE session_id = %s",
                        (session_id,)
                    )
                    row = cur.fetchone()
                    return dict(row) if row else None
        except Exception as e:
            logger.error(f"Failed to get session {session_id}: {e}")
            return None
    
    def get_session_by_workstation(self, wsname: str) -> Optional[Dict[str, Any]]:
        """Get session by workstation name"""
        try:
            with self._get_connection() as conn:
                with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                    cur.execute(
                        "SELECT * FROM asp_terminal WHERE wsname = %s",
                        (wsname,)
                    )
                    row = cur.fetchone()
                    return dict(row) if row else None
        except Exception as e:
            logger.error(f"Failed to get session for workstation {wsname}: {e}")
            return None
    
    def get_sessions_by_user(self, user_id: str) -> List[Dict[str, Any]]:
        """Get all sessions for a user"""
        try:
            with self._get_connection() as conn:
                with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                    cur.execute(
                        "SELECT * FROM asp_terminal WHERE username = %s ORDER BY last_activity DESC",
                        (user_id,)
                    )
                    rows = cur.fetchall()
                    return [dict(row) for row in rows]
        except Exception as e:
            logger.error(f"Failed to get sessions for user {user_id}: {e}")
            return []
    
    def list_all_sessions(self, status_filter=None, username_filter=None) -> List[Dict[str, Any]]:
        """List all active sessions with optional filters"""
        try:
            with self._get_connection() as conn:
                with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                    # Build query with filters
                    where_conditions = []
                    params = []
                    
                    if status_filter:
                        where_conditions.append("status = %s")
                        params.append(status_filter)
                    
                    if username_filter:
                        where_conditions.append("username = %s")
                        params.append(username_filter)
                    
                    where_clause = " WHERE " + " AND ".join(where_conditions) if where_conditions else ""
                    
                    query = f"SELECT * FROM asp_terminal{where_clause} ORDER BY last_activity DESC"
                    cur.execute(query, params)
                    rows = cur.fetchall()
                    return [dict(row) for row in rows]
        except Exception as e:
            logger.error(f"Failed to list sessions: {e}")
            return []
    
    def update_session(self, session_id: str, updates: Dict[str, Any]) -> bool:
        """Update session data"""
        try:
            with self._get_connection() as conn:
                with conn.cursor() as cur:
                    # Check if session exists
                    cur.execute(
                        "SELECT wsname FROM asp_terminal WHERE session_id = %s",
                        (session_id,)
                    )
                    
                    if not cur.fetchone():
                        return False
                    
                    # Build update query
                    set_clauses = []
                    params = []
                    
                    for key, value in updates.items():
                        if key in ['wsname', 'username', 'status', 'terminal_id', 
                                  'display_mode', 'encoding', 'conn_time', 'properties']:
                            set_clauses.append(f"{key} = %s")
                            params.append(value)
                    
                    # Always update last_activity
                    set_clauses.append("last_activity = CURRENT_TIMESTAMP")
                    params.append(session_id)
                    
                    if set_clauses:
                        query = f"UPDATE asp_terminal SET {', '.join(set_clauses)} WHERE session_id = %s"
                        cur.execute(query, params)
                        conn.commit()
                        
                        logger.info(f"Updated session {session_id}")
                        return True
                    
                    return False
                    
        except Exception as e:
            logger.error(f"Failed to update session {session_id}: {e}")
            return False
    
    def update_session_by_wsname(self, wsname: str, updates: Dict[str, Any]) -> bool:
        """Update session data by workstation name"""
        try:
            with self._get_connection() as conn:
                with conn.cursor() as cur:
                    # Check if session exists
                    cur.execute(
                        "SELECT session_id FROM asp_terminal WHERE wsname = %s",
                        (wsname,)
                    )
                    
                    row = cur.fetchone()
                    if not row:
                        return False
                    
                    session_id = row[0]
                    return self.update_session(session_id, updates)
                    
        except Exception as e:
            logger.error(f"Failed to update session for wsname {wsname}: {e}")
            return False
    
    def logout_session(self, session_id: str = None, wsname: str = None) -> bool:
        """Logout session by ID or workstation name"""
        try:
            with self._get_connection() as conn:
                with conn.cursor() as cur:
                    if wsname:
                        # Logout by workstation name
                        cur.execute(
                            "UPDATE asp_terminal SET status = '0', last_activity = CURRENT_TIMESTAMP WHERE wsname = %s",
                            (wsname,)
                        )
                    elif session_id:
                        # Logout by session ID
                        cur.execute(
                            "UPDATE asp_terminal SET status = '0', last_activity = CURRENT_TIMESTAMP WHERE session_id = %s",
                            (session_id,)
                        )
                    else:
                        return False
                    
                    if cur.rowcount > 0:
                        conn.commit()
                        logger.info(f"Logged out session (session_id: {session_id}, wsname: {wsname})")
                        return True
                    
                    return False
                    
        except Exception as e:
            logger.error(f"Failed to logout session: {e}")
            return False
    
    def delete_session(self, wsname: str) -> bool:
        """Delete session completely (admin operation)"""
        try:
            with self._get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "DELETE FROM asp_terminal WHERE wsname = %s",
                        (wsname,)
                    )
                    
                    if cur.rowcount > 0:
                        conn.commit()
                        logger.info(f"Deleted session for wsname {wsname}")
                        return True
                    
                    return False
                    
        except Exception as e:
            logger.error(f"Failed to delete session {wsname}: {e}")
            return False
    
    def cleanup_old_sessions(self, days_old=30):
        """Clean up old inactive sessions"""
        try:
            with self._get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        DELETE FROM asp_terminal 
                        WHERE status = '0' 
                        AND last_activity < CURRENT_TIMESTAMP - INTERVAL '%s days'
                    """, (days_old,))
                    
                    deleted_count = cur.rowcount
                    conn.commit()
                    
                    if deleted_count > 0:
                        logger.info(f"Cleaned up {deleted_count} old sessions")
                    
                    return deleted_count
                    
        except Exception as e:
            logger.error(f"Failed to cleanup old sessions: {e}")
            return 0
    
    def get_session_statistics(self) -> Dict[str, Any]:
        """Get session statistics"""
        try:
            with self._get_connection() as conn:
                with conn.cursor() as cur:
                    # Get various statistics
                    stats = {}
                    
                    # Total sessions
                    cur.execute("SELECT COUNT(*) FROM asp_terminal")
                    stats['total_sessions'] = cur.fetchone()[0]
                    
                    # Active sessions
                    cur.execute("SELECT COUNT(*) FROM asp_terminal WHERE status = '1'")
                    stats['active_sessions'] = cur.fetchone()[0]
                    
                    # Inactive sessions  
                    cur.execute("SELECT COUNT(*) FROM asp_terminal WHERE status = '0'")
                    stats['inactive_sessions'] = cur.fetchone()[0]
                    
                    # Unique users
                    cur.execute("SELECT COUNT(DISTINCT username) FROM asp_terminal")
                    stats['unique_users'] = cur.fetchone()[0]
                    
                    # Sessions by user
                    cur.execute("""
                        SELECT username, COUNT(*) as session_count 
                        FROM asp_terminal 
                        GROUP BY username 
                        ORDER BY session_count DESC
                    """)
                    stats['sessions_by_user'] = [{'username': row[0], 'count': row[1]} 
                                                for row in cur.fetchall()]
                    
                    return stats
                    
        except Exception as e:
            logger.error(f"Failed to get session statistics: {e}")
            return {}

    def bulk_logout_sessions(self, workstation_names: List[str]) -> Dict[str, Any]:
        """Bulk logout sessions by workstation names"""
        results = {
            'success': [],
            'failed': [],
            'total_processed': len(workstation_names)
        }
        
        try:
            with self._get_connection() as conn:
                with conn.cursor() as cur:
                    for wsname in workstation_names:
                        try:
                            # Check if session exists and is active
                            cur.execute(
                                "SELECT wsname, status FROM asp_terminal WHERE wsname = %s",
                                (wsname,)
                            )
                            row = cur.fetchone()
                            
                            if not row:
                                results['failed'].append({
                                    'wsname': wsname,
                                    'error': 'Session not found'
                                })
                                continue
                                
                            if row[1] == '0':
                                results['failed'].append({
                                    'wsname': wsname,
                                    'error': 'Session already inactive'
                                })
                                continue
                            
                            # Logout the session
                            cur.execute(
                                "UPDATE asp_terminal SET status = '0', last_activity = CURRENT_TIMESTAMP WHERE wsname = %s",
                                (wsname,)
                            )
                            
                            if cur.rowcount > 0:
                                results['success'].append(wsname)
                                logger.info(f"Bulk logout successful for workstation: {wsname}")
                            else:
                                results['failed'].append({
                                    'wsname': wsname,
                                    'error': 'Failed to update session status'
                                })
                                
                        except Exception as e:
                            logger.error(f"Failed to logout session {wsname}: {e}")
                            results['failed'].append({
                                'wsname': wsname,
                                'error': str(e)
                            })
                    
                    # Commit all changes
                    conn.commit()
                    logger.info(f"Bulk logout completed: {len(results['success'])} successful, {len(results['failed'])} failed")
                    
        except Exception as e:
            logger.error(f"Bulk logout operation failed: {e}")
            # If connection failed, mark all as failed
            for wsname in workstation_names:
                if wsname not in [item['wsname'] if isinstance(item, dict) else item for item in results['success'] + [f['wsname'] for f in results['failed']]]:
                    results['failed'].append({
                        'wsname': wsname,
                        'error': f'Database error: {str(e)}'
                    })
        
        return results

    def get_sessions_by_workstation_names(self, workstation_names: List[str]) -> List[Dict[str, Any]]:
        """Get sessions for multiple workstation names"""
        try:
            if not workstation_names:
                return []
                
            with self._get_connection() as conn:
                with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                    # Create placeholders for the IN clause
                    placeholders = ','.join(['%s'] * len(workstation_names))
                    query = f"SELECT * FROM asp_terminal WHERE wsname IN ({placeholders}) ORDER BY wsname"
                    
                    cur.execute(query, workstation_names)
                    rows = cur.fetchall()
                    return [dict(row) for row in rows]
                    
        except Exception as e:
            logger.error(f"Failed to get sessions for workstations: {e}")
            return []

    def cleanup_inactive_sessions(self, minutes=30):
        """Clean up inactive sessions older than specified minutes."""
        try:
            with psycopg2.connect(**self.db_config) as conn:
                with conn.cursor() as cur:
                    # Set search path to find the table
                    cur.execute("SET search_path TO aspuser, public")
                    
                    # Calculate cutoff time
                    from datetime import datetime, timedelta
                    cutoff_time = datetime.now() - timedelta(minutes=minutes)
                    
                    # Delete inactive sessions older than cutoff time
                    cur.execute("""
                        DELETE FROM asp_terminal 
                        WHERE status = '0' 
                        AND last_activity < %s
                    """, (cutoff_time,))
                    
                    cleaned_count = cur.rowcount
                    conn.commit()
                    
                    logger.info(f"Cleaned up {cleaned_count} inactive sessions older than {minutes} minutes")
                    return cleaned_count
                    
        except Exception as e:
            logger.error(f"Session cleanup failed: {e}")
            return 0

# Test the PostgreSQL session manager
if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO)
    
    try:
        # Test database connection and basic operations
        session_manager = PostgreSQLSessionManager()
        
        # Test creating a session
        print("Testing session creation...")
        session_id = session_manager.create_session(
            wsname='TEST123',
            user_id='testuser',
            terminal_id='TEST123',
            display_mode='legacy',
            encoding='sjis'
        )
        print(f"Created session: {session_id}")
        
        # Test retrieving session
        print("Testing session retrieval...")
        session = session_manager.get_session_by_workstation('TEST123')
        print(f"Retrieved session: {session}")
        
        # Test listing sessions
        print("Testing session listing...")
        sessions = session_manager.list_all_sessions()
        print(f"Total sessions: {len(sessions)}")
        
        # Test updating session
        print("Testing session update...")
        success = session_manager.update_session_by_wsname('TEST123', {'status': '0'})
        print(f"Update successful: {success}")
        
        # Test statistics
        print("Testing session statistics...")
        stats = session_manager.get_session_statistics()
        print(f"Statistics: {stats}")
        
        print("PostgreSQL Session Manager test completed successfully!")
        
    except Exception as e:
        print(f"Test failed: {e}")

        sys.exit(1)