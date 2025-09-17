# 🚀 OpenASP AX - 레거시 마이그레이션 플랫폼

## ⚠️ **모든 AI CODING AGENT 필수 준수사항**

### 🔥 **절대 금지 원칙 - NEVER HARDCODE**
```
❌ 절대 금지: "데모용", "임시로", "일단", "테스트용" 등의 핑계로 하드코딩
❌ 절대 금지: 실제 파일 시스템 대신 목업(mock) 데이터 사용
❌ 절대 금지: 에러 발생 시 우회 처리 (반드시 근본 원인 해결)
❌ 절대 금지: 사용자 요구 파일 수와 다른 임의의 파일 수 처리

✅ 필수 원칙: 모든 데이터는 실제 시스템에서 동적으로 로드
✅ 필수 원칙: 사용자가 요구한 정확한 파일 수 처리 (1개도 빠짐없이)
✅ 필수 원칙: 실제 파일 시스템과 화면 표시 완전 일치
✅ 필수 원칙: 에러는 반드시 해결, 절대 우회 금지
```

### 📊 **실제 사례: 하드코딩으로 인한 심각한 문제**
- **문제 상황**: AI Transform 페이지에서 실제 1,022개 파일 중 14개만 하드코딩으로 표시
- **파급 효과**: 98.6% 기능 누락, 실제 업무 사용 불가능
- **근본 원인**: "데모용이니까 하드코딩해도 된다"는 잘못된 사고방식
- **교훈**: 이 프로젝트는 실제 레거시 마이그레이션용 업무 도구임

### 🛡️ **재발방지 검증 체계**
1. **파일 수 검증**: `find` 명령어 결과와 화면 표시 반드시 일치
2. **내용 검증**: 실제 파일 내용과 화면 표시 내용 완전 일치
3. **성능 검증**: 1,000+ 파일도 정상 처리 확인
4. **에러 해결**: 500 에러 등 모든 에러는 근본 해결

### 🔧 **올바른 구현 방법**
- **백엔드 API**: Python Flask에 실제 파일 스캐닝 엔드포인트 구현
- **대용량 처리**: 스트리밍, 페이지네이션으로 1,000+ 파일 처리
- **실시간 연동**: 실제 파일 시스템 변경사항 즉시 반영
- **완전한 기능**: 사용자 요구사항 100% 구현

---

## 개요
OpenASP AX는 레거시 ASP(Advanced System Products) 시스템을 현대적인 오픈소스 기술로 마이그레이션하는 **실제 업무용** 통합 플랫폼입니다.

## 🏗️ 프로젝트 구성

### 1. [SMED Map Viewer](./) (포트 3000)
- **목적**: 레거시 SMED 화면 맵 뷰어
- **주요 기능**: 24x80 터미널 시뮬레이션, 필드 관리, Java 프로그램 연동
- **기술**: React, TypeScript, CSS Grid
- **실행**: `npm start`

### 2. [Python 변환 서비스](./ofasp-refactor/python-service/) (포트 3003)
- **목적**: EBCDIC/ASCII 변환 백엔드
- **주요 기능**: RESTful API, SOSI 처리, 배치 최적화
- **기술**: Python, Flask, Flask-CORS
- **실행**: `FLASK_PORT=3003 python -c "from src.api.app import api; api.run()"`

### 3. [System API Server](./ofasp-refactor/server/) (포트 3004)
- **목적**: OpenASP 시스템 관리 API
- **주요 기능**: 시스템 명령어 처리, 웹 인터페이스 연동
- **기술**: Python, Flask
- **실행**: `ASPMGR_WEB_PORT=3004 python aspmgr_web.py`

### 4. [OpenASP Refactor](./ofasp-refactor/) (포트 3005)
- **목적**: 코드 변환 및 리팩토링 도구, 멀티모달 AI 채팅
- **주요 기능**: 
  - COBOL/CL 변환, EBCDIC 변환, AI 지원
  - 멀티모달 AI 채팅 (텍스트, 이미지, 파일 업로드)
  - RAG 문서 검색 (/ofasp-refactor/public/RAG)
  - AI 모델 선택 (Gemma 2B, GPT-OSS 20B)
- **기술**: React, TypeScript, CodeMirror
- **실행**: `PORT=3005 npm start`

### 5. [Chat API Server](./ofasp-refactor/server/) (포트 3006)
- **목적**: AI 채팅 백엔드 API
- **주요 기능**: Ollama 연동, 멀티모달 지원, RAG 문서 검색
- **기술**: Python, Flask, Ollama API
- **실행**: `python chat_api.py`

### 6. [ASP Manager](./asp-manager/) (포트 3007)
- **목적**: AI 기반 시스템 관리 인터페이스
- **주요 기능**: RAG 문서 검색, 시스템 모니터링, 가상 터미널
- **기술**: React, TensorFlow.js, Express.js
- **실행**: `PORT=3007 npm start`

### 7. [API Server](./server/) (포트 8000)
- **목적**: 통합 백엔드 API 서버
- **주요 기능**: 데이터베이스 연동, 파일 관리, 시스템 통합
- **기술**: Python, Flask
- **실행**: `python api_server.py`

### 8. [Ollama Server](./ofasp-refactor/) (포트 3014)
- **목적**: 로컬 AI 모델 서버
- **주요 기능**: Gemma 2B, GPT-OSS 20B 모델 서비스
- **기술**: Ollama, AI 모델 호스팅
- **실행**: Chat 서비스를 통해 자동 시작

### 9. [OpenASP DevOps](./ofasp-devops/) (포트 3016)
- **목적**: Enterprise급 CI/CD & 자동화 통합 모니터링 플랫폼
- **주요 기능**: 
  - COBOL/CL 변환 엔진 (Java, Python, C, Shell)
  - 9개 전문화된 GitHub Actions CI/CD 워크플로우
  - 실시간 시스템 모니터링 (CPU, 메모리, 디스크, 네트워크)
  - **✨ NEW: 인터랙티브 Pipeline Flow 시각화**
    - 실시간 CI/CD 파이프라인 진행 상황 시각화
    - 색상별 실패 경로 구분 (Build/Test/Security/Deploy 실패)
    - 직선 점선으로 각 단계별 복귀 경로 명확 표시
    - 실시간 상태 업데이트 (5초 간격)
  - **✨ NEW: ABEND Auto-Fix Integration Test**
    - 7단계 ABEND 자동 수정 프로세스 시각화
    - 5-10초 간격 실시간 진행 상황 모니터링
    - F3 키 수정 → Zabbix 감지 → DevOps 자동 수정 → 검증 전체 과정
    - test_complete_scenario.sh와 웹 UI 연동
  - **ABEND 자동 감지 및 수정 시스템**
  - 알림 시스템 (Critical/High/Medium/Low)
  - 투자자 시연용 대시보드
- **기술**: Next.js 14, TypeScript, Docker, GitHub Actions, SVG 시각화
- **실행**: 
  ```bash
  cd ofasp-devops
  npm run dev  # 개발 모드
  # 또는
  docker compose up -d  # Docker 전체 스택
  ```
- **모니터링 스택**:
  - Prometheus (포트 3011): 메트릭 수집
  - Grafana (포트 3010): 시각화 대시보드 (admin/admin123)

## 🔍 모니터링 시스템 (Zabbix)

### 10. [Zabbix 모니터링 시스템] (포트 3015)
- **웹 인터페이스**: http://localhost:3015
- **로그인**: Admin / zabbix
- **목적**: OpenASP AX 전체 시스템 모니터링 및 알림

#### 📊 모니터링 대상
- **API Server** (포트 8000): HTTP 응답, 프로세스 상태
- **SMED Viewer** (포트 3000): HTTP 응답, React 앱 상태
- **Python Service** (포트 3003): Flask 서비스 상태
- **Refactor Service** (포트 3005): 코드 변환 서비스 상태
- **Manager Service** (포트 3007): AI 관리 인터페이스 상태
- **OpenASP DevOps** (포트 3016): CI/CD & 통합 모니터링 상태
- **로그 모니터링**: 
  - `/home/aspuser/app/logs/` (메인 로그)
  - `/home/aspuser/app/ofasp-refactor/logs/` (리팩터 로그)
  - **ABEND 로그**: `/home/aspuser/app/logs/abend.log` (ABEND 감지 이력)
- **dslock_suite**: 파일 락 관리 시스템 상태
- **ABEND 자동 감지**: CEE3204S 에러 코드 실시간 모니터링

#### 🔧 Zabbix 구성 요소

##### PostgreSQL 데이터베이스
```bash
# 데이터베이스 정보
호스트: localhost
포트: 5432
데이터베이스: zabbix
사용자: zabbix
패스워드: zabbix_password

# 접속 방법
su - postgres
psql zabbix

# 주요 테이블
- users: Zabbix 사용자 정보
- items: 모니터링 아이템 정의
- triggers: 알림 트리거 설정
- history: 모니터링 데이터 히스토리
```

##### Zabbix 서버
```bash
# 서비스 관리
service zabbix-server start|stop|restart|status

# 설정 파일
/etc/zabbix/zabbix_server.conf

# 로그 파일
/var/log/zabbix/zabbix_server.log

# 주요 설정
- 서버 포트: 10051
- 데이터베이스 연결: PostgreSQL localhost:5432/zabbix
```

##### Zabbix Agent
```bash
# 서비스 관리
service zabbix-agent start|stop|restart|status

# 설정 파일
/etc/zabbix/zabbix_agentd.conf
/etc/zabbix/zabbix_agentd.d/openasp.conf  # OpenASP 커스텀 파라미터

# 로그 파일
/var/log/zabbix/zabbix_agentd.log

# 주요 설정
- 에이전트 포트: 10050
- 서버 연결: localhost:10051
```

##### Nginx 웹 서버
```bash
# 서비스 관리
service nginx start|stop|restart|status

# 설정 파일
/etc/zabbix/nginx.conf           # Zabbix 전용 설정
/etc/nginx/sites-enabled/zabbix  # Nginx 사이트 설정

# 로그 파일
/var/log/nginx/access.log
/var/log/nginx/error.log

# 주요 설정
- 웹 포트: 3015
- 문서 루트: /usr/share/zabbix
- PHP-FPM 연결: unix:/var/run/php/zabbix.sock
```

##### PHP-FPM
```bash
# 서비스 관리
service php8.2-fpm start|stop|restart|status

# 설정 파일
/etc/php/8.2/fpm/pool.d/zabbix.conf

# 로그 파일
/var/log/php8.2-fpm.log

# 확장 모듈
- pgsql: PostgreSQL 연결
- pdo_pgsql: PDO PostgreSQL 드라이버
```

#### 🎯 커스텀 모니터링 스크립트
```bash
# 스크립트 위치
/home/aspuser/app/monitoring/scripts/

# 서비스 상태 확인
check_services.py  - 모든 OpenASP 서비스 HTTP 상태 체크

# 로그 모니터링
log_monitor.py     - 오류/경고 로그 감지 및 분석

# dslock 상태 확인
check_dslock.py    - dslock_suite 상태 및 활성 락 모니터링

# ABEND 자동 감지 및 수정
check_abend.py     - ABEND CEE3204S 감지 및 자동 수정 트리거

# 설정 파일
/home/aspuser/app/monitoring/config/zabbix.conf
/etc/zabbix/zabbix_agentd.d/openasp.conf  # ABEND 모니터링 파라미터
```

#### 🚨 알림 설정
- **서비스 다운**: HTTP 응답 실패 시 즉시 알림
- **로그 오류**: 로그 파일에서 오류/경고 감지 시 알림
- **시스템 리소스**: CPU, 메모리, 디스크 임계값 초과 시 알림
- **dslock 문제**: 파일 락 시스템 오류 시 알림
- **ABEND 감지**: CEE3204S ABEND 발생 시 즉시 알림 및 자동 수정 트리거

#### 🔄 모니터링 주기
- **서비스 상태**: 60초마다 체크
- **로그 모니터링**: 300초마다 체크
- **dslock 상태**: 120초마다 체크
- **ABEND 감지**: 60초마다 체크 (실시간 대응)
- **시스템 리소스**: 60초마다 체크

## 🔄 ABEND 자동 감지 및 수정 시스템

### 🎯 통합 테스트 시나리오
OpenASP AX 시스템은 **ABEND 발생 → Zabbix 감지 → DevOps CI/CD 자동 수정 → 정상화** 의 완전 자동화된 장애 대응 시스템을 구현합니다.

### 📋 ABEND 자동 대응 프로세스

#### 1️⃣ **ABEND 발생 단계**
- **트리거**: F3 키 입력 시 MAIN001.java에서 CEE3204S ABEND 발생
- **위치**: `/home/aspuser/app/volume/DISK01/JAVA/MAIN001.java:handleF3Key()`
- **로그**: ABEND 정보가 `/home/aspuser/app/logs/abend.log`에 기록

#### 2️⃣ **Zabbix 실시간 감지**
- **감지 스크립트**: `check_abend.py` (60초 주기)
- **Zabbix 파라미터**: `openasp.abend.check`, `openasp.abend.count`
- **알림**: Zabbix UI의 "OpenASP AX" 호스트에서 ABEND 알림 표시

#### 3️⃣ **CI/CD 자동 수정 파이프라인**
- **워크플로우**: ABEND Auto-Fix Pipeline (4단계)
  1. 🔍 **Detect and Analyze ABEND**: 코드 체크아웃, 로그 분석, 백업 생성
  2. 🔧 **Auto-Fix ABEND**: F3 키 핸들러 수정, 코드 컴파일, 테스트
  3. 🚀 **Deploy Fixed Code**: 운영 배포, 서비스 재시작, 배포 검증
  4. 📢 **Notify Fix Completion**: 수정 결과 로깅, 모니터링 업데이트

#### 4️⃣ **실시간 시각화 모니터링**
- **URL**: http://localhost:3016/ (CI/CD Workflow Visualizer)
- **기능**: 
  - 실시간 워크플로우 상태 표시
  - Job 의존성 그래프 시각화
  - 히스토리 ABEND 카운트 추적
  - 자동 새로고침 (10초 주기)

### 🔧 **구성 파일**
```bash
# ABEND 모니터링 설정
/etc/zabbix/zabbix_agentd.d/openasp.conf

# 감지 스크립트
/home/aspuser/app/monitoring/scripts/check_abend.py

# 자동 수정 대상 파일
/home/aspuser/app/volume/DISK01/JAVA/MAIN001.java

# ABEND 로그
/home/aspuser/app/logs/abend.log

# CI/CD Workflow API
/home/aspuser/app/ofasp-devops/src/pages/api/workflow-data.ts
/home/aspuser/app/ofasp-devops/src/pages/api/abend-status.ts
```

### 🧪 **테스트 시나리오 실행**
1. **MAIN001.java 실행**: F3 키 입력으로 ABEND 발생
2. **Zabbix 모니터링**: http://localhost:3015 에서 알림 확인
3. **CI/CD 시각화**: http://localhost:3016 에서 파이프라인 진행 상황 확인
4. **자동 수정 확인**: F3 키가 정상 동작하는지 검증

### 📊 **모니터링 지표**
- **총 ABEND 발생 수**: 과거부터 누적된 전체 ABEND 건수
- **현재 ABEND 수**: 현재 활성 상태의 ABEND 건수  
- **워크플로우 상태**: pending → in_progress → completed
- **자동 수정 성공률**: 수정 완료된 ABEND 비율

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

# System API Server
cd ofasp-refactor/server
ASPMGR_WEB_PORT=3004 python aspmgr_web.py

# OpenASP Refactor
cd ofasp-refactor
PORT=3005 npm start

# Chat Service (Ollama + Chat API)
cd ofasp-refactor
./scripts/chat-start.sh

# ASP Manager
cd asp-manager
PORT=3007 npm start

# API Server
cd server
python api_server.py
```

### Chat Service 관리
```bash
# Chat Service 개별 시작
cd ofasp-refactor
./scripts/chat-start.sh

# Chat Service 개별 종료
./scripts/chat-stop.sh

# Chat Service 상태 확인
curl http://localhost:3014/api/tags  # Ollama 모델 목록
curl http://localhost:3006/api/health # Chat API 상태
```

## 📋 주요 문서

- [MASTER_CLAUDE.md](./MASTER_CLAUDE.md) - 전체 프로젝트 작업 히스토리
- [PROJECT_CONTEXT.json](./PROJECT_CONTEXT.json) - 구조화된 프로젝트 정보
- [CODING_RULES.md](./ofasp-refactor/CODING_RULES.md) - 개발 규칙 및 표준
- [CHAT_SERVICE_SCRIPTS.md](./ofasp-refactor/docs/CHAT_SERVICE_SCRIPTS.md) - Chat Service 관리 스크립트 설명서

## 🧪 테스트

### EBCDIC 변환 테스트
```bash
cd ofasp-refactor/python-service
python convert_file.py /tmp/sample.ebc -e JP -s --sosi-handling space -o /tmp/output.txt
```

### 🔄 NEW: DevOps Pipeline API 엔드포인트

#### Pipeline Flow API (포트 3016)
```bash
# 실시간 파이프라인 상태 조회
GET /api/pipeline-flow-status
# 응답: 각 노드별 상태, 진행률, 지속시간 정보

# ABEND 테스트 시나리오 상태 조회
GET /api/abend-test-scenario
# 응답: 7단계 테스트 진행 상황, 현재 단계, 전체 상태

# ABEND 테스트 시나리오 시작
POST /api/abend-test-scenario?action=start
# 기능: test_complete_scenario.sh 연동하여 실제 ABEND 자동 수정 프로세스 실행

# 단계별 상태 업데이트 (스크립트에서 호출)
POST /api/abend-test-scenario?action=update
# 바디: { "stepId": "f3-check", "status": "success", "message": "..." }
```

#### 사용 예시
```bash
# Pipeline 상태 확인
curl http://localhost:3016/api/pipeline-flow-status

# ABEND 테스트 상태 확인
curl http://localhost:3016/api/abend-test-scenario

# ABEND 테스트 시작 (실제 test_complete_scenario.sh 실행)
curl -X POST http://localhost:3016/api/abend-test-scenario?action=start
```

### API 상태 확인
```bash
curl http://localhost:3000         # SMED Viewer
curl http://localhost:3003/health  # Python 변환 서비스
curl http://localhost:3004         # System API Server
curl http://localhost:3005         # OpenASP Refactor
curl http://localhost:3006/api/health # Chat API Server
curl http://localhost:3007         # ASP Manager
curl http://localhost:8000         # API Server
curl http://localhost:3014/api/tags # Ollama Server
curl http://localhost:3015         # Zabbix 모니터링
curl http://localhost:3016         # OpenASP DevOps (CI/CD Workflow Visualizer)
curl http://localhost:3011         # Prometheus
curl http://localhost:3010         # Grafana
```

### Zabbix 모니터링 상태 확인
```bash
# 서비스 상태
service zabbix-server status
service zabbix-agent status  
service nginx status
service php8.2-fpm status
service postgresql status

# 모니터링 스크립트 테스트
python3 /home/aspuser/app/monitoring/scripts/check_services.py --json
python3 /home/aspuser/app/monitoring/scripts/log_monitor.py --json
python3 /home/aspuser/app/monitoring/scripts/check_dslock.py --json
python3 /home/aspuser/app/monitoring/scripts/check_abend.py --json  # ABEND 감지 테스트

# Zabbix Agent 파라미터 테스트
zabbix_agentd -t openasp.services.check
zabbix_agentd -t openasp.service.api
zabbix_agentd -t openasp.service.smed
zabbix_agentd -t openasp.abend.check      # ABEND 감지 파라미터 테스트
zabbix_agentd -t openasp.abend.count      # ABEND 카운트 파라미터 테스트

# 데이터베이스 접속
su - postgres -c "psql zabbix"
```

## 🔧 개발 환경

### 필수 요구사항
- Node.js 18+
- Python 3.10+
- npm 또는 yarn

### 서비스 포트 구성
- 3000: SMED Map Viewer (화면 맵 뷰어)
- 3003: Python EBCDIC 변환 서비스
- 3005: OpenASP Refactor 메인
- 3007: ASP Manager
- 3008: ASP Manager 백엔드
- 3010: Grafana (모니터링 시각화)
- 3011: Prometheus (메트릭 수집)
- 3014: Ollama Server (AI 모델)
- 3015: Zabbix (시스템 모니터링)
- 3016: OpenASP DevOps (CI/CD & 모니터링)
- 8000: API Server (통합 백엔드)

### 환경 변수
```bash
# Python 변환 서비스
FLASK_PORT=3003
REACT_APP_PYTHON_CONVERTER_URL=http://localhost:3003
CODEPAGE_BASE_PATH=/home/aspuser/app/ofasp-refactor/public/codepages

# System API Server
ASPMGR_WEB_PORT=3004

# OpenASP Refactor
PORT=3005

# Chat API Server
CHAT_API_PORT=3006
OLLAMA_URL=http://localhost:3014
RAG_DIRECTORY=/home/aspuser/app/ofasp-refactor/public/RAG

# ASP Manager
PORT=3007

# API Server
API_SERVER_PORT=8000

# Ollama Server
OLLAMA_HOST=http://0.0.0.0:3014
OLLAMA_MODELS=/home/aspuser/.ollama/models
```

### 문자 인코딩 및 국제화 규칙

#### SJIS 인코딩 사용
- **일본어 환경 지원**: ja_JP.sjis 로케일 환경에서의 호환성을 위해 스크립트 파일은 SHIFT_JIS 인코딩으로 작성해야 합니다.
- **적용 대상**: Shell 스크립트 (.sh), 배치 파일, 설정 파일 등 시스템 레벨 파일
- **변환 방법**: UTF-8로 작성 후 SHIFT_JIS로 변환 (이모지 제거 필요)

#### 이모지 사용 금지
- **모든 소스 코드**: 소스 코드, 주석, 문서에서 이모지 사용을 금지합니다.
- **대체 표기**: 이모지 대신 ASCII 문자 조합을 사용합니다.
  ```bash
  # 금지: 🚀 시작, ✅ 성공, ❌ 실패, 📝 메모, 🔧 설정
  # 권장: [START], [OK], [NG], [NOTE], [CONFIG]
  ```
- **예외 사항**: UI 텍스트에서는 사용자 경험을 위해 제한적 허용
- **이유**: 
  - SHIFT_JIS 인코딩에서 이모지 지원 불가
  - 크로스 플랫폼 호환성 보장
  - 코드 가독성 및 전문성 유지

#### 주석 작성 가이드라인
```python
# English comments only - all source code comments must be in English
def process_data(input_file):
    """
    Process input file and return results.
    
    Args:
        input_file (str): Path to input file
        
    Returns:
        dict: Processed data results
    """
    # Initialize data structure
    result = {}
    
    # Process each line in the file
    with open(input_file, 'r') as f:
        for line in f:
            # Skip empty lines and comments
            if not line.strip() or line.startswith('#'):
                continue
                
    return result
```

#### 인코딩 변환 예시
```bash
# UTF-8 → SHIFT_JIS 변환 (이모지 제거 포함)
python3 -c "
with open('script.sh', 'r', encoding='utf-8') as f:
    content = f.read()
# Remove emojis and replace with ASCII alternatives
content = content.replace('🚀', '[START]').replace('✅', '[OK]').replace('❌', '[NG]')
with open('script.sh', 'w', encoding='shift_jis') as f:
    f.write(content)
"
```

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

## 📋 개발 규칙 및 가이드라인

### 🚨 **최우선 원칙: 하드코딩 절대 금지**
```
이 프로젝트는 실제 레거시 시스템을 처리하는 업무용 도구입니다.
"데모용", "임시", "테스트" 등의 핑계로 하드코딩하는 것은 절대 금지됩니다.

모든 데이터는 실제 파일 시스템에서 동적으로 로드해야 합니다.
사용자가 요구한 파일 수와 화면 표시가 1개라도 다르면 안됩니다.
에러가 발생하면 우회하지 말고 반드시 근본 원인을 해결하세요.
```

### 코딩 표준
- **하드코딩 금지**: 모든 데이터는 실제 시스템에서 동적 로드 **[최우선]**
- **언어별 규칙**: [CODING_RULES.md](./ofasp-refactor/CODING_RULES.md) 참조
- **문자 인코딩**: 시스템 스크립트는 SHIFT_JIS, 소스 코드는 UTF-8
- **주석 언어**: 모든 소스 코드 내 주석은 영어로 작성
- **이모지 금지**: 모든 소스 코드 및 시스템 파일에서 이모지 사용 금지

### 파일 생성 시 주의사항
1. **Shell 스크립트 (.sh)**
   - UTF-8로 작성 후 SHIFT_JIS로 변환
   - 이모지 사용 금지, ASCII 대체 문자 사용 (`[START]`, `[OK]`, `[NG]`)
   - 모든 주석은 영어로 작성
   - 메시지 출력도 영어 권장 (국제화 고려)

2. **Python 스크립트 (.py)**
   - UTF-8 인코딩 유지
   - 파일 상단에 `# -*- coding: utf-8 -*-` 선언
   - 모든 주석과 docstring은 영어로 작성
   - 이모지 사용 금지
   - SJIS 변환이 필요한 출력은 런타임에 처리

3. **JavaScript/TypeScript (.js/.ts/.tsx)**
   - UTF-8 인코딩 사용
   - 모든 주석은 영어로 작성
   - 이모지 사용 금지 (UI 텍스트 제외)
   - JSDoc 주석도 영어로 작성

4. **설정 파일**
   - JSON: UTF-8 인코딩, 주석 불가하지만 키명은 영어
   - 시스템 설정: SHIFT_JIS 고려
   - YAML/XML: UTF-8 인코딩, 주석은 영어

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
curl http://localhost:3000  # SMED Map Viewer
curl http://localhost:3003  # Python 변환 서비스  
curl http://localhost:3004  # System API Server
curl http://localhost:3005  # OpenASP Refactor
curl http://localhost:3006  # Chat API Server
curl http://localhost:3007  # ASP Manager
curl http://localhost:8000  # API Server
curl http://localhost:3014  # Ollama Server

# 로그 확인
tail -f logs/smed-viewer.log
tail -f logs/python-service.log
tail -f logs/system-api.log
tail -f logs/ofasp-refactor.log
tail -f logs/asp-manager.log
tail -f logs/api-server.log
tail -f ofasp-refactor/logs/chat-api.log
tail -f ofasp-refactor/logs/ollama.log
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

### 📋 **관련 파일 위치**
- **catalog.json**: `/home/aspuser/app/asp-manager/public/config/catalog.json`
- **프로그램 파일**: `/home/aspuser/app/volume/DISK01/TESTLIB/`
- **CL Parser**: `/home/aspuser/app/server/system-cmds/cl_parser.py`
- **CL Executor**: `/home/aspuser/app/server/system-cmds/cl_executor.py`
- **서비스 미시작**: 로그 파일에서 에러 메시지 확인

---

## 🔖 **모든 AI AGENT 기억해야 할 핵심 원칙**

```
이 프로젝트는 장난감이 아닙니다.
실제 레거시 시스템을 마이그레이션하는 업무용 도구입니다.

절대로 하드코딩하지 마세요.
절대로 "데모용"이라는 핑계를 대지 마세요.
절대로 사용자 요구사항을 임의로 축소하지 마세요.
절대로 에러를 우회하지 말고 반드시 해결하세요.

실제 파일 시스템의 모든 파일을 정확히 처리하세요.
1개 파일이라도 빠뜨리면 안됩니다.
```

**개발**: Claude Code Assistant와 함께  
**최종 업데이트**: 2025-07-23  
**핵심 원칙**: 하드코딩 절대 금지, 실제 데이터만 사용  
**인코딩**: SHIFT_JIS (시스템 스크립트), UTF-8 (소스 코드)