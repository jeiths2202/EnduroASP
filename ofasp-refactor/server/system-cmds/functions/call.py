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
from datetime import datetime
from typing import Dict, List, Tuple, Optional, Any

# Import from parent module
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from asp_commands import VOLUME_ROOT, get_catalog_info, set_pgmec, reset_pgmec

def CALL(command: str) -> bool:
    """
    CALL command - Call Program
    
    Enhanced CALL command following Fujitsu ASP manual format.
    Format: CALL PGM-<program>[.<library>][,PARA-(<parameters>)][,VOL-<volume>]
    
    Args:
        command: Full CALL command string
        
    Returns:
        True if successful, False otherwise
    """
    try:
        reset_pgmec()
        
        # Parse CALL command
        command_str = command.replace('CALL ', '').strip()
        
        # Parse parameters
        program = None
        library = None
        volume = "DISK01"  # Default volume
        parameters = ""
        
        # Split by comma, but handle nested parentheses in PARA parameter
        parts = []
        current_part = ""
        paren_count = 0
        
        for char in command_str:
            if char == '(':
                paren_count += 1
            elif char == ')':
                paren_count -= 1
            elif char == ',' and paren_count == 0:
                parts.append(current_part.strip())
                current_part = ""
                continue
            current_part += char
        
        if current_part.strip():
            parts.append(current_part.strip())
        
        # Process each part
        for part in parts:
            if part.startswith('PGM-'):
                pgm_spec = part[4:]  # Remove 'PGM-'
                if '.' in pgm_spec:
                    program, library = pgm_spec.split('.', 1)
                else:
                    program = pgm_spec
            elif part.startswith('PARA-(') and part.endswith(')'):
                parameters = part[6:-1]  # Remove 'PARA-(' and ')'
            elif part.startswith('VOL-'):
                volume = part[4:]  # Remove 'VOL-'
        
        if not program:
            print("[ERROR] PGM parameter is required.")
            print("[USAGE] CALL PGM-<program>[.<library>][,PARA-(<parameters>)][,VOL-<volume>]")
            set_pgmec(999)
            return False
        
        print(f"[INFO] Calling program: {program}")
        print(f"[INFO] Library: {library if library else 'Auto-detect'}")
        print(f"[INFO] Volume: {volume}")
        print(f"[INFO] Parameters: {parameters if parameters else 'None'}")
        
        # Find program library if not specified
        if not library:
            library = _find_program_library(volume, program)
            if not library:
                print(f"[ERROR] Program '{program}' not found in any library on volume '{volume}'.")
                set_pgmec(999)
                return False
            print(f"[INFO] Program found in library: {library}")
        
        # Get program information from catalog
        catalog = get_catalog_info()
        if (volume not in catalog or library not in catalog[volume] or 
            program not in catalog[volume][library]):
            print(f"[ERROR] Program '{program}' not registered in catalog.json")
            set_pgmec(999)
            return False
        
        program_info = catalog[volume][library][program]
        
        if program_info.get('TYPE') != 'PGM':
            print(f"[ERROR] '{program}' is not a program (TYPE: {program_info.get('TYPE', 'Unknown')})")
            set_pgmec(999)
            return False
        
        pgm_type = program_info.get('PGMTYPE', 'UNKNOWN').upper()
        print(f"[INFO] Program type: {pgm_type}")
        
        # Execute program based on type
        if pgm_type == 'JAVA':
            return _call_java_program(volume, library, program, program_info, parameters)
        elif pgm_type == 'COBOL':
            return _call_cobol_program(volume, library, program, program_info, parameters)
        elif pgm_type == 'SHELL':
            return _call_shell_program(volume, library, program, program_info, parameters)
        elif pgm_type == 'PYTHON':
            return _call_python_program(volume, library, program, program_info, parameters)
        else:
            print(f"[ERROR] Unsupported program type: {pgm_type}")
            set_pgmec(999)
            return False
        
    except Exception as e:
        print(f"[ERROR] CALL command failed: {e}")
        set_pgmec(999)
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
            
            cmd = ['java', '-jar', jar_path]
        elif class_file:
            # Execute class file
            class_path = os.path.join(program_path, class_file)
            if not os.path.exists(class_path):
                print(f"[ERROR] Class file not found: {class_path}")
                set_pgmec(999)
                return False
            
            # Extract class name from path
            class_name = class_file.replace('/', '.').replace('.class', '')
            cmd = ['java', '-cp', program_path, class_name]
        else:
            # Use program name directly
            cmd = ['java', '-cp', program_path, pgm_name]
        
        # Add parameters if provided
        if parameters:
            param_list = _parse_parameters(parameters)
            cmd.extend(param_list)
        
        print(f"[INFO] Executing Java command: {' '.join(cmd)}")
        
        # Execute the Java program
        try:
            # Set environment variables for proper encoding
            env = os.environ.copy()
            env['JAVA_TOOL_OPTIONS'] = '-Dfile.encoding=UTF-8 -Dconsole.encoding=UTF-8'
            env['LC_ALL'] = 'C.UTF-8'
            env['LANG'] = 'C.UTF-8'
            
            result = subprocess.run(cmd, capture_output=True, text=False, 
                                  cwd=program_path, timeout=30, env=env)
            
            print(f"[INFO] Java program executed")
            print(f"[INFO] Return code: {result.returncode}")
            
            # Handle encoding for stdout and stderr
            stdout = ""
            stderr = ""
            
            if result.stdout:
                try:
                    stdout = result.stdout.decode('utf-8', errors='replace')
                except UnicodeDecodeError:
                    try:
                        stdout = result.stdout.decode('shift_jis', errors='replace')
                    except UnicodeDecodeError:
                        stdout = result.stdout.decode('latin1', errors='replace')
                
                print(f"[OUTPUT] {stdout}")
                # Process output for SMED integration
                _process_java_output(stdout, volume, library, program)
            
            if result.stderr:
                try:
                    stderr = result.stderr.decode('utf-8', errors='replace')
                except UnicodeDecodeError:
                    try:
                        stderr = result.stderr.decode('shift_jis', errors='replace')
                    except UnicodeDecodeError:
                        stderr = result.stderr.decode('latin1', errors='replace')
                
                print(f"[ERROR] {stderr}")
            
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
    """Process Java program output for SMED integration"""
    try:
        print(f"[CALL_DEBUG] Processing Java output for SMED integration...")
        lines = output.strip().split('\n')
        
        # Look for SMED_MAP_OUTPUT marker
        smed_output_started = False
        json_lines = []
        
        for line in lines:
            line = line.strip()
            
            if line == "SMED_MAP_OUTPUT:":
                smed_output_started = True
                print(f"[CALL_DEBUG] Found SMED_MAP_OUTPUT marker")
                continue
            
            if smed_output_started:
                if line.startswith('{') or line.startswith('"') or line.startswith('[') or json_lines:
                    json_lines.append(line)
                    
                    # Try to parse as complete JSON
                    json_str = '\n'.join(json_lines)
                    try:
                        smed_data = json.loads(json_str)
                        print(f"[CALL_DEBUG] Successfully parsed SMED JSON data")
                        
                        # Send SMED map data to WebSocket
                        _send_smed_to_websocket(smed_data, program)
                        
                        # Reset for potential additional JSON blocks
                        json_lines = []
                        smed_output_started = False
                        
                    except json.JSONDecodeError:
                        # Continue collecting lines for multi-line JSON
                        continue
                else:
                    # Non-JSON line after SMED output, stop collecting
                    if json_lines:
                        smed_output_started = False
                        json_lines = []
            
            # Also check for legacy single-line JSON format
            if line.startswith('{') and line.endswith('}') and not smed_output_started:
                try:
                    output_data = json.loads(line)
                    action = output_data.get('action')
                    
                    if action == 'display_map':
                        map_name = output_data.get('map_name')
                        print(f"[CALL_DEBUG] Legacy SMED map display requested: {map_name}")
                        _send_smed_to_websocket(output_data.get('data', {}), map_name)
                    elif action == 'continue':
                        print(f"[CALL_DEBUG] Program continuation requested")
                    
                except json.JSONDecodeError:
                    pass  # Not JSON, ignore
                    
    except Exception as e:
        print(f"[CALL_DEBUG] Output processing error: {e}")

def _send_smed_to_websocket(smed_data: dict, program_name: str) -> None:
    """Send SMED map data to WebSocket for display via Socket.IO"""
    try:
        print(f"[CALL_DEBUG] Sending SMED data for program: {program_name}")
        
        # Create message for Socket.IO broadcast in the format expected by web terminal
        message = {
            'type': 'smed_map',
            'program': program_name,
            'map_file': smed_data.get('map_name', program_name),
            'fields': smed_data,
            'data': smed_data.get('fields', []),
            'timestamp': datetime.now().isoformat(),
            'hub_metadata': {
                'source': 'call_function',
                'terminal_id': 'system',
                'timestamp': datetime.now().isoformat()
            }
        }
        
        print(f"[CALL_DEBUG] Prepared message: {json.dumps(message, indent=2)}")
        
        # First, try to write to file for pickup by web terminal
        _write_smed_to_file(smed_data, program_name)
        
        # Also try HTTP method as fallback
        try:
            import urllib.request
            import urllib.parse
            
            json_data = json.dumps(message).encode('utf-8')
            req = urllib.request.Request(
                'http://localhost:8000/broadcast-smed',
                data=json_data,
                headers={'Content-Type': 'application/json'}
            )
            
            try:
                with urllib.request.urlopen(req, timeout=2) as response:
                    if response.status == 200:
                        print(f"[CALL_DEBUG] Successfully sent SMED data to Socket.IO server")
                    else:
                        print(f"[CALL_DEBUG] Socket.IO server responded with status: {response.status}")
            except Exception as http_error:
                print(f"[CALL_DEBUG] HTTP request failed: {http_error}")
                        
        except Exception as e:
            print(f"[CALL_DEBUG] HTTP fallback failed: {e}")
            
    except Exception as e:
        print(f"[CALL_DEBUG] Failed to send SMED data: {e}")

def _write_smed_to_file(smed_data: dict, program_name: str) -> None:
    """Fallback: Write SMED data to a file for pickup by the server"""
    try:
        import tempfile
        
        smed_file = os.path.join(tempfile.gettempdir(), 'asp_smed_output.json')
        
        message = {
            'type': 'smed_map',
            'program': program_name,
            'map_file': smed_data.get('map_name', program_name),
            'fields': smed_data,
            'data': smed_data.get('fields', []),
            'timestamp': datetime.now().isoformat(),
            'hub_metadata': {
                'source': 'call_function',
                'terminal_id': 'system',
                'timestamp': datetime.now().isoformat()
            }
        }
        
        with open(smed_file, 'w', encoding='utf-8') as f:
            json.dump(message, f, ensure_ascii=False, indent=2)
            
        print(f"[CALL_DEBUG] SMED data written to file: {smed_file}")
        
    except Exception as e:
        print(f"[CALL_DEBUG] Failed to write SMED data to file: {e}")


# For backwards compatibility and testing
if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        CALL(' '.join(sys.argv[1:]))