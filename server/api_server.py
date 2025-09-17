#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
OpenASP API Server v0.5.1
Enhanced with Multi-Type Program Support (JAVA, COBOL, SHELL)
Fixed configuration loading and error handling
"""

import os
import sys
import json
import subprocess
import threading
import time
import signal
import ctypes
import psutil
import shutil
import requests
import multiprocessing
from pathlib import Path
from datetime import datetime

# Import smart encoding manager
try:
    from encoding_manager import smart_read_file, DestinationType, ConversionContext, smart_encoding_manager
    SMART_ENCODING_AVAILABLE = True
except ImportError:
    SMART_ENCODING_AVAILABLE = False

# Import DBIO system for PostgreSQL catalog integration
sys.path.append('/home/aspuser/app/server/system-cmds')
try:
    from asp_commands import get_catalog_info, get_object_info, update_catalog_info
    from functions.dltlib import DLTLIB
    from functions.dltfile import DLTFILE
    DBIO_AVAILABLE = True
    print("[API_SERVER] DBIO system loaded successfully")
except ImportError as e:
    DBIO_AVAILABLE = False
    print(f"[API_SERVER] DBIO system not available, using JSON fallback: {e}")

# Import PostgreSQL session manager for enterprise features
try:
    from postgresql_session_manager import PostgreSQLSessionManager
    POSTGRESQL_SESSION_AVAILABLE = True
    print("[API_SERVER] PostgreSQL Session Manager loaded successfully")
except ImportError as e:
    POSTGRESQL_SESSION_AVAILABLE = False
    print(f"[API_SERVER] PostgreSQL Session Manager not available: {e}")

# Import enhanced error handler
try:
    from error_handler import handle_api_error, log_operation_success, ErrorCategory, ErrorSeverity
    ERROR_HANDLER_AVAILABLE = True
    print("[API_SERVER] Enhanced Error Handler loaded successfully")
except ImportError as e:
    ERROR_HANDLER_AVAILABLE = False
    print(f"[API_SERVER] Enhanced Error Handler not available: {e}")

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from flask_socketio import SocketIO, emit, join_room, leave_room
import logging
from collections import deque
import uuid
from io import StringIO

# ?? ??
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

# Import layout API module
try:
    from layout_api import register_layout_routes
    LAYOUT_API_AVAILABLE = True
except ImportError as e:
    logger.warning(f"Layout API module not available: {e}")
    LAYOUT_API_AVAILABLE = False

app = Flask(__name__)
CORS(app, origins=['http://localhost:3005', 'http://localhost:3000', 'http://localhost:3007', 'http://localhost:3006'])

# Initialize SocketIO for WebSocket support
socketio = SocketIO(app, cors_allowed_origins=['http://localhost:3005', 'http://localhost:3000', 'http://localhost:3007', 'http://localhost:3006'])

# Register layout API routes
if LAYOUT_API_AVAILABLE:
    register_layout_routes(app)

# Initialize PostgreSQL session manager for enterprise features
postgresql_session_manager = None
websocket_sessions = {}  # Track WebSocket sessions: {sid: {wsname, user}}

if POSTGRESQL_SESSION_AVAILABLE:
    try:
        postgresql_session_manager = PostgreSQLSessionManager()
        logger.info("PostgreSQL session manager initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize PostgreSQL session manager: {e}")
        postgresql_session_manager = None

# ?? ??
VOLUME_ROOT = "/home/aspuser/app/volume"
CONFIG_DIR = "/home/aspuser/app/server/config"
SMED_DIR = None
ACCOUNT_FILE = None
SMED_PGM_FILE = None
MAP_PGM_FILE = None

# Create config directory if it doesn't exist
os.makedirs(CONFIG_DIR, exist_ok=True)
accounts = {}
smed_pgm_config = {}
map_pgm_config = {}
java_manager = None

# Log storage (keep last 1000 logs)
execution_logs = deque(maxlen=1000)

# ENHANCED WORKSTATION SESSION MANAGEMENT SYSTEM
import threading
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any
import uuid
import json
import os

class WorkstationSessionManager:
    """Enhanced session manager for Workstation login/logout with position-based SMED integration"""
    
    def __init__(self):
        self.sessions: Dict[str, Dict[str, Any]] = {}  # session_id -> session_data
        self.workstation_sessions: Dict[str, str] = {}  # wsname -> session_id
        self.user_sessions: Dict[str, List[str]] = {}  # user_id -> [session_ids]
        self.lock = threading.RLock()
        self.session_file = os.path.join(CONFIG_DIR, 'workstation_sessions.json') if CONFIG_DIR else None
        self._load_sessions()
    
    def create_session(self, wsname: str, user_id: str, terminal_id: str = None, 
                      display_mode: str = 'legacy', encoding: str = 'sjis') -> str:
        """Create new workstation session"""
        with self.lock:
            session_id = f"ws_{wsname}_{uuid.uuid4().hex[:8]}"
            
            # Check if workstation already has active session
            if wsname in self.workstation_sessions:
                old_session_id = self.workstation_sessions[wsname]
                self._cleanup_session(old_session_id)
            
            # Create session data
            session_data = {
                'session_id': session_id,
                'wsname': wsname,
                'user_id': user_id,
                'terminal_id': terminal_id or wsname,
                'status': 'ON',
                'display_mode': display_mode,  # 'legacy' or 'position-based'
                'encoding': encoding,  # 'sjis' or 'utf-8'
                'login_time': datetime.now(timezone.utc).isoformat(),
                'last_activity': datetime.now(timezone.utc).isoformat(),
                'smed_subscriptions': [],
                'websocket_rooms': [],
                'properties': {}
            }
            
            # Store session
            self.sessions[session_id] = session_data
            self.workstation_sessions[wsname] = session_id
            
            # Track user sessions
            if user_id not in self.user_sessions:
                self.user_sessions[user_id] = []
            self.user_sessions[user_id].append(session_id)
            
            # Maintain backward compatibility
            active_terminals[session_id] = {
                'terminal_id': terminal_id or wsname,
                'user': user_id,
                'room': f'terminal_{terminal_id or wsname}',
                'workstation': wsname,
                'session_data': session_data
            }
            terminal_to_session[terminal_id or wsname] = session_id
            
            self._save_sessions()
            logger.info(f"Created workstation session: {session_id} for {wsname} (user: {user_id})")
            return session_id
    
    def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get session by ID"""
        with self.lock:
            return self.sessions.get(session_id, {}).copy() if session_id in self.sessions else None
    
    def get_session_by_workstation(self, wsname: str) -> Optional[Dict[str, Any]]:
        """Get session by workstation name"""
        with self.lock:
            session_id = self.workstation_sessions.get(wsname)
            return self.get_session(session_id) if session_id else None
    
    def get_sessions_by_user(self, user_id: str) -> List[Dict[str, Any]]:
        """Get all sessions for a user"""
        with self.lock:
            user_session_ids = self.user_sessions.get(user_id, [])
            return [self.sessions[sid] for sid in user_session_ids if sid in self.sessions]
    
    def list_all_sessions(self) -> List[Dict[str, Any]]:
        """List all active sessions"""
        with self.lock:
            return [session.copy() for session in self.sessions.values()]
    
    def update_session(self, session_id: str, updates: Dict[str, Any]) -> bool:
        """Update session data"""
        with self.lock:
            if session_id not in self.sessions:
                return False
            
            # Update last activity
            updates['last_activity'] = datetime.now(timezone.utc).isoformat()
            
            # Merge updates
            self.sessions[session_id].update(updates)
            
            # Update backward compatibility data
            if session_id in active_terminals:
                if 'user_id' in updates:
                    active_terminals[session_id]['user'] = updates['user_id']
                active_terminals[session_id]['session_data'] = self.sessions[session_id]
            
            self._save_sessions()
            return True
    
    def set_display_mode(self, wsname: str, display_mode: str) -> bool:
        """Set display mode for workstation session"""
        session = self.get_session_by_workstation(wsname)
        if not session:
            return False
        
        return self.update_session(session['session_id'], {'display_mode': display_mode})
    
    def set_encoding(self, wsname: str, encoding: str) -> bool:
        """Set encoding for workstation session"""
        session = self.get_session_by_workstation(wsname)
        if not session:
            return False
        
        return self.update_session(session['session_id'], {'encoding': encoding})
    
    def add_smed_subscription(self, session_id: str, map_name: str) -> bool:
        """Add SMED subscription to session"""
        with self.lock:
            if session_id not in self.sessions:
                return False
            
            subs = self.sessions[session_id].get('smed_subscriptions', [])
            if map_name not in subs:
                subs.append(map_name)
                self.update_session(session_id, {'smed_subscriptions': subs})
            return True
    
    def remove_smed_subscription(self, session_id: str, map_name: str) -> bool:
        """Remove SMED subscription from session"""
        with self.lock:
            if session_id not in self.sessions:
                return False
            
            subs = self.sessions[session_id].get('smed_subscriptions', [])
            if map_name in subs:
                subs.remove(map_name)
                self.update_session(session_id, {'smed_subscriptions': subs})
            return True
    
    def logout_session(self, session_id: str = None, wsname: str = None) -> bool:
        """Logout session by ID or workstation name"""
        with self.lock:
            if not session_id and wsname:
                session_id = self.workstation_sessions.get(wsname)
            
            if not session_id or session_id not in self.sessions:
                return False
            
            session = self.sessions[session_id]
            wsname = session.get('wsname')
            user_id = session.get('user_id')
            
            # Update status
            self.update_session(session_id, {'status': 'OFF'})
            
            # Cleanup
            self._cleanup_session(session_id)
            
            logger.info(f"Logged out workstation session: {session_id} for {wsname} (user: {user_id})")
            return True
    
    def _cleanup_session(self, session_id: str):
        """Internal cleanup for session"""
        if session_id in self.sessions:
            session = self.sessions[session_id]
            wsname = session.get('wsname')
            user_id = session.get('user_id')
            terminal_id = session.get('terminal_id')
            
            # Remove from workstation mapping
            if wsname and wsname in self.workstation_sessions:
                del self.workstation_sessions[wsname]
            
            # Remove from user sessions
            if user_id and user_id in self.user_sessions:
                if session_id in self.user_sessions[user_id]:
                    self.user_sessions[user_id].remove(session_id)
                if not self.user_sessions[user_id]:
                    del self.user_sessions[user_id]
            
            # Cleanup backward compatibility
            if session_id in active_terminals:
                del active_terminals[session_id]
            if terminal_id and terminal_id in terminal_to_session:
                del terminal_to_session[terminal_id]
            
            # Remove session
            del self.sessions[session_id]
            
            self._save_sessions()
    
    def _save_sessions(self):
        """Save sessions to file"""
        if not self.session_file:
            return
        
        try:
            with open(self.session_file, 'w', encoding='utf-8') as f:
                json.dump({
                    'sessions': self.sessions,
                    'workstation_sessions': self.workstation_sessions,
                    'user_sessions': self.user_sessions
                }, f, indent=2, ensure_ascii=False)
        except Exception as e:
            logger.warning(f"Failed to save sessions: {e}")
    
    def _load_sessions(self):
        """Load sessions from file"""
        if not self.session_file or not os.path.exists(self.session_file):
            return
        
        try:
            with open(self.session_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                self.sessions = data.get('sessions', {})
                self.workstation_sessions = data.get('workstation_sessions', {})
                self.user_sessions = data.get('user_sessions', {})
                
                # Restore backward compatibility data
                for session_id, session in self.sessions.items():
                    if session.get('status') == 'ON':
                        active_terminals[session_id] = {
                            'terminal_id': session.get('terminal_id'),
                            'user': session.get('user_id'),
                            'room': f"terminal_{session.get('terminal_id')}",
                            'workstation': session.get('wsname'),
                            'session_data': session
                        }
                        terminal_to_session[session.get('terminal_id')] = session_id
                
                logger.info(f"Loaded {len(self.sessions)} sessions from storage")
        except Exception as e:
            logger.warning(f"Failed to load sessions: {e}")

    def bulk_logout_sessions(self, workstation_names: List[str]) -> Dict[str, Any]:
        """Bulk logout sessions by workstation names"""
        results = {
            'success': [],
            'failed': [],
            'total_processed': len(workstation_names)
        }
        
        with self.lock:
            for wsname in workstation_names:
                try:
                    # Check if session exists
                    if wsname not in self.workstation_sessions:
                        results['failed'].append({
                            'wsname': wsname,
                            'error': 'Session not found'
                        })
                        continue
                    
                    session_id = self.workstation_sessions[wsname]
                    session = self.sessions.get(session_id)
                    
                    if not session:
                        results['failed'].append({
                            'wsname': wsname,
                            'error': 'Session data not found'
                        })
                        continue
                    
                    if session.get('status') == 'OFF':
                        results['failed'].append({
                            'wsname': wsname,
                            'error': 'Session already inactive'
                        })
                        continue
                    
                    # Logout the session
                    success = self.logout_session(wsname=wsname)
                    if success:
                        results['success'].append(wsname)
                        logger.info(f"Bulk logout successful for workstation: {wsname}")
                    else:
                        results['failed'].append({
                            'wsname': wsname,
                            'error': 'Logout operation failed'
                        })
                        
                except Exception as e:
                    logger.error(f"Failed to logout session {wsname}: {e}")
                    results['failed'].append({
                        'wsname': wsname,
                        'error': str(e)
                    })
            
            # Save changes
            self._save_sessions()
            logger.info(f"Bulk logout completed: {len(results['success'])} successful, {len(results['failed'])} failed")
            
        return results

    def get_sessions_by_workstation_names(self, workstation_names: List[str]) -> List[Dict[str, Any]]:
        """Get sessions for multiple workstation names"""
        sessions = []
        with self.lock:
            for wsname in workstation_names:
                if wsname in self.workstation_sessions:
                    session_id = self.workstation_sessions[wsname]
                    session = self.sessions.get(session_id)
                    if session:
                        sessions.append(dict(session))
        return sessions

# Initialize session manager
workstation_session_manager = WorkstationSessionManager()

# Legacy Terminal/Session Management (for backward compatibility)
active_terminals = {}  # {session_id: {'terminal_id': str, 'user': str, 'room': str}}
terminal_to_session = {}  # {terminal_id: session_id}

def convert_sjis_to_unicode(raw_bytes, destination='web_ui'):
    """
    Smart SJIS to Unicode conversion based on destination
    Only converts when necessary to reduce performance overhead
    """
    if SMART_ENCODING_AVAILABLE:
        # Use smart encoding manager for destination-aware conversion
        dest_map = {
            'web_ui': DestinationType.WEB_UI,
            'api': DestinationType.API_RESPONSE,
            'server': DestinationType.SERVER_INTERNAL,
            'terminal': DestinationType.TERMINAL
        }
        
        dest_type = dest_map.get(destination, DestinationType.WEB_UI)
        context = ConversionContext(dest_type, source_encoding='shift_jis')
        
        content = smart_encoding_manager.smart_decode(raw_bytes, context)
        
        # Log smart conversion decision
        stats = smart_encoding_manager.get_stats()
        logger.debug(f"Smart encoding stats - Performed: {stats['conversions_performed']}, "
                    f"Skipped: {stats['conversions_skipped']}")
        
        return content
    else:
        # Fallback to legacy conversion
        try:
            logger.info(f"SJIS Conversion DEBUG: Using legacy SJIS decoding")
            content = raw_bytes.decode('shift_jis', errors='replace')
            
            logger.info(f"SJIS Conversion DEBUG: Simple conversion result length: {len(content)}")
            
            # Log sample for debugging
            openasp_pos = content.find('OpenASP')
            if openasp_pos >= 0:
                sample_text = content[openasp_pos:openasp_pos+20]
                logger.info(f"SJIS Conversion DEBUG: Sample text: {repr(sample_text)}")
                jp_chars = sample_text[8:18] if len(sample_text) > 8 else sample_text[8:]
                logger.info(f"SJIS Conversion DEBUG: Japanese chars Unicode: {[ord(c) for c in jp_chars]}")
            
            return content
            
        except Exception as e:
            logger.warning(f"Simple SJIS conversion failed: {e}")
            # Final fallback
            try:
                return raw_bytes.decode('utf-8', errors='replace')
            except Exception as e2:
                logger.error(f"All conversion methods failed: {e2}")
                return str(raw_bytes)  # Return raw bytes as string if all else fails

# POSITION-BASED SMED ENCODING INTEGRATION
class PositionSmedEncodingConverter:
    """Position-based SMED encoding converter for WebSocket integration"""
    
    def __init__(self, encoding_api_url="http://localhost:8081"):
        self.encoding_api_url = encoding_api_url
        self.encoding_api_available = self._check_encoding_api()
    
    def _check_encoding_api(self):
        """Check if encoding API is available"""
        try:
            response = requests.get(f"{self.encoding_api_url}/health", timeout=2)
            return response.status_code == 200
        except Exception as e:
            logger.warning(f"Encoding API not available: {e}")
            return False
    
    def convert_sjis_to_utf8(self, sjis_data, use_api=True):
        """Convert SJIS data to UTF-8 for position-based SMED display"""
        if not sjis_data:
            return sjis_data
        
        if use_api and self.encoding_api_available:
            return self._convert_via_api(sjis_data, 'sjis', 'utf-8')
        else:
            return self._convert_local_sjis_to_utf8(sjis_data)
    
    def convert_utf8_to_sjis(self, utf8_data, use_api=True):
        """Convert UTF-8 data to SJIS for position-based SMED processing"""
        if not utf8_data:
            return utf8_data
        
        if use_api and self.encoding_api_available:
            return self._convert_via_api(utf8_data, 'utf-8', 'sjis')
        else:
            return self._convert_local_utf8_to_sjis(utf8_data)
    
    def _convert_via_api(self, data, from_encoding, to_encoding):
        """Convert data using external encoding API"""
        try:
            payload = {
                'text': data,
                'sourceEncoding': from_encoding,
                'targetEncoding': to_encoding
            }
            
            response = requests.post(
                f"{self.encoding_api_url}/api/encoding/convert",
                json=payload,
                timeout=5
            )
            
            if response.status_code == 200:
                result = response.json()
                if result.get('success'):
                    return result.get('convertedText', data)
                else:
                    logger.error(f"Encoding API error: {result.get('error')}")
                    return data
            else:
                logger.error(f"Encoding API HTTP error: {response.status_code}")
                return data
                
        except Exception as e:
            logger.error(f"Failed to convert via encoding API: {e}")
            return data
    
    def _convert_local_sjis_to_utf8(self, sjis_data):
        """Local SJIS to UTF-8 conversion fallback"""
        try:
            if isinstance(sjis_data, str):
                # String to bytes
                sjis_bytes = sjis_data.encode('sjis')
                return sjis_bytes.decode('sjis')
            elif isinstance(sjis_data, bytes):
                # Bytes to string
                return sjis_data.decode('sjis', errors='replace')
            else:
                return str(sjis_data)
        except Exception as e:
            logger.error(f"Local SJIS to UTF-8 conversion failed: {e}")
            return str(sjis_data)
    
    def _convert_local_utf8_to_sjis(self, utf8_data):
        """Local UTF-8 to SJIS conversion fallback"""
        try:
            if isinstance(utf8_data, str):
                # String to SJIS bytes, then back to string representation
                sjis_bytes = utf8_data.encode('sjis', errors='replace')
                return sjis_bytes.decode('sjis', errors='replace')
            elif isinstance(utf8_data, bytes):
                # Decode bytes as UTF-8 then convert to SJIS
                utf8_str = utf8_data.decode('utf-8', errors='replace')
                sjis_bytes = utf8_str.encode('sjis', errors='replace')
                return sjis_bytes.decode('sjis', errors='replace')
            else:
                return str(utf8_data)
        except Exception as e:
            logger.error(f"Local UTF-8 to SJIS conversion failed: {e}")
            return str(utf8_data)
    
    def convert_field_data_array(self, field_data, from_encoding='sjis', to_encoding='utf-8'):
        """Convert array of field data between encodings"""
        if not field_data or not isinstance(field_data, list):
            return field_data
        
        converted_data = []
        for field in field_data:
            if isinstance(field, str):
                if from_encoding.lower() == 'sjis' and to_encoding.lower() == 'utf-8':
                    converted_field = self.convert_sjis_to_utf8(field)
                elif from_encoding.lower() == 'utf-8' and to_encoding.lower() == 'sjis':
                    converted_field = self.convert_utf8_to_sjis(field)
                else:
                    converted_field = field
                converted_data.append(converted_field)
            else:
                converted_data.append(field)
        
        return converted_data
    
    def convert_position_updates(self, updates, from_encoding='sjis', to_encoding='utf-8'):
        """Convert position update values between encodings"""
        if not updates or not isinstance(updates, list):
            return updates
        
        converted_updates = []
        for update in updates:
            if isinstance(update, dict) and 'value' in update:
                converted_update = update.copy()
                if isinstance(update['value'], str):
                    if from_encoding.lower() == 'sjis' and to_encoding.lower() == 'utf-8':
                        converted_update['value'] = self.convert_sjis_to_utf8(update['value'])
                    elif from_encoding.lower() == 'utf-8' and to_encoding.lower() == 'sjis':
                        converted_update['value'] = self.convert_utf8_to_sjis(update['value'])
                converted_updates.append(converted_update)
            else:
                converted_updates.append(update)
        
        return converted_updates

# Initialize position-based SMED encoding converter
position_smed_encoder = PositionSmedEncodingConverter()

class MultiTypeExecutor:
    """?? ???? ?? ???"""
    
    def __init__(self, jar_path=None):
        self.jar_path = jar_path
        self.java_available = self._check_java_availability()
        self.cobol_libs = {}  # ??? COBOL ????? ??
        
    def _check_java_availability(self):
        """Java ?? ?? ?? ??"""
        try:
            result = subprocess.run(['java', '-version'], 
                                  capture_output=True, text=True, timeout=5)
            return result.returncode == 0
        except Exception:
            return False
    
    def execute_java_program(self, program_class, input_data):
        """Java ???? ??"""
        if not self.java_available:
            raise Exception("Java is not available")
        
        if not self.jar_path or not os.path.exists(self.jar_path):
            raise Exception(f"JAR file not found: {self.jar_path}")
        
        try:
            # Java ???? ??
            cmd = ['java', '-jar', self.jar_path, program_class]
            
            logger.info(f"Executing Java command: {' '.join(cmd)}")
            
            process = subprocess.Popen(
                cmd,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )
            
            # ?? ??? ??
            input_json = json.dumps(input_data) if input_data else "{}"
            logger.info(f"Sending input to Java program: {input_json}")
            
            try:
                stdout, stderr = process.communicate(input=input_json, timeout=30)
            except subprocess.TimeoutExpired:
                process.kill()
                stdout, stderr = process.communicate()
                raise Exception("Java program execution timeout")
            
            logger.info(f"Java program stdout: {stdout[:200]}...")
            if stderr:
                logger.warning(f"Java program stderr: {stderr[:200]}...")
            
            if process.returncode != 0:
                raise Exception(f"Java program failed with exit code {process.returncode}: {stderr}")
            
            # JSON ?? ?? ??
            try:
                result = json.loads(stdout.strip())
                logger.info(f"Successfully parsed JSON result from Java program")
                return result
            except json.JSONDecodeError as e:
                logger.warning(f"Failed to parse JSON from Java output: {e}")
                # JSON? ?? ?? ???? ??
                return {"output": stdout.strip(), "type": "text"}
                
        except Exception as e:
            logger.error(f"Java execution error: {str(e)}")
            raise Exception(f"Java execution error: {str(e)}")
    
    def execute_cobol_program(self, lib_path, input_data):
        """COBOL ???? ?? (dlcall)"""
        if not os.path.exists(lib_path):
            raise Exception(f"COBOL library not found: {lib_path}")
        
        try:
            # COBOL ????? ?? (?? ??)
            if lib_path not in self.cobol_libs:
                self.cobol_libs[lib_path] = ctypes.CDLL(lib_path)
            
            cobol_lib = self.cobol_libs[lib_path]
            
            # COBOL ????? ?? ??? ??? ?? ??
            # ???? COBOL ????? main ?? ?????? ??? ??? ??
            program_name = os.path.splitext(os.path.basename(lib_path))[0]
            
            # ???? COBOL ??? ????? ??
            entry_points = ['main', program_name.lower(), program_name.upper()]
            
            for entry_point in entry_points:
                try:
                    func = getattr(cobol_lib, entry_point)
                    
                    # ?? ???? JSON ???? ??
                    input_json = json.dumps(input_data) if input_data else "{}"
                    input_bytes = input_json.encode('utf-8')
                    
                    # COBOL ?? ?? (????? ??? ???? ??)
                    func.argtypes = [ctypes.c_char_p]
                    func.restype = ctypes.c_char_p
                    
                    result = func(input_bytes)
                    
                    if result:
                        result_str = result.decode('utf-8')
                        try:
                            return json.loads(result_str)
                        except json.JSONDecodeError:
                            return {"output": result_str, "type": "text"}
                    else:
                        return {"output": "COBOL program executed successfully", "type": "text"}
                        
                except AttributeError:
                    continue  # ?? ??? ??? ??
            
            raise Exception(f"No valid entry point found in COBOL library: {lib_path}")
            
        except Exception as e:
            raise Exception(f"COBOL execution error: {str(e)}")
    
    def execute_shell_script(self, script_path, input_data):
        """Shell ???? ??"""
        if not os.path.exists(script_path):
            raise Exception(f"Shell script not found: {script_path}")
        
        if not os.access(script_path, os.X_OK):
            raise Exception(f"Shell script is not executable: {script_path}")
        
        try:
            # ????? ?? ??? ??
            env = os.environ.copy()
            if input_data:
                for key, value in input_data.items():
                    env[f"SMED_{key.upper()}"] = str(value)
                env['SMED_INPUT_JSON'] = json.dumps(input_data)
            
            # Shell ???? ??
            process = subprocess.Popen(
                [script_path],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                env=env,
                timeout=30
            )
            
            stdout, stderr = process.communicate()
            
            if process.returncode != 0:
                raise Exception(f"Shell script failed (exit code {process.returncode}): {stderr}")
            
            # JSON ?? ?? ??
            try:
                return json.loads(stdout.strip())
            except json.JSONDecodeError:
                return {"output": stdout.strip(), "type": "text"}
                
        except subprocess.TimeoutExpired:
            process.kill()
            raise Exception("Shell script execution timeout")
        except Exception as e:
            raise Exception(f"Shell execution error: {str(e)}")
    
    def execute_program(self, program_type, program_path, input_data):
        """???? ??? ?? ??"""
        program_type = program_type.upper()
        
        logger.info(f"Executing {program_type} program: {program_path}")
        
        if program_type == "JAVA":
            return self.execute_java_program(program_path, input_data)
        elif program_type == "COBOL":
            return self.execute_cobol_program(program_path, input_data)
        elif program_type == "SHELL":
            return self.execute_shell_script(program_path, input_data)
        else:
            raise Exception(f"Unsupported program type: {program_type}")

# ?? ??? ????
multi_executor = None

def load_config():
    """Load configuration settings"""
    global SMED_DIR, ACCOUNT_FILE, SMED_PGM_FILE, MAP_PGM_FILE
    global accounts, smed_pgm_config, map_pgm_config, multi_executor
    
    # Get base directories
    script_dir = os.path.dirname(os.path.abspath(__file__))
    app_dir = os.path.dirname(script_dir)
    
    # Fix SMED_DIR to use volume/DISK01/SMED structure
    SMED_DIR = os.path.join(app_dir, 'volume', 'DISK01', 'SMED')
    
    # Keep other paths as is for compatibility
    ACCOUNT_FILE = os.path.join(app_dir, 'src', 'account.json')
    SMED_PGM_FILE = os.path.join(app_dir, 'src', 'smed_pgm.json')
    MAP_PGM_FILE = os.path.join(app_dir, 'src', 'map_pgm.json')
    
    # JAR ?? ??
    jar_path = os.path.join(script_dir, 'java_jars', 'ofasp.jar')
    
    # Multi-Type Executor ???
    multi_executor = MultiTypeExecutor(jar_path)
    
    logger.info(f"SMED directory: {SMED_DIR}")
    logger.info(f"Account file: {ACCOUNT_FILE}")
    logger.info(f"SMED-PGM file: {SMED_PGM_FILE}")
    logger.info(f"MAP-PGM file: {MAP_PGM_FILE}")
    logger.info(f"JAR file: {jar_path}")
    
    # ?? ?? ??
    try:
        if os.path.exists(ACCOUNT_FILE):
            with open(ACCOUNT_FILE, 'r', encoding='utf-8') as f:
                accounts = json.load(f)
            logger.info(f"Loaded {len(accounts)} user accounts")
        else:
            logger.warning(f"Account file not found: {ACCOUNT_FILE}")
            accounts = {}
    except Exception as e:
        logger.error(f"Failed to load accounts: {e}")
        accounts = {}
    
    # SMED-PGM ?? ?? (??? ??)
    try:
        if os.path.exists(SMED_PGM_FILE):
            with open(SMED_PGM_FILE, 'r', encoding='utf-8') as f:
                raw_config = json.load(f)
            
            # プログラム設定が programs キーの下に ある場合の 処理
            if 'programs' in raw_config and isinstance(raw_config['programs'], dict):
                smed_pgm_config = {}
                for key, value in raw_config['programs'].items():
                    if isinstance(value, dict) and 'TYPE' in value and 'PGM' in value:
                        smed_pgm_config[key] = value
                    else:
                        logger.warning(f"Invalid SMED-PGM config for {key}: missing TYPE or PGM")
            else:
                # 旧形式：メタデータキー 以外の 全ての キーを プログラム設定として 扱う
                metadata_keys = ['description', 'version', 'updated', 'last_updated', 'type_settings', 'package_structure']
                smed_pgm_config = {}
                
                for key, value in raw_config.items():
                    if key not in metadata_keys:
                        if isinstance(value, dict) and 'TYPE' in value and 'PGM' in value:
                            smed_pgm_config[key] = value
                        else:
                            logger.warning(f"Invalid SMED-PGM config for {key}: missing TYPE or PGM")
            
            logger.info(f"Loaded SMED-PGM config: {len(smed_pgm_config)} valid maps")
            
            # ?? ?? ?? ??
            for map_name, config in smed_pgm_config.items():
                logger.info(f"  {map_name}: {config['TYPE']} -> {config['PGM']}")
                
        else:
            logger.warning(f"SMED-PGM file not found: {SMED_PGM_FILE}")
            smed_pgm_config = {}
    except Exception as e:
        logger.error(f"Failed to load SMED-PGM config: {e}")
        smed_pgm_config = {}
    
    # MAP-PGM ?? ?? (?? ???)
    try:
        if os.path.exists(MAP_PGM_FILE):
            with open(MAP_PGM_FILE, 'r', encoding='utf-8') as f:
                map_pgm_config = json.load(f)
            logger.info(f"Loaded MAP-PGM config (legacy): {len(map_pgm_config.get('maps', {}))} maps")
        else:
            map_pgm_config = {}
    except Exception as e:
        logger.error(f"Failed to load MAP-PGM config: {e}")
        map_pgm_config = {}

def get_smed_file_path(map_name):
    """SMED ?? ?? ?? (???? ?? ??)"""
    if not SMED_DIR:
        return None
    
    # ?? ???? ??
    file_path = os.path.join(SMED_DIR, map_name)
    if os.path.exists(file_path):
        return file_path
    
    # ???? ???? ??
    upper_path = os.path.join(SMED_DIR, map_name.upper())
    if os.path.exists(upper_path):
        return upper_path
    
    # ???? ???? ??
    lower_path = os.path.join(SMED_DIR, map_name.lower())
    if os.path.exists(lower_path):
        return lower_path
    
    return None

def fix_corrupted_japanese_text(content):
    """Fix common corrupted Japanese text patterns in SMED files"""
    # Common corrupted patterns and their fixes
    fixes = {
        '���[�UID:': 'ユーザーUID:',
        '�p�X���[�h:': 'パスワード:',
        '���[��': 'ユーザー',
        '�p�X���[�h': 'パスワード'
    }
    
    for corrupted, fixed in fixes.items():
        content = content.replace(corrupted, fixed)
    
    return content

# DBIO Catalog Helper Functions
def get_catalog_data_with_fallback():
    """Get catalog data using DBIO with JSON fallback"""
    if DBIO_AVAILABLE:
        try:
            catalog = get_catalog_info()
            if catalog:
                logger.info("[API_SERVER] Catalog retrieved via DBIO")
                return catalog
            else:
                logger.warning("[API_SERVER] DBIO returned empty catalog, falling back to JSON")
        except Exception as e:
            logger.warning(f"[API_SERVER] DBIO failed, falling back to JSON: {e}")
    
    # JSON fallback
    catalog_path = os.path.join(os.path.dirname(__file__), '..', 'config', 'catalog.json')
    
    if not os.path.exists(catalog_path):
        raise FileNotFoundError('Catalog file not found')
    
    with open(catalog_path, 'r', encoding='utf-8') as f:
        catalog = json.load(f)
    
    logger.info("[API_SERVER] Catalog retrieved via JSON fallback")
    return catalog

# WebSocket Event Handlers
@socketio.event
def connect(sid, environ):
    """Handle client connection"""
    print(f"[DEBUG] Client connected: {sid}")
    logger.info(f"[WEBSOCKET] Client connected: {sid}")

# Removed catch_all function due to SocketIO compatibility issues

@socketio.on('connect')  
def handle_connect():
    """Handle client connection"""
    client_info = {
        'session_id': request.sid,
        'origin': request.headers.get('Origin', 'unknown'),
        'user_agent': request.headers.get('User-Agent', 'unknown'),
        'remote_addr': request.environ.get('REMOTE_ADDR', 'unknown'),
        'timestamp': datetime.now().isoformat()
    }
    
    logger.info(f"[WEBSOCKET] Client connected: {request.sid}")
    logger.info(f"[WEBSOCKET] Connection details: {client_info}")
    
    # PostgreSQL session will be created when client registers with specific WSNAME
    # Store connection info for now
    websocket_sessions[request.sid] = {'wsname': None, 'user': None, 'registered': False}
    
    # Send connection confirmation with debug info
    emit('connected', {
        'session_id': request.sid,
        'server_type': 'socketio',
        'message': 'WebSocket connection established',
        'wsname': websocket_sessions.get(request.sid, {}).get('wsname', 'unknown'),
        'timestamp': datetime.now().isoformat()
    })
    
    add_log('INFO', 'WEBSOCKET', 'Client connected', client_info)

@socketio.on('disconnect')
def handle_disconnect():
    """Handle client disconnection"""
    disconnect_info = {
        'session_id': request.sid,
        'timestamp': datetime.now().isoformat()
    }
    
    logger.info(f"[WEBSOCKET] Client disconnected: {request.sid}")
    
    # Clean up sessions if they exist
    if request.sid in websocket_sessions:
        try:
            session_info = websocket_sessions[request.sid]
            wsname = session_info['wsname']
            
            # Update workstation_session_manager (used by API v1)
            try:
                existing_ws_session = workstation_session_manager.get_session_by_workstation(wsname)
                if existing_ws_session:
                    ws_session_id = existing_ws_session['session_id']
                    workstation_session_manager.update_session(ws_session_id, {'status': 'OFF'})
                    logger.info(f"[WEBSOCKET] Workstation session {wsname} set to inactive")
            except Exception as e:
                logger.error(f"[WEBSOCKET] Error updating workstation session on disconnect: {e}")
            
            # Update PostgreSQL session if manager is available
            if postgresql_session_manager:
                success = postgresql_session_manager.update_session_by_wsname(wsname, {'status': '0'})  # Set to inactive
                if success:
                    logger.info(f"[WEBSOCKET] PostgreSQL session {wsname} set to inactive")
                else:
                    logger.warning(f"[WEBSOCKET] Failed to update PostgreSQL session {wsname}")
            
            # Remove from tracking dictionary
            del websocket_sessions[request.sid]
        except Exception as e:
            logger.error(f"[WEBSOCKET] Error updating sessions on disconnect: {e}")
    
    # Clean up interactive EDTFILE sessions
    try:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        sys.path.append(os.path.join(script_dir, 'system-cmds', 'functions'))
        from edtfile_interactive import end_interactive_session
        # Try to end session with request.sid as session_id
        end_interactive_session(request.sid)
    except Exception as e:
        logger.error(f"Error cleaning up interactive session: {e}")
    
    # Clean up terminal registration
    if request.sid in active_terminals:
        terminal_info = active_terminals[request.sid]
        terminal_id = terminal_info.get('terminal_id')
        
        logger.info(f"[WEBSOCKET] Cleaning up terminal registration: {terminal_id}")
        disconnect_info['terminal_id'] = terminal_id
        disconnect_info['terminal_info'] = terminal_info
        
        if terminal_id and terminal_id in terminal_to_session:
            del terminal_to_session[terminal_id]
            logger.info(f"[WEBSOCKET] Removed terminal mapping: {terminal_id}")
        
        del active_terminals[request.sid]
        
        # Notify others in the room
        if 'room' in terminal_info:
            leave_room(terminal_info['room'])
            emit('terminal_disconnected', {
                'session_id': request.sid,
                'terminal_id': terminal_id
            }, room=terminal_info['room'])
    
    # Clean up position-based SMED session
    if request.sid in position_smed_sessions:
        session_info = position_smed_sessions.get(request.sid)
        logger.info(f"[WEBSOCKET] Cleaning up position SMED session: {session_info}")
        
        # Leave all subscribed rooms
        if session_info and session_info.get('subscriptions'):
            for map_name in session_info['subscriptions']:
                room_name = f'position_smed_{map_name}'
                leave_room(room_name)
                logger.info(f"[WEBSOCKET] Left position SMED room: {room_name}")
        
        # Unregister the session
        unregister_position_smed_session(request.sid)
        disconnect_info['position_smed_session'] = session_info
    
    add_log('INFO', 'WEBSOCKET', 'Client disconnected', disconnect_info)

@socketio.on('register_terminal')
def handle_register_terminal(data):
    """Register a terminal with ID and type"""
    session_id = request.sid
    
    # Extract registration data with validation
    if not data or not isinstance(data, dict):
        logger.error(f"[TERMINAL_REG] Invalid registration data from {session_id}: {data}")
        emit('registration_error', {
            'error': 'Invalid registration data format',
            'session_id': session_id
        })
        return
    
    terminal_id = data.get('terminal_id', data.get('username', 'webui'))  # Fallback for compatibility
    user = data.get('user', data.get('username', 'unknown'))
    workstation = data.get('workstation', terminal_id)
    
    registration_info = {
        'session_id': session_id,
        'terminal_id': terminal_id,
        'user': user,
        'workstation': workstation,
        'timestamp': datetime.now().isoformat(),
        'data_received': data
    }
    
    logger.info(f"[TERMINAL_REG] Registering terminal: {terminal_id} for session: {session_id}")
    logger.info(f"[TERMINAL_REG] Registration details: {registration_info}")
    
    # Check if terminal_id is already registered
    if terminal_id in terminal_to_session and terminal_to_session[terminal_id] != session_id:
        existing_session = terminal_to_session[terminal_id]
        logger.warning(f"[TERMINAL_REG] Terminal ID {terminal_id} already registered to session {existing_session}")
        
        # Clean up old registration
        if existing_session in active_terminals:
            del active_terminals[existing_session]
        
        logger.info(f"[TERMINAL_REG] Overriding existing registration for terminal: {terminal_id}")
    
    # Store terminal registration
    active_terminals[session_id] = {
        'terminal_id': terminal_id,
        'user': user,
        'workstation': workstation,
        'room': f'terminal_{terminal_id}',
        'connected_at': datetime.now().isoformat(),
        'registration_data': data
    }
    
    # Map terminal ID to session for routing
    terminal_to_session[terminal_id] = session_id
    
    # Join terminal-specific room
    join_room(f'terminal_{terminal_id}')
    
    # Create or reactivate PostgreSQL session if manager is available
    wsname = data.get('wsname', workstation)  # Use wsname from client data
    logger.info(f"[TERMINAL_REG] Checking session for wsname: {wsname}")
    logger.info(f"[TERMINAL_REG] PostgreSQL manager available: {postgresql_session_manager is not None}")
    
    if postgresql_session_manager and wsname:
        try:
            # Check if session already exists and is active
            logger.info(f"[TERMINAL_REG] Looking up existing session for {wsname}")
            existing_session = postgresql_session_manager.get_session_by_workstation(wsname)
            logger.info(f"[TERMINAL_REG] Found existing session: {existing_session}")
            
            if existing_session:
                status = existing_session.get('status', '0')
                is_active = status == '1' or status == 'ON'
                logger.info(f"[TERMINAL_REG] Session status: {status}, is_active: {is_active}")
                
                if is_active:
                    logger.warning(f"[TERMINAL_REG] Session {wsname} is already active - rejecting registration")
                    
                    # Format last_activity for JSON serialization
                    last_activity = existing_session.get('last_activity')
                    if hasattr(last_activity, 'isoformat'):
                        last_activity_str = last_activity.isoformat()
                    else:
                        last_activity_str = str(last_activity) if last_activity else 'unknown'
                    
                    emit('registration_error', {
                        'error': f'Workstation {wsname} is already active (User: {existing_session.get("username", "unknown")}, Last activity: {last_activity_str})',
                        'session_id': session_id,
                        'existing_session': {
                            'wsname': wsname,
                            'username': existing_session.get('username'),
                            'last_activity': last_activity_str
                        }
                    })
                    return
                else:
                    # Reactivate existing session
                    success = postgresql_session_manager.update_session_status(wsname, '1')
                    logger.info(f"[TERMINAL_REG] Reactivated PostgreSQL session: {wsname}")
            else:
                # Create new session
                success = postgresql_session_manager.create_session(
                    wsname=wsname,
                    user_id=user,
                    terminal_id=terminal_id,
                    display_mode='web',
                    encoding='utf8'
                )
                logger.info(f"[TERMINAL_REG] Created new PostgreSQL session: {wsname} for user {user}")
            
            if success:
                # Update WebSocket session tracker
                websocket_sessions[session_id] = {
                    'wsname': wsname, 
                    'user': user, 
                    'registered': True
                }
                logger.info(f"[TERMINAL_REG] PostgreSQL session ready: {wsname}")
            else:
                logger.error(f"[TERMINAL_REG] Failed to create/update PostgreSQL session: {wsname}")
                
        except Exception as e:
            logger.error(f"[TERMINAL_REG] PostgreSQL session error: {e}")
    
    logger.info(f"[TERMINAL_REG] Terminal {terminal_id} successfully registered and joined room terminal_{terminal_id}")
    
    # Send confirmation response
    emit('terminal_registered', {
        'success': True,
        'session_id': session_id,
        'terminal_id': terminal_id,
        'user': user,
        'workstation': workstation,
        'message': f'Terminal {terminal_id} registered successfully',
        'timestamp': datetime.now().isoformat()
    })
    
    # Also send as registration_response for compatibility
    emit('registration_response', {
        'type': 'registration_response',
        'data': {
            'success': True,
            'message': f'Terminal {terminal_id} registered successfully',
            'terminal_id': terminal_id,
            'session_id': session_id
        }
    })
    
    add_log('INFO', 'TERMINAL', f'Terminal registered: {terminal_id}', registration_info)

@socketio.on('register_client')
def handle_register_client(data):
    """Register Hub Client with immediate confirmation"""
    session_id = request.sid
    
    logger.info(f"[HUB_CLIENT_REG] Hub client registration received: {session_id}")
    logger.info(f"[HUB_CLIENT_REG] Registration data: {data}")
    
    try:
        client_type = data.get('client_type', 'unknown')
        client_id = data.get('client_id', f'client_{session_id}')
        capabilities = data.get('capabilities', [])
        
        # Store client registration
        client_info = {
            'session_id': session_id,
            'client_id': client_id,
            'client_type': client_type,
            'capabilities': capabilities,
            'timestamp': datetime.now().isoformat(),
            'status': 'registered'
        }
        
        # Store in active terminals for tracking
        active_terminals[session_id] = {
            'terminal_id': client_id,
            'user': 'hub_client',
            'room': f'hub_client_{session_id}',
            'client_info': client_info
        }
        
        logger.info(f"[HUB_CLIENT_REG] Client registered successfully: {client_id}")
        
        # Send immediate confirmation
        emit('client_registration_confirmed', {
            'success': True,
            'client_id': client_id,
            'session_id': session_id,
            'message': 'Hub Client registered successfully',
            'timestamp': datetime.now().isoformat()
        })
        
        add_log('INFO', 'HUB_CLIENT', f'Hub client registered: {client_id}', client_info)
        
    except Exception as e:
        logger.error(f"[HUB_CLIENT_REG] Registration failed: {e}")
        emit('client_registration_error', {
            'success': False,
            'error': str(e),
            'session_id': session_id
        })

@socketio.on('hub_register')
def handle_hub_register(data):
    """Handle React client Hub registration request"""
    session_id = request.sid
    
    logger.info(f"[HUB_REGISTER] React client Hub registration received: {session_id}")
    logger.info(f"[HUB_REGISTER] Registration data: {data}")
    
    try:
        terminal_id = data.get('terminal_id', 'webui')
        user = data.get('user', 'unknown')
        wsname = data.get('wsname', 'WSNAME00')
        client_type = data.get('client_type', 'react_web_terminal')
        hub_version = data.get('hub_version', 'v2.0')
        
        # Store terminal registration (unified with other registrations)
        terminal_info = {
            'session_id': session_id,
            'terminal_id': terminal_id,
            'user': user,
            'workstation': wsname,
            'client_type': client_type,
            'hub_version': hub_version,
            'timestamp': datetime.now().isoformat(),
            'status': 'registered'
        }
        
        # Store in active terminals
        active_terminals[session_id] = {
            'terminal_id': terminal_id,
            'user': user,
            'room': f'terminal_{terminal_id}',
            'hub_info': terminal_info
        }
        
        # Update terminal mapping
        terminal_to_session[terminal_id] = session_id
        
        # Create or update session in both managers
        # First, update workstation_session_manager (used by API v1 endpoints)
        if wsname:
            try:
                existing_ws_session = workstation_session_manager.get_session_by_workstation(wsname)
                if existing_ws_session:
                    # Update existing session to active
                    ws_session_id = existing_ws_session['session_id']
                    workstation_session_manager.update_session(ws_session_id, {'status': 'ON'})
                    logger.info(f"[HUB_REGISTER] Reactivated workstation session for {wsname}")
                else:
                    # Create new workstation session
                    ws_session_id = workstation_session_manager.create_session(
                        wsname=wsname,
                        user_id=user,
                        terminal_id=terminal_id,
                        display_mode='web',
                        encoding='utf8'
                    )
                    logger.info(f"[HUB_REGISTER] Created workstation session: {ws_session_id}")
            except Exception as e:
                logger.error(f"[HUB_REGISTER] Workstation session error: {e}")
        
        # Then, update PostgreSQL session manager if available
        if postgresql_session_manager and wsname:
            try:
                # Check if session exists
                existing_session = postgresql_session_manager.get_session_by_workstation(wsname)
                
                if existing_session:
                    # Update existing session to active
                    success = postgresql_session_manager.update_session_by_wsname(wsname, {'status': '1'})
                    logger.info(f"[HUB_REGISTER] Reactivated PostgreSQL session for {wsname}: {success}")
                else:
                    # Create new PostgreSQL session
                    success = postgresql_session_manager.create_session(
                        wsname=wsname,
                        user_id=user,
                        terminal_id=terminal_id,
                        display_mode='web',
                        encoding='utf8'
                    )
                    logger.info(f"[HUB_REGISTER] Created PostgreSQL session for {wsname}: {success}")
                
                # Track WebSocket session
                if success:
                    websocket_sessions[session_id] = {
                        'wsname': wsname,
                        'user': user,
                        'terminal_id': terminal_id,
                        'connected_at': datetime.now().isoformat()
                    }
                    logger.info(f"[HUB_REGISTER] WebSocket session tracked for {wsname}")
                    
            except Exception as e:
                logger.error(f"[HUB_REGISTER] PostgreSQL session error: {e}")
                # Continue with registration even if PostgreSQL fails
        
        logger.info(f"[HUB_REGISTER] React client registered successfully: {terminal_id}")
        
        # Join terminal room
        join_room(f'terminal_{terminal_id}')
        
        # Send immediate confirmation (React client compatible)
        emit('hub_registered', {
            'success': True,
            'terminal_id': terminal_id,
            'user': user,
            'wsname': wsname,
            'session_id': session_id,
            'hub_version': hub_version,
            'message': 'React client registered successfully with Hub',
            'timestamp': datetime.now().isoformat()
        })
        
        add_log('INFO', 'HUB_TERMINAL', f'React terminal registered: {terminal_id}', terminal_info)
        
    except Exception as e:
        logger.error(f"[HUB_REGISTER] Registration failed: {e}")
        emit('hub_registration_error', {
            'success': False,
            'error': str(e),
            'session_id': session_id
        })

@socketio.on('smed_data_direct')
def handle_smed_data_direct(data):
    """WebSocket Hub - Direct SMED data handling (replaces HTTP API)"""
    hub_info = {
        'event': 'smed_data_direct',
        'session_id': request.sid,
        'timestamp': datetime.now().isoformat(),
        'source': 'websocket_hub'
    }
    
    logger.info(f"[WEBSOCKET_HUB] Direct SMED data received: {hub_info}")
    
    try:
        # Extract data with validation - support both old and new formats
        terminal_id = data.get('terminal_id', 'webui')
        
        # Handle new employee data format (type: 'smed_map' with data array)
        if data.get('type') == 'smed_map' and data.get('data'):
            print(f"[DEBUG] API Server: Processing new employee data format")
            print(f"[DEBUG] API Server: Raw employee data received: {json.dumps(data, indent=2)}")
            print(f"[DEBUG] API Server: Employee data count: {len(data.get('data', []))}")
            print(f"[DEBUG] API Server: Headers: {data.get('headers', [])}")
            logger.info(f"[WEBSOCKET_HUB] Processing new employee data format")
            
            # Forward new format directly to terminals
            print(f"[DEBUG] API Server: About to emit smed_data_received with broadcast=True")
            print(f"[DEBUG] API Server: Data being broadcast: {json.dumps(data, indent=2)}")
            
            emit('smed_data_received', data, broadcast=True)
            print(f"[DEBUG] API Server: smed_data_received event emitted successfully")
            
            # Send confirmation
            confirmation_data = {
                'success': True,
                'terminal_id': terminal_id,
                'data_type': 'employee_smed_map',
                'employee_count': len(data.get('data', [])),
                'hub_session': request.sid,
                'timestamp': datetime.now().isoformat(),
                'message': f'Employee data delivered via WebSocket Hub'
            }
            print(f"[DEBUG] API Server: Sending confirmation: {json.dumps(confirmation_data, indent=2)}")
            emit('smed_data_confirmation', confirmation_data)
            
            add_log('INFO', 'WEBSOCKET_HUB', f'Employee data processed: {terminal_id}', {
                'terminal_id': terminal_id,
                'employee_count': len(data.get('data', [])),
                'headers': data.get('headers', []),
                'source_type': data.get('source_type', 'employee_data')
            })
            return
        
        # Handle legacy format (map_file + fields)
        map_file = data.get('map_file')
        fields = data.get('fields', {})
        program_name = data.get('program_name', 'unknown')
        source_type = data.get('source_type', 'java')  # java, call.py, direct
        
        hub_info.update({
            'terminal_id': terminal_id,
            'map_file': map_file,
            'fields_count': len(fields) if fields else 0,
            'program_name': program_name,
            'source_type': source_type
        })
        
        logger.info(f"[WEBSOCKET_HUB] Processing direct SMED data: {hub_info}")
        
        if not map_file:
            logger.error("[WEBSOCKET_HUB] map_file parameter missing")
            emit('smed_error', {
                'error': 'map_file parameter required',
                'hub_session': request.sid
            })
            return
        
        # Send data directly through WebSocket Hub (no HTTP intermediary)
        success = send_smed_to_terminal_hub(terminal_id, map_file, fields, program_name)
        
        # Send confirmation back to sender
        emit('smed_data_confirmation', {
            'success': success,
            'terminal_id': terminal_id,
            'map_file': map_file,
            'fields_populated': len(fields),
            'hub_session': request.sid,
            'timestamp': datetime.now().isoformat(),
            'message': f'SMED data {"delivered" if success else "failed to deliver"} via WebSocket Hub'
        })
        
        add_log('INFO', 'WEBSOCKET_HUB', f'Direct SMED data processed: {terminal_id}', hub_info)
        
    except Exception as e:
        logger.error(f"[WEBSOCKET_HUB] Error processing direct SMED data: {e}")
        emit('smed_error', {
            'error': str(e),
            'hub_session': request.sid,
            'timestamp': datetime.now().isoformat()
        })

@socketio.on('smed_data')
def handle_smed_data(data):
    """Legacy SMED data handler - redirects to direct hub"""
    logger.info(f"[WEBSOCKET_HUB] Legacy smed_data event received, redirecting to direct hub")
    
    # Convert legacy format to direct format
    map_data = data.get('map_data', {})
    direct_data = {
        'terminal_id': data.get('terminal_id', 'webui'),
        'map_file': map_data.get('map_file'),
        'fields': map_data.get('fields', {}),
        'program_name': 'legacy_call',
        'source_type': 'legacy'
    }
    
    # Forward to direct handler
    handle_smed_data_direct(direct_data)

@socketio.on('terminal_output')
def handle_terminal_output(data):
    """Handle output from terminal (e.g., print operations)"""
    session_id = request.sid
    output_data = data.get('data', '')
    output_type = data.get('type', 'text')
    
    if session_id in active_terminals:
        terminal_info = active_terminals[session_id]
        terminal_id = terminal_info.get('terminal_id')
        
        logger.info(f"Terminal output from {terminal_id}: {output_type}")
        
        # Process based on terminal type
        if terminal_id == 'Print':
            # Route to printer (placeholder for printer integration)
            logger.info(f"Print output: {output_data}")
            add_log('INFO', 'PRINT', 'Print job received', {
                'terminal_id': terminal_id,
                'data_length': len(output_data),
                'type': output_type
            })
        else:
            # Echo back for confirmation
            emit('output_received', {
                'terminal_id': terminal_id,
                'status': 'processed'
            })

def send_smed_to_terminal(terminal_id: str, map_file: str, fields: dict):
    """Legacy function - redirects to WebSocket Hub"""
    logger.info(f"[WEBSOCKET_HUB] Legacy send_smed_to_terminal called, redirecting to hub")
    return send_smed_to_terminal_hub(terminal_id, map_file, fields, 'legacy_call')

def send_smed_to_terminal_hub(terminal_id: str, map_file: str, fields: dict, program_name: str = 'unknown'):
    """WebSocket Hub - Centralized SMED data transmission"""
    hub_send_info = {
        'hub_function': 'send_smed_to_terminal_hub',
        'terminal_id': terminal_id,
        'map_file': map_file,
        'fields_count': len(fields) if fields else 0,
        'program_name': program_name,
        'timestamp': datetime.now().isoformat(),
        'hub_version': '1.0'
    }
    
    logger.info(f"[WEBSOCKET_HUB] Centralized SMED transmission to terminal: {terminal_id}")
    logger.info(f"[WEBSOCKET_HUB] Active terminals: {list(active_terminals.keys())}")
    logger.info(f"[WEBSOCKET_HUB] Terminal mappings: {terminal_to_session}")
    
    if terminal_id in terminal_to_session:
        session_id = terminal_to_session[terminal_id]
        room_name = f'terminal_{terminal_id}'
        
        logger.info(f"[WEBSOCKET_HUB] Terminal {terminal_id} → Session {session_id} → Room {room_name}")
        
        # Enhanced SMED message with hub metadata
        smed_message = {
            'map_file': map_file,
            'fields': fields,
            'action': 'display_map',
            'timestamp': datetime.now().isoformat(),
            'terminal_id': terminal_id,
            'session_id': session_id,
            'program_name': program_name,
            'hub_source': 'websocket_hub',
            'hub_version': '1.0',
            'data_flow': 'single_channel'  # Indicates this bypassed HTTP API
        }
        
        try:
            # Single WebSocket emission (no HTTP duplication)
            socketio.emit('smed_display', smed_message, room=room_name)
            logger.info(f"[WEBSOCKET_HUB] Single-channel SMED data sent to room: {room_name}")
            
            # Hub success confirmation
            hub_send_info.update({
                'success': True,
                'session_id': session_id,
                'room_name': room_name,
                'bypass_http': True
            })
            
            add_log('INFO', 'WEBSOCKET_HUB', f'Hub transmission successful: {terminal_id}', hub_send_info)
            return True
            
        except Exception as e:
            logger.error(f"[WEBSOCKET_HUB] Hub transmission failed: {e}")
            hub_send_info.update({
                'success': False,
                'error': str(e),
                'bypass_http': True
            })
            add_log('ERROR', 'WEBSOCKET_HUB', f'Hub transmission failed: {terminal_id}', hub_send_info)
            return False
    else:
        logger.warning(f"[WEBSOCKET_HUB] Terminal not connected to hub: {terminal_id}")
        logger.warning(f"[WEBSOCKET_HUB] Available hub terminals: {list(terminal_to_session.keys())}")
        
        hub_send_info.update({
            'success': False,
            'error': 'Terminal not connected to hub',
            'available_terminals': list(terminal_to_session.keys())
        })
        
        add_log('WARNING', 'WEBSOCKET_HUB', f'Terminal not in hub: {terminal_id}', hub_send_info)
        return False

def parse_smed_file(file_path):
    """SMEDファイル解析"""
    try:
        # Try to read with proper encoding - handle corrupted SJIS gracefully
        try:
            # Try SJIS first with error handling (standard for Japanese SMED files)
            with open(file_path, 'r', encoding='shift_jis', errors='replace') as f:
                content = f.read()
        except Exception:
            # Fallback to UTF-8 with error handling
            try:
                with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
                    content = f.read()
            except Exception:
                # Last resort - read as binary and decode manually
                with open(file_path, 'rb') as f:
                    raw_bytes = f.read()
                content = raw_bytes.decode('utf-8', errors='replace')
        
        # SMEDファイルの行を解析
        lines = content.split('\n')
        fields = []
        
        for line in lines:
            line = line.strip()
            if line and not line.startswith('#') and 'ITEM' in line:
                # ITEM行を解析
                field_data = {'name': '', 'type': 'input', 'position': {'row': 1, 'col': 1}, 'length': 10, 'prompt': '', 'color': '#00FF00'}
                
                # ITEMの後のフィールド名を取得
                parts = line.split()
                if len(parts) > 1:
                    field_data['name'] = parts[1]
                
                # POS=の解析
                if 'POS=' in line:
                    pos_match = line.split('POS=')[1].split()[0]
                    if pos_match.startswith('(') and ')' in pos_match:
                        pos_str = pos_match.strip('()')
                        if ',' in pos_str:
                            try:
                                row, col = pos_str.split(',')
                                field_data['position']['row'] = int(row.strip())
                                field_data['position']['col'] = int(col.strip())
                            except ValueError:
                                pass
                
                # LEN=の解析
                if 'LEN=' in line:
                    len_match = line.split('LEN=')[1].split()[0]
                    try:
                        field_data['length'] = int(len_match)
                        field_data['type'] = 'input'  # LENがあれば入力フィールド
                    except ValueError:
                        pass
                
                # PROMPT=の解析
                if 'PROMPT=' in line:
                    prompt_start = line.find('PROMPT=') + 7
                    if prompt_start < len(line):
                        prompt_part = line[prompt_start:].strip()
                        if prompt_part.startswith('"'):
                            # クォートで囲まれたpromptを抽出
                            end_quote = prompt_part.find('"', 1)
                            if end_quote > 0:
                                field_data['prompt'] = prompt_part[1:end_quote]
                                field_data['type'] = 'text'  # PROMPTがあれば表示フィールド
                            else:
                                # 終了クォートが見つからない場合、行末まで取得
                                field_data['prompt'] = prompt_part[1:]
                                field_data['type'] = 'text'
                
                # COLOR=の解析
                if 'COLOR=' in line:
                    color_match = line.split('COLOR=')[1].split()[0]
                    field_data['color'] = color_match
                
                # TYPE=の解析
                if 'TYPE=' in line:
                    type_match = line.split('TYPE=')[1].split()[0]
                    if type_match.upper() == 'T':
                        field_data['type'] = 'text'
                
                fields.append(field_data)
        
        return {
            'map_name': os.path.basename(file_path),
            'fields': fields,
            'raw_content': content[:1000]  # 最初の1000文字
        }
    
    except Exception as e:
        logger.error(f"Failed to parse SMED file {file_path}: {e}")
        return None

def execute_map_program(map_name, input_data):
    """?? ??? ???? ??"""
    global smed_pgm_config, multi_executor
    
    map_name_upper = map_name.upper()
    
    # SMED-PGM ???? ???? ?? ??
    if map_name_upper not in smed_pgm_config:
        logger.warning(f"No program configuration found for map: {map_name}")
        add_log('WARNING', 'EXECUTE', f'No program configuration found for map: {map_name}', {'map_name': map_name})
        return None
    
    config = smed_pgm_config[map_name_upper]
    program_type = config.get('TYPE', '').upper()
    program_path = config.get('PGM', '')
    
    if not program_type or not program_path:
        logger.error(f"Invalid program configuration for map {map_name}: {config}")
        add_log('ERROR', 'EXECUTE', f'Invalid program configuration for map: {map_name}', {'map_name': map_name, 'config': config})
        return None
    
    # Extract program name based on type
    program_name = program_path
    if program_type == 'JAVA':
        # Extract Java class name and package
        program_name = program_path
        package_name = '.'.join(program_path.split('.')[:-1]) if '.' in program_path else 'default'
        class_name = program_path.split('.')[-1] if '.' in program_path else program_path
    elif program_type == 'SHELL':
        # Extract shell script name
        program_name = os.path.basename(program_path)
    elif program_type == 'COBOL':
        # Extract COBOL module name
        program_name = os.path.basename(program_path).replace('.so', '')
    
    logger.info(f"Executing {program_type} program: {program_path} for map: {map_name}")
    
    log_details = {
        'map_name': map_name, 
        'program_type': program_type, 
        'program_path': program_path,
        'program_name': program_name,
        'input_data': input_data
    }
    
    if program_type == 'JAVA' and '.' in program_path:
        log_details['package_name'] = package_name
        log_details['class_name'] = class_name
    
    add_log('INFO', 'EXECUTE', f'Starting {program_type} program: {program_name}', log_details)
    
    try:
        result = multi_executor.execute_program(program_type, program_path, input_data)
        logger.info(f"Program execution successful for map {map_name}")
        
        success_details = {
            'map_name': map_name, 
            'program_type': program_type,
            'program_name': program_name,
            'result': result
        }
        
        if program_type == 'JAVA' and '.' in program_path:
            success_details['package_name'] = package_name
            success_details['class_name'] = class_name
        
        add_log('INFO', 'EXECUTE', f'{program_type} program executed successfully: {program_name}', success_details)
        return result
    
    except Exception as e:
        logger.error(f"Program execution failed for map {map_name}: {e}")
        
        error_details = {
            'map_name': map_name, 
            'program_type': program_type,
            'program_name': program_name,
            'error': str(e)
        }
        
        if program_type == 'JAVA' and '.' in program_path:
            error_details['package_name'] = package_name
            error_details['class_name'] = class_name
        
        add_log('ERROR', 'EXECUTE', f'{program_type} program execution failed: {program_name}', error_details)
        raise

# API ??????

@app.route('/api/health', methods=['GET'])
def health_check():
    """향상된 헬스 체크 엔드포인트"""
    try:
        # 기본 시스템 상태 수집
        health_data = {
            'status': 'OK',
            'version': 'v0.5.1',
            'timestamp': datetime.now().isoformat(),
            'smed_dir': SMED_DIR,
            'accounts_loaded': len(accounts),
            'smed_pgm_maps': len(smed_pgm_config),
            'map_pgm_maps': len(map_pgm_config.get('maps', {})),
        }
        
        # Java 실행 환경 상태 체크
        try:
            health_data['java_available'] = multi_executor.java_available if multi_executor else False
            health_data['jar_exists'] = os.path.exists(multi_executor.jar_path) if multi_executor and multi_executor.jar_path else False
        except Exception as e:
            if ERROR_HANDLER_AVAILABLE:
                error_data = handle_api_error(e, ErrorCategory.SYSTEM, ErrorSeverity.LOW, 
                                            "Java 환경 상태를 확인할 수 없습니다", 
                                            {"component": "java_executor"})
                health_data['java_status_error'] = error_data[0].get_json()['error']['id']
            health_data['java_available'] = False
            health_data['jar_exists'] = False
        
        # 추가 시스템 상태 정보
        health_data['system_info'] = {
            'dbio_available': DBIO_AVAILABLE,
            'postgresql_session_available': POSTGRESQL_SESSION_AVAILABLE,
            'smart_encoding_available': SMART_ENCODING_AVAILABLE,
            'error_handler_available': ERROR_HANDLER_AVAILABLE
        }
        
        # 성공적인 헬스 체크 로깅
        if ERROR_HANDLER_AVAILABLE:
            log_operation_success("health_check", {"components_checked": len(health_data['system_info'])})
        
        return jsonify(health_data)
        
    except Exception as e:
        if ERROR_HANDLER_AVAILABLE:
            return handle_api_error(e, ErrorCategory.SYSTEM, ErrorSeverity.HIGH, 
                                  "시스템 상태를 확인할 수 없습니다", 
                                  {"endpoint": "/api/health"})
        else:
            # 기본 에러 처리 (fallback)
            return jsonify({
                'status': 'ERROR',
                'message': 'Health check failed',
                'error': str(e)
            }), 500

@app.route('/broadcast-smed', methods=['POST'])
def broadcast_smed():
    """Broadcast SMED data to all connected WebSocket clients"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        logger.info(f"[BROADCAST_SMED] Received SMED data for broadcast: {data.get('program', 'unknown')}")
        
        # Broadcast to all connected Socket.IO clients
        socketio.emit('smed_data_received', data)
        
        logger.info(f"[BROADCAST_SMED] Successfully broadcasted SMED data")
        
        return jsonify({
            'status': 'success',
            'message': 'SMED data broadcasted',
            'program': data.get('program'),
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"[BROADCAST_SMED] Error broadcasting SMED data: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/smed/<map_name>', methods=['GET'])
def get_smed_map(map_name):
    """SMED ? ?? ??"""
    file_path = get_smed_file_path(map_name)
    
    if not file_path:
        return jsonify({'error': f'SMED file not found: {map_name}'}), 404
    
    smed_data = parse_smed_file(file_path)
    if not smed_data:
        return jsonify({'error': f'Failed to parse SMED file: {map_name}'}), 500
    
    return jsonify(smed_data)

@app.route('/api/smed/logo', methods=['GET'])
def get_logo_map():
    """LOGO ? ?? (?? ?????)"""
    return get_smed_map('LOGO')

# ENHANCED WORKSTATION LOGIN/LOGOUT APIs

@app.route('/api/login', methods=['POST'])
def login():
    """Enhanced login API with backward compatibility"""
    data = request.get_json()
    user_id = data.get('user_id')
    password = data.get('password')
    terminal_id = data.get('terminal_id', 'webui')  # Default to webui
    
    if not user_id or not password:
        return jsonify({'error': 'User ID and password required'}), 400
    
    if user_id not in accounts:
        return jsonify({'error': 'Invalid user ID'}), 401
    
    if accounts[user_id].get('password') != password:
        return jsonify({'error': 'Invalid password'}), 401
    
    # Get user program for backward compatibility
    user_program = accounts[user_id].get('pgm', 'PGM1')
    
    logger.info(f"User {user_id} logged in successfully with terminal: {terminal_id}")
    add_log('INFO', 'LOGIN', f'User {user_id} logged in successfully', {
        'user_id': user_id, 
        'program': user_program,
        'terminal_id': terminal_id
    })
    
    return jsonify({
        'success': True,
        'message': 'Login successful',
        'user_id': user_id,
        'program': user_program,
        'terminal_id': terminal_id
    })

@app.route('/api/workstation/login', methods=['POST'])
def workstation_login():
    """Workstation login with enhanced session management"""
    try:
        data = request.get_json()
        wsname = data.get('wsname')
        user_id = data.get('user_id')
        password = data.get('password')
        terminal_id = data.get('terminal_id')
        display_mode = data.get('display_mode', 'legacy')  # 'legacy' or 'position-based'
        encoding = data.get('encoding', 'sjis')  # 'sjis' or 'utf-8'
        
        # Validation
        if not wsname or not user_id or not password:
            return jsonify({'error': 'Workstation name, user ID and password required'}), 400
        
        if user_id not in accounts:
            return jsonify({'error': 'Invalid user ID'}), 401
        
        if accounts[user_id].get('password') != password:
            return jsonify({'error': 'Invalid password'}), 401
        
        if display_mode not in ['legacy', 'position-based']:
            return jsonify({'error': 'Invalid display mode. Must be "legacy" or "position-based"'}), 400
        
        if encoding not in ['sjis', 'utf-8']:
            return jsonify({'error': 'Invalid encoding. Must be "sjis" or "utf-8"'}), 400
        
        # Create workstation session
        session_id = workstation_session_manager.create_session(
            wsname=wsname,
            user_id=user_id,
            terminal_id=terminal_id,
            display_mode=display_mode,
            encoding=encoding
        )
        
        session_data = workstation_session_manager.get_session(session_id)
        user_program = accounts[user_id].get('pgm', 'PGM1')
        
        logger.info(f"Workstation {wsname} logged in by user {user_id} with session {session_id}")
        add_log('INFO', 'WORKSTATION_LOGIN', f'Workstation {wsname} logged in by user {user_id}', {
            'wsname': wsname,
            'user_id': user_id,
            'session_id': session_id,
            'display_mode': display_mode,
            'encoding': encoding,
            'program': user_program
        })
        
        return jsonify({
            'success': True,
            'message': 'Workstation login successful',
            'session_id': session_id,
            'wsname': wsname,
            'user_id': user_id,
            'program': user_program,
            'display_mode': display_mode,
            'encoding': encoding,
            'login_time': session_data['login_time'],
            'status': 'ON'
        })
        
    except Exception as e:
        logger.error(f"Workstation login error: {e}")
        return jsonify({'error': f'Login failed: {str(e)}'}), 500

@app.route('/api/workstation/logout', methods=['POST'])
def workstation_logout():
    """Workstation logout"""
    try:
        data = request.get_json()
        wsname = data.get('wsname')
        session_id = data.get('session_id')
        
        if not wsname and not session_id:
            return jsonify({'error': 'Workstation name or session ID required'}), 400
        
        # Logout session
        success = workstation_session_manager.logout_session(session_id=session_id, wsname=wsname)
        
        if not success:
            return jsonify({'error': 'Session not found or already logged out'}), 404
        
        logger.info(f"Workstation logout successful for {wsname or session_id}")
        add_log('INFO', 'WORKSTATION_LOGOUT', f'Workstation logout successful', {
            'wsname': wsname,
            'session_id': session_id
        })
        
        return jsonify({
            'success': True,
            'message': 'Workstation logout successful',
            'wsname': wsname,
            'session_id': session_id,
            'status': 'OFF'
        })
        
    except Exception as e:
        logger.error(f"Workstation logout error: {e}")
        return jsonify({'error': f'Logout failed: {str(e)}'}), 500

@app.route('/api/v1/sessions/bulk-disconnect', methods=['POST'])
def bulk_disconnect_workstations():
    """Bulk disconnect workstation sessions"""
    try:
        data = request.get_json()
        
        if not data or 'workstations' not in data:
            return jsonify({'error': 'Workstations list required'}), 400
        
        workstation_names = data.get('workstations', [])
        
        if not isinstance(workstation_names, list) or not workstation_names:
            return jsonify({'error': 'Workstations must be a non-empty list'}), 400
        
        # Validate workstation names
        for wsname in workstation_names:
            if not isinstance(wsname, str) or not wsname.strip():
                return jsonify({'error': f'Invalid workstation name: {wsname}'}), 400
        
        logger.info(f"[BULK_DISCONNECT] Starting bulk disconnect for {len(workstation_names)} workstations")
        
        # Get session information before disconnecting for WebSocket cleanup
        sessions_to_disconnect = []
        if postgresql_session_manager:
            sessions_to_disconnect.extend(
                postgresql_session_manager.get_sessions_by_workstation_names(workstation_names)
            )
        else:
            sessions_to_disconnect.extend(
                workstation_session_manager.get_sessions_by_workstation_names(workstation_names)
            )
        
        # Force disconnect WebSocket connections for these workstations
        disconnected_websockets = force_disconnect_websockets_by_workstations(workstation_names)
        
        # Logout sessions in PostgreSQL (if available)
        postgresql_results = {'success': [], 'failed': []}
        if postgresql_session_manager:
            postgresql_results = postgresql_session_manager.bulk_logout_sessions(workstation_names)
            logger.info(f"[BULK_DISCONNECT] PostgreSQL: {len(postgresql_results['success'])} successful, {len(postgresql_results['failed'])} failed")
        
        # Logout sessions in workstation manager (for backward compatibility)
        workstation_results = workstation_session_manager.bulk_logout_sessions(workstation_names)
        logger.info(f"[BULK_DISCONNECT] Workstation manager: {len(workstation_results['success'])} successful, {len(workstation_results['failed'])} failed")
        
        # Combine results (PostgreSQL takes precedence for status)
        final_results = {
            'success': postgresql_results['success'] if postgresql_session_manager else workstation_results['success'],
            'failed': postgresql_results['failed'] if postgresql_session_manager else workstation_results['failed'],
            'total_processed': len(workstation_names),
            'websockets_disconnected': disconnected_websockets
        }
        
        # Log the bulk disconnect operation
        add_log('INFO', 'BULK_DISCONNECT', 'Bulk workstation disconnect completed', {
            'workstations': workstation_names,
            'successful': final_results['success'],
            'failed': [f['wsname'] for f in final_results['failed']],
            'websockets_disconnected': disconnected_websockets
        })
        
        return jsonify(final_results)
        
    except Exception as e:
        logger.error(f"Bulk disconnect error: {e}")
        return jsonify({
            'error': f'Bulk disconnect failed: {str(e)}',
            'success': [],
            'failed': [{'wsname': ws, 'error': str(e)} for ws in data.get('workstations', [])] if data else [],
            'total_processed': len(data.get('workstations', [])) if data else 0
        }), 500

@app.route('/api/workstation/sessions', methods=['GET'])
def get_workstation_sessions():
    """Get all workstation sessions"""
    try:
        user_id = request.args.get('user_id')
        wsname = request.args.get('wsname')
        status = request.args.get('status')  # 'ON', 'OFF', or None for all
        
        sessions = workstation_session_manager.list_all_sessions()
        
        # Filter by user_id
        if user_id:
            sessions = [s for s in sessions if s.get('user_id') == user_id]
        
        # Filter by workstation name
        if wsname:
            sessions = [s for s in sessions if s.get('wsname') == wsname]
        
        # Filter by status
        if status:
            sessions = [s for s in sessions if s.get('status') == status]
        
        return jsonify({
            'success': True,
            'sessions': sessions,
            'count': len(sessions)
        })
        
    except Exception as e:
        logger.error(f"Get workstation sessions error: {e}")
        return jsonify({'error': f'Failed to get sessions: {str(e)}'}), 500

@app.route('/api/workstation/<wsname>/status', methods=['GET'])
def get_workstation_status(wsname):
    """Get workstation status and session information"""
    try:
        session = workstation_session_manager.get_session_by_workstation(wsname)
        
        if not session:
            return jsonify({
                'success': True,
                'wsname': wsname,
                'status': 'OFF',
                'message': 'No active session'
            })
        
        return jsonify({
            'success': True,
            'wsname': wsname,
            'user_id': session.get('user_id'),
            'status': session.get('status'),
            'display_mode': session.get('display_mode'),
            'encoding': session.get('encoding'),
            'session_id': session.get('session_id'),
            'login_time': session.get('login_time'),
            'last_activity': session.get('last_activity'),
            'smed_subscriptions': session.get('smed_subscriptions', []),
            'terminal_id': session.get('terminal_id')
        })
        
    except Exception as e:
        logger.error(f"Get workstation status error: {e}")
        return jsonify({'error': f'Failed to get workstation status: {str(e)}'}), 500

@app.route('/api/workstation/<wsname>/display-mode', methods=['PUT'])
def set_workstation_display_mode(wsname):
    """Set display mode for workstation session"""
    try:
        data = request.get_json()
        display_mode = data.get('display_mode')
        
        if not display_mode:
            return jsonify({'error': 'Display mode required'}), 400
        
        if display_mode not in ['legacy', 'position-based']:
            return jsonify({'error': 'Invalid display mode. Must be "legacy" or "position-based"'}), 400
        
        session = workstation_session_manager.get_session_by_workstation(wsname)
        if not session:
            return jsonify({'error': 'Workstation session not found'}), 404
        
        success = workstation_session_manager.set_display_mode(wsname, display_mode)
        
        if not success:
            return jsonify({'error': 'Failed to set display mode'}), 500
        
        logger.info(f"Set display mode for {wsname} to {display_mode}")
        add_log('INFO', 'DISPLAY_MODE_CHANGE', f'Display mode changed for {wsname}', {
            'wsname': wsname,
            'display_mode': display_mode,
            'session_id': session.get('session_id')
        })
        
        return jsonify({
            'success': True,
            'message': 'Display mode updated successfully',
            'wsname': wsname,
            'display_mode': display_mode
        })
        
    except Exception as e:
        logger.error(f"Set display mode error: {e}")
        return jsonify({'error': f'Failed to set display mode: {str(e)}'}), 500

@app.route('/api/workstation/<wsname>/encoding', methods=['GET'])
def get_workstation_encoding(wsname):
    """Get encoding setting for workstation session"""
    try:
        session = workstation_session_manager.get_session_by_workstation(wsname)
        
        if not session:
            return jsonify({'error': 'Workstation session not found'}), 404
        
        return jsonify({
            'success': True,
            'wsname': wsname,
            'encoding': session.get('encoding', 'sjis'),
            'available_encodings': ['sjis', 'utf-8']
        })
        
    except Exception as e:
        logger.error(f"Get workstation encoding error: {e}")
        return jsonify({'error': f'Failed to get encoding: {str(e)}'}), 500

@app.route('/api/workstation/<wsname>/encoding', methods=['PUT'])
def set_workstation_encoding(wsname):
    """Set encoding for workstation session"""
    try:
        data = request.get_json()
        encoding = data.get('encoding')
        
        if not encoding:
            return jsonify({'error': 'Encoding required'}), 400
        
        if encoding not in ['sjis', 'utf-8']:
            return jsonify({'error': 'Invalid encoding. Must be "sjis" or "utf-8"'}), 400
        
        session = workstation_session_manager.get_session_by_workstation(wsname)
        if not session:
            return jsonify({'error': 'Workstation session not found'}), 404
        
        success = workstation_session_manager.set_encoding(wsname, encoding)
        
        if not success:
            return jsonify({'error': 'Failed to set encoding'}), 500
        
        logger.info(f"Set encoding for {wsname} to {encoding}")
        add_log('INFO', 'ENCODING_CHANGE', f'Encoding changed for {wsname}', {
            'wsname': wsname,
            'encoding': encoding,
            'session_id': session.get('session_id')
        })
        
        return jsonify({
            'success': True,
            'message': 'Encoding updated successfully',
            'wsname': wsname,
            'encoding': encoding
        })
        
    except Exception as e:
        logger.error(f"Set encoding error: {e}")
        return jsonify({'error': f'Failed to set encoding: {str(e)}'}), 500

@app.route('/api/workstation/<wsname>/smed-subscriptions', methods=['GET'])
def get_workstation_smed_subscriptions(wsname):
    """Get SMED subscriptions for workstation session"""
    try:
        session = workstation_session_manager.get_session_by_workstation(wsname)
        
        if not session:
            return jsonify({'error': 'Workstation session not found'}), 404
        
        return jsonify({
            'success': True,
            'wsname': wsname,
            'smed_subscriptions': session.get('smed_subscriptions', []),
            'session_id': session.get('session_id')
        })
        
    except Exception as e:
        logger.error(f"Get SMED subscriptions error: {e}")
        return jsonify({'error': f'Failed to get SMED subscriptions: {str(e)}'}), 500

@app.route('/api/workstation/<wsname>/smed-subscriptions', methods=['POST'])
def add_workstation_smed_subscription(wsname):
    """Add SMED subscription to workstation session"""
    try:
        data = request.get_json()
        map_name = data.get('map_name')
        
        if not map_name:
            return jsonify({'error': 'Map name required'}), 400
        
        session = workstation_session_manager.get_session_by_workstation(wsname)
        if not session:
            return jsonify({'error': 'Workstation session not found'}), 404
        
        success = workstation_session_manager.add_smed_subscription(session['session_id'], map_name)
        
        if not success:
            return jsonify({'error': 'Failed to add SMED subscription'}), 500
        
        logger.info(f"Added SMED subscription {map_name} for {wsname}")
        
        # Get updated subscriptions
        updated_session = workstation_session_manager.get_session_by_workstation(wsname)
        
        return jsonify({
            'success': True,
            'message': 'SMED subscription added successfully',
            'wsname': wsname,
            'map_name': map_name,
            'smed_subscriptions': updated_session.get('smed_subscriptions', [])
        })
        
    except Exception as e:
        logger.error(f"Add SMED subscription error: {e}")
        return jsonify({'error': f'Failed to add SMED subscription: {str(e)}'}), 500

@app.route('/api/workstation/<wsname>/smed-subscriptions/<map_name>', methods=['DELETE'])
def remove_workstation_smed_subscription(wsname, map_name):
    """Remove SMED subscription from workstation session"""
    try:
        session = workstation_session_manager.get_session_by_workstation(wsname)
        if not session:
            return jsonify({'error': 'Workstation session not found'}), 404
        
        success = workstation_session_manager.remove_smed_subscription(session['session_id'], map_name)
        
        if not success:
            return jsonify({'error': 'Failed to remove SMED subscription'}), 500
        
        logger.info(f"Removed SMED subscription {map_name} for {wsname}")
        
        # Get updated subscriptions
        updated_session = workstation_session_manager.get_session_by_workstation(wsname)
        
        return jsonify({
            'success': True,
            'message': 'SMED subscription removed successfully',
            'wsname': wsname,
            'map_name': map_name,
            'smed_subscriptions': updated_session.get('smed_subscriptions', [])
        })
        
    except Exception as e:
        logger.error(f"Remove SMED subscription error: {e}")
        return jsonify({'error': f'Failed to remove SMED subscription: {str(e)}'}), 500

# WORKSTATION SESSION MIGRATION AND COMPATIBILITY SUPPORT

@app.route('/api/workstation/migrate', methods=['POST'])
def migrate_workstation_session():
    """Migrate existing session to new workstation session format"""
    try:
        data = request.get_json()
        terminal_id = data.get('terminal_id')
        wsname = data.get('wsname')
        user_id = data.get('user_id')
        display_mode = data.get('display_mode', 'legacy')
        encoding = data.get('encoding', 'sjis')
        
        if not terminal_id or not wsname or not user_id:
            return jsonify({'error': 'terminal_id, wsname, and user_id required'}), 400
        
        # Check if legacy session exists
        legacy_session_id = terminal_to_session.get(terminal_id)
        if not legacy_session_id or legacy_session_id not in active_terminals:
            return jsonify({'error': 'Legacy session not found'}), 404
        
        legacy_session = active_terminals[legacy_session_id]
        
        # Create new workstation session
        new_session_id = workstation_session_manager.create_session(
            wsname=wsname,
            user_id=user_id,
            terminal_id=terminal_id,
            display_mode=display_mode,
            encoding=encoding
        )
        
        # Migrate any existing SMED subscriptions or other data
        # This can be extended based on specific migration needs
        
        logger.info(f"Migrated session from {legacy_session_id} to {new_session_id}")
        add_log('INFO', 'SESSION_MIGRATION', f'Session migrated to workstation format', {
            'old_session_id': legacy_session_id,
            'new_session_id': new_session_id,
            'wsname': wsname,
            'user_id': user_id,
            'display_mode': display_mode,
            'encoding': encoding
        })
        
        return jsonify({
            'success': True,
            'message': 'Session migrated successfully',
            'old_session_id': legacy_session_id,
            'new_session_id': new_session_id,
            'wsname': wsname,
            'display_mode': display_mode,
            'encoding': encoding
        })
        
    except Exception as e:
        logger.error(f"Session migration error: {e}")
        return jsonify({'error': f'Migration failed: {str(e)}'}), 500

@app.route('/api/workstation/compatibility-check', methods=['GET'])
def check_workstation_compatibility():
    """Check compatibility status and suggest migration paths"""
    try:
        # Check for legacy sessions that could be migrated
        legacy_sessions = []
        for session_id, terminal_info in active_terminals.items():
            if session_id not in [s.get('session_id') for s in workstation_session_manager.list_all_sessions()]:
                legacy_sessions.append({
                    'session_id': session_id,
                    'terminal_id': terminal_info.get('terminal_id'),
                    'user': terminal_info.get('user'),
                    'room': terminal_info.get('room'),
                    'migration_suggested': True
                })
        
        # Get workstation sessions summary
        workstation_sessions = workstation_session_manager.list_all_sessions()
        
        return jsonify({
            'success': True,
            'compatibility_status': {
                'legacy_sessions': len(legacy_sessions),
                'workstation_sessions': len(workstation_sessions),
                'migration_needed': len(legacy_sessions) > 0
            },
            'legacy_sessions': legacy_sessions,
            'workstation_sessions_summary': [
                {
                    'wsname': s.get('wsname'),
                    'user_id': s.get('user_id'),
                    'status': s.get('status'),
                    'display_mode': s.get('display_mode'),
                    'encoding': s.get('encoding')
                } for s in workstation_sessions
            ],
            'migration_recommendations': [
                'Consider migrating legacy sessions to workstation format for enhanced features',
                'Position-based rendering requires workstation session format',
                'UTF-8 encoding support available in workstation sessions',
                'Enhanced SMED subscription management in workstation sessions'
            ] if len(legacy_sessions) > 0 else []
        })
        
    except Exception as e:
        logger.error(f"Compatibility check error: {e}")
        return jsonify({'error': f'Compatibility check failed: {str(e)}'}), 500

@app.route('/api/workstation/auto-migrate', methods=['POST'])
def auto_migrate_workstation_sessions():
    """Automatically migrate all compatible legacy sessions"""
    try:
        data = request.get_json()
        default_display_mode = data.get('default_display_mode', 'legacy')
        default_encoding = data.get('default_encoding', 'sjis')
        
        migrated_sessions = []
        failed_migrations = []
        
        # Find legacy sessions to migrate
        for session_id, terminal_info in list(active_terminals.items()):
            if session_id not in [s.get('session_id') for s in workstation_session_manager.list_all_sessions()]:
                try:
                    terminal_id = terminal_info.get('terminal_id')
                    user_id = terminal_info.get('user')
                    
                    # Generate workstation name from terminal_id if not provided
                    wsname = f"WS_{terminal_id.upper()}" if terminal_id else f"WS_{session_id[:8].upper()}"
                    
                    # Create workstation session
                    new_session_id = workstation_session_manager.create_session(
                        wsname=wsname,
                        user_id=user_id or 'unknown',
                        terminal_id=terminal_id,
                        display_mode=default_display_mode,
                        encoding=default_encoding
                    )
                    
                    migrated_sessions.append({
                        'old_session_id': session_id,
                        'new_session_id': new_session_id,
                        'wsname': wsname,
                        'terminal_id': terminal_id,
                        'user_id': user_id
                    })
                    
                except Exception as e:
                    failed_migrations.append({
                        'session_id': session_id,
                        'error': str(e)
                    })
        
        logger.info(f"Auto-migration completed: {len(migrated_sessions)} successful, {len(failed_migrations)} failed")
        add_log('INFO', 'AUTO_MIGRATION', f'Auto-migration completed', {
            'successful': len(migrated_sessions),
            'failed': len(failed_migrations),
            'default_display_mode': default_display_mode,
            'default_encoding': default_encoding
        })
        
        return jsonify({
            'success': True,
            'message': f'Auto-migration completed: {len(migrated_sessions)} successful, {len(failed_migrations)} failed',
            'migrated_sessions': migrated_sessions,
            'failed_migrations': failed_migrations,
            'summary': {
                'total_processed': len(migrated_sessions) + len(failed_migrations),
                'successful': len(migrated_sessions),
                'failed': len(failed_migrations)
            }
        })
        
    except Exception as e:
        logger.error(f"Auto-migration error: {e}")
        return jsonify({'error': f'Auto-migration failed: {str(e)}'}), 500

# WORKSTATION MANAGEMENT API ENDPOINTS

@app.route('/api/workstations', methods=['GET'])
def list_workstations():
    """List all workstations with their status"""
    try:
        sessions = workstation_session_manager.list_all_sessions()
        
        # Transform sessions into workstation format
        workstations = []
        workstation_dict = {}
        
        # Group sessions by workstation name
        for session in sessions:
            wsname = session.get('wsname', 'UNKNOWN')
            if wsname not in workstation_dict:
                workstation_dict[wsname] = {
                    'wsname': wsname,
                    'status': 'OFF',
                    'connected': False,
                    'created_at': session.get('created_at', ''),
                    'updated_at': session.get('updated_at', '')
                }
            
            # Update with latest session info
            if session.get('status') == 'ON':
                workstation_dict[wsname]['status'] = 'ON'
            if session.get('socket_id'):
                workstation_dict[wsname]['connected'] = True
                
            # Keep most recent timestamps
            if session.get('updated_at') > workstation_dict[wsname]['updated_at']:
                workstation_dict[wsname]['updated_at'] = session.get('updated_at', '')
        
        workstations = list(workstation_dict.values())
        
        return jsonify({
            'success': True,
            'workstations': workstations,
            'count': len(workstations)
        })
        
    except Exception as e:
        logger.error(f"List workstations error: {e}")
        return jsonify({'error': f'Failed to list workstations: {str(e)}'}), 500

@app.route('/api/workstations', methods=['POST'])
def register_workstation():
    """Register a new workstation"""
    try:
        data = request.get_json()
        wsname = data.get('wsname')
        status = data.get('status', 'OFF')
        
        if not wsname:
            return jsonify({'error': 'Workstation name is required'}), 400
            
        # Create a new session for this workstation
        session_id = workstation_session_manager.create_session(
            user_id='SYSTEM',
            terminal_id='admin',
            wsname=wsname
        )
        
        # Set the initial status
        if session_id:
            session_data = workstation_session_manager.get_session(session_id)
            if session_data:
                session_data['status'] = status
                workstation_session_manager.update_session(session_id, session_data)
        
        return jsonify({
            'success': True,
            'message': f'Workstation {wsname} registered successfully',
            'wsname': wsname,
            'status': status,
            'session_id': session_id
        })
        
    except Exception as e:
        logger.error(f"Register workstation error: {e}")
        return jsonify({'error': f'Failed to register workstation: {str(e)}'}), 500

@app.route('/api/workstations/<wsname>', methods=['PUT'])
def update_workstation_status(wsname):
    """Update workstation status"""
    try:
        data = request.get_json()
        new_status = data.get('status')
        
        if not new_status or new_status not in ['ON', 'OFF']:
            return jsonify({'error': 'Valid status (ON/OFF) is required'}), 400
        
        # Find all sessions for this workstation and update them
        sessions = workstation_session_manager.list_all_sessions()
        updated_sessions = 0
        
        for session in sessions:
            if session.get('wsname') == wsname:
                session_id = session.get('session_id')
                if session_id:
                    session['status'] = new_status
                    session['updated_at'] = datetime.now().isoformat()
                    workstation_session_manager.update_session(session_id, session)
                    updated_sessions += 1
        
        return jsonify({
            'success': True,
            'message': f'Workstation {wsname} status updated to {new_status}',
            'wsname': wsname,
            'status': new_status,
            'updated_sessions': updated_sessions
        })
        
    except Exception as e:
        logger.error(f"Update workstation status error: {e}")
        return jsonify({'error': f'Failed to update workstation status: {str(e)}'}), 500

@app.route('/api/execute', methods=['POST'])
def execute_program():
    """???? ??"""
    data = request.get_json()
    
    user_id = data.get('user_id')
    map_name = data.get('map_name', '')
    input_fields = data.get('input_fields', {})
    
    if not user_id:
        return jsonify({'error': 'User ID required'}), 400
    
    # Allow workstation users (starting with WS) without account verification
    if not user_id.startswith('WS') and user_id not in accounts:
        return jsonify({'error': 'Invalid user ID'}), 401
    
    try:
        # ? ?? ???? ??
        if map_name:
            logger.info(f"Executing program for map: {map_name} with input: {input_fields}")
            add_log('INFO', 'EXECUTE', f'Executing program for map: {map_name}', {'user_id': user_id, 'map_name': map_name, 'input_fields': input_fields})
            result = execute_map_program(map_name, input_fields)
            if result:
                add_log('INFO', 'EXECUTE', f'Program execution completed for map: {map_name}', {'user_id': user_id, 'map_name': map_name, 'result': result})
                return jsonify({
                    'success': True,
                    'result': result,
                    'map_name': map_name
                })
        
        # ?? ???? ?? (?? ???)
        program = data.get('program') or (accounts.get(user_id, {}).get('pgm', 'PGM1') if not user_id.startswith('WS') else 'PGM1')
        
        if multi_executor and multi_executor.java_available:
            logger.info(f"Executing default Java program: {program}")
            result = multi_executor.execute_java_program(program, input_fields)
            return jsonify({
                'success': True,
                'result': result,
                'program': program
            })
        else:
            return jsonify({'error': 'Java execution not available'}), 500
    
    except Exception as e:
        logger.error(f"Program execution failed: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/smed_pgm/status', methods=['GET'])
def smed_pgm_status():
    """SMED-PGM ?? ??"""
    return jsonify({
        'loaded': True,
        'maps_count': len(smed_pgm_config),
        'maps': list(smed_pgm_config.keys()),
        'file_path': SMED_PGM_FILE,
        'file_exists': os.path.exists(SMED_PGM_FILE) if SMED_PGM_FILE else False
    })

@app.route('/api/smed_pgm/reload', methods=['GET'])
def reload_smed_pgm():
    """SMED-PGM ?? ???"""
    try:
        load_config()  # ?? ?? ???
        return jsonify({
            'success': True,
            'message': 'SMED-PGM configuration reloaded',
            'maps_count': len(smed_pgm_config)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/smed/files', methods=['GET'])
def get_smed_files():
    """SMEDファイル一覧取得"""
    try:
        if not SMED_DIR or not os.path.exists(SMED_DIR):
            return jsonify({'error': 'SMED directory not found'}), 404
        
        files = []
        for file in os.listdir(SMED_DIR):
            # .smed拡張子があるファイルまたは拡張子なしのファイル（ディレクトリは除外）
            file_path = os.path.join(SMED_DIR, file)
            if os.path.isfile(file_path) and (file.endswith('.smed') or '.' not in file):
                files.append(file)
        
        files.sort()  # ファイル名でソート
        
        return jsonify({
            'success': True,
            'files': files,
            'count': len(files)
        })
    except Exception as e:
        logger.error(f"SMEDファイル一覧取得エラー: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/smed/save', methods=['POST'])
def save_smed_file():
    """Save SMED file to volume/library directory and update catalog"""
    try:
        data = request.get_json()
        filename = data.get('filename')
        content = data.get('content')
        volume = data.get('volume')
        library = data.get('library')
        
        if not filename or not content:
            return jsonify({'error': 'Filename and content are required'}), 400
        
        if not volume or not library:
            return jsonify({'error': 'Volume and library are required'}), 400
        
        # Security check: prevent path traversal
        if '..' in filename or '/' in filename or '\\' in filename:
            return jsonify({'error': 'Invalid filename'}), 400
        
        # Use filename as-is (NEVER add .smed extension)
        smed_filename = filename
        logger.info(f"SAVE DEBUG: Original filename: {filename}")
        logger.info(f"SAVE DEBUG: Final filename: {smed_filename}")
        
        # Create directory structure based on volume/library
        volume_dir = os.path.join(VOLUME_ROOT, volume, library)
        os.makedirs(volume_dir, exist_ok=True)
        
        file_path = os.path.join(volume_dir, smed_filename)
        logger.info(f"SAVE DEBUG: Full file path: {file_path}")
        
        # Determine encoding based on file type
        if smed_filename.endswith('.java'):
            encoding = 'utf-8'
            logger.info(f"SAVE DEBUG: Writing Java file with UTF-8 encoding")
        else:
            encoding = 'shift_jis'
            logger.info(f"SAVE DEBUG: Writing SMED file with SJIS encoding")
        
        with open(file_path, 'w', encoding=encoding, errors='replace') as f:
            f.write(content)
        logger.info(f"SAVE DEBUG: File written successfully with {encoding} encoding")
        
        # Verify file was saved with correct encoding
        try:
            with open(file_path, 'r', encoding=encoding) as f:
                verify_content = f.read()
            logger.info(f"SAVE DEBUG: File verification successful - {encoding} encoding confirmed")
            logger.info(f"SAVE DEBUG: Saved content length: {len(verify_content)}")
        except Exception as e:
            logger.error(f"SAVE DEBUG: File verification failed: {e}")
        
        # Update catalog.json
        catalog_path = os.path.join(os.path.dirname(__file__), '..', 'config', 'catalog.json')
        
        if os.path.exists(catalog_path):
            with open(catalog_path, 'r', encoding='utf-8') as f:
                catalog = json.load(f)
            
            # Ensure volume and library exist in catalog
            if volume not in catalog:
                catalog[volume] = {}
            if library not in catalog[volume]:
                catalog[volume][library] = {}
            
            # Add or update entry based on file type
            if filename.endswith('.java'):
                # Java program file
                program_name = filename[:-5]  # Remove '.java'
                logger.info(f"SAVE DEBUG: Updating catalog for Java program: {program_name}")
                catalog[volume][library][program_name] = {
                    "TYPE": "PGM",
                    "PGMTYPE": "JAVA",
                    "PGMNAME": f"com.openasp.sample.{program_name}",
                    "CLASSFILE": f"com/openasp/sample/{program_name}.class",
                    "DESCRIPTION": f"Java program: {program_name}",
                    "VERSION": "1.0",
                    "CREATED": datetime.now().isoformat() + "Z",
                    "UPDATED": datetime.now().isoformat() + "Z"
                }
                logger.info(f"SAVE DEBUG: Catalog entry created for Java program: {program_name}")
            else:
                # SMED map file
                logger.info(f"SAVE DEBUG: Updating catalog with MAPFILE: {filename}")
                catalog[volume][library][filename] = {
                    "TYPE": "MAP",
                    "MAPTYPE": "SMED",
                    "MAPFILE": filename,  # Use filename without extension to match our convention
                    "DESCRIPTION": f"SMED map: {filename}",
                    "ROWS": 24,
                    "COLS": 80,
                    "CREATED": datetime.now().isoformat() + "Z",
                    "UPDATED": datetime.now().isoformat() + "Z"
                }
                logger.info(f"SAVE DEBUG: Catalog entry created with MAPFILE: {catalog[volume][library][filename]['MAPFILE']}")
            
            # Save updated catalog
            with open(catalog_path, 'w', encoding='utf-8') as f:
                json.dump(catalog, f, indent=2, ensure_ascii=False)
        
        logger.info(f"SMED file saved: {file_path}")
        logger.info(f"Catalog updated for {volume}/{library}/{filename}")
        
        return jsonify({
            'success': True,
            'message': f'SMED file saved as {filename}',
            'filename': filename,
            'volume': volume,
            'library': library,
            'path': file_path
        })
        
    except Exception as e:
        logger.error(f"SMED file save error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/smed/content/<filename>', methods=['GET'])
def get_smed_content(filename):
    """SMEDファイル内容取得 (single filename)"""
    logger.info(f"ENDPOINT DEBUG: get_smed_content called with filename: {filename}")
    print(f"CONSOLE DEBUG: Single filename endpoint called: {filename}", flush=True)
    try:
        if not SMED_DIR or not os.path.exists(SMED_DIR):
            return jsonify({'error': 'SMED directory not found'}), 404
        
        # セキュリティチェック: ファイル名にパストラバーサルが含まれていないか確認
        if '..' in filename or '/' in filename or '\\' in filename:
            return jsonify({'error': 'Invalid filename'}), 400
        
        file_path = os.path.join(SMED_DIR, filename)
        
        if not os.path.exists(file_path):
            return jsonify({'error': 'File not found'}), 404
        
        # ファイル内容を読み取り（Shift_JIS → Unicode変換）
        try:
            # バイナリで読み込んでSJIS変換
            with open(file_path, 'rb') as f:
                raw_content = f.read()
            
            # SJIS → Unicode 変換
            content = convert_sjis_to_unicode(raw_content)
            
        except Exception as e:
            logger.error(f"SJIS conversion failed for {filename}: {e}")
            # フォールバック: 標準Python エンコーディング
            try:
                with open(file_path, 'r', encoding='shift_jis', errors='replace') as f:
                    content = f.read()
            except Exception:
                with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
                    content = f.read()
        
        return content, 200, {'Content-Type': 'text/plain; charset=utf-8'}
        
    except Exception as e:
        logger.error(f"SMEDファイル内容取得エラー: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/smed/content/<volume>/<library>/<mapname>', methods=['GET'])
def get_smed_content_from_volume(volume, library, mapname):
    """볼륨/라이브러리 구조의 SMEDファイル内容取得"""
    logger.info(f"ENDPOINT DEBUG: get_smed_content_from_volume called with {volume}/{library}/{mapname}")
    print(f"CONSOLE DEBUG: Volume/library endpoint called: {volume}/{library}/{mapname}", flush=True)
    try:
        # VOLUME_ROOT 기본 경로 확인
        if not VOLUME_ROOT or not os.path.exists(VOLUME_ROOT):
            return jsonify({'error': 'Volume root directory not found'}), 404
        
        # 보안 체크: 패스 트래버설 공격 방지
        if '..' in volume or '..' in library or '..' in mapname:
            return jsonify({'error': 'Invalid path components'}), 400
        
        # 파일 경로 구성
        file_path = os.path.join(VOLUME_ROOT, volume, library, mapname)
        
        if not os.path.exists(file_path):
            logger.warning(f"SMED file not found: {file_path}")
            return jsonify({'error': f'File not found: {volume}/{library}/{mapname}'}), 404
        
        # File hex analysis shows Japanese text is SJIS encoded (83 81 = メ, etc.)
        try:
            logger.info(f"SMED File DEBUG: Reading file with SJIS encoding: {file_path}")
            print(f"CONSOLE DEBUG: Using SJIS encoding for: {file_path}", flush=True)
            
            # Use SJIS encoding (hex analysis shows 83 81 83 43 83 93... = メインン...)
            with open(file_path, 'r', encoding='shift_jis', errors='replace') as f:
                content = f.read()
            
            logger.info(f"SMED File DEBUG: SJIS read completed, length: {len(content)}")
            
            # Verify if we got proper Japanese characters
            if 'OpenASP' in content:
                title2_line = next((line for line in content.split('\n') if 'TITLE2' in line and 'OpenASP' in line), None)
                if title2_line:
                    openasp_pos = title2_line.find('OpenASP')
                    if openasp_pos >= 0:
                        japanese_part = title2_line[openasp_pos+8:openasp_pos+18].strip()
                        unicode_points = [ord(c) for c in japanese_part[:5]]  # First 5 chars
                        logger.info(f"SMED File DEBUG: Japanese part Unicode: {unicode_points}")
                        
                        # Check if we got proper Japanese characters (Katakana range: 12448-12543)
                        if any(12448 <= point <= 12543 for point in unicode_points):
                            logger.info("SMED File DEBUG: Proper Japanese characters detected with SJIS")
                        else:
                            logger.warning(f"SMED File DEBUG: Check Unicode range: {unicode_points}")
            
        except Exception as fallback_e:
            logger.warning(f"SJIS read failed, trying UTF-8 fallback: {fallback_e}")
            # Fallback to UTF-8
            try:
                with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
                    content = f.read()
            except Exception:
                # Last resort - read as binary and decode with smart conversion
                with open(file_path, 'rb') as f:
                    raw_content = f.read()
                # API response destination - conversion may be needed for web UI
                content = convert_sjis_to_unicode(raw_content, destination='api')
        
        logger.info(f"Successfully loaded SMED content from {volume}/{library}/{mapname}")
        
        # DEBUG: Check final content before returning
        logger.info(f"FINAL RESPONSE DEBUG: Content length: {len(content)}")
        content_sample = content[content.find('OpenASP'):content.find('OpenASP')+20] if 'OpenASP' in content else 'OpenASP not found'
        logger.info(f"FINAL RESPONSE DEBUG: Content sample: {repr(content_sample)}")
        logger.info(f"FINAL RESPONSE DEBUG: Content sample UTF-8 bytes: {content_sample.encode('utf-8').hex()}")
        print(f"CONSOLE DEBUG: Final response content type: {type(content)}, length: {len(content)}", flush=True)
        
        return content, 200, {'Content-Type': 'text/plain; charset=utf-8'}
        
    except Exception as e:
        logger.error(f"볼륨 SMED파일 내용 취득 에러: {e}")
        return jsonify({'error': str(e)}), 500

# ============================================================================
# ENTERPRISE TERMINAL SESSION API v1.0 - STANDARD REST ENDPOINTS
# ============================================================================

def format_session_for_api(session_data):
    """Format session data for API response in standard format"""
    if not session_data:
        return None
        
    # Convert to standard API format
    formatted_session = {
        'wsname': session_data.get('wsname', ''),
        'username': session_data.get('user_id', ''),
        'conn_time': session_data.get('login_time', '').replace('T', '-').replace('Z', '').split('.')[0] if session_data.get('login_time') else '',
        'status': '1' if session_data.get('status') == 'ON' else '0'
    }
    
    # Format conn_time to yyyy/mm/dd-hh:mm:ss if needed
    if formatted_session['conn_time']:
        try:
            dt = datetime.fromisoformat(session_data.get('login_time', '').replace('Z', '+00:00'))
            formatted_session['conn_time'] = dt.strftime('%Y/%m/%d-%H:%M:%S')
        except:
            pass
    
    return formatted_session

@app.route('/api/v1/sessions', methods=['GET'])
def get_sessions_v1():
    """List all terminal sessions - Standard REST API v1.0"""
    try:
        # Get query parameters
        status_filter = request.args.get('status')  # '0' or '1'
        username_filter = request.args.get('username')
        
        # Get all sessions from session manager
        all_sessions = workstation_session_manager.list_all_sessions()
        
        # Format sessions for API response
        formatted_sessions = []
        for session in all_sessions:
            formatted = format_session_for_api(session)
            if formatted:
                # Apply filters
                if status_filter and formatted['status'] != status_filter:
                    continue
                if username_filter and formatted['username'] != username_filter:
                    continue
                formatted_sessions.append(formatted)
        
        logger.info(f"API v1: Listed {len(formatted_sessions)} sessions (filtered from {len(all_sessions)})")
        return jsonify(formatted_sessions), 200
        
    except Exception as e:
        logger.error(f"API v1 sessions list error: {e}")
        return jsonify({
            'error': 'internal_server_error',
            'message': f'Failed to retrieve sessions: {str(e)}'
        }), 500

@app.route('/api/v1/sessions', methods=['POST'])
def create_session_v1():
    """Create new terminal session - Standard REST API v1.0"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({
                'error': 'invalid_request',
                'message': 'JSON body required'
            }), 400
        
        wsname = data.get('wsname', '').strip().upper()
        username = data.get('username', '').strip()
        
        # Validate required fields
        if not wsname or not username:
            return jsonify({
                'error': 'validation_error',
                'message': 'wsname and username are required'
            }), 400
        
        # Validate wsname format (max 8 chars, alphanumeric)
        if len(wsname) > 8 or not wsname.isalnum():
            return jsonify({
                'error': 'validation_error',
                'message': 'wsname must be alphanumeric and max 8 characters'
            }), 400
        
        # Check if session already exists
        existing_session = workstation_session_manager.get_session_by_workstation(wsname)
        if existing_session:
            return jsonify({
                'error': 'conflict',
                'message': f'Session with wsname {wsname} already exists'
            }), 409
        
        # Create new session
        session_id = workstation_session_manager.create_session(
            wsname=wsname,
            user_id=username,
            terminal_id=wsname,
            display_mode='legacy',
            encoding='sjis'
        )
        
        # Get created session for response
        created_session = workstation_session_manager.get_session(session_id)
        formatted_session = format_session_for_api(created_session)
        
        logger.info(f"API v1: Created session {wsname} for user {username}")
        return jsonify(formatted_session), 201
        
    except Exception as e:
        logger.error(f"API v1 session creation error: {e}")
        return jsonify({
            'error': 'internal_server_error',
            'message': f'Failed to create session: {str(e)}'
        }), 500

@app.route('/api/v1/sessions/<wsname>', methods=['GET'])
def get_session_v1(wsname):
    """Get specific terminal session - Standard REST API v1.0"""
    try:
        wsname = wsname.strip().upper()
        
        # Get session by workstation name
        session = workstation_session_manager.get_session_by_workstation(wsname)
        if not session:
            return jsonify({
                'error': 'not_found',
                'message': f'Session with wsname {wsname} not found'
            }), 404
        
        formatted_session = format_session_for_api(session)
        logger.info(f"API v1: Retrieved session {wsname}")
        return jsonify(formatted_session), 200
        
    except Exception as e:
        logger.error(f"API v1 session retrieval error: {e}")
        return jsonify({
            'error': 'internal_server_error',
            'message': f'Failed to retrieve session: {str(e)}'
        }), 500

@app.route('/api/v1/sessions/<wsname>', methods=['PATCH'])
def update_session_v1(wsname):
    """Update session status - Standard REST API v1.0"""
    try:
        wsname = wsname.strip().upper()
        data = request.get_json()
        
        if not data or 'status' not in data:
            return jsonify({
                'error': 'validation_error',
                'message': 'status field is required'
            }), 400
        
        new_status = data.get('status')
        if new_status not in ['0', '1']:
            return jsonify({
                'error': 'validation_error',
                'message': 'status must be "0" (logoff) or "1" (logon)'
            }), 400
        
        # Get existing session
        session = workstation_session_manager.get_session_by_workstation(wsname)
        if not session:
            return jsonify({
                'error': 'not_found',
                'message': f'Session with wsname {wsname} not found'
            }), 404
        
        # Update session status
        session_id = session['session_id']
        updated_status = 'ON' if new_status == '1' else 'OFF'
        
        success = workstation_session_manager.update_session(session_id, {
            'status': updated_status
        })
        
        if not success:
            return jsonify({
                'error': 'internal_server_error',
                'message': 'Failed to update session status'
            }), 500
        
        # Get updated session for response
        updated_session = workstation_session_manager.get_session(session_id)
        formatted_session = format_session_for_api(updated_session)
        
        logger.info(f"API v1: Updated session {wsname} status to {new_status}")
        return jsonify(formatted_session), 200
        
    except Exception as e:
        logger.error(f"API v1 session update error: {e}")
        return jsonify({
            'error': 'internal_server_error',
            'message': f'Failed to update session: {str(e)}'
        }), 500

@app.route('/api/v1/sessions/<wsname>', methods=['DELETE'])
def delete_session_v1(wsname):
    """Delete terminal session - Standard REST API v1.0"""
    try:
        wsname = wsname.strip().upper()
        
        # Check if session exists
        session = workstation_session_manager.get_session_by_workstation(wsname)
        if not session:
            return jsonify({
                'error': 'not_found',
                'message': f'Session with wsname {wsname} not found'
            }), 404
        
        # Delete session
        success = workstation_session_manager.logout_session(wsname=wsname)
        if not success:
            return jsonify({
                'error': 'internal_server_error',
                'message': 'Failed to delete session'
            }), 500
        
        logger.info(f"API v1: Deleted session {wsname}")
        return '', 204
        
    except Exception as e:
        logger.error(f"API v1 session deletion error: {e}")
        return jsonify({
            'error': 'internal_server_error',
            'message': f'Failed to delete session: {str(e)}'
        }), 500

@app.route('/api/v1/sessions/<wsname>/logon', methods=['POST'])
def logon_session_v1(wsname):
    """Logon to session - Standard REST API v1.0"""
    try:
        wsname = wsname.strip().upper()
        data = request.get_json()
        
        if not data or 'username' not in data:
            return jsonify({
                'error': 'validation_error',
                'message': 'username field is required'
            }), 400
        
        username = data.get('username', '').strip()
        if not username:
            return jsonify({
                'error': 'validation_error',
                'message': 'username cannot be empty'
            }), 400
        
        # Check if session exists, create if not
        session = workstation_session_manager.get_session_by_workstation(wsname)
        
        if not session:
            # Create new session
            session_id = workstation_session_manager.create_session(
                wsname=wsname,
                user_id=username,
                terminal_id=wsname,
                display_mode='legacy',
                encoding='sjis'
            )
            session = workstation_session_manager.get_session(session_id)
        else:
            # Update existing session to logon status
            session_id = session['session_id']
            workstation_session_manager.update_session(session_id, {
                'status': 'ON',
                'user_id': username  # Update username if needed
            })
            session = workstation_session_manager.get_session(session_id)
        
        formatted_session = format_session_for_api(session)
        logger.info(f"API v1: Logon successful for {wsname} (user: {username})")
        return jsonify(formatted_session), 200
        
    except Exception as e:
        logger.error(f"API v1 session logon error: {e}")
        return jsonify({
            'error': 'internal_server_error',
            'message': f'Failed to logon session: {str(e)}'
        }), 500

@app.route('/api/v1/sessions/<wsname>/logoff', methods=['POST'])
def logoff_session_v1(wsname):
    """Logoff from session - Standard REST API v1.0"""
    try:
        wsname = wsname.strip().upper()
        
        # Check if session exists
        session = workstation_session_manager.get_session_by_workstation(wsname)
        if not session:
            return jsonify({
                'error': 'not_found',
                'message': f'Session with wsname {wsname} not found'
            }), 404
        
        # Update session to logoff status
        session_id = session['session_id']
        success = workstation_session_manager.update_session(session_id, {
            'status': 'OFF'
        })
        
        if not success:
            return jsonify({
                'error': 'internal_server_error',
                'message': 'Failed to logoff session'
            }), 500
        
        # Get updated session for response
        updated_session = workstation_session_manager.get_session(session_id)
        formatted_session = format_session_for_api(updated_session)
        
        logger.info(f"API v1: Logoff successful for {wsname}")
        return jsonify(formatted_session), 200
        
    except Exception as e:
        logger.error(f"API v1 session logoff error: {e}")
        return jsonify({
            'error': 'internal_server_error',
            'message': f'Failed to logoff session: {str(e)}'
        }), 500

@app.route('/api/v1/sessions/bulk-disconnect', methods=['POST'])
def bulk_disconnect_sessions_v1():
    """Bulk disconnect multiple workstation sessions - Standard REST API v1.0"""
    try:
        data = request.get_json()
        if not data or 'workstations' not in data:
            return jsonify({
                'error': 'bad_request',
                'message': 'Missing workstations array in request body'
            }), 400
            
        workstations = data['workstations']
        if not isinstance(workstations, list):
            return jsonify({
                'error': 'bad_request',
                'message': 'workstations must be an array'
            }), 400
        
        success_list = []
        failed_list = []
        
        for wsname in workstations:
            try:
                wsname = str(wsname).strip().upper()
                
                # Check if session exists
                session = workstation_session_manager.get_session_by_workstation(wsname)
                if not session:
                    failed_list.append({
                        'wsname': wsname,
                        'error': 'Session not found'
                    })
                    continue
                
                # Update session to logoff status (workstation session manager)
                session_id = session['session_id']
                ws_success = workstation_session_manager.update_session(session_id, {
                    'status': 'OFF'
                })
                
                # Update PostgreSQL session if available
                if POSTGRESQL_SESSION_AVAILABLE:
                    try:
                        postgresql_session_manager.set_session_status(wsname, '0')  # 0 = OFF
                    except Exception as e:
                        logger.warning(f"Failed to update PostgreSQL session for {wsname}: {e}")
                
                # Force disconnect WebSocket if exists
                try:
                    # Find and disconnect WebSocket session
                    for sid, ws_session in websocket_sessions.items():
                        if ws_session.get('wsname') == wsname:
                            socketio.disconnect(sid)
                            logger.info(f"[BULK_DISCONNECT] Force disconnected WebSocket for {wsname}")
                            break
                except Exception as e:
                    logger.warning(f"Failed to disconnect WebSocket for {wsname}: {e}")
                
                if ws_success:
                    success_list.append(wsname)
                    logger.info(f"[BULK_DISCONNECT] Successfully disconnected {wsname}")
                else:
                    failed_list.append({
                        'wsname': wsname,
                        'error': 'Failed to update session status'
                    })
                    
            except Exception as e:
                failed_list.append({
                    'wsname': wsname,
                    'error': str(e)
                })
                logger.error(f"[BULK_DISCONNECT] Error disconnecting {wsname}: {e}")
        
        response = {
            'success': success_list,
            'failed': failed_list,
            'total_processed': len(workstations),
            'success_count': len(success_list),
            'failed_count': len(failed_list)
        }
        
        logger.info(f"[BULK_DISCONNECT] Processed {len(workstations)} workstations: {len(success_list)} success, {len(failed_list)} failed")
        return jsonify(response), 200
        
    except Exception as e:
        logger.error(f"API v1 bulk disconnect error: {e}")
        return jsonify({
            'error': 'internal_server_error',
            'message': f'Failed to bulk disconnect sessions: {str(e)}'
        }), 500

# ============================================================================

@app.route('/api/system/info', methods=['GET'])
def get_system_info():
    """システム情報取得"""
    try:
        # CPU情報
        cpu_percent = psutil.cpu_percent(interval=1)
        cpu_count = psutil.cpu_count()
        cpu_freq = psutil.cpu_freq()
        
        # メモリ情報
        memory = psutil.virtual_memory()
        
        # ディスク情報
        disk = psutil.disk_usage('/')
        
        # システム稼働時間
        boot_time = psutil.boot_time()
        uptime_seconds = time.time() - boot_time
        uptime_hours = int(uptime_seconds // 3600)
        uptime_minutes = int((uptime_seconds % 3600) // 60)
        
        return jsonify({
            'success': True,
            'cpu': {
                'usage_percent': round(cpu_percent, 1),
                'core_count': cpu_count,
                'frequency': {
                    'current': round(cpu_freq.current, 1) if cpu_freq else 0,
                    'max': round(cpu_freq.max, 1) if cpu_freq else 0
                }
            },
            'memory': {
                'total': memory.total,
                'available': memory.available,
                'used': memory.used,
                'percent': round(memory.percent, 1),
                'total_gb': round(memory.total / (1024**3), 1),
                'used_gb': round(memory.used / (1024**3), 1),
                'available_gb': round(memory.available / (1024**3), 1)
            },
            'disk': {
                'total': disk.total,
                'used': disk.used,
                'free': disk.free,
                'percent': round((disk.used / disk.total) * 100, 1),
                'total_gb': round(disk.total / (1024**3), 1),
                'used_gb': round(disk.used / (1024**3), 1),
                'free_gb': round(disk.free / (1024**3), 1)
            },
            'uptime': {
                'hours': uptime_hours,
                'minutes': uptime_minutes,
                'formatted': f"{uptime_hours}時間 {uptime_minutes}分"
            }
        })
    except Exception as e:
        logger.error(f"システム情報取得エラー: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/multi_executor/status', methods=['GET'])
def multi_executor_status():
    """Multi-Type Executor ??"""
    if not multi_executor:
        return jsonify({'error': 'Multi-Type Executor not initialized'}), 500
    
    return jsonify({
        'java_available': multi_executor.java_available,
        'jar_path': multi_executor.jar_path,
        'jar_exists': os.path.exists(multi_executor.jar_path) if multi_executor.jar_path else False,
        'cobol_libs_loaded': len(multi_executor.cobol_libs),
        'supported_types': ['JAVA', 'COBOL', 'SHELL']
    })

@app.route('/api/logs', methods=['GET'])
def get_logs():
    """Get execution logs"""
    try:
        logs_list = list(execution_logs)
        return jsonify({
            'success': True,
            'logs': logs_list,
            'count': len(logs_list)
        })
    except Exception as e:
        logger.error(f"Failed to get logs: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/logs', methods=['POST'])
def add_log_entry():
    """Add a new log entry"""
    try:
        data = request.get_json()
        log_entry = {
            'id': str(uuid.uuid4()),
            'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'level': data.get('level', 'INFO'),
            'source': data.get('service', 'UNKNOWN'),
            'message': data.get('message', ''),
            'details': data.get('details', {})
        }
        execution_logs.append(log_entry)
        logger.info(f"[{log_entry['level']}] {log_entry['source']}: {log_entry['message']}")
        return jsonify({
            'success': True,
            'message': 'Log entry added successfully',
            'log_id': log_entry['id']
        })
    except Exception as e:
        logger.error(f"Failed to add log entry: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/logs', methods=['DELETE'])
def clear_logs():
    """Clear execution logs"""
    try:
        execution_logs.clear()
        return jsonify({
            'success': True,
            'message': 'Logs cleared successfully'
        })
    except Exception as e:
        logger.error(f"Failed to clear logs: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/terminals', methods=['GET'])
def get_active_terminals():
    """Get list of active terminals with detailed status"""
    try:
        terminals = []
        for session_id, terminal_info in active_terminals.items():
            terminals.append({
                'session_id': session_id,
                'terminal_id': terminal_info.get('terminal_id'),
                'user': terminal_info.get('user'),
                'workstation': terminal_info.get('workstation'),
                'room': terminal_info.get('room'),
                'connected_at': terminal_info.get('connected_at'),
                'registration_data': terminal_info.get('registration_data')
            })
        
        return jsonify({
            'success': True,
            'terminals': terminals,
            'terminal_mappings': terminal_to_session,
            'active_sessions': list(active_terminals.keys()),
            'registered_terminal_ids': list(terminal_to_session.keys()),
            'count': len(terminals),
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        logger.error(f"Failed to get active terminals: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/terminals/status/<terminal_id>', methods=['GET'])
def get_terminal_status(terminal_id):
    """Get status of a specific terminal"""
    try:
        status_info = {
            'terminal_id': terminal_id,
            'timestamp': datetime.now().isoformat(),
            'connected': False,
            'session_id': None,
            'terminal_info': None
        }
        
        if terminal_id in terminal_to_session:
            session_id = terminal_to_session[terminal_id]
            status_info['connected'] = True
            status_info['session_id'] = session_id
            
            if session_id in active_terminals:
                status_info['terminal_info'] = active_terminals[session_id]
        
        logger.info(f"[TERMINAL_STATUS] Status check for {terminal_id}: {status_info}")
        
        return jsonify({
            'success': True,
            **status_info
        })
    except Exception as e:
        logger.error(f"Failed to get terminal status for {terminal_id}: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/terminals/test/<terminal_id>', methods=['POST'])
def test_terminal_connection(terminal_id):
    """Test sending data to a specific terminal"""
    try:
        test_data = {
            'map_file': 'TEST_CONNECTION',
            'fields': {
                'TEST_FIELD': 'Connection test message',
                'TIMESTAMP': datetime.now().isoformat(),
                'TERMINAL_ID': terminal_id
            },
            'action': 'display_map',
            'test': True
        }
        
        logger.info(f"[TERMINAL_TEST] Testing connection to terminal: {terminal_id}")
        
        success = send_smed_to_terminal(terminal_id, 'TEST_CONNECTION', test_data['fields'])
        
        return jsonify({
            'success': True,
            'terminal_id': terminal_id,
            'test_sent': success,
            'test_data': test_data,
            'timestamp': datetime.now().isoformat(),
            'message': f'Test message {"sent successfully" if success else "failed to send"} to terminal {terminal_id}'
        })
        
    except Exception as e:
        logger.error(f"Failed to test terminal connection for {terminal_id}: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/smed/parse', methods=['POST'])
def parse_smed_map():
    """Parse SMED map file and return grid layout for web rendering"""
    try:
        data = request.get_json()
        map_file = data.get('map_file')
        
        if not map_file:
            return jsonify({'error': 'map_file parameter required'}), 400
        
        # Parse map file path
        if '/' in map_file:
            lib_name, map_name = map_file.split('/', 1)
        else:
            lib_name = 'TESTLIB'  # Default library
            map_name = map_file
        
        # Try to find SMED file with or without extension
        map_path = None
        base_path = os.path.join(VOLUME_ROOT, 'DISK01', lib_name)
        
        # First try with original name (may already have .smed extension)
        potential_path = os.path.join(base_path, map_name)
        if os.path.exists(potential_path):
            map_path = potential_path
        else:
            # Try without extension first (user preference)
            potential_path_no_ext = os.path.join(base_path, map_name)
            if os.path.exists(potential_path_no_ext):
                map_path = potential_path_no_ext
            # If not found, try adding .smed extension
            elif not map_name.endswith('.smed'):
                potential_path_with_ext = os.path.join(base_path, map_name + '.smed')
                if os.path.exists(potential_path_with_ext):
                    map_path = potential_path_with_ext
        
        if not map_path:
            return jsonify({'error': f'Map file not found. Tried: {base_path}/{map_name} and {base_path}/{map_name}.smed'}), 404
        
        # Parse SMED file - handle corrupted SJIS gracefully
        try:
            # Try SJIS first with error handling (standard for Japanese SMED files)
            with open(map_path, 'r', encoding='shift_jis', errors='replace') as f:
                smed_content = f.read()
        except Exception:
            # Fallback to UTF-8 with error handling
            try:
                with open(map_path, 'r', encoding='utf-8', errors='replace') as f:
                    smed_content = f.read()
            except Exception:
                # Last resort - read as binary and decode manually
                with open(map_path, 'rb') as f:
                    raw_bytes = f.read()
                smed_content = raw_bytes.decode('utf-8', errors='replace')
        
        # Fix common corrupted Japanese text patterns
        smed_content = fix_corrupted_japanese_text(smed_content)
        
        # Initialize 24x80 grid
        grid = [[' ' for _ in range(80)] for _ in range(24)]
        fields = []
        
        # Parse SMED content line by line
        lines = smed_content.strip().split('\n')
        map_name_parsed = None
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
                
            if line.startswith('MAPNAME'):
                map_name_parsed = line.split()[1] if len(line.split()) > 1 else 'UNKNOWN'
            elif line.startswith('ITEM'):
                # Parse ITEM definition
                parts = line.split()
                if len(parts) < 2:
                    continue
                    
                field_name = parts[1]
                field_info = {
                    'name': field_name,
                    'type': 'output',  # Default
                    'row': 0,
                    'col': 0,
                    'length': 0,
                    'value': '',
                    'color': '#FFFFFF',
                    'prompt': ''
                }
                
                # Parse attributes
                for i, part in enumerate(parts[2:]):
                    if part.startswith('TYPE='):
                        field_info['type'] = 'output' if part.split('=')[1] == 'T' else 'input'
                    elif part.startswith('POS='):
                        pos_str = part.split('=')[1]
                        if pos_str.startswith('(') and ')' in pos_str:
                            row, col = pos_str.strip('()').split(',')
                            field_info['row'] = int(row) - 1  # Convert to 0-based
                            field_info['col'] = int(col) - 1
                    elif part.startswith('LEN='):
                        field_info['length'] = int(part.split('=')[1])
                    elif part.startswith('COLOR='):
                        field_info['color'] = part.split('=')[1]
                    elif part.startswith('PROMPT='):
                        # Handle quoted prompt text
                        prompt_start = line.find('PROMPT="') + 8
                        prompt_end = line.find('"', prompt_start)
                        if prompt_start > 7 and prompt_end > prompt_start:
                            field_info['prompt'] = line[prompt_start:prompt_end]
                            field_info['value'] = field_info['prompt']
                
                # If PROMPT exists, it's output mode; if not, it's input mode
                if field_info['prompt']:
                    field_info['type'] = 'output'
                    # Place prompt text on grid
                    text = field_info['prompt']
                    row = field_info['row']
                    col = field_info['col']
                    for j, char in enumerate(text):
                        if col + j < 80 and row < 24:
                            grid[row][col + j] = char
                else:
                    field_info['type'] = 'input'
                    # Set default length if not specified
                    if field_info['length'] == 0:
                        field_info['length'] = 10
                
                fields.append(field_info)
        
        # Convert grid to string representation for easy rendering
        grid_lines = [''.join(row) for row in grid]
        
        return jsonify({
            'success': True,
            'map_name': map_name_parsed,
            'grid': grid_lines,
            'fields': fields,
            'rows': 24,
            'cols': 80
        })
        
    except Exception as e:
        logger.error(f"Failed to parse SMED map: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

# DEPRECATED: /api/smed/populate endpoint disabled in favor of WebSocket Hub
# All SMED data should now flow through WebSocket channels only
# This removes the HTTP/WebSocket duplication issue

# @app.route('/api/smed/populate', methods=['POST'])
# def populate_smed_fields():
#     """DEPRECATED: Use WebSocket Hub for SMED data population"""
#     return jsonify({
#         'error': 'This endpoint has been deprecated. Use WebSocket Hub for SMED data.',
#         'websocket_endpoint': '/socket.io/',
#         'migration_info': 'Send smed_data_direct event instead of HTTP POST'
#     }), 410

# DEPRECATED: All SMED HTTP APIs replaced with WebSocket Hub
# @app.route('/api/smed/key-event', methods=['POST'])
# def handle_smed_key_event():
#     """DEPRECATED: Handle SMED key event from web interface - Use WebSocket Hub instead"""
#     return jsonify({
#         'error': 'This endpoint has been deprecated. Use WebSocket Hub for SMED key events.',
#         'websocket_endpoint': '/socket.io/',
#         'migration_info': 'Use hub_key_event WebSocket event instead of HTTP POST'
#     }), 410

# ======================================================================
# NEW POSITION-BASED SMED RENDERING API
# ======================================================================

def validate_position_map(position_map):
    """Validate position-based map structure"""
    if not isinstance(position_map, list):
        return False, "Map must be a list of position objects"
    
    for i, item in enumerate(position_map):
        if not isinstance(item, dict):
            return False, f"Map item {i} must be an object"
        
        required_fields = ['row', 'col', 'length']
        for field in required_fields:
            if field not in item:
                return False, f"Map item {i} missing required field: {field}"
            if not isinstance(item[field], int):
                return False, f"Map item {i} field '{field}' must be an integer"
        
        # Validate grid boundaries (24x80)
        if not (0 <= item['row'] <= 23):
            return False, f"Map item {i} row must be between 0-23, got {item['row']}"
        if not (0 <= item['col'] <= 79):
            return False, f"Map item {i} col must be between 0-79, got {item['col']}"
        if item['length'] <= 0:
            return False, f"Map item {i} length must be positive, got {item['length']}"
        
        # Check if field fits within grid
        if item['col'] + item['length'] > 80:
            return False, f"Map item {i} extends beyond grid width (col {item['col']} + length {item['length']} > 80)"
    
    return True, "Valid"

def validate_position_data(data_array, position_map):
    """Validate position-based data array"""
    if not isinstance(data_array, list):
        return False, "Data must be a list of strings"
    
    if len(data_array) != len(position_map):
        return False, f"Data array length ({len(data_array)}) must match map length ({len(position_map)})"
    
    for i, (data_item, map_item) in enumerate(zip(data_array, position_map)):
        if not isinstance(data_item, str):
            return False, f"Data item {i} must be a string, got {type(data_item).__name__}"
        
        if len(data_item) > map_item['length']:
            return False, f"Data item {i} length ({len(data_item)}) exceeds map length ({map_item['length']})"
    
    return True, "Valid"

def render_position_grid(position_map, data_array):
    """Render position-based data to 24x80 grid"""
    # Initialize empty grid
    grid = [[' ' for _ in range(80)] for _ in range(24)]
    rendered_fields = []
    
    for i, (map_item, data_item) in enumerate(zip(position_map, data_array)):
        row = map_item['row']
        col = map_item['col']
        length = map_item['length']
        
        # Pad or truncate data to fit length
        padded_data = data_item.ljust(length)[:length]
        
        # Place data on grid
        for j, char in enumerate(padded_data):
            if col + j < 80:
                grid[row][col + j] = char
        
        rendered_fields.append({
            'index': i,
            'row': row,
            'col': col,
            'length': length,
            'value': data_item,
            'rendered_value': padded_data
        })
    
    # Convert grid to string lines
    grid_lines = [''.join(row) for row in grid]
    
    return {
        'grid': grid_lines,
        'fields': rendered_fields,
        'rows': 24,
        'cols': 80
    }

# Position-based map storage (in-memory for demo)
position_maps = {}

@app.route('/api/smed/position-render/<map_name>', methods=['GET'])
def get_position_render_map(map_name):
    """Get position-based map definition"""
    try:
        if map_name not in position_maps:
            return jsonify({'error': f'Position map not found: {map_name}'}), 404
        
        map_data = position_maps[map_name]
        return jsonify({
            'success': True,
            'map_name': map_name,
            'map': map_data['map'],
            'created_at': map_data.get('created_at'),
            'updated_at': map_data.get('updated_at')
        })
    
    except Exception as e:
        logger.error(f"Failed to get position render map {map_name}: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/smed/position-render/<map_name>', methods=['PUT'])
def create_or_update_position_render_map(map_name):
    """Create or update position-based map definition"""
    try:
        data = request.get_json()
        if not data or 'map' not in data:
            return jsonify({'error': 'Request body must contain map definition'}), 400
        
        position_map = data['map']
        
        # Validate position map
        is_valid, error_msg = validate_position_map(position_map)
        if not is_valid:
            return jsonify({'error': error_msg}), 400
        
        # Store map definition
        timestamp = datetime.now().isoformat()
        map_exists = map_name in position_maps
        
        position_maps[map_name] = {
            'map': position_map,
            'created_at': position_maps[map_name]['created_at'] if map_exists else timestamp,
            'updated_at': timestamp
        }
        
        logger.info(f"Position map {'updated' if map_exists else 'created'}: {map_name}")
        
        return jsonify({
            'success': True,
            'message': f'Position map {map_name} {"updated" if map_exists else "created"} successfully',
            'map_name': map_name,
            'fields_count': len(position_map)
        })
    
    except Exception as e:
        logger.error(f"Failed to create/update position render map {map_name}: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/smed/position-render/<map_name>/data', methods=['POST'])
def render_position_data(map_name):
    """Render data using position-based map"""
    try:
        # Get map definition
        if map_name not in position_maps:
            return jsonify({'error': f'Position map not found: {map_name}'}), 404
        
        position_map = position_maps[map_name]['map']
        
        # Get data from request
        data = request.get_json()
        if not data or 'data' not in data:
            return jsonify({'error': 'Request body must contain data array'}), 400
        
        data_array = data['data']
        
        # Validate data
        is_valid, error_msg = validate_position_data(data_array, position_map)
        if not is_valid:
            return jsonify({'error': error_msg}), 400
        
        # Render to grid
        rendered = render_position_grid(position_map, data_array)
        
        logger.info(f"Position data rendered for map {map_name}: {len(data_array)} fields")
        
        return jsonify({
            'success': True,
            'map_name': map_name,
            **rendered
        })
    
    except Exception as e:
        logger.error(f"Failed to render position data for map {map_name}: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/smed/position-render/<map_name>/data', methods=['PUT'])
def update_position_data(map_name):
    """Update data using position-based map and broadcast via WebSocket"""
    try:
        # Get map definition
        if map_name not in position_maps:
            return jsonify({'error': f'Position map not found: {map_name}'}), 404
        
        position_map = position_maps[map_name]['map']
        
        # Get data from request
        data = request.get_json()
        if not data or 'data' not in data:
            return jsonify({'error': 'Request body must contain data array'}), 400
        
        data_array = data['data']
        terminal_id = data.get('terminal_id', 'webui')
        
        # Validate data
        is_valid, error_msg = validate_position_data(data_array, position_map)
        if not is_valid:
            return jsonify({'error': error_msg}), 400
        
        # Render to grid
        rendered = render_position_grid(position_map, data_array)
        
        # Broadcast update via WebSocket
        update_message = {
            'type': 'position_render_update',
            'map_name': map_name,
            'terminal_id': terminal_id,
            'timestamp': datetime.now().isoformat(),
            **rendered
        }
        
        socketio.emit('position_render_update', update_message, broadcast=True)
        
        logger.info(f"Position data updated and broadcasted for map {map_name}: {len(data_array)} fields")
        
        return jsonify({
            'success': True,
            'message': 'Data updated and broadcasted',
            'map_name': map_name,
            **rendered
        })
    
    except Exception as e:
        logger.error(f"Failed to update position data for map {map_name}: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/smed/position-render', methods=['GET'])
def list_position_render_maps():
    """List all position-based maps"""
    try:
        maps_info = []
        for map_name, map_data in position_maps.items():
            maps_info.append({
                'name': map_name,
                'fields_count': len(map_data['map']),
                'created_at': map_data.get('created_at'),
                'updated_at': map_data.get('updated_at')
            })
        
        return jsonify({
            'success': True,
            'maps': maps_info,
            'total_count': len(maps_info)
        })
    
    except Exception as e:
        logger.error(f"Failed to list position render maps: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/smed/position-render/<map_name>', methods=['DELETE'])
def delete_position_render_map(map_name):
    """Delete position-based map"""
    try:
        if map_name not in position_maps:
            return jsonify({'error': f'Position map not found: {map_name}'}), 404
        
        del position_maps[map_name]
        
        logger.info(f"Position map deleted: {map_name}")
        
        return jsonify({
            'success': True,
            'message': f'Position map {map_name} deleted successfully'
        })
    
    except Exception as e:
        logger.error(f"Failed to delete position render map {map_name}: {e}")
        return jsonify({'error': str(e)}), 500

# WebSocket events for position-based rendering
@socketio.on('position_render_subscribe')
def handle_position_render_subscribe(data):
    """Subscribe to position render updates for specific map"""
    session_id = request.sid
    map_name = data.get('map_name')
    terminal_id = data.get('terminal_id', 'webui')
    
    if not map_name:
        emit('position_render_error', {'error': 'map_name required'})
        return
    
    # Join room for this map
    room_name = f'position_render_{map_name}'
    join_room(room_name)
    
    logger.info(f"Client {session_id} subscribed to position render updates for map: {map_name}")
    
    emit('position_render_subscribed', {
        'map_name': map_name,
        'terminal_id': terminal_id,
        'room': room_name
    })

@socketio.on('position_render_unsubscribe')
def handle_position_render_unsubscribe(data):
    """Unsubscribe from position render updates"""
    session_id = request.sid
    map_name = data.get('map_name')
    
    if not map_name:
        emit('position_render_error', {'error': 'map_name required'})
        return
    
    # Leave room for this map
    room_name = f'position_render_{map_name}'
    leave_room(room_name)
    
    logger.info(f"Client {session_id} unsubscribed from position render updates for map: {map_name}")
    
    emit('position_render_unsubscribed', {
        'map_name': map_name,
        'room': room_name
    })

@socketio.on('hub_command')
def handle_hub_command(data):
    """Handle command execution via WebSocket Hub using cmdRunner"""
    session_id = request.sid
    command = data.get('command', '')
    terminal_id = data.get('terminal_id', 'webui')
    user = data.get('user', 'admin')
    
    print(f"[DEBUG] hub_command received! Session: {session_id}, Command: {command}")
    logger.info(f"[WEBSOCKET_HUB] Command received: {command} from terminal: {terminal_id}")
    
    try:
        # Route through cmdRunner for proper process management
        # Generate session info for cmdRunner
        websocket_session_id = f"websocket_{session_id}"
        websocket_terminal_id = terminal_id
        
        # Execute command via cmdRunner (reuse execute_with_cmdrunner function)
        result = execute_with_cmdrunner(command, websocket_session_id, websocket_terminal_id, user)
        
        success = result.get('success', False)
        output = result.get('output', '')
        error = result.get('error', '')
        
        # Send confirmation
        emit('command_confirmation', {
            'success': success,
            'command': command,
            'terminal_id': terminal_id,
            'session_id': session_id,
            'timestamp': datetime.now().isoformat(),
            'message': f'Command {"executed successfully" if success else "failed"}',
            'output': output,
            'error': error
        })
        
        add_log('INFO', 'WEBSOCKET_HUB', f'Command executed: {command}', {
            'terminal_id': terminal_id,
            'success': success,
            'command': command
        })
        
    except Exception as e:
        logger.error(f"[WEBSOCKET_HUB] Command execution error: {e}")
        emit('command_error', {
            'error': str(e),
            'command': command,
            'terminal_id': terminal_id,
            'session_id': session_id,
            'timestamp': datetime.now().isoformat()
        })

@socketio.on('hub_key_event')
def handle_hub_key_event(data):
    """Handle SMED key event via WebSocket Hub (replaces HTTP API)"""
    session_id = request.sid
    
    logger.info(f"[HUB_KEY_EVENT] Key event received via Hub: {session_id}")
    logger.info(f"[HUB_KEY_EVENT] Event data: {data}")
    
    try:
        terminal_id = data.get('terminal_id', 'webui')
        user = data.get('user', 'unknown')
        wsname = data.get('wsname', 'WSNAME00')
        key = data.get('key', '')
        field_values = data.get('field_values', {})
        program_name = data.get('program_name', 'unknown')
        
        # Handle function keys based on program logic
        response = {
            'success': True,
            'action': None,
            'message': f'Key {key} processed via Hub',
            'terminal_id': terminal_id,
            'wsname': wsname
        }
        
        # Default function key behaviors for SMED
        if key == 'F3':
            response['action'] = 'close'
            response['message'] = 'Exit requested'
            logger.info(f"[HUB_KEY_EVENT] Program {program_name} requested exit via F3")
        elif key == 'F1':
            response['action'] = 'help'
            response['message'] = 'Help requested'
        elif key == 'F12':
            response['action'] = 'close'
            response['message'] = 'Cancel requested'
        elif key in ['F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11']:
            response['action'] = 'continue'
            response['message'] = f'Function key {key} handled by program'
        
        # Write input to file for Java programs waiting for input
        if terminal_id:
            input_file = f"/tmp/asp_input_{terminal_id}.txt"
            try:
                # For function keys (F1, F3, F7, F8), write the key itself
                if key and key.startswith('F') and len(key) >= 2:
                    input_value = key
                    logger.info(f"[HUB_KEY_EVENT] Function key detected: {key}")
                elif field_values:
                    # For regular input, get the first field value (typically EMP-FUNC for MAIN001)
                    input_value = next(iter(field_values.values()), '')
                    logger.info(f"[HUB_KEY_EVENT] Field value detected: {input_value}")
                else:
                    # Default fallback
                    input_value = key if key else ''
                    logger.info(f"[HUB_KEY_EVENT] Using key as fallback: {key}")
                
                with open(input_file, 'w') as f:
                    f.write(str(input_value))
                logger.info(f"[HUB_KEY_EVENT] Wrote input '{input_value}' to {input_file}")
            except Exception as e:
                logger.error(f"[HUB_KEY_EVENT] Failed to write input file: {e}")
        
        # Send response back to requesting terminal
        emit('hub_key_event_response', response)
        
        # Log the key event
        add_log('INFO', f'HUB_SMED/{program_name}', f'Key event: {key}', {
            'terminal_id': terminal_id,
            'user': user,
            'wsname': wsname,
            'key': key,
            'field_values': field_values,
            'action': response['action']
        })
        
        logger.info(f"[HUB_KEY_EVENT] Key event processed successfully: {key} -> {response['action']}")
        
    except Exception as e:
        logger.error(f"[HUB_KEY_EVENT] Failed to handle key event: {e}")
        emit('hub_key_event_error', {
            'error': str(e),
            'session_id': session_id
        })

@socketio.on('hub_menu_selection')
def handle_hub_menu_selection(data):
    """Handle menu selection event via WebSocket Hub (prevents new process creation)"""
    session_id = request.sid
    
    logger.info(f"[HUB_MENU_SELECTION] Menu selection received via Hub: {session_id}")
    logger.info(f"[HUB_MENU_SELECTION] Selection data: {data}")
    
    try:
        terminal_id = data.get('terminal_id', 'webui')
        user = data.get('user', 'unknown')
        wsname = data.get('wsname', 'WSNAME00')
        program_name = data.get('program_name', 'MAIN001')
        selection = data.get('selection', '')
        
        logger.info(f"[HUB_MENU_SELECTION] Processing menu selection: {selection} for program {program_name}")
        
        # Write selection to input file for Java program waiting for input
        if terminal_id and selection:
            input_file = f"/tmp/asp_input_{terminal_id}.txt"
            try:
                with open(input_file, 'w') as f:
                    f.write(str(selection))
                logger.info(f"[HUB_MENU_SELECTION] Wrote menu selection '{selection}' to {input_file}")
                
                # Send success confirmation
                response = {
                    'success': True,
                    'action': 'menu_selected',
                    'selection': selection,
                    'program_name': program_name,
                    'message': f'Menu selection {selection} processed for {program_name}',
                    'terminal_id': terminal_id,
                    'wsname': wsname
                }
                
                emit('hub_menu_selection_response', response)
                
                # Log the menu selection
                add_log('INFO', f'HUB_MENU/{program_name}', f'Menu selection: {selection}', {
                    'terminal_id': terminal_id,
                    'user': user,
                    'wsname': wsname,
                    'selection': selection,
                    'program_name': program_name
                })
                
                logger.info(f"[HUB_MENU_SELECTION] Menu selection processed successfully: {program_name} -> {selection}")
                
            except Exception as e:
                logger.error(f"[HUB_MENU_SELECTION] Failed to write input file: {e}")
                emit('hub_menu_selection_error', {
                    'error': f'Failed to write input file: {str(e)}',
                    'session_id': session_id
                })
        else:
            logger.warning(f"[HUB_MENU_SELECTION] Invalid selection data: terminal_id={terminal_id}, selection={selection}")
            emit('hub_menu_selection_error', {
                'error': 'Invalid terminal_id or selection',
                'session_id': session_id
            })
        
    except Exception as e:
        logger.error(f"[HUB_MENU_SELECTION] Failed to handle menu selection: {e}")
        emit('hub_menu_selection_error', {
            'error': str(e),
            'session_id': session_id
        })

# NEW POSITION-BASED SMED WEBSOCKET EVENTS
@socketio.on('position_smed_display')
def handle_position_smed_display(data):
    """Handle position-based SMED display data transmission"""
    session_id = request.sid
    
    logger.info(f"[POSITION_SMED_DISPLAY] Display event received from session: {session_id}")
    logger.info(f"[POSITION_SMED_DISPLAY] Data: {data}")
    
    try:
        # Extract required fields
        map_name = data.get('map_name')
        map_data = data.get('map_data', [])
        field_data = data.get('field_data', [])
        terminal_id = data.get('terminal_id', 'webui')
        encoding = data.get('encoding', 'utf-8')
        timestamp = data.get('timestamp', datetime.now().isoformat())
        
        if not map_name:
            handle_position_smed_error(session_id, 'position_smed_display', 'map_name is required', emit)
            return
        
        # Register/update session
        register_position_smed_session(session_id, map_name, terminal_id)
        
        # Process encoding conversion using integrated converter
        processed_field_data = field_data
        if encoding.lower() == 'sjis' and field_data:
            processed_field_data = position_smed_encoder.convert_field_data_array(
                field_data, from_encoding='sjis', to_encoding='utf-8'
            )
            logger.info(f"[POSITION_SMED_DISPLAY] Converted {len(field_data)} fields from SJIS to UTF-8")
        
        # Integrate with position-based API
        api_result = integrate_with_position_api(map_name, 'render', {
            'map_data': map_data,
            'field_data': processed_field_data,
            'terminal_id': terminal_id
        })
        
        # Prepare response data
        response_data = {
            'event_type': 'position_smed_display',
            'map_name': map_name,
            'map_data': map_data,
            'field_data': processed_field_data,
            'terminal_id': terminal_id,
            'encoding': 'utf-8',  # Always send as UTF-8
            'timestamp': timestamp,
            'session_id': session_id,
            'api_integrated': api_result is not None
        }
        
        # Broadcast to all clients subscribed to this map
        room_name = f'position_smed_{map_name}'
        emit('position_smed_display_received', response_data, room=room_name)
        
        # Also emit to the sender for confirmation
        emit('position_smed_display_confirmed', {
            'success': True,
            'map_name': map_name,
            'terminal_id': terminal_id,
            'timestamp': timestamp,
            'api_integrated': api_result is not None
        })
        
        # Update session activity
        update_position_smed_session_activity(session_id)
        
        # Log the display event
        add_log('INFO', f'POSITION_SMED/{map_name}', f'Display data transmitted', {
            'terminal_id': terminal_id,
            'map_name': map_name,
            'field_count': len(field_data),
            'encoding': encoding,
            'api_integrated': api_result is not None
        })
        
        logger.info(f"[POSITION_SMED_DISPLAY] Display data broadcast successfully for map: {map_name}")
        
    except Exception as e:
        handle_position_smed_error(session_id, 'position_smed_display', e, emit)

@socketio.on('position_smed_update')
def handle_position_smed_update(data):
    """Handle real-time position-based SMED data updates"""
    session_id = request.sid
    
    logger.info(f"[POSITION_SMED_UPDATE] Update event received from session: {session_id}")
    
    try:
        map_name = data.get('map_name')
        updates = data.get('updates', [])  # Array of {row, col, length, value}
        terminal_id = data.get('terminal_id', 'webui')
        encoding = data.get('encoding', 'utf-8')
        timestamp = data.get('timestamp', datetime.now().isoformat())
        
        if not map_name:
            emit('position_smed_error', {'error': 'map_name is required'})
            return
        
        if not updates:
            emit('position_smed_error', {'error': 'updates array is required'})
            return
        
        # Process each update with encoding conversion using integrated converter
        processed_updates = updates
        if encoding.lower() == 'sjis':
            processed_updates = position_smed_encoder.convert_position_updates(
                updates, from_encoding='sjis', to_encoding='utf-8'
            )
            logger.info(f"[POSITION_SMED_UPDATE] Converted {len(updates)} updates from SJIS to UTF-8")
        
        # Prepare response data
        response_data = {
            'event_type': 'position_smed_update',
            'map_name': map_name,
            'updates': processed_updates,
            'terminal_id': terminal_id,
            'encoding': 'utf-8',
            'timestamp': timestamp,
            'session_id': session_id
        }
        
        # Broadcast to all clients subscribed to this map
        room_name = f'position_smed_{map_name}'
        emit('position_smed_update_received', response_data, room=room_name)
        
        # Confirm to sender
        emit('position_smed_update_confirmed', {
            'success': True,
            'map_name': map_name,
            'update_count': len(updates),
            'terminal_id': terminal_id,
            'timestamp': timestamp
        })
        
        # Log the update event
        add_log('INFO', f'POSITION_SMED/{map_name}', f'Real-time updates transmitted', {
            'terminal_id': terminal_id,
            'map_name': map_name,
            'update_count': len(updates),
            'encoding': encoding
        })
        
        logger.info(f"[POSITION_SMED_UPDATE] Updates broadcast successfully for map: {map_name}")
        
    except Exception as e:
        logger.error(f"[POSITION_SMED_UPDATE] Failed to handle update event: {e}")
        emit('position_smed_error', {
            'error': str(e),
            'event_type': 'position_smed_update',
            'session_id': session_id
        })

@socketio.on('position_smed_key_event')
def handle_position_smed_key_event(data):
    """Handle key events for position-based SMED rendering"""
    session_id = request.sid
    
    logger.info(f"[POSITION_SMED_KEY_EVENT] Key event received from session: {session_id}")
    logger.info(f"[POSITION_SMED_KEY_EVENT] Data: {data}")
    
    try:
        map_name = data.get('map_name')
        key = data.get('key', '')
        terminal_id = data.get('terminal_id', 'webui')
        user = data.get('user', 'unknown')
        wsname = data.get('wsname', 'WSNAME00')
        field_values = data.get('field_values', {})
        cursor_position = data.get('cursor_position', {'row': 1, 'col': 1})
        timestamp = data.get('timestamp', datetime.now().isoformat())
        
        if not map_name:
            emit('position_smed_error', {'error': 'map_name is required'})
            return
        
        if not key:
            emit('position_smed_error', {'error': 'key is required'})
            return
        
        # Handle function keys based on program logic
        response = {
            'success': True,
            'action': None,
            'message': f'Key {key} processed for position-based SMED',
            'map_name': map_name,
            'terminal_id': terminal_id,
            'wsname': wsname,
            'timestamp': timestamp
        }
        
        # Enhanced function key behaviors for position-based SMED
        if key == 'F3':
            response['action'] = 'close'
            response['message'] = 'Exit requested from position-based SMED'
            logger.info(f"[POSITION_SMED_KEY_EVENT] Map {map_name} requested exit via F3")
        elif key == 'F1':
            response['action'] = 'help'
            response['message'] = 'Help requested for position-based SMED'
        elif key == 'F12':
            response['action'] = 'close'
            response['message'] = 'Cancel requested from position-based SMED'
        elif key == 'ENTER':
            response['action'] = 'submit'
            response['message'] = 'Form submission requested'
        elif key == 'TAB':
            response['action'] = 'next_field'
            response['message'] = 'Move to next field'
        elif key in ['F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11']:
            response['action'] = 'function'
            response['message'] = f'Function key {key} handled by position-based SMED'
        elif key in ['UP', 'DOWN', 'LEFT', 'RIGHT']:
            response['action'] = 'cursor_move'
            response['message'] = f'Cursor movement: {key}'
        else:
            response['action'] = 'input'
            response['message'] = f'Character input: {key}'
        
        # Add cursor position to response
        response['cursor_position'] = cursor_position
        response['field_values'] = field_values
        
        # Send response back to requesting terminal and broadcast to room
        room_name = f'position_smed_{map_name}'
        emit('position_smed_key_event_response', response)
        emit('position_smed_key_event_broadcast', response, room=room_name)
        
        # Log the key event
        add_log('INFO', f'POSITION_SMED/{map_name}', f'Key event: {key}', {
            'terminal_id': terminal_id,
            'user': user,
            'wsname': wsname,
            'key': key,
            'action': response['action'],
            'cursor_position': cursor_position,
            'field_count': len(field_values)
        })
        
        logger.info(f"[POSITION_SMED_KEY_EVENT] Key event processed successfully: {key} -> {response['action']}")
        
    except Exception as e:
        logger.error(f"[POSITION_SMED_KEY_EVENT] Failed to handle key event: {e}")
        emit('position_smed_error', {
            'error': str(e),
            'event_type': 'position_smed_key_event',
            'session_id': session_id
        })

@socketio.on('position_smed_subscribe')
def handle_position_smed_subscribe(data):
    """Subscribe to position-based SMED updates for specific map with session integration"""
    session_id = request.sid
    
    try:
        map_name = data.get('map_name')
        terminal_id = data.get('terminal_id', 'webui')
        user = data.get('user', 'unknown')
        wsname = data.get('wsname')  # Optional workstation name
        
        if not map_name:
            handle_position_smed_error(session_id, 'position_smed_subscribe', 'map_name is required', emit)
            return
        
        # Integrate with workstation session if available
        workstation_session = None
        if wsname:
            workstation_session = workstation_session_manager.get_session_by_workstation(wsname)
            if workstation_session:
                # Add SMED subscription to workstation session
                workstation_session_manager.add_smed_subscription(workstation_session['session_id'], map_name)
                # Update WebSocket room info
                rooms = workstation_session.get('websocket_rooms', [])
                room_name = f'position_smed_{map_name}'
                if room_name not in rooms:
                    rooms.append(room_name)
                    workstation_session_manager.update_session(workstation_session['session_id'], {'websocket_rooms': rooms})
                logger.info(f"[POSITION_SMED_SUBSCRIBE] Added subscription to workstation session: {wsname}")
        
        # Legacy session registration (for backward compatibility)
        register_position_smed_session(session_id, map_name, terminal_id)
        
        # Join room for this map
        room_name = f'position_smed_{map_name}'
        join_room(room_name)
        
        # Add subscription to legacy session info
        session_info = get_position_smed_session(session_id)
        if session_info and map_name not in session_info['subscriptions']:
            session_info['subscriptions'].append(map_name)
        
        logger.info(f"[POSITION_SMED_SUBSCRIBE] Client {session_id} subscribed to map: {map_name}")
        
        # Try to get map info from position API
        map_info = integrate_with_position_api(map_name, 'get_map')
        
        # Send confirmation
        emit('position_smed_subscribed', {
            'success': True,
            'map_name': map_name,
            'terminal_id': terminal_id,
            'room': room_name,
            'timestamp': datetime.now().isoformat(),
            'map_info': map_info
        })
        
        # Update session activity
        update_position_smed_session_activity(session_id)
        
        # Log subscription
        add_log('INFO', f'POSITION_SMED/{map_name}', 'Client subscribed', {
            'session_id': session_id,
            'terminal_id': terminal_id,
            'user': user,
            'room': room_name,
            'map_info_available': map_info is not None
        })
        
    except Exception as e:
        handle_position_smed_error(session_id, 'position_smed_subscribe', e, emit)

@socketio.on('position_smed_unsubscribe')
def handle_position_smed_unsubscribe(data):
    """Unsubscribe from position-based SMED updates with session integration"""
    session_id = request.sid
    
    try:
        map_name = data.get('map_name')
        terminal_id = data.get('terminal_id', 'webui')
        wsname = data.get('wsname')  # Optional workstation name
        
        if not map_name:
            emit('position_smed_error', {'error': 'map_name is required'})
            return
        
        # Integrate with workstation session if available
        if wsname:
            workstation_session = workstation_session_manager.get_session_by_workstation(wsname)
            if workstation_session:
                # Remove SMED subscription from workstation session
                workstation_session_manager.remove_smed_subscription(workstation_session['session_id'], map_name)
                # Update WebSocket room info
                rooms = workstation_session.get('websocket_rooms', [])
                room_name = f'position_smed_{map_name}'
                if room_name in rooms:
                    rooms.remove(room_name)
                    workstation_session_manager.update_session(workstation_session['session_id'], {'websocket_rooms': rooms})
                logger.info(f"[POSITION_SMED_UNSUBSCRIBE] Removed subscription from workstation session: {wsname}")
        
        # Leave room for this map
        room_name = f'position_smed_{map_name}'
        leave_room(room_name)
        
        logger.info(f"[POSITION_SMED_UNSUBSCRIBE] Client {session_id} unsubscribed from map: {map_name}")
        
        # Send confirmation
        emit('position_smed_unsubscribed', {
            'success': True,
            'map_name': map_name,
            'terminal_id': terminal_id,
            'room': room_name,
            'timestamp': datetime.now().isoformat()
        })
        
        # Log unsubscription
        add_log('INFO', f'POSITION_SMED/{map_name}', 'Client unsubscribed', {
            'session_id': session_id,
            'terminal_id': terminal_id,
            'room': room_name
        })
        
    except Exception as e:
        logger.error(f"[POSITION_SMED_UNSUBSCRIBE] Failed to unsubscribe: {e}")
        emit('position_smed_error', {
            'error': str(e),
            'event_type': 'position_smed_unsubscribe',
            'session_id': session_id
        })

# POSITION-BASED SMED API INTEGRATION FOR WEBSOCKET
def get_position_based_api_url():
    """Get position-based SMED API URL"""
    return "http://localhost:5000/api/position-smed"

def integrate_with_position_api(map_name, action, data=None):
    """Integrate WebSocket events with position-based SMED API"""
    try:
        api_url = get_position_based_api_url()
        
        if action == 'get_map':
            response = requests.get(f"{api_url}/maps/{map_name}", timeout=5)
        elif action == 'render':
            response = requests.post(f"{api_url}/render", json={
                'map_name': map_name,
                'data': data
            }, timeout=5)
        elif action == 'update':
            response = requests.put(f"{api_url}/maps/{map_name}/fields", json=data, timeout=5)
        else:
            return None
        
        if response.status_code == 200:
            return response.json()
        else:
            logger.error(f"Position API error: {response.status_code}")
            return None
            
    except Exception as e:
        logger.error(f"Failed to integrate with position API: {e}")
        return None

# ENHANCED SESSION MANAGEMENT FOR POSITION-BASED SMED
position_smed_sessions = {}  # {session_id: {'map_name': str, 'terminal_id': str, 'subscriptions': []}}

def register_position_smed_session(session_id, map_name, terminal_id):
    """Register a position-based SMED session"""
    if session_id not in position_smed_sessions:
        position_smed_sessions[session_id] = {
            'map_name': map_name,
            'terminal_id': terminal_id,
            'subscriptions': [],
            'created_at': datetime.now().isoformat(),
            'last_activity': datetime.now().isoformat()
        }
    else:
        position_smed_sessions[session_id]['last_activity'] = datetime.now().isoformat()
    
    logger.info(f"[POSITION_SMED_SESSION] Registered session {session_id} for map {map_name}")

def unregister_position_smed_session(session_id):
    """Unregister a position-based SMED session"""
    if session_id in position_smed_sessions:
        session_info = position_smed_sessions.pop(session_id)
        logger.info(f"[POSITION_SMED_SESSION] Unregistered session {session_id} for map {session_info.get('map_name')}")

def get_position_smed_session(session_id):
    """Get position-based SMED session info"""
    return position_smed_sessions.get(session_id)

def update_position_smed_session_activity(session_id):
    """Update session last activity timestamp"""
    if session_id in position_smed_sessions:
        position_smed_sessions[session_id]['last_activity'] = datetime.now().isoformat()

# ENHANCED ERROR HANDLING FOR POSITION-BASED SMED WEBSOCKET EVENTS
def handle_position_smed_error(session_id, event_type, error, emit_func):
    """Centralized error handling for position-based SMED WebSocket events"""
    error_data = {
        'error': str(error),
        'event_type': event_type,
        'session_id': session_id,
        'timestamp': datetime.now().isoformat()
    }
    
    # Log the error
    logger.error(f"[POSITION_SMED_ERROR] {event_type}: {error}")
    
    # Get session info for context
    session_info = get_position_smed_session(session_id)
    if session_info:
        error_data['map_name'] = session_info.get('map_name')
        error_data['terminal_id'] = session_info.get('terminal_id')
    
    # Emit error to client
    emit_func('position_smed_error', error_data)
    
    # Add to logs
    add_log('ERROR', f'POSITION_SMED/{event_type}', str(error), {
        'session_id': session_id,
        'event_type': event_type,
        'session_info': session_info
    })

@app.route('/api/catalog', methods=['GET'])
def get_catalog():
    """Get complete catalog data (DBIO-enabled with JSON fallback)"""
    try:
        catalog = get_catalog_data_with_fallback()
        return jsonify(catalog)
        
    except Exception as e:
        logger.error(f"Failed to get catalog: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/catalog/maps', methods=['GET'])
def get_catalog_maps():
    """Get all MAP type resources (DBIO-enabled with JSON fallback)"""
    try:
        catalog = get_catalog_data_with_fallback()
        maps = []
        
        # Iterate through volumes and libraries to find MAP resources
        for volume_name, volume_data in catalog.items():
            for library_name, library_data in volume_data.items():
                for resource_name, resource_data in library_data.items():
                    if resource_data.get('TYPE') == 'MAP':
                        maps.append({
                            'volume': volume_name,
                            'library': library_name,
                            'name': resource_name,
                            'maptype': resource_data.get('MAPTYPE', 'UNKNOWN'),
                            'mapfile': resource_data.get('MAPFILE', resource_name),
                            'description': resource_data.get('DESCRIPTION', ''),
                            'rows': resource_data.get('ROWS', 24),
                            'cols': resource_data.get('COLS', 80)
                        })
        
        return jsonify({
            'success': True,
            'maps': maps,
            'count': len(maps)
        })
        
    except Exception as e:
        logger.error(f"Failed to get catalog maps: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/catalog/volumes', methods=['GET'])
def get_catalog_volumes():
    """Get all volumes (DBIO-enabled with JSON fallback)"""
    try:
        catalog = get_catalog_data_with_fallback()
        volumes = list(catalog.keys())
        
        return jsonify({
            'success': True,
            'volumes': volumes
        })
        
    except Exception as e:
        logger.error(f"Failed to get catalog volumes: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/catalog/libraries/<volume_name>', methods=['GET'])
def get_catalog_libraries(volume_name):
    """Get all libraries for a specific volume (DBIO-enabled with JSON fallback)"""
    try:
        catalog = get_catalog_data_with_fallback()
        
        if volume_name not in catalog:
            return jsonify({'error': f'Volume {volume_name} not found'}), 404
        
        libraries = list(catalog[volume_name].keys())
        
        return jsonify({
            'success': True,
            'libraries': libraries
        })
        
    except Exception as e:
        logger.error(f"Failed to get catalog libraries: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/compile', methods=['POST'])
def compile_java():
    """Compile Java source file"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'Request body required'}), 400
        
        filename = data.get('filename')
        volume = data.get('volume', 'DISK01')
        library = data.get('library', 'TESTLIB')
        
        if not filename:
            return jsonify({'error': 'Filename parameter required'}), 400
        
        # Security check: prevent path traversal
        if '..' in filename or '/' in filename or '\\' in filename:
            return jsonify({'error': 'Invalid filename'}), 400
        
        # Construct file path
        java_file_path = os.path.join(VOLUME_ROOT, volume, library, filename)
        
        if not os.path.exists(java_file_path):
            return jsonify({'error': f'Java file not found: {filename}'}), 404
        
        # Get directory for compilation
        compile_dir = os.path.join(VOLUME_ROOT, volume, library)
        
        logger.info(f"Compiling Java file: {java_file_path}")
        
        try:
            # Java compilation command
            cmd = ['javac', '-d', compile_dir, java_file_path]
            
            logger.info(f"Executing javac command: {' '.join(cmd)}")
            
            # Run javac with timeout
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=30,
                cwd=compile_dir
            )
            
            if result.returncode == 0:
                # Compilation successful
                class_name = filename.replace('.java', '.class')
                
                # Check for package structure in the Java file
                package_path = ""
                try:
                    with open(java_file_path, 'r', encoding='utf-8') as f:
                        first_lines = f.read(1000)  # Read first 1000 chars to find package declaration
                        for line in first_lines.split('\n'):
                            line = line.strip()
                            if line.startswith('package ') and line.endswith(';'):
                                package_name = line[8:-1].strip()  # Remove 'package ' and ';'
                                package_path = package_name.replace('.', '/')
                                break
                except Exception as e:
                    logger.warning(f"Could not read Java file to detect package: {e}")
                
                # Determine class file path based on package structure
                if package_path:
                    class_file_path = os.path.join(compile_dir, package_path, class_name)
                else:
                    class_file_path = os.path.join(compile_dir, class_name)
                
                logger.info(f"Looking for class file at: {class_file_path}")
                
                # Check if class file was created
                if os.path.exists(class_file_path):
                    logger.info(f"Java compilation successful: {filename} -> {class_name}")
                    add_log('INFO', 'JAVA_COMPILE', f'Successfully compiled: {filename}', {
                        'java_file': filename,
                        'class_file': class_name,
                        'volume': volume,
                        'library': library
                    })
                    
                    return jsonify({
                        'success': True,
                        'message': f'Successfully compiled {filename}',
                        'filename': filename,
                        'class_file': class_name,
                        'volume': volume,
                        'library': library
                    })
                else:
                    logger.warning(f"Class file not found after compilation: {class_file_path}")
                    return jsonify({
                        'success': False,
                        'error': f'Class file not created: {class_name}'
                    }), 500
            else:
                # Compilation failed
                error_output = result.stderr.strip() if result.stderr else 'Unknown compilation error'
                logger.error(f"Java compilation failed for {filename}: {error_output}")
                add_log('ERROR', 'JAVA_COMPILE', f'Compilation failed: {filename}', {
                    'java_file': filename,
                    'error': error_output,
                    'volume': volume,
                    'library': library
                })
                
                return jsonify({
                    'success': False,
                    'error': f'Compilation failed: {error_output}',
                    'filename': filename
                }), 400
                
        except subprocess.TimeoutExpired:
            logger.error(f"Java compilation timeout for {filename}")
            return jsonify({
                'success': False,
                'error': f'Compilation timeout for {filename}'
            }), 500
        except FileNotFoundError:
            logger.error("javac command not found - Java compiler not installed")
            return jsonify({
                'success': False,
                'error': 'Java compiler (javac) not found. Please install Java Development Kit (JDK)'
            }), 500
        except Exception as e:
            logger.error(f"Java compilation error for {filename}: {str(e)}")
            return jsonify({
                'success': False,
                'error': f'Compilation error: {str(e)}'
            }), 500
    
    except Exception as e:
        logger.error(f"Java compilation API error: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/asp-command', methods=['POST'])
def asp_command():
    """Execute ASP system command"""
    try:
        logger.info("=== ASP COMMAND ENDPOINT CALLED ===")
        data = request.get_json()
        logger.info(f"Request data: {data}")
        
        if not data:
            logger.error("No request body provided")
            return jsonify({'error': 'Request body required'}), 400
        
        command = data.get('command', '').strip()
        user = data.get('user', 'unknown')
        logger.info(f"Parsed command: '{command}', user: '{user}'")
        
        if not command:
            logger.error("No command parameter provided")
            return jsonify({'error': 'Command parameter required'}), 400
        
        logger.info(f"Received ASP command request: {command} from user: {user}")
        add_log('INFO', 'ASP_COMMAND', f'Executing command: {command}', {'user': user, 'command': command})
        
        # ASP 명령어 실행
        result = execute_asp_command(command, user)
        
        if result['success']:
            add_log('INFO', 'ASP_COMMAND', f'Command completed successfully: {command}', 
                   {'user': user, 'command': command, 'output_length': len(result['output'])})
            return jsonify({
                'success': True,
                'output': result['output'],
                'command': command,
                'user': user
            })
        else:
            add_log('ERROR', 'ASP_COMMAND', f'Command failed: {command}', 
                   {'user': user, 'command': command, 'error': result['error']})
            return jsonify({
                'success': False,
                'error': result['error'],
                'command': command,
                'user': user
            }), 500
    
    except Exception as e:
        error_msg = str(e)
        logger.error(f"ASP command API error: {error_msg}")
        add_log('ERROR', 'ASP_COMMAND', f'API error: {error_msg}', {'error': error_msg})
        return jsonify({'error': error_msg}), 500

def execute_asp_command(command, user):
    """Execute ASP command using cmdRunner with enhanced process management"""
    try:
        import uuid
        import multiprocessing
        from datetime import datetime
        
        # Generate session identifiers
        session_id = f"session_{uuid.uuid4().hex[:8]}"
        terminal_id = f"terminal_{user}_{datetime.now().strftime('%H%M%S')}"
        
        logger.info(f"Executing ASP command via cmdRunner: {command} for user: {user}")
        logger.info(f"Session: {session_id}, Terminal: {terminal_id}")
        
        # Parse command to determine execution strategy
        command_parts = command.strip().split()
        if not command_parts:
            raise Exception("Empty command")
        
        command_name = command_parts[0].upper()
        
        # Use cmdRunner for CALL commands (enhanced process management)
        logger.info(f"Command name detected: {command_name}")
        if command_name == "CALL":
            logger.info(f"Routing to cmdRunner: {command}")
            return execute_with_cmdrunner(command, session_id, terminal_id, user)
        else:
            # Use direct execution for other commands (backwards compatibility)
            logger.info(f"Routing to aspcli: {command}")
            return execute_with_aspcli(command, user)
        
    except Exception as e:
        error_msg = str(e)
        logger.error(f"ASP command execution error: {error_msg}")
        return {
            'success': False,
            'output': '',
            'error': error_msg
        }

def execute_with_cmdrunner(command, session_id, terminal_id, user):
    """Execute command using cmdRunner with fork-based process management"""
    try:
        logger.info(f"Starting cmdRunner execution for: {command}")
        # Import cmdRunner
        script_dir = os.path.dirname(os.path.abspath(__file__))
        sys.path.append(os.path.join(script_dir, 'system-cmds'))
        logger.info(f"Importing cmdRunner from: {script_dir}/system-cmds")
        from cmd_runner import run_cmd_runner
        
        # Create communication pipe
        parent_conn, child_conn = multiprocessing.Pipe()
        
        # Fork cmdRunner process
        child_pid = os.fork()
        
        if child_pid == 0:
            # Child process - run cmdRunner
            try:
                parent_conn.close()  # Close parent end in child
                exit_code = run_cmd_runner(session_id, terminal_id, user, command, child_conn)
                os._exit(exit_code)
            except Exception as e:
                logger.error(f"CmdRunner child process error: {e}")
                os._exit(999)
        
        else:
            # Parent process - wait for result
            child_conn.close()  # Close child end in parent
            
            try:
                # Wait for result with timeout
                if parent_conn.poll(timeout=60):  # 60 second timeout
                    result = parent_conn.recv()
                    
                    # Wait for child process to complete
                    pid, status = os.waitpid(child_pid, 0)
                    
                    logger.info(f"CmdRunner completed: PID={child_pid}, Return={result.get('return_code', 999)}")
                    
                    return {
                        'success': result.get('success', False),
                        'output': result.get('output', ''),
                        'error': result.get('error', ''),
                        'execution_time': result.get('execution_time', 0),
                        'allocated_datasets': result.get('allocated_datasets', [])
                    }
                else:
                    # Timeout - kill child process
                    try:
                        os.kill(child_pid, signal.SIGTERM)
                        time.sleep(2)
                        os.kill(child_pid, signal.SIGKILL)
                    except OSError:
                        pass
                    
                    try:
                        os.waitpid(child_pid, 0)
                    except OSError:
                        pass
                    
                    return {
                        'success': False,
                        'output': '',
                        'error': 'Command execution timeout (60s)'
                    }
                    
            finally:
                parent_conn.close()
    
    except Exception as e:
        logger.error(f"CmdRunner execution failed: {e}")
        return {
            'success': False,
            'output': '',
            'error': f"CmdRunner failed: {str(e)}"
        }

def execute_with_aspcli(command, user):
    """Execute command using traditional aspcli.py (backwards compatibility)"""
    try:
        # ASP 명령어 실행을 위한 스크립트 경로
        script_dir = os.path.dirname(os.path.abspath(__file__))
        aspcli_path = os.path.join(script_dir, 'system-cmds', 'aspcli.py')
        
        if not os.path.exists(aspcli_path):
            raise Exception(f"aspcli.py not found at {aspcli_path}")
        
        # Python 명령어 실행 (UTF-8 인코딩 설정)
        env = os.environ.copy()
        env['PYTHONIOENCODING'] = 'utf-8'
        env['LC_ALL'] = 'C.UTF-8'
        env['LANG'] = 'C.UTF-8'
        
        logger.info(f"Executing ASP command via aspcli: {command} for user: {user}")
        
        # Parse command to extract command name and parameters
        command_parts = command.strip().split()
        if not command_parts:
            raise Exception("Empty command")
        
        command_name = command_parts[0]
        command_params = command[len(command_name):].strip()
        
        # Build arguments for aspcli.py: command_name [params...]
        cmd_args = [sys.executable, aspcli_path, command_name]
        if command_params:
            cmd_args.append(command_params)
        
        process = subprocess.Popen(
            cmd_args,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=False,  # Use binary mode to avoid encoding issues
            env=env,
            cwd=os.path.dirname(aspcli_path)
        )
        
        stdout_bytes, stderr_bytes = process.communicate(timeout=30)
        
        # Safely decode output using UTF-8 with error handling
        stdout = stdout_bytes.decode('utf-8', errors='replace') if stdout_bytes else ""
        stderr = stderr_bytes.decode('utf-8', errors='replace') if stderr_bytes else ""
        
        if process.returncode != 0:
            error_msg = stderr.strip() if stderr else "Command execution failed"
            logger.error(f"ASP command failed: {error_msg}")
            return {
                'success': False,
                'output': '',
                'error': error_msg
            }
        
        output = stdout.strip()
        logger.info(f"ASP command completed successfully")
        
        return {
            'success': True,
            'output': output,
            'error': None
        }
        
    except subprocess.TimeoutExpired:
        process.kill()
        error_msg = "Command execution timeout"
        logger.error(f"ASP command timeout: {command}")
        return {
            'success': False,
            'output': '',
            'error': error_msg
        }
    except Exception as e:
        error_msg = str(e)
        logger.error(f"ASP command execution error: {error_msg}")
        return {
            'success': False,
            'output': '',
            'error': error_msg
        }

def force_disconnect_websockets_by_workstations(workstation_names: List[str]) -> List[str]:
    """Force disconnect WebSocket sessions for specified workstations"""
    disconnected = []
    
    try:
        # Find WebSocket sessions to disconnect
        sessions_to_disconnect = []
        
        # Check websocket_sessions (maps session_id to session info)
        for session_id, session_info in websocket_sessions.items():
            wsname = session_info.get('wsname')
            if wsname in workstation_names:
                sessions_to_disconnect.append({
                    'session_id': session_id,
                    'wsname': wsname,
                    'type': 'websocket'
                })
        
        # Check active_terminals (maps session_id to terminal info)
        for session_id, terminal_info in active_terminals.items():
            workstation = terminal_info.get('workstation')
            if workstation in workstation_names:
                # Check if we haven't already added this session
                if not any(s['session_id'] == session_id for s in sessions_to_disconnect):
                    sessions_to_disconnect.append({
                        'session_id': session_id,
                        'wsname': workstation,
                        'type': 'terminal'
                    })
        
        # Force disconnect the WebSocket sessions
        for session_info in sessions_to_disconnect:
            try:
                session_id = session_info['session_id']
                wsname = session_info['wsname']
                
                logger.info(f"[FORCE_DISCONNECT] Disconnecting WebSocket session {session_id} for workstation {wsname}")
                
                # Use socketio.disconnect to forcefully disconnect the client
                socketio.disconnect(session_id)
                
                # Clean up session tracking
                if session_id in websocket_sessions:
                    del websocket_sessions[session_id]
                
                if session_id in active_terminals:
                    terminal_info = active_terminals[session_id]
                    terminal_id = terminal_info.get('terminal_id')
                    
                    # Clean up terminal mappings
                    if terminal_id and terminal_id in terminal_to_session:
                        del terminal_to_session[terminal_id]
                    
                    del active_terminals[session_id]
                
                disconnected.append(wsname)
                logger.info(f"[FORCE_DISCONNECT] Successfully disconnected {wsname}")
                
            except Exception as e:
                logger.error(f"[FORCE_DISCONNECT] Failed to disconnect session {session_info['session_id']}: {e}")
        
        logger.info(f"[FORCE_DISCONNECT] Disconnected {len(disconnected)} WebSocket sessions")
        
    except Exception as e:
        logger.error(f"[FORCE_DISCONNECT] Error during bulk WebSocket disconnect: {e}")
    
    return disconnected

def add_log(level, source, message, details=None):
    """Add log entry"""
    log_entry = {
        'id': str(uuid.uuid4()),
        'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        'level': level,
        'source': source,
        'message': message,
        'details': details
    }
    execution_logs.append(log_entry)
    logger.info(f"[{level}] {source}: {message}")

@app.route('/api/cleanup-processes', methods=['POST'])
def cleanup_processes():
    """Generic cleanup endpoint to terminate all active main programs and their forked processes"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'Request body required'}), 400
        
        user = data.get('user', 'unknown')
        cleanup_mode = data.get('cleanup_mode', 'all_main_programs')
        reason = data.get('reason', 'manual_cleanup')
        
        logger.info(f"Process cleanup requested by user: {user}, mode: {cleanup_mode}, reason: {reason}")
        add_log('INFO', 'PROCESS_CLEANUP', f'Cleanup requested: mode={cleanup_mode}, reason={reason}', 
               {'user': user, 'cleanup_mode': cleanup_mode, 'reason': reason})
        
        cleaned_processes = 0
        cleanup_details = []
        
        try:
            # Get PID directory from environment or default
            call_pid_dir = os.environ.get('ASP_PID_DIR', '/tmp/asp_call_pids')
            
            # First, try to clean up processes tracked by call.py PID files
            if os.path.exists(call_pid_dir):
                for pid_file in os.listdir(call_pid_dir):
                    if not pid_file.endswith('.json'):
                        continue
                        
                    pid_file_path = os.path.join(call_pid_dir, pid_file)
                    try:
                        with open(pid_file_path, 'r') as f:
                            pid_data = json.load(f)
                        
                        pid = pid_data.get('pid')
                        program = pid_data.get('program', 'UNKNOWN')
                        
                        # Check if process still exists
                        try:
                            proc = psutil.Process(pid)
                            logger.info(f"Terminating tracked process PID {pid}: {program}")
                            proc.terminate()
                            
                            # Wait for graceful termination
                            try:
                                proc.wait(timeout=5)
                                logger.info(f"Process {pid} terminated gracefully")
                            except psutil.TimeoutExpired:
                                logger.warning(f"Process {pid} did not terminate gracefully, forcing kill")
                                proc.kill()
                                proc.wait(timeout=2)
                            
                            cleaned_processes += 1
                            cleanup_details.append({
                                'pid': pid,
                                'program': program,
                                'method': 'pid_tracking',
                                'status': 'terminated'
                            })
                            
                        except psutil.NoSuchProcess:
                            logger.info(f"Process {pid} already terminated")
                            cleanup_details.append({
                                'pid': pid,
                                'program': program,
                                'method': 'pid_tracking', 
                                'status': 'already_terminated'
                            })
                        
                        # Remove PID file
                        os.remove(pid_file_path)
                        
                    except Exception as e:
                        logger.error(f"Error processing PID file {pid_file}: {e}")
            
            # Fallback: Find and terminate any remaining Java processes that match patterns from any ASP volume
            volume_root = os.environ.get('ASP_VOLUME_ROOT', '/home/aspuser/app/volume')
            
            for proc in psutil.process_iter(['pid', 'name', 'cmdline', 'create_time']):
                try:
                    proc_info = proc.info
                    if not proc_info['cmdline']:
                        continue
                    
                    cmdline_str = ' '.join(proc_info['cmdline'])
                    
                    # Check if this is a Java process running a program from ASP volume structure
                    if ('java' in proc_info['name'].lower() and 
                        any('MAIN' in arg for arg in proc_info['cmdline']) and
                        volume_root in cmdline_str):
                        
                        # Extract program name for logging
                        main_program = None
                        for arg in proc_info['cmdline']:
                            if 'MAIN' in arg and '.class' in arg:
                                main_program = arg.replace('.class', '')
                                break
                        
                        if not main_program:
                            main_program = 'UNKNOWN_MAIN'
                        
                        logger.info(f"Terminating process PID {proc_info['pid']}: {main_program}")
                        proc.terminate()
                        
                        # Wait for graceful termination
                        try:
                            proc.wait(timeout=3)
                        except psutil.TimeoutExpired:
                            logger.warning(f"Force killing process PID {proc_info['pid']}: {main_program}")
                            proc.kill()
                        
                        cleaned_processes += 1
                        cleanup_details.append({
                            'pid': proc_info['pid'],
                            'program': main_program,
                            'method': 'fallback_scan',
                            'status': 'terminated'
                        })
                        
                except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                    # Process already gone or no access
                    continue
                except Exception as e:
                    logger.warning(f"Error processing PID {proc_info.get('pid', 'unknown')}: {e}")
                    continue
            
            # Also clean up any forked subprocesses by looking for processes with DISK01 in their path
            for proc in psutil.process_iter(['pid', 'name', 'cmdline', 'ppid']):
                try:
                    proc_info = proc.info
                    if not proc_info['cmdline']:
                        continue
                    
                    cmdline_str = ' '.join(proc_info['cmdline'])
                    
                    # Check if this is a subprocess related to our system
                    if ('volume/DISK01' in cmdline_str and 
                        any(ext in cmdline_str for ext in ['.java', '.class', '.py', '.sh']) and
                        proc_info['pid'] != os.getpid()):  # Don't kill ourselves
                        
                        logger.info(f"Terminating subprocess PID {proc_info['pid']}: {proc_info['name']}")
                        proc.terminate()
                        
                        try:
                            proc.wait(timeout=2)
                        except psutil.TimeoutExpired:
                            proc.kill()
                        
                        cleaned_processes += 1
                        cleanup_details.append({
                            'pid': proc_info['pid'],
                            'program': f"subprocess_{proc_info['name']}",
                            'action': 'terminated'
                        })
                        
                except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                    continue
                except Exception as e:
                    logger.warning(f"Error processing subprocess PID {proc_info.get('pid', 'unknown')}: {e}")
                    continue
            
            result_message = f"Process cleanup completed. Cleaned up {cleaned_processes} processes."
            logger.info(result_message)
            add_log('INFO', 'PROCESS_CLEANUP', result_message, 
                   {'user': user, 'cleaned_processes': cleaned_processes, 'details': cleanup_details})
            
            return jsonify({
                'success': True,
                'cleaned_processes': cleaned_processes,
                'cleanup_details': cleanup_details,
                'message': result_message,
                'cleanup_mode': cleanup_mode,
                'user': user
            })
            
        except Exception as e:
            error_msg = f"Error during process cleanup: {str(e)}"
            logger.error(error_msg)
            add_log('ERROR', 'PROCESS_CLEANUP', error_msg, {'user': user, 'error': str(e)})
            return jsonify({
                'success': False,
                'error': error_msg,
                'cleaned_processes': cleaned_processes,
                'user': user
            }), 500
    
    except Exception as e:
        error_msg = f"Process cleanup API error: {str(e)}"
        logger.error(error_msg)
        return jsonify({'error': error_msg}), 500

# WEBSOCKET STATUS AND MONITORING ENDPOINTS
@app.route('/api/websocket/status', methods=['GET'])
def get_websocket_status():
    """Get WebSocket server status including position-based SMED sessions"""
    try:
        active_sessions = len(active_terminals)
        position_smed_active = len(position_smed_sessions)
        
        # Count subscriptions
        total_subscriptions = 0
        for session_info in position_smed_sessions.values():
            total_subscriptions += len(session_info.get('subscriptions', []))
        
        status = {
            'websocket_server': 'running',
            'active_sessions': active_sessions,
            'position_smed_sessions': position_smed_active,
            'total_position_subscriptions': total_subscriptions,
            'encoding_api_available': position_smed_encoder.encoding_api_available,
            'timestamp': datetime.now().isoformat()
        }
        
        return jsonify(status)
        
    except Exception as e:
        logger.error(f"Failed to get WebSocket status: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/websocket/position-smed/sessions', methods=['GET'])
def get_position_smed_sessions():
    """Get detailed information about position-based SMED sessions"""
    try:
        sessions = []
        
        for session_id, session_info in position_smed_sessions.items():
            session_detail = {
                'session_id': session_id,
                'map_name': session_info.get('map_name'),
                'terminal_id': session_info.get('terminal_id'),
                'subscriptions': session_info.get('subscriptions', []),
                'created_at': session_info.get('created_at'),
                'last_activity': session_info.get('last_activity'),
                'duration_minutes': 0
            }
            
            # Calculate session duration
            if session_info.get('created_at'):
                try:
                    created = datetime.fromisoformat(session_info['created_at'])
                    duration = datetime.now() - created
                    session_detail['duration_minutes'] = int(duration.total_seconds() / 60)
                except:
                    pass
            
            sessions.append(session_detail)
        
        return jsonify({
            'success': True,
            'sessions': sessions,
            'total_sessions': len(sessions),
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Failed to get position SMED sessions: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/websocket/position-smed/test', methods=['POST'])
def test_position_smed_websocket():
    """Test position-based SMED WebSocket functionality"""
    try:
        data = request.json or {}
        map_name = data.get('map_name', 'TEST_MAP')
        
        # Test data
        test_data = {
            'event_type': 'position_smed_display',
            'map_name': map_name,
            'map_data': [{'row': 1, 'col': 1, 'length': 20}],
            'field_data': ['テストデータ', '田中太郎'],
            'terminal_id': 'TEST_TERMINAL',
            'encoding': 'utf-8',
            'timestamp': datetime.now().isoformat()
        }
        
        # Broadcast test data to room
        room_name = f'position_smed_{map_name}'
        socketio.emit('position_smed_display_received', test_data, room=room_name)
        
        logger.info(f"[TEST] Broadcasted test data to room: {room_name}")
        
        return jsonify({
            'success': True,
            'message': f'Test data broadcast to room: {room_name}',
            'test_data': test_data,
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Failed to test position SMED WebSocket: {e}")
        return jsonify({'error': str(e)}), 500

# TERMINAL INTERFACE ROUTES
@app.route('/terminal', methods=['GET'])
def serve_terminal():
    """Serve the ASP terminal interface"""
    try:
        return send_from_directory('.', 'asp_terminal.html')
    except Exception as e:
        logger.error(f"Failed to serve terminal: {e}")
        return f"Terminal interface not available: {e}", 500

@app.route('/asp_terminal_simple.html', methods=['GET'])
def serve_simple_terminal():
    """Serve the simplified ASP terminal interface"""
    try:
        return send_from_directory('.', 'asp_terminal_simple.html')
    except Exception as e:
        logger.error(f"Failed to serve simple terminal: {e}")
        return f"Simple terminal interface not available: {e}", 500

@app.route('/dvt_demo.html', methods=['GET'])
def serve_dvt_demo():
    """Serve the DVT demonstration page"""
    try:
        return send_from_directory('.', 'dvt_demo.html')
    except Exception as e:
        logger.error(f"Failed to serve DVT demo: {e}")
        return f"DVT demo page not available: {e}", 500

# LOG MANAGEMENT ROUTES (Duplicate - Removed)
'''
@app.route('/api/logs', methods=['GET'])
def get_logs_duplicate():
    """Get stored logs for Log Management Page"""
    try:
        # Convert deque to list and format logs
        logs_list = []
        for log_entry in execution_logs:
            # Ensure log entry has required structure
            if isinstance(log_entry, dict):
                logs_list.append(log_entry)
            else:
                # Convert string logs to structured format
                logs_list.append({
                    'id': str(uuid.uuid4()),
                    'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                    'level': 'INFO',
                    'source': 'system',
                    'message': str(log_entry)
                })
        
        return jsonify({
            'success': True,
            'logs': logs_list,
            'total': len(logs_list),
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        logger.error(f"Failed to get logs: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/logs', methods=['POST'])
def add_log():
    """Add a new log entry"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        # Create structured log entry
        log_entry = {
            'id': str(uuid.uuid4()),
            'timestamp': data.get('timestamp', datetime.now().strftime('%Y-%m-%d %H:%M:%S')),
            'level': data.get('level', 'INFO'),
            'source': data.get('source', 'unknown'),
            'message': data.get('message', ''),
            'details': data.get('details', {})
        }
        
        # Add to log storage
        execution_logs.append(log_entry)
        
        # Log to console as well
        log_level = log_entry['level'].upper()
        log_message = f"[{log_entry['source']}] {log_entry['message']}"
        
        if log_level == 'ERROR':
            logger.error(log_message)
        elif log_level == 'WARNING':
            logger.warning(log_message)
        elif log_level == 'DEBUG':
            logger.debug(log_message)
        else:
            logger.info(log_message)
        
        return jsonify({
            'success': True,
            'log_id': log_entry['id'],
            'message': 'Log added successfully'
        })
    except Exception as e:
        logger.error(f"Failed to add log: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/logs', methods=['DELETE'])
def clear_logs():
    """Clear all stored logs"""
    try:
        execution_logs.clear()
        logger.info("All logs cleared via API")
        return jsonify({
            'success': True,
            'message': 'All logs cleared'
        })
    except Exception as e:
        logger.error(f"Failed to clear logs: {e}")
        return jsonify({'error': str(e)}), 500
'''

@app.route('/api/log-files', methods=['GET'])
def get_log_files():
    """Get list of log files in /home/aspuser/app/logs directory"""
    try:
        logs_dir = "/home/aspuser/app/logs"
        
        if not os.path.exists(logs_dir):
            return jsonify({'error': 'Logs directory not found'}), 404
        
        log_files = []
        for file in os.listdir(logs_dir):
            file_path = os.path.join(logs_dir, file)
            if os.path.isfile(file_path) and file.endswith('.log'):
                stat = os.stat(file_path)
                log_files.append({
                    'name': file,
                    'size': stat.st_size,
                    'modified': stat.st_mtime
                })
        
        # Sort by modification time (newest first)
        log_files.sort(key=lambda x: x['modified'], reverse=True)
        
        return jsonify({
            'success': True,
            'files': log_files
        })
        
    except Exception as e:
        logger.error(f"Failed to get log files: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/log-files/<filename>', methods=['GET'])
def get_log_file_content(filename):
    """Get log file content with optional line limit"""
    try:
        # Security check: prevent path traversal
        if '..' in filename or '/' in filename or '\\' in filename:
            return jsonify({'error': 'Invalid filename'}), 400
        
        logs_dir = "/home/aspuser/app/logs"
        file_path = os.path.join(logs_dir, filename)
        
        if not os.path.exists(file_path):
            return jsonify({'error': f'Log file not found: {filename}'}), 404
        
        # Get line limit from query parameter (default: 1000)
        lines = request.args.get('lines', '1000')
        try:
            line_limit = int(lines)
        except ValueError:
            line_limit = 1000
        
        # Read file and get last N lines
        with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
            all_lines = f.readlines()
        
        # Get last N lines
        if line_limit > 0:
            content_lines = all_lines[-line_limit:]
        else:
            content_lines = all_lines
        
        content = ''.join(content_lines)
        
        return jsonify({
            'success': True,
            'filename': filename,
            'total_lines': len(all_lines),
            'displayed_lines': len(content_lines),
            'content': content
        })
        
    except Exception as e:
        logger.error(f"Failed to get log file content: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/convert/ebcdic-dataset', methods=['POST'])
def convert_ebcdic_dataset():
    """Convert EBCDIC dataset with layout-based field processing"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        input_data = data.get('input_data', '')
        encoding = data.get('encoding', 'JP')
        japanese_encoding = data.get('japanese_encoding', 'utf-8')
        output_format = data.get('output_format', 'json')
        sosi_flag = data.get('sosi_flag', False)
        out_sosi_flag = data.get('out_sosi_flag', False)
        sosi_handling = data.get('sosi_handling', 'remove')
        rlen = data.get('rlen', 80)
        
        logger.info(f"EBCDIC dataset conversion request: encoding={encoding}, format={output_format}, len={rlen}")
        
        # Simple EBCDIC to ASCII conversion
        # Convert hex string to bytes
        try:
            if len(input_data) % 2 != 0:
                input_data = input_data + '0'  # Pad if odd length
            
            ebcdic_bytes = bytes.fromhex(input_data)
            
            # Simple EBCDIC to ASCII mapping for basic characters
            ascii_result = ''
            for byte in ebcdic_bytes:
                if byte == 0x40:  # EBCDIC space
                    ascii_result += ' '
                elif byte == 0x00:  # EBCDIC null
                    ascii_result += '\x00'
                elif 0xF0 <= byte <= 0xF9:  # EBCDIC digits 0-9
                    ascii_result += chr(ord('0') + (byte - 0xF0))
                elif 0x81 <= byte <= 0x89:  # EBCDIC a-i
                    ascii_result += chr(ord('a') + (byte - 0x81))
                elif 0x91 <= byte <= 0x99:  # EBCDIC j-r
                    ascii_result += chr(ord('j') + (byte - 0x91))
                elif 0xA2 <= byte <= 0xA9:  # EBCDIC s-z
                    ascii_result += chr(ord('s') + (byte - 0xA2))
                elif 0xC1 <= byte <= 0xC9:  # EBCDIC A-I
                    ascii_result += chr(ord('A') + (byte - 0xC1))
                elif 0xD1 <= byte <= 0xD9:  # EBCDIC J-R
                    ascii_result += chr(ord('J') + (byte - 0xD1))
                elif 0xE2 <= byte <= 0xE9:  # EBCDIC S-Z
                    ascii_result += chr(ord('S') + (byte - 0xE2))
                else:
                    # For other bytes, use a placeholder or keep as-is
                    ascii_result += f'[{byte:02X}]'
            
            # Apply SOSI handling
            if sosi_handling == 'space':
                ascii_result = ascii_result.replace('\x0E', ' ').replace('\x0F', ' ')
            elif sosi_handling == 'remove':
                ascii_result = ascii_result.replace('\x0E', '').replace('\x0F', '')
            
            # Trim to specified length
            if len(ascii_result) > rlen:
                ascii_result = ascii_result[:rlen]
            elif len(ascii_result) < rlen:
                ascii_result = ascii_result.ljust(rlen)
            
            # Save converted dataset to filesystem if volume/library/dataset info provided
            volume_name = data.get('volume_name')
            library_name = data.get('library_name') 
            catalog_name = data.get('catalog_name')  # Get catalog_name from request
            dataset_name = data.get('dataset_name')
            
            saved_file_path = None
            if volume_name and library_name and dataset_name:
                try:
                    # Create volume/library directory structure
                    base_dir = os.path.join(os.path.dirname(__file__), '..', 'volume')
                    volume_dir = os.path.join(base_dir, volume_name)
                    library_dir = os.path.join(volume_dir, library_name)
                    
                    os.makedirs(library_dir, exist_ok=True)
                    
                    # Save converted dataset file
                    dataset_file_path = os.path.join(library_dir, dataset_name)
                    with open(dataset_file_path, 'w', encoding='utf-8') as f:
                        f.write(ascii_result)
                    
                    saved_file_path = dataset_file_path
                    logger.info(f"Dataset saved to: {dataset_file_path}")
                    
                except Exception as save_error:
                    logger.error(f"Failed to save dataset file: {save_error}")
            
            # Build command string for display based on actual ebcdic_dataset_converter.py syntax
            command_parts = [
                'python ebcdic_dataset_converter.py',
                '<input_file>',
                '<output_file>',
                'volume/DISK01/LAYOUT/<layout_name>.LAYOUT'
            ]
            
            # Add options in correct format
            command_parts.append(f'--format {output_format}')
            command_parts.append(f'--japanese-encoding {japanese_encoding}')
            
            # Add catalog name option if specified
            if catalog_name:
                command_parts.append(f'--catalog-name {catalog_name}')
            
            # SOSI options
            so_code = data.get('so_code', '0x0E')
            si_code = data.get('si_code', '0x0F')
            if so_code != '0x0E':
                command_parts.append(f'--so-code {so_code}')
            if si_code != '0x0F':
                command_parts.append(f'--si-code {si_code}')
            
            # SOSI handling (uppercase)
            sosi_upper = sosi_handling.upper()
            if sosi_upper != 'SPACE':
                command_parts.append(f'--sosi-handling {sosi_upper}')
            
            if volume_name and volume_name != 'DISK01':
                command_parts.append(f'--volume {volume_name}')
            if library_name and library_name != 'TESTLIB':
                command_parts.append(f'--library {library_name}')
            
            executed_command = ' '.join(command_parts)
            
            result = {
                'success': True,
                'data': {
                    'output': ascii_result,
                    'length': len(ascii_result),
                    'encoding_used': encoding,
                    'format': output_format,
                    'saved_file_path': saved_file_path,
                    'executed_command': executed_command,
                    'conversion_options': {
                        'encoding': encoding,
                        'japanese_encoding': japanese_encoding,
                        'output_format': output_format,
                        'sosi_flag': sosi_flag,
                        'out_sosi_flag': out_sosi_flag,
                        'sosi_handling': sosi_handling,
                        'record_length': rlen,
                        'volume_name': volume_name,
                        'library_name': library_name,
                        'catalog_name': catalog_name,
                        'dataset_name': dataset_name
                    }
                }
            }
            
            logger.info(f"EBCDIC conversion successful: {len(ascii_result)} characters")
            return jsonify(result)
            
        except ValueError as e:
            logger.error(f"Invalid hex data: {e}")
            return jsonify({'error': f'Invalid hex data: {str(e)}'}), 400
            
    except Exception as e:
        logger.error(f"EBCDIC dataset conversion failed: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/catalog/dataset', methods=['POST'])
def register_catalog_dataset():
    """Register converted dataset in catalog.json"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        volume = data.get('volume', 'DISK01')
        library = data.get('library', 'TESTLIB')
        dataset = data.get('dataset', '')
        dataset_info = data.get('dataset_info', {})
        
        if not dataset:
            return jsonify({'error': 'Dataset name is required'}), 400
        
        catalog_path = '/home/aspuser/app/config/catalog.json'
        
        # Load existing catalog
        try:
            with open(catalog_path, 'r', encoding='utf-8') as f:
                catalog = json.load(f)
        except FileNotFoundError:
            catalog = {}
        except Exception as e:
            logger.error(f"Failed to load catalog: {e}")
            return jsonify({'error': f'Failed to load catalog: {str(e)}'}), 500
        
        # Ensure volume exists
        if volume not in catalog:
            catalog[volume] = {}
        
        # Ensure library exists
        if library not in catalog[volume]:
            catalog[volume][library] = {}
        
        # Add dataset entry
        catalog[volume][library][dataset] = dataset_info
        
        # Save catalog
        try:
            with open(catalog_path, 'w', encoding='utf-8') as f:
                json.dump(catalog, f, indent=2, ensure_ascii=False)
            
            logger.info(f"Dataset registered in catalog: {volume}.{library}.{dataset}")
            return jsonify({
                'success': True,
                'message': f'Dataset {dataset} registered successfully in {volume}.{library}'
            })
            
        except Exception as e:
            logger.error(f"Failed to save catalog: {e}")
            return jsonify({'error': f'Failed to save catalog: {str(e)}'}), 500
            
    except Exception as e:
        logger.error(f"Dataset registration failed: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/catalog/datasets/<volume>/<library>', methods=['GET'])
def get_catalog_datasets(volume, library):
    """Get all datasets in a library (DBIO-enabled with JSON fallback)"""
    try:
        catalog = get_catalog_data_with_fallback()
        
        if volume not in catalog or library not in catalog[volume]:
            return jsonify({'success': True, 'datasets': {}})
        
        datasets = {}
        for dataset_name, dataset_info in catalog[volume][library].items():
            if isinstance(dataset_info, dict):
                datasets[dataset_name] = dataset_info
        
        return jsonify({
            'success': True,
            'datasets': datasets
        })
        
    except Exception as e:
        logger.error(f"Failed to get datasets: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/config/catalog.json', methods=['GET'])
def serve_catalog_json():
    """Serve catalog data in JSON format (DBIO-enabled with JSON fallback)"""
    try:
        catalog_data = get_catalog_data_with_fallback()
        return jsonify(catalog_data)
    except Exception as e:
        logger.error(f"Failed to serve catalog data: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/catalog/delete', methods=['DELETE'])
def delete_catalog_item():
    """
    カタログアイテム削除エンドポイント
    PostgreSQL DBIOシステム使用してカタログと物理ファイル両方削除
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'リクエストデータが不足しています'}), 400
        
        volume = data.get('volume')
        library = data.get('library') 
        resource_name = data.get('resource_name')
        resource_type = data.get('type', '').upper()
        
        # 必須パラメータチェック
        if not all([volume, library, resource_name]):
            return jsonify({'error': 'volume、library、resource_nameが必須です'}), 400
        
        if not DBIO_AVAILABLE:
            return jsonify({'error': 'DBIO system is not available'}), 503
        
        logger.info(f"[DELETE] Attempting to delete {resource_type} '{resource_name}' from {volume}/{library}")
        
        # タイプに基づいて適切な削除コマンド実行
        if resource_type == 'LIBRARY':
            # ライブラリ削除（DLTLIB使用）
            command = f"DLTLIB LIB-{library},VOL-{volume}"
            success = DLTLIB(command)
            
            if success:
                logger.info(f"[DELETE] Library {volume}/{library} deleted successfully")
                return jsonify({
                    'success': True,
                    'message': f"ライブラリ '{library}' が正常に削除されました",
                    'deleted_item': {
                        'type': 'LIBRARY',
                        'volume': volume,
                        'library': library
                    }
                })
            else:
                logger.error(f"[DELETE] Failed to delete library {volume}/{library}")
                return jsonify({'error': f"ライブラリ '{library}' の削除に失敗しました"}), 500
                
        else:
            # ファイル/データセット削除（DLTFILE使用）
            command = f"DLTFILE FILE({library}/{resource_name}),VOL-{volume}"
            success = DLTFILE(command)
            
            if success:
                logger.info(f"[DELETE] Resource {volume}/{library}/{resource_name} deleted successfully")
                return jsonify({
                    'success': True,
                    'message': f"リソース '{resource_name}' が正常に削除されました",
                    'deleted_item': {
                        'type': resource_type or 'RESOURCE',
                        'volume': volume,
                        'library': library,
                        'resource_name': resource_name
                    }
                })
            else:
                logger.error(f"[DELETE] Failed to delete resource {volume}/{library}/{resource_name}")
                return jsonify({'error': f"リソース '{resource_name}' の削除に失敗しました"}), 500
        
    except Exception as e:
        logger.error(f"[DELETE] Delete operation failed: {e}")
        return jsonify({'error': f'削除処理でエラーが発生しました: {str(e)}'}), 500

@app.route('/api/convert/ebcdic-dataset-cli', methods=['POST'])
def convert_ebcdic_dataset_cli():
    """Upload EBCDIC file and execute actual CLI converter"""
    import subprocess
    import tempfile
    import base64
    
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400
            
        # Get file data and parameters
        file_data = data.get('file_data')  # base64 encoded file content
        file_name = data.get('file_name', 'input.ebc')
        layout_name = data.get('layout_name', 'SAM001')
        volume_name = data.get('volume_name', 'DISK01')
        library_name = data.get('library_name', 'TESTLIB')
        catalog_name = data.get('catalog_name')  # Use catalog_name instead of dataset_name
        dataset_name = data.get('dataset_name', 'converted.out')  # Keep for compatibility
        output_format = data.get('output_format', 'flat')
        japanese_encoding = data.get('japanese_encoding', 'sjis')
        so_code = data.get('so_code', '0x28')
        si_code = data.get('si_code', '0x29')
        sosi_handling = data.get('sosi_handling', 'SPACE')
        
        # Log all incoming parameters from WebUI client (using both logger and print)
        log_message = f"""
=== WebUI Client Request Parameters ===
file_name: {file_name}
layout_name: {layout_name}
volume_name: {volume_name}
library_name: {library_name}
catalog_name: '{catalog_name}' (type: {type(catalog_name)})
dataset_name: '{dataset_name}' (type: {type(dataset_name)})
output_format: {output_format}
japanese_encoding: {japanese_encoding}
so_code: {so_code}
si_code: {si_code}
sosi_handling: {sosi_handling}
==========================================="""
        
        print(log_message)  # Print to console for immediate visibility
        logger.info(log_message)  # Also log to file
        
        if not file_data:
            return jsonify({'error': 'File data is required'}), 400
            
        # Create upload directory
        upload_dir = '/tmp/uploads'
        os.makedirs(upload_dir, exist_ok=True)
        
        # Save uploaded file
        input_file_path = os.path.join(upload_dir, file_name)
        try:
            file_content = base64.b64decode(file_data)
            with open(input_file_path, 'wb') as f:
                f.write(file_content)
        except Exception as e:
            return jsonify({'error': f'Failed to save uploaded file: {str(e)}'}), 500
            
        # Prepare output file path - use catalog_name if provided and not empty
        if catalog_name and catalog_name.strip():
            output_filename = catalog_name.strip()
            logger.info(f"Using catalog_name as output filename: {output_filename}")
        else:
            # Use layout_name as fallback instead of 'converted.out'
            output_filename = layout_name
            logger.info(f"Using layout_name as fallback output filename: {output_filename} (catalog_name was empty)")
            
        logger.info(f"Final output filename: {output_filename}")
        output_file_path = f"volume/{volume_name}/{library_name}/{output_filename}"
        
        # Ensure output directory exists
        output_dir = os.path.dirname(output_file_path)
        os.makedirs(output_dir, exist_ok=True)
        
        # Prepare layout file path
        layout_file_path = f"volume/DISK01/LAYOUT/{layout_name}.LAYOUT"
        
        # Build CLI command
        command = [
            'python', 'ebcdic_dataset_converter.py',
            input_file_path,
            output_file_path,
            layout_file_path,
            '--format', output_format,
            '--japanese-encoding', japanese_encoding
        ]
        
        # Add catalog name option if specified (use the actual output filename)
        if catalog_name and catalog_name.strip():
            command.extend(['--catalog-name', catalog_name.strip()])
            logger.info(f"Added --catalog-name {catalog_name.strip()} to command")
        elif output_filename != layout_name:  # If we're using a different output filename
            command.extend(['--catalog-name', output_filename])
            logger.info(f"Added --catalog-name {output_filename} to command (derived from output filename)")
            
        # Add SOSI options if different from defaults
        if so_code != '0x0E':
            command.extend(['--so-code', so_code])
        if si_code != '0x0F':
            command.extend(['--si-code', si_code])
        if sosi_handling.upper() != 'SPACE':
            command.extend(['--sosi-handling', sosi_handling.upper()])
        if volume_name != 'DISK01':
            command.extend(['--volume', volume_name])
        if library_name != 'TESTLIB':
            command.extend(['--library', library_name])
            
        # Log final CLI command before execution
        final_command_str = ' '.join(command)
        cmd_log = f"""
=== Final CLI Command to Execute ===
Command: {final_command_str}
Working Directory: /home/aspuser/app
===================================="""
        
        print(cmd_log)  # Print to console
        logger.info(cmd_log)  # Log to file
            
        # Execute CLI command
        try:
            result = subprocess.run(
                command,
                cwd='/home/aspuser/app',
                capture_output=True,
                text=True,
                timeout=300  # 5 minutes timeout
            )
            
            executed_command = ' '.join(command)
            
            # Log execution results
            result_log = f"""
=== CLI Command Execution Results ===
Return Code: {result.returncode}
STDOUT: {result.stdout}
STDERR: {result.stderr}
Output File Path: {output_file_path}
Output File Exists: {os.path.exists(output_file_path)}
====================================="""
            
            print(result_log)  # Print to console
            logger.info(result_log)  # Log to file
            
            if result.returncode == 0:
                # Success - read output file if exists
                output_content = ""
                if os.path.exists(output_file_path):
                    with open(output_file_path, 'r', encoding='utf-8', errors='replace') as f:
                        output_content = f.read()
                
                return jsonify({
                    'success': True,
                    'data': {
                        'executed_command': executed_command,
                        'output_file_path': output_file_path,
                        'output_content': output_content[:1000],  # Limit to first 1000 chars
                        'stdout': result.stdout,
                        'stderr': result.stderr,
                        'conversion_options': {
                            'format': output_format,
                            'japanese_encoding': japanese_encoding,
                            'so_code': so_code,
                            'si_code': si_code,
                            'sosi_handling': sosi_handling,
                            'volume_name': volume_name,
                            'library_name': library_name,
                            'catalog_name': catalog_name,
                            'dataset_name': dataset_name
                        }
                    }
                })
            else:
                return jsonify({
                    'success': False,
                    'error': f'CLI execution failed (exit code {result.returncode})',
                    'executed_command': executed_command,
                    'stdout': result.stdout,
                    'stderr': result.stderr
                }), 500
                
        except subprocess.TimeoutExpired:
            return jsonify({'error': 'CLI execution timed out'}), 500
        except Exception as e:
            return jsonify({'error': f'CLI execution failed: {str(e)}'}), 500
            
    except Exception as e:
        logger.error(f"EBCDIC CLI conversion failed: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/dslock/query', methods=['GET'])
def dslock_query():
    """Query dataset locks using dslock_suite CLI"""
    try:
        # Path to dslock_suite dslockctl binary
        dslockctl_path = './dslockctl'
        
        # Check if dslockctl exists (adjust path for working directory)
        full_dslockctl_path = '/home/aspuser/app/ofasp-refactor/dslock_suite/build/dslockctl'
        if not os.path.exists(full_dslockctl_path):
            logger.error(f"dslockctl not found at {full_dslockctl_path}")
            return jsonify({'error': 'dslock suite not available'}), 503
        
        # Get filter parameters
        filter_user = request.args.get('user')
        filter_pid = request.args.get('pid')
        filter_dataset = request.args.get('dataset')
        
        # Set environment with library path (let dslockctl use config.json)
        env = os.environ.copy()
        current_ld_path = env.get('LD_LIBRARY_PATH', '')
        build_path = '/home/aspuser/app/ofasp-refactor/dslock_suite/build'
        env['LD_LIBRARY_PATH'] = build_path + (':' + current_ld_path if current_ld_path else '')
        
        # Don't set DSLOCK_DB - let dslockctl use config.json settings
        
        # Build command
        cmd = [dslockctl_path, 'query']
        if filter_user:
            cmd.extend(['--user', filter_user])
        if filter_pid:
            cmd.extend(['--pid', filter_pid])
        if filter_dataset:
            cmd.extend(['--dataset', filter_dataset])
        
        logger.info(f"Executing dslock query: {' '.join(cmd)}")
        
        # Execute command
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=30,
            cwd='/home/aspuser/app/ofasp-refactor/dslock_suite/build',
            env=env
        )
        
        if result.returncode != 0:
            logger.error(f"dslockctl query failed: {result.stderr}")
            return jsonify({'error': 'Failed to query locks', 'details': result.stderr}), 500
        
        # Parse JSON output
        try:
            locks_data = json.loads(result.stdout) if result.stdout.strip() else []
            return jsonify({'locks': json.dumps(locks_data)})
        except json.JSONDecodeError:
            return jsonify({'locks': '[]'})
        
    except subprocess.TimeoutExpired:
        logger.error("dslock query timeout")
        return jsonify({'error': 'Query timeout'}), 408
    except Exception as e:
        logger.error(f"dslock query error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/dslock/cleanup', methods=['DELETE'])
def dslock_cleanup():
    """Force cleanup dataset locks using dslock_suite CLI"""
    try:
        # Path to dslock_suite dslockctl binary
        dslockctl_path = './dslockctl'
        
        # Check if dslockctl exists (adjust path for working directory)
        full_dslockctl_path = '/home/aspuser/app/ofasp-refactor/dslock_suite/build/dslockctl'
        if not os.path.exists(full_dslockctl_path):
            logger.error(f"dslockctl not found at {full_dslockctl_path}")
            return jsonify({'error': 'dslock suite not available'}), 503
        
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Request data required'}), 400
        
        target_pid = data.get('pid')
        target_dataset = data.get('dataset')
        
        if not target_pid and not target_dataset:
            return jsonify({'error': 'Either pid or dataset must be specified'}), 400
        
        # Set environment with library path (let dslockctl use config.json)
        env = os.environ.copy()
        current_ld_path = env.get('LD_LIBRARY_PATH', '')
        build_path = '/home/aspuser/app/ofasp-refactor/dslock_suite/build'
        env['LD_LIBRARY_PATH'] = build_path + (':' + current_ld_path if current_ld_path else '')
        
        # Don't set DSLOCK_DB - let dslockctl use config.json settings
        
        # Build command
        cmd = [dslockctl_path, 'cleanup']
        if target_pid:
            cmd.extend(['--pid', str(target_pid)])
        if target_dataset:
            cmd.extend(['--dataset', target_dataset])
        
        logger.info(f"Executing dslock cleanup: {' '.join(cmd)}")
        
        # Execute command
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=30,
            cwd='/home/aspuser/app/ofasp-refactor/dslock_suite/build',
            env=env
        )
        
        if result.returncode != 0:
            logger.error(f"dslockctl cleanup failed: {result.stderr}")
            return jsonify({'error': 'Failed to cleanup locks', 'details': result.stderr}), 500
        
        return jsonify({'success': True, 'message': 'Lock cleanup completed'})
        
    except subprocess.TimeoutExpired:
        logger.error("dslock cleanup timeout")
        return jsonify({'error': 'Cleanup timeout'}), 408
    except Exception as e:
        logger.error(f"dslock cleanup error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/', methods=['GET'])
def serve_home():
    """Redirect home to terminal"""
    try:
        return send_from_directory('.', 'asp_terminal.html')
    except Exception as e:
        logger.error(f"Failed to serve home: {e}")
        return f"Terminal interface not available: {e}", 500

if __name__ == '__main__':
    logger.info("OpenASP API Server v0.5.1 starting...")
    logger.info("Enhanced with Multi-Type Program Support (JAVA, COBOL, SHELL)")
    logger.info("Fixed configuration loading and error handling")
    
    # ?? ??
    load_config()
    
    if not SMED_DIR or not os.path.exists(SMED_DIR):
        logger.error(f"SMED directory not found: {SMED_DIR}")
        sys.exit(1)
    
    logger.info(f"? Configuration loaded successfully")
    logger.info(f"?? SMED Files: {len(os.listdir(SMED_DIR)) if os.path.exists(SMED_DIR) else 0}")
    logger.info(f"?? User Accounts: {len(accounts)}")
    logger.info(f"???  SMED-PGM Maps: {len(smed_pgm_config)}")
    logger.info(f"? Java Available: {multi_executor.java_available if multi_executor else False}")
    
    if multi_executor and multi_executor.jar_path:
        if os.path.exists(multi_executor.jar_path):
            logger.info(f"?? JAR File: {multi_executor.jar_path} (EXISTS)")
        else:
            logger.warning(f"?? JAR File: {multi_executor.jar_path} (NOT FOUND)")
    
    logger.info("?? OpenASP SMED API Server ready!")
    logger.info("?? WebSocket support enabled for real-time terminal communication")

# ============================================================
# Enterprise Terminal Session Management API v1.0
# PostgreSQL-based REST API endpoints for admin dashboard
# ============================================================

def format_session_for_api(session_data):
    """Format PostgreSQL session data for API response."""
    return {
        'wsname': session_data.get('wsname'),
        'username': session_data.get('username'),
        'conn_time': session_data.get('conn_time'),
        'status': session_data.get('status'),
        'last_activity': session_data.get('last_activity'),
        'client_ip': session_data.get('client_ip'),
        'program_name': session_data.get('program_name'),
        'session_type': session_data.get('session_type'),
        'created_at': session_data.get('created_at')
    }

@app.route('/api/v1/sessions', methods=['GET'])
def api_v1_get_sessions():
    """Get all terminal sessions with optional filtering."""
    if not postgresql_session_manager:
        return jsonify({'error': 'PostgreSQL session manager not available'}), 503
    
    try:
        # Get query parameters for filtering
        status = request.args.get('status')  # active, inactive, all
        username = request.args.get('username')
        limit = request.args.get('limit', type=int)
        
        sessions = postgresql_session_manager.list_all_sessions()
        
        # Apply filters
        if status and status != 'all':
            sessions = [s for s in sessions if s.get('status') == ('A' if status == 'active' else 'I')]
        
        if username:
            sessions = [s for s in sessions if s.get('username') == username]
        
        if limit:
            sessions = sessions[:limit]
        
        # Format sessions for API response
        formatted_sessions = [format_session_for_api(session) for session in sessions]
        
        logger.info(f"API v1: Retrieved {len(formatted_sessions)} sessions from PostgreSQL")
        return jsonify({
            'sessions': formatted_sessions,
            'total_count': len(formatted_sessions),
            'timestamp': datetime.now().isoformat()
        }), 200
        
    except Exception as e:
        logger.error(f"API v1 sessions list error: {e}")
        return jsonify({'error': 'Failed to retrieve sessions', 'details': str(e)}), 500

@app.route('/api/v1/sessions/<wsname>', methods=['GET'])
def api_v1_get_session(wsname):
    """Get specific terminal session by workstation name."""
    if not postgresql_session_manager:
        return jsonify({'error': 'PostgreSQL session manager not available'}), 503
    
    try:
        session = postgresql_session_manager.get_session_by_workstation(wsname)
        if not session:
            return jsonify({'error': f'Session {wsname} not found'}), 404
        
        formatted_session = format_session_for_api(session)
        logger.info(f"API v1: Retrieved session {wsname} from PostgreSQL")
        return jsonify(formatted_session), 200
        
    except Exception as e:
        logger.error(f"API v1 session retrieval error: {e}")
        return jsonify({'error': 'Failed to retrieve session', 'details': str(e)}), 500

@app.route('/api/v1/sessions', methods=['POST'])
def api_v1_create_session():
    """Create a new terminal session."""
    if not postgresql_session_manager:
        return jsonify({'error': 'PostgreSQL session manager not available'}), 503
    
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        required_fields = ['wsname', 'username']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Missing required field: {field}'}), 400
        
        # Create session with provided data
        session_data = {
            'wsname': data['wsname'],
            'username': data['username'],
            'client_ip': data.get('client_ip', request.remote_addr),
            'program_name': data.get('program_name', ''),
            'session_type': data.get('session_type', 'WEB'),
            'status': data.get('status', 'A')
        }
        
        success = postgresql_session_manager.create_session(
            session_data['wsname'],
            session_data['username'],
            session_data['client_ip'],
            session_data['program_name'],
            session_data['session_type']
        )
        
        if success:
            # Retrieve the created session
            created_session = postgresql_session_manager.get_session_by_workstation(data['wsname'])
            formatted_session = format_session_for_api(created_session)
            
            logger.info(f"API v1: Created session {data['wsname']} in PostgreSQL")
            return jsonify(formatted_session), 201
        else:
            return jsonify({'error': 'Failed to create session'}), 500
            
    except Exception as e:
        logger.error(f"API v1 session creation error: {e}")
        return jsonify({'error': 'Failed to create session', 'details': str(e)}), 500

@app.route('/api/v1/sessions/<wsname>', methods=['PATCH'])
def api_v1_update_session(wsname):
    """Update terminal session status or metadata."""
    if not postgresql_session_manager:
        return jsonify({'error': 'PostgreSQL session manager not available'}), 503
    
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        # Check if session exists
        existing_session = postgresql_session_manager.get_session_by_workstation(wsname)
        if not existing_session:
            return jsonify({'error': f'Session {wsname} not found'}), 404
        
        # Update session (currently supports status updates)
        if 'status' in data:
            success = postgresql_session_manager.update_session_status(wsname, data['status'])
            if not success:
                return jsonify({'error': 'Failed to update session'}), 500
        
        # Retrieve updated session
        updated_session = postgresql_session_manager.get_session_by_workstation(wsname)
        formatted_session = format_session_for_api(updated_session)
        
        logger.info(f"API v1: Updated session {wsname} in PostgreSQL")
        return jsonify(formatted_session), 200
        
    except Exception as e:
        logger.error(f"API v1 session update error: {e}")
        return jsonify({'error': 'Failed to update session', 'details': str(e)}), 500

@app.route('/api/v1/sessions/<wsname>', methods=['DELETE'])
def api_v1_delete_session(wsname):
    """Delete a terminal session."""
    if not postgresql_session_manager:
        return jsonify({'error': 'PostgreSQL session manager not available'}), 503
    
    try:
        # Check if session exists
        existing_session = postgresql_session_manager.get_session_by_workstation(wsname)
        if not existing_session:
            return jsonify({'error': f'Session {wsname} not found'}), 404
        
        success = postgresql_session_manager.cleanup_session(wsname)
        if success:
            logger.info(f"API v1: Deleted session {wsname} from PostgreSQL")
            return jsonify({'message': f'Session {wsname} deleted successfully'}), 200
        else:
            return jsonify({'error': 'Failed to delete session'}), 500
            
    except Exception as e:
        logger.error(f"API v1 session deletion error: {e}")
        return jsonify({'error': 'Failed to delete session', 'details': str(e)}), 500

@app.route('/api/v1/sessions/stats', methods=['GET'])
def api_v1_get_session_stats():
    """Get session statistics for admin dashboard."""
    if not postgresql_session_manager:
        return jsonify({'error': 'PostgreSQL session manager not available'}), 503
    
    try:
        stats = postgresql_session_manager.get_session_statistics()
        logger.info("API v1: Retrieved session statistics from PostgreSQL")
        return jsonify(stats), 200
        
    except Exception as e:
        logger.error(f"API v1 session stats error: {e}")
        return jsonify({'error': 'Failed to retrieve statistics', 'details': str(e)}), 500

@app.route('/api/v1/sessions/cleanup', methods=['POST'])
def api_v1_cleanup_inactive_sessions():
    """Clean up inactive sessions older than specified minutes."""
    if not postgresql_session_manager:
        return jsonify({'error': 'PostgreSQL session manager not available'}), 503
    
    try:
        data = request.get_json() or {}
        minutes = data.get('minutes', 30)  # Default: cleanup sessions older than 30 minutes
        
        cleaned_count = postgresql_session_manager.cleanup_inactive_sessions(minutes)
        
        logger.info(f"API v1: Cleaned up {cleaned_count} inactive sessions from PostgreSQL")
        return jsonify({
            'message': f'Cleaned up {cleaned_count} inactive sessions',
            'cleaned_count': cleaned_count,
            'criteria': f'older than {minutes} minutes'
        }), 200
        
    except Exception as e:
        logger.error(f"API v1 session cleanup error: {e}")
        return jsonify({'error': 'Failed to cleanup sessions', 'details': str(e)}), 500

@app.route('/api/v1/sessions/validate/<wsname>', methods=['GET'])
def api_v1_validate_session(wsname):
    """Check if a workstation name is available for new session."""
    if not postgresql_session_manager:
        return jsonify({'error': 'PostgreSQL session manager not available'}), 503
    
    try:
        # Check if session exists and is active
        existing_session = postgresql_session_manager.get_session_by_workstation(wsname)
        
        if existing_session:
            # Check if session is active (status '1' or 'ON')
            status = existing_session.get('status', '0')
            is_active = status == '1' or status == 'ON'
            
            if is_active:
                logger.info(f"API v1: Workstation {wsname} validation failed - already active")
                return jsonify({
                    'available': False,
                    'error': f'Workstation {wsname} is already active',
                    'existing_session': {
                        'wsname': existing_session.get('wsname'),
                        'username': existing_session.get('username'),
                        'last_activity': existing_session.get('last_activity'),
                        'status': existing_session.get('status')
                    }
                }), 409  # Conflict
            else:
                logger.info(f"API v1: Workstation {wsname} is available (inactive session exists)")
                return jsonify({
                    'available': True,
                    'message': f'Workstation {wsname} is available (will reactivate existing session)'
                }), 200
        else:
            logger.info(f"API v1: Workstation {wsname} is available (new session)")
            return jsonify({
                'available': True,
                'message': f'Workstation {wsname} is available for new session'
            }), 200
            
    except Exception as e:
        logger.error(f"API v1 session validation error: {e}")
        return jsonify({'error': 'Failed to validate session', 'details': str(e)}), 500

if __name__ == "__main__":
    # ?? ?? - Use socketio.run for WebSocket support
    socketio.run(
        app,
        host='0.0.0.0',
        port=8000,
        debug=False,
        allow_unsafe_werkzeug=True
    )
