#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Enhanced Error Handler for OpenASP API Server
Provides structured error handling, logging, and user-friendly error responses
"""

import json
import logging
import traceback
from datetime import datetime
from enum import Enum
from typing import Dict, Any, Optional
from flask import jsonify

class ErrorSeverity(Enum):
    """Error severity levels"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class ErrorCategory(Enum):
    """Error categories for better classification"""
    VALIDATION = "validation"
    AUTHENTICATION = "authentication"
    AUTHORIZATION = "authorization"
    BUSINESS_LOGIC = "business_logic"
    EXTERNAL_SERVICE = "external_service"
    SYSTEM = "system"
    NETWORK = "network"
    DATABASE = "database"

class EnhancedErrorHandler:
    """Enhanced error handler with structured logging and user-friendly responses"""
    
    def __init__(self, logger_name: str = "openasp_api"):
        self.logger = logging.getLogger(logger_name)
        self._setup_logger()
        
    def _setup_logger(self):
        """Setup structured logging"""
        if not self.logger.handlers:
            handler = logging.StreamHandler()
            formatter = logging.Formatter(
                '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
            )
            handler.setFormatter(formatter)
            self.logger.addHandler(handler)
            self.logger.setLevel(logging.INFO)
    
    def handle_error(self, 
                    error: Exception, 
                    category: ErrorCategory = ErrorCategory.SYSTEM,
                    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
                    user_message: Optional[str] = None,
                    context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Handle errors with structured logging and user-friendly responses
        
        Args:
            error: The exception that occurred
            category: Error category for classification
            severity: Error severity level
            user_message: User-friendly error message
            context: Additional context information
            
        Returns:
            Dictionary containing error response data
        """
        error_id = self._generate_error_id()
        
        # Create structured error data
        error_data = {
            "error_id": error_id,
            "timestamp": datetime.now().isoformat(),
            "category": category.value,
            "severity": severity.value,
            "type": type(error).__name__,
            "message": str(error),
            "user_message": user_message or self._get_user_friendly_message(error),
            "context": context or {}
        }
        
        # Log the error with appropriate level
        log_message = f"Error {error_id}: {error_data['type']} - {error_data['message']}"
        if context:
            log_message += f" | Context: {json.dumps(context)}"
            
        if severity in [ErrorSeverity.HIGH, ErrorSeverity.CRITICAL]:
            self.logger.error(log_message)
            self.logger.error(f"Traceback: {traceback.format_exc()}")
        else:
            self.logger.warning(log_message)
        
        return error_data
    
    def _generate_error_id(self) -> str:
        """Generate unique error ID for tracking"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        return f"ERR_{timestamp}_{hash(str(datetime.now())) % 10000:04d}"
    
    def _get_user_friendly_message(self, error: Exception) -> str:
        """Convert technical errors to user-friendly messages"""
        error_type = type(error).__name__
        
        user_messages = {
            "FileNotFoundError": "요청한 파일을 찾을 수 없습니다.",
            "PermissionError": "파일에 대한 접근 권한이 없습니다.",
            "ConnectionError": "외부 서비스에 연결할 수 없습니다.",
            "TimeoutError": "요청 처리 시간이 초과되었습니다.",
            "ValueError": "입력 데이터가 올바르지 않습니다.",
            "KeyError": "필수 정보가 누락되었습니다.",
            "ImportError": "필요한 모듈을 로드할 수 없습니다.",
            "DatabaseError": "데이터베이스 작업 중 오류가 발생했습니다."
        }
        
        return user_messages.get(error_type, "시스템 오류가 발생했습니다. 관리자에게 문의하세요.")
    
    def create_error_response(self, error_data: Dict[str, Any], status_code: int = 500) -> tuple:
        """Create Flask JSON error response"""
        response_data = {
            "success": False,
            "error": {
                "id": error_data["error_id"],
                "message": error_data["user_message"],
                "category": error_data["category"],
                "severity": error_data["severity"],
                "timestamp": error_data["timestamp"]
            }
        }
        
        # Include additional context for development/debugging
        if error_data.get("context"):
            response_data["error"]["context"] = error_data["context"]
            
        return jsonify(response_data), status_code

# Global error handler instance
error_handler = EnhancedErrorHandler()

def handle_api_error(error: Exception, 
                    category: ErrorCategory = ErrorCategory.SYSTEM,
                    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
                    user_message: Optional[str] = None,
                    context: Optional[Dict[str, Any]] = None,
                    status_code: int = 500) -> tuple:
    """Convenience function for handling API errors"""
    error_data = error_handler.handle_error(error, category, severity, user_message, context)
    return error_handler.create_error_response(error_data, status_code)

def log_operation_success(operation: str, context: Optional[Dict[str, Any]] = None):
    """Log successful operations for monitoring"""
    log_message = f"Operation successful: {operation}"
    if context:
        log_message += f" | Context: {json.dumps(context)}"
    error_handler.logger.info(log_message)