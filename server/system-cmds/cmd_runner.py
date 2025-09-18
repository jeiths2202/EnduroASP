#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
OpenASP Command Runner (cmdRunner)

The cmdRunner is a forked process that manages command execution with:
- Dataset allocation/deallocation ownership
- Child process lifecycle management  
- Resource cleanup on termination
- Integration with dslock_suite for distributed locking

Architecture:
    API Server → cmdRunner (fork) → CL/PGM (fork)
"""

import os
import sys
import signal
import subprocess
import multiprocessing
import threading
import time
import json
import logging
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime
from dataclasses import dataclass

# Add current directory to path for imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from dataset_manager import get_dataset_manager, DatasetManager
from process_comm import (
    ProcessCommunicator, ParentChildCommunicator, 
    ProcessStatus, MessageType, create_session_communicator
)

# Import existing ASP command functions
from functions.call import CALL
from cl_executor import execute_cl_file

# Logging setup
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
    handlers=[
        logging.FileHandler('/home/aspuser/app/server/api_server.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger('cmd_runner')

@dataclass
class CommandRequest:
    """Represents a command execution request"""
    command: str
    session_id: str
    terminal_id: str
    user_id: str
    parameters: Dict[str, Any]
    timestamp: float

@dataclass
class ExecutionResult:
    """Represents the result of command execution"""
    success: bool
    return_code: int
    output: str
    error: str
    execution_time: float
    allocated_datasets: List[str]

class CmdRunner:
    """
    Main command runner process
    
    Responsibilities:
    - Fork and manage child processes for CL/PGM execution
    - Own and manage dataset allocations 
    - Handle resource cleanup on termination
    - Provide process isolation and lifecycle management
    """
    
    def __init__(self, session_id: str, terminal_id: str, user_id: str):
        self.session_id = session_id
        self.terminal_id = terminal_id
        self.user_id = user_id
        self.pid = os.getpid()
        self.start_time = time.time()
        
        # Status tracking
        self.status = ProcessStatus.STARTING
        self.current_command = None
        self.child_processes: Dict[int, subprocess.Popen] = {}
        
        # Dataset management
        self.dataset_manager = get_dataset_manager()
        self.allocated_datasets: List[str] = []
        
        # Communication
        self.communicator = create_session_communicator(session_id, "cmdRunner")
        self._setup_message_handlers()
        
        # Signal handlers for cleanup
        self._setup_signal_handlers()
        
        # Thread for monitoring child processes
        self.monitor_thread = threading.Thread(target=self._monitor_children, daemon=True)
        self.monitor_thread.start()
        
        self.status = ProcessStatus.RUNNING
        logger.info(f"CmdRunner initialized: PID={self.pid}, Session={session_id}, User={user_id}")
    
    def _setup_signal_handlers(self):
        """Setup signal handlers for graceful shutdown"""
        def signal_handler(signum, frame):
            logger.info(f"CmdRunner {self.pid} received signal {signum}, shutting down...")
            self.shutdown()
        
        signal.signal(signal.SIGTERM, signal_handler)
        signal.signal(signal.SIGINT, signal_handler)
    
    def _setup_message_handlers(self):
        """Setup handlers for different message types"""
        self.communicator.register_handler(
            MessageType.COMMAND_REQUEST, 
            self._handle_command_request
        )
        self.communicator.register_handler(
            MessageType.PROCESS_TERMINATION,
            self._handle_termination_request
        )
    
    def _handle_command_request(self, message):
        """Handle incoming command execution requests"""
        try:
            data = message.data
            command_req = CommandRequest(
                command=data['command'],
                session_id=message.session_id,
                terminal_id=data.get('terminal_id', self.terminal_id),
                user_id=data.get('user_id', self.user_id),
                parameters=data.get('parameters', {}),
                timestamp=message.timestamp
            )
            
            logger.info(f"Executing command: {command_req.command}")
            result = self.execute_command(command_req)
            
            # Send response back
            self.communicator.send_command_response(
                target_pid=message.source_pid,
                success=result.success,
                result={
                    'return_code': result.return_code,
                    'output': result.output,
                    'error': result.error,
                    'execution_time': result.execution_time,
                    'allocated_datasets': result.allocated_datasets
                },
                error=result.error if not result.success else None
            )
            
        except Exception as e:
            logger.error(f"Error handling command request: {e}")
            self.communicator.send_command_response(
                target_pid=message.source_pid,
                success=False,
                error=str(e)
            )
    
    def _handle_termination_request(self, message):
        """Handle termination requests"""
        logger.info(f"Termination requested for cmdRunner {self.pid}")
        self.shutdown()
    
    def execute_command(self, command_req: CommandRequest) -> ExecutionResult:
        """
        Execute a command with proper process management and resource tracking
        
        Args:
            command_req: Command request details
            
        Returns:
            ExecutionResult with execution details
        """
        start_time = time.time()
        self.current_command = command_req.command
        
        try:
            # Parse command
            command_parts = command_req.command.strip().split()
            if not command_parts:
                return ExecutionResult(
                    success=False,
                    return_code=1,
                    output="",
                    error="Empty command",
                    execution_time=time.time() - start_time,
                    allocated_datasets=self.allocated_datasets.copy()
                )
            
            command_name = command_parts[0].upper()
            
            # Set environment variables for child processes
            self._setup_execution_environment(command_req)
            
            # Execute based on command type
            if command_name == "CALL":
                return self._execute_call_command(command_req, start_time)
            else:
                # Handle other ASP commands
                return self._execute_asp_command(command_req, start_time)
                
        except Exception as e:
            logger.error(f"Command execution failed: {e}")
            return ExecutionResult(
                success=False,
                return_code=999,
                output="",
                error=str(e),
                execution_time=time.time() - start_time,
                allocated_datasets=self.allocated_datasets.copy()
            )
        finally:
            self.current_command = None
    
    def _setup_execution_environment(self, command_req: CommandRequest):
        """Setup environment variables for command execution"""
        os.environ['ASP_SESSION_ID'] = command_req.session_id
        os.environ['ASP_TERMINAL_ID'] = command_req.terminal_id
        os.environ['ASP_USER_ID'] = command_req.user_id
        os.environ['ASP_CMDRUNNER_PID'] = str(self.pid)
        os.environ['ASP_EXECUTION_TIME'] = str(command_req.timestamp)
    
    def _execute_call_command(self, command_req: CommandRequest, start_time: float) -> ExecutionResult:
        """Execute CALL command with enhanced process management using fork"""
        try:
            logger.info(f"[PHASE2] Executing CALL command with fork: {command_req.command}")
            
            # Create parent-child communication
            comm = ParentChildCommunicator()
            
            # Fork process
            child_pid = os.fork()
            
            if child_pid == 0:
                # Child process
                try:
                    logger.info(f"[CHILD] Child process started: PID={os.getpid()}, Parent={os.getppid()}")
                    
                    # Setup child dataset handlers
                    self._setup_child_dataset_handlers(comm)
                    
                    # Capture stdout/stderr for logging
                    from io import StringIO
                    import contextlib
                    
                    stdout_capture = StringIO()
                    stderr_capture = StringIO()
                    
                    # Execute CALL command in child
                    with contextlib.redirect_stdout(stdout_capture), contextlib.redirect_stderr(stderr_capture):
                        success = CALL(command_req.command)
                    
                    output = stdout_capture.getvalue()
                    error = stderr_capture.getvalue()
                    
                    logger.info(f"[CHILD] CALL command completed: success={success}")
                    if output.strip():
                        logger.info(f"[CHILD] stdout: {output.strip()}")
                    if error.strip():
                        logger.info(f"[CHILD] stderr: {error.strip()}")
                    
                    # Send result to parent
                    comm.send_to_parent({
                        'type': 'execution_result',
                        'success': success,
                        'return_code': 0 if success else 1,
                        'output': output,
                        'error': error
                    })
                    
                    # Clean exit
                    os._exit(0 if success else 1)
                    
                except Exception as e:
                    logger.error(f"[CHILD] Exception in child process: {e}")
                    comm.send_to_parent({
                        'type': 'execution_result',
                        'success': False,
                        'return_code': 999,
                        'error': str(e)
                    })
                    os._exit(999)
            
            else:
                # Parent process
                logger.info(f"[PARENT] Forked child process: PID={child_pid}")
                
                # Track child process
                self.child_processes[child_pid] = None
                
                # Monitor child execution
                result = self._monitor_child_execution(child_pid, comm, start_time)
                
                # Remove from tracking
                if child_pid in self.child_processes:
                    del self.child_processes[child_pid]
                
                return result
                
        except Exception as e:
            logger.error(f"[PHASE2] CALL command execution failed: {e}")
            return ExecutionResult(
                success=False,
                return_code=999,
                output="",
                error=str(e),
                execution_time=time.time() - start_time,
                allocated_datasets=self.allocated_datasets.copy()
            )
    
    def _monitor_child_execution(self, child_pid: int, comm: ParentChildCommunicator, 
                               start_time: float) -> ExecutionResult:
        """Monitor child process execution and handle dataset operations"""
        execution_output = []
        execution_error = []
        
        while True:
            # Check for messages from child
            msg = comm.receive_from_child(timeout=1.0)
            if msg:
                msg_type = msg.get('type')
                
                if msg_type == 'dataset_allocate':
                    # Handle dataset allocation request from child
                    success, message = self.allocate_dataset(
                        msg['logical_name'], 
                        msg['physical_file']
                    )
                    comm.send_to_child({
                        'type': 'dataset_allocate_response',
                        'success': success,
                        'message': message
                    })
                
                elif msg_type == 'dataset_deallocate':
                    # Handle dataset deallocation request from child
                    success, message = self.deallocate_dataset(msg['logical_name'])
                    comm.send_to_child({
                        'type': 'dataset_deallocate_response',
                        'success': success,
                        'message': message
                    })
                
                elif msg_type == 'execution_result':
                    # Child finished execution
                    success = msg.get('success', False)
                    return_code = msg.get('return_code', 999)
                    output = msg.get('output', '')
                    error = msg.get('error', '')
                    
                    # Add child's output/error to what we've collected
                    if output:
                        execution_output.append(output)
                    if error:
                        execution_error.append(error)
                    
                    # Wait for child to terminate
                    try:
                        os.waitpid(child_pid, 0)
                    except OSError:
                        pass
                    
                    return ExecutionResult(
                        success=success,
                        return_code=return_code,
                        output='\n'.join(execution_output),
                        error='\n'.join(execution_error) if execution_error else error,
                        execution_time=time.time() - start_time,
                        allocated_datasets=self.allocated_datasets.copy()
                    )
                
                elif msg_type == 'output':
                    execution_output.append(msg.get('message', ''))
                
                elif msg_type == 'error':
                    execution_error.append(msg.get('message', ''))
            
            # Check if child process is still alive
            try:
                pid, status = os.waitpid(child_pid, os.WNOHANG)
                if pid == child_pid:
                    # Child terminated
                    return_code = os.WEXITSTATUS(status) if os.WIFEXITED(status) else 999
                    return ExecutionResult(
                        success=return_code == 0,
                        return_code=return_code,
                        output='\n'.join(execution_output),
                        error='\n'.join(execution_error),
                        execution_time=time.time() - start_time,
                        allocated_datasets=self.allocated_datasets.copy()
                    )
            except OSError:
                # Child already terminated
                break
    
    def _setup_child_dataset_handlers(self, comm: ParentChildCommunicator):
        """Setup dataset operation handlers in child process"""
        # Mark as child process
        os.environ['ASP_CHILD_PROCESS'] = '1'
        os.environ['ASP_PARENT_PID'] = str(os.getppid())
        
        # Store communicator globally for OVRF/DLTOVR to use
        import process_comm
        process_comm._child_communicator = comm
    
    def _execute_asp_command(self, command_req: CommandRequest, start_time: float) -> ExecutionResult:
        """Execute other ASP commands"""
        # For now, execute directly (can be enhanced later)
        try:
            # Use existing aspcli execution
            script_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            aspcli_path = os.path.join(script_dir, 'system-cmds', 'aspcli.py')
            
            cmd_parts = command_req.command.strip().split()
            cmd = ['python3', aspcli_path] + cmd_parts
            
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=60,
                cwd=os.path.dirname(aspcli_path)
            )
            
            return ExecutionResult(
                success=result.returncode == 0,
                return_code=result.returncode,
                output=result.stdout,
                error=result.stderr,
                execution_time=time.time() - start_time,
                allocated_datasets=self.allocated_datasets.copy()
            )
            
        except Exception as e:
            return ExecutionResult(
                success=False,
                return_code=999,
                output="",
                error=str(e),
                execution_time=time.time() - start_time,
                allocated_datasets=self.allocated_datasets.copy()
            )
    
    def allocate_dataset(self, logical_name: str, physical_file: str) -> Tuple[bool, str]:
        """Allocate a dataset using this cmdRunner as owner"""
        success, message = self.dataset_manager.allocate_dataset(
            logical_name, physical_file, self.pid
        )
        
        if success and logical_name not in self.allocated_datasets:
            self.allocated_datasets.append(logical_name)
            logger.info(f"Dataset allocated by cmdRunner {self.pid}: {logical_name}")
        
        return success, message
    
    def deallocate_dataset(self, logical_name: str) -> Tuple[bool, str]:
        """Deallocate a dataset owned by this cmdRunner"""
        success, message = self.dataset_manager.deallocate_dataset(logical_name, self.pid)
        
        if success and logical_name in self.allocated_datasets:
            self.allocated_datasets.remove(logical_name)
            logger.info(f"Dataset deallocated by cmdRunner {self.pid}: {logical_name}")
        
        return success, message
    
    def _monitor_children(self):
        """Background thread to monitor child processes"""
        while self.status == ProcessStatus.RUNNING:
            # Check for terminated children
            try:
                dead_children = []
                for child_pid in list(self.child_processes.keys()):
                    try:
                        pid, status = os.waitpid(child_pid, os.WNOHANG)
                        if pid == child_pid:
                            dead_children.append(child_pid)
                            logger.info(f"Child process {child_pid} terminated")
                    except OSError:
                        # Child already cleaned up
                        dead_children.append(child_pid)
                
                # Remove dead children
                for child_pid in dead_children:
                    if child_pid in self.child_processes:
                        del self.child_processes[child_pid]
                
            except Exception as e:
                logger.error(f"Error monitoring children: {e}")
            
            time.sleep(1)
    
    def get_status(self) -> Dict[str, Any]:
        """Get current status of the cmdRunner"""
        return {
            'pid': self.pid,
            'session_id': self.session_id,
            'terminal_id': self.terminal_id,
            'user_id': self.user_id,
            'status': self.status.value,
            'start_time': self.start_time,
            'current_command': self.current_command,
            'allocated_datasets': self.allocated_datasets.copy(),
            'child_processes': list(self.child_processes.keys()),
            'uptime': time.time() - self.start_time
        }
    
    def shutdown(self):
        """Graceful shutdown with resource cleanup"""
        logger.info(f"Shutting down cmdRunner {self.pid}")
        self.status = ProcessStatus.TERMINATING
        
        # Terminate child processes
        for child_pid in list(self.child_processes.keys()):
            try:
                os.kill(child_pid, signal.SIGTERM)
                time.sleep(1)
                # Force kill if still alive
                try:
                    os.kill(child_pid, signal.SIGKILL)
                except OSError:
                    pass  # Already terminated
            except OSError:
                pass  # Process doesn't exist
        
        # Cleanup allocated datasets
        cleaned_datasets = self.dataset_manager.cleanup_by_owner(self.pid)
        logger.info(f"Cleaned up datasets: {cleaned_datasets}")
        
        # Shutdown communicator
        self.communicator.shutdown()
        
        self.status = ProcessStatus.TERMINATED
        logger.info(f"CmdRunner {self.pid} shutdown complete")

def run_cmd_runner(session_id: str, terminal_id: str, user_id: str, 
                  command: str, parent_conn) -> int:
    """
    Main function to run cmdRunner in a forked process
    
    Args:
        session_id: Session identifier
        terminal_id: Terminal identifier  
        user_id: User identifier
        command: Command to execute
        parent_conn: Connection to parent process
        
    Returns:
        Exit code
    """
    try:
        # Create cmdRunner instance
        runner = CmdRunner(session_id, terminal_id, user_id)
        
        # Create command request
        command_req = CommandRequest(
            command=command,
            session_id=session_id,
            terminal_id=terminal_id,
            user_id=user_id,
            parameters={},
            timestamp=time.time()
        )
        
        # Execute command
        result = runner.execute_command(command_req)
        
        # Send result to parent
        parent_conn.send({
            'success': result.success,
            'return_code': result.return_code,
            'output': result.output,
            'error': result.error,
            'execution_time': result.execution_time,
            'allocated_datasets': result.allocated_datasets
        })
        
        # Cleanup
        runner.shutdown()
        
        return result.return_code
        
    except Exception as e:
        logger.error(f"CmdRunner execution failed: {e}")
        try:
            parent_conn.send({
                'success': False,
                'return_code': 999,
                'output': '',
                'error': str(e),
                'execution_time': 0,
                'allocated_datasets': []
            })
        except:
            pass
        return 999

if __name__ == "__main__":
    # Test the cmdRunner
    import sys
    
    if len(sys.argv) < 4:
        print("Usage: cmd_runner.py <session_id> <terminal_id> <user_id> [command]")
        sys.exit(1)
    
    session_id = sys.argv[1]
    terminal_id = sys.argv[2] 
    user_id = sys.argv[3]
    command = " ".join(sys.argv[4:]) if len(sys.argv) > 4 else "HELP"
    
    # Create a dummy connection for testing
    from multiprocessing import Pipe
    parent_conn, child_conn = Pipe()
    
    exit_code = run_cmd_runner(session_id, terminal_id, user_id, command, child_conn)
    
    # Read result
    if parent_conn.poll():
        result = parent_conn.recv()
        print(f"Result: {result}")
    
    sys.exit(exit_code)