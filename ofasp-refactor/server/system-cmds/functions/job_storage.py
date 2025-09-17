# -*- coding: utf-8 -*-
"""
Job Storage Module for SMBJOB/REFJOB
Provides persistent storage for job information across process invocations
"""

import os
import json
import fcntl
from datetime import datetime
from typing import Dict, List, Optional

# Job storage file location
JOB_STORAGE_FILE = "/home/aspuser/app/volume/JOBLOG/active_jobs.json"

def _serialize_datetime(obj):
    """Serialize datetime objects for JSON storage"""
    if isinstance(obj, datetime):
        return obj.isoformat()
    raise TypeError(f"Type {type(obj)} not serializable")

def _deserialize_datetime(date_string):
    """Deserialize datetime strings from JSON"""
    if date_string:
        return datetime.fromisoformat(date_string)
    return None

def save_active_jobs(active_jobs: Dict) -> bool:
    """
    Save active jobs dictionary to persistent storage
    
    Args:
        active_jobs (Dict): Dictionary of active jobs
        
    Returns:
        bool: True if successful
    """
    try:
        # Ensure directory exists
        os.makedirs(os.path.dirname(JOB_STORAGE_FILE), exist_ok=True)
        
        # Convert job objects to serializable format
        jobs_data = {}
        for job_id, job_info in active_jobs.items():
            jobs_data[job_id] = {
                'job_id': job_info.job_id,
                'job_name': job_info.job_name,
                'program': job_info.program,
                'library': getattr(job_info, 'library', None),
                'volume': getattr(job_info, 'volume', 'DISK01'),
                'parameters': job_info.parameters,
                'priority': getattr(job_info, 'priority', 5),
                'jobq': job_info.jobq,
                'jobk': getattr(job_info, 'jobk', '@SAME'),
                'hold': getattr(job_info, 'hold', False),
                'status': job_info.status,
                'submitted_time': job_info.submitted_time,
                'start_time': job_info.start_time,
                'end_time': getattr(job_info, 'end_time', None),
                'pid': getattr(job_info, 'pid', None)
            }
        
        # Write to temporary file first for atomicity
        temp_file = JOB_STORAGE_FILE + '.tmp'
        with open(temp_file, 'w', encoding='utf-8') as f:
            json.dump(jobs_data, f, default=_serialize_datetime, indent=2, ensure_ascii=False)
        
        # Rename temporary file to actual file
        os.rename(temp_file, JOB_STORAGE_FILE)
        return True
        
    except Exception as e:
        print(f"Error saving active jobs: {e}")
        return False

def load_active_jobs() -> Dict:
    """
    Load active jobs from persistent storage
    
    Returns:
        Dict: Dictionary of active jobs
    """
    try:
        if not os.path.exists(JOB_STORAGE_FILE):
            return {}
            
        with open(JOB_STORAGE_FILE, 'r', encoding='utf-8') as f:
            # Use file locking to prevent concurrent access issues
            fcntl.flock(f.fileno(), fcntl.LOCK_SH)
            try:
                jobs_data = json.load(f)
            finally:
                fcntl.flock(f.fileno(), fcntl.LOCK_UN)
        
        # Convert back to job objects
        from functions.smbjob import JobInfo
        active_jobs = {}
        
        for job_id, job_data in jobs_data.items():
            # Create JobInfo object with required parameters
            job_info = JobInfo(
                job_id=job_data['job_id'],
                job_name=job_data['job_name'],
                program=job_data['program'],
                library=job_data.get('library'),
                volume=job_data.get('volume', 'DISK01'),
                parameters=job_data.get('parameters', ''),
                priority=job_data.get('priority', 5),
                jobq=job_data.get('jobq', '@SAME'),
                jobk=job_data.get('jobk', '@SAME'),
                hold=job_data.get('hold', False)
            )
            
            # Set additional attributes
            job_info.status = job_data['status']
            job_info.submitted_time = _deserialize_datetime(job_data.get('submitted_time'))
            job_info.start_time = _deserialize_datetime(job_data.get('start_time'))
            job_info.end_time = _deserialize_datetime(job_data.get('end_time'))
            if 'pid' in job_data:
                job_info.pid = job_data['pid']
                
            active_jobs[job_id] = job_info
            
        return active_jobs
        
    except Exception as e:
        print(f"Error loading active jobs: {e}")
        return {}

def add_job(job_id: str, job_info) -> bool:
    """
    Add a job to persistent storage
    
    Args:
        job_id (str): Job ID
        job_info: JobInfo object
        
    Returns:
        bool: True if successful
    """
    try:
        active_jobs = load_active_jobs()
        active_jobs[job_id] = job_info
        return save_active_jobs(active_jobs)
    except Exception as e:
        print(f"Error adding job: {e}")
        return False

def update_job_status(job_id: str, status: str, **kwargs) -> bool:
    """
    Update job status in persistent storage
    
    Args:
        job_id (str): Job ID
        status (str): New status
        **kwargs: Additional attributes to update
        
    Returns:
        bool: True if successful
    """
    try:
        active_jobs = load_active_jobs()
        if job_id in active_jobs:
            active_jobs[job_id].status = status
            
            # Update additional attributes
            for key, value in kwargs.items():
                setattr(active_jobs[job_id], key, value)
                
            return save_active_jobs(active_jobs)
        return False
    except Exception as e:
        print(f"Error updating job status: {e}")
        return False

def remove_job(job_id: str) -> bool:
    """
    Remove a job from persistent storage
    
    Args:
        job_id (str): Job ID
        
    Returns:
        bool: True if successful
    """
    try:
        active_jobs = load_active_jobs()
        if job_id in active_jobs:
            del active_jobs[job_id]
            return save_active_jobs(active_jobs)
        return False
    except Exception as e:
        print(f"Error removing job: {e}")
        return False

def cleanup_completed_jobs(keep_hours: int = 24) -> int:
    """
    Clean up completed jobs older than specified hours
    
    Args:
        keep_hours (int): Number of hours to keep completed jobs
        
    Returns:
        int: Number of jobs cleaned up
    """
    try:
        active_jobs = load_active_jobs()
        current_time = datetime.now()
        jobs_to_remove = []
        
        for job_id, job_info in active_jobs.items():
            if job_info.status in ['COMPLETED', 'ERROR', 'CANCELLED']:
                if job_info.end_time:
                    elapsed_hours = (current_time - job_info.end_time).total_seconds() / 3600
                    if elapsed_hours > keep_hours:
                        jobs_to_remove.append(job_id)
        
        for job_id in jobs_to_remove:
            del active_jobs[job_id]
            
        if jobs_to_remove:
            save_active_jobs(active_jobs)
            
        return len(jobs_to_remove)
        
    except Exception as e:
        print(f"Error cleaning up jobs: {e}")
        return 0