#!/usr/bin/env python3
"""
Script to check for JPTEST_NEW jobs in the database
"""

import sqlite3
import os
from contextlib import contextmanager

JOB_DATABASE_FILE = "/home/aspuser/app/database/openasp_jobs.db"

@contextmanager
def get_db_connection():
    """Get database connection with automatic cleanup"""
    conn = sqlite3.connect(JOB_DATABASE_FILE)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()

def query_jptest_jobs():
    """Query for JPTEST_NEW jobs"""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Search for jobs with JPTEST_NEW name or TESTJP_ASP program
            cursor.execute('''
                SELECT * FROM jobs 
                WHERE job_name LIKE '%JPTEST%' 
                   OR program LIKE '%TESTJP%'
                   OR job_name = 'JPTEST_NEW'
                   OR program = 'TESTJP_ASP'
                ORDER BY submitted_time DESC
            ''')
            
            rows = cursor.fetchall()
            
            if rows:
                print(f"Found {len(rows)} JPTEST_NEW related jobs:")
                print("=" * 80)
                
                for row in rows:
                    print(f"Job ID: {row['job_id']}")
                    print(f"Job Name: {row['job_name']}")
                    print(f"Program: {row['program']}")
                    print(f"Library: {row['library']}")
                    print(f"Volume: {row['volume']}")
                    print(f"Parameters: {row['parameters']}")
                    print(f"Status: {row['status']}")
                    print(f"Submitted: {row['submitted_time']}")
                    print(f"Start Time: {row['start_time']}")
                    print(f"End Time: {row['end_time']}")
                    print(f"PID: {row['pid']}")
                    print(f"Log File: {row['log_file']}")
                    print("-" * 40)
            else:
                print("No JPTEST_NEW related jobs found in database.")
                
            # Also check job history
            print("\nChecking job history:")
            cursor.execute('''
                SELECT h.*, j.job_name, j.program FROM job_history h
                LEFT JOIN jobs j ON h.job_id = j.job_id
                WHERE j.job_name LIKE '%JPTEST%' 
                   OR j.program LIKE '%TESTJP%'
                   OR j.job_name = 'JPTEST_NEW'
                   OR j.program = 'TESTJP_ASP'
                ORDER BY h.timestamp DESC
            ''')
            
            history_rows = cursor.fetchall()
            if history_rows:
                print(f"Found {len(history_rows)} history entries:")
                for row in history_rows:
                    print(f"  {row['timestamp']}: {row['job_name']} ({row['program']}) - {row['status']} - {row['message']}")
            else:
                print("No history entries found for JPTEST_NEW jobs.")
                
    except Exception as e:
        print(f"Error querying database: {e}")

def query_all_recent_jobs():
    """Query all recent jobs to understand submission patterns"""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT job_id, job_name, program, library, status, submitted_time 
                FROM jobs 
                ORDER BY submitted_time DESC 
                LIMIT 20
            ''')
            
            rows = cursor.fetchall()
            
            print(f"\nRecent jobs (last 20):")
            print("=" * 80)
            
            for row in rows:
                print(f"{row['submitted_time']}: {row['job_name']} ({row['program']}) - {row['status']}")
                
    except Exception as e:
        print(f"Error querying recent jobs: {e}")

if __name__ == "__main__":
    print("Checking for JPTEST_NEW jobs in OpenASP job database...")
    query_jptest_jobs()
    query_all_recent_jobs()