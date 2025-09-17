# 🚀 OpenASP AX - 레거시 마이그레이션 플랫폼

## 개요
OpenASP AX는 레거시 ASP(Advanced System Products) 시스템을 현대적인 오픈소스 기술로 마이그레이션하는 **실제 업무용** 통합 플랫폼입니다.

## 🏗️ 프로젝트 구성

### 1. [SMED Map Viewer](./) (포트 3000)
- **목적**: 레거시 SMED 화면 맵 뷰어
- **주요 기능**: 24x80 터미널 시뮬레이션, 필드 관리, Java 프로그램 연동
- **기술**: React, TypeScript, CSS Grid

### 2. [OpenASP Refactor](./ofasp-refactor/) (포트 3005)
- **목적**: 코드 변환 및 리팩토링 도구
- **주요 기능**: COBOL/CL 변환, EBCDIC 변환, AI 지원
- **기술**: React, TypeScript, CodeMirror

### 3. [ASP Manager](./asp-manager/) (포트 3007)
- **목적**: AI 기반 시스템 관리 인터페이스
- **주요 기능**: RAG 문서 검색, 시스템 모니터링, 가상 터미널
- **기술**: React, TensorFlow.js, Express.js

### 4. [Python 변환 서비스](./ofasp-refactor/python-service/) (포트 3003)
- **목적**: EBCDIC/ASCII 변환 백엔드
- **주요 기능**: RESTful API, SOSI 처리, 배치 최적화
- **기술**: Python, Flask, Flask-CORS

## 🚀 빠른 시작

### 전체 환경 시작
```bash
./master-start.sh
```

### 전체 환경 종료
```bash
./master-stop.sh
```

### 개별 서비스 시작
```bash
# SMED Map Viewer
npm start

# Python 변환 서비스
cd ofasp-refactor/python-service
FLASK_PORT=3003 python -c "from src.api.app import api; api.run()"

# OpenASP Refactor
cd ofasp-refactor
PORT=3005 npm start

# ASP Manager
cd asp-manager
PORT=3007 npm start
```

## 📋 주요 문서

- [MASTER_CLAUDE.md](./MASTER_CLAUDE.md) - 전체 프로젝트 작업 히스토리
- [PROJECT_CONTEXT.json](./PROJECT_CONTEXT.json) - 구조화된 프로젝트 정보
- [CODING_RULES.md](./ofasp-refactor/CODING_RULES.md) - 개발 규칙 및 표준

## 🧪 테스트

### EBCDIC 변환 테스트
```bash
cd ofasp-refactor/python-service
python convert_file.py /tmp/sample.ebc -e JP -s --sosi-handling space -o /tmp/output.txt
```

### API 상태 확인
```bash
curl http://localhost:3000         # SMED Viewer
curl http://localhost:3003/health  # Python 서비스
curl http://localhost:3005         # Refactor 앱
curl http://localhost:3007         # Manager 앱
```

## 🔧 개발 환경

### 필수 요구사항
- Node.js 18+
- Python 3.10+
- npm 또는 yarn

### 환경 변수
```bash
FLASK_PORT=3003
REACT_APP_PYTHON_CONVERTER_URL=http://localhost:3003
CODEPAGE_BASE_PATH=/home/aspuser/app/ofasp-refactor/public/codepages
```

### 문자 인코딩 및 국제화 규칙

#### SJIS 인코딩 사용
- **일본어 환경 지원**: ja_JP.sjis 로케일 환경에서의 호환성을 위해 스크립트 파일은 SHIFT_JIS 인코딩으로 작성해야 합니다.
- **적용 대상**: Shell 스크립트 (.sh), 배치 파일, 설정 파일 등 시스템 레벨 파일
- **변환 방법**: UTF-8로 작성 후 SHIFT_JIS로 변환 (이모지 제거 필요)


## 📁 디렉토리 구조
```
/home/aspuser/app/
├── ofasp-refactor/          # 메인 리팩토링 플랫폼
│   ├── src/                 # React 소스 코드
│   ├── python-service/      # Python 백엔드
│   └── public/             # 정적 리소스
├── asp-manager/            # AI 관리 인터페이스
│   ├── src/                # React 소스 코드
│   └── server.js          # Express 프록시
├── server/                 # 백엔드 서비스
│   └── aspmgr/            # Curses 시스템 관리자
├── master-start.sh        # 전체 시작 스크립트
└── master-stop.sh         # 전체 종료 스크립트
```

### 국제화 지원
- **로케일 지원**: ja_JP.sjis, en_US.UTF-8
- **메시지 표시**: 환경에 따른 인코딩 자동 감지
- **폰트 지원**: 일본어 표시 가능한 터미널 폰트 사용

## 🤝 기여 방법

### 🔥 **작업 전 필수 체크리스트**
- [ ] README.md의 "하드코딩 절대 금지" 원칙 숙지
- [ ] 실제 파일 시스템과 연동하여 구현할 계획 수립
- [ ] 사용자 요구 파일 수와 구현 예정 파일 수 일치 확인
- [ ] 에러 발생 시 근본 해결 방안 준비

### 작업 프로세스
1. **필수 체크리스트 완료**
2. 이슈 생성
3. 기능 브랜치 생성
4. **실제 데이터 연동 구현** (하드코딩 절대 금지)
5. 변경사항 커밋 (인코딩 규칙 준수)
6. **파일 수 일치 검증**
7. 풀 리퀘스트 생성
8. 코드 리뷰 및 머지

## 📝 라이선스

이 프로젝트는 내부 사용을 위해 개발되었습니다.

## 🔖 빠른 참조

### 인코딩 변환 스크립트
```bash
# SJIS 변환용 Python 스크립트 실행
python3 /tmp/convert_to_sjis.py

# 수동 변환
iconv -f UTF-8 -t SHIFT_JIS input.sh > output.sh
```

### 주요 명령어
```bash
# 전체 환경 관리
./master-start.sh    # 모든 서비스 시작
./master-stop.sh     # 모든 서비스 정지

# 개별 서비스 확인
curl http://localhost:3000  # SMED Viewer
curl http://localhost:3003  # Python Service  
curl http://localhost:3005  # OFASP Refactor
curl http://localhost:3007  # ASP Manager
curl http://localhost:8000  # API Server

# 로그 확인
tail -f logs/python-service.log
tail -f logs/smed-viewer.log
tail -f logs/ofasp-refactor.log
tail -f logs/asp-manager.log
tail -f logs/api-server.log
```

### 문제 해결
- **문자 깨짐**: LANG=ja_JP.sjis 환경에서 SHIFT_JIS 인코딩 확인
- **포트 충돌**: `./master-stop.sh` 실행 후 `netstat -an | grep 300` 확인

## 📋 프로그램 등록 및 catalog.json 관리

### 🔧 **프로그램 등록 필수 조건**
```
⚠️ 중요: OpenASP에서 모든 프로그램은 실행 전에 catalog.json에 등록되어야 합니다.
등록되지 않은 프로그램은 CALL 명령어로 실행할 수 없습니다.
```

### 📝 catalog.json 프로그램 등록 형식

#### Java 프로그램 등록
```json
{
  "DISK01": {
    "TESTLIB": {
      "CUINP001": {
        "TYPE": "PGM",
        "PGMTYPE": "JAVA",
        "PGMNAME": "CUINP001",
        "CLASSFILE": "CUINP001.class",
        "DESCRIPTION": "Customer data input program for FB format SAM files",
        "VERSION": "1.0",
        "CREATED": "2025-07-24T17:04:00.000000Z",
        "UPDATED": "2025-07-24T17:04:00.000000Z"
      }
    }
  }
}
```

#### COBOL 프로그램 등록
```json
{
  "PAYROLL01": {
    "TYPE": "PGM",
    "PGMTYPE": "COBOL",
    "PGMNAME": "PAYROLL01",
    "SOURCEFILE": "PAYROLL01.cbl",
    "EXECUTABLE": "PAYROLL01",
    "DESCRIPTION": "Monthly payroll calculation",
    "VERSION": "2.1",
    "CREATED": "2025-07-21T10:00:00Z",
    "UPDATED": "2025-07-21T10:00:00Z"
  }
}
```

#### Shell 프로그램 등록
```json
{
  "test_shell": {
    "TYPE": "PGM",
    "PGMTYPE": "SHELL",
    "PGMNAME": "test_shell.sh",
    "SHELLFILE": "test_shell.sh",
    "DESCRIPTION": "Test shell program",
    "VERSION": "1.0",
    "CREATED": "2025-07-21T09:46:17.516107Z",
    "UPDATED": "2025-07-21T09:46:17.516107Z"
  }
}
```

### 🎯 **프로그램 등록 시 필수 필드**
- `TYPE`: 반드시 "PGM"
- `PGMTYPE`: "JAVA", "COBOL", "SHELL" 중 하나
- `PGMNAME`: 실제 프로그램명
- `DESCRIPTION`: 프로그램 설명
- `VERSION`: 버전 정보
- `CREATED`, `UPDATED`: ISO 형식 타임스탬프

### 🚀 **프로그램 등록 후 실행 방법**
```bash
# CL 명령어로 프로그램 실행
CALL PGM-CUINP001.TESTLIB,PARA='001,ABC',VOL-DISK01

# ASP 명령어로 직접 실행  
CALL PGM-CUINP001.TESTLIB,PARA-(001,ABC),VOL-DISK01
```

