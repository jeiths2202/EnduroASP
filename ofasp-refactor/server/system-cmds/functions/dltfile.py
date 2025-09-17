# -*- coding: utf-8 -*-
"""
DLTFILE (Delete File) Command Implementation for OpenASP

Based on Fujitsu ASP DLTFILE command specifications.
Deletes dataset files and removes them from the catalog system.
"""

import os
import sys
import json
from datetime import datetime

# Import from parent module
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from asp_commands import VOLUME_ROOT, get_catalog_info, set_pgmec, CATALOG_FILE

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
        
        # Validate file exists
        if not os.path.exists(file_path):
            print(f"[ERROR] Dataset '{file_name}' does not exist in library '{file_lib}'.")
            set_pgmec(999)
            return False
        
        # Check if file is actually a file (not a directory)
        if not os.path.isfile(file_path):
            print(f"[ERROR] '{file_name}' is not a file.")
            set_pgmec(999)
            return False
        
        # Get file information before deletion for logging
        file_size = os.path.getsize(file_path)
        modified_time = datetime.fromtimestamp(os.path.getmtime(file_path)).strftime('%Y-%m-%d %H:%M:%S')
        
        # Get catalog information
        catalog = get_catalog_info()
        catalog_entry = None
        if (volume in catalog and file_lib in catalog[volume] and 
            file_name in catalog[volume][file_lib]):
            catalog_entry = catalog[volume][file_lib][file_name].copy()
        
        try:
            # Remove the physical file
            os.remove(file_path)
            print(f"[INFO] Dataset '{file_name}' in library '{file_lib}' has been deleted: {file_path}")
            print(f"[INFO] File size: {file_size} bytes, Last modified: {modified_time}")
            
            # Remove from catalog
            if catalog_entry:
                del catalog[volume][file_lib][file_name]
                
                # Clean up empty structures
                if not catalog[volume][file_lib]:
                    del catalog[volume][file_lib]
                    print(f"[INFO] Empty library '{file_lib}' removed from catalog")
                
                if not catalog[volume]:
                    del catalog[volume]
                    print(f"[INFO] Empty volume '{volume}' removed from catalog")
                
                # Save updated catalog
                try:
                    with open(CATALOG_FILE, 'w', encoding='utf-8') as f:
                        json.dump(catalog, f, indent=2, ensure_ascii=False)
                    print(f"[INFO] Dataset '{file_name}' removed from catalog.json")
                    
                    # Log removed catalog entry details
                    if catalog_entry.get('TYPE') == 'DATASET':
                        print(f"[INFO] Removed dataset metadata:")
                        print(f"       TYPE: {catalog_entry.get('TYPE', 'Unknown')}")
                        print(f"       RECTYPE: {catalog_entry.get('RECTYPE', 'Unknown')}")
                        print(f"       RECLEN: {catalog_entry.get('RECLEN', 'Unknown')}")
                        print(f"       ENCODING: {catalog_entry.get('ENCODING', 'Unknown')}")
                        
                except Exception as e:
                    print(f"[WARNING] Failed to update catalog.json: {e}")
                    # Don't fail the operation since the file was successfully deleted
            else:
                print(f"[WARNING] Dataset '{file_name}' was not registered in catalog.json")
            
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