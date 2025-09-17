# -*- coding: utf-8 -*-
"""
CRTFILE (Create File) Command Implementation for OpenASP

Based on Fujitsu ASP CRTFILE command specifications.
Creates dataset files with specified attributes and registers them in the catalog system.
"""

import os
import sys
from datetime import datetime

# Import from parent module
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from asp_commands import VOLUME_ROOT, get_catalog_info, update_catalog_info, set_pgmec

def CRTFILE(command: str) -> bool:
    """
    CRTFILE command - Create File/Dataset
    
    Format: CRTFILE FILE(LIB/FILENAME),VOL-VOLUME,RECTYPE-TYPE,RECLEN-LENGTH
    
    Args:
        command: Full CRTFILE command string
        
    Returns:
        True if successful, False otherwise
    """
    try:
        # Parse command
        main_part, *others = command.replace('CRTFILE ', '').split(',')
        
        # Parse FILE(LIB/FILENAME) parameter
        if not main_part.startswith('FILE(') or not main_part.endswith(')'):
            print("[ERROR] Invalid FILE parameter format. Expected: FILE(LIB/FILENAME)")
            print("[USAGE] CRTFILE FILE(LIB/FILENAME),VOL-VOLUME,RECTYPE-TYPE,RECLEN-LENGTH")
            set_pgmec(999)
            return False
        
        file_spec = main_part[5:-1]  # Remove FILE( and )
        if '/' not in file_spec:
            print("[ERROR] Invalid file specification. Expected: LIB/FILENAME")
            print("[USAGE] CRTFILE FILE(LIB/FILENAME),VOL-VOLUME,RECTYPE-TYPE,RECLEN-LENGTH")
            set_pgmec(999)
            return False
        
        file_lib, file_name = file_spec.split('/', 1)
        
        # Parse additional parameters
        params = {}
        for param in others:
            if '=' in param:
                key, value = param.split('=', 1)
                params[key.strip().upper()] = value.strip()
            elif '-' in param:
                key, value = param.split('-', 1)
                params[key.strip().upper()] = value.strip()
        
        volume = params.get('VOL')
        
        if not volume:
            print("[ERROR] VOL parameter is missing.")
            print("[USAGE] CRTFILE FILE(LIB/FILENAME),VOL-VOLUME,RECTYPE-TYPE,RECLEN-LENGTH")
            set_pgmec(999)
            return False
        
        # Construct paths
        lib_path = os.path.join(VOLUME_ROOT, volume, file_lib)
        file_path = os.path.join(lib_path, file_name)
        
        # Check if library exists
        if not os.path.exists(lib_path):
            print(f"[ERROR] Library '{file_lib}' does not exist. Please run CRTLIB command first.")
            set_pgmec(999)
            return False
        
        # Check if file already exists
        if os.path.exists(file_path):
            print(f"[ERROR] File '{file_name}' already exists in library '{file_lib}' on volume '{volume}'.")
            set_pgmec(999)
            return False
        
        # Parse dataset attributes with enhanced validation
        reclen_str = params.get('RECLEN', '80')
        rectype = params.get('RECTYPE', 'FB').upper()
        encoding = params.get('ENCODING', 'utf-8').lower()
        description = params.get('DESC', f'{file_name} dataset')
        
        # Validate and convert record length
        try:
            reclen = int(reclen_str)
            if reclen <= 0:
                raise ValueError("Record length must be positive")
            if reclen > 32767:
                raise ValueError("Record length cannot exceed 32767")
        except ValueError as e:
            print(f"[ERROR] Invalid RECLEN parameter: {e}")
            print("[INFO] Using default record length: 80")
            reclen = 80
        
        # Validate record type
        valid_rectypes = ['FB', 'VB', 'LB']
        if rectype not in valid_rectypes:
            print(f"[ERROR] Invalid RECTYPE '{rectype}'. Supported types: {', '.join(valid_rectypes)}")
            print("[INFO] Using default record type: FB")
            rectype = 'FB'
        
        # Validate encoding
        valid_encodings = ['utf-8', 'shift_jis', 'ascii', 'latin-1']
        if encoding not in valid_encodings:
            print(f"[WARNING] Unsupported encoding '{encoding}'. Using default: utf-8")
            encoding = 'utf-8'
        
        # Create empty dataset file
        try:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write("")  # Create empty dataset
        except Exception as e:
            print(f"[ERROR] Failed to create file: {e}")
            set_pgmec(999)
            return False
        
        # Update catalog with enhanced metadata
        try:
            update_catalog_info(
                volume=volume, 
                library=file_lib, 
                object_name=file_name,
                object_type="DATASET",
                RECTYPE=rectype, 
                RECLEN=reclen,
                ENCODING=encoding,
                DESCRIPTION=description
            )
        except Exception as e:
            print(f"[WARNING] Failed to update catalog: {e}")
            # Continue anyway since file was created successfully
        
        # Success output
        print(f"[INFO] Dataset '{file_name}' in library '{file_lib}' has been created: {file_path}")
        print(f"[INFO] Dataset registered in catalog.json:")
        print(f"       TYPE: DATASET")
        print(f"       RECTYPE: {rectype}")
        print(f"       RECLEN: {reclen}")
        print(f"       ENCODING: {encoding}")
        print(f"       DESCRIPTION: {description}")
        
        return True
        
    except Exception as e:
        print(f"[ERROR] CRTFILE command failed: {e}")
        set_pgmec(999)
        return False


# For backwards compatibility and testing
if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        CRTFILE(' '.join(sys.argv[1:]))