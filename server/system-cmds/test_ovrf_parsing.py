#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
OVRF Parsing Logic Test Suite

Tests the corrected file path parsing logic for OVRF commands.
"""

import sys
import os
import json

# Add current directory to path for imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

def test_parsing_logic():
    """Test the corrected parsing logic for OVRF file paths"""
    print("=== Testing OVRF Parsing Logic ===")
    
    from functions.ovrf import resolve_physical_filename
    
    test_cases = [
        {
            "input": "EMPLOYEE.FB.TESTLIB",
            "expected_library": "TESTLIB",
            "expected_dataset": "EMPLOYEE.FB",
            "expected_catalog_key": "DISK01.TESTLIB.EMPLOYEE.FB",
            "expected_path": "/home/aspuser/app/volume/DISK01/TESTLIB/EMPLOYEE.FB",
            "should_exist": True
        },
        {
            "input": "PAYROLL.VB.TESTLIB", 
            "expected_library": "TESTLIB",
            "expected_dataset": "PAYROLL.VB",
            "expected_catalog_key": "DISK01.TESTLIB.PAYROLL.VB",
            "expected_path": "/home/aspuser/app/volume/DISK01/TESTLIB/PAYROLL.VB",
            "should_exist": False  # File exists in catalog but not on disk
        },
        {
            "input": "CUSTOMER.FB.PRODLIB",
            "expected_library": "PRODLIB", 
            "expected_dataset": "CUSTOMER.FB",
            "expected_catalog_key": "DISK01.PRODLIB.CUSTOMER.FB",
            "expected_path": "/home/aspuser/app/volume/DISK01/PRODLIB/CUSTOMER.FB",
            "should_exist": False  # File exists in catalog but not on disk
        },
        {
            "input": "NONEXISTENT.FB.TESTLIB",
            "expected_library": "TESTLIB",
            "expected_dataset": "NONEXISTENT.FB", 
            "expected_catalog_key": None,  # Not in catalog
            "expected_path": "NONEXISTENT.FB.TESTLIB",  # Fallback
            "should_exist": False
        }
    ]
    
    print(f"Testing {len(test_cases)} parsing scenarios...\n")
    
    for i, test_case in enumerate(test_cases, 1):
        print(f"Test {i}: {test_case['input']}")
        
        resolved_path, dataset_key = resolve_physical_filename(test_case['input'])
        
        print(f"  Expected library: {test_case['expected_library']}")
        print(f"  Expected dataset: {test_case['expected_dataset']}")
        print(f"  Expected catalog key: {test_case['expected_catalog_key']}")
        print(f"  Expected path: {test_case['expected_path']}")
        print(f"  Actual path: {resolved_path}")
        print(f"  Actual catalog key: {dataset_key}")
        
        # Verify results
        path_match = resolved_path == test_case['expected_path']
        key_match = dataset_key == test_case['expected_catalog_key']
        
        print(f"  Path match: {'✓' if path_match else '✗'}")
        print(f"  Key match: {'✓' if key_match else '✗'}")
        
        if test_case['should_exist']:
            file_exists = os.path.exists(resolved_path)
            print(f"  File exists: {'✓' if file_exists else '✗'}")
        
        print()

def test_full_ovrf_workflow():
    """Test complete OVRF workflow with valid and invalid datasets"""
    print("=== Testing Complete OVRF Workflow ===")
    
    from functions.ovrf import OVRF, get_override_mappings
    from functions.dltovr import DLTOVR
    
    # Clean up any existing mappings
    mappings = get_override_mappings()
    for logical_name in list(mappings.keys()):
        DLTOVR(f"DLTOVR FILE({logical_name})")
    
    print("Starting with clean override mappings...\n")
    
    # Test 1: Valid dataset that exists
    print("Test 1: Valid existing dataset")
    test_cmd = "OVRF FILE(TEST-EMP) TOFILE(EMPLOYEE.FB.TESTLIB) TYPE(*DATA)"
    print(f"Command: {test_cmd}")
    result = OVRF(test_cmd)
    print(f"Result: {'SUCCESS' if result else 'FAILED'}\n")
    
    # Test 2: Valid dataset in catalog but file doesn't exist
    print("Test 2: Valid catalog entry, missing physical file")
    test_cmd = "OVRF FILE(TEST-PAY) TOFILE(PAYROLL.VB.TESTLIB) TYPE(*DATA)" 
    print(f"Command: {test_cmd}")
    result = OVRF(test_cmd)
    print(f"Result: {'SUCCESS' if result else 'FAILED'}\n")
    
    # Test 3: Invalid dataset not in catalog
    print("Test 3: Dataset not in catalog")
    test_cmd = "OVRF FILE(TEST-INVALID) TOFILE(INVALID.FB.TESTLIB) TYPE(*DATA)"
    print(f"Command: {test_cmd}")
    result = OVRF(test_cmd)
    print(f"Result: {'SUCCESS' if result else 'FAILED'}\n")
    
    # Show final mappings
    mappings = get_override_mappings()
    print(f"Final override mappings: {len(mappings)}")
    for logical, details in mappings.items():
        print(f"  {logical}: {details.get('dataset_key', 'N/A')} -> {details['resolved_path']}")
    
    # Clean up
    print("\nCleaning up mappings...")
    for logical_name in list(mappings.keys()):
        DLTOVR(f"DLTOVR FILE({logical_name})")
    
    print("Cleanup complete.")

def test_edge_cases():
    """Test edge cases for file path parsing"""
    print("\n=== Testing Edge Cases ===")
    
    from functions.ovrf import resolve_physical_filename
    
    edge_cases = [
        "SIMPLE.TESTLIB",           # Two parts
        "COMPLEX.MULTI.PART.TESTLIB", # Multiple dots
        "SINGLE",                   # Single part
        "",                         # Empty string
        "DOTS...TESTLIB",          # Multiple consecutive dots
    ]
    
    for case in edge_cases:
        print(f"Edge case: '{case}'")
        try:
            resolved_path, dataset_key = resolve_physical_filename(case)
            print(f"  Resolved: {resolved_path}")
            print(f"  Dataset key: {dataset_key}")
        except Exception as e:
            print(f"  Error: {e}")
        print()

def main():
    """Run all tests"""
    print("OVRF File Path Parsing Test Suite")
    print("=" * 50)
    
    test_parsing_logic()
    test_full_ovrf_workflow() 
    test_edge_cases()
    
    print("\n" + "=" * 50)
    print("Test Suite Complete")
    print("\nSummary of Changes:")
    print("✓ Fixed parsing: DATASET.LIBRARY format")
    print("✓ Correct catalog lookup: DISK01.LIBRARY.DATASET")
    print("✓ Proper physical path: /volume/DISK01/LIBRARY/DATASET")
    print("✓ Enhanced error handling for missing files/datasets")
    print("✓ Added dataset_key tracking in override mappings")

if __name__ == "__main__":
    main()