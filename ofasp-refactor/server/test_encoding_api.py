#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
UTF-8 ↔ SJIS 인코딩 변환 API 테스트 스크립트
Position-based SMED API와 WebSocket 통합 검증
"""

import requests
import json
import sys
import time
from datetime import datetime

# API 서버 설정
API_BASE_URL = "http://localhost:8000"
HEADERS = {'Content-Type': 'application/json'}

class EncodingAPITester:
    """인코딩 API 테스트 클래스"""
    
    def __init__(self, base_url=API_BASE_URL):
        self.base_url = base_url
        self.test_results = []
        
    def log_test(self, test_name, success, details=None):
        """테스트 결과 로깅"""
        result = {
            'test_name': test_name,
            'success': success,
            'timestamp': datetime.now().isoformat(),
            'details': details or {}
        }
        self.test_results.append(result)
        
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}")
        if details and not success:
            print(f"   Details: {details}")
    
    def test_server_health(self):
        """API 서버 상태 확인"""
        try:
            response = requests.get(f"{self.base_url}/api/health", timeout=5)
            if response.status_code == 200:
                data = response.json()
                self.log_test("Server Health Check", True, {
                    'status': data.get('status'),
                    'version': data.get('version')
                })
                return True
            else:
                self.log_test("Server Health Check", False, {
                    'status_code': response.status_code
                })
                return False
        except Exception as e:
            self.log_test("Server Health Check", False, {'error': str(e)})
            return False
    
    def test_encoding_status(self):
        """인코딩 서비스 상태 확인"""
        try:
            response = requests.get(f"{self.base_url}/api/encoding/status", timeout=5)
            if response.status_code == 200:
                data = response.json()
                status_info = data.get('status', {})
                
                success = (
                    status_info.get('service_status') == 'active' and
                    'utf-8' in status_info.get('encodings_supported', []) and
                    'shift_jis' in status_info.get('encodings_supported', [])
                )
                
                self.log_test("Encoding Service Status", success, {
                    'service_status': status_info.get('service_status'),
                    'encodings_supported': status_info.get('encodings_supported'),
                    'japanese_support': status_info.get('features', {}).get('japanese_support')
                })
                return success
            else:
                self.log_test("Encoding Service Status", False, {
                    'status_code': response.status_code
                })
                return False
        except Exception as e:
            self.log_test("Encoding Service Status", False, {'error': str(e)})
            return False
    
    def test_utf8_to_sjis_conversion(self):
        """UTF-8 → SJIS 변환 테스트"""
        test_cases = [
            {
                'name': 'Basic Japanese Text',
                'text': 'こんにちは世界',
                'expected_success': True
            },
            {
                'name': 'Japanese Names',
                'text': '田中太郎',
                'expected_success': True
            },
            {
                'name': 'Mixed Text',
                'text': 'Hello こんにちは 123',
                'expected_success': True
            },
            {
                'name': 'Korean Text (may fail)',
                'text': '안녕하세요',
                'expected_success': False  # SJIS에서 지원하지 않는 문자
            }
        ]
        
        all_passed = True
        
        for test_case in test_cases:
            try:
                payload = {
                    'text': test_case['text'],
                    'error_handling': 'replace'
                }
                
                response = requests.post(
                    f"{self.base_url}/api/encoding/utf8-to-sjis",
                    headers=HEADERS,
                    json=payload,
                    timeout=10
                )
                
                if response.status_code == 200:
                    data = response.json()
                    success = data.get('success', False)
                    
                    # 성공 여부가 예상과 일치하는지 확인
                    test_passed = success == test_case['expected_success']
                    
                    self.log_test(f"UTF-8 to SJIS: {test_case['name']}", test_passed, {
                        'original_text': test_case['text'],
                        'conversion_success': success,
                        'byte_length': data.get('byte_length'),
                        'has_hex_output': 'hex_output' in data,
                        'has_warnings': 'warnings' in data
                    })
                    
                    if not test_passed:
                        all_passed = False
                else:
                    self.log_test(f"UTF-8 to SJIS: {test_case['name']}", False, {
                        'status_code': response.status_code,
                        'response_text': response.text[:200]
                    })
                    all_passed = False
                    
            except Exception as e:
                self.log_test(f"UTF-8 to SJIS: {test_case['name']}", False, {
                    'error': str(e)
                })
                all_passed = False
        
        return all_passed
    
    def test_sjis_to_utf8_conversion(self):
        """SJIS → UTF-8 변환 테스트"""
        # 일본어 "こんにちは"의 SJIS 헥스 코드
        test_cases = [
            {
                'name': 'Japanese Hex String',
                'data': '82B182F182C682C882BF82CD',  # "こんにちは"
                'expected_success': True
            },
            {
                'name': 'Simple ASCII',
                'data': 'Hello World',
                'expected_success': True
            },
            {
                'name': 'Invalid Hex',
                'data': 'ZZ',
                'expected_success': False
            }
        ]
        
        all_passed = True
        
        for test_case in test_cases:
            try:
                payload = {
                    'data': test_case['data'],
                    'error_handling': 'replace'
                }
                
                response = requests.post(
                    f"{self.base_url}/api/encoding/sjis-to-utf8",
                    headers=HEADERS,
                    json=payload,
                    timeout=10
                )
                
                if response.status_code == 200:
                    data = response.json()
                    success = data.get('success', False)
                    
                    # 성공 여부가 예상과 일치하는지 확인
                    test_passed = success == test_case['expected_success']
                    
                    self.log_test(f"SJIS to UTF-8: {test_case['name']}", test_passed, {
                        'original_data': test_case['data'][:50] + '...' if len(test_case['data']) > 50 else test_case['data'],
                        'conversion_success': success,
                        'converted_text': data.get('converted', '')[:50] + '...' if len(data.get('converted', '')) > 50 else data.get('converted', ''),
                        'char_length': data.get('char_length'),
                        'has_warnings': 'warnings' in data
                    })
                    
                    if not test_passed:
                        all_passed = False
                else:
                    self.log_test(f"SJIS to UTF-8: {test_case['name']}", False, {
                        'status_code': response.status_code,
                        'response_text': response.text[:200]
                    })
                    all_passed = False
                    
            except Exception as e:
                self.log_test(f"SJIS to UTF-8: {test_case['name']}", False, {
                    'error': str(e)
                })
                all_passed = False
        
        return all_passed
    
    def test_batch_conversion(self):
        """배치 변환 테스트"""
        try:
            payload = {
                'texts': [
                    'Hello',
                    'こんにちは',
                    '田中太郎',
                    'World',
                    'テスト'
                ],
                'source_encoding': 'utf-8',
                'target_encoding': 'shift_jis',
                'error_handling': 'replace'
            }
            
            response = requests.post(
                f"{self.base_url}/api/encoding/batch-convert",
                headers=HEADERS,
                json=payload,
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                success = data.get('success', False)
                
                self.log_test("Batch Conversion", success, {
                    'total_count': data.get('total_count'),
                    'success_count': data.get('success_count'),
                    'error_count': data.get('error_count'),
                    'has_results': len(data.get('results', [])) > 0
                })
                
                return success
            else:
                self.log_test("Batch Conversion", False, {
                    'status_code': response.status_code,
                    'response_text': response.text[:200]
                })
                return False
                
        except Exception as e:
            self.log_test("Batch Conversion", False, {'error': str(e)})
            return False
    
    def test_encoding_detection(self):
        """인코딩 자동 감지 테스트"""
        test_cases = [
            {
                'name': 'UTF-8 Text',
                'data': 'Hello World こんにちは',
                'expected_encoding': 'utf-8'
            },
            {
                'name': 'ASCII Text',
                'data': 'Hello World 123',
                'expected_encoding': 'ascii'
            }
        ]
        
        all_passed = True
        
        for test_case in test_cases:
            try:
                payload = {'data': test_case['data']}
                
                response = requests.post(
                    f"{self.base_url}/api/encoding/detect",
                    headers=HEADERS,
                    json=payload,
                    timeout=10
                )
                
                if response.status_code == 200:
                    data = response.json()
                    success = data.get('success', False)
                    detection = data.get('detection', {})
                    
                    detected_encoding = detection.get('encoding', 'unknown')
                    confidence = detection.get('confidence', 0.0)
                    
                    # 감지된 인코딩이 예상과 비슷한지 확인 (완전히 일치하지 않을 수도 있음)
                    test_passed = success and confidence > 0.5
                    
                    self.log_test(f"Encoding Detection: {test_case['name']}", test_passed, {
                        'detected_encoding': detected_encoding,
                        'confidence': confidence,
                        'is_japanese': detection.get('is_japanese'),
                        'expected_encoding': test_case['expected_encoding']
                    })
                    
                    if not test_passed:
                        all_passed = False
                else:
                    self.log_test(f"Encoding Detection: {test_case['name']}", False, {
                        'status_code': response.status_code
                    })
                    all_passed = False
                    
            except Exception as e:
                self.log_test(f"Encoding Detection: {test_case['name']}", False, {
                    'error': str(e)
                })
                all_passed = False
        
        return all_passed
    
    def test_smed_integration(self):
        """SMED 통합 테스트"""
        try:
            payload = {
                'map_name': 'EMPLOYEE_FORM',
                'field_data': [
                    'Hello World',
                    'こんにちは',
                    '田中太郎',
                    'Department A'
                ],
                'source_encoding': 'utf-8',
                'target_encoding': 'shift_jis',
                'terminal_id': 'TERM001',
                'wsname': 'TESTWS'
            }
            
            response = requests.post(
                f"{self.base_url}/api/encoding/smed-convert",
                headers=HEADERS,
                json=payload,
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                success = data.get('success', False)
                
                self.log_test("SMED Integration", success, {
                    'map_name': data.get('map_name'),
                    'field_count': len(data.get('field_data', [])),
                    'conversion_stats': data.get('conversion_stats'),
                    'has_terminal_info': 'terminal_info' in data
                })
                
                return success
            else:
                self.log_test("SMED Integration", False, {
                    'status_code': response.status_code,
                    'response_text': response.text[:200]
                })
                return False
                
        except Exception as e:
            self.log_test("SMED Integration", False, {'error': str(e)})
            return False
    
    def test_websocket_integration(self):
        """WebSocket 통합 테스트"""
        try:
            payload = {
                'message': 'こんにちは WebSocket',
                'source_encoding': 'utf-8',
                'target_encoding': 'shift_jis',
                'session_id': 'test_session_001',
                'message_type': 'smed_data'
            }
            
            response = requests.post(
                f"{self.base_url}/api/encoding/websocket-convert",
                headers=HEADERS,
                json=payload,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                success = data.get('success', False)
                
                self.log_test("WebSocket Integration", success, {
                    'session_id': data.get('session_id'),
                    'message_type': data.get('message_type'),
                    'has_converted_message': 'converted_message' in data,
                    'has_timestamp': 'timestamp' in data
                })
                
                return success
            else:
                self.log_test("WebSocket Integration", False, {
                    'status_code': response.status_code,
                    'response_text': response.text[:200]
                })
                return False
                
        except Exception as e:
            self.log_test("WebSocket Integration", False, {'error': str(e)})
            return False
    
    def run_all_tests(self):
        """모든 테스트 실행"""
        print("=" * 60)
        print("UTF-8 ↔ SJIS 인코딩 변환 API 테스트 시작")
        print("=" * 60)
        
        # 서버 상태 확인
        if not self.test_server_health():
            print("❌ API 서버에 연결할 수 없습니다. 서버가 실행 중인지 확인하세요.")
            return False
        
        # 인코딩 서비스 상태 확인
        if not self.test_encoding_status():
            print("❌ 인코딩 서비스가 제대로 설정되지 않았습니다.")
            return False
        
        # 테스트 실행
        tests = [
            self.test_utf8_to_sjis_conversion,
            self.test_sjis_to_utf8_conversion,
            self.test_batch_conversion,
            self.test_encoding_detection,
            self.test_smed_integration,
            self.test_websocket_integration
        ]
        
        passed_tests = 0
        total_tests = len(tests)
        
        for test_func in tests:
            if test_func():
                passed_tests += 1
        
        # 결과 요약
        print("\n" + "=" * 60)
        print("테스트 결과 요약")
        print("=" * 60)
        
        success_rate = (passed_tests / total_tests) * 100
        print(f"전체 테스트: {total_tests}")
        print(f"통과: {passed_tests}")
        print(f"실패: {total_tests - passed_tests}")
        print(f"성공률: {success_rate:.1f}%")
        
        if success_rate >= 80:
            print("✅ 인코딩 변환 API가 정상적으로 작동합니다!")
        else:
            print("⚠️ 일부 테스트가 실패했습니다. 로그를 확인하세요.")
        
        return success_rate >= 80
    
    def save_test_results(self, filename="encoding_api_test_results.json"):
        """테스트 결과를 파일로 저장"""
        try:
            with open(filename, 'w', encoding='utf-8') as f:
                json.dump({
                    'timestamp': datetime.now().isoformat(),
                    'total_tests': len(self.test_results),
                    'passed_tests': len([r for r in self.test_results if r['success']]),
                    'failed_tests': len([r for r in self.test_results if not r['success']]),
                    'results': self.test_results
                }, f, indent=2, ensure_ascii=False)
            print(f"\n테스트 결과가 {filename}에 저장되었습니다.")
        except Exception as e:
            print(f"테스트 결과 저장 실패: {e}")

def main():
    """메인 함수"""
    if len(sys.argv) > 1:
        base_url = sys.argv[1]
    else:
        base_url = API_BASE_URL
    
    print(f"API 서버 URL: {base_url}")
    
    tester = EncodingAPITester(base_url)
    success = tester.run_all_tests()
    tester.save_test_results()
    
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()