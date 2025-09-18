# -*- coding: utf-8 -*-
"""
DLTFILE (Delete File) Command Implementation for OpenASP

Based on ASP DLTFILE command specifications.
Deletes dataset files and removes them from the catalog system.
"""

import os
import sys
import json
from datetime import datetime

# Import from parent module
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from asp_commands import VOLUME_ROOT, get_catalog_info, set_pgmec, CATALOG_FILE, delete_catalog_object

def DLTFILE(command: str) -> bool:
    """
    DLTFILE command - Delete File/Dataset
    
    Format: DLTFILE FILE(LIB/FILENAME),VOL-VOLUME
    
    Args:
        command: Full DLTFILE command string
        
    Returns:
        True if successful, False otherwise
    """
    try:
        # Parse command
        main_part, *others = command.replace('DLTFILE ', '').split(',')
        
        # Parse FILE(LIB/FILENAME) parameter
        if not main_part.startswith('FILE(') or not main_part.endswith(')'):
            print("[ERROR] Invalid FILE parameter format. Expected: FILE(LIB/FILENAME)")
            print("[USAGE] DLTFILE FILE(LIB/FILENAME),VOL-VOLUME")
            set_pgmec(999)
            return False
        
        file_spec = main_part[5:-1]  # Remove FILE( and )
        if '/' not in file_spec:
            print("[ERROR] Invalid file specification. Expected: LIB/FILENAME")
            print("[USAGE] DLTFILE FILE(LIB/FILENAME),VOL-VOLUME")
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
            print("[USAGE] DLTFILE FILE(LIB/FILENAME),VOL-VOLUME")
            set_pgmec(999)
            return False
        
        # Construct paths
        lib_path = os.path.join(VOLUME_ROOT, volume, file_lib)
        file_path = os.path.join(lib_path, file_name)
        
        # Validate library exists
        if not os.path.exists(lib_path):
            print(f"[ERROR] Library '{file_lib}' does not exist in volume '{volume}'.")
            set_pgmec(999)
            return False
        
        # Check if file exists (warning only, not error)
        file_exists = os.path.exists(file_path)
        if not file_exists:
            print(f"[WARNING] Dataset '{file_name}' does not exist physically in library '{file_lib}' - will delete from catalog only")
        elif not os.path.isfile(file_path):
            print(f"[WARNING] '{file_name}' is not a file - will delete from catalog only")
            file_exists = False
        
        # Get file information before deletion for logging (if file exists)
        file_size = 0
        modified_time = "Unknown"
        if file_exists:
            try:
                file_size = os.path.getsize(file_path)
                modified_time = datetime.fromtimestamp(os.path.getmtime(file_path)).strftime('%Y-%m-%d %H:%M:%S')
            except Exception as e:
                print(f"[WARNING] Could not get file information: {e}")
                file_exists = False
        
        # Get catalog information
        catalog = get_catalog_info()
        catalog_entry = None
        if (volume in catalog and file_lib in catalog[volume] and 
            file_name in catalog[volume][file_lib]):
            catalog_entry = catalog[volume][file_lib][file_name].copy()
        
        try:
            # Remove the physical file (if it exists)
            if file_exists:
                os.remove(file_path)
                print(f"[INFO] Dataset '{file_name}' in library '{file_lib}' has been deleted: {file_path}")
                print(f"[INFO] File size: {file_size} bytes, Last modified: {modified_time}")
            else:
                print(f"[INFO] Physical file does not exist, proceeding with catalog deletion only")
            
            # PostgreSQL DBIOシステムからカタログを削除
            try:
                catalog_deleted = delete_catalog_object(volume, file_lib, file_name)
                if catalog_deleted:
                    print(f"[INFO] Dataset '{file_name}' removed from PostgreSQL catalog")
                    
                    # 削除されたカタログエントリの詳細をログ出力
                    if catalog_entry:
                        if catalog_entry.get('TYPE') == 'DATASET':
                            print(f"[INFO] Removed dataset metadata:")
                            print(f"       TYPE: {catalog_entry.get('TYPE', 'Unknown')}")
                            print(f"       RECTYPE: {catalog_entry.get('RECTYPE', 'Unknown')}")
                            print(f"       RECLEN: {catalog_entry.get('RECLEN', 'Unknown')}")
                            print(f"       ENCODING: {catalog_entry.get('ENCODING', 'Unknown')}")
                else:
                    print(f"[WARNING] Failed to remove dataset '{file_name}' from catalog (物理削除は成功)")
            except Exception as e:
                print(f"[WARNING] Catalog delete failed: {e} (物理削除は成功)")
                
            if not catalog_entry:
                print(f"[WARNING] Dataset '{file_name}' was not registered in catalog")
            
            return True
            
        except Exception as e:
            print(f"[ERROR] Failed to delete dataset: {e}")
            set_pgmec(999)
            return False
        
    except Exception as e:
        print(f"[ERROR] DLTFILE command failed: {e}")
        set_pgmec(999)
        return False


# For backwards compatibility and testing
if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        DLTFILE(' '.join(sys.argv[1:]))