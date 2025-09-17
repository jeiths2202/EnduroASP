#!/usr/bin/env python3
"""
BitNet B1.58 Service for Chat API
Handles BitNet model inference with fallback to mock responses
"""

import os
import json
import subprocess
import logging
from pathlib import Path
from typing import Dict, Any, Optional
import time

logger = logging.getLogger(__name__)

class BitNetService:
    def __init__(self):
        self.bitnet_dir = Path("/home/aspuser/app/models/bitnet/BitNet")
        self.model_path = self.bitnet_dir / "models" / "BitNet-b1.58-2B-4T" / "ggml-model-i2_s.gguf"
        self.venv_path = self.bitnet_dir / ".venv"
        self.is_available = self._check_availability()
        
        logger.info(f"BitNet Service initialized - Available: {self.is_available}")
        
    def _check_availability(self) -> bool:
        """Check if BitNet is properly installed and configured"""
        try:
            # Check if BitNet directory exists
            if not self.bitnet_dir.exists():
                logger.warning(f"BitNet directory not found: {self.bitnet_dir}")
                return False
                
            # Check if model file exists
            if not self.model_path.exists():
                logger.warning(f"BitNet model not found: {self.model_path}")
                return False
                
            # Check if virtual environment exists
            if not self.venv_path.exists():
                logger.warning(f"BitNet venv not found: {self.venv_path}")
                return False
                
            # Check if build directory and binary exist
            build_dir = self.bitnet_dir / "build" / "bin"
            llama_cli = build_dir / "llama-cli"
            if not llama_cli.exists():
                logger.warning(f"BitNet llama-cli not found: {llama_cli}")
                return False
                
            logger.info("BitNet is fully available and ready to use")
            return True
            
        except Exception as e:
            logger.error(f"Error checking BitNet availability: {e}")
            return False
    
    def generate_response(self, prompt: str, options: Dict[str, Any] = None) -> Dict[str, Any]:
        """Generate response using BitNet model"""
        if options is None:
            options = {}
            
        try:
            if not self.is_available:
                return self._mock_response(prompt)
                
            return self._call_bitnet(prompt, options)
            
        except Exception as e:
            logger.error(f"BitNet generation error: {e}")
            return self._mock_response(prompt, error=str(e))
    
    def _call_bitnet(self, prompt: str, options: Dict[str, Any]) -> Dict[str, Any]:
        """Call actual BitNet inference"""
        try:
            # Ensure prompt is properly encoded as UTF-8
            if isinstance(prompt, str):
                # Normalize and encode prompt to handle Korean characters
                import unicodedata
                prompt = unicodedata.normalize('NFC', prompt)
            # Prepare BitNet inference command using direct llama-cli
            cmd = [
                str(self.bitnet_dir / "build" / "bin" / "llama-cli"),
                "-m", str(self.model_path),
                "-p", prompt,
                "-t", str(options.get("threads", 4)),
                "--temp", str(options.get("temperature", 0.7)),
                "-n", str(options.get("max_tokens", 100)),
                "--no-display-prompt"
            ]
            
            if not options.get("conversational", True):
                cmd.append("-c")
                cmd.append("0")  # No context
            
            # Set working directory to BitNet directory
            start_time = time.time()
            timeout_duration = options.get("timeout", 120)  # Increased default from 60 to 120 seconds
            logger.info(f"Starting BitNet inference with timeout: {timeout_duration}s")
            
            result = subprocess.run(
                cmd,
                cwd=str(self.bitnet_dir),
                capture_output=True,
                text=True,
                encoding='utf-8',
                timeout=timeout_duration,
                env={"PATH": str(self.bitnet_dir / "build" / "bin") + ":" + os.environ.get("PATH", ""), "LC_ALL": "en_US.UTF-8", "LANG": "en_US.UTF-8", "PYTHONIOENCODING": "utf-8"}
            )
            
            inference_time = time.time() - start_time
            
            if result.returncode == 0:
                # Clean up the response
                response_text = result.stdout.strip()
                # Remove the original prompt if it appears in output
                if prompt in response_text:
                    response_text = response_text.replace(prompt, "").strip()
                
                # Take only the first meaningful response part
                lines = response_text.split('\n')
                clean_lines = [line.strip() for line in lines if line.strip() and not line.startswith('main:') and not line.startswith('llama')]
                response_text = '\n'.join(clean_lines[:10])  # Limit to first 10 meaningful lines
                
                return {
                    "success": True,
                    "response": response_text or "BitNet response generated.",
                    "model": "BitNet B1.58 2B",
                    "inference_time": inference_time,
                    "tokens_per_second": self._estimate_tokens_per_second(response_text, inference_time)
                }
            else:
                # Handle potential encoding issues in stderr
                try:
                    stderr_msg = result.stderr
                    logger.error(f"BitNet inference failed (code {result.returncode}): {stderr_msg}")
                except UnicodeEncodeError:
                    logger.error(f"BitNet inference failed (code {result.returncode}): <encoding error in stderr>")
                    stderr_msg = "Encoding error in error message"
                return self._mock_response(prompt, error=f"Inference failed: {stderr_msg}")
                
        except subprocess.TimeoutExpired as e:
            timeout_duration = options.get("timeout", 120)
            logger.error(f"BitNet inference timeout after {timeout_duration} seconds")
            logger.error(f"Command that timed out: {' '.join(cmd)}")
            return {
                "success": False,
                "error": f"BitNet inference timeout after {timeout_duration} seconds",
                "timeout_duration": timeout_duration,
                "model": "BitNet B1.58 2B",
                "mock": False
            }
            
        except Exception as e:
            logger.error(f"BitNet call error: {e}")
            return self._mock_response(prompt, error=str(e))
    
    def _mock_response(self, prompt: str, error: Optional[str] = None) -> Dict[str, Any]:
        """Generate mock response when BitNet is not available"""
        import random
        import time
        
        # More dynamic responses based on prompt content
        if any(keyword in prompt.lower() for keyword in ['안녕', 'hello', '안녕하세요', 'hi']):
            responses = [
                "안녕하세요! BitNet B1.58 2B 모델입니다. 어떻게 도와드릴까요?",
                "Hello! I'm BitNet B1.58, a 2-bit quantized model. How can I assist you today?",
                "안녕하세요! 효율적인 2비트 양자화된 BitNet 모델입니다. 무엇을 도와드릴까요?"
            ]
        elif any(keyword in prompt.lower() for keyword in ['code', 'function', 'class', 'implement', 'write', '코드', '함수', '구현']):
            responses = [
                f"다음은 요청하신 코드 예제입니다:\n\n```python\n# {prompt[:50]}... 구현\ndef example_function():\n    return 'BitNet B1.58로 생성된 코드'\n```",
                f"Here's a code example for your request:\n\n```javascript\n// Implementation for: {prompt[:50]}...\nfunction solution() {{\n    return 'Generated by BitNet B1.58';\n}}\n```",
                f"코딩 작업을 도와드리겠습니다:\n\n```python\n# {prompt[:30]}에 대한 구현\nclass Example:\n    def __init__(self):\n        self.model = 'BitNet B1.58'\n```"
            ]
        elif any(keyword in prompt.lower() for keyword in ['explain', '설명', 'what', '무엇', 'how', '어떻게']):
            responses = [
                f"질문해주신 '{prompt[:50]}...' 에 대해 설명드리겠습니다. BitNet B1.58은 2비트 양자화를 통해 효율적인 추론을 제공하는 모델입니다.",
                f"Your question about '{prompt[:50]}...' is interesting. As a 2-bit quantized model, I can provide efficient responses while maintaining good performance.",
                f"'{prompt[:30]}...' 에 대한 설명을 위해서는 더 구체적인 정보가 필요할 수 있습니다. BitNet의 특성을 활용해 최적화된 답변을 드리겠습니다."
            ]
        else:
            responses = [
                f"'{prompt[:50]}...' 에 대한 질문이군요. BitNet B1.58 2B 모델로서 효율적인 추론을 통해 답변드리겠습니다.",
                f"I understand your question about '{prompt[:50]}...'. As a 2-bit quantized BitNet model, I'll provide an efficient response.",
                f"흥미로운 질문입니다. BitNet B1.58의 2비트 양자화 기술을 활용해 답변을 생성하고 있습니다.",
                f"질문을 이해했습니다. 경량화된 BitNet 모델의 장점을 살려 빠르고 정확한 답변을 제공하겠습니다."
            ]
        
        # Add some randomness to avoid identical responses
        random.seed(int(time.time() * 1000) % 10000)  # Use current time for randomness
        response_text = random.choice(responses)
        
        # Add timestamp to make responses unique
        timestamp = int(time.time()) % 100
        response_text += f"\n\n[응답 생성 시간: {timestamp:02d}s - BitNet B1.58 Mock Response]"
        
        return {
            "success": not bool(error),
            "response": response_text,
            "model": "BitNet B1.58 2B (Mock)" if error else "BitNet B1.58 2B",
            "inference_time": random.uniform(0.3, 0.8),  # Random timing
            "tokens_per_second": random.uniform(15.0, 25.0),  # Random performance
            "mock": True,
            "error": error
        }
    
    def _estimate_tokens_per_second(self, text: str, inference_time: float) -> float:
        """Estimate tokens per second based on response length"""
        if inference_time <= 0:
            return 0.0
        
        # Rough estimation: ~4 characters per token
        estimated_tokens = len(text) / 4
        return estimated_tokens / inference_time
    
    def get_model_info(self) -> Dict[str, Any]:
        """Get BitNet model information"""
        return {
            "name": "bitnet-b1.58:2b",
            "friendly_name": "BitNet B1.58 2B",
            "size": 2.0,  # Billions of parameters
            "quantization": "2-bit (i2_s)",
            "architecture": "BitNet",
            "available": self.is_available,
            "description": "Microsoft BitNet B1.58 2B model with 2-bit quantization for efficient inference",
            "capabilities": ["code_generation", "text_completion", "conversational"],
            "optimized_for": "coding_tasks"
        }
    
    def download_model(self) -> Dict[str, Any]:
        """Download BitNet model if not available"""
        try:
            if self.model_path.exists():
                return {"success": True, "message": "Model already exists"}
            
            # Create models directory
            models_dir = self.bitnet_dir / "models"
            models_dir.mkdir(exist_ok=True)
            
            # Download using huggingface-cli
            cmd = [
                str(self.venv_path / "bin" / "huggingface-cli"),
                "download",
                "microsoft/bitnet-b1.58-2B-4T-gguf",
                "--local-dir",
                str(self.bitnet_dir / "models" / "BitNet-b1.58-2B-4T")
            ]
            
            logger.info("Starting BitNet model download...")
            result = subprocess.run(
                cmd,
                cwd=str(self.bitnet_dir),
                capture_output=True,
                text=True,
                timeout=1800  # 30 minutes timeout
            )
            
            if result.returncode == 0:
                self.is_available = self._check_availability()
                return {
                    "success": True,
                    "message": "Model downloaded successfully",
                    "available": self.is_available
                }
            else:
                return {
                    "success": False,
                    "error": f"Download failed: {result.stderr}",
                    "available": False
                }
                
        except Exception as e:
            logger.error(f"Model download error: {e}")
            return {
                "success": False,
                "error": str(e),
                "available": False
            }

# Global BitNet service instance
bitnet_service = BitNetService()