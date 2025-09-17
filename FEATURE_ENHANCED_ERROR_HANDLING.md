# 🛡️ 향상된 에러 처리 기능

## 개요
OpenASP API 서버에 구조화된 에러 처리 및 모니터링 시스템을 추가했습니다.

## 주요 기능

### 1. 구조화된 에러 분류
- **에러 카테고리**: 검증, 인증, 권한, 비즈니스 로직, 외부 서비스, 시스템, 네트워크, 데이터베이스
- **심각도 수준**: LOW, MEDIUM, HIGH, CRITICAL
- **고유 에러 ID**: 추적 가능한 에러 식별자 생성

### 2. 사용자 친화적 에러 메시지
- 기술적 에러를 사용자가 이해하기 쉬운 한국어 메시지로 변환
- 컨텍스트 정보와 함께 상세한 에러 로깅

### 3. 향상된 헬스 체크
- 시스템 구성 요소별 상태 모니터링
- 타임스탬프 및 버전 정보 포함
- Java 실행 환경, DBIO, PostgreSQL 등 각 모듈의 가용성 체크

## 구현 내용

### 새로운 파일
- `server/error_handler.py`: 향상된 에러 처리 시스템
- `FEATURE_ENHANCED_ERROR_HANDLING.md`: 기능 문서

### 수정된 파일
- `server/api_server.py`: 
  - 향상된 에러 핸들러 통합
  - `/api/health` 엔드포인트 개선

## 사용 예시

```python
from error_handler import handle_api_error, ErrorCategory, ErrorSeverity

# API 에러 처리
try:
    # 위험한 작업 수행
    result = risky_operation()
except Exception as e:
    return handle_api_error(
        e, 
        ErrorCategory.BUSINESS_LOGIC, 
        ErrorSeverity.HIGH,
        "작업을 완료할 수 없습니다",
        {"user_id": user_id, "operation": "file_upload"}
    )
```

## 에러 응답 형식

```json
{
  "success": false,
  "error": {
    "id": "ERR_20250917_162634_1234",
    "message": "요청한 파일을 찾을 수 없습니다",
    "category": "validation",
    "severity": "medium",
    "timestamp": "2025-09-17T16:26:34.123456"
  }
}
```

## 향상된 헬스 체크 응답

```json
{
  "status": "OK",
  "version": "v0.5.1",
  "timestamp": "2025-09-17T16:26:34.123456",
  "smed_dir": "/home/aspuser/app/volume/DISK01/SMED",
  "accounts_loaded": 5,
  "smed_pgm_maps": 12,
  "map_pgm_maps": 8,
  "java_available": true,
  "jar_exists": true,
  "system_info": {
    "dbio_available": true,
    "postgresql_session_available": true,
    "smart_encoding_available": true,
    "error_handler_available": true
  }
}
```

## 이점
1. **향상된 디버깅**: 고유 에러 ID로 문제 추적 개선
2. **사용자 경험**: 기술적 에러를 이해하기 쉬운 메시지로 변환
3. **시스템 모니터링**: 각 구성 요소의 상태를 실시간으로 확인
4. **로그 품질**: 구조화된 로깅으로 문제 분석 용이