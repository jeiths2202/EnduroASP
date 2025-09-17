#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Enhanced SMED File Parser
Handles proper parsing of SMED map files with better field extraction
"""

import os
import re
import logging

# Import smart SMED reader
try:
    from smed_reader import smed_reader
    SMART_READER_AVAILABLE = True
except ImportError:
    SMART_READER_AVAILABLE = False

logger = logging.getLogger(__name__)

def parse_smed_file(file_path, destination='server', **kwargs):
    """
    Enhanced SMED file parser with smart encoding
    Uses destination-aware encoding to avoid unnecessary conversions
    
    Args:
        file_path: Path to SMED file
        destination: 'server', 'web_ui', 'api', 'terminal'
    """
    try:
        # Use smart reader if available
        if SMART_READER_AVAILABLE:
            # Pass terminal_type for terminal destinations
            terminal_type = kwargs.get('terminal_type', 'console')  # Default to console
            content = smed_reader.read_smed_file(file_path, destination=destination, terminal_type=terminal_type)
            logger.debug(f"Smart read completed for {file_path} (destination: {destination}, terminal_type: {terminal_type})")
        else:
            # Legacy reading method
            try:
                with open(file_path, 'rb') as f:
                    raw_bytes = f.read()
                
                # Only convert if destination requires it
                if destination in ['web_ui', 'api']:
                    content = raw_bytes.decode('shift_jis', errors='replace')
                    logger.info(f"Legacy SJIS decode for web destination: {file_path}")
                else:
                    # For server internal, try minimal conversion
                    try:
                        content = raw_bytes.decode('shift_jis', errors='replace')
                    except:
                        content = raw_bytes.decode('utf-8', errors='replace')
                    logger.info(f"Legacy decode for server destination: {file_path}")
            except Exception as read_error:
                logger.warning(f"Binary read failed, trying UTF-8: {read_error}")
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
        
        logger.info(f"Parsing SMED file: {file_path}")
        logger.debug(f"File content preview: {content[:200]}...")
        
        lines = content.split('\n')
        fields = []
        map_name = None
        
        for line_num, line in enumerate(lines, 1):
            line = line.strip()
            
            # Skip empty lines and comments
            if not line or line.startswith('#') or line.startswith('//'):
                continue
            
            logger.debug(f"Processing line {line_num}: {line}")
            
            # Extract map name
            if line.startswith('MAPNAME'):
                parts = line.split()
                if len(parts) >= 2:
                    map_name = parts[1]
                    logger.info(f"Found map name: {map_name}")
                continue
            
            # Parse field definitions
            field_data = parse_field_line(line, line_num)
            if field_data:
                fields.append(field_data)
                logger.debug(f"Added field: {field_data}")
        
        result = {
            'map_name': map_name or os.path.basename(file_path),
            'fields': fields,
            'raw_content': content[:1000],  # ?? 1000??
            'total_lines': len(lines),
            'parsed_fields': len(fields)
        }
        
        logger.info(f"SMED parsing completed: {len(fields)} fields extracted")
        return result
    
    except Exception as e:
        logger.error(f"Failed to parse SMED file {file_path}: {e}")
        return None

def parse_field_line(line, line_num):
    """
    ?? ?? ?? ??
    ??? SMED ?? ?? ??
    """
    try:
        # ITEM ?? ??: ITEM name TYPE=type POS=(row,col) PROMPT="text" COLOR=color LEN=length
        if line.startswith('ITEM'):
            return parse_item_field(line)
        
        # ?? ?? ??: name row col [length] [type]
        parts = line.split()
        if len(parts) >= 3:
            return parse_simple_field(parts)
        
        # ?? ???...
        logger.debug(f"Unrecognized field format on line {line_num}: {line}")
        return None
        
    except Exception as e:
        logger.warning(f"Error parsing field line {line_num}: {e}")
        return None

def parse_item_field(line):
    """
    ITEM ??? ?? ??
    ?: ITEM TITLE TYPE=T POS=(2,20) PROMPT="==== M E N U ====" COLOR=#00FFFF
    """
    field_data = {
        'name': '',
        'row': 0,
        'col': 0,
        'length': 10,
        'type': 'input',
        'prompt': '',
        'color': '#00FF00'
    }
    
    # ??? ??
    name_match = re.search(r'ITEM\s+(\w+)', line)
    if name_match:
        field_data['name'] = name_match.group(1)
    
    # TYPE ??
    type_match = re.search(r'TYPE=([A-Z])', line)
    if type_match:
        type_code = type_match.group(1)
        if type_code == 'T':
            field_data['type'] = 'text'
        elif type_code == 'I':
            field_data['type'] = 'input'
        else:
            field_data['type'] = 'input'
    
    # POS ??: POS=(row,col)
    pos_match = re.search(r'POS=\((\d+),(\d+)\)', line)
    if pos_match:
        field_data['row'] = int(pos_match.group(1))
        field_data['col'] = int(pos_match.group(2))
    
    # PROMPT ??: PROMPT="text"
    prompt_match = re.search(r'PROMPT="([^"]*)"', line)
    if prompt_match:
        field_data['prompt'] = prompt_match.group(1)
        field_data['length'] = len(field_data['prompt'])
    
    # COLOR ??: COLOR=#RRGGBB
    color_match = re.search(r'COLOR=(#[0-9A-Fa-f]{6})', line)
    if color_match:
        field_data['color'] = color_match.group(1)
    
    # LEN ??: LEN=number
    len_match = re.search(r'LEN=(\d+)', line)
    if len_match:
        field_data['length'] = int(len_match.group(1))
        # LEN? ??? ?? ?? ??? ??
        if not field_data['prompt']:
            field_data['type'] = 'input'
    
    logger.debug(f"Parsed ITEM field: {field_data}")
    return field_data

def parse_simple_field(parts):
    """
    ?? ??? ?? ??
    ?: name 10 20 15 input
    """
    field_data = {
        'name': parts[0],
        'row': int(parts[1]) if parts[1].isdigit() else 0,
        'col': int(parts[2]) if parts[2].isdigit() else 0,
        'length': int(parts[3]) if len(parts) > 3 and parts[3].isdigit() else 10,
        'type': parts[4] if len(parts) > 4 else 'input',
        'prompt': '',
        'color': '#00FF00'
    }
    
    logger.debug(f"Parsed simple field: {field_data}")
    return field_data

def create_sample_smed_files():
    """
    ???? ?? SMED ??? ??
    """
    sample_files = {
        'LOGO': '''MAPNAME LOGO
GROUP MAIN
  ITEM TITLE TYPE=T POS=(2,20) PROMPT="==== OpenASP SMED LOGO ====" COLOR=#00FFFF
  ITEM WELCOME TYPE=T POS=(4,25) PROMPT="Welcome to OpenASP System" COLOR=#4ADE80
  ITEM USERID_LABEL TYPE=T POS=(9,25) PROMPT="User ID:" COLOR=#FFFF00
  ITEM USERID POS=(9,37) LEN=10
  ITEM PASSWD_LABEL TYPE=T POS=(10,25) PROMPT="Password:" COLOR=#FFFF00
  ITEM PASSWD POS=(10,37) LEN=10
  ITEM F3 TYPE=T POS=(23,10) PROMPT="F3(Exit)" COLOR=#FFFF00
  ITEM F7 TYPE=T POS=(23,30) PROMPT="F7(Logoff)" COLOR=#FFFF00
''',
        'MENU': '''MAPNAME MENU
GROUP MAIN
  ITEM TITLE TYPE=T POS=(2,20) PROMPT="==== M E N U  S C R E E N ====" COLOR=#00FFFF
  ITEM LINE1 TYPE=T POS=(4,10) PROMPT="1. ????" COLOR=#4ADE80
  ITEM LINE2 TYPE=T POS=(5,10) PROMPT="2. ????" COLOR=#4ADE80
  ITEM LINE3 TYPE=T POS=(6,10) PROMPT="3. ????" COLOR=#4ADE80
  ITEM LINE4 TYPE=T POS=(7,10) PROMPT="4. ????" COLOR=#4ADE80
  ITEM LINE5 TYPE=T POS=(8,10) PROMPT="5. ?????" COLOR=#4ADE80
  ITEM CMDLABEL TYPE=T POS=(10,10) PROMPT="??:" COLOR=#FFFF00
  ITEM CMD POS=(10,20) LEN=10
  ITEM F3 TYPE=T POS=(23,10) PROMPT="F3(????)" COLOR=#FFFF00
  ITEM F7 TYPE=T POS=(23,30) PROMPT="F7(????)" COLOR=#FFFF00
''',
        'EIGYO001': '''MAPNAME EIGYO001
GROUP MAIN
  ITEM TITLE TYPE=T POS=(2,20) PROMPT="==== ?? ?? ?? ====" COLOR=#00FFFF
  ITEM INFO TYPE=T POS=(4,10) PROMPT="?? ???? ?????." COLOR=#4ADE80
  ITEM CUSTOMER_LABEL TYPE=T POS=(6,10) PROMPT="????:" COLOR=#FFFF00
  ITEM CUSTOMER POS=(6,20) LEN=10
  ITEM AMOUNT_LABEL TYPE=T POS=(7,10) PROMPT="??:" COLOR=#FFFF00
  ITEM AMOUNT POS=(7,20) LEN=15
  ITEM F3 TYPE=T POS=(23,10) PROMPT="F3(???)" COLOR=#FFFF00
  ITEM F7 TYPE=T POS=(23,30) PROMPT="F7(????)" COLOR=#FFFF00
'''
    }
    
    return sample_files

# ??? ??
def test_smed_parser():
    """
    SMED ?? ???
    """
    import tempfile
    import json
    
    print("?? SMED Parser Test")
    print("==================")
    
    sample_files = create_sample_smed_files()
    
    for map_name, content in sample_files.items():
        print(f"\n?? Testing {map_name} map:")
        
        # ?? ?? ??
        with tempfile.NamedTemporaryFile(mode='w', suffix='.smed', delete=False) as f:
            f.write(content)
            temp_file = f.name
        
        try:
            # ?? ???
            result = parse_smed_file(temp_file)
            
            if result:
                print(f"? ?? ??: {result['parsed_fields']} fields")
                print(f"   ? ??: {result['map_name']}")
                
                # ?? ?? ??
                for i, field in enumerate(result['fields'][:3]):  # ?? 3??
                    print(f"   Field {i+1}: {field['name']} at ({field['row']},{field['col']}) - {field.get('prompt', 'INPUT')}")
                
                if len(result['fields']) > 3:
                    print(f"   ... and {len(result['fields']) - 3} more fields")
                
                # JSON ??? ???
                json_str = json.dumps(result, ensure_ascii=False, indent=2)
                print(f"? JSON ??? ?? ({len(json_str)} bytes)")
                
            else:
                print("? ?? ??")
                
        except Exception as e:
            print(f"? ??? ??: {e}")
        
        finally:
            # ?? ?? ??
            os.unlink(temp_file)
    
    print("\n?? SMED Parser Test ??!")

if __name__ == '__main__':
    # ?? ??
    logging.basicConfig(level=logging.DEBUG)
    
    # ??? ??
    test_smed_parser()
