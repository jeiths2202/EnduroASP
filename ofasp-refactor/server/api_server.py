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
import ctypes
import psutil
import shutil
from pathlib import Path
from datetime import datetime
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import logging
from collections import deque
import uuid
from io import StringIO
import chardet
import codecs

# 통합 로깅 설정 - 모든 서버 로그를 api_server.log에 출력
import os
log_file = os.path.join(os.path.dirname(__file__), 'api_server.log')
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
    handlers=[
        logging.FileHandler(log_file, encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app, origins=['http://localhost:3005', 'http://localhost:3000', 'http://localhost:3007', 'http://localhost:3006'])

# ?? ??
VOLUME_ROOT = "/home/aspuser/app/volume"
SMED_DIR = None
ACCOUNT_FILE = None
SMED_PGM_FILE = None
MAP_PGM_FILE = None
accounts = {}
smed_pgm_config = {}
map_pgm_config = {}
java_manager = None

# Log storage (keep last 1000 logs)
execution_logs = deque(maxlen=1000)

def convert_sjis_to_unicode(raw_bytes):
    """
    Convert Shift-JIS encoded bytes to Unicode string
    Uses simple SJIS decoding like ASP Terminal (working method)
    """
    logger.info(f"SJIS Conversion DEBUG: Using simple SJIS decoding (ASP Terminal method)")
    print(f"CONSOLE DEBUG: SJIS conversion using simple method", flush=True)
    
    try:
        # Use the same method as ASP Terminal's /api/smed/parse endpoint
        # This method works correctly for displaying Japanese text
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
    """?? ??? ??"""
    global SMED_DIR, ACCOUNT_FILE, SMED_PGM_FILE, MAP_PGM_FILE
    global accounts, smed_pgm_config, map_pgm_config, multi_executor
    
    # ?? ?? ??
    script_dir = os.path.dirname(os.path.abspath(__file__))
    app_dir = os.path.dirname(script_dir)
    
    SMED_DIR = os.path.join(app_dir, 'public', 'SMED_FILES')
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
    """?? ??"""
    return jsonify({
        'status': 'OK',
        'version': 'v0.5.1',
        'smed_dir': SMED_DIR,
        'accounts_loaded': len(accounts),
        'smed_pgm_maps': len(smed_pgm_config),
        'map_pgm_maps': len(map_pgm_config.get('maps', {})),
        'java_available': multi_executor.java_available if multi_executor else False,
        'jar_exists': os.path.exists(multi_executor.jar_path) if multi_executor and multi_executor.jar_path else False
    })

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

@app.route('/api/login', methods=['POST'])
def login():
    """??? ???"""
    data = request.get_json()
    user_id = data.get('user_id')
    password = data.get('password')
    
    if not user_id or not password:
        return jsonify({'error': 'User ID and password required'}), 400
    
    if user_id not in accounts:
        return jsonify({'error': 'Invalid user ID'}), 401
    
    if accounts[user_id].get('password') != password:
        return jsonify({'error': 'Invalid password'}), 401
    
    # ??? ?? ? ??? ???? ?? ??
    user_program = accounts[user_id].get('pgm', 'PGM1')
    
    logger.info(f"User {user_id} logged in successfully")
    add_log('INFO', 'LOGIN', f'User {user_id} logged in successfully', {'user_id': user_id, 'program': user_program})
    
    return jsonify({
        'success': True,
        'message': 'Login successful',
        'user_id': user_id,
        'program': user_program
    })

@app.route('/api/execute', methods=['POST'])
def execute_program():
    """???? ??"""
    data = request.get_json()
    
    user_id = data.get('user_id')
    map_name = data.get('map_name', '')
    input_fields = data.get('input_fields', {})
    
    if not user_id:
        return jsonify({'error': 'User ID required'}), 400
    
    if user_id not in accounts:
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
        program = data.get('program') or accounts[user_id].get('pgm', 'PGM1')
        
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
                # Last resort - read as binary and decode
                with open(file_path, 'rb') as f:
                    raw_content = f.read()
                content = raw_content.decode('shift_jis', errors='replace')
        
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

@app.route('/api/smed/key-event', methods=['POST'])
def handle_smed_key_event():
    """Handle SMED key event from web interface"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        program_name = data.get('program_name', 'unknown')
        session_id = data.get('session_id', 'default')
        key = data.get('key', '')
        field_values = data.get('field_values', {})
        
        logger.info(f"SMED key event: program={program_name}, key={key}, session={session_id}")
        
        # Handle function keys based on program logic
        # For now, implement default behavior
        response = {
            'success': True,
            'action': None,
            'message': f'Key {key} processed'
        }
        
        # Default function key behaviors
        if key == 'F3':
            # F3 typically means exit/cancel
            response['action'] = 'close'
            response['message'] = 'Exit requested'
            logger.info(f"Program {program_name} requested exit via F3")
        elif key == 'F1':
            # F1 typically means help
            response['action'] = 'help'
            response['message'] = 'Help requested'
        elif key == 'F12':
            # F12 also typically means cancel/return
            response['action'] = 'close'
            response['message'] = 'Cancel requested'
        elif key in ['F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11']:
            # Other function keys - program specific
            response['action'] = 'continue'
            response['message'] = f'Function key {key} handled by program'
        
        # Log the key event
        add_log('INFO', f'SMED/{program_name}', f'Key event: {key}', {
            'session_id': session_id,
            'key': key,
            'field_values': field_values,
            'action': response['action']
        })
        
        return jsonify(response)
        
    except Exception as e:
        logger.error(f"Failed to handle SMED key event: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/catalog/maps', methods=['GET'])
def get_catalog_maps():
    """Get all MAP type resources from catalog.json"""
    try:
        catalog_path = os.path.join(os.path.dirname(__file__), '..', 'config', 'catalog.json')
        
        if not os.path.exists(catalog_path):
            return jsonify({'error': 'Catalog file not found'}), 404
        
        with open(catalog_path, 'r', encoding='utf-8') as f:
            catalog = json.load(f)
        
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
    """Get all volumes from catalog.json"""
    try:
        catalog_path = os.path.join(os.path.dirname(__file__), '..', 'config', 'catalog.json')
        
        if not os.path.exists(catalog_path):
            return jsonify({'error': 'Catalog file not found'}), 404
        
        with open(catalog_path, 'r', encoding='utf-8') as f:
            catalog = json.load(f)
        
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
    """Get all libraries for a specific volume"""
    try:
        catalog_path = os.path.join(os.path.dirname(__file__), '..', 'config', 'catalog.json')
        
        if not os.path.exists(catalog_path):
            return jsonify({'error': 'Catalog file not found'}), 404
        
        with open(catalog_path, 'r', encoding='utf-8') as f:
            catalog = json.load(f)
        
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
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'Request body required'}), 400
        
        command = data.get('command', '').strip()
        user = data.get('user', 'unknown')
        
        if not command:
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
    """Execute ASP command using aspcli.py"""
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
        
        logger.info(f"Executing ASP command: {command} for user: {user}")
        
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
        
        stdout_bytes, stderr_bytes = process.communicate(timeout=60)
        
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

# ========================================
# Encoding Conversion API Endpoints
# ========================================

class EncodingConverter:
    """UTF-8와 SJIS 간의 인코딩 변환을 처리하는 클래스"""
    
    @staticmethod
    def detect_encoding(data):
        """문자열 또는 바이너리 데이터의 인코딩을 자동 감지"""
        try:
            if isinstance(data, str):
                # 문자열인 경우 바이트로 변환하여 감지
                test_bytes = data.encode('utf-8')
                result = chardet.detect(test_bytes)
            else:
                # 바이너리 데이터인 경우 직접 감지
                result = chardet.detect(data)
            
            encoding = result.get('encoding', 'unknown').lower()
            confidence = result.get('confidence', 0.0)
            
            # SJIS 계열 인코딩 정규화
            if encoding in ['shift_jis', 'shift-jis', 'sjis', 'cp932', 'windows-31j']:
                encoding = 'shift_jis'
            elif encoding in ['utf-8', 'utf8']:
                encoding = 'utf-8'
            
            return {
                'encoding': encoding,
                'confidence': confidence,
                'is_japanese': encoding == 'shift_jis' or confidence > 0.8
            }
        except Exception as e:
            logger.error(f"Encoding detection failed: {e}")
            return {
                'encoding': 'unknown',
                'confidence': 0.0,
                'is_japanese': False,
                'error': str(e)
            }
    
    @staticmethod
    def utf8_to_sjis(text, error_handling='replace'):
        """UTF-8 문자열을 SJIS로 변환"""
        try:
            if not isinstance(text, str):
                raise ValueError("Input must be a string")
            
            # UTF-8에서 SJIS로 변환
            sjis_bytes = text.encode('shift_jis', errors=error_handling)
            
            return {
                'success': True,
                'converted': sjis_bytes.decode('shift_jis'),
                'hex_output': sjis_bytes.hex().upper(),
                'byte_length': len(sjis_bytes),
                'original_length': len(text),
                'encoding_info': {
                    'source': 'utf-8',
                    'target': 'shift_jis',
                    'error_handling': error_handling
                }
            }
        except UnicodeEncodeError as e:
            # 변환할 수 없는 문자가 있는 경우
            if error_handling == 'strict':
                raise
            
            # 대체 문자 사용하여 재시도
            sjis_bytes = text.encode('shift_jis', errors='replace')
            
            return {
                'success': True,
                'converted': sjis_bytes.decode('shift_jis'),
                'hex_output': sjis_bytes.hex().upper(),
                'byte_length': len(sjis_bytes),
                'original_length': len(text),
                'warnings': [f"Character encoding error at position {e.start}: {e.reason}"],
                'encoding_info': {
                    'source': 'utf-8',
                    'target': 'shift_jis',
                    'error_handling': error_handling,
                    'fallback_used': True
                }
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'encoding_info': None
            }
    
    @staticmethod
    def sjis_to_utf8(data, error_handling='replace'):
        """SJIS 데이터를 UTF-8로 변환"""
        try:
            # 입력 데이터 처리
            if isinstance(data, str):
                # 헥스 문자열인지 확인
                if all(c in '0123456789ABCDEFabcdef' for c in data.replace(' ', '')):
                    # 헥스 문자열을 바이트로 변환
                    hex_clean = data.replace(' ', '')
                    if len(hex_clean) % 2 != 0:
                        raise ValueError("Invalid hex string length")
                    sjis_bytes = bytes.fromhex(hex_clean)
                else:
                    # 일반 문자열을 SJIS 바이트로 가정
                    sjis_bytes = data.encode('shift_jis')
            else:
                sjis_bytes = data
            
            # SJIS에서 UTF-8로 변환
            utf8_text = sjis_bytes.decode('shift_jis', errors=error_handling)
            
            return {
                'success': True,
                'converted': utf8_text,
                'byte_length': len(sjis_bytes),
                'char_length': len(utf8_text),
                'encoding_info': {
                    'source': 'shift_jis',
                    'target': 'utf-8',
                    'error_handling': error_handling
                }
            }
        except UnicodeDecodeError as e:
            # 변환할 수 없는 바이트가 있는 경우
            if error_handling == 'strict':
                raise
            
            # 대체 문자 사용하여 재시도
            utf8_text = sjis_bytes.decode('shift_jis', errors='replace')
            
            return {
                'success': True,
                'converted': utf8_text,
                'byte_length': len(sjis_bytes),
                'char_length': len(utf8_text),
                'warnings': [f"Byte decoding error at position {e.start}: {e.reason}"],
                'encoding_info': {
                    'source': 'shift_jis',
                    'target': 'utf-8',
                    'error_handling': error_handling,
                    'fallback_used': True
                }
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'encoding_info': None
            }
    
    @staticmethod
    def batch_convert(texts, source_encoding, target_encoding, error_handling='replace'):
        """여러 문자열을 배치로 변환"""
        if not isinstance(texts, list):
            return {
                'success': False,
                'error': 'Input must be a list of strings'
            }
        
        results = []
        errors = []
        
        for i, text in enumerate(texts):
            try:
                if source_encoding == 'utf-8' and target_encoding == 'shift_jis':
                    result = EncodingConverter.utf8_to_sjis(text, error_handling)
                elif source_encoding == 'shift_jis' and target_encoding == 'utf-8':
                    result = EncodingConverter.sjis_to_utf8(text, error_handling)
                else:
                    result = {
                        'success': False,
                        'error': f'Unsupported conversion: {source_encoding} -> {target_encoding}'
                    }
                
                result['index'] = i
                results.append(result)
                
                if not result['success']:
                    errors.append(f"Index {i}: {result.get('error', 'Unknown error')}")
                    
            except Exception as e:
                error_result = {
                    'success': False,
                    'error': str(e),
                    'index': i
                }
                results.append(error_result)
                errors.append(f"Index {i}: {str(e)}")
        
        return {
            'success': len(errors) == 0,
            'results': results,
            'total_count': len(texts),
            'success_count': len([r for r in results if r['success']]),
            'error_count': len(errors),
            'errors': errors
        }

@app.route('/api/encoding/utf8-to-sjis', methods=['POST'])
def utf8_to_sjis():
    """UTF-8 문자열을 SJIS로 변환"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'Request body required'}), 400
        
        text = data.get('text', '')
        error_handling = data.get('error_handling', 'replace')
        
        if not text:
            return jsonify({'error': 'Text parameter required'}), 400
        
        logger.info(f"UTF-8 to SJIS conversion request: {len(text)} characters")
        add_log('INFO', 'ENCODING', f'UTF-8 to SJIS conversion started', {
            'text_length': len(text),
            'error_handling': error_handling
        })
        
        result = EncodingConverter.utf8_to_sjis(text, error_handling)
        
        if result['success']:
            add_log('INFO', 'ENCODING', f'UTF-8 to SJIS conversion completed', {
                'original_length': result['original_length'],
                'byte_length': result['byte_length']
            })
        else:
            add_log('ERROR', 'ENCODING', f'UTF-8 to SJIS conversion failed', {
                'error': result['error']
            })
        
        return jsonify(result)
        
    except Exception as e:
        error_msg = str(e)
        logger.error(f"UTF-8 to SJIS conversion API error: {error_msg}")
        add_log('ERROR', 'ENCODING', f'UTF-8 to SJIS API error: {error_msg}', {'error': error_msg})
        return jsonify({'error': error_msg}), 500

@app.route('/api/encoding/sjis-to-utf8', methods=['POST'])
def sjis_to_utf8():
    """SJIS 데이터를 UTF-8로 변환"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'Request body required'}), 400
        
        sjis_data = data.get('data', '')
        error_handling = data.get('error_handling', 'replace')
        
        if not sjis_data:
            return jsonify({'error': 'Data parameter required'}), 400
        
        logger.info(f"SJIS to UTF-8 conversion request")
        add_log('INFO', 'ENCODING', f'SJIS to UTF-8 conversion started', {
            'data_type': type(sjis_data).__name__,
            'error_handling': error_handling
        })
        
        result = EncodingConverter.sjis_to_utf8(sjis_data, error_handling)
        
        if result['success']:
            add_log('INFO', 'ENCODING', f'SJIS to UTF-8 conversion completed', {
                'byte_length': result['byte_length'],
                'char_length': result['char_length']
            })
        else:
            add_log('ERROR', 'ENCODING', f'SJIS to UTF-8 conversion failed', {
                'error': result['error']
            })
        
        return jsonify(result)
        
    except Exception as e:
        error_msg = str(e)
        logger.error(f"SJIS to UTF-8 conversion API error: {error_msg}")
        add_log('ERROR', 'ENCODING', f'SJIS to UTF-8 API error: {error_msg}', {'error': error_msg})
        return jsonify({'error': error_msg}), 500

@app.route('/api/encoding/batch-convert', methods=['POST'])
def batch_convert():
    """배치 변환 - 여러 문자열을 한 번에 변환"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'Request body required'}), 400
        
        texts = data.get('texts', [])
        source_encoding = data.get('source_encoding', 'utf-8')
        target_encoding = data.get('target_encoding', 'shift_jis')
        error_handling = data.get('error_handling', 'replace')
        
        if not texts:
            return jsonify({'error': 'Texts parameter required'}), 400
        
        if not isinstance(texts, list):
            return jsonify({'error': 'Texts must be an array'}), 400
        
        logger.info(f"Batch conversion request: {len(texts)} items, {source_encoding} -> {target_encoding}")
        add_log('INFO', 'ENCODING', f'Batch conversion started', {
            'item_count': len(texts),
            'source_encoding': source_encoding,
            'target_encoding': target_encoding,
            'error_handling': error_handling
        })
        
        result = EncodingConverter.batch_convert(texts, source_encoding, target_encoding, error_handling)
        
        add_log('INFO', 'ENCODING', f'Batch conversion completed', {
            'total_count': result['total_count'],
            'success_count': result['success_count'],
            'error_count': result['error_count']
        })
        
        return jsonify(result)
        
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Batch conversion API error: {error_msg}")
        add_log('ERROR', 'ENCODING', f'Batch conversion API error: {error_msg}', {'error': error_msg})
        return jsonify({'error': error_msg}), 500

@app.route('/api/encoding/detect', methods=['POST'])
def detect_encoding():
    """인코딩 자동 감지"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'Request body required'}), 400
        
        text_data = data.get('data', '')
        
        if not text_data:
            return jsonify({'error': 'Data parameter required'}), 400
        
        logger.info(f"Encoding detection request")
        add_log('INFO', 'ENCODING', f'Encoding detection started', {
            'data_type': type(text_data).__name__,
            'data_length': len(text_data) if isinstance(text_data, str) else len(str(text_data))
        })
        
        result = EncodingConverter.detect_encoding(text_data)
        
        add_log('INFO', 'ENCODING', f'Encoding detection completed', {
            'detected_encoding': result['encoding'],
            'confidence': result['confidence'],
            'is_japanese': result['is_japanese']
        })
        
        return jsonify({
            'success': True,
            'detection': result
        })
        
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Encoding detection API error: {error_msg}")
        add_log('ERROR', 'ENCODING', f'Encoding detection API error: {error_msg}', {'error': error_msg})
        return jsonify({'error': error_msg}), 500

# WebSocket과 SMED 통합을 위한 추가 엔드포인트
@app.route('/api/encoding/smed-convert', methods=['POST'])
def smed_convert():
    """SMED 파일 내용의 인코딩 변환 (Position-based API와 연동)"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'Request body required'}), 400
        
        map_name = data.get('map_name', '')
        field_data = data.get('field_data', [])
        source_encoding = data.get('source_encoding', 'shift_jis')
        target_encoding = data.get('target_encoding', 'utf-8')
        error_handling = data.get('error_handling', 'replace')
        terminal_id = data.get('terminal_id', 'TERM001')
        wsname = data.get('wsname', 'DEFAULT')
        
        if not map_name:
            return jsonify({'error': 'Map name required'}), 400
        
        if not isinstance(field_data, list):
            return jsonify({'error': 'Field data must be an array'}), 400
        
        logger.info(f"SMED encoding conversion: {map_name}, {len(field_data)} fields")
        add_log('INFO', 'SMED_ENCODING', f'SMED conversion started', {
            'map_name': map_name,
            'field_count': len(field_data),
            'source_encoding': source_encoding,
            'target_encoding': target_encoding,
            'terminal_id': terminal_id,
            'wsname': wsname
        })
        
        # 배치 변환 수행
        conversion_result = EncodingConverter.batch_convert(
            field_data, source_encoding, target_encoding, error_handling
        )
        
        if conversion_result['success']:
            # 변환된 데이터 추출
            converted_fields = [
                result.get('converted', '') if result['success'] else result.get('error', '')
                for result in conversion_result['results']
            ]
            
            # Position-based rendering을 위한 응답 형식
            smed_response = {
                'success': True,
                'map_name': map_name,
                'field_data': converted_fields,
                'encoding_info': {
                    'source': source_encoding,
                    'target': target_encoding,
                    'error_handling': error_handling
                },
                'conversion_stats': {
                    'total_fields': conversion_result['total_count'],
                    'success_fields': conversion_result['success_count'],
                    'error_fields': conversion_result['error_count']
                },
                'terminal_info': {
                    'terminal_id': terminal_id,
                    'wsname': wsname
                }
            }
            
            # 에러가 있는 경우 경고 포함
            if conversion_result['error_count'] > 0:
                smed_response['warnings'] = conversion_result['errors']
            
            add_log('INFO', 'SMED_ENCODING', f'SMED conversion completed', {
                'map_name': map_name,
                'success_fields': conversion_result['success_count'],
                'error_fields': conversion_result['error_count']
            })
            
            return jsonify(smed_response)
        else:
            add_log('ERROR', 'SMED_ENCODING', f'SMED conversion failed', {
                'map_name': map_name,
                'errors': conversion_result['errors']
            })
            
            return jsonify({
                'success': False,
                'error': 'Batch conversion failed',
                'details': conversion_result['errors']
            }), 500
        
    except Exception as e:
        error_msg = str(e)
        logger.error(f"SMED encoding conversion API error: {error_msg}")
        add_log('ERROR', 'SMED_ENCODING', f'SMED conversion API error: {error_msg}', {'error': error_msg})
        return jsonify({'error': error_msg}), 500

@app.route('/api/encoding/websocket-convert', methods=['POST'])
def websocket_convert():
    """WebSocket 메시지의 실시간 인코딩 변환"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'Request body required'}), 400
        
        message = data.get('message', '')
        source_encoding = data.get('source_encoding', 'shift_jis')
        target_encoding = data.get('target_encoding', 'utf-8')
        error_handling = data.get('error_handling', 'replace')
        session_id = data.get('session_id', 'default')
        message_type = data.get('message_type', 'data')
        
        if not message:
            return jsonify({'error': 'Message required'}), 400
        
        logger.info(f"WebSocket encoding conversion: {session_id}, type: {message_type}")
        add_log('INFO', 'WS_ENCODING', f'WebSocket conversion started', {
            'session_id': session_id,
            'message_type': message_type,
            'source_encoding': source_encoding,
            'target_encoding': target_encoding,
            'message_length': len(message)
        })
        
        # 단일 메시지 변환
        if source_encoding == 'utf-8' and target_encoding == 'shift_jis':
            result = EncodingConverter.utf8_to_sjis(message, error_handling)
        elif source_encoding == 'shift_jis' and target_encoding == 'utf-8':
            result = EncodingConverter.sjis_to_utf8(message, error_handling)
        else:
            return jsonify({
                'error': f'Unsupported conversion: {source_encoding} -> {target_encoding}'
            }), 400
        
        if result['success']:
            ws_response = {
                'success': True,
                'converted_message': result['converted'],
                'original_message': message,
                'session_id': session_id,
                'message_type': message_type,
                'encoding_info': result['encoding_info'],
                'timestamp': datetime.now().isoformat()
            }
            
            # 추가 정보 포함
            if 'hex_output' in result:
                ws_response['hex_output'] = result['hex_output']
            if 'warnings' in result:
                ws_response['warnings'] = result['warnings']
            
            add_log('INFO', 'WS_ENCODING', f'WebSocket conversion completed', {
                'session_id': session_id,
                'message_type': message_type,
                'success': True
            })
            
            return jsonify(ws_response)
        else:
            add_log('ERROR', 'WS_ENCODING', f'WebSocket conversion failed', {
                'session_id': session_id,
                'error': result['error']
            })
            
            return jsonify({
                'success': False,
                'error': result['error'],
                'session_id': session_id,
                'message_type': message_type
            }), 500
        
    except Exception as e:
        error_msg = str(e)
        logger.error(f"WebSocket encoding conversion API error: {error_msg}")
        add_log('ERROR', 'WS_ENCODING', f'WebSocket conversion API error: {error_msg}', {'error': error_msg})
        return jsonify({'error': error_msg}), 500

@app.route('/api/encoding/status', methods=['GET'])
def encoding_status():
    """인코딩 변환 서비스 상태 확인"""
    try:
        # Python 인코딩 지원 확인
        encodings_supported = []
        test_string = "テスト文字列"  # 일본어 테스트 문자열
        
        # UTF-8 지원 확인
        try:
            test_string.encode('utf-8')
            encodings_supported.append('utf-8')
        except:
            pass
        
        # SJIS 지원 확인
        try:
            test_string.encode('shift_jis')
            encodings_supported.append('shift_jis')
        except:
            pass
        
        # chardet 라이브러리 확인
        chardet_available = False
        try:
            import chardet
            chardet_available = True
        except ImportError:
            pass
        
        # 시스템 정보
        import locale
        system_encoding = locale.getpreferredencoding()
        
        status_info = {
            'service_status': 'active',
            'encodings_supported': encodings_supported,
            'chardet_available': chardet_available,
            'system_encoding': system_encoding,
            'api_endpoints': [
                'POST /api/encoding/utf8-to-sjis',
                'POST /api/encoding/sjis-to-utf8',
                'POST /api/encoding/batch-convert',
                'POST /api/encoding/detect',
                'POST /api/encoding/smed-convert',
                'POST /api/encoding/websocket-convert',
                'GET /api/encoding/status'
            ],
            'features': {
                'japanese_support': 'shift_jis' in encodings_supported,
                'korean_support': True,  # UTF-8로 처리 가능
                'batch_processing': True,
                'auto_detection': chardet_available,
                'websocket_integration': True,
                'smed_integration': True,
                'error_handling': ['strict', 'replace', 'ignore']
            },
            'performance': {
                'max_batch_size': 1000,
                'max_message_size': 1024 * 1024,  # 1MB
                'timeout_seconds': 30
            }
        }
        
        return jsonify({
            'success': True,
            'status': status_info
        })
        
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Encoding status API error: {error_msg}")
        return jsonify({'error': error_msg}), 500

@app.route('/api/catalog/dataset', methods=['POST'])
def register_dataset():
    """Register a new dataset in catalog.json"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'Request body required'}), 400
        
        volume = data.get('volume')
        library = data.get('library')
        dataset = data.get('dataset')
        dataset_info = data.get('dataset_info', {})
        
        if not all([volume, library, dataset]):
            return jsonify({'error': 'Volume, library, and dataset parameters required'}), 400
        
        # Security check: prevent path traversal
        for param in [volume, library, dataset]:
            if '..' in param or '/' in param or '\\' in param:
                return jsonify({'error': 'Invalid parameter contains path traversal'}), 400
        
        catalog_path = os.path.join(os.path.dirname(__file__), '..', 'config', 'catalog.json')
        
        # Load existing catalog or create new one
        catalog = {}
        if os.path.exists(catalog_path):
            try:
                with open(catalog_path, 'r', encoding='utf-8') as f:
                    catalog = json.load(f)
            except Exception as e:
                logger.error(f"Failed to load existing catalog: {e}")
        
        # Initialize volume if it doesn't exist
        if volume not in catalog:
            catalog[volume] = {}
        
        # Initialize library if it doesn't exist
        if library not in catalog[volume]:
            catalog[volume][library] = {}
        
        # Set default dataset info
        default_info = {
            'TYPE': 'DATASET',
            'RECFM': 'FB',
            'LRECL': 80,
            'ENCODING': 'JP',
            'DESCRIPTION': f'Dataset registered from UI conversion: {dataset}',
            'CREATED': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        }
        
        # Merge provided info with defaults
        final_info = {**default_info, **dataset_info}
        
        # Register the dataset
        catalog[volume][library][dataset] = final_info
        
        # Save updated catalog
        try:
            with open(catalog_path, 'w', encoding='utf-8') as f:
                json.dump(catalog, f, indent=2, ensure_ascii=False)
            
            logger.info(f"Dataset registered successfully: {volume}/{library}/{dataset}")
            
            return jsonify({
                'success': True,
                'message': f'Dataset {volume}/{library}/{dataset} registered successfully',
                'dataset_info': final_info
            })
            
        except Exception as e:
            logger.error(f"Failed to save catalog: {e}")
            return jsonify({'error': f'Failed to save catalog: {str(e)}'}), 500
        
    except Exception as e:
        logger.error(f"Dataset registration error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/catalog/datasets/<volume>/<library>', methods=['GET'])
def get_catalog_datasets(volume, library):
    """Get all datasets for a specific volume/library combination"""
    try:
        catalog_path = os.path.join(os.path.dirname(__file__), '..', 'config', 'catalog.json')
        
        if not os.path.exists(catalog_path):
            return jsonify({'error': 'Catalog file not found'}), 404
        
        with open(catalog_path, 'r', encoding='utf-8') as f:
            catalog = json.load(f)
        
        if volume not in catalog:
            return jsonify({'error': f'Volume {volume} not found'}), 404
        
        if library not in catalog[volume]:
            return jsonify({'error': f'Library {library} not found in volume {volume}'}), 404
        
        datasets = catalog[volume][library]
        
        return jsonify({
            'success': True,
            'volume': volume,
            'library': library,
            'datasets': datasets,
            'count': len(datasets)
        })
        
    except Exception as e:
        logger.error(f"Failed to get datasets: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/execute/java', methods=['POST'])
def execute_java_from_cobol():
    """Execute Java code converted from COBOL"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'Request body required'}), 400
        
        java_code = data.get('java_code')
        class_name = data.get('class_name', 'CobolProgram')
        input_data = data.get('input_data', '')
        timeout = data.get('timeout', 30)
        
        if not java_code:
            return jsonify({'error': 'java_code parameter required'}), 400
        
        logger.info(f"Java execution request for class: {class_name}")
        add_log('INFO', 'JAVA_EXECUTE', f'Java execution started for class: {class_name}', {
            'class_name': class_name,
            'code_length': len(java_code),
            'has_input': bool(input_data)
        })
        
        # Create temporary directory for Java files
        import tempfile
        with tempfile.TemporaryDirectory() as temp_dir:
            java_file_path = os.path.join(temp_dir, f"{class_name}.java")
            
            # Write Java code to file
            with open(java_file_path, 'w', encoding='utf-8') as f:
                f.write(java_code)
            
            logger.info(f"Java file created: {java_file_path}")
            
            try:
                # Compile Java code
                logger.info("Starting Java compilation...")
                compile_process = subprocess.run(
                    ['javac', java_file_path],
                    cwd=temp_dir,
                    capture_output=True,
                    text=True,
                    timeout=timeout
                )
                
                if compile_process.returncode != 0:
                    error_msg = f"Java compilation failed:\n{compile_process.stderr}"
                    logger.error(error_msg)
                    add_log('ERROR', 'JAVA_EXECUTE', 'Java compilation failed', {
                        'class_name': class_name,
                        'error': compile_process.stderr
                    })
                    return jsonify({
                        'success': False,
                        'error': 'Compilation failed',
                        'details': compile_process.stderr,
                        'stage': 'compilation'
                    }), 400
                
                logger.info("Java compilation successful")
                
                # Execute Java program
                logger.info("Starting Java execution...")
                execution_start = time.time()
                
                execute_process = subprocess.run(
                    ['java', class_name],
                    cwd=temp_dir,
                    input=input_data,
                    capture_output=True,
                    text=True,
                    timeout=timeout
                )
                
                execution_time = time.time() - execution_start
                
                # Prepare output
                output_lines = []
                output_lines.append("Compiling Java code...")
                output_lines.append(f"javac {class_name}.java")
                output_lines.append("")
                output_lines.append("Running Java application...")
                output_lines.append(f"java {class_name}")
                output_lines.append("")
                
                if execute_process.stdout:
                    output_lines.append(execute_process.stdout)
                
                if execute_process.stderr:
                    output_lines.append("STDERR:")
                    output_lines.append(execute_process.stderr)
                
                if execute_process.returncode == 0:
                    output_lines.append("")
                    output_lines.append("Execution completed successfully.")
                else:
                    output_lines.append("")
                    output_lines.append(f"Execution failed with exit code: {execute_process.returncode}")
                
                output = "\n".join(output_lines)
                
                result = {
                    'success': execute_process.returncode == 0,
                    'output': output,
                    'stdout': execute_process.stdout,
                    'stderr': execute_process.stderr,
                    'return_code': execute_process.returncode,
                    'execution_time': round(execution_time, 2),
                    'stage': 'execution'
                }
                
                logger.info(f"Java execution completed - Return code: {execute_process.returncode}, Time: {execution_time:.2f}s")
                add_log('INFO', 'JAVA_EXECUTE', f'Java execution completed for class: {class_name}', {
                    'class_name': class_name,
                    'return_code': execute_process.returncode,
                    'execution_time': execution_time,
                    'success': execute_process.returncode == 0
                })
                
                return jsonify(result)
                
            except subprocess.TimeoutExpired:
                error_msg = f"Java execution timeout after {timeout} seconds"
                logger.error(error_msg)
                add_log('ERROR', 'JAVA_EXECUTE', 'Java execution timeout', {
                    'class_name': class_name,
                    'timeout': timeout
                })
                return jsonify({
                    'success': False,
                    'error': 'Execution timeout',
                    'details': error_msg,
                    'stage': 'execution'
                }), 408
                
            except Exception as exec_error:
                error_msg = f"Java execution error: {str(exec_error)}"
                logger.error(error_msg)
                add_log('ERROR', 'JAVA_EXECUTE', 'Java execution error', {
                    'class_name': class_name,
                    'error': str(exec_error)
                })
                return jsonify({
                    'success': False,
                    'error': 'Execution error',
                    'details': str(exec_error),
                    'stage': 'execution'
                }), 500
        
    except Exception as e:
        error_msg = f"Java execution API error: {str(e)}"
        logger.error(error_msg)
        add_log('ERROR', 'JAVA_EXECUTE', 'Java execution API error', {'error': str(e)})
        return jsonify({'error': error_msg}), 500

@app.route('/api/convert/ebcdic-dataset', methods=['POST'])
def convert_ebcdic_dataset():
    """Convert EBCDIC dataset using the enhanced dataset converter"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'Request body required'}), 400
        
        input_data = data.get('input_data')
        encoding = data.get('encoding', 'JP')
        japanese_encoding = data.get('japanese_encoding', 'utf-8')
        output_format = data.get('output_format', 'json')
        sosi_handling = data.get('sosi_handling', 'remove')
        
        if not input_data:
            return jsonify({'error': 'input_data parameter required'}), 400
        
        # Import the EBCDIC dataset converter
        import sys
        import os
        converter_path = os.path.join(os.path.dirname(__file__), '..', '..', 'ebcdic_dataset_converter.py')
        
        if os.path.exists(converter_path):
            # Add the directory to Python path
            converter_dir = os.path.dirname(converter_path)
            if converter_dir not in sys.path:
                sys.path.insert(0, converter_dir)
            
            # Import the converter module
            import importlib.util
            spec = importlib.util.spec_from_file_location("ebcdic_dataset_converter", converter_path)
            converter_module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(converter_module)
            
            # Create converter instance
            converter = converter_module.EBCDICDatasetConverter()
            
            try:
                # Convert hex string back to bytes
                if len(input_data) % 2 != 0:
                    return jsonify({'error': 'Invalid hex input data'}), 400
                
                byte_data = bytes.fromhex(input_data)
                
                # Convert using the enhanced converter
                if encoding == 'JAK':
                    # Use JAK conversion
                    converted_data = converter._convert_jak_field(byte_data, japanese_encoding)
                else:
                    # Use standard EBCDIC conversion
                    converted_data = converter._convert_standard_field(byte_data, encoding)
                
                # Handle SOSI codes if needed
                if sosi_handling == 'remove':
                    converted_data = converted_data.replace('\x0E', '').replace('\x0F', '')
                elif sosi_handling == 'space':
                    converted_data = converted_data.replace('\x0E', ' ').replace('\x0F', ' ')
                
                return jsonify({
                    'success': True,
                    'data': {
                        'output': converted_data,
                        'encoding': encoding,
                        'japanese_encoding': japanese_encoding,
                        'output_format': output_format,
                        'sosi_handling': sosi_handling,
                        'input_size': len(byte_data),
                        'output_size': len(converted_data.encode('utf-8'))
                    },
                    'message': 'EBCDIC dataset conversion successful'
                })
                
            except Exception as conv_error:
                logger.error(f"Conversion error: {conv_error}")
                return jsonify({
                    'success': False,
                    'error': f'Conversion failed: {str(conv_error)}',
                    'message': 'EBCDIC dataset conversion failed'
                }), 500
                
        else:
            return jsonify({'error': 'EBCDIC dataset converter not found'}), 500
            
    except Exception as e:
        logger.error(f"EBCDIC dataset conversion API error: {e}")
        return jsonify({'error': str(e)}), 500

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
    
    # ?? ??
    app.run(
        host='0.0.0.0',
        port=8000,
        debug=False,
        threaded=True
    )
