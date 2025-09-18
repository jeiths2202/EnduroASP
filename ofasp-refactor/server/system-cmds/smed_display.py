#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SMED Map Display Engine for ASP System Command Terminal
Provides curses-based terminal rendering of SMED maps with user interaction
"""

import curses
import sys
import os
import json
from datetime import datetime
import re

# Add the server directory to Python path for imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
sys.path.append('/home/aspuser/app/server')

try:
    from parse_smed import parse_smed_file
except ImportError:
    # Fallback SMED parser if parse_smed is not available
    def parse_smed_file(file_path):
        return {
            'map_name': 'FALLBACK_MAP',
            'fields': [
                {'name': 'USERID', 'row': 10, 'col': 20, 'length': 10, 'type': 'input', 'prompt': '', 'color': '#00FF00'},
                {'name': 'PASSWD', 'row': 12, 'col': 20, 'length': 10, 'type': 'input', 'prompt': '', 'color': '#00FF00'}
            ],
            'parsed_fields': 2
        }

class SMEDDisplayEngine:
    """SMED Map Display Engine using curses"""
    
    def __init__(self):
        self.stdscr = None
        self.map_data = None
        self.field_values = {}
        self.current_field_index = 0
        self.input_fields = []
        self.messages = []
        self.status_message = ""
        self.map_name = ""
        self.program_name = ""
        
        # Color definitions
        self.colors = {
            'normal': 1,
            'field': 2,
            'current_field': 3,
            'label': 4,
            'error': 5,
            'info': 6,
            'title': 7
        }
        
    def initialize_colors(self):
        """Initialize color pairs for display"""
        if not curses.has_colors():
            return
            
        curses.start_color()
        curses.use_default_colors()
        
        # Define color pairs
        curses.init_pair(self.colors['normal'], curses.COLOR_WHITE, -1)
        curses.init_pair(self.colors['field'], curses.COLOR_GREEN, curses.COLOR_BLACK)
        curses.init_pair(self.colors['current_field'], curses.COLOR_BLACK, curses.COLOR_GREEN)
        curses.init_pair(self.colors['label'], curses.COLOR_CYAN, -1)
        curses.init_pair(self.colors['error'], curses.COLOR_RED, -1)
        curses.init_pair(self.colors['info'], curses.COLOR_YELLOW, -1)
        curses.init_pair(self.colors['title'], curses.COLOR_WHITE, curses.COLOR_BLUE)

    def load_smed_map(self, map_file, output_data):
        """Load and parse SMED map file"""
        try:
            # Try to load actual SMED file
            if os.path.exists(map_file):
                self.map_data = parse_smed_file(map_file)
            else:
                # Create default map structure from output_data
                self.map_data = self._create_default_map(output_data)
            
            # Extract field information
            self.field_values = output_data.get('fields', {})
            self.messages = output_data.get('messages', [])
            self.map_name = self.map_data.get('map_name', 'UNKNOWN_MAP')
            
            # Create input field list
            self.input_fields = []
            for field in self.map_data.get('fields', []):
                if field.get('type') == 'input' or not field.get('prompt'):
                    self.input_fields.append(field)
            
            # Initialize field values
            for field in self.input_fields:
                field_name = field.get('name', '')
                if field_name not in self.field_values:
                    self.field_values[field_name] = ''
            
            return True
            
        except Exception as e:
            self.status_message = f"Error loading SMED map: {e}"
            return False

    def _create_default_map(self, output_data):
        """Create a default SMED map structure"""
        fields = []
        row = 5
        
        # Add title
        fields.append({
            'name': 'TITLE',
            'row': 2,
            'col': 25,
            'length': 30,
            'type': 'text',
            'prompt': f'=== {self.program_name} ===',
            'color': '#00FFFF'
        })
        
        # Add messages as text fields
        for i, message in enumerate(self.messages[:3]):  # Show first 3 messages
            fields.append({
                'name': f'MSG{i+1}',
                'row': row + i,
                'col': 10,
                'length': len(message),
                'type': 'text',
                'prompt': message,
                'color': '#FFFF00'
            })
        
        # Add input fields
        input_row = row + len(self.messages) + 2
        field_data = output_data.get('fields', {})
        
        for i, (field_name, field_value) in enumerate(field_data.items()):
            fields.append({
                'name': f'{field_name}_LABEL',
                'row': input_row + i * 2,
                'col': 10,
                'length': len(field_name) + 1,
                'type': 'text',
                'prompt': f'{field_name}:',
                'color': '#FFFF00'
            })
            
            fields.append({
                'name': field_name,
                'row': input_row + i * 2,
                'col': 20,
                'length': 20,
                'type': 'input',
                'prompt': '',
                'color': '#00FF00'
            })
        
        return {
            'map_name': self.map_name,
            'fields': fields,
            'parsed_fields': len(fields)
        }

    def display_map(self, stdscr, map_file, output_data, program_name):
        """Main entry point for displaying SMED map"""
        self.stdscr = stdscr
        self.program_name = program_name
        
        # Initialize curses settings
        curses.curs_set(1)  # Show cursor
        stdscr.keypad(True)  # Enable special keys
        stdscr.nodelay(False)  # Blocking input
        self.initialize_colors()
        
        # Load SMED map
        if not self.load_smed_map(map_file, output_data):
            return False, self.field_values, "Failed to load SMED map"
        
        # Main display loop
        return self._display_loop()

    def _display_loop(self):
        """Main display and interaction loop"""
        try:
            while True:
                # Clear screen and render map
                self.stdscr.clear()
                self._render_map()
                self._render_status_line()
                self._render_function_keys()
                self.stdscr.refresh()
                
                # Handle user input
                key = self.stdscr.getch()
                action = self._handle_key(key)
                
                if action == 'exit':
                    return True, self.field_values, "User pressed F3 (Exit)"
                elif action == 'submit':
                    return True, self.field_values, "User pressed Enter (Submit)"
                elif action == 'cancel':
                    return False, {}, "User cancelled"
                    
        except KeyboardInterrupt:
            return False, {}, "User interrupted"
        except Exception as e:
            return False, {}, f"Display error: {e}"

    def _render_map(self):
        """Render the SMED map on screen"""
        max_y, max_x = self.stdscr.getmaxyx()
        
        # Render title bar
        title = f" {self.map_name} - {self.program_name} "
        self.stdscr.attron(curses.color_pair(self.colors['title']))
        self.stdscr.addstr(0, 0, title.ljust(max_x))
        self.stdscr.attroff(curses.color_pair(self.colors['title']))
        
        # Render all fields
        for field in self.map_data.get('fields', []):
            self._render_field(field, max_y, max_x)

    def _render_field(self, field, max_y, max_x):
        """Render a single field on the screen"""
        row = field.get('row', 0)
        col = field.get('col', 0)
        field_type = field.get('type', 'text')
        field_name = field.get('name', '')
        prompt = field.get('prompt', '')
        
        # Check bounds
        if row >= max_y - 3 or col >= max_x:
            return
            
        try:
            if field_type == 'text' or prompt:
                # Render text/label field
                text = prompt if prompt else field_name
                self.stdscr.attron(curses.color_pair(self.colors['label']))
                self.stdscr.addstr(row, col, text[:max_x - col])
                self.stdscr.attroff(curses.color_pair(self.colors['label']))
                
            elif field_type == 'input':
                # Render input field
                field_value = self.field_values.get(field_name, '')
                field_length = field.get('length', 20)
                
                # Determine if this is the current field
                is_current = (self.input_fields and 
                            self.current_field_index < len(self.input_fields) and
                            self.input_fields[self.current_field_index].get('name') == field_name)
                
                if is_current:
                    # Highlight current field
                    self.stdscr.attron(curses.color_pair(self.colors['current_field']))
                    display_text = field_value.ljust(field_length)
                    self.stdscr.addstr(row, col, display_text[:max_x - col])
                    self.stdscr.attroff(curses.color_pair(self.colors['current_field']))
                    
                    # Position cursor in current field
                    cursor_pos = min(len(field_value), field_length - 1)
                    self.stdscr.move(row, col + cursor_pos)
                else:
                    # Regular field display
                    self.stdscr.attron(curses.color_pair(self.colors['field']))
                    display_text = field_value.ljust(field_length)
                    self.stdscr.addstr(row, col, display_text[:max_x - col])
                    self.stdscr.attroff(curses.color_pair(self.colors['field']))
                    
        except curses.error:
            # Ignore cursor positioning errors near screen edges
            pass

    def _render_status_line(self):
        """Render status information at bottom of screen"""
        max_y, max_x = self.stdscr.getmaxyx()
        status_row = max_y - 2
        
        # Show current field info
        if self.input_fields and self.current_field_index < len(self.input_fields):
            current_field = self.input_fields[self.current_field_index]
            field_info = f"Field: {current_field.get('name', 'Unknown')} ({self.current_field_index + 1}/{len(self.input_fields)})"
        else:
            field_info = "No input fields"
            
        # Show status message or field info
        status_text = self.status_message if self.status_message else field_info
        
        try:
            self.stdscr.attron(curses.color_pair(self.colors['info']))
            self.stdscr.addstr(status_row, 2, status_text[:max_x - 4])
            self.stdscr.attroff(curses.color_pair(self.colors['info']))
        except curses.error:
            pass

    def _render_function_keys(self):
        """Render function key help at bottom of screen"""
        max_y, max_x = self.stdscr.getmaxyx()
        help_row = max_y - 1
        
        help_text = "F1=Help F3=Exit F12=Cancel Enter=Submit Tab=Next Field"
        
        try:
            self.stdscr.attron(curses.color_pair(self.colors['normal']))
            self.stdscr.addstr(help_row, 2, help_text[:max_x - 4])
            self.stdscr.attroff(curses.color_pair(self.colors['normal']))
        except curses.error:
            pass

    def _handle_key(self, key):
        """Handle keyboard input"""
        # Function keys
        if key == curses.KEY_F3 or key == 27:  # F3 or ESC
            return 'exit'
        elif key == curses.KEY_F12:
            return 'cancel'
        elif key == curses.KEY_F1:
            self._show_help()
            return 'continue'
        elif key == ord('\n') or key == ord('\r'):  # Enter
            return 'submit'
        elif key == ord('\t') or key == curses.KEY_DOWN:  # Tab or Down arrow
            self._next_field()
            return 'continue'
        elif key == curses.KEY_UP:
            self._prev_field()
            return 'continue'
        elif key == curses.KEY_BACKSPACE or key == 127 or key == 8:
            self._handle_backspace()
            return 'continue'
        elif key == curses.KEY_LEFT:
            # TODO: Move cursor within field
            return 'continue'
        elif key == curses.KEY_RIGHT:
            # TODO: Move cursor within field
            return 'continue'
        elif 32 <= key <= 126:  # Printable characters
            self._handle_char(chr(key))
            return 'continue'
        
        return 'continue'

    def _next_field(self):
        """Move to next input field"""
        if self.input_fields:
            self.current_field_index = (self.current_field_index + 1) % len(self.input_fields)
            self.status_message = ""

    def _prev_field(self):
        """Move to previous input field"""
        if self.input_fields:
            self.current_field_index = (self.current_field_index - 1) % len(self.input_fields)
            self.status_message = ""

    def _handle_char(self, char):
        """Handle character input in current field"""
        if not self.input_fields or self.current_field_index >= len(self.input_fields):
            return
            
        current_field = self.input_fields[self.current_field_index]
        field_name = current_field.get('name', '')
        field_length = current_field.get('length', 20)
        current_value = self.field_values.get(field_name, '')
        
        # Add character if field not full
        if len(current_value) < field_length:
            self.field_values[field_name] = current_value + char
            self.status_message = ""

    def _handle_backspace(self):
        """Handle backspace in current field"""
        if not self.input_fields or self.current_field_index >= len(self.input_fields):
            return
            
        current_field = self.input_fields[self.current_field_index]
        field_name = current_field.get('name', '')
        current_value = self.field_values.get(field_name, '')
        
        # Remove last character
        if current_value:
            self.field_values[field_name] = current_value[:-1]
            self.status_message = ""

    def _show_help(self):
        """Show help dialog"""
        max_y, max_x = self.stdscr.getmaxyx()
        
        help_lines = [
            "=== SMED Map Help ===",
            "",
            "Navigation:",
            "  Tab / Down Arrow  - Next field",
            "  Up Arrow         - Previous field",
            "  Enter            - Submit form",
            "",
            "Function Keys:",
            "  F1               - Show this help",
            "  F3 / ESC         - Exit",
            "  F12              - Cancel",
            "",
            "Editing:",
            "  Type characters to enter data",
            "  Backspace to delete",
            "",
            "Press any key to continue..."
        ]
        
        # Create help window
        help_height = min(len(help_lines) + 2, max_y - 4)
        help_width = min(50, max_x - 4)
        start_y = (max_y - help_height) // 2
        start_x = (max_x - help_width) // 2
        
        help_win = curses.newwin(help_height, help_width, start_y, start_x)
        help_win.box()
        
        # Display help text
        for i, line in enumerate(help_lines[:help_height - 2]):
            if i < help_height - 2:
                try:
                    help_win.addstr(i + 1, 2, line[:help_width - 4])
                except curses.error:
                    pass
        
        help_win.refresh()
        help_win.getch()  # Wait for key press
        del help_win

def display_smed_map_terminal(map_file, output_data, program_name):
    """
    Display SMED map in terminal using curses
    
    Args:
        map_file (str): Path to SMED map file
        output_data (dict): Java program output data
        program_name (str): Name of calling program
        
    Returns:
        tuple: (success, field_values, message)
    """
    try:
        engine = SMEDDisplayEngine()
        return curses.wrapper(engine.display_map, map_file, output_data, program_name)
    except Exception as e:
        return False, {}, f"SMED display error: {e}"

if __name__ == "__main__":
    # Test the SMED display engine
    test_output_data = {
        "fields": {
            "USERID": "",
            "PASSWD": ""
        },
        "messages": [
            "Welcome to OpenASP System",
            "Please enter your credentials",
            "Press F1 for help"
        ]
    }
    
    success, values, message = display_smed_map_terminal(
        "/nonexistent/test.smed", 
        test_output_data, 
        "TestProgram"
    )
    
    print(f"Result: {success}")
    print(f"Values: {values}")
    print(f"Message: {message}")