# -*- coding: utf-8 -*-
"""
DLTLIB (Delete Library) Command Implementation for OpenASP

Based on Fujitsu ASP DLTLIB command specifications.
Deletes library directories and all their contents from the volume structure.
"""

import os
import sys
import shutil
from datetime import datetime

# Import from parent module
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from asp_commands import VOLUME_ROOT, set_pgmec

def DLTLIB(command: str) -> bool:
    """
    DLTLIB command - Delete Library
    
    Format: DLTLIB LIB-LIBNAME,VOL-VOLUME
    
    Args:
        command: Full DLTLIB command string
        
    Returns:
        True if successful, False otherwise
    """
    try:
        # Parse command parameters
        params = {}
        command_str = command.replace('DLTLIB ', '').strip()
        
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
            print("[USAGE] DLTLIB LIB-LIBNAME,VOL-VOLUME")
            set_pgmec(999)
            return False
        
        if not volume:
            print("[ERROR] VOL parameter is missing.")
            print("[USAGE] DLTLIB LIB-LIBNAME,VOL-VOLUME")
            set_pgmec(999)
            return False
        
        # Construct paths
        volume_path = os.path.join(VOLUME_ROOT, volume)
        lib_path = os.path.join(volume_path, lib)
        
        # Check if volume exists
        if not os.path.exists(volume_path):
            print(f"[ERROR] Volume '{volume}' does not exist.")
            print(f"[INFO] Volume path: {volume_path}")
            set_pgmec(999)
            return False
        
        # Check if library exists
        if not os.path.exists(lib_path):
            print(f"[ERROR] Library '{lib}' does not exist in volume '{volume}'.")
            print(f"[INFO] Library path: {lib_path}")
            set_pgmec(999)
            return False
        
        # Check if it's actually a directory
        if not os.path.isdir(lib_path):
            print(f"[ERROR] '{lib}' is not a library directory.")
            set_pgmec(999)
            return False
        
        # Get library information before deletion
        try:
            file_count = 0
            dir_size = 0
            
            # Count files and calculate size
            for root, dirs, files in os.walk(lib_path):
                file_count += len(files)
                for file in files:
                    file_path = os.path.join(root, file)
                    try:
                        dir_size += os.path.getsize(file_path)
                    except (OSError, IOError):
                        pass  # Skip files that can't be accessed
            
            print(f"[INFO] Library '{lib}' contains {file_count} files, total size: {dir_size:,} bytes")
            
        except Exception as e:
            print(f"[DEBUG] Could not calculate library statistics: {e}")
        
        # Delete the library directory
        try:
            shutil.rmtree(lib_path)
            print(f"[INFO] Library '{lib}' in volume '{volume}' has been deleted.")
            print(f"[INFO] Library path: {lib_path}")
            
            return True
            
        except PermissionError:
            print(f"[ERROR] Permission denied. Cannot delete library '{lib}'.")
            print("[INFO] Check if any files in the library are currently in use.")
            set_pgmec(999)
            return False
        except OSError as e:
            print(f"[ERROR] Failed to delete library: {e}")
            set_pgmec(999)
            return False
        
    except Exception as e:
        print(f"[ERROR] DLTLIB command failed: {e}")
        set_pgmec(999)
        return False


# For backwards compatibility and testing
if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        DLTLIB(' '.join(sys.argv[1:]))