#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Dataset Manager for OpenASP cmdRunner

Manages dataset allocation/deallocation with process ownership tracking.
Integrates with dslock_suite for distributed file locking.
"""

import os
import sys
import json
import time
import threading
import logging
from typing import Dict, Optional, List, Tuple
from datetime import datetime

# Import existing dslock functions
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from functions.ovrf import call_dslock_acquire, call_dslock_release, setup_dslock_environment
from functions.dltovr import get_override_info

# Logging setup
logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(name)s: %(message)s')
logger = logging.getLogger('dataset_manager')

class DatasetAllocation:
    """Represents a single dataset allocation"""
    
    def __init__(self, dataset_key: str, owner_pid: int, logical_name: str, 
                 physical_path: str, dataset_name: str, allocation_type: str = "*DATA"):
        self.dataset_key = dataset_key
        self.owner_pid = owner_pid
        self.logical_name = logical_name
        self.physical_path = physical_path
        self.dataset_name = dataset_name
        self.allocation_type = allocation_type
        self.allocated_at = datetime.now()
        self.lock_acquired = False
        self.lock_level = "MOD"
    
    def to_dict(self) -> Dict:
        """Convert to dictionary for serialization"""
        return {
            'dataset_key': self.dataset_key,
            'owner_pid': self.owner_pid,
            'logical_name': self.logical_name,
            'physical_path': self.physical_path,
            'dataset_name': self.dataset_name,
            'allocation_type': self.allocation_type,
            'allocated_at': self.allocated_at.isoformat(),
            'lock_acquired': self.lock_acquired,
            'lock_level': self.lock_level
        }
    
    @classmethod
    def from_dict(cls, data: Dict) -> 'DatasetAllocation':
        """Create from dictionary"""
        allocation = cls(
            data['dataset_key'],
            data['owner_pid'], 
            data['logical_name'],
            data['physical_path'],
            data['dataset_name'],
            data.get('allocation_type', '*DATA')
        )
        allocation.allocated_at = datetime.fromisoformat(data['allocated_at'])
        allocation.lock_acquired = data.get('lock_acquired', False)
        allocation.lock_level = data.get('lock_level', 'MOD')
        return allocation

class DatasetManager:
    """
    Centralized dataset allocation manager with process ownership
    
    Features:
    - Process-based ownership tracking
    - Automatic resource cleanup
    - dslock_suite integration
    - Thread-safe operations
    """
    
    def __init__(self):
        self.allocations: Dict[str, DatasetAllocation] = {}
        self.lock = threading.RLock()
        self.state_file = "/tmp/dataset_manager_state.json"
        self._load_state()
        
        # Setup dslock environment
        setup_dslock_environment()
        
        logger.info("Dataset Manager initialized")
    
    def _load_state(self):
        """Load persistent state from file"""
        try:
            if os.path.exists(self.state_file):
                with open(self.state_file, 'r') as f:
                    data = json.load(f)
                    for key, alloc_data in data.items():
                        self.allocations[key] = DatasetAllocation.from_dict(alloc_data)
                logger.info(f"Loaded {len(self.allocations)} dataset allocations from state file")
        except Exception as e:
            logger.warning(f"Failed to load state file: {e}")
    
    def _save_state(self):
        """Save current state to file"""
        try:
            with self.lock:
                data = {key: alloc.to_dict() for key, alloc in self.allocations.items()}
                with open(self.state_file, 'w') as f:
                    json.dump(data, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to save state file: {e}")
    
    def allocate_dataset(self, logical_name: str, physical_file: str, 
                        owner_pid: int, allocation_type: str = "*DATA") -> Tuple[bool, str]:
        """
        Allocate a dataset with process ownership
        
        Args:
            logical_name: Logical file name (e.g., EMP-FILE)
            physical_file: Physical file specification (e.g., EMPLOYEE.FB.TESTLIB)
            owner_pid: Process ID of the owner (cmdRunner PID)
            allocation_type: Type of allocation (*DATA, *DISPLAY, etc.)
            
        Returns:
            Tuple of (success, message)
        """
        with self.lock:
            try:
                # Parse physical file specification
                dataset_key, physical_path, dataset_name = self._parse_physical_file(physical_file)
                
                # Check if already allocated by different owner
                if logical_name in self.allocations:
                    existing = self.allocations[logical_name]
                    if existing.owner_pid != owner_pid:
                        return False, f"Dataset {logical_name} already allocated by PID {existing.owner_pid}"
                    else:
                        return True, f"Dataset {logical_name} already allocated by same owner"
                
                # Create allocation record
                allocation = DatasetAllocation(
                    dataset_key=dataset_key,
                    owner_pid=owner_pid,
                    logical_name=logical_name,
                    physical_path=physical_path,
                    dataset_name=dataset_name,
                    allocation_type=allocation_type
                )
                
                # Acquire dslock
                success, error_msg = call_dslock_acquire(dataset_name, "MOD")
                if success:
                    allocation.lock_acquired = True
                    allocation.lock_level = "MOD"
                    logger.info(f"Successfully acquired dslock for {dataset_name}")
                else:
                    logger.error(f"Failed to acquire dslock for {dataset_name}: {error_msg}")
                    raise RuntimeError(f"Dataset lock acquisition failed for {dataset_name}: {error_msg}")
                
                # Store allocation
                self.allocations[logical_name] = allocation
                self._save_state()
                
                logger.info(f"Dataset allocated: {logical_name} -> {physical_file} (Owner PID: {owner_pid})")
                return True, f"Dataset {logical_name} allocated successfully"
                
            except Exception as e:
                logger.error(f"Dataset allocation failed: {e}")
                return False, f"Allocation failed: {str(e)}"
    
    def deallocate_dataset(self, logical_name: str, owner_pid: int) -> Tuple[bool, str]:
        """
        Deallocate a dataset (owner verification required)
        
        Args:
            logical_name: Logical file name to deallocate
            owner_pid: Process ID of the owner (for verification)
            
        Returns:
            Tuple of (success, message)
        """
        with self.lock:
            try:
                if logical_name not in self.allocations:
                    return False, f"No allocation found for {logical_name}"
                
                allocation = self.allocations[logical_name]
                
                # Verify ownership
                if allocation.owner_pid != owner_pid:
                    return False, f"Access denied: {logical_name} owned by PID {allocation.owner_pid}, not {owner_pid}"
                
                # Release dslock if acquired
                if allocation.lock_acquired:
                    success, error_msg = call_dslock_release(allocation.dataset_name)
                    if success:
                        logger.info(f"Successfully released dslock for {allocation.dataset_name}")
                    else:
                        logger.warning(f"Failed to release dslock for {allocation.dataset_name}: {error_msg}")
                
                # Remove allocation
                del self.allocations[logical_name]
                self._save_state()
                
                logger.info(f"Dataset deallocated: {logical_name} (Owner PID: {owner_pid})")
                return True, f"Dataset {logical_name} deallocated successfully"
                
            except Exception as e:
                logger.error(f"Dataset deallocation failed: {e}")
                return False, f"Deallocation failed: {str(e)}"
    
    def cleanup_by_owner(self, owner_pid: int) -> List[str]:
        """
        Cleanup all datasets owned by a specific process
        
        Args:
            owner_pid: Process ID of the owner
            
        Returns:
            List of deallocated logical names
        """
        deallocated = []
        
        with self.lock:
            # Find all allocations by owner
            owner_allocations = [
                logical_name for logical_name, allocation in self.allocations.items()
                if allocation.owner_pid == owner_pid
            ]
            
            # Deallocate each one
            for logical_name in owner_allocations:
                success, message = self.deallocate_dataset(logical_name, owner_pid)
                if success:
                    deallocated.append(logical_name)
                else:
                    logger.error(f"Failed to cleanup {logical_name}: {message}")
        
        logger.info(f"Cleaned up {len(deallocated)} datasets for PID {owner_pid}: {deallocated}")
        return deallocated
    
    def get_allocations_by_owner(self, owner_pid: int) -> List[DatasetAllocation]:
        """Get all allocations for a specific owner"""
        with self.lock:
            return [
                allocation for allocation in self.allocations.values()
                if allocation.owner_pid == owner_pid
            ]
    
    def get_allocation_info(self, logical_name: str) -> Optional[DatasetAllocation]:
        """Get allocation information for a logical name"""
        with self.lock:
            return self.allocations.get(logical_name)
    
    def list_all_allocations(self) -> Dict[str, DatasetAllocation]:
        """Get all current allocations"""
        with self.lock:
            return self.allocations.copy()
    
    def _parse_physical_file(self, physical_file: str) -> Tuple[str, str, str]:
        """
        Parse physical file specification
        
        Args:
            physical_file: e.g., EMPLOYEE.FB.TESTLIB
            
        Returns:
            Tuple of (dataset_key, physical_path, dataset_name)
        """
        # Handle format: DATASET.LIBRARY or DATASET.EXT.LIBRARY
        if '.' in physical_file:
            parts = physical_file.rsplit('.', 1)
            if len(parts) == 2:
                file_part, library = parts
                volume = "DISK01"  # Default volume
                
                # Build paths
                dataset_key = f"{volume}.{library}.{file_part}"
                physical_path = f"/home/aspuser/app/volume/{volume}/{library}/{file_part}"
                dataset_name = f"{volume}/{library}/{file_part}"
                
                return dataset_key, physical_path, dataset_name
        
        # Fallback to simple name
        dataset_key = physical_file
        physical_path = physical_file
        dataset_name = physical_file.replace('.', '/')
        
        return dataset_key, physical_path, dataset_name

# Global instance
_dataset_manager = None
_manager_lock = threading.Lock()

def get_dataset_manager() -> DatasetManager:
    """Get singleton dataset manager instance"""
    global _dataset_manager
    if _dataset_manager is None:
        with _manager_lock:
            if _dataset_manager is None:
                _dataset_manager = DatasetManager()
    return _dataset_manager

# Convenience functions for compatibility
def allocate_dataset(logical_name: str, physical_file: str, owner_pid: int, 
                    allocation_type: str = "*DATA") -> Tuple[bool, str]:
    """Allocate dataset using global manager"""
    return get_dataset_manager().allocate_dataset(logical_name, physical_file, owner_pid, allocation_type)

def deallocate_dataset(logical_name: str, owner_pid: int) -> Tuple[bool, str]:
    """Deallocate dataset using global manager"""
    return get_dataset_manager().deallocate_dataset(logical_name, owner_pid)

def cleanup_datasets_by_owner(owner_pid: int) -> List[str]:
    """Cleanup all datasets for owner using global manager"""
    return get_dataset_manager().cleanup_by_owner(owner_pid)

if __name__ == "__main__":
    # Test the dataset manager
    manager = DatasetManager()
    
    # Test allocation
    success, msg = manager.allocate_dataset("TEST-FILE", "TEST.DATA.TESTLIB", os.getpid())
    print(f"Allocation: {success} - {msg}")
    
    # Test deallocation
    success, msg = manager.deallocate_dataset("TEST-FILE", os.getpid())
    print(f"Deallocation: {success} - {msg}")