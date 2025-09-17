#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
EBCDIC Dataset Converter for OpenASP Project
Converts EBCDIC datasets to ASCII/SJIS with catalog.json integration
Based on project specifications with enhanced COBOL COPYBOOK support

Usage:
    python ebcdic_dataset_converter.py --input /data/assets/ebcdic/DEMO.SAM.ebc \
                                     --output /tmp/a.out \
                                     --layout /home/aspuser/app/volume/DISK01/LAYOUT/SAM001.LAYOUT \
                                     --record-length 80 \
                                     --encoding JAK \
                                     --sosi-so 0x28 \
                                     --sosi-si 0x29 \
                                     --convert-sosi-to-space
"""

import os
import sys
import json
import argparse
import struct
import logging
import re
from typing import Dict, List, Optional, Tuple, Any, Union
from dataclasses import dataclass
from pathlib import Path
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/tmp/ebcdic_dataset_converter.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

@dataclass
class LayoutField:
    """COBOL レイアウトフィールド定義 (Enhanced)"""
    name: str
    level: str
    type: str  # 'PIC' | 'COMP' | 'COMP-3' | 'COMP-4' | 'COMP-5'
    picture: str
    length: int
    position: int
    occurs: int = 1
    redefines: Optional[str] = None
    value: Optional[str] = None
    sign: Optional[str] = None  # 'LEADING' | 'TRAILING' | 'SEPARATE'
    usage: Optional[str] = None  # 'DISPLAY' | 'COMPUTATIONAL' | 'PACKED-DECIMAL'
    description: str = ""

@dataclass
class ConversionConfig:
    """変換設定 (Enhanced)"""
    input_file: str
    output_file: str
    layout_file: Optional[str] = None
    record_length: int = 80
    encoding: str = 'JAK'
    sosi_so: int = 0x28
    sosi_si: int = 0x29
    convert_sosi_to_space: bool = True
    catalog_path: str = '/home/aspuser/app/config/catalog.json'
    dataset_name: Optional[str] = None
    volume: str = 'DISK01'
    library: str = 'TESTLIB'
    update_catalog: bool = True

class EnhancedCOBOLParser:
    """Enhanced COBOL COPYBOOK parser with comprehensive data type support"""
    
    # COBOL data type patterns
    PIC_PATTERNS = {
        'NUMERIC': re.compile(r'9+|\d+'),
        'NUMERIC_WITH_LENGTH': re.compile(r'9\((\d+)\)'),
        'ALPHA': re.compile(r'A+'),
        'ALPHA_WITH_LENGTH': re.compile(r'A\((\d+)\)'),
        'ALPHANUMERIC': re.compile(r'X+'),
        'ALPHANUMERIC_WITH_LENGTH': re.compile(r'X\((\d+)\)'),
        'SIGNED_NUMERIC': re.compile(r'S9+|S\d+'),
        'SIGNED_NUMERIC_WITH_LENGTH': re.compile(r'S9\((\d+)\)'),
        'DECIMAL': re.compile(r'9+V9+|\d+V\d+'),
        'DECIMAL_WITH_LENGTH': re.compile(r'9\((\d+)\)V9\((\d+)\)'),
        'EDITED_NUMERIC': re.compile(r'[Z9]+[.,]?[Z9]*'),
        'NATIONAL': re.compile(r'N+'),
        'NATIONAL_WITH_LENGTH': re.compile(r'N\((\d+)\)'),
    }
    
    USAGE_TYPES = {
        'DISPLAY': 'PIC',
        'COMPUTATIONAL': 'COMP',
        'COMPUTATIONAL-1': 'COMP-1',
        'COMPUTATIONAL-2': 'COMP-2', 
        'COMPUTATIONAL-3': 'COMP-3',
        'COMPUTATIONAL-4': 'COMP-4',
        'COMPUTATIONAL-5': 'COMP-5',
        'PACKED-DECIMAL': 'COMP-3',
        'BINARY': 'COMP',
        'INDEX': 'INDEX',
        'POINTER': 'POINTER'
    }
    
    @classmethod
    def parse_picture_clause(cls, picture: str) -> Tuple[int, str]:
        """Parse PIC clause and return (length, data_type)"""
        picture = picture.upper().strip()
        
        # Handle V (implied decimal point) - doesn't affect byte length for DISPLAY
        working_picture = picture.replace('V', '')
        
        # Handle S (sign) - doesn't affect byte length for DISPLAY
        if working_picture.startswith('S'):
            working_picture = working_picture[1:]
        
        # Extract length from parentheses notation: 9(5), X(20), etc.
        paren_match = re.search(r'([9XAN])\((\d+)\)', working_picture)
        if paren_match:
            char_type = paren_match.group(1)
            length = int(paren_match.group(2))
            
            # Determine data type
            if char_type == '9':
                data_type = 'NUMERIC'
            elif char_type == 'X':
                data_type = 'ALPHANUMERIC'
            elif char_type == 'A':
                data_type = 'ALPHA'
            elif char_type == 'N':
                data_type = 'NATIONAL'
            else:
                data_type = 'DISPLAY'
            
            return length, data_type
        
        # Count consecutive characters for patterns like 999, XXX, AAA
        total_length = 0
        data_type = 'DISPLAY'
        
        # Simple pattern matching for consecutive characters
        for pattern, char_type in [('9', 'NUMERIC'), ('X', 'ALPHANUMERIC'), ('A', 'ALPHA'), ('N', 'NATIONAL')]:
            matches = re.findall(pattern + '+', working_picture)
            for match in matches:
                total_length += len(match)
                data_type = char_type
        
        return max(total_length, 1), data_type
    
    @classmethod
    def calculate_field_length(cls, field: LayoutField) -> int:
        """Calculate actual byte length based on USAGE and PIC"""
        base_length, _ = cls.parse_picture_clause(field.picture)
        
        # Apply USAGE modifications
        if field.type in ['COMP', 'COMP-4', 'COMP-5']:
            # Binary storage
            if base_length <= 4:
                return 2
            elif base_length <= 9:
                return 4
            else:
                return 8
        elif field.type == 'COMP-1':
            return 4  # Single precision float
        elif field.type == 'COMP-2':
            return 8  # Double precision float
        elif field.type == 'COMP-3':
            # Packed decimal: (digits + 1) / 2
            return (base_length + 1) // 2
        else:
            # DISPLAY format
            return base_length * field.occurs

class EBCDICDatasetConverter:
    """Enhanced EBCDIC Dataset Converter with catalog.json integration"""
    
    # Enhanced EBCDIC to ASCII conversion table for JAK (Japanese EBCDIC)
    EBCDIC_TO_ASCII_JAK = {
        # Control characters
        0x00: 0x00, 0x01: 0x01, 0x02: 0x02, 0x03: 0x03, 0x04: 0x37, 0x05: 0x2D, 0x06: 0x2E, 0x07: 0x2F,
        0x08: 0x16, 0x09: 0x05, 0x0A: 0x25, 0x0B: 0x0B, 0x0C: 0x0C, 0x0D: 0x0D, 0x0E: 0x0E, 0x0F: 0x0F,
        0x10: 0x10, 0x11: 0x11, 0x12: 0x12, 0x13: 0x13, 0x14: 0x3C, 0x15: 0x3D, 0x16: 0x32, 0x17: 0x26,
        0x18: 0x18, 0x19: 0x19, 0x1A: 0x3F, 0x1B: 0x27, 0x1C: 0x1C, 0x1D: 0x1D, 0x1E: 0x1E, 0x1F: 0x1F,
        
        # Special characters and punctuation
        0x40: 0x20,  # Space
        0x4A: 0x5B,  # [
        0x4B: 0x2E,  # .
        0x4C: 0x3C,  # <
        0x4D: 0x28,  # (
        0x4E: 0x2B,  # +
        0x4F: 0x21,  # !
        0x50: 0x26,  # &
        0x5A: 0x5D,  # ]
        0x5B: 0x24,  # $
        0x5C: 0x2A,  # *
        0x5D: 0x29,  # )
        0x5E: 0x3B,  # ;
        0x5F: 0x5E,  # ^
        0x60: 0x2D,  # -
        0x61: 0x2F,  # /
        0x6A: 0x7C,  # |
        0x6B: 0x2C,  # ,
        0x6C: 0x25,  # %
        0x6D: 0x5F,  # _
        0x6E: 0x3E,  # >
        0x6F: 0x3F,  # ?
        0x7A: 0x3A,  # :
        0x7B: 0x23,  # #
        0x7C: 0x40,  # @
        0x7D: 0x27,  # '
        0x7E: 0x3D,  # =
        0x7F: 0x22,  # "
        
        # Lowercase letters a-i
        0x81: 0x61, 0x82: 0x62, 0x83: 0x63, 0x84: 0x64, 0x85: 0x65,
        0x86: 0x66, 0x87: 0x67, 0x88: 0x68, 0x89: 0x69,
        
        # Lowercase letters j-r
        0x91: 0x6A, 0x92: 0x6B, 0x93: 0x6C, 0x94: 0x6D, 0x95: 0x6E,
        0x96: 0x6F, 0x97: 0x70, 0x98: 0x71, 0x99: 0x72,
        
        # Lowercase letters s-z
        0xA2: 0x73, 0xA3: 0x74, 0xA4: 0x75, 0xA5: 0x76, 0xA6: 0x77,
        0xA7: 0x78, 0xA8: 0x79, 0xA9: 0x7A,
        
        # Uppercase letters A-I
        0xC1: 0x41, 0xC2: 0x42, 0xC3: 0x43, 0xC4: 0x44, 0xC5: 0x45,
        0xC6: 0x46, 0xC7: 0x47, 0xC8: 0x48, 0xC9: 0x49,
        
        # Uppercase letters J-R
        0xD1: 0x4A, 0xD2: 0x4B, 0xD3: 0x4C, 0xD4: 0x4D, 0xD5: 0x4E,
        0xD6: 0x4F, 0xD7: 0x50, 0xD8: 0x51, 0xD9: 0x52,
        
        # Uppercase letters S-Z
        0xE2: 0x53, 0xE3: 0x54, 0xE4: 0x55, 0xE5: 0x56, 0xE6: 0x57,
        0xE7: 0x58, 0xE8: 0x59, 0xE9: 0x5A,
        
        # Numbers 0-9
        0xF0: 0x30, 0xF1: 0x31, 0xF2: 0x32, 0xF3: 0x33, 0xF4: 0x34,
        0xF5: 0x35, 0xF6: 0x36, 0xF7: 0x37, 0xF8: 0x38, 0xF9: 0x39,
        
        # Additional special characters
        0x79: 0x60,  # `
        0x7A: 0x3A,  # :
        0xBB: 0x5C,  # \
        0xBC: 0x7B,  # {
        0xBD: 0x7D,  # }
        0xBE: 0x7E,  # ~
    }
    
    def __init__(self, config: ConversionConfig):
        self.config = config
        self.layout_fields: List[LayoutField] = []
        self.catalog_metadata: Optional[Dict] = None
        self.cobol_parser = EnhancedCOBOLParser()
        
    def load_catalog_metadata(self) -> Optional[Dict]:
        """Load dataset metadata from catalog.json"""
        if not os.path.exists(self.config.catalog_path):
            logger.warning(f"Catalog file not found: {self.config.catalog_path}")
            return None
        
        try:
            with open(self.config.catalog_path, 'r', encoding='utf-8') as f:
                catalog = json.load(f)
            
            # Navigate to dataset metadata
            if (self.config.volume in catalog and 
                self.config.library in catalog[self.config.volume] and
                self.config.dataset_name and
                self.config.dataset_name in catalog[self.config.volume][self.config.library]):
                
                metadata = catalog[self.config.volume][self.config.library][self.config.dataset_name]
                logger.info(f"Loaded catalog metadata for {self.config.dataset_name}: {metadata}")
                return metadata
            else:
                logger.warning(f"Dataset {self.config.dataset_name} not found in catalog")
                return None
                
        except Exception as e:
            logger.error(f"Failed to load catalog metadata: {e}")
            return None
    
    def parse_layout_file(self) -> List[LayoutField]:
        """Parse COBOL COPYBOOK/layout file with enhanced support"""
        if not self.config.layout_file:
            logger.warning("No layout file specified")
            return []
        
        logger.info(f"Parsing layout file: {self.config.layout_file}")
        
        if not os.path.exists(self.config.layout_file):
            raise FileNotFoundError(f"Layout file not found: {self.config.layout_file}")
        
        fields = []
        current_position = 1
        
        # Try different encodings
        encodings = ['shift_jis', 'utf-8', 'cp932', 'latin1']
        content = None
        
        for encoding in encodings:
            try:
                with open(self.config.layout_file, 'r', encoding=encoding) as f:
                    content = f.read()
                logger.info(f"Successfully read layout file with {encoding} encoding")
                break
            except UnicodeDecodeError:
                continue
        
        if content is None:
            raise ValueError(f"Could not read layout file with any encoding: {encodings}")
        
        lines = content.split('\n')
        
        for line_num, line in enumerate(lines, 1):
            line = line.rstrip()
            
            # Skip comments and empty lines
            if not line.strip() or line.strip().startswith('*') or line.strip().startswith('#'):
                continue
            
            # Enhanced COBOL field pattern matching
            field_match = re.match(
                r'^\s*(\d+)\s+([A-Z0-9_-]+)\s+(?:PIC\s+([X9ASNVZ()0-9.,\-/V]+))?\s*(?:(COMP(?:-[1-5])?|DISPLAY|PACKED-DECIMAL|BINARY|INDEX|POINTER))?\s*(?:OCCURS\s+(\d+))?\s*(?:REDEFINES\s+([A-Z0-9_-]+))?\s*(?:VALUE\s+([^.]+))?\s*\.?\s*(.*)$',
                line,
                re.IGNORECASE
            )
            
            if field_match:
                (level, name, picture, usage, occurs, redefines, value, description) = field_match.groups()
                
                level_num = int(level)
                
                # Skip group level items (01, 02) unless they have PIC
                if level_num <= 2 and not picture:
                    continue
                
                picture = picture or 'X(1)'  # Default PIC
                occurs_count = int(occurs) if occurs else 1
                
                # Determine field type from USAGE
                field_type = 'PIC'  # Default
                if usage:
                    usage_upper = usage.upper()
                    field_type = self.cobol_parser.USAGE_TYPES.get(usage_upper, 'PIC')
                
                # Create field definition
                field = LayoutField(
                    name=name,
                    level=level,
                    type=field_type,
                    picture=picture,
                    length=0,  # Will be calculated
                    position=current_position,
                    occurs=occurs_count,
                    redefines=redefines,
                    value=value,
                    usage=usage,
                    description=description.strip() if description else ""
                )
                
                # Calculate actual field length
                field.length = self.cobol_parser.calculate_field_length(field)
                
                fields.append(field)
                
                # Update position only if not a REDEFINES
                if not redefines:
                    current_position += field.length
                
                logger.debug(f"Parsed field: {field.name} ({field.type}) "
                           f"PIC {field.picture} Length={field.length} Pos={field.position}")
        
        if not fields:
            raise ValueError("No field definitions found in layout file")
        
        logger.info(f"Successfully parsed {len(fields)} fields from layout")
        self.layout_fields = fields
        return fields
    
    def convert_ebcdic_byte(self, byte_val: int) -> int:
        """Convert single EBCDIC byte to ASCII"""
        return self.EBCDIC_TO_ASCII_JAK.get(byte_val, byte_val)
    
    def process_sosi_codes(self, data: bytes) -> bytes:
        """Process SOSI (Shift-Out/Shift-In) codes"""
        if not self.config.convert_sosi_to_space:
            return data
        
        processed = bytearray(data)
        for i in range(len(processed)):
            if processed[i] in [self.config.sosi_so, self.config.sosi_si]:
                processed[i] = 0x20  # Convert to space
        
        return bytes(processed)
    
    def convert_field_data(self, field: LayoutField, field_data: bytes) -> Tuple[bytes, str]:
        """Convert field data based on its type"""
        if field.type in ['COMP', 'COMP-1', 'COMP-2', 'COMP-3', 'COMP-4', 'COMP-5']:
            # Binary/packed fields: handle specially
            if field.type == 'COMP-3':
                # Packed decimal conversion
                return self._convert_packed_decimal(field_data), 'PACKED'
            else:
                # Other binary formats: preserve as-is for now
                logger.debug(f"Binary field {field.name}: {field_data.hex()}")
                return field_data, 'BINARY'
        else:
            # Display format: convert EBCDIC to ASCII
            converted = bytearray()
            for byte_val in field_data:
                converted_byte = self.convert_ebcdic_byte(byte_val)
                converted.append(converted_byte)
            
            # Process SOSI codes
            converted_data = self.process_sosi_codes(bytes(converted))
            
            logger.debug(f"Field {field.name} converted: {field_data.hex()} -> {converted_data.hex()}")
            return converted_data, 'DISPLAY'
    
    def _convert_packed_decimal(self, packed_data: bytes) -> bytes:
        """Convert packed decimal (COMP-3) to display format"""
        try:
            # Unpack packed decimal to string representation
            result = ""
            for i, byte_val in enumerate(packed_data):
                high_nibble = (byte_val >> 4) & 0x0F
                low_nibble = byte_val & 0x0F
                
                if i == len(packed_data) - 1:
                    # Last byte: high nibble is digit, low nibble is sign
                    if high_nibble <= 9:
                        result += str(high_nibble)
                    # Sign handling: 0xC/0xF = positive, 0xD = negative
                    if low_nibble == 0xD:
                        result = '-' + result
                else:
                    # Regular bytes: both nibbles are digits
                    if high_nibble <= 9:
                        result += str(high_nibble)
                    if low_nibble <= 9:
                        result += str(low_nibble)
            
            return result.encode('ascii')
        except Exception as e:
            logger.warning(f"Packed decimal conversion failed: {e}")
            return packed_data  # Return original if conversion fails
    
    def update_catalog_entry(self, output_file: str, conversion_stats: Dict):
        """Update catalog.json with conversion information"""
        if not self.config.update_catalog or not self.config.dataset_name:
            return
        
        try:
            # Load current catalog
            with open(self.config.catalog_path, 'r', encoding='utf-8') as f:
                catalog = json.load(f)
            
            # Navigate to dataset entry
            volume_data = catalog.setdefault(self.config.volume, {})
            library_data = volume_data.setdefault(self.config.library, {})
            dataset_data = library_data.setdefault(self.config.dataset_name, {})
            
            # Add conversion metadata
            dataset_data.update({
                'TYPE': 'DATASET',
                'RECTYPE': 'FB',  # Assume Fixed Block after conversion
                'RECLEN': self.config.record_length,
                'ENCODING': 'ascii',  # After conversion
                'DESCRIPTION': f"Converted from EBCDIC ({self.config.encoding})",
                'UPDATED': datetime.utcnow().isoformat() + 'Z',
                'CONVERSION': {
                    'SOURCE_ENCODING': self.config.encoding,
                    'SOURCE_FILE': self.config.input_file,
                    'LAYOUT_FILE': self.config.layout_file,
                    'CONVERTED_RECORDS': conversion_stats.get('records_converted', 0),
                    'CONVERSION_DATE': datetime.utcnow().isoformat() + 'Z'
                }
            })
            
            # Write back to catalog
            with open(self.config.catalog_path, 'w', encoding='utf-8') as f:
                json.dump(catalog, f, indent=2, ensure_ascii=False)
            
            logger.info(f"Updated catalog entry for {self.config.dataset_name}")
            
        except Exception as e:
            logger.error(f"Failed to update catalog: {e}")
    
    def convert_dataset(self) -> Dict[str, Any]:
        """Main conversion process"""
        logger.info("=== EBCDIC Dataset Conversion Started ===")
        logger.info(f"Input: {self.config.input_file}")
        logger.info(f"Output: {self.config.output_file}")
        logger.info(f"Layout: {self.config.layout_file}")
        logger.info(f"Record Length: {self.config.record_length}")
        logger.info(f"Encoding: {self.config.encoding}")
        logger.info(f"SOSI SO: 0x{self.config.sosi_so:02X}, SI: 0x{self.config.sosi_si:02X}")
        
        # Load catalog metadata
        self.catalog_metadata = self.load_catalog_metadata()
        
        # Parse layout
        if self.config.layout_file:
            fields = self.parse_layout_file()
            total_field_length = sum(field.length for field in fields)
            logger.info(f"Layout parsed: {len(fields)} fields, total length={total_field_length} bytes")
            
            if total_field_length > self.config.record_length:
                logger.warning(f"Field total ({total_field_length}) > record length ({self.config.record_length})")
        else:
            fields = []
            logger.info("No layout file - processing as raw EBCDIC records")
        
        # Check input file
        if not os.path.exists(self.config.input_file):
            raise FileNotFoundError(f"Input file not found: {self.config.input_file}")
        
        file_size = os.path.getsize(self.config.input_file)
        record_count = file_size // self.config.record_length
        
        logger.info(f"Input file size: {file_size} bytes")
        logger.info(f"Expected records: {record_count}")
        
        # Create output directory
        os.makedirs(os.path.dirname(self.config.output_file), exist_ok=True)
        
        # Conversion statistics
        stats = {
            'records_converted': 0,
            'bytes_processed': 0,
            'conversion_errors': 0,
            'field_conversions': 0
        }
        
        # Process conversion
        with open(self.config.input_file, 'rb') as infile, \
             open(self.config.output_file, 'wb') as outfile:
            
            for record_index in range(record_count):
                try:
                    # Read record
                    record_data = infile.read(self.config.record_length)
                    if len(record_data) < self.config.record_length:
                        logger.warning(f"Record {record_index + 1}: incomplete data ({len(record_data)} < {self.config.record_length})")
                        break
                    
                    stats['bytes_processed'] += len(record_data)
                    
                    if fields:
                        # Field-based conversion
                        converted_record = bytearray()
                        
                        for field in fields:
                            field_start = field.position - 1  # Convert to 0-based
                            field_end = field_start + field.length
                            
                            if field_end > len(record_data):
                                logger.warning(f"Field {field.name} exceeds record boundary")
                                field_data = record_data[field_start:] + b'\x00' * (field.length - (len(record_data) - field_start))
                            else:
                                field_data = record_data[field_start:field_end]
                            
                            converted_data, conversion_type = self.convert_field_data(field, field_data)
                            converted_record.extend(converted_data)
                            stats['field_conversions'] += 1
                        
                        # Pad to original record length
                        while len(converted_record) < self.config.record_length:
                            converted_record.append(0x20)
                        
                        if len(converted_record) > self.config.record_length:
                            converted_record = converted_record[:self.config.record_length]
                        
                        outfile.write(converted_record)
                    else:
                        # Raw EBCDIC conversion
                        converted_record = bytearray()
                        for byte_val in record_data:
                            converted_byte = self.convert_ebcdic_byte(byte_val)
                            converted_record.append(converted_byte)
                        
                        # Process SOSI codes
                        converted_record = self.process_sosi_codes(bytes(converted_record))
                        outfile.write(converted_record)
                    
                    stats['records_converted'] += 1
                    
                    if (record_index + 1) % 1000 == 0:
                        logger.info(f"Processed {record_index + 1} records")
                        
                except Exception as e:
                    logger.error(f"Error processing record {record_index + 1}: {e}")
                    stats['conversion_errors'] += 1
        
        # Update catalog
        self.update_catalog_entry(self.config.output_file, stats)
        
        logger.info("=== Conversion Complete ===")
        logger.info(f"Records converted: {stats['records_converted']}")
        logger.info(f"Bytes processed: {stats['bytes_processed']}")
        logger.info(f"Field conversions: {stats['field_conversions']}")
        logger.info(f"Conversion errors: {stats['conversion_errors']}")
        logger.info(f"Output file: {self.config.output_file}")
        logger.info(f"Output size: {os.path.getsize(self.config.output_file)} bytes")
        
        return stats

def create_sample_files():
    """Create sample EBCDIC data and layout files for testing"""
    # Create LAYOUT directory
    layout_dir = "/home/aspuser/app/volume/DISK01/LAYOUT/"
    os.makedirs(layout_dir, exist_ok=True)
    
    # Enhanced sample layout with more data types
    sample_layout = """      * Enhanced SAM001 Layout Definition
      * Record Format: Fixed Block (FB)
      * Record Length: 80 bytes
      * Enhanced with multiple COBOL data types
      * 
      01  EMPLOYEE-RECORD.
          03  EMPLOYEE-ID     PIC 9(5).
          03  EMPLOYEE-NAME   PIC X(20).
          03  DEPARTMENT      PIC X(10).
          03  HIRE-DATE       PIC X(8).
          03  SALARY          PIC 9(7)V99 COMP-3.
          03  STATUS          PIC X(1).
          03  MANAGER-FLAG    PIC 9 COMP.
          03  EMAIL           PIC X(15).
          03  PHONE           PIC X(12).
          03  RESERVED        PIC X(8).
"""
    
    with open(f"{layout_dir}/SAM001.LAYOUT", 'w', encoding='utf-8') as f:
        f.write(sample_layout)
    
    # Create sample EBCDIC data
    ebcdic_dir = "/data/assets/ebcdic/"
    os.makedirs(ebcdic_dir, exist_ok=True)
    
    # Enhanced sample records with proper EBCDIC encoding
    sample_records = [
        # Employee ID (5) + Name (20) + Dept (10) + Date (8) + Salary COMP-3 (5) + Status (1) + Manager COMP (2) + Email (15) + Phone (12) + Reserved (8)
        b'\xF0\xF0\xF0\xF0\xF1' +  # 00001
        b'TARO TANAKA        ' +   # Name (20 bytes)
        b'SALES     ' +            # Department (10 bytes)
        b'20240401' +              # Hire date (8 bytes)
        b'\x05\x00\x00\x0C' +      # Salary COMP-3: 5000000 (5 bytes packed)
        b'A' +                     # Status (1 byte)
        b'\x00\x01' +              # Manager flag COMP (2 bytes)
        b'taro@company.com ' +      # Email (15 bytes)
        b'080-1234-5678 ' +         # Phone (12 bytes)
        b' ' * 8,                   # Reserved (8 bytes)
    ]
    
    with open(f"{ebcdic_dir}/DEMO.SAM.ebc", 'wb') as f:
        for record in sample_records:
            # Ensure exactly 80 bytes
            if len(record) < 80:
                record += b' ' * (80 - len(record))
            elif len(record) > 80:
                record = record[:80]
            f.write(record)
    
    logger.info("Created enhanced sample files")

def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description='Enhanced EBCDIC Dataset Converter for OpenASP')
    parser.add_argument('--input', help='Input EBCDIC file path')
    parser.add_argument('--output', help='Output converted file path')
    parser.add_argument('--layout', help='COBOL layout/copybook file path')
    parser.add_argument('--record-length', type=int, default=80, help='Record length in bytes')
    parser.add_argument('--encoding', default='JAK', help='EBCDIC encoding type (default: JAK)')
    parser.add_argument('--sosi-so', default='0x28', help='SOSI Shift-Out code (default: 0x28)')
    parser.add_argument('--sosi-si', default='0x29', help='SOSI Shift-In code (default: 0x29)')
    parser.add_argument('--convert-sosi-to-space', action='store_true', default=True,
                       help='Convert SOSI codes to spaces (default: True)')
    parser.add_argument('--dataset-name', help='Dataset name for catalog integration')
    parser.add_argument('--volume', default='DISK01', help='Volume name (default: DISK01)')
    parser.add_argument('--library', default='TESTLIB', help='Library name (default: TESTLIB)')
    parser.add_argument('--catalog-path', default='/home/aspuser/app/config/catalog.json',
                       help='Path to catalog.json file')
    parser.add_argument('--no-catalog-update', action='store_true',
                       help='Skip catalog.json update')
    parser.add_argument('--create-sample', action='store_true',
                       help='Create enhanced sample files for testing')
    parser.add_argument('--verbose', '-v', action='store_true', help='Verbose logging')
    
    args = parser.parse_args()
    
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    # Create sample files if requested
    if args.create_sample:
        create_sample_files()
        logger.info("Enhanced sample files created successfully")
        return 0
    
    # Validate required arguments
    if not all([args.input, args.output]):
        parser.error("--input and --output are required for conversion")
    
    # Parse SOSI codes
    sosi_so = int(args.sosi_so, 16) if args.sosi_so.startswith('0x') else int(args.sosi_so)
    sosi_si = int(args.sosi_si, 16) if args.sosi_si.startswith('0x') else int(args.sosi_si)
    
    # Create configuration
    config = ConversionConfig(
        input_file=args.input,
        output_file=args.output,
        layout_file=args.layout,
        record_length=args.record_length,
        encoding=args.encoding,
        sosi_so=sosi_so,
        sosi_si=sosi_si,
        convert_sosi_to_space=args.convert_sosi_to_space,
        dataset_name=args.dataset_name,
        volume=args.volume,
        library=args.library,
        catalog_path=args.catalog_path,
        update_catalog=not args.no_catalog_update
    )
    
    try:
        # Create converter and run conversion
        converter = EBCDICDatasetConverter(config)
        stats = converter.convert_dataset()
        
        logger.info("Conversion completed successfully")
        logger.info(f"Statistics: {stats}")
        return 0
        
    except Exception as e:
        logger.error(f"Conversion failed: {e}")
        return 1

if __name__ == "__main__":
    sys.exit(main())