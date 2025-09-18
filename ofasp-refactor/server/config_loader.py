import json
import os

class ConfigLoader:
    """
    Load and manage OpenASP configuration from asp.conf
    """
    
    def __init__(self, config_path=None):
        if config_path is None:
            # Default path: src/asp.conf from project root
            base_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            config_path = os.path.join(base_path, "src", "asp.conf")
        
        self.config_path = config_path
        self.config = self._load_config()
    
    def _load_config(self):
        """
        Load configuration from asp.conf file
        """
        try:
            with open(self.config_path, 'r', encoding='utf-8') as f:
                config = json.load(f)
            return config
        except FileNotFoundError:
            print(f"Warning: Config file not found at {self.config_path}")
            # Return default configuration
            return self._get_default_config()
        except json.JSONDecodeError as e:
            print(f"Error: Invalid JSON in config file: {e}")
            return self._get_default_config()
        except Exception as e:
            print(f"Error loading config: {e}")
            return self._get_default_config()
    
    def _get_default_config(self):
        """
        Return default configuration values
        """
        base_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        return {
            "LOG_LVL": "D",
            "LOG_DIR": "./logs",
            "SMED_DIR": os.path.join(base_path, "public", "SMED_FILES"),
            "JAVA_CLASS_DIR": os.path.join(base_path, "server", "java_classes")
        }
    
    def get(self, key, default=None):
        """
        Get configuration value by key
        """
        return self.config.get(key, default)
    
    def get_smed_dir(self):
        """
        Get SMED directory path
        """
        return self.config.get("SMED_DIR", "./public/SMED_FILES")
    
    def get_log_dir(self):
        """
        Get log directory path
        """
        return self.config.get("LOG_DIR", "./logs")
    
    def get_log_level(self):
        """
        Get log level
        """
        return self.config.get("LOG_LVL", "D")
    
    def get_java_class_dir(self):
        """
        Get Java class directory path
        """
        return self.config.get("JAVA_CLASS_DIR", "./server/java_classes")
    
    def reload(self):
        """
        Reload configuration from file
        """
        self.config = self._load_config()
        return self.config
