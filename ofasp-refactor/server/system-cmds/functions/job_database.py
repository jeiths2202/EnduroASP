# -*- coding: utf-8 -*-
"""
Job Database Module for SMBJOB/REFJOB
Uses SQLite for persistent job storage and management
"""

import os
import sqlite3
import json
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from contextlib import contextmanager

# Database file location
JOB_DATABASE_FILE = "/home/aspuser/app/database/openasp_jobs.db"

@contextmanager
def get_db_connection():
    """Get database connection with automatic cleanup"""
    # Ensure directory exists
    os.makedirs(os.path.dirname(JOB_DATABASE_FILE), exist_ok=True)
    
    conn = sqlite3.connect(JOB_DATABASE_FILE)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()

def init_database():
    """Initialize the job database schema"""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        # Create jobs table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS jobs (
                job_id TEXT PRIMARY KEY,
                job_name TEXT NOT NULL,
                program TEXT NOT NULL,
                library TEXT,
                volume TEXT DEFAULT 'DISK01',
                parameters TEXT,
                priority INTEGER DEFAULT 5,
                jobq TEXT DEFAULT '@SAME',
                jobk TEXT DEFAULT '@SAME',
                hold INTEGER DEFAULT 0,
                status TEXT NOT NULL,
                submitted_time TIMESTAMP NOT NULL,
                start_time TIMESTAMP,
                end_time TIMESTAMP,
                pid INTEGER,
                log_file TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Create indexes for performance
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_jobs_submitted ON jobs(submitted_time)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_jobs_jobq ON jobs(jobq)')
        
        # Create job history table for audit trail
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS job_history (
                history_id INTEGER PRIMARY KEY AUTOINCREMENT,
                job_id TEXT NOT NULL,
                status TEXT NOT NULL,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                message TEXT,
                FOREIGN KEY (job_id) REFERENCES jobs(job_id)
            )
        ''')
        
        # Create job statistics table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS job_statistics (
                stat_date DATE PRIMARY KEY,
                total_submitted INTEGER DEFAULT 0,
                total_completed INTEGER DEFAULT 0,
                total_failed INTEGER DEFAULT 0,
                total_cancelled INTEGER DEFAULT 0,
                avg_execution_time REAL DEFAULT 0
            )
        ''')
        
        conn.commit()

def add_job(job_info) -> bool:
    """
    Add a new job to the database
    
    Args:
        job_info: JobInfo object
        
    Returns:
        bool: True if successful
    """
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            cursor.execute('''
                INSERT INTO jobs (
                    job_id, job_name, program, library, volume,
                    parameters, priority, jobq, jobk, hold,
                    status, submitted_time, log_file
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                job_info.job_id,
                job_info.job_name,
                job_info.program,
                getattr(job_info, 'library', None),
                getattr(job_info, 'volume', 'DISK01'),
                job_info.parameters,
                getattr(job_info, 'priority', 5),
                job_info.jobq,
                getattr(job_info, 'jobk', '@SAME'),
                1 if getattr(job_info, 'hold', False) else 0,
                job_info.status,
                job_info.submitted_time,
                getattr(job_info, 'log_file', None)
            ))
            
            # Add to history
            cursor.execute('''
                INSERT INTO job_history (job_id, status, message)
                VALUES (?, ?, ?)
            ''', (job_info.job_id, 'SUBMITTED', 'Job submitted to queue'))
            
            conn.commit()
            return True
            
    except Exception as e:
        print(f"Database error adding job: {e}")
        return False

def update_job_status(job_id: str, status: str, **kwargs) -> bool:
    """
    Update job status and other attributes
    
    Args:
        job_id (str): Job ID
        status (str): New status
        **kwargs: Additional fields to update
        
    Returns:
        bool: True if successful
    """
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Build update query dynamically
            update_fields = ['status = ?', 'updated_at = CURRENT_TIMESTAMP']
            update_values = [status]
            
            # Handle special fields
            if 'start_time' in kwargs:
                update_fields.append('start_time = ?')
                update_values.append(kwargs['start_time'])
            if 'end_time' in kwargs:
                update_fields.append('end_time = ?')
                update_values.append(kwargs['end_time'])
            if 'pid' in kwargs:
                update_fields.append('pid = ?')
                update_values.append(kwargs['pid'])
                
            update_values.append(job_id)
            
            query = f"UPDATE jobs SET {', '.join(update_fields)} WHERE job_id = ?"
            cursor.execute(query, update_values)
            
            # Add to history
            message = kwargs.get('message', f'Status changed to {status}')
            cursor.execute('''
                INSERT INTO job_history (job_id, status, message)
                VALUES (?, ?, ?)
            ''', (job_id, status, message))
            
            conn.commit()
            return cursor.rowcount > 0
            
    except Exception as e:
        print(f"Database error updating job: {e}")
        return False

def get_active_jobs() -> Dict:
    """
    Get all active jobs from database
    
    Returns:
        Dict: Dictionary of active jobs
    """
    try:
        from functions.sbmjob import JobInfo
        active_jobs = {}
        
        print("[DEBUG] Connecting to database to get active jobs...")
        
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Get active jobs (including recently completed ones)
            query = '''
                SELECT * FROM jobs 
                WHERE status IN ('PENDING', 'RUNNING', 'HELD')
                   OR (status IN ('COMPLETED', 'ERROR', 'CANCELLED') 
                       AND datetime(end_time) > datetime('now', '-1 hour'))
                ORDER BY submitted_time DESC
            '''
            print(f"[DEBUG] Executing query: {query}")
            cursor.execute(query)
            
            rows = cursor.fetchall()
            print(f"[DEBUG] Found {len(rows)} jobs in database")
            
            for row in rows:
                print(f"[DEBUG] Processing job {row['job_id']}: {row['job_name']} (status: {row['status']})")
                
                # Create JobInfo object
                job_info = JobInfo(
                    job_id=row['job_id'],
                    job_name=row['job_name'],
                    program=row['program'],
                    library=row['library'],
                    volume=row['volume'],
                    parameters=row['parameters'],
                    priority=row['priority'],
                    jobq=row['jobq'],
                    jobk=row['jobk'],
                    hold=bool(row['hold'])
                )
                
                # Set additional attributes
                job_info.status = row['status']
                job_info.submitted_time = datetime.fromisoformat(row['submitted_time']) if row['submitted_time'] else None
                job_info.start_time = datetime.fromisoformat(row['start_time']) if row['start_time'] else None
                job_info.end_time = datetime.fromisoformat(row['end_time']) if row['end_time'] else None
                job_info.pid = row['pid']
                job_info.log_file = row['log_file']
                
                active_jobs[row['job_id']] = job_info
                print(f"[DEBUG] Added job {row['job_id']} to active_jobs (status: {job_info.status})")
                
        print(f"[DEBUG] Returning {len(active_jobs)} active jobs")
        return active_jobs
        
    except Exception as e:
        print(f"[ERROR] Database error getting active jobs: {e}")
        import traceback
        traceback.print_exc()
        return {}

def get_job_by_id(job_id: str) -> Optional[Dict]:
    """Get a specific job by ID"""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM jobs WHERE job_id = ?', (job_id,))
            row = cursor.fetchone()
            
            if row:
                return dict(row)
            return None
            
    except Exception as e:
        print(f"Database error getting job: {e}")
        return None

def get_job_history(job_id: str = None, limit: int = 100) -> List[Dict]:
    """Get job history"""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            if job_id:
                cursor.execute('''
                    SELECT * FROM job_history 
                    WHERE job_id = ? 
                    ORDER BY timestamp DESC 
                    LIMIT ?
                ''', (job_id, limit))
            else:
                cursor.execute('''
                    SELECT * FROM job_history 
                    ORDER BY timestamp DESC 
                    LIMIT ?
                ''', (limit,))
                
            return [dict(row) for row in cursor.fetchall()]
            
    except Exception as e:
        print(f"Database error getting history: {e}")
        return []

def cleanup_old_jobs(keep_days: int = 7) -> int:
    """Clean up old completed jobs"""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Delete old completed jobs
            cursor.execute('''
                DELETE FROM jobs 
                WHERE status IN ('COMPLETED', 'ERROR', 'CANCELLED')
                  AND datetime(end_time) < datetime('now', ? || ' days')
            ''', (-keep_days,))
            
            deleted_count = cursor.rowcount
            
            # Clean up orphaned history
            cursor.execute('''
                DELETE FROM job_history 
                WHERE job_id NOT IN (SELECT job_id FROM jobs)
            ''')
            
            conn.commit()
            return deleted_count
            
    except Exception as e:
        print(f"Database error cleaning up jobs: {e}")
        return 0

def get_job_statistics(date: str = None) -> Dict:
    """Get job statistics for a specific date or today"""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            if not date:
                date = datetime.now().date().isoformat()
                
            cursor.execute('''
                SELECT 
                    COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as completed,
                    COUNT(CASE WHEN status = 'ERROR' THEN 1 END) as failed,
                    COUNT(CASE WHEN status = 'CANCELLED' THEN 1 END) as cancelled,
                    COUNT(*) as total,
                    AVG(CASE 
                        WHEN status = 'COMPLETED' AND start_time IS NOT NULL AND end_time IS NOT NULL
                        THEN CAST((julianday(end_time) - julianday(start_time)) * 86400 AS INTEGER)
                    END) as avg_execution_time
                FROM jobs
                WHERE DATE(submitted_time) = ?
            ''', (date,))
            
            row = cursor.fetchone()
            if row:
                return dict(row)
                
            return {'completed': 0, 'failed': 0, 'cancelled': 0, 'total': 0, 'avg_execution_time': 0}
            
    except Exception as e:
        print(f"Database error getting statistics: {e}")
        return {}

def db_update_job_pid(job_id: str, pid: int) -> bool:
    """
    Update job PID in the database
    
    Args:
        job_id (str): Job ID
        pid (int): Process ID
        
    Returns:
        bool: True if successful
    """
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            cursor.execute('''
                UPDATE jobs SET pid = ?, updated_at = CURRENT_TIMESTAMP 
                WHERE job_id = ?
            ''', (pid, job_id))
            
            conn.commit()
            return cursor.rowcount > 0
            
    except Exception as e:
        print(f"Database error updating job PID: {e}")
        return False

def delete_job(job_id: str) -> bool:
    """
    Delete a job from the database
    
    Args:
        job_id (str): Job ID to delete
        
    Returns:
        bool: True if successful
    """
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # First delete from job_history table (foreign key constraint)
            cursor.execute('DELETE FROM job_history WHERE job_id = ?', (job_id,))
            
            # Then delete from jobs table
            cursor.execute('DELETE FROM jobs WHERE job_id = ?', (job_id,))
            
            conn.commit()
            
            # Check if job was actually deleted
            if cursor.rowcount > 0:
                print(f"Job {job_id} successfully deleted from database")
                return True
            else:
                print(f"Job {job_id} not found in database")
                return False
            
    except Exception as e:
        print(f"Database error deleting job {job_id}: {e}")
        return False

def close_database():
    """Close database connections (for cleanup)"""
    # SQLite handles connections per-thread, so nothing specific to close
    pass

# Initialize database on module load
init_database()