# -*- coding: utf-8 -*-
"""
CRTLIB (Create Library) Command Implementation for OpenASP

Based on ASP CRTLIB command specifications.
Creates library directories in the volume structure.
"""

import os
import sys
from datetime import datetime

# Import from parent module
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from asp_commands import VOLUME_ROOT, set_pgmec

def CRTLIB(command: str) -> bool:
    """
    CRTLIB command - Create Library
    
    Format: CRTLIB LIB-LIBNAME,VOL-VOLUME
    
    Args:
        command: Full CRTLIB command string
        
    Returns:
        True if successful, False otherwise
    """
    try:
        # Parse command parameters
        params = {}
        command_str = command.replace('CRTLIB ', '').strip()
        
        for param in command_str.split(','):
            param = param.strip()
            if '-' in param:
                key, value = param.split('-', 1)
                params[key.strip().upper()] = value.strip()
        
        lib = params.get('LIB')
        volume = params.get('VOL')
        
        # Validate required parameters
        if not lib:
            print("[ERROR] LIB parameter is missing.")
            print("[USAGE] CRTLIB LIB-LIBNAME,VOL-VOLUME")
            set_pgmec(999)
            return False
        
        if not volume:
            print("[ERROR] VOL parameter is missing.")
            print("[USAGE] CRTLIB LIB-LIBNAME,VOL-VOLUME")
            set_pgmec(999)
            return False
        
        # Validate library name
        if not lib.replace('_', '').replace('-', '').isalnum():
            print(f"[ERROR] Invalid library name: {lib}")
            print("[INFO] Library names should contain only alphanumeric characters, hyphens, and underscores")
            set_pgmec(999)
            return False
        
        # Construct paths
        volume_path = os.path.join(VOLUME_ROOT, volume)
        lib_path = os.path.join(volume_path, lib)
        
        # Check if volume directory exists
        if not os.path.exists(volume_path):
            print(f"[ERROR] Volume '{volume}' does not exist.")
            print(f"[INFO] Volume path: {volume_path}")
            set_pgmec(999)
            return False
        
        # Check if library already exists
        if os.path.exists(lib_path):
            print(f"[ERROR] Library '{lib}' already exists in volume '{volume}'.")
            print(f"[INFO] Library path: {lib_path}")
            set_pgmec(999)
            return False
        
        # Create the library directory
        try:
            os.makedirs(lib_path, exist_ok=False)
            print(f"[INFO] Library '{lib}' in volume '{volume}' has been created: {lib_path}")
            
            # Set appropriate permissions
            os.chmod(lib_path, 0o755)
            
            return True
            
        except OSError as e:
            print(f"[ERROR] Failed to create library directory: {e}")
            set_pgmec(999)
            return False
        
    except Exception as e:
        print(f"[ERROR] CRTLIB command failed: {e}")
        set_pgmec(999)
        return False


# For backwards compatibility and testing
if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        CRTLIB(' '.join(sys.argv[1:]))