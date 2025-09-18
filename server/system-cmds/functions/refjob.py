# -*- coding: utf-8 -*-
"""
REFJOB - Job Status Reference Command
ASP compatible job monitoring and library listing functionality
"""

import os
import sys
import json
import datetime
from typing import Dict, List, Optional, Tuple
from .sbmjob import ACTIVE_JOBS
from .job_database import get_active_jobs as db_get_active_jobs

def REFJOB(command: str) -> bool:
    """
    Main REFJOB command entry point
    
    ASP Format: REFJOB [STS={@ALL|@EDT|@STS}] [,VS=n] [,RS=n] [,CP=n]
    
    Args:
        command (str): REFJOB command string
        
    Returns:
        bool: True if successful, False otherwise
    """
    try:
        # Parse command parameters
        params = _parse_refjob_command(command)
        
        # Extract parameters with defaults
        sts_mode = params.get('STS', '@ALL')
        vs = int(params.get('VS', 1))  # View start position (1-based)
        rs = int(params.get('RS', 10)) # Number of records to display
        cp = int(params.get('CP', 1))  # Current page
        
        # Validate parameters
        if sts_mode not in ['@ALL', '@EDT', '@STS']:
            print("エラー: STSパラメータは@ALL、@EDT、@STSのいずれかを指定してください")
            return False
            
        # Display job library list based on mode
        if sts_mode == '@ALL':
            return _display_library_list(vs, rs, cp)
        elif sts_mode == '@EDT':
            return _display_edit_mode(vs, rs, cp)
        elif sts_mode == '@STS':
            return _display_status_mode(vs, rs, cp)
            
        return True
        
    except Exception as e:
        print(f"REFJOB実行エラー: {e}")
        return False

def _parse_refjob_command(command: str) -> Dict[str, str]:
    """
    Parse REFJOB command parameters
    
    Args:
        command (str): Command string
        
    Returns:
        Dict[str, str]: Parsed parameters
    """
    params = {}
    
    # Remove REFJOB from command
    cmd_part = command.strip()
    if cmd_part.upper().startswith('REFJOB'):
        cmd_part = cmd_part[6:].strip()
    
    if not cmd_part:
        return params
    
    # Parse parameters
    parts = cmd_part.split(',')
    for part in parts:
        part = part.strip()
        if '=' in part:
            key, value = part.split('=', 1)
            params[key.strip().upper()] = value.strip()
    
    return params

def _display_library_list(vs: int, rs: int, cp: int) -> bool:
    """
    Display job library list (like ASP library list)
    
    Args:
        vs (int): View start position
        rs (int): Records to display
        cp (int): Current page
        
    Returns:
        bool: True if successful
    """
    try:
        print("REFJOB Yen-Lan        ライブラリリスト")
        print()
        print("ライブラリ名は、以下のように定義されています。")
        print()
        
        # Get active jobs from database
        active_jobs = db_get_active_jobs()
        
        # Get all active jobs and organize by library-like structure
        jobs_by_lib = _organize_jobs_by_library(active_jobs)
        
        # Display library entries
        line_num = 1
        for lib_name, jobs in jobs_by_lib.items():
            if line_num >= vs and line_num < vs + rs:
                print(f"{line_num:2d}. {lib_name:<12} {len(jobs):2d}.     {'TEST' + str(line_num).zfill(3):<10}")
            line_num += 1
            
        # Display active jobs in library format
        print()
        print("アクティブジョブ:")
        job_line = 1
        for job_id, job_info in active_jobs.items():
            if job_line >= vs and job_line < vs + rs:
                status_jp = _get_status_japanese(job_info.status)
                print(f"{job_line:2d}. {job_info.job_name:<12} {status_jp:<8} {job_info.jobq:<10}")
            job_line += 1
            
        if not active_jobs:
            print("現在実行中のジョブはありません。")
        
        # Display pagination info
        total_items = len(jobs_by_lib) + len(active_jobs)
        total_pages = max(1, (total_items + rs - 1) // rs)
        print()
        print(f"ページ {cp}/{total_pages} (全{total_items}件)")
        
        return True
        
    except Exception as e:
        print(f"ライブラリリスト表示エラー: {e}")
        return False

def _display_edit_mode(vs: int, rs: int, cp: int) -> bool:
    """
    Display edit mode jobs
    
    Args:
        vs (int): View start position
        rs (int): Records to display
        cp (int): Current page
        
    Returns:
        bool: True if successful
    """
    try:
        print("REFJOB Yen-Lan        編集モードジョブ一覧")
        print()
        
        # Get active jobs from database
        active_jobs = db_get_active_jobs()
        
        # Filter jobs that are in edit/interactive mode
        edit_jobs = {k: v for k, v in active_jobs.items() 
                    if v.status in ['RUNNING', 'HELD']}
        
        if not edit_jobs:
            print("現在編集中のジョブはありません。")
            return True
            
        # Display header
        print("ジョブ名      状態      キュー       開始時刻")
        print("-" * 50)
        
        # Display jobs
        line_num = 1
        for job_id, job_info in edit_jobs.items():
            if line_num >= vs and line_num < vs + rs:
                status_jp = _get_status_japanese(job_info.status)
                start_time = job_info.start_time.strftime("%H:%M:%S") if job_info.start_time else "---"
                print(f"{job_info.job_name:<12} {status_jp:<8} {job_info.jobq:<10} {start_time}")
            line_num += 1
            
        # Display pagination
        total_pages = max(1, (len(edit_jobs) + rs - 1) // rs)
        print(f"\nページ {cp}/{total_pages} (全{len(edit_jobs)}件)")
        
        return True
        
    except Exception as e:
        print(f"編集モード表示エラー: {e}")
        return False

def _display_status_mode(vs: int, rs: int, cp: int) -> bool:
    """
    Display job status details
    
    Args:
        vs (int): View start position  
        rs (int): Records to display
        cp (int): Current page
        
    Returns:
        bool: True if successful
    """
    try:
        print("REFJOB Yen-Lan        ジョブ状態詳細")
        print()
        
        # Get active jobs from database
        active_jobs = db_get_active_jobs()
        
        if not active_jobs:
            print("現在実行中のジョブはありません。")
            return True
            
        # Display detailed job status table (like ASP manual example)
        print("実行者/実行名                実行名    型  実行時間  実行時間")
        print("(1)                        (2)      (3)   (4)       (5)")
        print("-" * 65)
        
        line_num = 1
        for job_id, job_info in active_jobs.items():
            if line_num >= vs and line_num < vs + rs:
                # Calculate execution time
                exec_time = _calculate_execution_time(job_info)
                job_type = _get_job_type(job_info)
                
                print(f"システム/{job_info.job_name:<12} {job_info.job_name:<8} {job_type} {exec_time:<8} {'---'}")
                
                # Display additional job details
                print(f"  キュー: {job_info.jobq}")
                print(f"  状態: {_get_status_japanese(job_info.status)}")
                print(f"  パラメータ: {job_info.parameters or 'なし'}")
                
                if job_info.start_time:
                    print(f"  開始時刻: {job_info.start_time.strftime('%Y-%m-%d %H:%M:%S')}")
                if job_info.end_time:
                    print(f"  終了時刻: {job_info.end_time.strftime('%Y-%m-%d %H:%M:%S')}")
                    
                print()
            line_num += 1
            
        # Display pagination and summary
        total_pages = max(1, (len(active_jobs) + rs - 1) // rs)
        print(f"ページ {cp}/{total_pages} (全{len(active_jobs)}件)")
        
        return True
        
    except Exception as e:
        print(f"状態詳細表示エラー: {e}")
        return False

def _organize_jobs_by_library(active_jobs: Dict = None) -> Dict[str, List]:
    """
    Organize active jobs by library-like structure
    
    Args:
        active_jobs (Dict): Active jobs dictionary (if None, uses global)
    
    Returns:
        Dict[str, List]: Jobs organized by library
    """
    libs = {}
    
    if active_jobs is None:
        active_jobs = ACTIVE_JOBS
    
    # Create pseudo-library structure based on job names
    for job_id, job_info in active_jobs.items():
        # Extract library name from job name (simulate library organization)
        lib_name = job_info.job_name[:4] + "LIB" if len(job_info.job_name) >= 4 else "SYSLIB"
        
        if lib_name not in libs:
            libs[lib_name] = []
        libs[lib_name].append(job_info)
    
    # Add some standard system libraries if no jobs
    if not libs:
        libs = {
            "TESTLIB": [],
            "SYSLIB": [],
            "WORKLIB": []
        }
    
    return libs

def _get_status_japanese(status: str) -> str:
    """
    Convert job status to Japanese
    
    Args:
        status (str): Job status in English
        
    Returns:
        str: Status in Japanese
    """
    status_map = {
        'PENDING': '待機中',
        'RUNNING': '実行中', 
        'COMPLETED': '完了',
        'ERROR': 'エラー',
        'HELD': '保留中',
        'CANCELLED': '取消済'
    }
    return status_map.get(status, status)

def _get_job_type(job_info) -> str:
    """
    Get job type indicator
    
    Args:
        job_info: Job information object
        
    Returns:
        str: Job type character
    """
    if hasattr(job_info, 'program') and job_info.program:
        if job_info.program.endswith('.java'):
            return 'J'
        elif job_info.program.endswith('.cbl'):
            return 'C'
        elif job_info.program.endswith('.sh'):
            return 'S'
    return 'N'  # Normal/Unknown

def _calculate_execution_time(job_info) -> str:
    """
    Calculate job execution time
    
    Args:
        job_info: Job information object
        
    Returns:
        str: Formatted execution time
    """
    if not job_info.start_time:
        return "00:00:00"
        
    end_time = job_info.end_time or datetime.datetime.now()
    duration = end_time - job_info.start_time
    
    hours = int(duration.total_seconds() // 3600)
    minutes = int((duration.total_seconds() % 3600) // 60)
    seconds = int(duration.total_seconds() % 60)
    
    return f"{hours:02d}:{minutes:02d}:{seconds:02d}"

def list_library_jobs(library: str = None) -> List[Dict]:
    """
    List jobs in a specific library or all libraries
    
    Args:
        library (str, optional): Library name to filter
        
    Returns:
        List[Dict]: List of jobs with details
    """
    try:
        jobs = []
        active_jobs = db_get_active_jobs()
        
        for job_id, job_info in active_jobs.items():
            job_dict = {
                'job_id': job_id,
                'job_name': job_info.job_name,
                'status': job_info.status,
                'queue': job_info.jobq,
                'start_time': job_info.start_time.isoformat() if job_info.start_time else None,
                'end_time': job_info.end_time.isoformat() if job_info.end_time else None,
                'parameters': job_info.parameters,
                'program': getattr(job_info, 'program', None)
            }
            
            # Filter by library if specified
            if library:
                job_lib = job_info.job_name[:4] + "LIB" if len(job_info.job_name) >= 4 else "SYSLIB"
                if job_lib.upper() == library.upper():
                    jobs.append(job_dict)
            else:
                jobs.append(job_dict)
                
        return jobs
        
    except Exception as e:
        print(f"ライブラリジョブ一覧取得エラー: {e}")
        return []

def get_job_details(job_name: str) -> Optional[Dict]:
    """
    Get detailed information about a specific job
    
    Args:
        job_name (str): Name of the job
        
    Returns:
        Optional[Dict]: Job details or None if not found
    """
    try:
        active_jobs = db_get_active_jobs()
        
        for job_id, job_info in active_jobs.items():
            if job_info.job_name == job_name:
                return {
                    'job_id': job_id,
                    'job_name': job_info.job_name,
                    'status': job_info.status,
                    'status_jp': _get_status_japanese(job_info.status),
                    'queue': job_info.jobq,
                    'start_time': job_info.start_time.isoformat() if job_info.start_time else None,
                    'end_time': job_info.end_time.isoformat() if job_info.end_time else None,
                    'execution_time': _calculate_execution_time(job_info),
                    'parameters': job_info.parameters,
                    'program': getattr(job_info, 'program', None),
                    'job_type': _get_job_type(job_info)
                }
        return None
        
    except Exception as e:
        print(f"ジョブ詳細取得エラー: {e}")
        return None

if __name__ == "__main__":
    # Test REFJOB functionality
    if len(sys.argv) > 1:
        command = " ".join(sys.argv[1:])
        success = REFJOB(command)
        sys.exit(0 if success else 1)
    else:
        # Demo mode
        print("REFJOB デモモード")
        print("-" * 30)
        REFJOB("REFJOB STS=@ALL,VS=1,RS=10")