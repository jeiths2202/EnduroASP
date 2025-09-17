#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PostgreSQL-based API Server for Enterprise Terminal Sessions
Uses PostgreSQL database for persistent session storage
"""

import os
import sys
import json
import threading
import time
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any
import uuid
import logging
from flask import Flask, request, jsonify
from flask_cors import CORS

# Import PostgreSQL session manager
from postgresql_session_manager import PostgreSQLSessionManager

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app, origins=['http://localhost:3005', 'http://localhost:3000', 'http://localhost:3007', 'http://localhost:3006'])

# Configuration
CONFIG_DIR = "/home/aspuser/app/server/config"
os.makedirs(CONFIG_DIR, exist_ok=True)

# Initialize PostgreSQL session manager
try:
    postgresql_session_manager = PostgreSQLSessionManager()
    logger.info("PostgreSQL Session Manager initialized successfully")
except Exception as e:
    logger.error(f"Failed to initialize PostgreSQL Session Manager: {e}")
    sys.exit(1)

def format_session_for_api(session_data):
    """Format session data for API response in standard format"""
    if not session_data:
        return None
        
    # Convert to standard API format
    formatted_session = {
        'wsname': session_data.get('wsname', ''),
        'username': session_data.get('username', ''),
        'conn_time': session_data.get('conn_time', ''),
        'status': session_data.get('status', '0')
    }
    
    return formatted_session

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint with database status"""
    try:
        # Test database connection
        stats = postgresql_session_manager.get_session_statistics()
        
        return jsonify({
            'status': 'healthy',
            'service': 'postgresql-api-server',
            'version': '1.0.0',
            'database': 'connected',
            'session_stats': stats,
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        return jsonify({
            'status': 'unhealthy',
            'service': 'postgresql-api-server',
            'database': 'disconnected',
            'error': str(e),
            'timestamp': datetime.now().isoformat()
        }), 503

@app.route('/api/v1/sessions', methods=['GET'])
def get_sessions_v1():
    """List all terminal sessions - PostgreSQL backed"""
    try:
        # Get query parameters
        status_filter = request.args.get('status')  # '0' or '1'
        username_filter = request.args.get('username')
        
        # Get all sessions from PostgreSQL
        all_sessions = postgresql_session_manager.list_all_sessions(
            status_filter=status_filter,
            username_filter=username_filter
        )
        
        # Format sessions for API response
        formatted_sessions = []
        for session in all_sessions:
            formatted = format_session_for_api(session)
            if formatted:
                formatted_sessions.append(formatted)
        
        logger.info(f"API v1: Listed {len(formatted_sessions)} sessions from PostgreSQL")
        return jsonify(formatted_sessions), 200
        
    except Exception as e:
        logger.error(f"API v1 sessions list error: {e}")
        return jsonify({
            'error': 'internal_server_error',
            'message': f'Failed to retrieve sessions: {str(e)}'
        }), 500

@app.route('/api/v1/sessions', methods=['POST'])
def create_session_v1():
    """Create new terminal session - PostgreSQL backed"""
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
        existing_session = postgresql_session_manager.get_session_by_workstation(wsname)
        if existing_session:
            return jsonify({
                'error': 'conflict',
                'message': f'Session with wsname {wsname} already exists'
            }), 409
        
        # Create new session in PostgreSQL
        session_id = postgresql_session_manager.create_session(
            wsname=wsname,
            user_id=username,
            terminal_id=wsname,
            display_mode='legacy',
            encoding='sjis'
        )
        
        # Get created session for response
        created_session = postgresql_session_manager.get_session_by_workstation(wsname)
        formatted_session = format_session_for_api(created_session)
        
        logger.info(f"API v1: Created session {wsname} for user {username} in PostgreSQL")
        return jsonify(formatted_session), 201
        
    except Exception as e:
        logger.error(f"API v1 session creation error: {e}")
        return jsonify({
            'error': 'internal_server_error',
            'message': f'Failed to create session: {str(e)}'
        }), 500

@app.route('/api/v1/sessions/<wsname>', methods=['GET'])
def get_session_v1(wsname):
    """Get specific terminal session - PostgreSQL backed"""
    try:
        wsname = wsname.strip().upper()
        
        # Get session by workstation name from PostgreSQL
        session = postgresql_session_manager.get_session_by_workstation(wsname)
        if not session:
            return jsonify({
                'error': 'not_found',
                'message': f'Session with wsname {wsname} not found'
            }), 404
        
        formatted_session = format_session_for_api(session)
        logger.info(f"API v1: Retrieved session {wsname} from PostgreSQL")
        return jsonify(formatted_session), 200
        
    except Exception as e:
        logger.error(f"API v1 session retrieval error: {e}")
        return jsonify({
            'error': 'internal_server_error',
            'message': f'Failed to retrieve session: {str(e)}'
        }), 500

@app.route('/api/v1/sessions/<wsname>', methods=['PATCH'])
def update_session_v1(wsname):
    """Update session status - PostgreSQL backed"""
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
        
        # Check if session exists
        session = postgresql_session_manager.get_session_by_workstation(wsname)
        if not session:
            return jsonify({
                'error': 'not_found',
                'message': f'Session with wsname {wsname} not found'
            }), 404
        
        # Update session status in PostgreSQL
        success = postgresql_session_manager.update_session_by_wsname(wsname, {
            'status': new_status
        })
        
        if not success:
            return jsonify({
                'error': 'internal_server_error',
                'message': 'Failed to update session status'
            }), 500
        
        # Get updated session for response
        updated_session = postgresql_session_manager.get_session_by_workstation(wsname)
        formatted_session = format_session_for_api(updated_session)
        
        logger.info(f"API v1: Updated session {wsname} status to {new_status} in PostgreSQL")
        return jsonify(formatted_session), 200
        
    except Exception as e:
        logger.error(f"API v1 session update error: {e}")
        return jsonify({
            'error': 'internal_server_error',
            'message': f'Failed to update session: {str(e)}'
        }), 500

@app.route('/api/v1/sessions/<wsname>', methods=['DELETE'])
def delete_session_v1(wsname):
    """Delete terminal session - PostgreSQL backed"""
    try:
        wsname = wsname.strip().upper()
        
        # Check if session exists
        session = postgresql_session_manager.get_session_by_workstation(wsname)
        if not session:
            return jsonify({
                'error': 'not_found',
                'message': f'Session with wsname {wsname} not found'
            }), 404
        
        # Delete session from PostgreSQL
        success = postgresql_session_manager.delete_session(wsname)
        if not success:
            return jsonify({
                'error': 'internal_server_error',
                'message': 'Failed to delete session'
            }), 500
        
        logger.info(f"API v1: Deleted session {wsname} from PostgreSQL")
        return '', 204
        
    except Exception as e:
        logger.error(f"API v1 session deletion error: {e}")
        return jsonify({
            'error': 'internal_server_error',
            'message': f'Failed to delete session: {str(e)}'
        }), 500

@app.route('/api/v1/sessions/<wsname>/logon', methods=['POST'])
def logon_session_v1(wsname):
    """Logon to session - PostgreSQL backed"""
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
        session = postgresql_session_manager.get_session_by_workstation(wsname)
        
        if not session:
            # Create new session in PostgreSQL
            session_id = postgresql_session_manager.create_session(
                wsname=wsname,
                user_id=username,
                terminal_id=wsname,
                display_mode='legacy',
                encoding='sjis'
            )
        else:
            # Update existing session to logon status
            postgresql_session_manager.update_session_by_wsname(wsname, {
                'status': '1',
                'username': username  # Update username if needed
            })
        
        # Get session for response
        session = postgresql_session_manager.get_session_by_workstation(wsname)
        formatted_session = format_session_for_api(session)
        
        logger.info(f"API v1: Logon successful for {wsname} (user: {username}) in PostgreSQL")
        return jsonify(formatted_session), 200
        
    except Exception as e:
        logger.error(f"API v1 session logon error: {e}")
        return jsonify({
            'error': 'internal_server_error',
            'message': f'Failed to logon session: {str(e)}'
        }), 500

@app.route('/api/v1/sessions/<wsname>/logoff', methods=['POST'])
def logoff_session_v1(wsname):
    """Logoff from session - PostgreSQL backed"""
    try:
        wsname = wsname.strip().upper()
        
        # Check if session exists
        session = postgresql_session_manager.get_session_by_workstation(wsname)
        if not session:
            return jsonify({
                'error': 'not_found',
                'message': f'Session with wsname {wsname} not found'
            }), 404
        
        # Update session to logoff status in PostgreSQL
        success = postgresql_session_manager.logout_session(wsname=wsname)
        
        if not success:
            return jsonify({
                'error': 'internal_server_error',
                'message': 'Failed to logoff session'
            }), 500
        
        # Get updated session for response
        updated_session = postgresql_session_manager.get_session_by_workstation(wsname)
        formatted_session = format_session_for_api(updated_session)
        
        logger.info(f"API v1: Logoff successful for {wsname} in PostgreSQL")
        return jsonify(formatted_session), 200
        
    except Exception as e:
        logger.error(f"API v1 session logoff error: {e}")
        return jsonify({
            'error': 'internal_server_error',
            'message': f'Failed to logoff session: {str(e)}'
        }), 500

@app.route('/api/v1/sessions/stats', methods=['GET'])
def get_session_statistics():
    """Get session statistics from PostgreSQL"""
    try:
        stats = postgresql_session_manager.get_session_statistics()
        
        return jsonify({
            'success': True,
            'statistics': stats,
            'timestamp': datetime.now().isoformat()
        }), 200
        
    except Exception as e:
        logger.error(f"Session statistics error: {e}")
        return jsonify({
            'error': 'internal_server_error',
            'message': f'Failed to get session statistics: {str(e)}'
        }), 500

@app.route('/api/v1/sessions/cleanup', methods=['POST'])
def cleanup_old_sessions():
    """Clean up old inactive sessions"""
    try:
        data = request.get_json()
        days_old = data.get('days_old', 30) if data else 30
        
        deleted_count = postgresql_session_manager.cleanup_old_sessions(days_old)
        
        return jsonify({
            'success': True,
            'message': f'Cleaned up {deleted_count} old sessions',
            'deleted_count': deleted_count,
            'days_old': days_old,
            'timestamp': datetime.now().isoformat()
        }), 200
        
    except Exception as e:
        logger.error(f"Session cleanup error: {e}")
        return jsonify({
            'error': 'internal_server_error',
            'message': f'Failed to cleanup sessions: {str(e)}'
        }), 500

if __name__ == '__main__':
    logger.info("PostgreSQL API Server v1.0 starting...")
    logger.info("Enterprise Terminal Session API v1.0 with PostgreSQL backend")
    
    # Get initial statistics
    try:
        stats = postgresql_session_manager.get_session_statistics()
        logger.info(f"Initial session statistics: {stats}")
    except Exception as e:
        logger.error(f"Failed to get initial statistics: {e}")
    
    app.run(
        host='0.0.0.0',
        port=8002,  # Use port 8002 for PostgreSQL version
        debug=False
    )