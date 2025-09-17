# -*- coding: utf-8 -*-
"""
DSPFD (Display File Description) Command Implementation for OpenASP

Based on ASP DSPFD command specifications.
Displays detailed file information including size, dates, and record attributes.
"""

import os
import sys
from datetime import datetime

# Import from parent module
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from asp_commands import VOLUME_ROOT, get_catalog_info, set_pgmec

def DSPFD(command: str) -> bool:
    """
    DSPFD command - Display File Description
    
    ASP Format: DSPFD FILE=filename,@LIB=library[,VOL=volume]
    Legacy Format: DSPFD FILE(LIB/FILENAME),VOL-VOLUME
    
    Args:
        command: Full DSPFD command string
        
    Returns:
        True if successful, False otherwise
    """
    try:
        # Parse command with support for both ASP and legacy formats
        command_str = command.replace('DSPFD ', '').strip()
        
        # Initialize default values
        params = {
            'FILE': '',
            'LIB': '',
            'VOL': 'DISK01'
        }
        
        # Parse parameters
        parts = []
        current_part = ""
        in_parentheses = False
        
        for char in command_str:
            if char == '(':
                in_parentheses = True
                current_part += char
            elif char == ')':
                in_parentheses = False
                current_part += char
            elif char == ',' and not in_parentheses:
                if current_part.strip():
                    parts.append(current_part.strip())
                current_part = ""
            else:
                current_part += char
        
        if current_part.strip():
            parts.append(current_part.strip())
        
        # Determine format based on first parameter
        is_legacy_format = False
        if parts and (parts[0].startswith('FILE(') or any('VOL-' in part for part in parts)):
            is_legacy_format = True
        
        if is_legacy_format:
            # Legacy format: DSPFD FILE(LIB/FILENAME),VOL-VOLUME
            for part in parts:
                if part.startswith('FILE(') and part.endswith(')'):
                    file_spec = part[5:-1]  # Remove FILE( and )
                    if '/' in file_spec:
                        lib, filename = file_spec.split('/', 1)
                        params['LIB'] = lib
                        params['FILE'] = filename
                elif part.startswith('VOL-'):
                    params['VOL'] = part[4:]
                elif part.startswith('VOL='):
                    params['VOL'] = part[4:]
        else:
            # ASP format: DSPFD FILE=filename,@LIB=library[,VOL=volume]
            for part in parts:
                if '=' in part:
                    key, value = part.split('=', 1)
                    key = key.strip()
                    value = value.strip()
                    
                    # Handle @ prefixed parameters (like @LIB=value)
                    if key.startswith('@'):
                        key = key[1:].upper()  # Remove @ and normalize
                    else:
                        key = key.upper()
                    
                    if key in params:
                        params[key] = value
        
        # Validate required parameters
        if not params['FILE']:
            print("[ERROR] FILE parameter is required.")
            print("[USAGE] DSPFD FILE=filename,@LIB=library[,VOL=volume]")
            print("[LEGACY] DSPFD FILE(LIB/FILENAME),VOL-VOLUME")
            set_pgmec(999)
            return False
        
        if not params['LIB']:
            print("[ERROR] @LIB parameter is required.")
            print("[USAGE] DSPFD FILE=filename,@LIB=library[,VOL=volume]")
            print("[LEGACY] DSPFD FILE(LIB/FILENAME),VOL-VOLUME")
            set_pgmec(999)
            return False
        
        lib = params['LIB']
        filename = params['FILE']
        volume = params['VOL']
        
        # Construct file path
        file_path = os.path.join(VOLUME_ROOT, volume, lib, filename)
        
        if not os.path.isfile(file_path):
            print(f"[ERROR] File '{filename}' does not exist in library '{lib}' on volume '{volume}'.")
            set_pgmec(999)
            return False
        
        # Get file system information
        file_stat = os.stat(file_path)
        file_size = file_stat.st_size
        created_time = datetime.fromtimestamp(file_stat.st_ctime).strftime('%Y-%m-%d %H:%M:%S')
        modified_time = datetime.fromtimestamp(file_stat.st_mtime).strftime('%Y-%m-%d %H:%M:%S')
        
        # Get file format info from catalog
        catalog = get_catalog_info()
        file_info = {}
        if (volume in catalog and lib in catalog[volume] and 
            filename in catalog[volume][lib]):
            file_info = catalog[volume][lib][filename]
        
        # Display file information
        print("[INFO] File definition information:")
        print(f"  [VOLUME] Volume         : {volume}")
        print(f"  [LIBRARY] Library       : {lib}")
        print(f"  [FILE] File name        : {filename}")
        print(f"  [PATH] File path        : {file_path}")
        print(f"  [SIZE] File size        : {file_size} Byte")
        print(f"  [CREATE] Created date   : {created_time}")
        print(f"  [MODIFY] Last modified  : {modified_time}")
        
        # Dataset specific information
        if file_info.get('TYPE') == 'DATASET':
            rectype = file_info.get('RECTYPE', 'Unknown')
            reclen = file_info.get('RECLEN', 'Unknown')
            encoding = file_info.get('ENCODING', 'Unknown')
            description = file_info.get('DESCRIPTION', 'No description')
            
            print(f"  [TYPE] Object type      : DATASET")
            print(f"  [RECTYPE] Record type   : {rectype}")
            print(f"  [RECLEN] Record length  : {reclen}")
            print(f"  [ENCODING] Encoding     : {encoding}")
            print(f"  [DESC] Description      : {description}")
            
            # Calculate estimated record count for FB files
            if rectype == 'FB' and isinstance(reclen, int) and reclen > 0:
                estimated_records = file_size // reclen
                print(f"  [RECORDS] Est. records  : {estimated_records}")
        
        # Program specific information
        elif file_info.get('TYPE') == 'PGM':
            pgmtype = file_info.get('PGMTYPE', 'Unknown')
            version = file_info.get('VERSION', 'Unknown')
            pgmname = file_info.get('PGMNAME', filename)
            description = file_info.get('DESCRIPTION', 'No description')
            
            print(f"  [TYPE] Object type      : PROGRAM")
            print(f"  [PGMTYPE] Program type  : {pgmtype}")
            print(f"  [PGMNAME] Program name  : {pgmname}")
            print(f"  [VERSION] Version       : {version}")
            print(f"  [DESC] Description      : {description}")
            
            # Program file specific info
            if pgmtype == 'JAVA':
                if 'JARFILE' in file_info:
                    print(f"  [JARFILE] JAR file      : {file_info['JARFILE']}")
                if 'CLASSFILE' in file_info:
                    print(f"  [CLASSFILE] Class file  : {file_info['CLASSFILE']}")
            elif pgmtype == 'COBOL':
                if 'SOURCEFILE' in file_info:
                    print(f"  [SOURCE] Source file    : {file_info['SOURCEFILE']}")
                if 'EXECUTABLE' in file_info:
                    print(f"  [EXEC] Executable       : {file_info['EXECUTABLE']}")
            elif pgmtype == 'SHELL':
                if 'SHELLFILE' in file_info:
                    print(f"  [SHELL] Shell file      : {file_info['SHELLFILE']}")
        
        # Map specific information
        elif file_info.get('TYPE') == 'MAP':
            maptype = file_info.get('MAPTYPE', 'Unknown')
            rows = file_info.get('ROWS', 'Unknown')
            cols = file_info.get('COLS', 'Unknown')
            mapfile = file_info.get('MAPFILE', filename)
            description = file_info.get('DESCRIPTION', 'No description')
            
            print(f"  [TYPE] Object type      : MAP")
            print(f"  [MAPTYPE] Map type      : {maptype}")
            print(f"  [MAPFILE] Map file      : {mapfile}")
            print(f"  [SIZE] Dimensions       : {rows}x{cols}")
            print(f"  [DESC] Description      : {description}")
            
            if maptype == 'HTML' and 'RESPONSIVE' in file_info:
                print(f"  [RESPONSIVE] Responsive : {file_info['RESPONSIVE']}")
        
        else:
            print(f"  [TYPE] Object type      : Unknown")
            print(f"  [WARNING] File not registered in catalog.json")
        
        # File access permissions (basic Unix permissions)
        permissions = oct(file_stat.st_mode)[-3:]
        print(f"  [PERM] File permissions : {permissions}")
        
        # Check if file is empty
        is_empty = file_size == 0
        print(f"  [EMPTY] File is empty   : {'Yes' if is_empty else 'No'}")
        
        return True
        
    except Exception as e:
        print(f"[ERROR] DSPFD command failed: {e}")
        set_pgmec(999)
        return False


# For backwards compatibility and testing
if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        DSPFD(' '.join(sys.argv[1:]))