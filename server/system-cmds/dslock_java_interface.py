#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
dslock_java_interface.py - Java Integration for dslock_suite

Provides a bridge between Java programs and dslock_suite for distributed
file locking and override mapping functionality.

This module enables Java programs to:
1. Access override mappings created by OVRF commands
2. Use dslock_suite APIs for file operations
3. Maintain consistency with CL command override state

Features:
- Environment variable setup for Java programs
- Override mapping JSON export for Java consumption
- Lock status monitoring and validation
- Integration with existing CALL command execution
"""

import os
import sys
import json
import subprocess
import threading
import tempfile
from typing import Dict, List, Optional, Tuple
from datetime import datetime

# Import override mappings from ovrf module
try:
    from functions.ovrf import override_mappings, override_locks, mapping_lock, get_override_mappings
    from functions.dltovr import list_active_overrides
    OVERRIDE_MODULES_AVAILABLE = True
except ImportError:
    # Fallback definitions
    override_mappings = {}
    override_locks = {}
    mapping_lock = threading.Lock()
    OVERRIDE_MODULES_AVAILABLE = False

# Configuration
DSLOCK_SUITE_PATH = "/home/aspuser/app/ofasp-refactor/dslock_suite"
JAVA_RUNTIME_DIR = "/tmp/dslock_java_runtime"
OVERRIDE_MAPPING_FILE = os.path.join(JAVA_RUNTIME_DIR, "override_mappings.json")
DSLOCK_ENV_FILE = os.path.join(JAVA_RUNTIME_DIR, "dslock_env.properties")

DSLOCK_CONFIG = {
    "DSIO_ROOT": "/dev/shm",
    "DSIO_ATOMIC": "1",
    "RECFM_FB_NEWLINE": "1",
    "RECFM_VB_NEWLINE": "0"
}

def ensure_runtime_directory():
    """Ensure Java runtime directory exists"""
    if not os.path.exists(JAVA_RUNTIME_DIR):
        os.makedirs(JAVA_RUNTIME_DIR, exist_ok=True)
        print(f"[DSLOCK_JAVA] Created runtime directory: {JAVA_RUNTIME_DIR}")

def setup_dslock_environment() -> Dict[str, str]:
    """
    Setup environment variables for dslock_suite
    
    Returns:
        Dictionary of environment variables
    """
    env_vars = DSLOCK_CONFIG.copy()
    
    # Set config path if not already set
    config_path = os.path.join(DSLOCK_SUITE_PATH, "config", "config.json")
    if os.path.exists(config_path):
        env_vars["DSIO_CONFIG"] = config_path
    
    # Set catalog path
    catalog_path = os.path.join(DSLOCK_SUITE_PATH, "config", "catalog.jsonl")
    env_vars["DSIO_CATALOG"] = catalog_path
    
    # Add dslock library path
    dslock_lib_path = os.path.join(DSLOCK_SUITE_PATH, "build")
    if "LD_LIBRARY_PATH" in os.environ:
        env_vars["LD_LIBRARY_PATH"] = f"{dslock_lib_path}:{os.environ['LD_LIBRARY_PATH']}"
    else:
        env_vars["LD_LIBRARY_PATH"] = dslock_lib_path
    
    return env_vars

def export_override_mappings() -> str:
    """
    Export current override mappings to JSON file for Java consumption
    
    Returns:
        Path to the exported JSON file
    """
    ensure_runtime_directory()
    
    try:
        # Try to get mappings from current process context first
        mappings = {}
        if OVERRIDE_MODULES_AVAILABLE:
            mappings = get_override_mappings()
        
        # If no mappings found, try to read from persistent file created by OVRF
        if not mappings:
            try:
                persistent_file = "/tmp/dslock_java_runtime/ovrf_mappings.json"
                if os.path.exists(persistent_file):
                    with open(persistent_file, 'r') as f:
                        data = json.load(f)
                        mappings = data.get('mappings', {})
                        print(f"[DSLOCK_JAVA_DEBUG] Retrieved mappings from persistent file: {mappings}")
                else:
                    print(f"[DSLOCK_JAVA_DEBUG] Persistent file does not exist: {persistent_file}")
            except Exception as e:
                print(f"[DSLOCK_JAVA_DEBUG] Failed to read persistent file: {e}")
        
        # If no mappings found, try to access them directly from the module's global state
        if not mappings:
            try:
                # Import fresh to get current state
                import importlib
                import sys
                if 'functions.ovrf' in sys.modules:
                    importlib.reload(sys.modules['functions.ovrf'])
                from functions.ovrf import override_mappings as current_mappings, mapping_lock as current_lock
                with current_lock:
                    mappings = current_mappings.copy()
                    print(f"[DSLOCK_JAVA_DEBUG] Retrieved mappings from reloaded module: {mappings}")
            except Exception as e:
                print(f"[DSLOCK_JAVA_DEBUG] Failed to reload module: {e}")
        
        # Fallback to global state if available
        if not mappings and OVERRIDE_MODULES_AVAILABLE:
            with mapping_lock:
                mappings = override_mappings.copy()
        
        # Prepare data for Java consumption
        # Convert dataset_name from underscore to slash format for consistency
        print(f"[DSLOCK_JAVA_DEBUG] Raw mappings received: {mappings}")
        converted_mappings = {}
        for logical_name, mapping_info in mappings.items():
            converted_info = mapping_info.copy()
            
            # Convert dataset_name to slash format if it exists
            if "dataset_name" in converted_info:
                dataset_name = converted_info["dataset_name"]
                print(f"[DSLOCK_JAVA_DEBUG] Original dataset_name for {logical_name}: {dataset_name}")
                
                # Convert underscore format to slash format
                if "_" in dataset_name and "/" not in dataset_name:
                    # Split by underscore and rebuild with slashes
                    parts = dataset_name.split("_")
                    if len(parts) >= 3:
                        volume = parts[0]
                        library = parts[1]
                        dataset = "_".join(parts[2:])  # Rejoin remaining parts
                        converted_info["dataset_name"] = f"{volume}/{library}/{dataset}"
                        print(f"[DSLOCK_JAVA_DEBUG] Converted dataset_name for {logical_name}: {converted_info['dataset_name']}")
                    else:
                        print(f"[DSLOCK_JAVA_DEBUG] Dataset name has underscores but not enough parts: {dataset_name}")
                else:
                    print(f"[DSLOCK_JAVA_DEBUG] Dataset name already has slashes or no underscores: {dataset_name}")
            
            converted_mappings[logical_name] = converted_info
        
        java_mappings = {
            "timestamp": datetime.now().isoformat(),
            "count": len(converted_mappings),
            "mappings": converted_mappings,
            "active_locks": {}
        }
        
        # Add lock information with converted dataset names
        converted_locks = {}
        
        # Try to get locks from persistent file first
        try:
            persistent_file = "/tmp/dslock_java_runtime/ovrf_mappings.json"
            if os.path.exists(persistent_file):
                with open(persistent_file, 'r') as f:
                    data = json.load(f)
                    persistent_locks = data.get('locks', {})
                    print(f"[DSLOCK_JAVA_DEBUG] Retrieved locks from persistent file: {persistent_locks}")
                    
                    for logical_name, dataset_name in persistent_locks.items():
                        # Convert underscore format to slash format
                        if "_" in dataset_name and "/" not in dataset_name:
                            parts = dataset_name.split("_")
                            if len(parts) >= 3:
                                volume = parts[0]
                                library = parts[1]
                                dataset = "_".join(parts[2:])
                                converted_locks[logical_name] = f"{volume}/{library}/{dataset}"
                            else:
                                converted_locks[logical_name] = dataset_name
                        else:
                            converted_locks[logical_name] = dataset_name
        except Exception as e:
            print(f"[DSLOCK_JAVA_DEBUG] Failed to read locks from persistent file: {e}")
        
        # Fallback to module state if no locks found
        if not converted_locks:
            with mapping_lock:
                for logical_name, dataset_name in override_locks.items():
                    # Convert underscore format to slash format
                    if "_" in dataset_name and "/" not in dataset_name:
                        parts = dataset_name.split("_")
                        if len(parts) >= 3:
                            volume = parts[0]
                            library = parts[1]
                            dataset = "_".join(parts[2:])
                            converted_locks[logical_name] = f"{volume}/{library}/{dataset}"
                        else:
                            converted_locks[logical_name] = dataset_name
                    else:
                        converted_locks[logical_name] = dataset_name
        
        java_mappings["active_locks"] = converted_locks
        
        # Write to JSON file
        with open(OVERRIDE_MAPPING_FILE, 'w') as f:
            json.dump(java_mappings, f, indent=2)
        
        print(f"[DSLOCK_JAVA] Exported {len(mappings)} override mappings to: {OVERRIDE_MAPPING_FILE}")
        return OVERRIDE_MAPPING_FILE
        
    except Exception as e:
        print(f"[ERROR] Failed to export override mappings: {str(e)}")
        return ""

def export_dslock_environment() -> str:
    """
    Export dslock environment configuration to properties file for Java
    
    Returns:
        Path to the exported properties file
    """
    ensure_runtime_directory()
    
    try:
        env_vars = setup_dslock_environment()
        
        # Write properties file
        with open(DSLOCK_ENV_FILE, 'w') as f:
            f.write("# dslock_suite Environment Configuration\n")
            f.write(f"# Generated: {datetime.now().isoformat()}\n\n")
            
            for key, value in env_vars.items():
                f.write(f"{key}={value}\n")
        
        print(f"[DSLOCK_JAVA] Exported dslock environment to: {DSLOCK_ENV_FILE}")
        return DSLOCK_ENV_FILE
        
    except Exception as e:
        print(f"[ERROR] Failed to export dslock environment: {str(e)}")
        return ""

def prepare_java_environment() -> Dict[str, str]:
    """
    Prepare complete environment for Java program execution
    
    Returns:
        Dictionary of environment variables for Java execution
    """
    # Start with current environment
    java_env = os.environ.copy()
    
    # Add dslock configuration
    dslock_env = setup_dslock_environment()
    java_env.update(dslock_env)
    
    # Export override mappings
    mapping_file = export_override_mappings()
    if mapping_file:
        java_env["DSLOCK_OVERRIDE_MAPPINGS"] = mapping_file
    
    # Export environment configuration
    env_file = export_dslock_environment()
    if env_file:
        java_env["DSLOCK_ENV_CONFIG"] = env_file
    
    # Add Java-specific dslock integration flags
    java_env["DSLOCK_JAVA_INTEGRATION"] = "1"
    java_env["DSLOCK_RUNTIME_DIR"] = JAVA_RUNTIME_DIR
    
    return java_env

def validate_override_access(logical_name: str) -> Tuple[bool, str, str]:
    """
    Validate that a logical file override is accessible
    
    Args:
        logical_name: Logical file name to validate
        
    Returns:
        Tuple of (is_valid, physical_path, error_message)
    """
    try:
        with mapping_lock:
            if logical_name not in override_mappings:
                return False, "", f"Override mapping not found for: {logical_name}"
            
            mapping_info = override_mappings[logical_name]
            physical_path = mapping_info.get("resolved_path", "")
            
            if not physical_path:
                return False, "", f"No resolved path for override: {logical_name}"
            
            if not os.path.exists(physical_path):
                return False, physical_path, f"Physical file does not exist: {physical_path}"
            
            return True, physical_path, ""
            
    except Exception as e:
        return False, "", f"Exception during validation: {str(e)}"

def get_java_dslock_api_template() -> str:
    """
    Generate Java code template for dslock API usage
    
    Returns:
        Java code template as string
    """
    template = '''
// dslock_suite Java Integration Template
// This template shows how to integrate with dslock_suite from Java

import java.io.*;
import java.util.*;
import com.fasterxml.jackson.databind.ObjectMapper;

public class DslockJavaAPI {
    private static final String DSLOCK_OVERRIDE_MAPPINGS = System.getenv("DSLOCK_OVERRIDE_MAPPINGS");
    private static final String DSLOCK_ENV_CONFIG = System.getenv("DSLOCK_ENV_CONFIG");
    private static final String DSLOCK_RUNTIME_DIR = System.getenv("DSLOCK_RUNTIME_DIR");
    
    private Map<String, Object> overrideMappings = new HashMap<>();
    
    public DslockJavaAPI() {
        loadOverrideMappings();
    }
    
    /**
     * Load override mappings from JSON file
     */
    private void loadOverrideMappings() {
        if (DSLOCK_OVERRIDE_MAPPINGS == null) {
            System.err.println("[DSLOCK] No override mappings file specified");
            return;
        }
        
        try {
            ObjectMapper mapper = new ObjectMapper();
            File mappingFile = new File(DSLOCK_OVERRIDE_MAPPINGS);
            
            if (mappingFile.exists()) {
                Map<String, Object> data = mapper.readValue(mappingFile, Map.class);
                this.overrideMappings = (Map<String, Object>) data.get("mappings");
                
                System.out.println("[DSLOCK] Loaded " + this.overrideMappings.size() + " override mappings");
            }
        } catch (Exception e) {
            System.err.println("[DSLOCK] Failed to load override mappings: " + e.getMessage());
        }
    }
    
    /**
     * Get physical file path for logical name
     */
    public String getPhysicalFile(String logicalName) {
        Map<String, Object> mapping = (Map<String, Object>) overrideMappings.get(logicalName);
        if (mapping != null) {
            return (String) mapping.get("resolved_path");
        }
        return null;
    }
    
    /**
     * Check if logical file has override mapping
     */
    public boolean hasOverride(String logicalName) {
        return overrideMappings.containsKey(logicalName);
    }
    
    /**
     * Get all active override mappings
     */
    public Set<String> getLogicalNames() {
        return overrideMappings.keySet();
    }
    
    /**
     * Print override mapping information
     */
    public void printMappings() {
        System.out.println("[DSLOCK] Active Override Mappings:");
        for (String logical : overrideMappings.keySet()) {
            Map<String, Object> mapping = (Map<String, Object>) overrideMappings.get(logical);
            String physical = (String) mapping.get("physical_file");
            String resolved = (String) mapping.get("resolved_path");
            
            System.out.println("  " + logical + " -> " + physical);
            System.out.println("    Resolved: " + resolved);
        }
    }
}
'''
    return template

def create_java_dslock_helper() -> str:
    """
    Create Java helper class file for dslock integration
    
    Returns:
        Path to created Java file
    """
    ensure_runtime_directory()
    
    java_file = os.path.join(JAVA_RUNTIME_DIR, "DslockJavaAPI.java")
    
    try:
        template = get_java_dslock_api_template()
        
        with open(java_file, 'w') as f:
            f.write(template)
        
        print(f"[DSLOCK_JAVA] Created Java helper: {java_file}")
        return java_file
        
    except Exception as e:
        print(f"[ERROR] Failed to create Java helper: {str(e)}")
        return ""

def monitor_override_status() -> Dict[str, any]:
    """
    Monitor current override and lock status
    
    Returns:
        Dictionary with status information
    """
    status = {
        "timestamp": datetime.now().isoformat(),
        "override_count": 0,
        "lock_count": 0,
        "runtime_dir": JAVA_RUNTIME_DIR,
        "files": {
            "mappings": OVERRIDE_MAPPING_FILE,
            "environment": DSLOCK_ENV_FILE
        },
        "environment": {},
        "active_overrides": []
    }
    
    try:
        # Count overrides and locks
        with mapping_lock:
            status["override_count"] = len(override_mappings)
            status["lock_count"] = len(override_locks)
            
            # Get override details
            for logical_name, mapping_info in override_mappings.items():
                override_detail = {
                    "logical_name": logical_name,
                    "physical_file": mapping_info.get("physical_file", ""),
                    "dataset_name": mapping_info.get("dataset_name", ""),
                    "created": mapping_info.get("created", ""),
                    "pid": mapping_info.get("pid", 0)
                }
                status["active_overrides"].append(override_detail)
        
        # Environment status
        status["environment"] = setup_dslock_environment()
        
        # File existence checks
        for file_type, file_path in status["files"].items():
            status["files"][file_type + "_exists"] = os.path.exists(file_path)
        
    except Exception as e:
        status["error"] = str(e)
    
    return status

def cleanup_java_runtime():
    """Clean up Java runtime files"""
    try:
        files_to_remove = [OVERRIDE_MAPPING_FILE, DSLOCK_ENV_FILE]
        
        for file_path in files_to_remove:
            if os.path.exists(file_path):
                os.remove(file_path)
                print(f"[DSLOCK_JAVA] Removed: {file_path}")
        
        # Remove helper Java file if exists
        java_helper = os.path.join(JAVA_RUNTIME_DIR, "DslockJavaAPI.java")
        if os.path.exists(java_helper):
            os.remove(java_helper)
            print(f"[DSLOCK_JAVA] Removed: {java_helper}")
        
    except Exception as e:
        print(f"[ERROR] Failed to cleanup Java runtime: {str(e)}")

# Test and utility functions
if __name__ == "__main__":
    print("dslock_java_interface.py - Testing")
    
    # Test environment setup
    print("\n=== Environment Setup ===")
    env = prepare_java_environment()
    print(f"Environment variables: {len(env)}")
    
    # Test override mapping export
    print("\n=== Override Mapping Export ===")
    mapping_file = export_override_mappings()
    if mapping_file and os.path.exists(mapping_file):
        print(f"Mapping file created: {mapping_file}")
        with open(mapping_file, 'r') as f:
            data = json.load(f)
            print(f"Mappings count: {data.get('count', 0)}")
    
    # Test Java helper creation
    print("\n=== Java Helper Creation ===")
    java_file = create_java_dslock_helper()
    if java_file and os.path.exists(java_file):
        print(f"Java helper created: {java_file}")
    
    # Monitor status
    print("\n=== Status Monitor ===")
    status = monitor_override_status()
    print(json.dumps(status, indent=2))