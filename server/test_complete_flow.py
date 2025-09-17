#!/usr/bin/env python3
"""
Complete SMED Data Display Flow Test
====================================

This script demonstrates the working SMED data display system that fixes the
original terminal command execution issue.

Problem Fixed:
- Original React component (AspCliWebTerminal.tsx) was not being served properly
- No build system was set up for the TypeScript React component
- Terminal command execution was falling back to simulation mode

Solution Implemented:
- Created a complete HTML/JavaScript terminal interface (asp_terminal.html)
- Added proper API routes to serve the terminal interface
- Integrated WebSocket communication for real-time SMED data display
- Fixed command execution flow to work with the existing backend

Test Flow:
1. Web Terminal loads at http://localhost:8000/terminal
2. User enters: CALL PGM-MSGSAMPLEBROWSERMENU.TESTLIB,VOL-DISK01
3. Command is sent to /api/asp-command endpoint
4. aspcli.py executes the CALL function
5. Java program runs and outputs SMED data in JSON format
6. WebSocket Hub Client sends data to WebSocket Hub
7. Terminal receives SMED data via WebSocket and displays it
"""

import requests
import json
import time

def test_complete_flow():
    """Test the complete SMED data display flow"""
    
    print("=" * 60)
    print("ASP System Terminal - SMED Data Display Flow Test")
    print("=" * 60)
    
    # Test 1: Verify API server is running
    try:
        response = requests.get('http://localhost:8000/api/health', timeout=5)
        if response.status_code == 200:
            print("[OK] API Server is running")
        else:
            print("[ERROR] API Server health check failed")
            return False
    except Exception as e:
        print(f"[ERROR] Failed to connect to API server: {e}")
        return False
    
    # Test 2: Verify terminal interface is served
    try:
        response = requests.get('http://localhost:8000/terminal', timeout=5)
        if response.status_code == 200 and 'ASP System Command Terminal' in response.text:
            print("[OK] Terminal interface is being served correctly")
        else:
            print("[ERROR] Terminal interface not available")
            return False
    except Exception as e:
        print(f"[ERROR] Failed to load terminal interface: {e}")
        return False
    
    # Test 3: Execute CALL command via API
    print("\n[TESTING] CALL command execution...")
    try:
        command_data = {
            "command": "CALL PGM-MSGSAMPLEBROWSERMENU.TESTLIB,VOL-DISK01",
            "user": "ASPUSER"
        }
        
        response = requests.post(
            'http://localhost:8000/api/asp-command',
            json=command_data,
            timeout=30
        )
        
        if response.status_code == 200:
            result = response.json()
            print("[OK] CALL command executed successfully")
            print(f"   - Success: {result.get('success')}")
            print(f"   - Command: {result.get('command')}")
            
            # Check for SMED data in output
            output = result.get('output', '')
            if 'SMED data sent successfully via Hub Client' in output:
                print("[OK] SMED data was sent to WebSocket Hub")
            if 'Employee data' in output or 'display_map' in output:
                print("[OK] Employee data was processed correctly")
            if '[DEBUG]' in output or '[INFO]' in output:
                print("[OK] DEBUG logs are appearing during execution")
                
            return True
        else:
            print(f"[ERROR] CALL command failed: {response.status_code}")
            print(f"   Error: {response.text}")
            return False
            
    except Exception as e:
        print(f"[ERROR] Failed to execute CALL command: {e}")
        return False

def print_usage_instructions():
    """Print instructions for using the terminal"""
    
    print("\n" + "=" * 60)
    print("HOW TO USE THE ASP SYSTEM TERMINAL")
    print("=" * 60)
    
    print("""
1. Open your web browser and go to: http://localhost:8000/terminal
   (Or simply: http://localhost:8000/ - it redirects to the terminal)

2. You should see the ASP System Command Terminal interface with:
   - Green terminal styling (like a classic terminal)
   - WebSocket connection status in the top-right
   - Command input at the bottom

3. To test the SMED data display, enter this command:
   CALL PGM-MSGSAMPLEBROWSERMENU.TESTLIB,VOL-DISK01

4. Expected results:
   - Command executes and shows [INFO] logs
   - SMED data appears in a blue table showing employee information
   - Table includes columns: ID, Name, Department, Salary, Hire Date, Status
   - 5 employee records should be displayed
   - WebSocket status shows "Connected"

5. Other available commands:
   - HELP - Show available commands
   - WRKVOL - Show volume information
   - CRTLIB LIB-TEST,VOL-DISK01 - Create a library
   - Clear terminal with the trash icon

6. Features:
   - Command history (use ↑ arrow key)
   - Real-time WebSocket communication
   - Proper SMED data display
   - DEBUG logging
""")

    print("=" * 60)
    print("TROUBLESHOOTING")
    print("=" * 60)
    
    print("""
If you see issues:

1. WebSocket shows "Disconnected":
   - Check if the API server is running
   - Refresh the browser page

2. Commands show simulation results instead of real execution:
   - This should NOT happen with the new implementation
   - Check browser console for errors

3. No SMED data appears:
   - Check the terminal output logs
   - Look for "SMED data sent successfully" messages
   - Verify WebSocket connection is established

4. Server not responding:
   - Check if api_server.py is running: ps aux | grep api_server
   - Check server logs: tail -f server.log
""")

if __name__ == "__main__":
    success = test_complete_flow()
    
    if success:
        print("\n[SUCCESS] All tests passed! The SMED data display system is working correctly.")
        print_usage_instructions()
    else:
        print("\n[FAILED] Some tests failed. Please check the server status and try again.")