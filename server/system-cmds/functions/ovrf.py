#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
OVRF (Override File) Command Implementation with dslock_suite Integration

Handles file override commands that integrate with dslock_suite for
distributed file locking and override mapping management.

Usage:
    OVRF FILE(logical-name) TOFILE(physical-file) TYPE(*DATA)
    
Example:
    OVRF FILE(EMP-FILE) TOFILE(EMPLOYEE.FB.TESTLIB) TYPE(*DATA)
"""

import os
import sys
import json
import subprocess
import threading
import ctypes
from typing import Dict, Optional, Tuple
from datetime import datetime

# Global override mapping table
override_mappings = {}
override_locks = {}
mapping_lock = threading.Lock()

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

def call_dslock_acquire_direct(dataset: str, level: str = "MOD") -> Tuple[bool, str]:
    """
    Call dslock_acquire directly using ctypes to keep lock in same process
    
    Args:
        dataset: Dataset name to lock
        level: Lock level (SHR, OLD, MOD)
        
    Returns:
        Tuple of (success, error_message)
    """
    try:
        print(f"[DSLOCK_DIRECT] Attempting to acquire lock: {dataset} with level {level}")
        
        # Setup environment for dslock_suite
        setup_dslock_environment()
        
        # Load dslock library
        dslock_lib_path = os.path.join(DSLOCK_SUITE_PATH, "build", "libdslock.so")
        if not os.path.exists(dslock_lib_path):
            return False, f"dslock library not found: {dslock_lib_path}"
        
        print(f"[DSLOCK_DIRECT] Loading dslock library: {dslock_lib_path}")
        
        # Load the shared library
        try:
            dslock_lib = ctypes.CDLL(dslock_lib_path)
        except OSError as e:
            return False, f"Failed to load dslock library: {e}"
        
        # Define function signatures
        # int dslock_acquire(const char *dataset, const char *mode, char *errbuf, size_t errbuf_size)
        dslock_lib.dslock_acquire.argtypes = [ctypes.c_char_p, ctypes.c_char_p, ctypes.c_char_p, ctypes.c_size_t]
        dslock_lib.dslock_acquire.restype = ctypes.c_int
        
        # Prepare parameters
        dataset_bytes = dataset.encode('utf-8')
        level_bytes = level.encode('utf-8')
        errbuf = ctypes.create_string_buffer(1024)
        
        print(f"[DSLOCK_DIRECT] Calling dslock_acquire with parameters:")
        print(f"[DSLOCK_DIRECT] - Dataset: {dataset}")
        print(f"[DSLOCK_DIRECT] - Level: {level}")
        print(f"[DSLOCK_DIRECT] - PID: {os.getpid()}")
        
        # Call dslock_acquire
        result = dslock_lib.dslock_acquire(dataset_bytes, level_bytes, errbuf, len(errbuf))
        
        error_msg = errbuf.value.decode('utf-8', errors='replace') if errbuf.value else ""
        
        print(f"[DSLOCK_DIRECT] dslock_acquire returned: {result}")
        print(f"[DSLOCK_DIRECT] Error buffer: '{error_msg}'")
        
        if result == 0:
            print(f"[DSLOCK_DIRECT] Lock acquisition successful for {dataset}")
            return True, ""
        else:
            error_message = f"dslock_acquire failed: {error_msg} (code: {result})"
            print(f"[DSLOCK_DIRECT] {error_message}")
            return False, error_message
            
    except Exception as e:
        error_msg = f"dslock_acquire direct call error: {str(e)}"
        print(f"[DSLOCK_DIRECT] {error_msg}")
        return False, error_msg

def call_dslock_acquire(dataset: str, level: str = "MOD") -> Tuple[bool, str]:
    """
    Call dslock_acquire using same method as test_lock_holder.c
    
    Args:
        dataset: Dataset name to lock
        level: Lock level (SHR, OLD, MOD)
        
    Returns:
        Tuple of (success, error_message)
    """
    try:
        print(f"[DSLOCK] Attempting to acquire lock: {dataset} with level {level}")
        
        # Setup environment for dslock_suite
        setup_dslock_environment()
        
        # Create C program based on test_lock_holder.c methodology
        lock_program = f"""
#include "dsio.h"
#include "dslock.h"
#include "error.h"
#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <unistd.h>

int main(int argc, char* argv[]) {{
    char errbuf[512];
    int rc;
    
    printf("[LOCK] Acquiring {level} lock on {dataset}\\n");
    
    rc = dslock_acquire("{dataset}", "{level}", errbuf, sizeof(errbuf));
    if (rc != DSERR_OK) {{
        if (rc == DSERR_CONFLICT) {{
            fprintf(stderr, "LOCK_CONFLICT: %s\\n", errbuf);
        }} else {{
            fprintf(stderr, "LOCK_ERROR: %s (%s)\\n", ds_strerror_code(rc), errbuf);
        }}
        return 1;
    }}
    
    printf("LOCK_SUCCESS: %d\\n", getpid());
    
    // Hold lock for specified time (default 300 seconds)
    int hold_time = 300;
    if (argc > 1) {{
        hold_time = atoi(argv[1]);
    }}
    
    printf("[LOCK] Holding lock for %d seconds...\\n", hold_time);
    sleep(hold_time);
    
    // Release lock
    rc = dslock_release("{dataset}", errbuf, sizeof(errbuf));
    if (rc == DSERR_OK) {{
        printf("LOCK_RELEASED\\n");
    }} else {{
        fprintf(stderr, "RELEASE_ERROR: %s\\n", errbuf);
    }}
    
    return 0;
}}
"""
        
        # Create temporary C file
        temp_dir = "/tmp"
        pid = os.getpid()
        timestamp = int(datetime.now().timestamp() * 1000)
        temp_c_file = os.path.join(temp_dir, f"dslock_holder_{pid}_{timestamp}.c")
        temp_exe_file = os.path.join(temp_dir, f"dslock_holder_{pid}_{timestamp}")
        
        try:
            print(f"[DSLOCK] Creating lock holder program: {temp_c_file}")
            
            with open(temp_c_file, 'w', encoding='utf-8') as f:
                f.write(lock_program)
            
            print(f"[DSLOCK] Compiling lock holder program...")
            
            # Compile with same flags as test_lock_holder
            compile_cmd = [
                "gcc", "-g", "-Wall",
                "-I" + os.path.join(DSLOCK_SUITE_PATH, "src", "include"),
                "-L" + os.path.join(DSLOCK_SUITE_PATH, "build"),
                "-o", temp_exe_file,
                temp_c_file,
                "-ldslock", "-ldsio", "-lpthread"
            ]
            
            print(f"[DSLOCK] Compile command: {' '.join(compile_cmd)}")
            
            compile_result = subprocess.run(compile_cmd, capture_output=True, text=True, cwd=DSLOCK_SUITE_PATH)
            
            if compile_result.returncode != 0:
                error_msg = f"Compilation failed: {compile_result.stderr}"
                print(f"[DSLOCK] {error_msg}")
                return False, error_msg
            
            print(f"[DSLOCK] Compilation successful, executing...")
            
            # Make executable
            os.chmod(temp_exe_file, 0o755)
            
            # Execute with proper environment
            env = os.environ.copy()
            env.update(DSLOCK_CONFIG)
            
            config_path = os.path.join(DSLOCK_SUITE_PATH, "config", "config.json")
            if os.path.exists(config_path):
                env["DSIO_CONFIG"] = config_path
            
            # Start as background process with 300 second hold time
            exec_result = subprocess.Popen(
                [temp_exe_file, "300"],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                env=env,
                cwd=DSLOCK_SUITE_PATH
            )
            
            # Give it a moment to acquire the lock
            import time
            time.sleep(1)
            
            # Check if process is still running and lock was acquired
            if exec_result.poll() is None:
                print(f"[DSLOCK] Lock holder process started successfully (PID: {exec_result.pid})")
                
                # Store the process handle for later cleanup
                if not hasattr(call_dslock_acquire, '_lock_processes'):
                    call_dslock_acquire._lock_processes = {}
                call_dslock_acquire._lock_processes[dataset] = {
                    'process': exec_result,
                    'temp_files': [temp_c_file, temp_exe_file]
                }
                
                return True, ""
            else:
                # Process terminated quickly, check output
                stdout, stderr = exec_result.communicate()
                error_msg = stderr or stdout or "Lock acquisition failed"
                print(f"[DSLOCK] Lock acquisition failed: {error_msg}")
                return False, error_msg
                
        finally:
            # Only cleanup if process didn't start successfully
            if not hasattr(call_dslock_acquire, '_lock_processes') or dataset not in call_dslock_acquire._lock_processes:
                for temp_file in [temp_c_file, temp_exe_file]:
                    if os.path.exists(temp_file):
                        try:
                            os.remove(temp_file)
                        except Exception:
                            pass
                        
    except Exception as e:
        error_msg = f"dslock_acquire unexpected error: {str(e)}"
        print(f"[DSLOCK] {error_msg}")
        return False, error_msg

def call_dslock_release_direct(dataset: str) -> Tuple[bool, str]:
    """
    Call dslock_release directly using ctypes to keep consistency
    
    Args:
        dataset: Dataset name to release
        
    Returns:
        Tuple of (success, error_message)
    """
    try:
        print(f"[DSLOCK_DIRECT] Attempting to release lock: {dataset}")
        
        # Setup environment for dslock_suite
        setup_dslock_environment()
        
        # Load dslock library
        dslock_lib_path = os.path.join(DSLOCK_SUITE_PATH, "build", "libdslock.so")
        if not os.path.exists(dslock_lib_path):
            return False, f"dslock library not found: {dslock_lib_path}"
        
        print(f"[DSLOCK_DIRECT] Loading dslock library for release: {dslock_lib_path}")
        
        # Load the shared library
        try:
            dslock_lib = ctypes.CDLL(dslock_lib_path)
        except OSError as e:
            return False, f"Failed to load dslock library: {e}"
        
        # Define function signatures
        # int dslock_release(const char *dataset, char *errbuf, size_t errbuf_size)
        dslock_lib.dslock_release.argtypes = [ctypes.c_char_p, ctypes.c_char_p, ctypes.c_size_t]
        dslock_lib.dslock_release.restype = ctypes.c_int
        
        # Prepare parameters
        dataset_bytes = dataset.encode('utf-8')
        errbuf = ctypes.create_string_buffer(1024)
        
        print(f"[DSLOCK_DIRECT] Calling dslock_release with parameters:")
        print(f"[DSLOCK_DIRECT] - Dataset: {dataset}")
        print(f"[DSLOCK_DIRECT] - PID: {os.getpid()}")
        
        # Call dslock_release
        result = dslock_lib.dslock_release(dataset_bytes, errbuf, len(errbuf))
        
        error_msg = errbuf.value.decode('utf-8', errors='replace') if errbuf.value else ""
        
        print(f"[DSLOCK_DIRECT] dslock_release returned: {result}")
        print(f"[DSLOCK_DIRECT] Error buffer: '{error_msg}'")
        
        if result == 0:
            print(f"[DSLOCK_DIRECT] Lock release successful for {dataset}")
            return True, ""
        else:
            error_message = f"dslock_release failed: {error_msg} (code: {result})"
            print(f"[DSLOCK_DIRECT] {error_message}")
            return False, error_message
            
    except Exception as e:
        error_msg = f"dslock_release direct call error: {str(e)}"
        print(f"[DSLOCK_DIRECT] {error_msg}")
        return False, error_msg

def call_dslock_release(dataset: str) -> Tuple[bool, str]:
    """
    Call dslock_release by terminating the lock holder process and cleaning up files
    
    Args:
        dataset: Dataset name to release
        
    Returns:
        Tuple of (success, error_message)
    """
    try:
        print(f"[DSLOCK] Attempting to release lock: {dataset}")
        
        # Check if we have a stored process for this dataset
        if hasattr(call_dslock_acquire, '_lock_processes') and dataset in call_dslock_acquire._lock_processes:
            lock_info = call_dslock_acquire._lock_processes[dataset]
            lock_process = lock_info['process']
            temp_files = lock_info['temp_files']
            
            if lock_process.poll() is None:  # Process is still running
                print(f"[DSLOCK] Terminating lock holder process (PID: {lock_process.pid})")
                lock_process.terminate()
                
                # Wait for process to terminate
                try:
                    lock_process.wait(timeout=5)
                    print(f"[DSLOCK] Process terminated successfully")
                except subprocess.TimeoutExpired:
                    print(f"[DSLOCK] Process didn't terminate gracefully, killing...")
                    lock_process.kill()
                    lock_process.wait()
                    print(f"[DSLOCK] Process killed")
            
            # Cleanup temporary files
            for temp_file in temp_files:
                if os.path.exists(temp_file):
                    try:
                        os.remove(temp_file)
                        print(f"[DSLOCK] Cleaned up: {temp_file}")
                    except Exception as e:
                        print(f"[DSLOCK] Cleanup warning: {e}")
            
            # Remove from tracking
            del call_dslock_acquire._lock_processes[dataset]
            print(f"[DSLOCK] Lock release successful for {dataset}")
            return True, ""
        else:
            print(f"[DSLOCK] No tracked process found for {dataset}")
            # Try to find and kill any lock holder processes for this dataset
            try:
                import signal
                ps_result = subprocess.run(['ps', 'aux'], capture_output=True, text=True)
                for line in ps_result.stdout.split('\n'):
                    if 'dslock_holder' in line and dataset in line:
                        parts = line.split()
                        if len(parts) > 1:
                            pid = int(parts[1])
                            print(f"[DSLOCK] Found orphaned lock holder process PID {pid}, terminating...")
                            os.kill(pid, signal.SIGTERM)
                            print(f"[DSLOCK] Orphaned process terminated")
                            return True, ""
                
                return True, "No active lock process found (already released)"
                
            except Exception as e:
                print(f"[DSLOCK] Error during orphaned process cleanup: {e}")
                return True, "Lock likely already released"
                        
    except subprocess.SubprocessError as e:
        error_msg = f"dslock_release subprocess error: {str(e)}"
        print(f"[DSLOCK] {error_msg}")
        return False, error_msg
    except OSError as e:
        error_msg = f"dslock_release file system error: {str(e)}"
        print(f"[DSLOCK] {error_msg}")
        return False, error_msg
    except Exception as e:
        error_msg = f"dslock_release unexpected error: {str(e)}"
        print(f"[DSLOCK] {error_msg}")
        return False, error_msg

def parse_ovrf_command(command_line: str) -> Dict[str, str]:
    """
    Parse OVRF command line
    
    Args:
        command_line: Command line string
        
    Returns:
        Dictionary of parsed parameters
    """
    params = {}
    
    # Remove command name
    parts = command_line.replace("OVRF", "").strip().split()
    
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

def resolve_physical_filename(tofile: str) -> Tuple[str, Optional[str]]:
    """
    Resolve TOFILE parameter to physical filename and validate against catalog
    
    Args:
        tofile: TOFILE parameter value (e.g., EMPLOYEE.FB.TESTLIB)
        
    Returns:
        Tuple of (physical_file_path, dataset_key) or (tofile, None) if not found
    """
    # Parse format: dataset.library (e.g., EMPLOYEE.FB.TESTLIB)
    parts = tofile.split(".")
    
    if len(parts) >= 2:
        # Extract library (last part) and dataset (everything before)
        library = parts[-1]
        dataset = ".".join(parts[:-1])
        
        print(f"[OVRF] Parsing: library={library}, dataset={dataset}")
        
        # Check catalog for this dataset in the library
        catalog_path = "/home/aspuser/app/config/catalog.json"
        try:
            with open(catalog_path, 'r', encoding='utf-8') as f:
                catalog = json.load(f)
            
            # Look for dataset in DISK01.library
            if "DISK01" in catalog and library in catalog["DISK01"]:
                if dataset in catalog["DISK01"][library]:
                    # Found in catalog, construct physical path
                    volume_path = f"/home/aspuser/app/volume/DISK01/{library}"
                    physical_file = os.path.join(volume_path, dataset)
                    dataset_key = f"DISK01.{library}.{dataset}"
                    
                    print(f"[OVRF] Found in catalog: {dataset_key}")
                    print(f"[OVRF] Physical path: {physical_file}")
                    
                    return physical_file, dataset_key
                else:
                    print(f"[OVRF] Dataset {dataset} not found in library {library}")
            else:
                print(f"[OVRF] Library {library} not found in DISK01")
                
        except Exception as e:
            print(f"[ERROR] Failed to read catalog: {str(e)}")
    
    # Fallback to direct interpretation
    print(f"[OVRF] Using direct interpretation: {tofile}")
    return tofile, None

def _is_child_process():
    """Check if running in child process context"""
    return os.environ.get('ASP_CHILD_PROCESS') == '1'

def _request_dataset_from_parent(logical_name: str, physical_file: str) -> Tuple[bool, str]:
    """Request dataset allocation from parent cmdRunner"""
    try:
        # Import here to avoid circular imports
        sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        from process_comm import get_child_communicator
        
        comm = get_child_communicator()
        
        # Send request
        comm.send_to_parent({
            'type': 'dataset_allocate',
            'logical_name': logical_name,
            'physical_file': physical_file
        })
        
        # Wait for response (with timeout)
        response = comm.receive_from_parent(timeout=5.0)
        if response and response.get('type') == 'dataset_allocate_response':
            return response.get('success', False), response.get('message', 'No response')
        
        return False, "No response from parent"
        
    except Exception as e:
        return False, f"Parent communication failed: {str(e)}"

def OVRF(command_line: str) -> bool:
    """
    Execute OVRF (Override File) command with dslock_suite integration
    
    Args:
        command_line: Full command line
        
    Returns:
        True if successful, False otherwise
    """
    try:
        print(f"[OVRF] Processing: {command_line}")
        
        # Parse command parameters
        params = parse_ovrf_command(command_line)
        
        # Validate required parameters
        if "FILE" not in params:
            print("[ERROR] FILE parameter is required")
            return False
            
        if "TOFILE" not in params:
            print("[ERROR] TOFILE parameter is required")
            return False
        
        logical_name = params["FILE"]
        physical_file = params["TOFILE"]
        override_type = params.get("TYPE", "*DATA")
        
        print(f"[OVRF] Logical: {logical_name}, Physical: {physical_file}, Type: {override_type}")
        
        # Note: Previously tried parent-child communication, but direct execution works better
        # Always execute directly for real lock acquisition
        
        # Parent process or standalone execution
        # Resolve physical filename and get dataset key
        resolved_physical, dataset_key = resolve_physical_filename(physical_file)
        print(f"[OVRF] Resolved physical path: {resolved_physical}")
        
        # Check if physical file exists
        if not os.path.exists(resolved_physical):
            print(f"[ERROR] Physical file does not exist: {resolved_physical}")
            return False
        
        # Use dataset key for dslock if available, otherwise fallback to original name
        if dataset_key:
            # Convert DISK01.TESTLIB.EMPLOYEE.FB to DISK01/TESTLIB/EMPLOYEE.FB
            parts = dataset_key.split(".")
            if len(parts) >= 3:
                volume = parts[0]
                library = parts[1]
                dataset = ".".join(parts[2:])
                dataset_name = f"{volume}/{library}/{dataset}"
            else:
                dataset_name = dataset_key.replace(".", "/")
        else:
            dataset_name = physical_file.replace(".", "/")
        
        print(f"[OVRF] Acquiring dslock for dataset: {dataset_name}")
        
        try:
            # Use test_lock_holder methodology for real locks
            success, error_msg = call_dslock_acquire(dataset_name, "MOD")
                
            if not success:
                raise RuntimeError(f"Failed to acquire dslock for {dataset_name}: {error_msg}")
        except Exception as e:
            print(f"[ERROR] dslock acquisition failed: {str(e)}")
            raise
        
        print(f"[OVRF] Successfully acquired dslock for: {dataset_name}")
        
        # Add to override mapping table
        with mapping_lock:
            override_mappings[logical_name] = {
                "physical_file": physical_file,
                "resolved_path": resolved_physical,
                "dataset_key": dataset_key,
                "dataset_name": dataset_name,
                "type": override_type,
                "created": datetime.now().isoformat(),
                "pid": os.getpid()
            }
            
            override_locks[logical_name] = dataset_name
            
            # Save mappings to persistent file for cross-process access
            _save_mappings_to_file()
        
        print(f"[OVRF] Override mapping created: {logical_name} -> {physical_file}")
        print(f"[OVRF] Current mappings: {len(override_mappings)}")
        
        return True
        
    except RuntimeError as e:
        print(f"[ERROR] OVRF runtime error: {str(e)}")
        raise
    except Exception as e:
        print(f"[ERROR] OVRF unexpected error: {str(e)}")
        raise RuntimeError(f"OVRF command failed: {str(e)}")

def get_override_mappings() -> Dict:
    """Get current override mappings"""
    with mapping_lock:
        return override_mappings.copy()

def get_override_locks() -> Dict:
    """Get current override locks"""
    with mapping_lock:
        return override_locks.copy()

def _save_mappings_to_file():
    """Save current mappings to a persistent file for cross-process access"""
    try:
        import json
        import os
        
        # Ensure directory exists
        persistent_dir = "/tmp/dslock_java_runtime"
        if not os.path.exists(persistent_dir):
            os.makedirs(persistent_dir, exist_ok=True)
        
        # Save to persistent file
        persistent_file = os.path.join(persistent_dir, "ovrf_mappings.json")
        
        mappings_data = {
            "timestamp": datetime.now().isoformat(),
            "mappings": override_mappings.copy(),
            "locks": override_locks.copy(),
            "pid": os.getpid()
        }
        
        with open(persistent_file, 'w') as f:
            json.dump(mappings_data, f, indent=2)
        
        print(f"[OVRF] Saved mappings to persistent file: {persistent_file}")
        
    except Exception as e:
        print(f"[OVRF] Warning: Failed to save mappings to file: {e}")

def load_mappings_from_file() -> Dict:
    """Load mappings from persistent file"""
    try:
        import json
        persistent_file = "/tmp/dslock_java_runtime/ovrf_mappings.json"
        
        if os.path.exists(persistent_file):
            with open(persistent_file, 'r') as f:
                data = json.load(f)
                return data.get('mappings', {})
        
    except Exception as e:
        print(f"[OVRF] Warning: Failed to load mappings from file: {e}")
    
    return {}

# Test function
if __name__ == "__main__":
    # Test OVRF command
    test_command = "OVRF FILE(EMP-FILE) TOFILE(EMPLOYEE.FB.TESTLIB) TYPE(*DATA)"
    result = OVRF(test_command)
    print(f"Test result: {result}")
    
    # Show mappings
    print("Current mappings:", get_override_mappings())