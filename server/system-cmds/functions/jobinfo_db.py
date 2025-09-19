# -*- coding: utf-8 -*-
"""
JOBINFO Database Module for PostgreSQL integration
Handles job information persistence in the ofasp database
"""

import os
import psycopg2
from datetime import datetime
from typing import Dict, List, Optional, Any
import logging

logger = logging.getLogger(__name__)

# Database connection parameters
DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'database': os.getenv('DB_NAME', 'ofasp'),
    'user': os.getenv('DB_USER', 'aspuser'),
    'password': os.getenv('DB_PASSWORD', 'aspuser123'),
    'port': int(os.getenv('DB_PORT', '5432'))
}

def get_db_connection():
    """Get database connection"""
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        return conn
    except Exception as e:
        logger.error(f"Database connection error: {e}")
        return None

def insert_jobinfo(job_id: str, job_name: str, status: str, user: str = "aspuser") -> bool:
    """
    Insert job information into JOBINFO table
    
    Args:
        job_id: Job ID (char 17)
        job_name: Job name (char 36) 
        status: Job status (char 9)
        user: User name (char 16)
        
    Returns:
        True if successful, False otherwise
    """
    try:
        conn = get_db_connection()
        if not conn:
            return False
            
        with conn.cursor() as cursor:
            # Format submission datetime
            sbmdt = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            
            # Insert job info
            insert_query = """
                INSERT INTO aspuser.jobinfo (jobid, jobname, status, "user", sbmdt)
                VALUES (%s, %s, %s, %s, %s)
            """
            
            cursor.execute(insert_query, (
                job_id[:17],  # Ensure char(17)
                job_name[:36],  # Ensure char(36)
                status[:9],   # Ensure char(9)
                user[:16],    # Ensure char(16)
                sbmdt[:19]    # Ensure char(19)
            ))
            
            conn.commit()
            logger.info(f"Job info inserted: {job_id}")
            return True
            
    except Exception as e:
        logger.error(f"Error inserting job info: {e}")
        if conn:
            conn.rollback()
        return False
    finally:
        if conn:
            conn.close()

def update_jobinfo_status(job_id: str, status: str) -> bool:
    """
    Update job status in JOBINFO table
    
    Args:
        job_id: Job ID
        status: New status
        
    Returns:
        True if successful, False otherwise
    """
    try:
        conn = get_db_connection()
        if not conn:
            return False
            
        with conn.cursor() as cursor:
            update_query = """
                UPDATE aspuser.jobinfo 
                SET status = %s 
                WHERE jobid = %s
            """
            
            cursor.execute(update_query, (status[:9], job_id[:17]))
            conn.commit()
            
            if cursor.rowcount > 0:
                logger.info(f"Job status updated: {job_id} -> {status}")
                return True
            else:
                logger.warning(f"Job not found for status update: {job_id}")
                return False
                
    except Exception as e:
        logger.error(f"Error updating job status: {e}")
        if conn:
            conn.rollback()
        return False
    finally:
        if conn:
            conn.close()

def get_jobinfo(job_id: str) -> Optional[Dict[str, Any]]:
    """
    Get job information by job ID
    
    Args:
        job_id: Job ID
        
    Returns:
        Job info dictionary or None if not found
    """
    try:
        conn = get_db_connection()
        if not conn:
            return None
            
        with conn.cursor() as cursor:
            select_query = """
                SELECT jobid, jobname, status, "user", sbmdt
                FROM aspuser.jobinfo 
                WHERE jobid = %s
            """
            
            cursor.execute(select_query, (job_id[:17],))
            result = cursor.fetchone()
            
            if result:
                return {
                    'jobid': result[0].strip(),
                    'jobname': result[1].strip(),
                    'status': result[2].strip(),
                    'user': result[3].strip(),
                    'sbmdt': result[4].strip()
                }
            else:
                return None
                
    except Exception as e:
        logger.error(f"Error getting job info: {e}")
        return None
    finally:
        if conn:
            conn.close()

def get_all_jobs(status_filter: str = None) -> List[Dict[str, Any]]:
    """
    Get all jobs from JOBINFO table
    
    Args:
        status_filter: Optional status filter
        
    Returns:
        List of job info dictionaries
    """
    try:
        conn = get_db_connection()
        if not conn:
            return []
            
        with conn.cursor() as cursor:
            if status_filter:
                select_query = """
                    SELECT jobid, jobname, status, "user", sbmdt
                    FROM aspuser.jobinfo 
                    WHERE status = %s
                    ORDER BY sbmdt DESC
                """
                cursor.execute(select_query, (status_filter[:9],))
            else:
                select_query = """
                    SELECT jobid, jobname, status, "user", sbmdt
                    FROM aspuser.jobinfo 
                    ORDER BY sbmdt DESC
                """
                cursor.execute(select_query)
            
            results = cursor.fetchall()
            jobs = []
            
            for result in results:
                jobs.append({
                    'jobid': result[0].strip(),
                    'jobname': result[1].strip(),
                    'status': result[2].strip(),
                    'user': result[3].strip(),
                    'sbmdt': result[4].strip()
                })
                
            return jobs
                
    except Exception as e:
        logger.error(f"Error getting all jobs: {e}")
        return []
    finally:
        if conn:
            conn.close()

def delete_jobinfo(job_id: str) -> bool:
    """
    Delete job information from JOBINFO table
    
    Args:
        job_id: Job ID
        
    Returns:
        True if successful, False otherwise
    """
    try:
        conn = get_db_connection()
        if not conn:
            return False
            
        with conn.cursor() as cursor:
            delete_query = """
                DELETE FROM aspuser.jobinfo 
                WHERE jobid = %s
            """
            
            cursor.execute(delete_query, (job_id[:17],))
            conn.commit()
            
            if cursor.rowcount > 0:
                logger.info(f"Job info deleted: {job_id}")
                return True
            else:
                logger.warning(f"Job not found for deletion: {job_id}")
                return False
                
    except Exception as e:
        logger.error(f"Error deleting job info: {e}")
        if conn:
            conn.rollback()
        return False
    finally:
        if conn:
            conn.close()

def test_connection():
    """Test database connection"""
    try:
        conn = get_db_connection()
        if conn:
            with conn.cursor() as cursor:
                cursor.execute("SELECT 1")
                result = cursor.fetchone()
                logger.info("Database connection test successful")
                return True
        else:
            logger.error("Database connection test failed")
            return False
    except Exception as e:
        logger.error(f"Database connection test error: {e}")
        return False
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    # Test the database connection
    test_connection()