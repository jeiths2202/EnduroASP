#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Layout API Module for OpenASP System
Provides API endpoints for layout file management with SJIS to Unicode conversion
"""

import os
import json
import logging
from flask import jsonify

# Import smart encoding manager
try:
    from encoding_manager import smart_read_file, DestinationType
    SMART_ENCODING_AVAILABLE = True
except ImportError:
    SMART_ENCODING_AVAILABLE = False

logger = logging.getLogger(__name__)

def register_layout_routes(app):
    """Register layout-related API routes"""
    
    @app.route('/api/catalog/layout', methods=['GET'])
    def get_catalog_layout():
        """Get all LAYOUT type resources from catalog.json"""
        try:
            catalog_path = os.path.join(os.path.dirname(__file__), '..', 'config', 'catalog.json')
            
            if not os.path.exists(catalog_path):
                return jsonify({'error': 'Catalog file not found'}), 404
            
            with open(catalog_path, 'r', encoding='utf-8') as f:
                catalog = json.load(f)
            
            layout_entries = {}
            
            # Search through all volumes and libraries for LAYOUT type entries
            for volume_name, volume_data in catalog.items():
                if isinstance(volume_data, dict):
                    for library_name, library_data in volume_data.items():
                        if isinstance(library_data, dict):
                            for file_name, file_data in library_data.items():
                                if isinstance(file_data, dict) and file_data.get('TYPE') == 'LAYOUT':
                                    layout_entries[file_name] = {
                                        'volume': volume_name,
                                        'library': library_name,
                                        'name': file_name,
                                        'description': file_data.get('DESCRIPTION', ''),
                                        'recfm': file_data.get('RECFM', 'FB'),
                                        'lrecl': file_data.get('LRECL', '80')
                                    }
            
            return jsonify(layout_entries)
            
        except Exception as e:
            logger.error(f"Failed to get catalog layout entries: {e}")
            return jsonify({'error': str(e)}), 500

    @app.route('/api/layout/content/<layout_name>', methods=['GET'])
    def get_layout_content(layout_name):
        """Get layout file content with SJIS to Unicode conversion"""
        try:
            # First, get layout info from catalog
            catalog_path = os.path.join(os.path.dirname(__file__), '..', 'config', 'catalog.json')
            
            if not os.path.exists(catalog_path):
                return jsonify({'error': 'Catalog file not found'}), 404
            
            with open(catalog_path, 'r', encoding='utf-8') as f:
                catalog = json.load(f)
            
            # Find layout info in catalog
            layout_info = None
            for volume_name, volume_data in catalog.items():
                if isinstance(volume_data, dict):
                    for library_name, library_data in volume_data.items():
                        if isinstance(library_data, dict):
                            for file_name, file_data in library_data.items():
                                if file_name == layout_name and isinstance(file_data, dict) and file_data.get('TYPE') == 'LAYOUT':
                                    layout_info = {
                                        'volume': volume_name,
                                        'library': library_name,
                                        'name': file_name,
                                        'file_data': file_data
                                    }
                                    break
                            if layout_info:
                                break
                    if layout_info:
                        break
            
            if not layout_info:
                return jsonify({'error': f'Layout {layout_name} not found in catalog'}), 404
            
            # Construct file path: volume/VOLUME/LIBRARY/FILENAME
            # The server is in /home/aspuser/app/server, volume is in /home/aspuser/app/volume
            # Add .LAYOUT extension if not present
            filename = layout_info['name']
            if not filename.endswith('.LAYOUT'):
                filename += '.LAYOUT'
            
            file_path = os.path.join(
                '/home/aspuser/app/volume',
                layout_info['volume'],
                layout_info['library'],
                filename
            )
            
            logger.info(f"Reading layout file from: {file_path}")
            
            if not os.path.exists(file_path):
                return jsonify({'error': f'Layout file not found at {file_path}'}), 404
            
            # Use smart_read_file for SJIS to Unicode conversion
            if SMART_ENCODING_AVAILABLE:
                content = smart_read_file(file_path, DestinationType.API_RESPONSE)
            else:
                # Fallback: Try to read with SJIS encoding and convert to Unicode
                try:
                    with open(file_path, 'r', encoding='shift_jis') as f:
                        content = f.read()
                except UnicodeDecodeError:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        content = f.read()
            
            return jsonify({
                'success': True,
                'layout_name': layout_name,
                'volume': layout_info['volume'],
                'library': layout_info['library'],
                'content': content,
                'file_path': file_path,
                'description': layout_info['file_data'].get('DESCRIPTION', ''),
                'recfm': layout_info['file_data'].get('RECFM', 'FB'),
                'lrecl': layout_info['file_data'].get('LRECL', '80')
            })
            
        except Exception as e:
            logger.error(f"Failed to get layout content for {layout_name}: {e}")
            return jsonify({'error': str(e)}), 500