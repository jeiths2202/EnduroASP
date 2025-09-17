#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Java Encoding API Client for ASP System Commands
Replaces complex Python encoding logic with Java API calls
"""

import requests
import base64
import logging
from typing import Optional, Union, Dict, Any

# Setup logging
logger = logging.getLogger(__name__)

class JavaEncodingClient:
    """
    Client for calling Java Encoding API from Python
    Implements the sjis_to_utf8() function signature
    """
    
    def __init__(self, api_base_url: str = "http://localhost:8080/api/encoding"):
        """
        Initialize the Java encoding client
        
        Args:
            api_base_url: Base URL for the Java encoding API
        """
        self.api_base_url = api_base_url
        self.session = requests.Session()
        
        # Test connection on initialization
        try:
            self._health_check()
            logger.info("Java Encoding API connection established")
        except Exception as e:
            logger.warning(f"Java Encoding API not available: {e}")
    
    def _health_check(self) -> bool:
        """Check if the Java API is available"""
        response = self.session.get(f"{self.api_base_url}/health", timeout=5)
        response.raise_for_status()
        return response.json().get('status') == 'UP'
    
    def sjis_to_utf8(self, 
                     input_buffer: bytes, 
                     output_buffer: Optional[bytes] = None,
                     input_length: Optional[int] = None, 
                     output_length: Optional[int] = None,
                     encoding: str = "SHIFT_JIS", 
                     layout: Optional[str] = None) -> Dict[str, Any]:
        """
        Main SJIS to UTF8 conversion function - matches the Java API signature
        
        Args:
            input_buffer: Raw input bytes to convert
            output_buffer: Output buffer (unused, allocated by Java service)
            input_length: Input buffer length (auto-detected if None)
            output_length: Maximum output buffer length (auto-calculated if None)
            encoding: Source encoding (default: SHIFT_JIS)
            layout: Layout parameter (future use)
            
        Returns:
            Dict containing conversion result with keys:
            - success: bool
            - output_bytes: converted UTF-8 bytes
            - utf8_string: converted UTF-8 string
            - actual_length: actual output length
            - error_message: error message if failed
        """
        try:
            # Validate and prepare parameters
            if not input_buffer:
                return {"success": False, "error_message": "Empty input buffer"}
            
            if input_length is None:
                input_length = len(input_buffer)
            
            if output_length is None:
                output_length = input_length * 3  # UTF-8 can be up to 3x larger for Japanese
            
            # Prepare API request
            input_b64 = base64.b64encode(input_buffer).decode('ascii')
            
            payload = {
                "inputBuffer": input_b64,
                "inputLength": input_length,
                "outputLength": output_length,
                "encoding": encoding,
                "layout": layout
            }
            
            logger.debug(f"Calling Java API: {encoding} -> UTF-8, {input_length} bytes")
            
            # Call Java API
            response = self.session.post(
                f"{self.api_base_url}/sjis-to-utf8",
                json=payload,
                timeout=30
            )
            
            if response.ok:
                result = response.json()
                
                if result.get('success'):
                    # Decode base64 output
                    output_bytes = base64.b64decode(result['outputBuffer'])
                    utf8_string = output_bytes.decode('utf-8', errors='replace')
                    
                    return {
                        "success": True,
                        "output_bytes": output_bytes,
                        "utf8_string": utf8_string,
                        "actual_length": result['actualOutputLength'],
                        "source_encoding": result.get('sourceEncoding', encoding),
                        "target_encoding": result.get('targetEncoding', 'UTF-8'),
                        "error_message": None
                    }
                else:
                    return {
                        "success": False,
                        "error_message": result.get('errorMessage', 'API conversion failed')
                    }
            else:
                return {
                    "success": False,
                    "error_message": f"API error: {response.status_code} - {response.text}"
                }
                
        except requests.exceptions.RequestException as e:
            logger.error(f"Java API request failed: {e}")
            return {
                "success": False,
                "error_message": f"API request failed: {e}"
            }
        except Exception as e:
            logger.error(f"Encoding conversion error: {e}")
            return {
                "success": False,
                "error_message": f"Conversion error: {e}"
            }
    
    def convert_bytes_to_utf8(self, data: bytes, encoding: str = "SHIFT_JIS") -> str:
        """
        Convenience method to convert bytes to UTF-8 string
        
        Args:
            data: Raw bytes to convert
            encoding: Source encoding
            
        Returns:
            UTF-8 string or fallback representation on error
        """
        result = self.sjis_to_utf8(data, encoding=encoding)
        
        if result['success']:
            return result['utf8_string']
        else:
            logger.warning(f"Java API conversion failed: {result['error_message']}")
            # Fallback to hex representation
            return ' '.join(f'{b:02X}' for b in data[:40]) + ('...' if len(data) > 40 else '')
    
    def get_supported_encodings(self) -> list:
        """Get list of supported encodings from Java API"""
        try:
            response = self.session.get(f"{self.api_base_url}/supported", timeout=10)
            response.raise_for_status()
            return response.json().get('encodings', [])
        except Exception as e:
            logger.error(f"Failed to get supported encodings: {e}")
            return ["SHIFT_JIS", "EUC-JP", "UTF-8"]  # Fallback list
    
    def simple_text_convert(self, text: str, encoding: str = "SHIFT_JIS") -> Dict[str, Any]:
        """
        Simple text conversion for testing purposes
        
        Args:
            text: Text to convert
            encoding: Source encoding
            
        Returns:
            Conversion result dictionary
        """
        try:
            payload = {"text": text, "encoding": encoding}
            
            response = self.session.post(
                f"{self.api_base_url}/convert-text",
                json=payload,
                timeout=10
            )
            
            response.raise_for_status()
            return response.json()
            
        except Exception as e:
            logger.error(f"Simple text conversion failed: {e}")
            return {"success": False, "error": str(e)}


# Global instance for easy import
java_encoding_client = JavaEncodingClient()

def convert_bytes_to_string_via_java(data: bytes, encoding: str = "SHIFT_JIS") -> str:
    """
    Drop-in replacement for _convert_bytes_to_string function in asp_commands.py
    Uses Java API instead of Python codecs or external tools
    
    Args:
        data: Raw bytes to convert
        encoding: Source encoding
        
    Returns:
        UTF-8 string
    """
    return java_encoding_client.convert_bytes_to_utf8(data, encoding)

def sjis_to_utf8_via_java(input_buffer: bytes, 
                         output_buffer: Optional[bytes] = None,
                         input_length: Optional[int] = None, 
                         output_length: Optional[int] = None,
                         encoding: str = "SHIFT_JIS", 
                         layout: Optional[str] = None) -> Dict[str, Any]:
    """
    Direct mapping to Java API sjis_to_utf8 function
    
    Args:
        input_buffer: Raw input bytes
        output_buffer: Output buffer (unused)
        input_length: Input buffer length
        output_length: Maximum output buffer length
        encoding: Source encoding
        layout: Layout parameter (future use)
        
    Returns:
        Conversion result dictionary
    """
    return java_encoding_client.sjis_to_utf8(
        input_buffer, output_buffer, input_length, output_length, encoding, layout
    )


if __name__ == "__main__":
    # Test the Java API client
    import os
    
    # Set up logging
    logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
    
    print("=== Java Encoding API Client Test ===")
    
    # Test 1: Health check
    try:
        client = JavaEncodingClient()
        print("[OK] Java API connection successful")
    except Exception as e:
        print(f"[ERROR] Java API connection failed: {e}")
        exit(1)
    
    # Test 2: Get supported encodings
    encodings = client.get_supported_encodings()
    print(f"[OK] Supported encodings: {encodings}")
    
    # Test 3: Simple text conversion
    test_result = client.simple_text_convert("Hello World", "UTF-8")
    print(f"[OK] Simple text conversion: {test_result}")
    
    # Test 4: Binary conversion
    test_bytes = "こんにちは".encode('shift_jis')
    conversion_result = client.sjis_to_utf8(test_bytes, encoding="SHIFT_JIS")
    print(f"[OK] Binary conversion result: {conversion_result}")
    
    if conversion_result['success']:
        print(f"  Converted: {conversion_result['utf8_string']}")
    
    # Test 5: Convenience function
    utf8_string = client.convert_bytes_to_utf8(test_bytes, "SHIFT_JIS")
    print(f"[OK] Convenience function result: {utf8_string}")
    
    print("\n=== All tests completed ===")