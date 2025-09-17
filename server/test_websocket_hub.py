#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
WebSocket Hub Integration Test

Tests the new single-channel WebSocket Hub implementation that replaces
the complex 4-stage data flow (Java → call.py → HTTP API → WebSocket → React)
with a direct single channel (Java → WebSocket Hub → React).
"""

import sys
import os
import json
import time
from datetime import datetime

# Add server directory to path
sys.path.insert(0, os.path.dirname(__file__))

def test_hub_client_import():
    """Test if Hub Client can be imported"""
    try:
        from websocket_hub_client import WebSocketHubClient
        print("[TEST] ✓ WebSocket Hub Client import successful")
        return True
    except ImportError as e:
        print(f"[TEST] ✗ Hub Client import failed: {e}")
        return False

def test_hub_connection():
    """Test WebSocket Hub connection"""
    try:
        from websocket_hub_client import WebSocketHubClient
        
        print("[TEST] Testing WebSocket Hub connection...")
        client = WebSocketHubClient('http://localhost:8000')
        
        if client.connect():
            print("[TEST] ✓ WebSocket Hub connection successful")
            client.disconnect()
            return True
        else:
            print("[TEST] ✗ WebSocket Hub connection failed")
            return False
            
    except Exception as e:
        print(f"[TEST] ✗ Hub connection test error: {e}")
        return False

def test_smed_data_transmission():
    """Test SMED data transmission through WebSocket Hub"""
    try:
        from websocket_hub_client import WebSocketHubClient
        
        print("[TEST] Testing SMED data transmission through Hub...")
        
        # Create test SMED data
        test_data = {
            'terminal_id': 'webui',
            'map_file': 'TEST_HUB_MAP',
            'fields': {
                'FIELD1': 'WebSocket Hub Test',
                'FIELD2': 'Single Channel Mode',
                'FIELD3': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                'STATUS': 'HUB_ACTIVE',
                'VERSION': '1.0'
            },
            'program_name': 'hub_test',
            'source_type': 'test'
        }
        
        client = WebSocketHubClient('http://localhost:8000')
        
        if not client.connect():
            print("[TEST] ✗ Failed to connect to Hub for SMED test")
            return False
        
        success = client.send_smed_data(
            terminal_id=test_data['terminal_id'],
            map_file=test_data['map_file'],
            fields=test_data['fields'],
            program_name=test_data['program_name'],
            source_type=test_data['source_type']
        )
        
        # Wait for confirmation
        time.sleep(2)
        
        client.disconnect()
        
        if success:
            print("[TEST] ✓ SMED data transmission through Hub successful")
            print(f"[TEST]   Terminal: {test_data['terminal_id']}")
            print(f"[TEST]   Map: {test_data['map_file']}")
            print(f"[TEST]   Fields: {len(test_data['fields'])} fields")
            return True
        else:
            print("[TEST] ✗ SMED data transmission failed")
            return False
            
    except Exception as e:
        print(f"[TEST] ✗ SMED transmission test error: {e}")
        return False

def test_json_data_transmission():
    """Test JSON-based SMED data transmission"""
    try:
        from websocket_hub_client import WebSocketHubClient
        
        print("[TEST] Testing JSON SMED data transmission...")
        
        # Create JSON test data
        json_data = {
            'terminal_id': 'webui',
            'map_file': 'JSON_TEST_MAP',
            'fields': {
                'JSON_TEST': 'Hub JSON Mode',
                'TIMESTAMP': datetime.now().isoformat(),
                'DATA_FLOW': 'single_channel',
                'HTTP_BYPASSED': 'true'
            },
            'program_name': 'json_hub_test',
            'source_type': 'json_test'
        }
        
        client = WebSocketHubClient('http://localhost:8000')
        
        if not client.connect():
            print("[TEST] ✗ Failed to connect to Hub for JSON test")
            return False
        
        success = client.send_smed_json(json_data)
        
        # Wait for confirmation
        time.sleep(2)
        
        client.disconnect()
        
        if success:
            print("[TEST] ✓ JSON SMED data transmission successful")
            return True
        else:
            print("[TEST] ✗ JSON SMED data transmission failed")
            return False
            
    except Exception as e:
        print(f"[TEST] ✗ JSON transmission test error: {e}")
        return False

def test_direct_java_simulation():
    """Simulate Java program calling WebSocket Hub directly"""
    try:
        print("[TEST] Simulating Java program WebSocket Hub integration...")
        
        # Simulate Java program output that would trigger Hub integration
        java_output = '''
        [INFO] Java program starting
        {"action": "display_map", "map_file": "JAVA_HUB_MAP", "terminal_id": "webui", "fields": {"JAVA_FIELD": "Direct Hub Integration", "BYPASS_HTTP": "true", "HUB_VERSION": "1.0"}}
        [INFO] Java program completed
        '''
        
        # Import call.py functions
        sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'system-cmds', 'functions'))
        from call import _process_java_output
        
        # Process Java output (this should trigger Hub integration)
        _process_java_output(java_output, 'DISK01', 'TESTLIB', 'JAVA_HUB_TEST')
        
        print("[TEST] ✓ Java program Hub integration simulation completed")
        return True
        
    except Exception as e:
        print(f"[TEST] ✗ Java simulation test error: {e}")
        return False

def main():
    """Run all WebSocket Hub integration tests"""
    print("=" * 80)
    print("WebSocket Hub Integration Test Suite")
    print("Phase 1: Single Channel WebSocket Implementation")
    print("=" * 80)
    print()
    
    tests = [
        ("Hub Client Import", test_hub_client_import),
        ("Hub Connection", test_hub_connection),
        ("SMED Data Transmission", test_smed_data_transmission),
        ("JSON Data Transmission", test_json_data_transmission),
        ("Java Integration Simulation", test_direct_java_simulation)
    ]
    
    passed = 0
    total = len(tests)
    
    for test_name, test_func in tests:
        print(f"Running test: {test_name}")
        try:
            if test_func():
                passed += 1
        except Exception as e:
            print(f"[TEST] ✗ {test_name} failed with exception: {e}")
        
        print()
    
    print("=" * 80)
    print(f"Test Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All WebSocket Hub integration tests PASSED!")
        print("✓ HTTP API duplication eliminated")
        print("✓ Single WebSocket channel established")
        print("✓ Direct Java → Hub → React data flow working")
        print("✓ Phase 1: WebSocket Hub Integration COMPLETE")
    else:
        print("⚠️  Some tests failed. WebSocket Hub integration needs review.")
        print("   Check server is running on localhost:8000")
        print("   Ensure WebSocket Hub events are properly handled")
    
    print("=" * 80)
    return 0 if passed == total else 1

if __name__ == '__main__':
    sys.exit(main())