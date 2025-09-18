#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Smart Encoding Manager for OpenASP System
Provides destination-aware encoding conversion to minimize unnecessary SJIS/Unicode conversions
"""

import logging
from enum import Enum
from typing import Union, Optional, Dict, Any

logger = logging.getLogger(__name__)

class DestinationType(Enum):
    """Destination types for encoding conversion decisions"""
    WEB_UI = "web_ui"           # Browser/Web interface - needs Unicode
    SERVER_INTERNAL = "server"  # Server internal processing - keep original
    FILE_SYSTEM = "filesystem"  # File operations - keep original encoding
    API_RESPONSE = "api"        # API responses - needs Unicode
    TERMINAL = "terminal"       # Terminal display - depends on context
    DATABASE = "database"       # Database storage - needs Unicode

class ConversionContext:
    """Context information for making encoding conversion decisions"""
    
    def __init__(self, destination: DestinationType, 
                 source_encoding: Optional[str] = None,
                 target_encoding: Optional[str] = None,
                 preserve_original: bool = False):
        self.destination = destination
        self.source_encoding = source_encoding
        self.target_encoding = target_encoding
        self.preserve_original = preserve_original
        self.metadata = {}
    
    def add_metadata(self, key: str, value: Any):
        """Add context metadata"""
        self.metadata[key] = value
    
    def is_conversion_needed(self) -> bool:
        """Determine if encoding conversion is actually needed"""
        # Server internal processing - no conversion needed
        if self.destination == DestinationType.SERVER_INTERNAL:
            return False
        
        # File system operations - preserve original encoding
        if self.destination == DestinationType.FILE_SYSTEM:
            return False
        
        # Web UI and API responses need Unicode
        if self.destination in [DestinationType.WEB_UI, DestinationType.API_RESPONSE]:
            return self.source_encoding != 'utf-8'
        
        # Database operations need consistent encoding
        if self.destination == DestinationType.DATABASE:
            return self.source_encoding != 'utf-8'
        
        # Terminal depends on context
        if self.destination == DestinationType.TERMINAL:
            return self.metadata.get('terminal_type') == 'web'
        
        return False

class SmartEncodingManager:
    """Smart encoding manager that only converts when necessary"""
    
    def __init__(self):
        self.conversion_stats = {
            'conversions_performed': 0,
            'conversions_skipped': 0,
            'detection_attempts': 0
        }
    
    def detect_encoding(self, data: bytes) -> str:
        """Detect encoding of binary data"""
        self.conversion_stats['detection_attempts'] += 1
        
        try:
            # Try SJIS first for Japanese legacy files
            data.decode('shift_jis')
            logger.debug("Detected encoding: shift_jis")
            return 'shift_jis'
        except UnicodeDecodeError:
            pass
        
        try:
            # Try UTF-8
            data.decode('utf-8')
            logger.debug("Detected encoding: utf-8")
            return 'utf-8'
        except UnicodeDecodeError:
            pass
        
        # Fallback to UTF-8 if no encoding detected
        logger.debug("No encoding detected, defaulting to utf-8")
        return 'utf-8'
    
    def smart_decode(self, data: Union[bytes, str], context: ConversionContext) -> str:
        """Smart decoding based on destination context"""
        
        # If already string, return as-is for server internal
        if isinstance(data, str):
            if not context.is_conversion_needed():
                self.conversion_stats['conversions_skipped'] += 1
                logger.debug(f"Skipping conversion for destination: {context.destination.value}")
                return data
            else:
                # String to string conversion if needed
                return self._convert_string_encoding(data, context)
        
        # Handle bytes data
        if not context.is_conversion_needed():
            # For server internal processing, decode with original encoding
            encoding = context.source_encoding or self.detect_encoding(data)
            result = data.decode(encoding, errors='replace')
            self.conversion_stats['conversions_skipped'] += 1
            logger.debug(f"Direct decode without conversion for {context.destination.value}")
            return result
        
        # Perform necessary conversion
        return self._perform_conversion(data, context)
    
    def _perform_conversion(self, data: bytes, context: ConversionContext) -> str:
        """Perform actual encoding conversion"""
        self.conversion_stats['conversions_performed'] += 1
        
        source_encoding = context.source_encoding or self.detect_encoding(data)
        
        try:
            # Decode from source encoding
            if source_encoding == 'shift_jis':
                decoded = data.decode('shift_jis', errors='replace')
                logger.debug(f"SJIS to Unicode conversion for {context.destination.value}")
            else:
                decoded = data.decode(source_encoding, errors='replace')
                logger.debug(f"Conversion from {source_encoding} for {context.destination.value}")
            
            return decoded
            
        except Exception as e:
            logger.warning(f"Encoding conversion failed: {e}, using UTF-8 fallback")
            return data.decode('utf-8', errors='replace')
    
    def _convert_string_encoding(self, data: str, context: ConversionContext) -> str:
        """Convert string between encodings if needed"""
        # For most cases, string data is already in correct format
        self.conversion_stats['conversions_skipped'] += 1
        return data
    
    def smart_encode(self, data: str, context: ConversionContext) -> bytes:
        """Smart encoding based on destination"""
        
        # File system operations - preserve original encoding
        if context.destination == DestinationType.FILE_SYSTEM:
            encoding = context.target_encoding or 'shift_jis'
            return data.encode(encoding, errors='replace')
        
        # Web UI and API - UTF-8
        if context.destination in [DestinationType.WEB_UI, DestinationType.API_RESPONSE]:
            return data.encode('utf-8', errors='replace')
        
        # Default to UTF-8
        return data.encode('utf-8', errors='replace')
    
    def get_stats(self) -> Dict[str, int]:
        """Get conversion statistics"""
        return self.conversion_stats.copy()
    
    def reset_stats(self):
        """Reset conversion statistics"""
        self.conversion_stats = {
            'conversions_performed': 0,
            'conversions_skipped': 0,
            'detection_attempts': 0
        }

# Global instance
smart_encoding_manager = SmartEncodingManager()

# Convenience functions
def smart_read_file(file_path: str, destination: DestinationType, **kwargs) -> str:
    """Smart file reading with destination-aware encoding"""
    
    context = ConversionContext(
        destination=destination,
        source_encoding=kwargs.get('source_encoding'),
        preserve_original=kwargs.get('preserve_original', False)
    )
    
    # Add metadata
    if 'terminal_type' in kwargs:
        context.add_metadata('terminal_type', kwargs['terminal_type'])
    
    try:
        with open(file_path, 'rb') as f:
            data = f.read()
        
        return smart_encoding_manager.smart_decode(data, context)
        
    except Exception as e:
        logger.error(f"Failed to read file {file_path}: {e}")
        raise

def smart_write_file(file_path: str, content: str, destination: DestinationType, **kwargs):
    """Smart file writing with destination-aware encoding"""
    
    context = ConversionContext(
        destination=destination,
        target_encoding=kwargs.get('target_encoding'),
        preserve_original=kwargs.get('preserve_original', False)
    )
    
    try:
        encoded_data = smart_encoding_manager.smart_encode(content, context)
        
        with open(file_path, 'wb') as f:
            f.write(encoded_data)
        
        logger.debug(f"File written to {file_path} with smart encoding")
        
    except Exception as e:
        logger.error(f"Failed to write file {file_path}: {e}")
        raise

# Legacy compatibility functions (to be gradually replaced)
def legacy_sjis_decode(data: bytes, force_conversion: bool = True) -> str:
    """Legacy SJIS decode function for backward compatibility"""
    if not force_conversion:
        # New behavior - check if conversion is really needed
        context = ConversionContext(DestinationType.SERVER_INTERNAL)
        return smart_encoding_manager.smart_decode(data, context)
    else:
        # Old behavior - always convert
        return data.decode('shift_jis', errors='replace')