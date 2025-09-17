import logging
import os
from datetime import datetime
from config_loader import ConfigLoader

class OpenASPLogger:
    """
    OpenASP SMED System Logger with configurable levels
    """
    
    def __init__(self, name="OpenASP", config=None):
        self.config = config or ConfigLoader()
        self.logger = logging.getLogger(name)
        self.setup_logger()
    
    def setup_logger(self):
        """
        Setup logger based on configuration
        """
        # Clear existing handlers
        self.logger.handlers.clear()
        
        # Get log level from config
        log_level_str = self.config.get_log_level()
        log_level = self._get_log_level(log_level_str)
        
        self.logger.setLevel(log_level)
        
        # Create log directory if not exists
        log_dir = self.config.get_log_dir()
        os.makedirs(log_dir, exist_ok=True)
        
        # File handler
        log_file = os.path.join(log_dir, f"openASP_{datetime.now().strftime('%Y%m%d')}.log")
        file_handler = logging.FileHandler(log_file, encoding='utf-8')
        file_handler.setLevel(log_level)
        
        # Console handler
        console_handler = logging.StreamHandler()
        console_handler.setLevel(log_level)
        
        # Formatter
        formatter = logging.Formatter(
            '%(asctime)s [%(levelname)s] %(name)s: %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        
        file_handler.setFormatter(formatter)
        console_handler.setFormatter(formatter)
        
        self.logger.addHandler(file_handler)
        self.logger.addHandler(console_handler)
        
        self.debug(f"Logger initialized - Level: {log_level_str}, Log Dir: {log_dir}")
    
    def _get_log_level(self, level_str):
        """
        Convert string log level to logging level
        """
        level_map = {
            'D': logging.DEBUG,
            'I': logging.INFO,
            'E': logging.ERROR
        }
        return level_map.get(level_str.upper(), logging.INFO)
    
    def debug(self, message):
        """Log debug message"""
        self.logger.debug(message)
    
    def info(self, message):
        """Log info message"""
        self.logger.info(message)
    
    def error(self, message):
        """Log error message"""
        self.logger.error(message)
    
    def log_smed_field(self, field_name, position, length, prompt):
        """Log SMED field parsing details"""
        self.debug(f"SMED Field: {field_name} | Pos: {position} | Len: {length} | Prompt: '{prompt}'")
    
    def log_screen_render(self, row, col, char, field_name=None):
        """Log screen rendering details"""
        if field_name:
            self.debug(f"Render: ({row},{col}) = '{char}' from field '{field_name}'")
        else:
            self.debug(f"Render: ({row},{col}) = '{char}' (empty)")
    
    def log_fullwidth_char(self, char, code, is_fullwidth):
        """Log full-width character detection"""
        self.debug(f"Char: '{char}' (U+{code:04X}) -> FullWidth: {is_fullwidth}")

# Global logger instance
logger = None

def get_logger():
    """Get global logger instance"""
    global logger
    if logger is None:
        logger = OpenASPLogger()
    return logger
