# -*- coding: utf-8 -*-
"""
CALL (Call Program) Command Implementation for OpenASP

Based on Fujitsu ASP CALL command specifications.
Executes programs in various languages with SMED map integration.
"""

import os
import sys
import json
import subprocess
import re
import logging
import signal
import time
from datetime import datetime
from typing import Dict, List, Tuple, Optional, Any

# 통합 로깅 설정 - API 서버와 동일한 로그 파일 사용
log_file = '/home/aspuser/app/server/api_server.log'
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
    handlers=[
        logging.FileHandler(log_file, encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger('call')

# Import from parent module
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from asp_commands import VOLUME_ROOT, get_catalog_info, set_pgmec, reset_pgmec

# Import dslock Java interface for override mappings
try:
    from dslock_java_interface import prepare_java_environment, export_override_mappings
    DSLOCK_JAVA_AVAILABLE = True
except ImportError:
    DSLOCK_JAVA_AVAILABLE = False

# PID tracking for call.py spawned processes
CALL_PID_DIR = os.environ.get('ASP_PID_DIR', '/tmp/asp_call_pids')

def _ensure_pid_dir():
    """Ensure PID tracking directory exists"""
    if not os.path.exists(CALL_PID_DIR):
        os.makedirs(CALL_PID_DIR, exist_ok=True)

def _register_process_pid(pid: int, program: str, library: str, volume: str):
    """Register a process PID for cleanup tracking"""
    _ensure_pid_dir()
    pid_file = os.path.join(CALL_PID_DIR, f"{pid}.json")
    
    pid_data = {
        'pid': pid,
        'program': program,
        'library': library,
        'volume': volume,
        'created': datetime.now().isoformat(),
        'source': 'call.py'
    }
    
    with open(pid_file, 'w') as f:
        json.dump(pid_data, f)
    
    print(f"[PID_TRACK] Registered process PID {pid} for {program}")

def _unregister_process_pid(pid: int):
    """Remove process PID from tracking"""
    pid_file = os.path.join(CALL_PID_DIR, f"{pid}.json")
    if os.path.exists(pid_file):
        os.remove(pid_file)
        print(f"[PID_TRACK] Unregistered process PID {pid}")

def _terminate_process_gracefully(process, timeout_seconds=5):
    """Terminate process gracefully with fallback to force kill"""
    if not process or process.poll() is not None:
        return True
    
    try:
        print(f"[TERM] Sending SIGTERM to PID {process.pid}")
        process.terminate()
        
        # Wait for graceful termination
        try:
            process.wait(timeout=timeout_seconds)
            print(f"[TERM] Process {process.pid} terminated gracefully")
            return True
        except subprocess.TimeoutExpired:
            print(f"[TERM] Process {process.pid} did not terminate gracefully, forcing kill")
            process.kill()
            process.wait(timeout=2)
            print(f"[TERM] Process {process.pid} force killed")
            return True
            
    except Exception as e:
        print(f"[TERM] Error terminating process {process.pid}: {e}")
        return False

def CALL(command: str) -> bool:
    """
    CALL command - Call Program with enhanced debug logging
    
    Enhanced CALL command following Fujitsu ASP manual format.
    Format: CALL PGM-<program>[.<library>][,PARA-(<parameters>)][,VOL-<volume>]
    
    Args:
        command: Full CALL command string
        
    Returns:
        True if successful, False otherwise
    """
    try:
        print(f"[CALL_TRACE] === CALL Function Start ===")
        print(f"[CALL_TRACE] Timestamp: {datetime.now()}")
        print(f"[CALL_DEBUG] Input command: '{command}'")
        
        reset_pgmec()
        print(f"[CALL_DEBUG] PGMEC reset complete")
        
        # Parse CALL command
        command_str = command.replace('CALL ', '').strip()
        print(f"[CALL_DEBUG] Stripped command: '{command_str}'")
        
        # Parse parameters
        program = None
        library = None
        volume = "DISK01"  # Default volume
        parameters = ""
        
        print(f"[CALL_TRACE] Starting command parsing...")
        
        # Split by comma, but handle nested parentheses in PARA parameter
        parts = []
        current_part = ""
        paren_count = 0
        
        print(f"[CALL_DEBUG] Parsing command string character by character...")
        for i, char in enumerate(command_str):
            if char == '(':
                paren_count += 1
            elif char == ')':
                paren_count -= 1
            elif char == ',' and paren_count == 0:
                parts.append(current_part.strip())
                print(f"[CALL_DEBUG] Found part: '{current_part.strip()}'")
                current_part = ""
                continue
            current_part += char
        
        if current_part.strip():
            parts.append(current_part.strip())
            print(f"[CALL_DEBUG] Final part: '{current_part.strip()}'")
        
        print(f"[CALL_DEBUG] Total parts found: {len(parts)}")
        for i, part in enumerate(parts):
            print(f"[CALL_DEBUG] Part {i}: '{part}'")
        
        # Process each part
        print(f"[CALL_TRACE] Processing command parts...")
        for part in parts:
            print(f"[CALL_DEBUG] Processing part: '{part}'")
            if part.startswith('PGM-'):
                pgm_spec = part[4:]  # Remove 'PGM-'
                print(f"[CALL_DEBUG] PGM specification: '{pgm_spec}'")
                if '.' in pgm_spec:
                    program, library = pgm_spec.split('.', 1)
                    print(f"[CALL_DEBUG] Extracted program: '{program}', library: '{library}'")
                else:
                    program = pgm_spec
                    print(f"[CALL_DEBUG] Extracted program: '{program}' (no library)")
            elif part.startswith('PARA-(') and part.endswith(')'):
                parameters = part[6:-1]  # Remove 'PARA-(' and ')'
                print(f"[CALL_DEBUG] Extracted parameters: '{parameters}'")
            elif part.startswith('VOL-'):
                volume = part[4:]  # Remove 'VOL-'
                print(f"[CALL_DEBUG] Extracted volume: '{volume}'")
            else:
                print(f"[CALL_DEBUG] Unrecognized part: '{part}'")
        
        print(f"[CALL_DEBUG] Final parsed values:")
        print(f"[CALL_DEBUG] - Program: '{program}'")
        print(f"[CALL_DEBUG] - Library: '{library}'")
        print(f"[CALL_DEBUG] - Volume: '{volume}'")
        print(f"[CALL_DEBUG] - Parameters: '{parameters}'")
        
        if not program:
            print("[CALL_ERROR] PGM parameter is required.")
            print("[ERROR] PGM parameter is required.")
            print("[USAGE] CALL PGM-<program>[.<library>][,PARA-(<parameters>)][,VOL-<volume>]")
            set_pgmec(999)
            print(f"[CALL_TRACE] === CALL Function End (no program) ===")
            return False
        
        print(f"[INFO] Calling program: {program}")
        print(f"[INFO] Library: {library if library else 'Auto-detect'}")
        print(f"[INFO] Volume: {volume}")
        print(f"[INFO] Parameters: {parameters if parameters else 'None'}")
        
        # Find program library if not specified
        if not library:
            print(f"[CALL_TRACE] Auto-detecting library for program '{program}'")
            library = _find_program_library(volume, program)
            if not library:
                print(f"[CALL_ERROR] Program '{program}' not found in any library on volume '{volume}'.")
                print(f"[ERROR] Program '{program}' not found in any library on volume '{volume}'.")
                set_pgmec(999)
                print(f"[CALL_TRACE] === CALL Function End (library not found) ===")
                return False
            print(f"[CALL_DEBUG] Program found in library: {library}")
            print(f"[INFO] Program found in library: {library}")
        
        # Get program information from catalog
        print(f"[CALL_TRACE] Loading catalog information...")
        catalog = get_catalog_info()
        print(f"[CALL_DEBUG] Catalog loaded, checking registration...")
        
        if (volume not in catalog or library not in catalog[volume] or 
            program not in catalog[volume][library]):
            print(f"[CALL_ERROR] Program '{program}' not registered in catalog.json")
            print(f"[CALL_DEBUG] Catalog check failed:")
            print(f"[CALL_DEBUG] - Volume '{volume}' in catalog: {volume in catalog}")
            if volume in catalog:
                print(f"[CALL_DEBUG] - Library '{library}' in volume: {library in catalog[volume]}")
                if library in catalog[volume]:
                    print(f"[CALL_DEBUG] - Program '{program}' in library: {program in catalog[volume][library]}")
            print(f"[ERROR] Program '{program}' not registered in catalog.json")
            set_pgmec(999)
            print(f"[CALL_TRACE] === CALL Function End (not in catalog) ===")
            return False
        
        program_info = catalog[volume][library][program]
        print(f"[CALL_DEBUG] Program info retrieved: {program_info}")
        
        if program_info.get('TYPE') != 'PGM':
            print(f"[CALL_ERROR] '{program}' is not a program (TYPE: {program_info.get('TYPE', 'Unknown')})")
            print(f"[ERROR] '{program}' is not a program (TYPE: {program_info.get('TYPE', 'Unknown')})")
            set_pgmec(999)
            print(f"[CALL_TRACE] === CALL Function End (not a program) ===")
            return False
        
        pgm_type = program_info.get('PGMTYPE', 'UNKNOWN').upper()
        print(f"[CALL_DEBUG] Program type: {pgm_type}")
        print(f"[INFO] Program type: {pgm_type}")
        
        # Execute program based on type
        print(f"[CALL_TRACE] Executing program based on type: {pgm_type}")
        result = False
        if pgm_type == 'JAVA':
            print(f"[CALL_DEBUG] Calling _call_java_program...")
            result = _call_java_program(volume, library, program, program_info, parameters)
        elif pgm_type == 'COBOL':
            print(f"[CALL_DEBUG] Calling _call_cobol_program...")
            result = _call_cobol_program(volume, library, program, program_info, parameters)
        elif pgm_type == 'SHELL':
            print(f"[CALL_DEBUG] Calling _call_shell_program...")
            result = _call_shell_program(volume, library, program, program_info, parameters)
        elif pgm_type == 'PYTHON':
            print(f"[CALL_DEBUG] Calling _call_python_program...")
            result = _call_python_program(volume, library, program, program_info, parameters)
        elif pgm_type == 'CL':
            print(f"[CALL_DEBUG] Calling _call_cl_program...")
            result = _call_cl_program(volume, library, program, program_info, parameters)
        else:
            print(f"[CALL_ERROR] Unsupported program type: {pgm_type}")
            print(f"[ERROR] Unsupported program type: {pgm_type}")
            set_pgmec(999)
            print(f"[CALL_TRACE] === CALL Function End (unsupported type) ===")
            return False
        
        print(f"[CALL_DEBUG] Program execution result: {result}")
        print(f"[CALL_TRACE] === CALL Function End (success={result}) ===")
        return result
        
    except Exception as e:
        print(f"[CALL_ERROR] CALL command exception: {e}")
        print(f"[ERROR] CALL command failed: {e}")
        import traceback
        traceback.print_exc()
        set_pgmec(999)
        print(f"[CALL_TRACE] === CALL Function End (exception) ===")
        return False

def _find_program_library(volume: str, program: str) -> Optional[str]:
    """Find which library contains the specified program"""
    try:
        catalog = get_catalog_info()
        if volume in catalog:
            for lib_name, lib_content in catalog[volume].items():
                if program in lib_content and lib_content[program].get('TYPE') == 'PGM':
                    return lib_name
    except Exception as e:
        print(f"[DEBUG] Library search error: {e}")
    return None

def _call_java_program(volume: str, library: str, program: str, 
                      program_info: Dict[str, Any], parameters: str) -> bool:
    """Execute Java program with SMED map integration"""
    try:
        program_path = os.path.join(VOLUME_ROOT, volume, library)
        
        # Determine Java execution method
        jar_file = program_info.get('JARFILE')
        class_file = program_info.get('CLASSFILE')
        pgm_name = program_info.get('PGMNAME', program)
        
        if jar_file:
            # Execute JAR file
            jar_path = os.path.join(program_path, jar_file)
            if not os.path.exists(jar_path):
                print(f"[ERROR] JAR file not found: {jar_path}")
                set_pgmec(999)
                return False
            
            cmd = ['java', '-Dfile.encoding=UTF-8', '-jar', jar_path]
        elif class_file:
            # Execute class file
            class_path = os.path.join(program_path, class_file)
            if not os.path.exists(class_path):
                print(f"[ERROR] Class file not found: {class_path}")
                set_pgmec(999)
                return False
            
            # Extract class name from path
            class_name = class_file.replace('/', '.').replace('.class', '')
            cmd = ['java', '-Dfile.encoding=UTF-8', '-cp', program_path, class_name]
        else:
            # Use program name directly
            cmd = ['java', '-Dfile.encoding=UTF-8', '-cp', program_path, pgm_name]
        
        # Add parameters if provided
        if parameters:
            param_list = _parse_parameters(parameters)
            cmd.extend(param_list)
        
        print(f"[INFO] Executing Java command: {' '.join(cmd)}")
        
        # Prepare input JSON for Java program
        input_json = json.dumps({
            "program": program,
            "library": library,
            "volume": volume,
            "user": "system"  # Default user
        })
        
        # Execute the Java program with environment variables
        try:
            # Get current environment and add ASP-specific variables
            if DSLOCK_JAVA_AVAILABLE:
                print(f"[CALL_DEBUG] Preparing dslock Java environment...")
                env = prepare_java_environment()
                print(f"[CALL_DEBUG] dslock environment prepared with {len(env)} variables")
            else:
                print(f"[CALL_DEBUG] dslock Java interface not available, using standard environment")
                env = os.environ.copy()
            
            # Add ASP-specific variables
            env['ASP_VOLUME'] = volume
            env['ASP_LIBRARY'] = library
            env['ASP_PROGRAM'] = program
            
            # Pass terminal ID if available from parent environment
            if 'ASP_TERMINAL_ID' in os.environ:
                env['ASP_TERMINAL_ID'] = os.environ['ASP_TERMINAL_ID']
                print(f"[CALL_DEBUG] Passing ASP_TERMINAL_ID to Java: {os.environ['ASP_TERMINAL_ID']}")
            
            # Export override mappings for Java program access
            if DSLOCK_JAVA_AVAILABLE:
                mapping_file = export_override_mappings()
                if mapping_file:
                    print(f"[CALL_DEBUG] Override mappings exported to: {mapping_file}")
                else:
                    print(f"[CALL_DEBUG] No override mappings to export")
            
            # Execute Java program with PID tracking
            print(f"[JAVA_EXEC] Starting Java process: {' '.join(cmd)}")
            
            with open(log_file, 'a', encoding='utf-8') as log_f:
                log_f.write(f"\n=== {program} Java Execution Log ({datetime.now().strftime('%Y-%m-%d %H:%M:%S')}) ===\n")
                log_f.flush()
                
                # Use Popen for better process control
                process = subprocess.Popen(
                    cmd,
                    stdin=subprocess.PIPE,
                    stdout=log_f,
                    stderr=subprocess.STDOUT,
                    text=True,
                    cwd=program_path,
                    env=env,
                    encoding='utf-8'
                )
                
                # Register PID for cleanup tracking
                _register_process_pid(process.pid, program, library, volume)
                
                try:
                    # Send input and wait with timeout
                    stdout, stderr = process.communicate(input=input_json, timeout=60)
                    return_code = process.returncode
                    
                    log_f.write(f"\n=== {program} Execution Completed (Return Code: {return_code}) ===\n")
                    log_f.flush()
                    
                    # Unregister PID on successful completion
                    _unregister_process_pid(process.pid)
                    
                    print(f"[JAVA_EXEC] Process {process.pid} completed with return code: {return_code}")
                    
                    # Create result object to maintain compatibility
                    class ProcessResult:
                        def __init__(self, returncode, stdout="", stderr=""):
                            self.returncode = returncode
                            self.stdout = stdout
                            self.stderr = stderr
                    
                    result = ProcessResult(return_code, "", "")
                    
                except subprocess.TimeoutExpired:
                    print(f"[JAVA_EXEC] Process {process.pid} timed out, terminating...")
                    log_f.write(f"\n=== {program} Execution TIMED OUT after 60 seconds ===\n")
                    log_f.flush()
                    
                    # Graceful termination with fallback to force kill
                    if _terminate_process_gracefully(process):
                        _unregister_process_pid(process.pid)
                    
                    raise subprocess.TimeoutExpired(cmd, 60)
            
            print(f"[INFO] Java program executed")
            print(f"[INFO] Return code: {result.returncode}")
            
            if result.stdout:
                print(f"[OUTPUT] {result.stdout}")
                # Process output for SMED integration
                _process_java_output(result.stdout, volume, library, program)
            
            if result.stderr:
                print(f"[ERROR] {result.stderr}")
            
            if result.returncode != 0:
                set_pgmec(result.returncode)
                return False
            
            return True
            
        except subprocess.TimeoutExpired:
            print("[ERROR] Java program execution timed out")
            set_pgmec(999)
            return False
        except Exception as e:
            print(f"[ERROR] Java execution failed: {e}")
            set_pgmec(999)
            return False
        
    except Exception as e:
        print(f"[ERROR] Java program call failed: {e}")
        set_pgmec(999)
        return False

def _call_cobol_program(volume: str, library: str, program: str, 
                       program_info: Dict[str, Any], parameters: str) -> bool:
    """Execute COBOL program (placeholder)"""
    print("[INFO] COBOL program execution not yet implemented")
    print(f"[INFO] Program: {program}")
    print(f"[INFO] Parameters: {parameters}")
    return True

def _call_shell_program(volume: str, library: str, program: str, 
                       program_info: Dict[str, Any], parameters: str) -> bool:
    """Execute Shell script program"""
    try:
        program_path = os.path.join(VOLUME_ROOT, volume, library)
        shell_file = program_info.get('SHELLFILE', f"{program}.sh")
        shell_path = os.path.join(program_path, shell_file)
        
        if not os.path.exists(shell_path):
            print(f"[ERROR] Shell file not found: {shell_path}")
            set_pgmec(999)
            return False
        
        # Make shell file executable
        os.chmod(shell_path, 0o755)
        
        # Prepare command
        cmd = ['bash', shell_path]
        
        # Add parameters
        if parameters:
            param_list = _parse_parameters(parameters)
            cmd.extend(param_list)
        
        print(f"[INFO] Executing shell command: {' '.join(cmd)}")
        
        # Set environment variables
        env = os.environ.copy()
        env['ASP_VOLUME'] = volume
        env['ASP_LIBRARY'] = library
        env['ASP_PROGRAM'] = program
        
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, 
                                  cwd=program_path, env=env, timeout=30)
            
            print(f"[INFO] Shell program executed")
            print(f"[INFO] Return code: {result.returncode}")
            
            if result.stdout:
                print(f"[OUTPUT] {result.stdout}")
            
            if result.stderr:
                print(f"[ERROR] {result.stderr}")
            
            if result.returncode != 0:
                set_pgmec(result.returncode)
                return False
            
            return True
            
        except subprocess.TimeoutExpired:
            print("[ERROR] Shell program execution timed out")
            set_pgmec(999)
            return False
        except Exception as e:
            print(f"[ERROR] Shell execution failed: {e}")
            set_pgmec(999)
            return False
        
    except Exception as e:
        print(f"[ERROR] Shell program call failed: {e}")
        set_pgmec(999)
        return False

def _call_python_program(volume: str, library: str, program: str, 
                        program_info: Dict[str, Any], parameters: str) -> bool:
    """Execute Python script program"""
    try:
        program_path = os.path.join(VOLUME_ROOT, volume, library)
        python_file = program_info.get('PYTHONFILE', f"{program}.py")
        python_path = os.path.join(program_path, python_file)
        
        if not os.path.exists(python_path):
            print(f"[ERROR] Python file not found: {python_path}")
            set_pgmec(999)
            return False
        
        # Prepare command
        cmd = ['python3', python_path]
        
        # Add parameters
        if parameters:
            param_list = _parse_parameters(parameters)
            cmd.extend(param_list)
        
        print(f"[INFO] Executing Python command: {' '.join(cmd)}")
        
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, 
                                  cwd=program_path, timeout=30)
            
            print(f"[INFO] Python program executed")
            print(f"[INFO] Return code: {result.returncode}")
            
            if result.stdout:
                print(f"[OUTPUT] {result.stdout}")
            
            if result.stderr:
                print(f"[ERROR] {result.stderr}")
            
            if result.returncode != 0:
                set_pgmec(result.returncode)
                return False
            
            return True
            
        except subprocess.TimeoutExpired:
            print("[ERROR] Python program execution timed out")
            set_pgmec(999)
            return False
        except Exception as e:
            print(f"[ERROR] Python execution failed: {e}")
            set_pgmec(999)
            return False
        
    except Exception as e:
        print(f"[ERROR] Python program call failed: {e}")
        set_pgmec(999)
        return False

def _parse_parameters(param_string: str) -> List[str]:
    """Parse parameter string into list of arguments"""
    try:
        # Simple parameter parsing - can be enhanced as needed
        if not param_string:
            return []
        
        # Handle comma-separated parameters
        params = []
        for param in param_string.split(','):
            param = param.strip()
            if param:
                params.append(param)
        
        return params
        
    except Exception as e:
        print(f"[DEBUG] Parameter parsing error: {e}")
        return []

def _process_java_output(output: str, volume: str, library: str, program: str) -> None:
    """Process Java program output for direct WebSocket Hub integration"""
    try:
        import socketio
        import requests
        
        # Check if program is waiting for input
        if "Waiting for user input from SMED map" in output:
            print(f"[SMED_INPUT] Program {program} is waiting for user input")
            print(f"[SMED_INPUT] Input file: /tmp/{program.lower()}_input.txt")
            print(f"[SMED_INPUT] WebSocket Hub should write user input to this file")
            
            # Create a simple mechanism for input handling
            _setup_smed_input_handler(program)
        
        # Look for JSON output for SMED integration
        lines = output.strip().split('\n')
        
        # Try to parse multiline JSON first
        try:
            full_output = output.strip()
            if full_output.startswith('{') and full_output.endswith('}'):
                output_data = json.loads(full_output)
                data_type = output_data.get('type')
                action = output_data.get('action')
                
                # Handle new employee data format
                if data_type == 'smed_map':
                    map_name = output_data.get('map_name', 'BROWSE_MENU')
                    terminal_id = 'webui'  # Default terminal
                    
                    print(f"[INFO] Employee data display requested: {map_name}")
                    print(f"[INFO] Employee count: {len(output_data.get('data', []))}")
                    print(f"[INFO] Target terminal: {terminal_id}")
                    
                    # Send employee data directly to WebSocket Hub
                    success = _send_employee_data_to_hub(terminal_id, output_data, program)
                    
                    if success:
                        print(f"[INFO] Employee data sent directly to WebSocket Hub")
                    else:
                        print(f"[WARNING] Failed to send employee data to Hub")
                    return  # Exit after processing
                    
        except json.JSONDecodeError:
            pass  # Fall back to line-by-line processing
        
        # Fall back to line-by-line JSON parsing
        for line in lines:
            if line.strip().startswith('{') and line.strip().endswith('}'):
                try:
                    output_data = json.loads(line.strip())
                    data_type = output_data.get('type')
                    action = output_data.get('action')
                    
                    # Handle new employee data format
                    if data_type == 'smed_map':
                        map_name = output_data.get('map_name', 'BROWSE_MENU')
                        terminal_id = 'webui'  # Default terminal
                        
                        print(f"[INFO] Employee data display requested: {map_name}")
                        print(f"[INFO] Employee count: {len(output_data.get('data', []))}")
                        print(f"[INFO] Target terminal: {terminal_id}")
                        
                        # Send employee data directly to WebSocket Hub
                        success = _send_employee_data_to_hub(terminal_id, output_data, program)
                        
                        if success:
                            print(f"[INFO] Employee data sent directly to WebSocket Hub")
                        else:
                            print(f"[WARNING] Failed to send employee data to Hub")
                        
                    # Handle legacy display_map format
                    elif action == 'display_map':
                        map_name = output_data.get('map_file')
                        fields = output_data.get('fields', {})
                        terminal_id = output_data.get('terminal_id', 'webui')
                        
                        print(f"[INFO] SMED map display requested: {map_name}")
                        print(f"[INFO] Target terminal: {terminal_id}")
                        
                        # Send directly to WebSocket Hub (bypassing HTTP API) - Legacy
                        success = _send_to_websocket_hub(terminal_id, map_name, fields, program)
                        
                        if success:
                            print(f"[INFO] SMED data sent directly to WebSocket Hub")
                            print(f"[INFO] Fields populated: {len(fields)}")
                            print(f"[INFO] Hub-based single-channel delivery completed")
                        else:
                            print(f"[WARNING] WebSocket Hub delivery failed, falling back to local display")
                            if fields:
                                print(f"[INFO] SMED field data ready: {len(fields)} fields")
                            else:
                                print(f"[INFO] No field data provided for map: {map_name}")
                            
                    elif action == 'continue':
                        print(f"[INFO] Program continuation requested")
                    
                except json.JSONDecodeError:
                    pass  # Not JSON, ignore
                    
    except Exception as e:
        print(f"[DEBUG] Output processing error: {e}")

def _send_to_websocket_hub(terminal_id: str, map_file: str, fields: dict, program_name: str) -> bool:
    """Send SMED data directly to WebSocket Hub using Hub Client"""
    try:
        # Import WebSocket Hub Client
        import sys
        import os
        
        # Add server directory to path to import hub client
        server_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
        sys.path.insert(0, server_dir)
        
        from websocket_hub_client import WebSocketHubClient
        
        print(f"[WEBSOCKET_HUB] Initializing Hub Client for direct SMED transmission")
        
        # Create Hub Client
        hub_client = WebSocketHubClient('http://localhost:8000')
        
        # Connect to Hub
        if not hub_client.connect():
            print(f"[WEBSOCKET_HUB] Failed to connect to WebSocket Hub")
            return False
        
        # Send SMED data via Hub
        success = hub_client.send_smed_data(
            terminal_id=terminal_id,
            map_file=map_file,
            fields=fields,
            program_name=program_name,
            source_type='java_call'
        )
        
        if success:
            print(f"[WEBSOCKET_HUB] SMED data sent successfully via Hub Client")
            print(f"[WEBSOCKET_HUB] - Terminal: {terminal_id}")
            print(f"[WEBSOCKET_HUB] - Map: {map_file}")
            print(f"[WEBSOCKET_HUB] - Fields: {len(fields)} fields")
            print(f"[WEBSOCKET_HUB] - Program: {program_name}")
        else:
            print(f"[WEBSOCKET_HUB] Failed to send SMED data via Hub Client")
        
        # Disconnect from Hub
        hub_client.disconnect()
        
        return success
        
    except ImportError as ie:
        print(f"[WEBSOCKET_HUB] Hub Client not available: {ie}")
        return _fallback_hub_connection(terminal_id, map_file, fields, program_name)
    except Exception as e:
        print(f"[WEBSOCKET_HUB] Hub Client error: {e}")
        return _fallback_hub_connection(terminal_id, map_file, fields, program_name)

def _fallback_hub_connection(terminal_id: str, map_file: str, fields: dict, program_name: str) -> bool:
    """Fallback WebSocket Hub connection using direct SocketIO"""
    try:
        import socketio
        import time
        
        print(f"[WEBSOCKET_HUB] Using fallback direct SocketIO connection")
        
        # Create basic SocketIO client
        hub_client = socketio.Client()
        
        # Setup basic event handlers
        @hub_client.on('connect')
        def on_connect():
            print(f"[WEBSOCKET_HUB] Fallback connection established")
        
        @hub_client.on('smed_data_confirmation')
        def on_confirmation(data):
            print(f"[WEBSOCKET_HUB] Fallback confirmation: {data.get('message')}")
        
        hub_data = {
            'terminal_id': terminal_id,
            'map_file': map_file,
            'fields': fields,
            'program_name': program_name,
            'source_type': 'java_fallback'
        }
        
        # Connect to WebSocket server with immediate registration
        hub_client.connect('http://localhost:8000')
        time.sleep(0.2)  # Brief wait for connection
        
        # Immediate registration for fallback
        fallback_registration = {
            'client_type': 'fallback_hub_client',
            'client_id': f'fallback_client_{id(hub_client)}',
            'capabilities': ['smed_data_transmission'],
            'timestamp': time.time()
        }
        hub_client.emit('register_client', fallback_registration)
        time.sleep(0.1)  # Brief wait for registration
        
        # Send SMED data
        hub_client.emit('smed_data_direct', hub_data)
        print(f"[WEBSOCKET_HUB] Fallback SMED data sent to hub with registration")
        
        time.sleep(0.3)  # Brief wait for confirmation
        
        # Disconnect
        hub_client.disconnect()
        
        return True
        
    except Exception as e:
        print(f"[WEBSOCKET_HUB] All hub connection methods failed: {e}")
        print(f"[WEBSOCKET_HUB] SMED data will be displayed locally only")
        return False

def _setup_smed_input_handler(program_name: str) -> None:
    """Setup simple SMED input handler for interactive programs"""
    try:
        print(f"[SMED_INPUT] Setting up input handler for {program_name}")
        print(f"[SMED_INPUT] Input file: /tmp/{program_name.lower()}_input.txt")
        print(f"[SMED_INPUT] WebSocket Hub can write user input to this file")
        
        # Log the setup for debugging
        import time
        timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
        print(f"[SMED_INPUT] Input handler setup at {timestamp}")
        
    except Exception as e:
        print(f"[SMED_INPUT] Error setting up input handler: {e}")

def _call_cl_program(volume: str, library: str, program: str, 
                    program_info: Dict[str, Any], parameters: str) -> bool:
    """Execute CL (Command Language) program"""
    try:
        program_path = os.path.join(VOLUME_ROOT, volume, library)
        cl_file = program_info.get('CLFILE', program)
        cl_path = os.path.join(program_path, cl_file)
        
        if not os.path.exists(cl_path):
            print(f"[ERROR] CL file not found: {cl_path}")
            set_pgmec(999)
            return False
        
        print(f"[INFO] Executing CL program: {cl_path}")
        
        # Import CL executor
        sys.path.append(os.path.join(os.path.dirname(os.path.dirname(__file__)), 'system-cmds'))
        from cl_executor import execute_cl_file
        
        # Set environment variables for CL execution
        os.environ['ASP_VOLUME'] = volume
        os.environ['ASP_LIBRARY'] = library
        os.environ['ASP_PROGRAM'] = program
        
        # Add parameters to environment if provided
        if parameters:
            param_list = _parse_parameters(parameters)
            for i, param in enumerate(param_list):
                os.environ[f'ASP_PARAM_{i+1}'] = param
        
        try:
            # Execute CL program
            print(f"[CALL_DEBUG] Starting CL execution for {program}")
            result = execute_cl_file(cl_path)
            
            print(f"[INFO] CL program executed")
            print(f"[INFO] Return code: {result}")
            
            if result != 0:
                print(f"[ERROR] CL program execution failed with code: {result}")
                set_pgmec(result)
                return False
            
            return True
            
        except Exception as e:
            print(f"[ERROR] CL execution failed: {e}")
            set_pgmec(999)
            return False
        
    except Exception as e:
        print(f"[ERROR] CL program call failed: {e}")
        set_pgmec(999)
        return False

def _send_employee_data_to_hub(terminal_id: str, employee_data: dict, program_name: str) -> bool:
    """Send simplified employee data directly to WebSocket Hub"""
    try:
        import socketio
        import time
        
        print(f"[EMPLOYEE_HUB] Sending simplified employee data to WebSocket Hub")
        print(f"[EMPLOYEE_HUB] Employee count: {len(employee_data.get('data', []))}")
        
        # Create SocketIO client for employee data
        hub_client = socketio.Client()
        
        # Setup event handlers
        @hub_client.on('connect')
        def on_connect():
            print(f"[EMPLOYEE_HUB] Connected to WebSocket Hub")
        
        @hub_client.on('smed_data_confirmation')
        def on_confirmation(data):
            print(f"[EMPLOYEE_HUB] Data confirmation: {data.get('message')}")
        
        # Prepare employee hub data
        hub_data = {
            'terminal_id': terminal_id,
            'type': 'smed_map',
            'map_name': employee_data.get('map_name', 'BROWSE_MENU'),
            'title': employee_data.get('title', 'Employee Information'),
            'subtitle': employee_data.get('subtitle', '------------------'),
            'headers': employee_data.get('headers', ['ID', 'Name', 'Dept']),
            'data': employee_data.get('data', []),
            'page_info': employee_data.get('page_info', {'current': 1, 'total': 1}),
            'function_keys': employee_data.get('function_keys', 'F3=Quit'),
            'status': employee_data.get('status', 'Showing employees'),
            'program_name': program_name,
            'source_type': 'employee_data_simplified'
        }
        
        # Connect to WebSocket Hub
        hub_client.connect('http://localhost:8000')
        time.sleep(0.2)  # Brief wait for connection
        
        # Register as employee data client
        employee_registration = {
            'client_type': 'employee_data_client',
            'client_id': f'employee_client_{id(hub_client)}',
            'capabilities': ['employee_data_transmission'],
            'timestamp': time.time()
        }
        hub_client.emit('register_client', employee_registration)
        time.sleep(0.1)  # Brief wait for registration
        
        # Send employee data via Hub
        hub_client.emit('smed_data_direct', hub_data)
        print(f"[EMPLOYEE_HUB] Employee data sent to hub successfully")
        print(f"[EMPLOYEE_HUB] - Terminal: {terminal_id}")
        print(f"[EMPLOYEE_HUB] - Employee Records: {len(hub_data['data'])}")
        print(f"[EMPLOYEE_HUB] - Headers: {hub_data['headers']}")
        
        time.sleep(0.3)  # Brief wait for processing
        
        # Disconnect
        hub_client.disconnect()
        
        return True
        
    except Exception as e:
        print(f"[EMPLOYEE_HUB] Failed to send employee data to hub: {e}")
        print(f"[EMPLOYEE_HUB] Employee data will be displayed locally only")
        return False


# For backwards compatibility and testing
if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        CALL(' '.join(sys.argv[1:]))