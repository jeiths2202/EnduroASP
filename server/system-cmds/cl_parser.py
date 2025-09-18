#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CL (Control Language) Parser for OpenASP
Parses ASP CL scripts and converts them to executable instructions
"""

import re
import json
from typing import Dict, List, Optional, Union

def parse_cl_line(line: str) -> Optional[Dict[str, Union[str, Dict[str, str]]]]:
    """
    Parse a single CL line into command and parameters
    
    Args:
        line: A single line of CL script
        
    Returns:
        Dictionary with 'command' and 'params' keys, or None if line is empty/comment
    """
    line = line.strip()
    
    # Skip empty lines and comments
    if not line or line.startswith("*"):
        return None
    
    # Split command from parameters
    parts = line.split(maxsplit=1)
    command = parts[0].upper()
    args_str = parts[1] if len(parts) > 1 else ""
    
    # Parse parameters
    args = {}
    
    if not args_str:
        return {"command": command, "params": args}
    
    # Split parameters by comma and space, but handle quoted strings correctly
    param_parts = []
    current_part = ""
    in_quotes = False
    quote_char = None
    i = 0
    
    while i < len(args_str):
        char = args_str[i]
        
        if not in_quotes:
            if char in ["'", '"']:
                # Start of quoted string
                in_quotes = True
                quote_char = char
                current_part += char
            elif char in [',', ' ']:
                # Parameter separator
                if current_part.strip():
                    param_parts.append(current_part.strip())
                current_part = ""
                # Skip multiple separators
                while i + 1 < len(args_str) and args_str[i + 1] in [',', ' ']:
                    i += 1
            else:
                current_part += char
        else:
            current_part += char
            if char == quote_char:
                # Check for escaped quote (double quote)
                if i + 1 < len(args_str) and args_str[i + 1] == quote_char:
                    # Escaped quote, add the next character too
                    i += 1
                    current_part += args_str[i]
                else:
                    # End of quoted string
                    in_quotes = False
                    quote_char = None
        
        i += 1
    
    # Don't forget the last part
    if current_part.strip():
        param_parts.append(current_part.strip())
    
    # Parse each parameter part
    for part in param_parts:
        if "=" in part:
            key, val = part.split("=", 1)
            key = key.strip().upper()
            val = val.strip()
            
            # Remove outer quotes if present and unescape
            if val and len(val) >= 2:
                if (val.startswith("'") and val.endswith("'")) or \
                   (val.startswith('"') and val.endswith('"')):
                    quote_char = val[0]
                    val = val[1:-1]
                    # Unescape doubled quotes
                    if quote_char == "'":
                        val = val.replace("''", "'")
                    else:
                        val = val.replace('""', '"')
            
            args[key] = val
        else:
            # Positional parameter (no = sign)
            args[part.upper()] = None
    
    return {
        "command": command,
        "params": args
    }

def parse_cl_script(script: str) -> List[Dict[str, Union[str, Dict[str, str]]]]:
    """
    Parse a complete CL script into a list of instructions
    
    Args:
        script: Multi-line CL script
        
    Returns:
        List of parsed instructions
    """
    instructions = []
    
    # Handle line continuations (lines ending with +)
    lines = script.splitlines()
    combined_lines = []
    current_line = ""
    
    for line in lines:
        line = line.rstrip()
        if line.endswith("+"):
            # Line continuation
            current_line += line[:-1] + " "
        else:
            # Complete line
            current_line += line
            if current_line.strip():
                combined_lines.append(current_line)
            current_line = ""
    
    # Parse each combined line
    for line in combined_lines:
        parsed = parse_cl_line(line)
        if parsed:
            instructions.append(parsed)
    
    return instructions

def parse_cl_file(filename: str) -> List[Dict[str, Union[str, Dict[str, str]]]]:
    """
    Parse a CL script from file
    
    Args:
        filename: Path to CL script file
        
    Returns:
        List of parsed instructions
    """
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            script = f.read()
        return parse_cl_script(script)
    except Exception as e:
        print(f"[ERROR] Failed to parse CL file {filename}: {e}")
        return []

# Test the parser with example CL script
if __name__ == "__main__":
    test_script = """
* ASP Control Language Example
CHGLIBL LIBL=TESTLIB
CRTFILE FILE=CUSTOMERS,RECSIZE=128
CRTFILE FILE=CUSTOMER.SAM001,RECSIZE=128
CALL PGM=CUINP001,PARA='001,ABC'
DLTFILE FILE=CUSTOMERS
CHGLIBL LIBL=LIB1,LIB2,LIB3 MODE=@ADD POSITION=@TOP
"""
    
    print("Parsing test CL script:")
    print("-" * 50)
    instructions = parse_cl_script(test_script)
    
    for i, instr in enumerate(instructions):
        print(f"Instruction {i+1}:")
        print(f"  Command: {instr['command']}")
        print(f"  Params: {json.dumps(instr['params'], indent=4)}")
        print()