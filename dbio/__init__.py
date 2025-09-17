"""
DBIO - Database I/O Module for OpenASP Catalog Management

This module provides a flexible, database-agnostic interface for catalog operations,
supporting migration from catalog.json to PostgreSQL and other databases.
"""

from .core import DBIOManager
from .backends import (
    PostgreSQLBackend,
    MySQLBackend,
    SQLiteBackend,
    JSONFileBackend
)
from .cache import CacheManager
from .migration import MigrationManager
from .exceptions import (
    DBIOException,
    BackendNotFoundError,
    ConnectionError,
    ValidationError
)

__version__ = '1.0.0'
__all__ = [
    'DBIOManager',
    'PostgreSQLBackend',
    'MySQLBackend', 
    'SQLiteBackend',
    'JSONFileBackend',
    'CacheManager',
    'MigrationManager',
    'DBIOException',
    'BackendNotFoundError',
    'ConnectionError',
    'ValidationError'
]