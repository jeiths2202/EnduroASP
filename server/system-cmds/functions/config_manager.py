# -*- coding: utf-8 -*-
"""
Configuration Manager for ASP System
Reads configuration from asp.conf file
"""

import os
from typing import Any, Dict

class ConfigManager:
    _config = None
    _config_file = "/home/aspuser/app/config/asp.conf"
    
    @classmethod
    def load_config(cls) -> Dict[str, Any]:
        """Load configuration from asp.conf file"""
        if cls._config is None:
            cls._config = {}
            
            try:
                if os.path.exists(cls._config_file):
                    with open(cls._config_file, 'r', encoding='utf-8') as f:
                        for line in f:
                            line = line.strip()
                            # Skip comments and empty lines
                            if line and not line.startswith('#'):
                                if '=' in line:
                                    key, value = line.split('=', 1)
                                    key = key.strip()
                                    value = value.strip()
                                    
                                    # Convert boolean values
                                    if value.lower() in ('true', 'false'):
                                        cls._config[key] = value.lower() == 'true'
                                    # Convert numeric values
                                    elif value.isdigit():
                                        cls._config[key] = int(value)
                                    else:
                                        cls._config[key] = value
                                        
            except Exception as e:
                print(f"[ERROR] Failed to load config: {e}")
                
        return cls._config
    
    @classmethod
    def get(cls, key: str, default: Any = None) -> Any:
        """Get configuration value by key"""
        config = cls.load_config()
        return config.get(key, default)
    
    @classmethod
    def is_debug_enabled(cls) -> bool:
        """Check if debug mode is enabled"""
        return cls.get('system.debug', False)
    
    @classmethod
    def get_encoding(cls) -> str:
        """Get system encoding"""
        return cls.get('system.encoding', 'utf-8')
    
    @classmethod
    def get_websocket_timeout(cls) -> int:
        """Get WebSocket timeout in seconds"""
        return cls.get('websocket.timeout', 86400)

# Global instance for easy access
config = ConfigManager()