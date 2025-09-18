#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Smart SMED File Reader
Provides destination-aware SMED file reading without unnecessary encoding conversions
"""

import os
import logging
from typing import Optional, Dict, Any

try:
    from encoding_manager import smart_read_file, DestinationType
    SMART_ENCODING_AVAILABLE = True
except ImportError:
    SMART_ENCODING_AVAILABLE = False

logger = logging.getLogger(__name__)

class SMEDReader:
    """Smart SMED file reader with destination-aware encoding"""
    
    def __init__(self):
        self.read_stats = {
            'files_read': 0,
            'conversions_avoided': 0,
            'web_ui_reads': 0,
            'server_internal_reads': 0
        }
    
    def read_smed_file(self, file_path: str, destination: str = 'server', **kwargs) -> str:
        """
        Read SMED file with smart encoding based on destination
        
        Args:
            file_path: Path to SMED file
            destination: 'web_ui', 'api', 'server', 'terminal'
            **kwargs: Additional context parameters
        
        Returns:
            File content as string with appropriate encoding
        """
        self.read_stats['files_read'] += 1
        
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"SMED file not found: {file_path}")
        
        if SMART_ENCODING_AVAILABLE:
            return self._smart_read(file_path, destination, **kwargs)
        else:
            return self._legacy_read(file_path, destination)
    
    def _smart_read(self, file_path: str, destination: str, **kwargs) -> str:
        """Smart read using encoding manager"""
        dest_map = {
            'web_ui': DestinationType.WEB_UI,
            'api': DestinationType.API_RESPONSE,
            'server': DestinationType.SERVER_INTERNAL,
            'terminal': DestinationType.TERMINAL,
            'filesystem': DestinationType.FILE_SYSTEM
        }
        
        dest_type = dest_map.get(destination, DestinationType.SERVER_INTERNAL)
        
        # Track usage patterns
        if dest_type == DestinationType.WEB_UI:
            self.read_stats['web_ui_reads'] += 1
        elif dest_type == DestinationType.SERVER_INTERNAL:
            self.read_stats['server_internal_reads'] += 1
        
        # Add terminal context if provided
        terminal_type = kwargs.get('terminal_type', 'console')
        
        try:
            content = smart_read_file(
                file_path, 
                dest_type,
                terminal_type=terminal_type,
                source_encoding=kwargs.get('source_encoding'),
                preserve_original=kwargs.get('preserve_original', False)
            )
            
            # Log conversion avoidance for server internal processing
            if dest_type == DestinationType.SERVER_INTERNAL:
                self.read_stats['conversions_avoided'] += 1
                logger.debug(f"Server internal read - conversion avoided for {file_path}")
            
            return content
            
        except Exception as e:
            logger.error(f"Smart read failed for {file_path}: {e}")
            return self._legacy_read(file_path, destination)
    
    def _legacy_read(self, file_path: str, destination: str) -> str:
        """Legacy file reading with forced conversion"""
        logger.warning(f"Using legacy read for {file_path} (smart encoding not available)")
        
        try:
            # Try SJIS first
            with open(file_path, 'rb') as f:
                raw_data = f.read()
            
            if destination in ['web_ui', 'api']:
                # Force conversion for web destinations
                return raw_data.decode('shift_jis', errors='replace')
            else:
                # For server internal, try to minimize conversion
                try:
                    return raw_data.decode('shift_jis', errors='replace')
                except:
                    return raw_data.decode('utf-8', errors='replace')
                    
        except Exception as e:
            logger.error(f"Legacy read failed for {file_path}: {e}")
            raise
    
    def get_stats(self) -> Dict[str, int]:
        """Get reading statistics"""
        return self.read_stats.copy()
    
    def reset_stats(self):
        """Reset statistics"""
        self.read_stats = {
            'files_read': 0,
            'conversions_avoided': 0,
            'web_ui_reads': 0,
            'server_internal_reads': 0
        }

# Global instance for easy access
smed_reader = SMEDReader()

# Convenience functions
def read_smed_for_web(file_path: str) -> str:
    """Read SMED file for web UI display"""
    return smed_reader.read_smed_file(file_path, destination='web_ui')

def read_smed_for_server(file_path: str, preserve_encoding: bool = True) -> str:
    """Read SMED file for server internal processing"""
    return smed_reader.read_smed_file(
        file_path, 
        destination='server',
        preserve_original=preserve_encoding
    )

def read_smed_for_api(file_path: str) -> str:
    """Read SMED file for API responses"""
    return smed_reader.read_smed_file(file_path, destination='api')

def read_smed_for_terminal(file_path: str, terminal_type: str = 'console') -> str:
    """Read SMED file for terminal display"""
    return smed_reader.read_smed_file(
        file_path, 
        destination='terminal',
        terminal_type=terminal_type
    )