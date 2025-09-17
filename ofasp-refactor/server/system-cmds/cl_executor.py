#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CL (Control Language) Executor for OpenASP
Executes parsed CL instructions using ASP commands
"""

import os
import sys
import json
from typing import Dict, List, Union, Callable

# Add current directory to path for imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from cl_parser import parse_cl_script, parse_cl_file
from asp_commands import (
    CALL, CRTFILE, DLTFILE, CRTLIB, DLTLIB, CHGLIBL,
    WRKLIB, DSPFD, WRKOBJ, WRKVOL, SAVLIB, RSTLIB,
    SNDMSG, RCVMSG, EDTFILE, CRTPGM, CRTMAP,
    get_pgmec, reset_pgmec, set_pgmec
)

# Command mapping from CL commands to ASP command handlers
COMMAND_MAP = {
    # File operations
    "CRTFILE": CRTFILE,
    "DLTFILE": DLTFILE,
    "DSPFD": DSPFD,
    "EDTFILE": EDTFILE,
    
    # Library operations
    "CRTLIB": CRTLIB,
    "DLTLIB": DLTLIB,
    "WRKLIB": WRKLIB,
    "CHGLIBL": CHGLIBL,
    "CHGLIB": CHGLIBL,  # Alias for CHGLIBL
    "SAVLIB": SAVLIB,
    "RSTLIB": RSTLIB,
    
    # Program operations
    "CALL": CALL,
    "CRTPGM": CRTPGM,
    
    # Object operations
    "WRKOBJ": WRKOBJ,
    "CRTMAP": CRTMAP,
    
    # System operations
    "WRKVOL": WRKVOL,
    "SNDMSG": SNDMSG,
    "RCVMSG": RCVMSG,
}

def format_command_line(command: str, params: Dict[str, str]) -> str:
    """
    Format parsed instruction back into ASP command line format
    
    Args:
        command: Command name
        params: Parameter dictionary
        
    Returns:
        Formatted command line string
    """
    # Handle different command formats
    if command in ["CRTFILE", "DLTFILE"]:
        return format_file_command(command, params)
    elif command in ["CRTLIB", "DLTLIB"]:
        return format_lib_command(command, params)
    elif command in ["CHGLIBL", "CHGLIB"]:
        return format_chglibl_command(command, params)
    elif command == "CALL":
        return format_call_command(command, params)
    else:
        # Default formatting for other commands
        return format_default_command(command, params)

def format_file_command(command: str, params: Dict[str, str]) -> str:
    """Format FILE commands (CRTFILE, DLTFILE) to ASP format"""
    file_name = params.get("FILE", "")
    vol = params.get("VOL", "DISK01")  # Default volume
    
    # Handle library specification - default to current library or a standard one
    if "/" in file_name:
        # Already has library/file format
        file_spec = f"FILE({file_name})"
    else:
        # Add default library (could be from context or config)
        # For now, use a default library name
        default_lib = "TESTLIB"  # TODO: Get from current library context
        file_spec = f"FILE({default_lib}/{file_name})"
    
    # Build parameter list
    param_parts = [file_spec]
    
    # Add VOL parameter in ASP format
    param_parts.append(f"VOL-{vol}")
    
    # Handle other parameters specific to CRTFILE
    if command == "CRTFILE":
        # Map CL parameters to ASP parameters
        if "RECSIZE" in params:
            param_parts.append(f"RECLEN-{params['RECSIZE']}")
        if "RECTYPE" in params:
            param_parts.append(f"RECTYPE-{params['RECTYPE']}")
        else:
            param_parts.append("RECTYPE-FB")  # Default to FB
    
    return f"{command} {','.join(param_parts)}"

def format_lib_command(command: str, params: Dict[str, str]) -> str:
    """Format LIB commands (CRTLIB, DLTLIB) to ASP format"""
    lib_name = params.get("LIB", "")
    vol = params.get("VOL", "DISK01")  # Default volume
    
    param_parts = [f"LIB-{lib_name}", f"VOL-{vol}"]
    
    return f"{command} {','.join(param_parts)}"

def format_chglibl_command(command: str, params: Dict[str, str]) -> str:
    """Format CHGLIBL command to ASP format"""
    # CHGLIBL uses = format, so keep the CL format
    param_parts = []
    for key, value in params.items():
        if value is None:
            param_parts.append(key)
        else:
            # Handle special values
            if value.startswith("@"):
                param_parts.append(f"{key}={value}")
            elif "," in value:
                # Multiple values, quote if needed
                param_parts.append(f"{key}={value}")
            else:
                param_parts.append(f"{key}={value}")
    
    return f"{command} {','.join(param_parts)}"

def format_call_command(command: str, params: Dict[str, str]) -> str:
    """Format CALL command to ASP format"""
    # CALL uses - format: PGM-program, PARA-(parameters), VOL-volume
    param_parts = []
    
    for key, value in params.items():
        if value is None:
            param_parts.append(key)
        else:
            if key == "PGM":
                # Program name uses dash format
                param_parts.append(f"PGM-{value}")
            elif key == "PARA":
                # Parameters use parentheses format
                param_parts.append(f"PARA-({value})")
            elif key == "VOL":
                # Volume uses dash format
                param_parts.append(f"VOL-{value}")
            else:
                # Other parameters use dash format
                param_parts.append(f"{key}-{value}")
    
    return f"{command} {','.join(param_parts)}"

def format_default_command(command: str, params: Dict[str, str]) -> str:
    """Default command formatting"""
    param_parts = []
    for key, value in params.items():
        if value is None:
            param_parts.append(key)
        else:
            param_parts.append(f"{key}={value}")
    
    return f"{command} {','.join(param_parts)}"

def execute_instruction(instruction: Dict[str, Union[str, Dict[str, str]]]) -> bool:
    """
    Execute a single CL instruction
    
    Args:
        instruction: Parsed instruction with 'command' and 'params'
        
    Returns:
        True if successful, False otherwise
    """
    command = instruction["command"]
    params = instruction["params"]
    
    # Get command handler
    handler = COMMAND_MAP.get(command)
    
    if not handler:
        print(f"[SKIP] Unknown command: {command}")
        print(f"[INFO] Parameters: {params}")
        return True  # Continue execution even for unknown commands
    
    # Format command line for ASP command handler
    command_line = format_command_line(command, params)
    
    print(f"[EXEC] {command_line}")
    
    try:
        # Reset PGMEC before execution
        reset_pgmec()
        
        # Execute command
        result = handler(command_line)
        
        # Check execution result
        pgmec = get_pgmec()
        if pgmec != 0:
            print(f"[WARN] Command returned PGMEC={pgmec}")
            
        return result if isinstance(result, bool) else True
        
    except Exception as e:
        print(f"[ERROR] Failed to execute {command}: {e}")
        set_pgmec(999)
        return False

def execute_cl_script(script: str, stop_on_error: bool = False) -> int:
    """
    Execute a CL script
    
    Args:
        script: CL script content
        stop_on_error: Stop execution on first error
        
    Returns:
        Number of failed instructions
    """
    print("[INFO] Starting CL script execution")
    print("-" * 50)
    
    # Parse script
    instructions = parse_cl_script(script)
    
    if not instructions:
        print("[WARN] No instructions found in script")
        return 0
    
    print(f"[INFO] Found {len(instructions)} instructions")
    print()
    
    # Execute instructions
    failed_count = 0
    for i, instruction in enumerate(instructions):
        print(f"[{i+1}/{len(instructions)}] ", end="")
        
        success = execute_instruction(instruction)
        
        if not success:
            failed_count += 1
            if stop_on_error:
                print(f"[ERROR] Stopping execution due to error")
                break
        
        print()  # Blank line between commands
    
    print("-" * 50)
    print(f"[INFO] Execution complete. Failed: {failed_count}/{len(instructions)}")
    
    return failed_count

def execute_cl_file(filename: str, stop_on_error: bool = False) -> int:
    """
    Execute a CL script from file
    
    Args:
        filename: Path to CL script file
        stop_on_error: Stop execution on first error
        
    Returns:
        Number of failed instructions
    """
    print(f"[INFO] Loading CL script from: {filename}")
    
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            script = f.read()
        return execute_cl_script(script, stop_on_error)
    except Exception as e:
        print(f"[ERROR] Failed to load CL file: {e}")
        return 1

# Command line interface
if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="OpenASP CL Executor")
    parser.add_argument("script", nargs="?", help="CL script file or inline script")
    parser.add_argument("-f", "--file", action="store_true", 
                       help="Treat argument as filename")
    parser.add_argument("-e", "--stop-on-error", action="store_true",
                       help="Stop execution on first error")
    
    args = parser.parse_args()
    
    if not args.script:
        # Interactive mode - read from stdin
        print("Enter CL commands (Ctrl+D to execute):")
        script = sys.stdin.read()
        failed = execute_cl_script(script, args.stop_on_error)
    elif args.file or os.path.isfile(args.script):
        # Execute from file
        failed = execute_cl_file(args.script, args.stop_on_error)
    else:
        # Execute as inline script
        failed = execute_cl_script(args.script, args.stop_on_error)
    
    # Exit with error count
    sys.exit(min(failed, 255))