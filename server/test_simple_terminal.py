#!/usr/bin/env python3
import requests
import json

print("Testing simplified terminal...")

# First test if the terminal page loads
try:
    response = requests.get("http://localhost:8000/asp_terminal_simple.html")
    if response.status_code == 200:
        print("✓ Terminal page loaded successfully")
    else:
        print(f"✗ Failed to load terminal page: {response.status_code}")
except Exception as e:
    print(f"✗ Error loading terminal: {e}")

# Test the ASP command API
print("\nTesting ASP command execution...")
try:
    response = requests.post(
        "http://localhost:8000/api/asp-command",
        json={
            "command": "CALL PGM-MSGSAMPLEBROWSERMENU.TESTLIB,VOL-DISK01",
            "user": "ASPUSER"
        }
    )
    
    if response.status_code == 200:
        result = response.json()
        print("✓ Command executed successfully")
        print(f"  Success: {result.get('success', False)}")
        
        # Check if SMED data is in output
        output = result.get('output', '')
        if '"action": "display_map"' in output:
            print("✓ SMED data found in output")
            
            # Extract and display the SMED data
            json_start = output.find('{"action": "display_map"')
            if json_start != -1:
                json_end = output.find('\n', json_start)
                json_str = output[json_start:json_end]
                try:
                    smed_data = json.loads(json_str)
                    print(f"  Map: {smed_data.get('map_file', 'Unknown')}")
                    print(f"  Fields: {len(smed_data.get('fields', {}))}")
                    
                    # Display first few employees
                    print("\n  Employee Data:")
                    for i in range(1, 6):
                        emp_id = smed_data.get('fields', {}).get(f'EMP{i}_ID')
                        emp_name = smed_data.get('fields', {}).get(f'EMP{i}_NAME')
                        if emp_id and emp_name:
                            print(f"    {emp_id}: {emp_name}")
                except:
                    print("✗ Failed to parse SMED JSON")
        else:
            print("✗ SMED data not found in output")
            print(f"  Output preview: {output[:200]}...")
    else:
        print(f"✗ Command failed: {response.status_code}")
        print(f"  Response: {response.text}")
except Exception as e:
    print(f"✗ Error executing command: {e}")

print("\nSimplified terminal should now be available at:")
print("http://localhost:8000/asp_terminal_simple.html")