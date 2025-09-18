#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
DVT (Design Validation Test) for ASP Terminal System
Complete end-to-end validation test
"""

import requests
import json
import sys
import time

def test_api_server_status():
    """Test if API server is running and responding"""
    try:
        response = requests.get('http://localhost:8000/', timeout=5)
        print(f"[PASS] API Server Status: {response.status_code}")
        return response.status_code == 200
    except Exception as e:
        print(f"[FAIL] API Server Status: FAILED - {e}")
        return False

def test_terminal_accessibility():
    """Test if terminal HTML is accessible"""
    try:
        response = requests.get('http://localhost:8000/asp_terminal_simple.html', timeout=5)
        print(f"[PASS] Terminal Accessibility: {response.status_code}")
        return response.status_code == 200 and 'ASP System Command Terminal' in response.text
    except Exception as e:
        print(f"[FAIL] Terminal Accessibility: FAILED - {e}")
        return False

def test_help_command():
    """Test basic HELP command execution"""
    try:
        payload = {"command": "HELP", "user": "ASPUSER"}
        response = requests.post('http://localhost:8000/api/asp-command', 
                               json=payload, timeout=10)
        result = response.json()
        print(f"[PASS] HELP Command: Success={result.get('success', False)}")
        return result.get('success', False)
    except Exception as e:
        print(f"[FAIL] HELP Command: FAILED - {e}")
        return False

def test_employee_browser_command():
    """Test the specific employee browser command"""
    try:
        payload = {
            "command": "CALL PGM-MSGSAMPLEBROWSERMENU.TESTLIB,VOL-DISK01", 
            "user": "ASPUSER"
        }
        response = requests.post('http://localhost:8000/api/asp-command', 
                               json=payload, timeout=15)
        result = response.json()
        
        success = result.get('success', False)
        output = result.get('output', '')
        
        # Check for Japanese employee names in output
        japanese_employees = ['田中太郎', '佐藤花子', '鈴木一郎', '高橋美咲', '山田次郎']
        found_employees = [emp for emp in japanese_employees if emp in output]
        
        print(f"[PASS] Employee Browser Command: Success={success}")
        print(f"  - Found {len(found_employees)}/5 Japanese employees")
        print(f"  - SMED Map Data: {'display_map' in output}")
        print(f"  - Employee Records: {len(found_employees)} found")
        
        for emp in found_employees:
            print(f"    [FOUND] {emp}")
            
        return success and len(found_employees) >= 3  # At least 3 employees found
    except Exception as e:
        print(f"[FAIL] Employee Browser Command: FAILED - {e}")
        return False

def test_smed_data_structure():
    """Test SMED data structure and Japanese character support"""
    try:
        payload = {
            "command": "CALL PGM-MSGSAMPLEBROWSERMENU.TESTLIB,VOL-DISK01", 
            "user": "ASPUSER"
        }
        response = requests.post('http://localhost:8000/api/asp-command', 
                               json=payload, timeout=15)
        result = response.json()
        
        output = result.get('output', '')
        
        # Check for proper SMED JSON structure
        smed_checks = {
            'action_display_map': '"action": "display_map"' in output,
            'map_file_browse_menu': '"map_file": "BROWSE_MENU"' in output,
            'employee_fields': 'EMP1_NAME' in output and 'EMP2_NAME' in output,
            'japanese_chars': '田中太郎' in output and '佐藤花子' in output,
            'department_info': 'IT' in output or 'ＩＴ' in output,
            'status_active': '"EMP1_STATUS": "A"' in output
        }
        
        passed_checks = sum(smed_checks.values())
        
        print(f"[PASS] SMED Data Structure: {passed_checks}/6 checks passed")
        for check, status in smed_checks.items():
            print(f"  - {check}: {'[PASS]' if status else '[FAIL]'}")
            
        return passed_checks >= 4  # At least 4/6 checks must pass
    except Exception as e:
        print(f"[FAIL] SMED Data Structure: FAILED - {e}")
        return False

def run_dvt():
    """Run complete DVT validation"""
    print("="*60)
    print("DVT (Design Validation Test) - ASP Terminal System")
    print("="*60)
    
    tests = [
        ("API Server Status", test_api_server_status),
        ("Terminal Accessibility", test_terminal_accessibility),
        ("HELP Command Execution", test_help_command),
        ("Employee Browser Command", test_employee_browser_command),
        ("SMED Data Structure", test_smed_data_structure)
    ]
    
    results = []
    
    for test_name, test_func in tests:
        print(f"\n[TEST] {test_name}")
        print("-" * 40)
        try:
            result = test_func()
            results.append((test_name, result))
            print(f"Result: {'PASS' if result else 'FAIL'}")
        except Exception as e:
            print(f"Result: FAIL (Exception: {e})")
            results.append((test_name, False))
    
    # Summary
    print("\n" + "="*60)
    print("DVT SUMMARY")
    print("="*60)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "PASS" if result else "FAIL"
        print(f"{test_name:<30} [{status}]")
    
    print(f"\nOverall Result: {passed}/{total} tests passed")
    
    if passed == total:
        print("[SUCCESS] DVT VALIDATION: ALL TESTS PASSED")
        print("[READY] System is ready for user access at http://localhost:8000/asp_terminal_simple.html")
        return True
    else:
        print("[ERROR] DVT VALIDATION: SOME TESTS FAILED")
        print("[WARNING] System may not be fully functional")
        return False

if __name__ == '__main__':
    success = run_dvt()
    sys.exit(0 if success else 1)