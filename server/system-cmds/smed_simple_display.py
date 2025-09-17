#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Simple SMED Map Display for ASP System Command Terminal
Provides text-based terminal rendering when curses is not available
"""

import sys
import os
from datetime import datetime

# Add the server directory to Python path for imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
sys.path.append('/home/aspuser/app/server')

try:
    from parse_smed import parse_smed_file
except ImportError:
    # Fallback SMED parser
    def parse_smed_file(file_path):
        return {
            'map_name': 'FALLBACK_MAP',
            'fields': [],
            'parsed_fields': 0
        }

class SimpleSMEDDisplay:
    """Simple text-based SMED display for terminal environments"""
    
    def __init__(self):
        self.map_data = None
        self.field_values = {}
        self.messages = []
        self.map_name = ""
        self.program_name = ""

    def display_map(self, map_file, output_data, program_name):
        """Display SMED map using simple text interface"""
        self.program_name = program_name
        
        # Load SMED map data
        if not self._load_map(map_file, output_data):
            return False, {}, "Failed to load SMED map"
        
        # Display map and handle user interaction
        return self._run_interaction()

    def _load_map(self, map_file, output_data):
        """Load SMED map file and prepare display data"""
        try:
            # Load SMED file if it exists
            if os.path.exists(map_file):
                self.map_data = parse_smed_file(map_file)
                self.map_name = self.map_data.get('map_name', 'UNKNOWN_MAP')
            else:
                # Create default map
                self.map_name = "DEFAULT_MAP"
                self.map_data = {'fields': [], 'parsed_fields': 0}
            
            # Get field values and messages from Java program output
            self.field_values = output_data.get('fields', {}).copy()
            self.messages = output_data.get('messages', [])
            
            return True
            
        except Exception as e:
            print(f"[ERROR] Failed to load SMED map: {e}")
            return False

    def _run_interaction(self):
        """Run the text-based interaction loop"""
        try:
            # Display initial screen
            self._display_screen()
            
            # Get input fields from field_values
            input_fields = list(self.field_values.keys())
            
            if not input_fields:
                print("\n[INFO] No input fields defined. Press Enter to continue...")
                input()
                return True, {}, "No input required"
            
            # Interactive input collection
            print(f"\n=== Interactive Input ===")
            print(f"Enter values for each field (press Enter to skip):")
            
            for field_name in input_fields:
                current_value = self.field_values.get(field_name, '')
                prompt = f"{field_name}"
                if current_value:
                    prompt += f" [{current_value}]"
                prompt += ": "
                
                try:
                    user_input = input(prompt).strip()
                    if user_input:
                        self.field_values[field_name] = user_input
                except (EOFError, KeyboardInterrupt):
                    print("\n[INFO] Input cancelled by user")
                    return False, {}, "User cancelled input"
            
            # Confirm submission
            print(f"\n=== Field Values Summary ===")
            for field_name, field_value in self.field_values.items():
                print(f"  {field_name}: '{field_value}'")
            
            print(f"\nSubmit these values? (y/N): ", end='')
            try:
                confirm = input().strip().lower()
                if confirm in ['y', 'yes']:
                    return True, self.field_values, "User submitted values"
                else:
                    return False, {}, "User cancelled submission"
            except (EOFError, KeyboardInterrupt):
                print("\n[INFO] Submission cancelled")
                return False, {}, "User cancelled submission"
                
        except Exception as e:
            return False, {}, f"Interaction error: {e}"

    def _display_screen(self):
        """Display the SMED screen using text"""
        # Clear screen (simple method)
        print("\n" * 3)
        
        # Display title
        title = f"=== {self.map_name} - {self.program_name} ==="
        print("=" * len(title))
        print(title)
        print("=" * len(title))
        print()
        
        # Display messages
        if self.messages:
            print("Messages:")
            for msg in self.messages:
                print(f"  • {msg}")
            print()
        
        # Display SMED map structure if available
        if self.map_data and self.map_data.get('fields'):
            print("Screen Layout:")
            text_fields = []
            input_fields = []
            
            for field in self.map_data['fields']:
                field_type = field.get('type', 'input')
                field_name = field.get('name', '')
                prompt = field.get('prompt', '')
                
                if field_type == 'text' or prompt:
                    text_fields.append(prompt or field_name)
                else:
                    input_fields.append(field_name)
            
            # Display text fields
            if text_fields:
                for text in text_fields:
                    print(f"  {text}")
            
            print()
            
            # Display input fields
            if input_fields:
                print("Input Fields:")
                for field_name in input_fields:
                    current_value = self.field_values.get(field_name, '')
                    print(f"  {field_name}: {current_value}")
        else:
            # Simple field display
            print("Input Fields:")
            for field_name, field_value in self.field_values.items():
                print(f"  {field_name}: {field_value}")
        
        print()
        print("Commands: Enter values, Ctrl+C to cancel")
        print("-" * 50)

def display_smed_simple(map_file, output_data, program_name):
    """
    Display SMED map using simple text interface
    
    Args:
        map_file (str): Path to SMED map file
        output_data (dict): Java program output data
        program_name (str): Name of calling program
        
    Returns:
        tuple: (success, field_values, message)
    """
    try:
        display = SimpleSMEDDisplay()
        return display.display_map(map_file, output_data, program_name)
    except Exception as e:
        return False, {}, f"Simple SMED display error: {e}"

if __name__ == "__main__":
    # Test the simple SMED display
    test_output_data = {
        "fields": {
            "USERID": "admin",
            "PASSWD": ""
        },
        "messages": [
            "Welcome to OpenASP System",
            "Please enter your credentials",
            "Test mode active"
        ]
    }
    
    success, values, message = display_smed_simple(
        "/home/aspuser/app/volume/DISK01/TESTLIB/MAINMENU.smed",
        test_output_data,
        "TestProgram"
    )
    
    print(f"\nResult: {success}")
    print(f"Values: {values}")
    print(f"Message: {message}")