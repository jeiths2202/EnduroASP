"""
DBIO Exception Classes
"""


class DBIOException(Exception):
    """Base exception for DBIO module"""
    pass


class BackendNotFoundError(DBIOException):
    """Raised when requested backend is not available"""
    pass


class ConnectionError(DBIOException):
    """Raised when database connection fails"""
    pass


class ValidationError(DBIOException):
    """Raised when data validation fails"""
    pass


class TransactionError(DBIOException):
    """Raised when database transaction fails"""
    pass


class CacheError(DBIOException):
    """Raised when cache operations fail"""
    pass


class MigrationError(DBIOException):
    """Raised when migration operations fail"""
    pass