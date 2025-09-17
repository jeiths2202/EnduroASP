# ASP System Command Development Guide

## 신규 명령어 추가 방법

이 문서는 ASP System Command Terminal에 새로운 명령어를 추가하는 단계별 가이드입니다.

## 목차

1. [개요](#개요)
2. [파일 구조](#파일-구조)
3. [신규 명령어 추가 단계](#신규-명령어-추가-단계)
4. [실제 예제: HELP 명령어](#실제-예제-help-명령어)
5. [테스트 방법](#테스트-방법)
6. [문제 해결](#문제-해결)

## 개요

ASP System Command는 다음 구조로 이루어져 있습니다:
- **Backend**: Python 기반 명령어 처리 (`asp_commands.py`)
- **CLI Interface**: 터미널 명령어 인터페이스 (`aspcli.py`)
- **Web API**: REST API를 통한 웹 인터페이스 (`api_server.py`)
- **Frontend**: React 기반 웹 터미널 (`AspCliWebTerminal.tsx`)

## 파일 구조

```
server/
├── system-cmds/
│   ├── asp_commands.py      # 명령어 구현체
│   ├── aspcli.py           # CLI 인터페이스
│   └── java_encoding_client.py
├── api_server.py           # Web API 서버
└── config/

ofasp-refactor/src/components/
└── AspCliWebTerminal.tsx   # 웹 터미널 UI
```

## 신규 명령어 추가 단계

### 1단계: 명령어 함수 구현 (`asp_commands.py`)

새로운 명령어 함수를 `asp_commands.py` 파일 끝에 추가합니다.

```python
def NEWCOMMAND(command):
    """새로운 명령어 설명"""
    try:
        # 명령어 파라미터 파싱
        # 예: NEWCOMMAND PARAM1-value1,PARAM2-value2
        params = dict(item.split('-') for item in command.replace('NEWCOMMAND ', '').split(',') if '-' in item)
        
        param1 = params.get('PARAM1')
        param2 = params.get('PARAM2')
        
        # 필수 파라미터 검증
        if not param1:
            print("[ERROR] PARAM1 parameter is required.")
            return
            
        # 명령어 로직 구현
        print(f"[INFO] Executing NEWCOMMAND with PARAM1={param1}, PARAM2={param2}")
        
        # 실제 작업 수행
        # ... 구현 내용 ...
        
        print(f"[INFO] NEWCOMMAND completed successfully")
        
    except Exception as e:
        print(f"[ERROR] NEWCOMMAND failed: {e}")
```

### 2단계: CLI 인터페이스 등록 (`aspcli.py`)

#### 2-1. Import 추가
```python
from asp_commands import (
    CRTLIB, DLTLIB, WRKLIB, CRTFILE, DLTFILE, DSPFD,
    WRKOBJ, CALL, WRKVOL, WRKSPLF, WRKMSG,
    DSPJOB, SAVLIB, RSTLIB, SNDMSG, RCVMSG, EDTFILE, HELP,
    NEWCOMMAND  # 새 명령어 추가
)
```

#### 2-2. Command Map 등록
```python
command_map = {
    "HELP": HELP,
    "NEWCOMMAND": NEWCOMMAND,  # 새 명령어 추가
    "CRTLIB": CRTLIB,
    # ... 기존 명령어들
}
```

### 3단계: 웹 터미널 자동완성 추가 (`AspCliWebTerminal.tsx`)

React 컴포넌트의 `commandSuggestions` 배열에 새 명령어를 추가합니다.

```typescript
const [commandSuggestions] = useState([
  'HELP', 'NEWCOMMAND', 'CRTLIB', 'DLTLIB', 'WRKLIB', 'CRTFILE', 'DLTFILE', 
  'DSPFD', 'WRKOBJ', 'WRKVOL', 'WRKSPLF', 'WRKMSG',
  'DSPJOB', 'SAVLIB', 'RSTLIB', 'SNDMSG', 'RCVMSG', 'EDTFILE', 'CTTFILE'
]);
```

### 4단계: HELP 문서 업데이트

`asp_commands.py`의 `HELP` 함수 내용에 새 명령어 설명을 추가합니다.

```python
def HELP(command=None):
    """Display help information for ASP system commands"""
    help_text = """
================================================================================
                           ASP SYSTEM COMMAND HELP
================================================================================

Available Commands:

NEW CATEGORY:
  NEWCOMMAND PARAM1-<value1>[,PARAM2-<value2>]
    - 새로운 명령어의 기능 설명
    - Example: NEWCOMMAND PARAM1-TEST,PARAM2-VALUE

# ... 기존 내용들
"""
    print(help_text)
```

## 실제 예제: HELP 명령어

HELP 명령어 추가 과정을 예제로 살펴보겠습니다.

### 1. 함수 구현 (`asp_commands.py`)

```python
def HELP(command=None):
    """Display help information for ASP system commands"""
    help_text = """
================================================================================
                           ASP SYSTEM COMMAND HELP
================================================================================

Available Commands:

LIBRARY MANAGEMENT:
  CRTLIB LIB-<library>,VOL-<volume>
    - Create a new library in specified volume
    - Example: CRTLIB LIB-TESTLIB,VOL-DISK01
# ... 전체 도움말 내용
"""
    print(help_text)
```

### 2. CLI 등록 (`aspcli.py`)

```python
# Import 추가
from asp_commands import (
    CRTLIB, DLTLIB, WRKLIB, CRTFILE, DLTFILE, DSPFD,
    WRKOBJ, CALL, WRKVOL, WRKSPLF, WRKMSG,
    DSPJOB, SAVLIB, RSTLIB, SNDMSG, RCVMSG, EDTFILE, HELP
)

# Command Map 등록
command_map = {
    "HELP": HELP,
    "CRTLIB": CRTLIB,
    # ... 기존 명령어들
}
```

### 3. 웹 자동완성 (`AspCliWebTerminal.tsx`)

```typescript
const [commandSuggestions] = useState([
  'HELP', 'CRTLIB', 'DLTLIB', 'WRKLIB', 'CRTFILE', 'DLTFILE', 
  // ... 기존 명령어들
]);
```

## 테스트 방법

### 1. CLI 테스트
```bash
cd /home/aspuser/app/server/system-cmds
python3 aspcli.py NEWCOMMAND PARAM1-test,PARAM2-value
```

### 2. Web API 테스트
```bash
curl -X POST http://localhost:8000/api/asp-command \
  -H "Content-Type: application/json" \
  -d '{"command": "NEWCOMMAND PARAM1-test,PARAM2-value", "user": "admin"}'
```

### 3. 웹 터미널 테스트
1. 웹 브라우저에서 ASP System Command Terminal 접속
2. 명령어 입력창에서 자동완성 확인
3. 명령어 실행 테스트

## 명령어 설계 가이드라인

### 1. 파라미터 형식
- **표준 형식**: `KEYWORD-VALUE` (예: `VOL-DISK01`, `LIB-TESTLIB`)
- **파일 경로**: `FILE(library/filename)` (예: `FILE(TESTLIB/EMPLOYEE)`)
- **문자열 값**: `KEYWORD-'quoted value'` (예: `MSG-'Hello World'`)

### 2. 에러 처리
```python
try:
    # 명령어 로직
    pass
except Exception as e:
    print(f"[ERROR] COMMAND_NAME failed: {e}")
```

### 3. 출력 형식
- **정보**: `[INFO] Operation completed successfully`
- **경고**: `[WARNING] Non-critical issue detected`
- **에러**: `[ERROR] Operation failed: reason`

### 4. 파라미터 검증
```python
# 필수 파라미터 체크
if not required_param:
    print("[ERROR] PARAM parameter is required.")
    return

# 파일/디렉토리 존재 확인
if not os.path.exists(path):
    print(f"[ERROR] Path not found: {path}")
    return
```

## 고급 기능

### 1. 대화형 명령어
```python
def INTERACTIVE_COMMAND(command):
    """Interactive command example"""
    try:
        # 사용자 입력 받기
        response = input("Enter your choice (Y/N): ")
        if response.upper() == 'Y':
            # 작업 수행
            pass
    except KeyboardInterrupt:
        print("\n[INFO] Operation cancelled by user")
```

### 2. 긴 출력 처리
```python
def COMMAND_WITH_PAGING(command):
    """Command with paginated output"""
    data = get_large_dataset()
    page_size = 20
    
    for i in range(0, len(data), page_size):
        page = data[i:i+page_size]
        for item in page:
            print(item)
        
        if i + page_size < len(data):
            input("Press Enter to continue...")
```

### 3. 파일 작업
```python
def FILE_OPERATION_COMMAND(command):
    """File operation example"""
    try:
        # 파일 읽기
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 파일 쓰기
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(processed_content)
            
    except IOError as e:
        print(f"[ERROR] File operation failed: {e}")
```

## 문제 해결

### 일반적인 문제들

1. **Import 에러**
   - `asp_commands.py`에서 함수가 정의되었는지 확인
   - `aspcli.py`에서 import 구문이 올바른지 확인

2. **파라미터 파싱 에러**
   - 명령어 형식이 `KEYWORD-VALUE` 패턴을 따르는지 확인
   - 콤마로 구분된 파라미터 형식 확인

3. **웹 API 동작 안함**
   - `api_server.py`가 실행 중인지 확인
   - 포트 8000이 열려있는지 확인

4. **인코딩 문제**
   - UTF-8 환경변수 설정 확인
   - 파일 읽기/쓰기 시 encoding 파라미터 지정

### 디버깅 방법

1. **로그 추가**
```python
import logging
logger = logging.getLogger(__name__)

def DEBUG_COMMAND(command):
    logger.info(f"Executing command: {command}")
    # ... 구현
```

2. **단계별 테스트**
   - CLI에서 먼저 테스트
   - 정상 동작 확인 후 웹 API 테스트
   - 마지막으로 웹 터미널에서 테스트

## 베스트 프랙티스

1. **함수명은 대문자로 작성** (예: `HELP`, `CRTLIB`)
2. **에러 메시지는 명확하고 구체적으로 작성**
3. **파라미터 검증을 철저히 수행**
4. **기존 명령어 패턴을 따라 일관성 유지**
5. **HELP 문서는 항상 최신 상태로 유지**
6. **테스트는 CLI, API, 웹 터미널 순서로 진행**

## 참고 자료

- **기존 명령어 구현**: `asp_commands.py` 파일 참조
- **API 서버 코드**: `api_server.py` 파일 참조
- **웹 터미널 코드**: `AspCliWebTerminal.tsx` 파일 참조
- **ASP System 매뉴얼**: 각 명령어의 HELP 출력 내용 참조

---

**마지막 업데이트**: 2025-07-21  
**작성자**: ASP Development Team