"""
Database Setup and Schema Migration for OpenASP Catalog
Ensures PostgreSQL database is properly configured for catalog operations.
"""

import os
import sys
import subprocess
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
import logging
from pathlib import Path
from datetime import datetime

logger = logging.getLogger(__name__)

# Configuration
DEFAULT_DB_CONFIG = {
    'host': os.getenv('POSTGRES_HOST', 'localhost'),
    'port': int(os.getenv('POSTGRES_PORT', '5432')),
    'admin_user': os.getenv('POSTGRES_ADMIN_USER', 'postgres'),
    'admin_password': os.getenv('POSTGRES_ADMIN_PASSWORD', ''),
    'database': os.getenv('POSTGRES_DB', 'openasp_catalog'),
    'user': os.getenv('POSTGRES_USER', 'openasp'),
    'password': os.getenv('POSTGRES_PASSWORD', 'openasp_secure_2025')
}

SCHEMA_FILE = "/home/aspuser/app/database/catalog_schema.sql"


def check_postgresql_running() -> bool:
    """Check if PostgreSQL is running."""
    try:
        result = subprocess.run(['pg_isready', '-h', DEFAULT_DB_CONFIG['host'], 
                               '-p', str(DEFAULT_DB_CONFIG['port'])], 
                              capture_output=True, text=True, timeout=10)
        return result.returncode == 0
    except Exception as e:
        logger.error(f"Error checking PostgreSQL status: {e}")
        return False


def create_database_and_user() -> bool:
    """Create database and user if they don't exist."""
    try:
        # Connect as admin user
        conn = psycopg2.connect(
            host=DEFAULT_DB_CONFIG['host'],
            port=DEFAULT_DB_CONFIG['port'],
            user=DEFAULT_DB_CONFIG['admin_user'],
            password=DEFAULT_DB_CONFIG['admin_password'],
            database='postgres'  # Connect to default database
        )
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        
        with conn.cursor() as cursor:
            # Check if database exists
            cursor.execute(
                "SELECT 1 FROM pg_database WHERE datname = %s",
                (DEFAULT_DB_CONFIG['database'],)
            )
            
            if not cursor.fetchone():
                # Create database
                cursor.execute(f"CREATE DATABASE {DEFAULT_DB_CONFIG['database']}")
                print(f"[SUCCESS] Created database: {DEFAULT_DB_CONFIG['database']}")
            else:
                print(f"[INFO] Database already exists: {DEFAULT_DB_CONFIG['database']}")
            
            # Check if user exists
            cursor.execute(
                "SELECT 1 FROM pg_user WHERE usename = %s",
                (DEFAULT_DB_CONFIG['user'],)
            )
            
            if not cursor.fetchone():
                # Create user
                cursor.execute(
                    f"CREATE USER {DEFAULT_DB_CONFIG['user']} WITH PASSWORD %s",
                    (DEFAULT_DB_CONFIG['password'],)
                )
                print(f"[SUCCESS] Created user: {DEFAULT_DB_CONFIG['user']}")
            else:
                print(f"[INFO] User already exists: {DEFAULT_DB_CONFIG['user']}")
            
            # Grant privileges
            cursor.execute(
                f"GRANT ALL PRIVILEGES ON DATABASE {DEFAULT_DB_CONFIG['database']} TO {DEFAULT_DB_CONFIG['user']}"
            )
            print(f"[SUCCESS] Granted privileges to {DEFAULT_DB_CONFIG['user']}")
        
        conn.close()
        return True
        
    except Exception as e:
        print(f"[ERROR] Failed to create database/user: {e}")
        return False


def setup_database_schema() -> bool:
    """Set up database schema using schema file."""
    if not os.path.exists(SCHEMA_FILE):
        print(f"[ERROR] Schema file not found: {SCHEMA_FILE}")
        return False
    
    try:
        # Connect to the catalog database
        conn = psycopg2.connect(
            host=DEFAULT_DB_CONFIG['host'],
            port=DEFAULT_DB_CONFIG['port'],
            database=DEFAULT_DB_CONFIG['database'],
            user=DEFAULT_DB_CONFIG['user'],
            password=DEFAULT_DB_CONFIG['password']
        )
        
        with conn.cursor() as cursor:
            # Read and execute schema file
            with open(SCHEMA_FILE, 'r', encoding='utf-8') as f:
                schema_sql = f.read()
            
            # Execute schema (split by statement if needed)
            cursor.execute(schema_sql)
            conn.commit()
            
            print("[SUCCESS] Database schema created successfully")
        
        conn.close()
        return True
        
    except Exception as e:
        print(f"[ERROR] Failed to setup schema: {e}")
        return False


def test_database_connection() -> Dict[str, Any]:
    """Test database connection and basic operations."""
    try:
        # Test connection
        conn = psycopg2.connect(
            host=DEFAULT_DB_CONFIG['host'],
            port=DEFAULT_DB_CONFIG['port'],
            database=DEFAULT_DB_CONFIG['database'],
            user=DEFAULT_DB_CONFIG['user'],
            password=DEFAULT_DB_CONFIG['password']
        )
        
        with conn.cursor() as cursor:
            # Test basic operations
            cursor.execute("SELECT 1 as test")
            test_result = cursor.fetchone()
            
            # Check if tables exist
            cursor.execute("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
                ORDER BY table_name
            """)
            tables = [row[0] for row in cursor.fetchall()]
            
            # Check if views exist
            cursor.execute("""
                SELECT table_name 
                FROM information_schema.views 
                WHERE table_schema = 'public'
                ORDER BY table_name
            """)
            views = [row[0] for row in cursor.fetchall()]
            
            # Test catalog operations
            cursor.execute("SELECT catalog FROM catalog_json_view LIMIT 1")
            catalog_test = cursor.fetchone()
            
        conn.close()
        
        return {
            'status': 'healthy',
            'connection_test': 'passed' if test_result else 'failed',
            'tables': tables,
            'views': views,
            'catalog_view_test': 'passed' if catalog_test else 'failed',
            'timestamp': datetime.now().isoformat()
        }
        
    except Exception as e:
        return {
            'status': 'failed',
            'error': str(e),
            'timestamp': datetime.now().isoformat()
        }


def initialize_catalog_database(force: bool = False) -> bool:
    """
    Complete database initialization process.
    
    Args:
        force: Force recreation of database/schema
        
    Returns:
        True if successful
    """
    print("Starting catalog database initialization...")
    
    # Step 1: Check PostgreSQL
    if not check_postgresql_running():
        print("[ERROR] PostgreSQL is not running or not accessible")
        print("Please ensure PostgreSQL is installed and running:")
        print("  sudo systemctl start postgresql")
        print("  sudo systemctl enable postgresql")
        return False
    
    print("[SUCCESS] PostgreSQL is running")
    
    # Step 2: Create database and user
    if not create_database_and_user():
        return False
    
    # Step 3: Setup schema
    if not setup_database_schema():
        return False
    
    # Step 4: Test everything
    test_result = test_database_connection()
    
    if test_result['status'] == 'healthy':
        print("\n[SUCCESS] Database initialization completed successfully!")
        print(f"Tables created: {', '.join(test_result['tables'])}")
        print(f"Views created: {', '.join(test_result['views'])}")
        print("\nYou can now:")
        print("1. Enable migration mode: python catalog_migration.py enable-migration")
        print("2. Migrate data: python catalog_migration.py migrate")
        print("3. Switch backend: python catalog_migration.py switch-to-postgresql")
        return True
    else:
        print(f"[ERROR] Database test failed: {test_result.get('error', 'unknown')}")
        return False


def main():
    """Command-line interface for database setup."""
    if len(sys.argv) < 2:
        print("Usage: python setup_catalog_database.py <command>")
        print("Commands:")
        print("  init [--force]       - Initialize complete database setup")
        print("  test                 - Test database connection")
        print("  check                - Check PostgreSQL status")
        print("  create-db            - Create database and user only")
        print("  setup-schema         - Setup schema only")
        return
    
    command = sys.argv[1].lower()
    
    try:
        if command == "init":
            force = "--force" in sys.argv
            initialize_catalog_database(force)
            
        elif command == "test":
            result = test_database_connection()
            print(f"Database test: {result['status']}")
            if result.get('error'):
                print(f"Error: {result['error']}")
            else:
                print(f"Tables: {', '.join(result['tables'])}")
                print(f"Views: {', '.join(result['views'])}")
                
        elif command == "check":
            if check_postgresql_running():
                print("[SUCCESS] PostgreSQL is running")
            else:
                print("[ERROR] PostgreSQL is not accessible")
                
        elif command == "create-db":
            create_database_and_user()
            
        elif command == "setup-schema":
            setup_database_schema()
            
        else:
            print(f"[ERROR] Unknown command: {command}")
            
    except Exception as e:
        print(f"[ERROR] Command failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()