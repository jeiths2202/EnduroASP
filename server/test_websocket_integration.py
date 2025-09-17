#!/usr/bin/env python3
"""
WebSocket Integration Test for MSGSAMPLEBROWSERMENU Data Display Issue

This script tests the complete data flow:
1. Java program generates correct JSON
2. call.py sends it to API server
3. API server routes data via WebSocket to terminal
4. Terminal receives and displays SMED field data

Usage:
    python test_websocket_integration.py
"""

import requests
import json
import time
import sys
from datetime import datetime

def test_api_server_health():
    """Test if API server is running and healthy"""
    try:
        response = requests.get("http://localhost:8000/api/health", timeout=5)
        if response.status_code == 200:
            health_data = response.json()
            print("[OK] API Server is healthy")
            print(f"  Version: {health_data.get('version')}")
            print(f"  Java Available: {health_data.get('java_available')}")
            print(f"  JAR Exists: {health_data.get('jar_exists')}")
            return True
        else:
            print(f"[FAIL] API Server unhealthy: {response.status_code}")
            return False
    except Exception as e:
        print(f"[FAIL] API Server connection failed: {e}")
        return False

def test_terminal_status():
    """Check current terminal registrations"""
    try:
        response = requests.get("http://localhost:8000/api/terminals", timeout=5)
        if response.status_code == 200:
            terminals_data = response.json()
            print("[OK] Terminal status retrieved")
            print(f"  Active terminals: {terminals_data.get('count', 0)}")
            print(f"  Registered terminal IDs: {terminals_data.get('registered_terminal_ids', [])}")
            print(f"  Terminal mappings: {terminals_data.get('terminal_mappings', {})}")
            
            if 'webui' in terminals_data.get('registered_terminal_ids', []):
                print("[OK] 'webui' terminal is registered")
                return True
            else:
                print("[FAIL] 'webui' terminal is NOT registered")
                return False
        else:
            print(f"[FAIL] Failed to get terminal status: {response.status_code}")
            return False
    except Exception as e:
        print(f"[FAIL] Terminal status check failed: {e}")
        return False

def test_smed_populate_endpoint():
    """Test the /api/smed/populate endpoint with sample data"""
    try:
        # Sample SMED field data (similar to what Java programs generate)
        test_data = {
            "map_file": "MSGSAMPLEBROWSERMENU",
            "terminal_id": "webui",
            "fields": {
                "TITLE1": "Employee Data Browser",
                "TITLE2": "OpenASP ブラウザメニュー",
                "EMP1_ID": "E001",
                "EMP1_NAME": "田中 太郎",
                "EMP1_DEPT": "営業部",
                "EMP1_SALARY": "450000",
                "EMP1_HIREDATE": "2020/04/01",
                "EMP1_STATUS": "在職",
                "EMP2_ID": "E002",
                "EMP2_NAME": "佐藤 花子",
                "EMP2_DEPT": "開発部",
                "EMP2_SALARY": "520000",
                "EMP2_HIREDATE": "2019/06/15",
                "EMP2_STATUS": "在職",
                "PAGE_CURRENT": "1",
                "PAGE_TOTAL": "5",
                "MSG_STATUS": "データ取得完了"
            }
        }
        
        print(f"-> Sending test data to /api/smed/populate")
        print(f"  Map file: {test_data['map_file']}")
        print(f"  Terminal ID: {test_data['terminal_id']}")
        print(f"  Field count: {len(test_data['fields'])}")
        
        response = requests.post(
            "http://localhost:8000/api/smed/populate",
            json=test_data,
            timeout=10
        )
        
        if response.status_code == 200:
            result_data = response.json()
            print("[OK] SMED populate request successful")
            print(f"  Delivered: {result_data.get('delivered', 'Unknown')}")
            print(f"  Message: {result_data.get('message', 'No message')}")
            
            if result_data.get('delivered'):
                print("[OK] Data successfully delivered to terminal")
                return True
            else:
                print("[FAIL] Data was not delivered to terminal")
                print(f"  Available terminals: {result_data.get('available_terminals', [])}")
                return False
        else:
            print(f"[FAIL] SMED populate request failed: {response.status_code}")
            print(f"  Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"[FAIL] SMED populate test failed: {e}")
        return False

def test_terminal_connection(terminal_id="webui"):
    """Test direct connection to a specific terminal"""
    try:
        response = requests.post(f"http://localhost:8000/api/terminals/test/{terminal_id}", timeout=5)
        if response.status_code == 200:
            result_data = response.json()
            print(f"[OK] Terminal connection test for '{terminal_id}' completed")
            print(f"  Test sent: {result_data.get('test_sent', False)}")
            print(f"  Message: {result_data.get('message', 'No message')}")
            return result_data.get('test_sent', False)
        else:
            print(f"[FAIL] Terminal connection test failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"[FAIL] Terminal connection test failed: {e}")
        return False

def simulate_java_program_execution():
    """Simulate Java program execution that calls the API"""
    try:
        print("-> Simulating Java program execution (MSGSAMPLEBROWSERMENU)")
        
        # This simulates what the Java program would output and call.py would process
        java_output_simulation = {
            "action": "display_map",
            "map_file": "MSGSAMPLEBROWSERMENU",
            "fields": {
                "TITLE1": "Employee Data Browser",
                "TITLE2": "OpenASP ブラウザメニュー",
                "PAGE_INFO": "Page 1 of 3 (25 records)",
                "EMP1_ID": "E001",
                "EMP1_NAME": "田中 太郎",
                "EMP1_DEPT": "営業部",
                "EMP1_SALARY": "450000",
                "EMP1_HIREDATE": "2020/04/01",
                "EMP1_STATUS": "在職",
                "EMP2_ID": "E002", 
                "EMP2_NAME": "佐藤 花子",
                "EMP2_DEPT": "開発部",
                "EMP2_SALARY": "520000",
                "EMP2_HIREDATE": "2019/06/15",
                "EMP2_STATUS": "在職",
                "EMP3_ID": "E003",
                "EMP3_NAME": "山田 次郎",
                "EMP3_DEPT": "総務部", 
                "EMP3_SALARY": "380000",
                "EMP3_HIREDATE": "2021/01/10",
                "EMP3_STATUS": "在職",
                "MSG_LINE1": "F5=更新 F8=次ページ F7=前ページ F12=終了",
                "MSG_LINE2": "従業員データを参照しています"
            },
            "page_info": {
                "current": 1,
                "total": 3,
                "total_records": 25,
                "records_per_page": 10
            },
            "messages": [
                "データ取得が完了しました",
                "25件中 1-10件を表示"
            ],
            "function_keys": {
                "F5": "更新",
                "F7": "前ページ",
                "F8": "次ページ",
                "F12": "終了"
            }
        }
        
        # This is what call.py would send to the API
        api_payload = {
            "map_file": java_output_simulation["map_file"],
            "fields": java_output_simulation["fields"],
            "terminal_id": "webui"
        }
        
        print(f"  Generated {len(api_payload['fields'])} fields")
        print(f"  Sample fields: {dict(list(api_payload['fields'].items())[:3])}")
        
        return test_smed_populate_with_data(api_payload)
        
    except Exception as e:
        print(f"[FAIL] Java program simulation failed: {e}")
        return False

def test_smed_populate_with_data(payload):
    """Test SMED populate with specific payload data"""
    try:
        response = requests.post(
            "http://localhost:8000/api/smed/populate",
            json=payload,
            timeout=10
        )
        
        if response.status_code == 200:
            result_data = response.json()
            print("[OK] Simulated Java program data sent successfully")
            print(f"  Fields populated: {result_data.get('fields_populated', 0)}")
            print(f"  Delivered to terminal: {result_data.get('delivered', False)}")
            
            if not result_data.get('delivered'):
                print(f"  [FAIL] Terminal not connected: {result_data.get('terminal_id')}")
            else:
                print(f"  [OK] Data delivered to terminal: {result_data.get('terminal_id')}")
            
            return result_data.get('delivered', False)
        else:
            print(f"[FAIL] Failed to send simulated data: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"[FAIL] Simulated data send failed: {e}")
        return False

def main():
    """Run all WebSocket integration tests"""
    print("=" * 60)
    print("WebSocket Integration Test for MSGSAMPLEBROWSERMENU")
    print("=" * 60)
    print(f"Test started at: {datetime.now().isoformat()}")
    print()
    
    # Test results tracking
    tests = []
    
    print("1. Testing API Server Health...")
    tests.append(("API Health", test_api_server_health()))
    print()
    
    print("2. Testing Terminal Registration Status...")
    tests.append(("Terminal Status", test_terminal_status()))
    print()
    
    print("3. Testing Terminal Connection...")
    tests.append(("Terminal Connection", test_terminal_connection()))
    print()
    
    print("4. Testing Basic SMED Populate...")
    tests.append(("Basic SMED Populate", test_smed_populate_endpoint()))
    print()
    
    print("5. Testing Java Program Simulation...")
    tests.append(("Java Program Simulation", simulate_java_program_execution()))
    print()
    
    # Summary
    print("=" * 60)
    print("TEST RESULTS SUMMARY")
    print("=" * 60)
    
    passed = 0
    total = len(tests)
    
    for test_name, result in tests:
        status = "[OK] PASS" if result else "[FAIL] FAIL"
        print(f"{test_name:25} {status}")
        if result:
            passed += 1
    
    print(f"\nOverall: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n[SUCCESS] All tests passed! WebSocket integration is working correctly.")
        print("The MSGSAMPLEBROWSERMENU data display issue should be resolved.")
    else:
        print(f"\n[WARN]  {total - passed} test(s) failed. WebSocket integration needs attention.")
        print("\nTroubleshooting steps:")
        print("1. Ensure API server is running on port 8000")
        print("2. Ensure web terminal is connected and registered as 'webui'")
        print("3. Check browser console for WebSocket connection errors")
        print("4. Verify Socket.IO client library is loaded in the web page")
    
    print(f"\nTest completed at: {datetime.now().isoformat()}")
    return passed == total

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)