# -*- coding: utf-8 -*-
"""
DLTLIB (Delete Library) Command Implementation for OpenASP

Based on ASP DLTLIB command specifications.
Deletes library directories and all their contents from the volume structure.
"""

import os
import sys
import shutil
from datetime import datetime

# Import from parent module
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from asp_commands import VOLUME_ROOT, set_pgmec, delete_catalog_library

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
        
        # Check if library exists (warning only, not error)
        lib_exists = os.path.exists(lib_path) and os.path.isdir(lib_path)
        if not os.path.exists(lib_path):
            print(f"[WARNING] Library '{lib}' does not exist physically in volume '{volume}' - will delete from catalog only")
            print(f"[INFO] Library path: {lib_path}")
            lib_exists = False
        elif not os.path.isdir(lib_path):
            print(f"[WARNING] '{lib}' is not a library directory - will delete from catalog only")
            lib_exists = False
        
        # Get library information before deletion (if library exists)
        file_count = 0
        dir_size = 0
        
        if lib_exists:
            try:
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
        else:
            print(f"[INFO] Physical library does not exist - no files to count")
        
        # Delete the library directory (if it exists)
        try:
            if lib_exists:
                shutil.rmtree(lib_path)
                print(f"[INFO] Library '{lib}' in volume '{volume}' has been deleted.")
                print(f"[INFO] Library path: {lib_path}")
            else:
                print(f"[INFO] Physical library does not exist, proceeding with catalog deletion only")
            
            # PostgreSQL DBIOシステムからカタログを削除
            try:
                catalog_deleted = delete_catalog_library(volume, lib)
                if catalog_deleted:
                    print(f"[INFO] Library '{lib}' removed from PostgreSQL catalog")
                else:
                    print(f"[WARNING] Failed to remove library '{lib}' from catalog")
            except Exception as e:
                print(f"[WARNING] Catalog delete failed: {e}")
            
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