# UTF-8 ↔ SJIS 인코딩 변환 API

OpenASP API Server에 통합된 UTF-8과 SJIS 간의 인코딩 변환을 처리하는 API입니다. 일본어 문자 지원, Position-based SMED API 연동, 실시간 WebSocket 통신을 지원합니다.

## 🎯 주요 기능

### ✨ 인코딩 변환
- **UTF-8 → SJIS**: 유니코드 문자열을 Shift-JIS로 변환
- **SJIS → UTF-8**: Shift-JIS 바이트를 UTF-8 문자열로 변환
- **배치 변환**: 여러 문자열을 한 번에 변환
- **자동 감지**: 입력 데이터의 인코딩 자동 감지

### 🌐 통합 지원
- **Position-based SMED**: SMED 맵 파일의 필드 데이터 변환
- **WebSocket 실시간**: WebSocket 메시지의 실시간 인코딩 변환
- **에러 처리**: strict, replace, ignore 모드 지원
- **일본어 지원**: 한자, 히라가나, 카타카나 완전 지원

## 📋 API 엔드포인트

### 1. UTF-8 → SJIS 변환
```
POST /api/encoding/utf8-to-sjis
```

**요청 예시:**
```json
{
  "text": "田中太郎",
  "error_handling": "replace"
}
```

**응답 예시:**
```json
{
  "success": true,
  "converted": "田中太郎",
  "hex_output": "93868BC293B690C59F",
  "byte_length": 8,
  "original_length": 4,
  "encoding_info": {
    "source": "utf-8",
    "target": "shift_jis",
    "error_handling": "replace"
  }
}
```

### 2. SJIS → UTF-8 변환
```
POST /api/encoding/sjis-to-utf8
```

**요청 예시:**
```json
{
  "data": "93868BC293B690C59F",
  "error_handling": "replace"
}
```

**응답 예시:**
```json
{
  "success": true,
  "converted": "田中太郎",
  "byte_length": 8,
  "char_length": 4,
  "encoding_info": {
    "source": "shift_jis",
    "target": "utf-8",
    "error_handling": "replace"
  }
}
```

### 3. 배치 변환
```
POST /api/encoding/batch-convert
```

**요청 예시:**
```json
{
  "texts": ["Hello", "こんにちは", "田中太郎"],
  "source_encoding": "utf-8",
  "target_encoding": "shift_jis",
  "error_handling": "replace"
}
```

**응답 예시:**
```json
{
  "success": true,
  "results": [
    {
      "success": true,
      "converted": "Hello",
      "index": 0
    },
    {
      "success": true,
      "converted": "こんにちは",
      "hex_output": "82B182F182C682C882CD",
      "index": 1
    }
  ],
  "total_count": 3,
  "success_count": 3,
  "error_count": 0
}
```

### 4. 인코딩 자동 감지
```
POST /api/encoding/detect
```

**요청 예시:**
```json
{
  "data": "Hello こんにちは 123"
}
```

**응답 예시:**
```json
{
  "success": true,
  "detection": {
    "encoding": "utf-8",
    "confidence": 0.99,
    "is_japanese": true
  }
}
```

### 5. SMED 통합 변환
```
POST /api/encoding/smed-convert
```

**요청 예시:**
```json
{
  "map_name": "EMPLOYEE_FORM",
  "field_data": ["田中太郎", "開発部", "課長"],
  "source_encoding": "utf-8",
  "target_encoding": "shift_jis",
  "terminal_id": "TERM001",
  "wsname": "WSNAME00"
}
```

**응답 예시:**
```json
{
  "success": true,
  "map_name": "EMPLOYEE_FORM",
  "field_data": ["田中太郎", "開発部", "課長"],
  "encoding_info": {
    "source": "utf-8",
    "target": "shift_jis"
  },
  "conversion_stats": {
    "total_fields": 3,
    "success_fields": 3,
    "error_fields": 0
  },
  "terminal_info": {
    "terminal_id": "TERM001",
    "wsname": "WSNAME00"
  }
}
```

### 6. WebSocket 실시간 변환
```
POST /api/encoding/websocket-convert
```

**요청 예시:**
```json
{
  "message": "こんにちは WebSocket",
  "source_encoding": "utf-8",
  "target_encoding": "shift_jis",
  "session_id": "session_001",
  "message_type": "smed_data"
}
```

**응답 예시:**
```json
{
  "success": true,
  "converted_message": "こんにちは WebSocket",
  "original_message": "こんにちは WebSocket",
  "session_id": "session_001",
  "message_type": "smed_data",
  "encoding_info": {
    "source": "utf-8",
    "target": "shift_jis"
  },
  "timestamp": "2025-07-31T10:30:45.123456"
}
```

### 7. 서비스 상태 확인
```
GET /api/encoding/status
```

**응답 예시:**
```json
{
  "success": true,
  "status": {
    "service_status": "active",
    "encodings_supported": ["utf-8", "shift_jis"],
    "chardet_available": true,
    "system_encoding": "utf-8",
    "features": {
      "japanese_support": true,
      "korean_support": true,
      "batch_processing": true,
      "auto_detection": true,
      "websocket_integration": true,
      "smed_integration": true
    }
  }
}
```

## 🔧 사용법 예시

### Python 클라이언트 예시

```python
import requests
import json

# API 서버 설정
API_BASE = "http://localhost:8000"
headers = {'Content-Type': 'application/json'}

# UTF-8 → SJIS 변환
def convert_to_sjis(text):
    response = requests.post(
        f"{API_BASE}/api/encoding/utf8-to-sjis",
        headers=headers,
        json={
            "text": text,
            "error_handling": "replace"
        }
    )
    return response.json()

# SJIS → UTF-8 변환
def convert_from_sjis(hex_data):
    response = requests.post(
        f"{API_BASE}/api/encoding/sjis-to-utf8",
        headers=headers,
        json={
            "data": hex_data,
            "error_handling": "replace"
        }
    )
    return response.json()

# 사용 예시
result1 = convert_to_sjis("田中太郎")
print(f"UTF-8 → SJIS: {result1['hex_output']}")

result2 = convert_from_sjis(result1['hex_output'])
print(f"SJIS → UTF-8: {result2['converted']}")
```

### JavaScript 클라이언트 예시

```javascript
const API_BASE = 'http://localhost:8000';

// UTF-8 → SJIS 변환
async function convertToSjis(text) {
    const response = await fetch(`${API_BASE}/api/encoding/utf8-to-sjis`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            text: text,
            error_handling: 'replace'
        })
    });
    return await response.json();
}

// SMED 통합 변환
async function convertSmedData(mapName, fieldData) {
    const response = await fetch(`${API_BASE}/api/encoding/smed-convert`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            map_name: mapName,
            field_data: fieldData,
            source_encoding: 'utf-8',
            target_encoding: 'shift_jis',
            terminal_id: 'TERM001',
            wsname: 'WSNAME00'
        })
    });
    return await response.json();
}

// 사용 예시
convertToSjis('田中太郎').then(result => {
    console.log('Converted to SJIS:', result.hex_output);
});

convertSmedData('EMPLOYEE_FORM', ['田中太郎', '開発部']).then(result => {
    console.log('SMED conversion:', result.field_data);
});
```

## 🧪 테스트 실행

테스트 스크립트를 사용하여 API 기능을 검증할 수 있습니다:

```bash
# 기본 테스트 실행
python server/test_encoding_api.py

# 특정 서버 URL로 테스트
python server/test_encoding_api.py http://localhost:8000
```

테스트 결과는 `encoding_api_test_results.json` 파일에 저장됩니다.

## ⚙️ 설정 및 요구사항

### Python 의존성
```bash
pip install chardet  # 자동 인코딩 감지용 (선택사항)
```

### 서버 설정
API 서버는 기본적으로 다음 설정으로 실행됩니다:
- **포트**: 8000
- **CORS**: localhost:3000, 3005, 3006, 3007 허용
- **인코딩**: UTF-8 기본, SJIS 지원
- **로깅**: 모든 변환 작업 로그 기록

### 지원 문자셋
- **일본어**: 한자, 히라가나, 카타카나
- **한국어**: UTF-8을 통한 완전 지원
- **영어/숫자**: ASCII 완전 지원
- **특수문자**: 대부분의 기본 특수문자 지원

## 🔗 통합 가이드

### Position-based SMED API와 연동

```python
# SMED 맵 데이터와 함께 인코딩 변환
def render_smed_with_encoding(map_name, field_data):
    # 1. 인코딩 변환
    encoding_result = requests.post(
        f"{API_BASE}/api/encoding/smed-convert",
        json={
            "map_name": map_name,
            "field_data": field_data,
            "source_encoding": "utf-8",
            "target_encoding": "shift_jis"
        }
    ).json()
    
    # 2. Position-based 렌더링
    render_result = requests.post(
        f"{API_BASE}/api/smed/position-render",
        json={
            "map_name": map_name,
            "field_data": encoding_result["field_data"]
        }
    ).json()
    
    return render_result
```

### WebSocket 서비스와 연동

```javascript
// WebSocket을 통한 실시간 인코딩 변환
class SmedWebSocketClient {
    constructor(wsUrl, apiUrl) {
        this.ws = new WebSocket(wsUrl);
        this.apiUrl = apiUrl;
    }
    
    async sendEncodedMessage(message) {
        // 메시지 인코딩 변환
        const encodingResult = await fetch(`${this.apiUrl}/api/encoding/websocket-convert`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                message: message,
                source_encoding: 'utf-8',
                target_encoding: 'shift_jis',
                session_id: this.sessionId
            })
        }).then(r => r.json());
        
        // WebSocket으로 전송
        if (encodingResult.success) {
            this.ws.send(JSON.stringify({
                type: 'smed_data',
                data: encodingResult.converted_message
            }));
        }
    }
}
```

## 🐛 트러블슈팅

### 일반적인 문제

1. **서버 연결 실패**
   ```bash
   # 서버 상태 확인
   curl http://localhost:8000/api/health
   ```

2. **인코딩 변환 실패**
   - `chardet` 라이브러리 설치 확인
   - 입력 데이터 형식 확인 (UTF-8 문자열 vs 헥스 문자열)
   - `error_handling` 모드를 'replace'로 설정

3. **일본어 문자 깨짐**
   - 시스템 로케일 설정 확인
   - Python의 SJIS 인코딩 지원 확인
   - 폰트 설정 확인 (클라이언트 측)

4. **성능 문제**
   - 배치 변환 사용 (단일 요청 대신)
   - 요청 크기 제한 확인 (최대 1MB)
   - 타임아웃 설정 조정

### 로그 확인

```bash
# API 서버 로그 확인
tail -f server/api_server.log

# 인코딩 관련 로그만 필터링
grep "ENCODING" server/api_server.log
```

## 📈 성능 최적화

### 권장사항
- **배치 처리**: 여러 문자열은 `/batch-convert` 사용
- **캐싱**: 자주 사용되는 변환 결과 캐싱
- **연결 풀링**: HTTP 클라이언트에서 연결 재사용
- **비동기 처리**: 대량 데이터 처리 시 비동기 요청 사용

### 제한사항
- **최대 배치 크기**: 1000개 문자열
- **최대 메시지 크기**: 1MB
- **요청 타임아웃**: 30초
- **동시 연결**: 제한 없음 (서버 리소스에 따라)

## 📄 라이선스

이 API는 OpenASP 프로젝트의 일부로, 프로젝트의 기존 라이선스를 따릅니다.

---

**개발자 참고사항:**
- API 서버는 `/home/aspuser/app/ofasp-refactor/server/api_server.py`에 구현되어 있습니다
- 테스트는 `/home/aspuser/app/ofasp-refactor/server/test_encoding_api.py`를 실행하세요
- 모든 변환 작업은 로그에 기록되며 `/api/logs` 엔드포인트에서 확인 가능합니다