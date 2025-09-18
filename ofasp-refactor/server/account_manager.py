import json
import os
import hashlib
from logger import get_logger

class AccountManager:
    """
    OpenASP Account Management System
    """
    
    def __init__(self, config_loader=None):
        self.config = config_loader
        self.logger = get_logger()
        self.account_file = self._get_account_file_path()
        self.accounts = self._load_accounts()
    
    def _get_account_file_path(self):
        """
        Get account.json file path
        """
        # Default path: src/account.json from project root
        base_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        account_path = os.path.join(base_path, "src", "account.json")
        self.logger.debug(f"Account file path: {account_path}")
        return account_path
    
    def _load_accounts(self):
        """
        Load account information from account.json
        """
        try:
            with open(self.account_file, 'r', encoding='utf-8') as f:
                accounts = json.load(f)
            self.logger.info(f"Successfully loaded {len(accounts)} accounts")
            self.logger.debug(f"Available accounts: {list(accounts.keys())}")
            return accounts
        except FileNotFoundError:
            self.logger.error(f"Account file not found: {self.account_file}")
            return self._create_default_accounts()
        except json.JSONDecodeError as e:
            self.logger.error(f"Invalid JSON in account file: {e}")
            return {}
        except Exception as e:
            self.logger.error(f"Error loading accounts: {e}")
            return {}
    
    def _create_default_accounts(self):
        """
        Create default account file if not exists
        """
        default_accounts = {
            "admin": {
                "password": "admin123",
                "pgm": "PGM1"
            },
            "user01": {
                "password": "userpass",
                "pgm": "PGM2"
            }
        }
        
        try:
            # Create src directory if not exists
            src_dir = os.path.dirname(self.account_file)
            os.makedirs(src_dir, exist_ok=True)
            
            with open(self.account_file, 'w', encoding='utf-8') as f:
                json.dump(default_accounts, f, indent=2, ensure_ascii=False)
            
            self.logger.info(f"Created default account file: {self.account_file}")
            return default_accounts
        except Exception as e:
            self.logger.error(f"Failed to create default account file: {e}")
            return {}
    
    def authenticate(self, user_id, password):
        """
        Authenticate user with ID and password
        Returns: (success: bool, user_info: dict or None, error_message: str)
        """
        self.logger.info(f"Authentication attempt for user: {user_id}")
        
        if not user_id or not password:
            self.logger.warning("Empty user ID or password")
            return False, None, "User ID and password are required"
        
        if user_id not in self.accounts:
            self.logger.warning(f"User not found: {user_id}")
            return False, None, "Invalid user ID or password"
        
        user_info = self.accounts[user_id]
        
        if user_info.get("password") != password:
            self.logger.warning(f"Invalid password for user: {user_id}")
            return False, None, "Invalid user ID or password"
        
        self.logger.info(f"Authentication successful for user: {user_id}")
        self.logger.debug(f"User program: {user_info.get('pgm', 'Unknown')}")
        
        return True, user_info, "Authentication successful"
    
    def get_user_program(self, user_id):
        """
        Get assigned program for user
        """
        if user_id in self.accounts:
            pgm = self.accounts[user_id].get("pgm", "")
            self.logger.debug(f"Retrieved program for {user_id}: {pgm}")
            return pgm
        return None
    
    def reload_accounts(self):
        """
        Reload account information from file
        """
        self.logger.info("Reloading account information")
        old_accounts = self.accounts.copy()
        self.accounts = self._load_accounts()
        
        self.logger.debug(f"Account reload: {len(old_accounts)} -> {len(self.accounts)} accounts")
        return self.accounts
    
    def get_account_list(self):
        """
        Get list of available accounts (for debugging)
        """
        account_list = []
        for user_id, info in self.accounts.items():
            account_list.append({
                "user_id": user_id,
                "pgm": info.get("pgm", ""),
                "has_password": bool(info.get("password"))
            })
        return account_list
