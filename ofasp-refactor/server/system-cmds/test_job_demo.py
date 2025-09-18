#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Job submission and monitoring demonstration
Shows the current implementation status
"""

import os
import sys
import time
import subprocess

def run_command(cmd):
    """Run a command and return output"""
    print(f"\n> {cmd}")
    print("-" * 60)
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    print(result.stdout)
    if result.stderr:
        print(f"STDERR: {result.stderr}")
    return result.returncode == 0

def main():
    print("=" * 70)
    print("ASP JOB SUBMISSION AND MONITORING TEST")
    print("=" * 70)
    
    # Create a test program if it doesn't exist
    test_prog = "/data/assets/PRODLIB/test_job"
    if not os.path.exists(test_prog):
        with open(test_prog, 'w') as f:
            f.write("""#!/bin/bash
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Test job started"
echo "Parameters: $@"
sleep 5
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Test job completed"
exit 0
""")
        os.chmod(test_prog, 0o755)
        print(f"Created test program: {test_prog}")
    
    print("\n1. SUBMITTING NORMAL JOB")
    run_command('python aspcli.py SMBJOB JOB=TEST001,PGM=test_job,PARA="normal test",JOBQ=JOBQ1')
    
    print("\n2. SUBMITTING HELD JOB")
    run_command('python aspcli.py SMBJOB JOB=TEST002,PGM=test_job,PARA="held test",JOBQ=JOBQ2,HLDJOB=@YES')
    
    print("\n3. SUBMITTING PRIORITY JOB")
    run_command('python aspcli.py SMBJOB JOB=TEST003,PGM=test_job,PARA="priority test",JOBQ=JOBQ3,PRIO=1')
    
    print("\n4. CHECKING JOB STATUS - ALL MODE")
    run_command('python aspcli.py REFJOB STS=@ALL')
    
    print("\n5. CHECKING JOB STATUS - EDIT MODE")
    run_command('python aspcli.py REFJOB STS=@EDT')
    
    print("\n6. CHECKING JOB STATUS - STATUS MODE")
    run_command('python aspcli.py REFJOB STS=@STS')
    
    print("\n7. CHECKING JOB LOGS")
    log_dir = "/home/aspuser/app/volume/JOBLOG"
    logs = sorted([f for f in os.listdir(log_dir) if f.startswith('J') and 'TEST00' in f])
    if logs:
        print(f"Found {len(logs)} test job logs:")
        for log in logs[-3:]:  # Show last 3
            print(f"\n--- {log} ---")
            with open(os.path.join(log_dir, log), 'r') as f:
                print(f.read())
    
    print("\n" + "=" * 70)
    print("TEST COMPLETE")
    print("=" * 70)
    
    print("\nNOTE: Currently, ACTIVE_JOBS is not persisted between process invocations.")
    print("Each aspcli.py call runs in a separate process, so REFJOB cannot see")
    print("jobs submitted by SMBJOB in a different process. This would need a")
    print("persistent storage mechanism (database or file) to work properly.")

if __name__ == "__main__":
    main()