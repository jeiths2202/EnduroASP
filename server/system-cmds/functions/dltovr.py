#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
DLTOVR (Delete Override) Command Implementation with dslock_suite Integration

Handles delete file override commands that integrate with dslock_suite for
distributed file locking and override mapping management.

Usage:
    DLTOVR FILE(logical-name)
    
Example:
    DLTOVR FILE(EMP-FILE)
"""

import os
import sys
import json
import subprocess
import threading
from typing import Dict, Optional, Tuple
from datetime import datetime

# Import override mappings from ovrf module
try:
    from .ovrf import override_mappings, override_locks, mapping_lock, call_dslock_release
    OVRF_AVAILABLE = True
except ImportError:
    # Fallback for standalone execution
    override_mappings = {}
    override_locks = {}
    mapping_lock = threading.Lock()
    OVRF_AVAILABLE = False

# Configuration
DSLOCK_SUITE_PATH = "/home/aspuser/app/ofasp-refactor/dslock_suite"
DSLOCK_CONFIG = {
    "DSIO_ROOT": "/dev/shm",
    "DSIO_ATOMIC": "1",
    "RECFM_FB_NEWLINE": "1",
    "RECFM_VB_NEWLINE": "0"
}

def setup_dslock_environment():
    """Setup environment variables for dslock_suite"""
    for key, value in DSLOCK_CONFIG.items():
        os.environ[key] = value
    
    # Set config path if not already set
    if "DSIO_CONFIG" not in os.environ:
        config_path = os.path.join(DSLOCK_SUITE_PATH, "config", "config.json")
        if os.path.exists(config_path):
            os.environ["DSIO_CONFIG"] = config_path

def call_dslock_release_local(dataset: str) -> Tuple[bool, str]:
    """
    Local implementation of dslock_release call with proper UTF-8 handling
    
    Args:
        dataset: Dataset name to release
        
    Returns:
        Tuple of (success, error_message)
    """
    try:
        print(f"[DLTOVR_DSLOCK] Attempting to release lock: {dataset}")
        
        # Setup environment for dslock_suite
        setup_dslock_environment()
        
        # Build and compile a C program that calls dslock_release
        test_program = f"""
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include "{DSLOCK_SUITE_PATH}/src/include/dslock.h"

int main() {{
    char errbuf[1024];
    memset(errbuf, 0, sizeof(errbuf));
    
    printf("[C_DLTOVR] Attempting to release lock for dataset: {dataset}\\n");
    printf("[C_DLTOVR] PID: %d\\n", getpid());
    
    int result = dslock_release("{dataset}", errbuf, sizeof(errbuf));
    
    printf("[C_DLTOVR] dslock_release returned: %d\\n", result);
    printf("[C_DLTOVR] Error buffer: %s\\n", errbuf);
    
    if (result == 0) {{
        printf("DSLOCK_SUCCESS: Lock released successfully\\n");
        fflush(stdout);
        return 0;
    }} else {{
        printf("DSLOCK_ERROR: %s (code: %d)\\n", errbuf, result);
        fflush(stdout);
        return result;
    }}
}}
"""
        
        # Create temporary C file with unique name
        temp_dir = "/tmp"
        pid = os.getpid()
        timestamp = int(datetime.now().timestamp() * 1000)
        temp_c_file = os.path.join(temp_dir, f"dslock_release_local_{pid}_{timestamp}.c")
        temp_exe_file = os.path.join(temp_dir, f"dslock_release_local_{pid}_{timestamp}")
        
        try:
            print(f"[DLTOVR_DSLOCK] Creating release program: {temp_c_file}")
            
            # Write C source with explicit UTF-8 encoding
            with open(temp_c_file, 'w', encoding='utf-8') as f:
                f.write(test_program)
            
            print(f"[DLTOVR_DSLOCK] Compiling dslock release program...")
            
            # Compile with proper linking
            compile_cmd = [
                "gcc", "-g", "-Wall",
                "-I" + os.path.join(DSLOCK_SUITE_PATH, "src", "include"),
                "-L" + os.path.join(DSLOCK_SUITE_PATH, "build"),
                "-o", temp_exe_file,
                temp_c_file,
                "-ldslock", "-lpthread"
            ]
            
            print(f"[DLTOVR_DSLOCK] Compile command: {' '.join(compile_cmd)}")
            
            compile_result = subprocess.run(compile_cmd, capture_output=True, text=True, encoding='utf-8', cwd=DSLOCK_SUITE_PATH)
            
            if compile_result.returncode != 0:
                error_msg = f"Compilation failed: {compile_result.stderr}"
                print(f"[DLTOVR_DSLOCK] {error_msg}")
                print(f"[DLTOVR_DSLOCK] Stdout: {compile_result.stdout}")
                return False, error_msg
            
            print(f"[DLTOVR_DSLOCK] Compilation successful, executing...")
            
            # Make executable
            os.chmod(temp_exe_file, 0o755)
            
            # Execute with proper environment and UTF-8 encoding
            env = os.environ.copy()
            env.update(DSLOCK_CONFIG)
            
            # Ensure config path is set
            config_path = os.path.join(DSLOCK_SUITE_PATH, "config", "config.json")
            if os.path.exists(config_path):
                env["DSIO_CONFIG"] = config_path
            
            # Set UTF-8 locale environment
            env["LC_ALL"] = "C.UTF-8"
            env["LANG"] = "C.UTF-8"
            
            print(f"[DLTOVR_DSLOCK] Executing release with UTF-8 environment")
            
            exec_result = subprocess.run(
                [temp_exe_file], 
                capture_output=True, 
                text=True, 
                encoding='utf-8',
                errors='replace',  # Handle encoding errors gracefully
                env=env,
                cwd=DSLOCK_SUITE_PATH,
                timeout=10
            )
            
            print(f"[DLTOVR_DSLOCK] Release execution result:")
            print(f"[DLTOVR_DSLOCK] Return code: {exec_result.returncode}")
            print(f"[DLTOVR_DSLOCK] Stdout: {exec_result.stdout}")
            print(f"[DLTOVR_DSLOCK] Stderr: {exec_result.stderr}")
            
            # Check for success in output
            if "DSLOCK_SUCCESS" in exec_result.stdout and exec_result.returncode == 0:
                print(f"[DLTOVR_DSLOCK] Lock release successful for {dataset}")
                return True, ""
            else:
                error_msg = exec_result.stderr or exec_result.stdout or f"Unknown error (code: {exec_result.returncode})"
                print(f"[DLTOVR_DSLOCK] Lock release failed: {error_msg}")
                return False, error_msg
                
        finally:
            # Cleanup temporary files
            for temp_file in [temp_c_file, temp_exe_file]:
                if os.path.exists(temp_file):
                    try:
                        os.remove(temp_file)
                        print(f"[DLTOVR_DSLOCK] Cleaned up: {temp_file}")
                    except Exception as cleanup_e:
                        print(f"[DLTOVR_DSLOCK] Cleanup warning: {cleanup_e}")
                        
    except subprocess.TimeoutExpired:
        return False, "dslock_release timed out"
    except subprocess.SubprocessError as e:
        error_msg = f"dslock_release subprocess error: {str(e)}"
        print(f"[DLTOVR_DSLOCK] {error_msg}")
        return False, error_msg
    except OSError as e:
        error_msg = f"dslock_release file system error: {str(e)}"
        print(f"[DLTOVR_DSLOCK] {error_msg}")
        return False, error_msg
    except UnicodeDecodeError as e:
        error_msg = f"dslock_release UTF-8 decode error: {str(e)}"
        print(f"[DLTOVR_DSLOCK] {error_msg}")
        return False, error_msg
    except Exception as e:
        error_msg = f"dslock_release unexpected error: {str(e)}"
        print(f"[DLTOVR_DSLOCK] {error_msg}")
        return False, error_msg

def parse_dltovr_command(command_line: str) -> Dict[str, str]:
    """
    Parse DLTOVR command line
    
    Args:
        command_line: Command line string
        
    Returns:
        Dictionary of parsed parameters
    """
    params = {}
    
    # Remove command name
    parts = command_line.replace("DLTOVR", "").strip().split()
    
    for part in parts:
        if "(" in part and ")" in part:
            # Extract parameter name and value
            param_name = part.split("(")[0]
            param_value = part.split("(")[1].rstrip(")")
            params[param_name] = param_value
        else:
            # Boolean parameter or keyword
            params[part] = None
    
    return params

def _is_child_process():
    """Check if running in child process context"""
    return os.environ.get('ASP_CHILD_PROCESS') == '1'

def _request_dataset_dealloc_from_parent(logical_name: str) -> Tuple[bool, str]:
    """Request dataset deallocation from parent cmdRunner"""
    try:
        # Import here to avoid circular imports
        sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        from process_comm import get_child_communicator
        
        comm = get_child_communicator()
        
        # Send request
        comm.send_to_parent({
            'type': 'dataset_deallocate',
            'logical_name': logical_name
        })
        
        # Wait for response (with timeout)
        response = comm.receive_from_parent(timeout=5.0)
        if response and response.get('type') == 'dataset_deallocate_response':
            return response.get('success', False), response.get('message', 'No response')
        
        return False, "No response from parent"
        
    except Exception as e:
        return False, f"Parent communication failed: {str(e)}"

def DLTOVR(command_line: str) -> bool:
    """
    Execute DLTOVR (Delete Override) command with dslock_suite integration
    
    Args:
        command_line: Full command line
        
    Returns:
        True if successful, False otherwise
    """
    try:
        print(f"[DLTOVR] Processing: {command_line}")
        
        # Parse command parameters
        params = parse_dltovr_command(command_line)
        
        # Validate required parameters
        if "FILE" not in params:
            print("[ERROR] FILE parameter is required")
            return False
        
        logical_name = params["FILE"]
        print(f"[DLTOVR] Logical file: {logical_name}")
        
        # Note: Previously tried parent-child communication, but direct execution works better
        # Always execute directly for real lock release
        
        # Parent process or standalone execution
        # Check if override mapping exists
        with mapping_lock:
            if logical_name not in override_mappings:
                print(f"[ERROR] No override mapping found for: {logical_name}")
                print(f"[INFO] Available mappings: {list(override_mappings.keys())}")
                return False
            
            # Get mapping info
            mapping_info = override_mappings[logical_name]
            dataset_name = mapping_info.get("dataset_name")
            physical_file = mapping_info.get("physical_file")
            
            print(f"[DLTOVR] Found mapping: {logical_name} -> {physical_file}")
            print(f"[DLTOVR] Dataset name: {dataset_name}")
        
        # Release lock using dslock_suite
        if dataset_name:
            print(f"[DLTOVR] Releasing dslock for dataset: {dataset_name}")
            
            # Use direct call or imported function if available
            if OVRF_AVAILABLE:
                try:
                    from .ovrf import call_dslock_release_direct
                    success, error_msg = call_dslock_release_direct(dataset_name)
                    if not success:
                        print(f"[DLTOVR] Direct call failed, trying imported function: {error_msg}")
                        success, error_msg = call_dslock_release(dataset_name)
                except ImportError:
                    success, error_msg = call_dslock_release(dataset_name)
            else:
                success, error_msg = call_dslock_release_local(dataset_name)
            
            if not success:
                raise RuntimeError(f"Failed to release dslock for {dataset_name}: {error_msg}")
            else:
                print(f"[DLTOVR] Successfully released dslock for: {dataset_name}")
        
        # Remove from override mapping table
        with mapping_lock:
            if logical_name in override_mappings:
                removed_mapping = override_mappings.pop(logical_name)
                print(f"[DLTOVR] Removed mapping: {logical_name}")
                print(f"[DLTOVR] Mapping details: {removed_mapping}")
            
            if logical_name in override_locks:
                override_locks.pop(logical_name)
                print(f"[DLTOVR] Removed lock reference: {logical_name}")
        
        print(f"[DLTOVR] Override deletion completed for: {logical_name}")
        print(f"[DLTOVR] Remaining mappings: {len(override_mappings)}")
        
        return True
        
    except RuntimeError as e:
        print(f"[ERROR] DLTOVR runtime error: {str(e)}")
        raise
    except Exception as e:
        print(f"[ERROR] DLTOVR unexpected error: {str(e)}")
        raise RuntimeError(f"DLTOVR command failed: {str(e)}")

def cleanup_all_overrides() -> int:
    """
    Cleanup all current overrides and release locks
    
    Returns:
        Number of overrides cleaned up
    """
    cleanup_count = 0
    
    try:
        with mapping_lock:
            logical_names = list(override_mappings.keys())
        
        for logical_name in logical_names:
            print(f"[CLEANUP] Processing override: {logical_name}")
            command = f"DLTOVR FILE({logical_name})"
            if DLTOVR(command):
                cleanup_count += 1
            
        print(f"[CLEANUP] Cleaned up {cleanup_count} overrides")
        return cleanup_count
        
    except Exception as e:
        print(f"[ERROR] Exception during cleanup: {str(e)}")
        return cleanup_count

def list_active_overrides() -> Dict:
    """List all active override mappings"""
    with mapping_lock:
        return override_mappings.copy()

def get_override_info(logical_name: str) -> Optional[Dict]:
    """Get information about a specific override mapping"""
    with mapping_lock:
        return override_mappings.get(logical_name)

# Test function
if __name__ == "__main__":
    # Test DLTOVR command
    test_command = "DLTOVR FILE(EMP-FILE)"
    result = DLTOVR(test_command)
    print(f"Test result: {result}")
    
    # Show remaining mappings
    print("Remaining mappings:", list_active_overrides())