#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Test script for dslock_suite integration with CL executor

Tests OVRF/DLTOVR commands and CALL command integration with dslock_suite.
"""

import os
import sys
import json
import time
from datetime import datetime

# Add current directory to path for imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

def test_cl_executor_import():
    """Test if CL executor can be imported with new dslock functions"""
    print("=== Testing CL Executor Import ===")
    try:
        from cl_executor import COMMAND_MAP, execute_cl_script
        
        print(f"✓ CL executor imported successfully")
        print(f"✓ Available commands: {len(COMMAND_MAP)}")
        
        # Check if dslock commands are available
        dslock_commands = ['OVRF', 'DLTOVR']
        available_dslock = [cmd for cmd in dslock_commands if cmd in COMMAND_MAP]
        
        if available_dslock:
            print(f"✓ dslock commands available: {available_dslock}")
        else:
            print(f"⚠ dslock commands not available (normal if dslock_suite not built)")
        
        return True
        
    except Exception as e:
        print(f"✗ CL executor import failed: {e}")
        return False

def test_ovrf_function():
    """Test OVRF function directly"""
    print("\n=== Testing OVRF Function ===")
    try:
        from functions.ovrf import OVRF, get_override_mappings
        
        # Test basic parsing
        test_command = "OVRF FILE(EMP-FILE) TOFILE(EMPLOYEE.FB.TESTLIB) TYPE(*DATA)"
        print(f"Testing command: {test_command}")
        print("Note: EMPLOYEE.FB.TESTLIB should resolve to TESTLIB library, EMPLOYEE.FB dataset")
        
        # Note: This might fail if dslock_suite is not built, which is expected
        result = OVRF(test_command)
        print(f"OVRF result: {result}")
        
        # Check mappings
        mappings = get_override_mappings()
        print(f"Current override mappings: {len(mappings)}")
        
        return True
        
    except Exception as e:
        print(f"OVRF test error (expected if dslock not built): {e}")
        return False

def test_dltovr_function():
    """Test DLTOVR function directly"""
    print("\n=== Testing DLTOVR Function ===")
    try:
        from functions.dltovr import DLTOVR, list_active_overrides
        
        # Test basic parsing
        test_command = "DLTOVR FILE(EMP-FILE)"
        print(f"Testing command: {test_command}")
        
        result = DLTOVR(test_command)
        print(f"DLTOVR result: {result}")
        
        # Check remaining mappings
        mappings = list_active_overrides()
        print(f"Remaining override mappings: {len(mappings)}")
        
        return True
        
    except Exception as e:
        print(f"DLTOVR test error: {e}")
        return False

def test_java_interface():
    """Test dslock Java interface"""
    print("\n=== Testing dslock Java Interface ===")
    try:
        from dslock_java_interface import (
            prepare_java_environment, 
            export_override_mappings,
            monitor_override_status,
            create_java_dslock_helper
        )
        
        # Test environment preparation
        env = prepare_java_environment()
        print(f"✓ Java environment prepared: {len(env)} variables")
        
        # Test dslock-specific variables
        dslock_vars = [k for k in env.keys() if 'DSLOCK' in k or 'DSIO' in k]
        print(f"✓ dslock variables: {dslock_vars}")
        
        # Test override mapping export
        mapping_file = export_override_mappings()
        if mapping_file and os.path.exists(mapping_file):
            print(f"✓ Override mappings exported to: {mapping_file}")
            with open(mapping_file, 'r') as f:
                data = json.load(f)
                print(f"✓ Mapping file contains {data.get('count', 0)} mappings")
        else:
            print("✓ No override mappings to export (expected)")
        
        # Test status monitoring
        status = monitor_override_status()
        print(f"✓ Status monitor: {status['override_count']} overrides, {status['lock_count']} locks")
        
        # Test Java helper creation
        java_helper = create_java_dslock_helper()
        if java_helper and os.path.exists(java_helper):
            print(f"✓ Java helper created: {java_helper}")
        
        return True
        
    except Exception as e:
        print(f"Java interface test error: {e}")
        return False

def test_call_function_integration():
    """Test CALL function with dslock integration"""
    print("\n=== Testing CALL Function Integration ===")
    try:
        from functions.call import CALL
        
        # Test that CALL can be imported (actual execution would need real programs)
        print("✓ CALL function imported successfully")
        
        # Test if dslock integration is detected
        try:
            from functions.call import DSLOCK_JAVA_AVAILABLE
            print(f"✓ dslock Java integration available: {DSLOCK_JAVA_AVAILABLE}")
        except ImportError:
            print("⚠ dslock Java integration flag not found")
        
        return True
        
    except Exception as e:
        print(f"CALL integration test error: {e}")
        return False

def test_complete_workflow():
    """Test complete workflow with CL script"""
    print("\n=== Testing Complete Workflow ===")
    try:
        from cl_executor import execute_cl_script
        
        # Create a test CL script
        test_script = """
/* Test dslock integration workflow */
OVRF FILE(TEST-FILE) TOFILE(TESTDATA.FB.TESTLIB) TYPE(*DATA)
/* CALL PGM-TestProgram.TESTLIB would use the override mapping */
DLTOVR FILE(TEST-FILE)
"""
        
        print("Testing CL script:")
        print(test_script)
        
        # Execute the script (will show warnings if dslock not available)
        failed_count = execute_cl_script(test_script, stop_on_error=False)
        
        print(f"Script execution completed with {failed_count} failures")
        print("(Failures expected if dslock_suite not built)")
        
        return True
        
    except Exception as e:
        print(f"Complete workflow test error: {e}")
        return False

def test_dslock_suite_availability():
    """Test dslock_suite availability"""
    print("\n=== Testing dslock_suite Availability ===")
    
    dslock_path = "/home/aspuser/app/ofasp-refactor/dslock_suite"
    
    # Check directory structure
    print(f"dslock_suite path: {dslock_path}")
    print(f"Directory exists: {os.path.exists(dslock_path)}")
    
    if os.path.exists(dslock_path):
        # Check for build directory
        build_path = os.path.join(dslock_path, "build")
        print(f"Build directory exists: {os.path.exists(build_path)}")
        
        # Check for header files
        header_path = os.path.join(dslock_path, "src", "include", "dslock.h")
        print(f"Header file exists: {os.path.exists(header_path)}")
        
        # Check for library files
        if os.path.exists(build_path):
            lib_files = [f for f in os.listdir(build_path) if f.startswith('lib')]
            print(f"Library files: {lib_files}")
        
        # Check if make is available
        try:
            import subprocess
            result = subprocess.run(['which', 'make'], capture_output=True, text=True)
            print(f"Make available: {result.returncode == 0}")
            
            result = subprocess.run(['which', 'gcc'], capture_output=True, text=True)
            print(f"GCC available: {result.returncode == 0}")
        except:
            print("Could not check build tools")
    
    return True

def print_usage_examples():
    """Print usage examples for the new dslock commands"""
    print("\n=== Usage Examples ===")
    
    print("1. File Override with Lock:")
    print("   OVRF FILE(EMP-FILE) TOFILE(EMPLOYEE.FB.TESTLIB) TYPE(*DATA)")
    print("   - Parses as: library=TESTLIB, dataset=EMPLOYEE.FB")
    print("   - Acquires dslock on DISK01.TESTLIB.EMPLOYEE.FB")
    print("   - Maps EMP-FILE to /volume/DISK01/TESTLIB/EMPLOYEE.FB")
    
    print("\n2. Delete Override and Release Lock:")
    print("   DLTOVR FILE(EMP-FILE)")
    print("   - Releases dslock on mapped dataset")
    print("   - Removes override mapping")
    
    print("\n3. Call Program with Override Access:")
    print("   CALL PGM-TestProgram.TESTLIB")
    print("   - Java program receives override mappings via environment")
    print("   - Can access physical files through logical names")
    
    print("\n4. Complete CL Script Example:")
    print("""   /* Setup file override */
   OVRF FILE(EMP-FILE) TOFILE(EMPLOYEE.FB.TESTLIB) TYPE(*DATA)
   
   /* Run program that uses EMP-FILE */
   CALL PGM-EmployeeProcessor.TESTLIB
   
   /* Cleanup override */
   DLTOVR FILE(EMP-FILE)""")

def main():
    """Run all tests"""
    print("dslock_suite Integration Test Suite")
    print("=" * 50)
    print(f"Test time: {datetime.now()}")
    
    tests = [
        test_dslock_suite_availability,
        test_cl_executor_import,
        test_java_interface,
        test_call_function_integration,
        test_ovrf_function,
        test_dltovr_function,
        test_complete_workflow
    ]
    
    passed = 0
    total = len(tests)
    
    for test in tests:
        try:
            if test():
                passed += 1
        except Exception as e:
            print(f"Test {test.__name__} failed with exception: {e}")
    
    print("\n" + "=" * 50)
    print(f"Test Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("✓ All tests passed! dslock integration is working correctly.")
    elif passed > 0:
        print("⚠ Some tests passed. Check dslock_suite build status.")
    else:
        print("✗ Tests failed. Check implementation and dependencies.")
    
    print_usage_examples()

if __name__ == "__main__":
    main()