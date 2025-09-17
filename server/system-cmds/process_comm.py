#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Process Communication Interface for OpenASP cmdRunner

Handles communication between:
- API Server ↔ cmdRunner
- cmdRunner ↔ Child Processes (CL/PGM)
"""

import os
import sys
import json
import time
import signal
import logging
import multiprocessing
from typing import Dict, Any, Optional, Callable
from dataclasses import dataclass, asdict
from enum import Enum
import threading

# Logging setup
logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(name)s: %(message)s')
logger = logging.getLogger('process_comm')

class MessageType(Enum):
    """Message types for inter-process communication"""
    COMMAND_REQUEST = "command_request"
    COMMAND_RESPONSE = "command_response" 
    STATUS_UPDATE = "status_update"
    RESOURCE_ALLOCATION = "resource_allocation"
    RESOURCE_DEALLOCATION = "resource_deallocation"
    PROCESS_TERMINATION = "process_termination"
    ERROR_REPORT = "error_report"
    HEARTBEAT = "heartbeat"

class ProcessStatus(Enum):
    """Process status enumeration"""
    STARTING = "starting"
    RUNNING = "running"
    WAITING = "waiting"
    TERMINATING = "terminating"
    TERMINATED = "terminated"
    ERROR = "error"

@dataclass
class ProcessMessage:
    """Standard message format for inter-process communication"""
    message_type: MessageType
    source_pid: int
    target_pid: Optional[int]
    session_id: str
    timestamp: float
    data: Dict[str, Any]
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization"""
        return {
            'message_type': self.message_type.value,
            'source_pid': self.source_pid,
            'target_pid': self.target_pid,
            'session_id': self.session_id,
            'timestamp': self.timestamp,
            'data': self.data
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'ProcessMessage':
        """Create from dictionary"""
        return cls(
            message_type=MessageType(data['message_type']),
            source_pid=data['source_pid'],
            target_pid=data.get('target_pid'),
            session_id=data['session_id'],
            timestamp=data['timestamp'],
            data=data['data']
        )

class ProcessCommunicator:
    """
    Handles process communication using queues and shared memory
    """
    
    def __init__(self, process_id: str, session_id: str):
        self.process_id = process_id
        self.session_id = session_id
        self.pid = os.getpid()
        
        # Communication queues
        self.incoming_queue = multiprocessing.Queue()
        self.outgoing_queue = multiprocessing.Queue()
        
        # Message handlers
        self.message_handlers: Dict[MessageType, Callable] = {}
        
        # Status tracking
        self.status = ProcessStatus.STARTING
        self.last_heartbeat = time.time()
        
        # Shutdown flag
        self.shutdown_flag = threading.Event()
        
        # Start communication thread
        self.comm_thread = threading.Thread(target=self._communication_loop, daemon=True)
        self.comm_thread.start()
        
        logger.info(f"Process communicator initialized for {process_id} (PID: {self.pid})")
    
    def send_message(self, message: ProcessMessage):
        """Send a message to another process"""
        try:
            self.outgoing_queue.put(message.to_dict(), timeout=5)
            logger.debug(f"Message sent: {message.message_type} to PID {message.target_pid}")
        except Exception as e:
            logger.error(f"Failed to send message: {e}")
    
    def register_handler(self, message_type: MessageType, handler: Callable[[ProcessMessage], None]):
        """Register a message handler for a specific message type"""
        self.message_handlers[message_type] = handler
        logger.debug(f"Handler registered for {message_type}")
    
    def send_command_request(self, target_pid: int, command: str, parameters: Dict[str, Any] = None):
        """Send a command request to another process"""
        message = ProcessMessage(
            message_type=MessageType.COMMAND_REQUEST,
            source_pid=self.pid,
            target_pid=target_pid,
            session_id=self.session_id,
            timestamp=time.time(),
            data={
                'command': command,
                'parameters': parameters or {}
            }
        )
        self.send_message(message)
    
    def send_command_response(self, target_pid: int, success: bool, result: Any = None, error: str = None):
        """Send a command response"""
        message = ProcessMessage(
            message_type=MessageType.COMMAND_RESPONSE,
            source_pid=self.pid,
            target_pid=target_pid,
            session_id=self.session_id,
            timestamp=time.time(),
            data={
                'success': success,
                'result': result,
                'error': error
            }
        )
        self.send_message(message)
    
    def send_status_update(self, target_pid: int, status: ProcessStatus, details: Dict[str, Any] = None):
        """Send a status update"""
        message = ProcessMessage(
            message_type=MessageType.STATUS_UPDATE,
            source_pid=self.pid,
            target_pid=target_pid,
            session_id=self.session_id,
            timestamp=time.time(),
            data={
                'status': status.value,
                'details': details or {}
            }
        )
        self.send_message(message)
        self.status = status
    
    def send_heartbeat(self, target_pid: int):
        """Send a heartbeat message"""
        message = ProcessMessage(
            message_type=MessageType.HEARTBEAT,
            source_pid=self.pid,
            target_pid=target_pid,
            session_id=self.session_id,
            timestamp=time.time(),
            data={'alive': True}
        )
        self.send_message(message)
        self.last_heartbeat = time.time()
    
    def _communication_loop(self):
        """Main communication loop running in background thread"""
        logger.info(f"Communication loop started for PID {self.pid}")
        
        while not self.shutdown_flag.is_set():
            try:
                # Check for incoming messages
                if not self.incoming_queue.empty():
                    try:
                        message_data = self.incoming_queue.get(timeout=1)
                        message = ProcessMessage.from_dict(message_data)
                        self._handle_message(message)
                    except Exception as e:
                        logger.error(f"Error processing incoming message: {e}")
                
                # Send periodic heartbeat
                current_time = time.time()
                if current_time - self.last_heartbeat > 30:  # 30 seconds
                    # Note: This would need a way to know the parent PID
                    # For now, just update the timestamp
                    self.last_heartbeat = current_time
                
                time.sleep(0.1)  # Small delay to prevent busy waiting
                
            except Exception as e:
                logger.error(f"Communication loop error: {e}")
                time.sleep(1)
        
        logger.info(f"Communication loop terminated for PID {self.pid}")
    
    def _handle_message(self, message: ProcessMessage):
        """Handle an incoming message"""
        try:
            handler = self.message_handlers.get(message.message_type)
            if handler:
                handler(message)
                logger.debug(f"Message handled: {message.message_type} from PID {message.source_pid}")
            else:
                logger.warning(f"No handler for message type: {message.message_type}")
        except Exception as e:
            logger.error(f"Error handling message {message.message_type}: {e}")
    
    def shutdown(self):
        """Shutdown the communicator"""
        logger.info(f"Shutting down communicator for PID {self.pid}")
        self.shutdown_flag.set()
        
        if self.comm_thread.is_alive():
            self.comm_thread.join(timeout=5)
        
        # Close queues
        try:
            self.incoming_queue.close()
            self.outgoing_queue.close()
        except Exception as e:
            logger.warning(f"Error closing queues: {e}")

class ParentChildCommunicator:
    """
    Simplified communicator for parent-child process communication
    using pipes for direct communication
    """
    
    def __init__(self):
        self.parent_conn, self.child_conn = multiprocessing.Pipe()
        self.is_parent = True
        
    def send_to_child(self, data: Dict[str, Any]):
        """Send data from parent to child"""
        if self.is_parent:
            try:
                self.parent_conn.send(data)
                logger.debug(f"Sent to child: {data.get('type', 'unknown')}")
            except Exception as e:
                logger.error(f"Failed to send to child: {e}")
    
    def send_to_parent(self, data: Dict[str, Any]):
        """Send data from child to parent"""
        if not self.is_parent:
            try:
                self.child_conn.send(data)
                logger.debug(f"Sent to parent: {data.get('type', 'unknown')}")
            except Exception as e:
                logger.error(f"Failed to send to parent: {e}")
    
    def receive_from_child(self, timeout: float = None) -> Optional[Dict[str, Any]]:
        """Receive data from child (parent side)"""
        if self.is_parent:
            try:
                if self.parent_conn.poll(timeout):
                    data = self.parent_conn.recv()
                    logger.debug(f"Received from child: {data.get('type', 'unknown')}")
                    return data
            except Exception as e:
                logger.error(f"Failed to receive from child: {e}")
        return None
    
    def receive_from_parent(self, timeout: float = None) -> Optional[Dict[str, Any]]:
        """Receive data from parent (child side)"""
        if not self.is_parent:
            try:
                if self.child_conn.poll(timeout):
                    data = self.child_conn.recv()
                    logger.debug(f"Received from parent: {data.get('type', 'unknown')}")
                    return data
            except Exception as e:
                logger.error(f"Failed to receive from parent: {e}")
        return None
    
    def set_child_mode(self):
        """Switch to child mode"""
        self.is_parent = False
        # Close parent end in child process
        self.parent_conn.close()
    
    def set_parent_mode(self):
        """Switch to parent mode"""
        self.is_parent = True
        # Close child end in parent process  
        self.child_conn.close()

def create_session_communicator(session_id: str, process_role: str) -> ProcessCommunicator:
    """Factory function to create a session-based communicator"""
    process_id = f"{process_role}_{session_id}_{os.getpid()}"
    return ProcessCommunicator(process_id, session_id)

# Global child communicator instance
_child_communicator = None

def get_child_communicator() -> ParentChildCommunicator:
    """
    Get singleton child communicator instance
    
    Returns:
        ParentChildCommunicator instance for child process
    """
    global _child_communicator
    if _child_communicator is None:
        _child_communicator = ParentChildCommunicator()
        _child_communicator.set_child_mode()
    return _child_communicator

if __name__ == "__main__":
    # Test the communication system
    import time
    
    def test_handler(message: ProcessMessage):
        print(f"Received message: {message.message_type} with data: {message.data}")
    
    # Create communicator
    comm = create_session_communicator("test_session", "test_process")
    comm.register_handler(MessageType.HEARTBEAT, test_handler)
    
    # Send a test heartbeat
    comm.send_heartbeat(comm.pid)  # Self-heartbeat for testing
    
    time.sleep(2)
    comm.shutdown()
    print("Communication test completed")