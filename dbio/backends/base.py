"""
Base Backend Class - Abstract interface for all database backends
"""

from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, List


class BaseBackend(ABC):
    """Abstract base class for all DBIO backends."""
    
    def __init__(self, config: Dict[str, Any]):
        """
        Initialize backend with configuration.
        
        Args:
            config: Backend-specific configuration
        """
        self.config = config
    
    @abstractmethod
    def get_all_objects(self) -> Dict[str, Any]:
        """
        Get all objects in catalog.json format.
        
        Returns:
            Complete catalog structure as dictionary
        """
        pass
    
    @abstractmethod
    def get_object(self, volume: str, library: str, object_name: str) -> Optional[Dict[str, Any]]:
        """
        Get a specific object.
        
        Args:
            volume: Volume name
            library: Library name
            object_name: Object name
            
        Returns:
            Object data or None if not found
        """
        pass
    
    @abstractmethod
    def update_object(self, volume: str, library: str, object_name: str, 
                     attributes: Dict[str, Any]) -> bool:
        """
        Update or create an object.
        
        Args:
            volume: Volume name
            library: Library name
            object_name: Object name
            attributes: Object attributes
            
        Returns:
            True if successful
        """
        pass
    
    @abstractmethod
    def delete_object(self, volume: str, library: str, object_name: str) -> bool:
        """
        Delete an object.
        
        Args:
            volume: Volume name
            library: Library name
            object_name: Object name
            
        Returns:
            True if successful
        """
        pass
    
    @abstractmethod
    def query_objects(self, filters: Optional[Dict[str, Any]] = None,
                     sort: Optional[List[tuple]] = None,
                     limit: Optional[int] = None) -> List[Dict[str, Any]]:
        """
        Query objects with filters and sorting.
        
        Args:
            filters: Dictionary of filters to apply
            sort: List of (field, direction) tuples
            limit: Maximum number of results
            
        Returns:
            List of matching objects
        """
        pass
    
    @abstractmethod
    def search_objects(self, query: str, object_type: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Full-text search across objects.
        
        Args:
            query: Search query
            object_type: Optional filter by object type
            
        Returns:
            List of matching objects
        """
        pass
    
    @abstractmethod
    def bulk_operations(self, operations: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Perform bulk operations.
        
        Args:
            operations: List of operations to perform
            
        Returns:
            Summary of results
        """
        pass
    
    @abstractmethod
    def get_statistics(self) -> Dict[str, Any]:
        """
        Get backend statistics.
        
        Returns:
            Statistics dictionary
        """
        pass
    
    @abstractmethod
    def import_catalog(self, catalog_data: Dict[str, Any], merge: bool = False) -> Dict[str, Any]:
        """
        Import catalog data.
        
        Args:
            catalog_data: Complete catalog structure
            merge: If True, merge with existing; if False, replace
            
        Returns:
            Import statistics
        """
        pass
    
    @abstractmethod
    def health_check(self) -> Dict[str, Any]:
        """
        Check backend health.
        
        Returns:
            Health status dictionary
        """
        pass
    
    def close(self):
        """Close connections and cleanup resources."""
        pass
    
    def __enter__(self):
        """Context manager entry."""
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit."""
        self.close()


class TransactionMixin:
    """Mixin for backends that support transactions."""
    
    def begin_transaction(self):
        """Begin a transaction."""
        pass
    
    def commit_transaction(self):
        """Commit current transaction."""
        pass
    
    def rollback_transaction(self):
        """Rollback current transaction."""
        pass
    
    def transaction(self):
        """Context manager for transactions."""
        return TransactionContext(self)


class TransactionContext:
    """Context manager for database transactions."""
    
    def __init__(self, backend):
        self.backend = backend
    
    def __enter__(self):
        self.backend.begin_transaction()
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type is None:
            self.backend.commit_transaction()
        else:
            self.backend.rollback_transaction()