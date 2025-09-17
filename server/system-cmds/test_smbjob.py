#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Test script for SMBJOB (Submit Job) command implementation
"""

import os
import sys
import time
import json
from datetime import datetime

# Add the current directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from functions.smbjob import SMBJOB, list_jobs, release_job, cancel_job

def test_smbjob_basic():
    """Test basic SMBJOB functionality"""
    print("\n" + "="*60)
    print("TESTING: Basic SMBJOB functionality")
    print("="*60)
    
    # Test 1: Submit a simple Java job
    print("\n[TEST 1] Submitting Java job...")
    result = SMBJOB("SMBJOB JOB=TEST_JAVA,PGM=CUINP001,@LIB=TESTLIB,PARA=001,ABC,VOL=DISK01")
    print(f"Result: {'SUCCESS' if result else 'FAILED'}")
    
    # Test 2: Submit a job with hold
    print("\n[TEST 2] Submitting held job...")
    result = SMBJOB("SMBJOB JOB=HELD_JOB,PGM=CUINP001,@LIB=TESTLIB,HLDJOB=@YES")
    print(f"Result: {'SUCCESS' if result else 'FAILED'}")
    
    # Test 3: Submit job with priority
    print("\n[TEST 3] Submitting high priority job...")
    result = SMBJOB("SMBJOB JOB=HIGH_PRI,PGM=CUINP001,@LIB=TESTLIB,JOBPTYY=1")
    print(f"Result: {'SUCCESS' if result else 'FAILED'}")
    
    return True

def test_smbjob_errors():
    """Test SMBJOB error handling"""
    print("\n" + "="*60)
    print("TESTING: SMBJOB error handling")
    print("="*60)
    
    # Test 1: Missing JOB parameter
    print("\n[TEST 1] Missing JOB parameter...")
    result = SMBJOB("SMBJOB PGM=CUINP001,@LIB=TESTLIB")
    print(f"Result: {'FAILED (Expected)' if not result else 'UNEXPECTED SUCCESS'}")
    
    # Test 2: Missing PGM parameter
    print("\n[TEST 2] Missing PGM parameter...")
    result = SMBJOB("SMBJOB JOB=TEST_MISSING_PGM,@LIB=TESTLIB")
    print(f"Result: {'FAILED (Expected)' if not result else 'UNEXPECTED SUCCESS'}")
    
    # Test 3: Non-existent program
    print("\n[TEST 3] Non-existent program...")
    result = SMBJOB("SMBJOB JOB=TEST_NOEXIST,PGM=NONEXISTENT,@LIB=TESTLIB")
    print(f"Result: {'FAILED (Expected)' if not result else 'UNEXPECTED SUCCESS'}")
    
    return True

def test_job_management():
    """Test job management functions"""
    print("\n" + "="*60)
    print("TESTING: Job management functions")
    print("="*60)
    
    # Submit a held job first
    print("\n[TEST 1] Submitting held job for management testing...")
    result = SMBJOB("SMBJOB JOB=MGT_TEST,PGM=CUINP001,@LIB=TESTLIB,HLDJOB=@YES")
    
    if result:
        print("Waiting 2 seconds for job to be registered...")
        time.sleep(2)
        
        # List jobs
        print("\n[TEST 2] Listing all jobs...")
        jobs = list_jobs()
        print(f"Found {len(jobs)} jobs:")
        
        held_job_id = None
        for job in jobs:
            print(f"  Job ID: {job['job_id']}, Name: {job['job_name']}, Status: {job['status']}")
            if job['job_name'] == 'MGT_TEST' and job['status'] == 'HELD':
                held_job_id = job['job_id']
        
        # Release held job
        if held_job_id:
            print(f"\n[TEST 3] Releasing held job {held_job_id}...")
            release_result = release_job(held_job_id)
            print(f"Release result: {'SUCCESS' if release_result else 'FAILED'}")
        
        # Cancel a job
        print("\n[TEST 4] Submitting job to cancel...")
        cancel_result = SMBJOB("SMBJOB JOB=CANCEL_TEST,PGM=CUINP001,@LIB=TESTLIB,HLDJOB=@YES")
        if cancel_result:
            time.sleep(1)
            jobs = list_jobs()
            cancel_job_id = None
            for job in jobs:
                if job['job_name'] == 'CANCEL_TEST':
                    cancel_job_id = job['job_id']
                    break
            
            if cancel_job_id:
                print(f"Cancelling job {cancel_job_id}...")
                cancel_result = cancel_job(cancel_job_id)
                print(f"Cancel result: {'SUCCESS' if cancel_result else 'FAILED'}")
    
    return True

def test_fujitsu_formats():
    """Test various ASP parameter formats"""
    print("\n" + "="*60)
    print("TESTING: ASP parameter formats")
    print("="*60)
    
    # Test different parameter combinations
    test_commands = [
        "SMBJOB JOB=FMT_TEST1,PGM=CUINP001,@LIB=TESTLIB",
        "SMBJOB JOB=FMT_TEST2,PGM=CUINP001,@LIB=TESTLIB,PARA=ABC,123",
        "SMBJOB JOB=FMT_TEST3,PGM=CUINP001,@LIB=TESTLIB,JOBQ=@SAME,JOBPTYY=3",
        "SMBJOB JOB=FMT_TEST4,PGM=CUINP001,@LIB=TESTLIB,VOL=DISK01,HLDJOB=@NO"
    ]
    
    for i, cmd in enumerate(test_commands, 1):
        print(f"\n[TEST {i}] Testing format: {cmd}")
        result = SMBJOB(cmd)
        print(f"Result: {'SUCCESS' if result else 'FAILED'}")
    
    return True

def monitor_jobs():
    """Monitor job execution for a short period"""
    print("\n" + "="*60)
    print("MONITORING: Job execution status")  
    print("="*60)
    
    print("Monitoring jobs for 10 seconds...")
    for i in range(10):
        jobs = list_jobs()
        active_jobs = [j for j in jobs if j['status'] in ['PENDING', 'RUNNING']]
        
        if active_jobs:
            print(f"\n[{i+1}/10] Active jobs: {len(active_jobs)}")
            for job in active_jobs:
                print(f"  {job['job_id']}: {job['job_name']} - {job['status']}")
        else:
            print(f"[{i+1}/10] No active jobs")
        
        time.sleep(1)
    
    print("\nFinal job status:")
    jobs = list_jobs()
    for job in jobs:
        print(f"  {job['job_id']}: {job['job_name']} - {job['status']}")
        if job['return_code'] is not None:
            print(f"    Return code: {job['return_code']}")
        if job['log_file']:
            print(f"    Log file: {job['log_file']}")

def main():
    """Main test runner"""
    print("OpenASP SMBJOB Command Test Suite")
    print("Started at:", datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    
    try:
        # Run tests
        test_smbjob_basic()
        test_smbjob_errors() 
        test_fujitsu_formats()
        test_job_management()
        monitor_jobs()
        
        print("\n" + "="*60)
        print("ALL TESTS COMPLETED")
        print("="*60)
        
    except Exception as e:
        print(f"\n[ERROR] Test execution failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()