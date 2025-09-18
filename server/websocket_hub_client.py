#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
WebSocket Hub Client for Direct SMED Data Transmission

This client allows Java programs and other external processes to send SMED data
directly to the WebSocket Hub, bypassing the HTTP API completely.

This is part of Phase 1: WebSocket Hub Integration to eliminate the complex
4-stage data flow and provide a single WebSocket channel for all communications.
"""

import socketio
import json
import sys
import os
from datetime import datetime
import argparse
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

class WebSocketHubClient:
    """Client for sending SMED data directly to WebSocket Hub"""
    
    def __init__(self, server_url='http://localhost:8000'):
        self.server_url = server_url
        self.client = socketio.Client()
        self.connected = False
        
        # Setup event handlers
        self.client.on('connect', self._on_connect)
        self.client.on('disconnect', self._on_disconnect)
        self.client.on('smed_data_confirmation', self._on_confirmation)
        self.client.on('smed_error', self._on_error)
        self.client.on('client_registration_confirmed', self._on_registration_confirmed)
        self.client.on('client_registration_error', self._on_registration_error)
    
    def _on_connect(self):
        """Handle successful connection to WebSocket Hub"""
        self.connected = True
        logger.info(f"[HUB_CLIENT] Connected to WebSocket Hub: {self.server_url}")
    
    def _on_disconnect(self):
        """Handle disconnection from WebSocket Hub"""
        self.connected = False
        logger.info(f"[HUB_CLIENT] Disconnected from WebSocket Hub")
    
    def _on_confirmation(self, data):
        """Handle confirmation from WebSocket Hub"""
        logger.info(f"[HUB_CLIENT] Hub confirmation received: {data}")
        print(f"[HUB_CONFIRM] Success: {data.get('success')}")
        print(f"[HUB_CONFIRM] Terminal: {data.get('terminal_id')}")
        print(f"[HUB_CONFIRM] Map: {data.get('map_file')}")
        print(f"[HUB_CONFIRM] Fields: {data.get('fields_populated')}")
    
    def _on_error(self, data):
        """Handle error from WebSocket Hub"""
        logger.error(f"[HUB_CLIENT] Hub error received: {data}")
        print(f"[HUB_ERROR] {data.get('error')}")
    
    def _on_registration_confirmed(self, data):
        """Handle registration confirmation from WebSocket Hub"""
        logger.info(f"[HUB_CLIENT] Registration confirmed: {data}")
        print(f"[HUB_REGISTERED] Success: {data.get('success')}")
        print(f"[HUB_REGISTERED] Client ID: {data.get('client_id')}")
        print(f"[HUB_REGISTERED] Message: {data.get('message')}")
    
    def _on_registration_error(self, data):
        """Handle registration error from WebSocket Hub"""
        logger.error(f"[HUB_CLIENT] Registration error: {data}")
        print(f"[HUB_REG_ERROR] {data.get('error')}")
    
    def connect(self):
        """Connect to WebSocket Hub with immediate registration"""
        try:
            logger.info(f"[HUB_CLIENT] Connecting to WebSocket Hub: {self.server_url}")
            self.client.connect(self.server_url)
            
            # Wait for connection to stabilize and ensure registration
            import time
            max_retries = 10
            retry_count = 0
            
            while not self.connected and retry_count < max_retries:
                time.sleep(0.1)  # Brief wait for connection event
                retry_count += 1
            
            if self.connected:
                # Immediately register with hub after connection
                logger.info(f"[HUB_CLIENT] Connection established, registering with hub...")
                self._register_with_hub()
                return True
            else:
                logger.error(f"[HUB_CLIENT] Connection timeout after {max_retries} retries")
                return False
                
        except Exception as e:
            logger.error(f"[HUB_CLIENT] Failed to connect to hub: {e}")
            return False
    
    def _register_with_hub(self):
        """Register this client with the WebSocket Hub immediately after connection"""
        try:
            registration_data = {
                'client_type': 'hub_client',
                'client_id': f'hub_client_{id(self)}',
                'capabilities': ['smed_data_transmission'],
                'timestamp': datetime.now().isoformat()
            }
            
            # Send registration immediately
            self.client.emit('register_client', registration_data)
            logger.info(f"[HUB_CLIENT] Registration data sent to hub: {registration_data['client_id']}")
            
        except Exception as e:
            logger.error(f"[HUB_CLIENT] Failed to register with hub: {e}")
    
    def disconnect(self):
        """Disconnect from WebSocket Hub"""
        try:
            if self.connected:
                self.client.disconnect()
            logger.info(f"[HUB_CLIENT] Disconnected from WebSocket Hub")
        except Exception as e:
            logger.error(f"[HUB_CLIENT] Error during disconnect: {e}")
    
    def send_smed_data(self, terminal_id, map_file, fields, program_name='unknown', source_type='direct'):
        """Send SMED data directly to WebSocket Hub"""
        if not self.connected:
            logger.error("[HUB_CLIENT] Not connected to WebSocket Hub")
            return False
        
        hub_data = {
            'terminal_id': terminal_id,
            'map_file': map_file,
            'fields': fields,
            'program_name': program_name,
            'source_type': source_type,
            'timestamp': datetime.now().isoformat(),
            'client_version': '1.0'
        }
        
        try:
            logger.info(f"[HUB_CLIENT] Sending SMED data to hub:")
            logger.info(f"[HUB_CLIENT] - Terminal: {terminal_id}")
            logger.info(f"[HUB_CLIENT] - Map: {map_file}")
            logger.info(f"[HUB_CLIENT] - Fields: {len(fields)} fields")
            logger.info(f"[HUB_CLIENT] - Program: {program_name}")
            
            # Send data via WebSocket Hub
            self.client.emit('smed_data_direct', hub_data)
            
            logger.info(f"[HUB_CLIENT] SMED data sent to WebSocket Hub successfully")
            return True
            
        except Exception as e:
            logger.error(f"[HUB_CLIENT] Failed to send SMED data: {e}")
            return False
    
    def send_smed_json(self, json_data):
        """Send SMED data from JSON string or file"""
        try:
            if isinstance(json_data, str):
                if os.path.isfile(json_data):
                    # Read from file
                    with open(json_data, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                else:
                    # Parse as JSON string
                    data = json.loads(json_data)
            else:
                data = json_data
            
            # Extract required fields
            terminal_id = data.get('terminal_id', 'webui')
            map_file = data.get('map_file')
            fields = data.get('fields', {})
            program_name = data.get('program_name', 'json_client')
            source_type = data.get('source_type', 'json')
            
            if not map_file:
                logger.error("[HUB_CLIENT] map_file is required in JSON data")
                return False
            
            return self.send_smed_data(terminal_id, map_file, fields, program_name, source_type)
            
        except Exception as e:
            logger.error(f"[HUB_CLIENT] Failed to process JSON data: {e}")
            return False

def main():
    """Command-line interface for WebSocket Hub Client"""
    parser = argparse.ArgumentParser(description='WebSocket Hub Client for Direct SMED Data Transmission')
    parser.add_argument('--server', default='http://localhost:8000', help='WebSocket Hub server URL')
    parser.add_argument('--terminal', default='webui', help='Target terminal ID')
    parser.add_argument('--map', required=True, help='SMED map file name')
    parser.add_argument('--fields', default='{}', help='Field data as JSON string')
    parser.add_argument('--program', default='hub_client', help='Program name')
    parser.add_argument('--source', default='cli', help='Source type')
    parser.add_argument('--json-file', help='Send data from JSON file')
    parser.add_argument('--json-data', help='Send data from JSON string')
    parser.add_argument('--verbose', '-v', action='store_true', help='Verbose logging')
    
    args = parser.parse_args()
    
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    # Create hub client
    client = WebSocketHubClient(args.server)
    
    try:
        # Connect to hub
        if not client.connect():
            print("[ERROR] Failed to connect to WebSocket Hub")
            return 1
        
        success = False
        
        if args.json_file or args.json_data:
            # Send JSON data
            json_source = args.json_file or args.json_data
            success = client.send_smed_json(json_source)
        else:
            # Send individual parameters
            try:
                fields = json.loads(args.fields)
            except json.JSONDecodeError:
                print(f"[ERROR] Invalid JSON in fields: {args.fields}")
                return 1
            
            success = client.send_smed_data(
                args.terminal, args.map, fields, args.program, args.source
            )
        
        # Wait a moment for confirmation
        import time
        time.sleep(1)
        
        # Disconnect
        client.disconnect()
        
        if success:
            print("[SUCCESS] SMED data sent to WebSocket Hub")
            return 0
        else:
            print("[ERROR] Failed to send SMED data")
            return 1
            
    except KeyboardInterrupt:
        print("\n[INFO] Interrupted by user")
        client.disconnect()
        return 0
    except Exception as e:
        print(f"[ERROR] Unexpected error: {e}")
        client.disconnect()
        return 1

if __name__ == '__main__':
    sys.exit(main())