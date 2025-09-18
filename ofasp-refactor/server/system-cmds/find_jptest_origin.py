#!/usr/bin/env python3
"""
Script to find the origin of JPTEST_NEW job submissions
"""

import os
import sys
import sqlite3
from datetime import datetime
from contextlib import contextmanager

# Add system-cmds to path for imports
sys.path.append('/home/aspuser/app/server/system-cmds')

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

def analyze_jptest_submissions():
    """Analyze JPTEST_NEW submission patterns"""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Get JPTEST_NEW jobs with detailed info
            cursor.execute('''
                SELECT * FROM jobs 
                WHERE job_name = 'JPTEST_NEW' OR program = 'TESTJP_ASP'
                ORDER BY submitted_time ASC
            ''')
            
            jobs = cursor.fetchall()
            
            print("=== JPTEST_NEW Job Submission Analysis ===")
            print(f"Total JPTEST_NEW jobs found: {len(jobs)}")
            print()
            
            for i, job in enumerate(jobs, 1):
                print(f"Job #{i}:")
                print(f"  Job ID: {job['job_id']}")
                print(f"  Submitted: {job['submitted_time']}")
                print(f"  Status: {job['status']}")
                print(f"  Library: {job['library']}")
                print(f"  Volume: {job['volume']}")
                print(f"  Parameters: {job['parameters']}")
                print(f"  Job Queue: {job['jobq']}")
                print()
            
            # Check if there's a pattern in submission times
            if len(jobs) > 1:
                print("=== Submission Time Analysis ===")
                for i in range(1, len(jobs)):
                    prev_time = datetime.fromisoformat(jobs[i-1]['submitted_time'])
                    curr_time = datetime.fromisoformat(jobs[i]['submitted_time'])
                    diff = curr_time - prev_time
                    print(f"Time between job {i} and {i+1}: {diff}")
                print()
            
            # Check for any automation patterns
            print("=== Looking for Automation Indicators ===")
            
            # Check if all jobs have identical parameters
            if len(jobs) > 1:
                first_job = jobs[0]
                identical_params = all(
                    job['program'] == first_job['program'] and
                    job['library'] == first_job['library'] and
                    job['volume'] == first_job['volume'] and
                    job['parameters'] == first_job['parameters'] and
                    job['jobq'] == first_job['jobq']
                    for job in jobs[1:]
                )
                
                if identical_params:
                    print("✓ All jobs have identical parameters - suggests automated submission")
                else:
                    print("✗ Jobs have different parameters - suggests manual submission")
            
            # Check submission frequency
            if len(jobs) >= 2:
                total_time = datetime.fromisoformat(jobs[-1]['submitted_time']) - datetime.fromisoformat(jobs[0]['submitted_time'])
                avg_interval = total_time / (len(jobs) - 1)
                print(f"Average interval between submissions: {avg_interval}")
                
                if avg_interval.total_seconds() < 300:  # Less than 5 minutes
                    print("⚠ Very frequent submissions - likely automated")
                elif avg_interval.total_seconds() < 3600:  # Less than 1 hour
                    print("⚠ Frequent submissions - possibly automated")
                else:
                    print("ℹ Infrequent submissions - likely manual")
            
            print()
            
    except Exception as e:
        print(f"Error analyzing jobs: {e}")

def check_active_processes():
    """Check for any processes that might be submitting jobs"""
    print("=== Active Process Analysis ===")
    
    # Check if the job processor is running
    try:
        # Import to check if job processor is active
        from functions.sbmjob import ACTIVE_JOBS, JOB_QUEUE
        
        print(f"Active jobs in memory: {len(ACTIVE_JOBS)}")
        print(f"Job queue size: {JOB_QUEUE.qsize()}")
        
        # Check if any jobs are from JPTEST_NEW
        jptest_active = [job for job in ACTIVE_JOBS.values() if job.job_name == 'JPTEST_NEW']
        if jptest_active:
            print(f"JPTEST_NEW jobs currently active: {len(jptest_active)}")
            for job in jptest_active:
                print(f"  {job.job_id}: {job.status}")
        else:
            print("No JPTEST_NEW jobs currently in active memory")
            
    except Exception as e:
        print(f"Error checking active processes: {e}")
    
    print()

def search_for_submission_source():
    """Search for possible sources of job submission"""
    print("=== Searching for Job Submission Sources ===")
    
    # Look for recent command history or logs
    possible_sources = [
        "/home/aspuser/.bash_history",
        "/home/aspuser/.python_history", 
        "/var/log/syslog",
        "/tmp/asp_commands.log",
        "/home/aspuser/app/server/logs/",
        "/home/aspuser/app/volume/logs/"
    ]
    
    for source in possible_sources:
        if os.path.exists(source):
            try:
                if os.path.isfile(source):
                    print(f"Checking {source}...")
                    with open(source, 'r', errors='ignore') as f:
                        content = f.read()
                        if 'JPTEST_NEW' in content or 'TESTJP_ASP' in content or 'SBMJOB' in content:
                            print(f"  ✓ Found relevant content in {source}")
                            # Show last few lines with matches
                            lines = content.split('\n')
                            for i, line in enumerate(lines):
                                if 'JPTEST_NEW' in line or 'TESTJP_ASP' in line or 'SBMJOB' in line:
                                    print(f"    Line {i+1}: {line[:100]}...")
                        else:
                            print(f"  ✗ No relevant content in {source}")
                elif os.path.isdir(source):
                    print(f"Checking directory {source}...")
                    for file in os.listdir(source):
                        if file.endswith('.log'):
                            print(f"  Found log file: {file}")
            except Exception as e:
                print(f"  Error reading {source}: {e}")
        else:
            print(f"  ✗ {source} does not exist")
    
    print()

if __name__ == "__main__":
    print("JPTEST_NEW Job Origin Investigation")
    print("=" * 50)
    print()
    
    analyze_jptest_submissions()
    check_active_processes()
    search_for_submission_source()
    
    print("=== Investigation Complete ===")
    print()
    print("Key Questions to Investigate:")
    print("1. Are these jobs being submitted by a web interface?")
    print("2. Is there an automated script or cron job?")
    print("3. Are they being submitted manually through aspcli.py?")
    print("4. Is there a test or demo script creating them?")