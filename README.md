## Overview
EnduroASP AX is a next-generation integrated migration platform that supports complete reconstruction of enterprise legacy ASP (Advanced System Products) systems based on modern open-source architecture, going beyond simple re-hosting.
This platform automatically analyzes, transforms, and redeploys decades of accumulated COBOL/ASM/SMED/CL assets, maintaining the stability of existing business logic while transforming them into scalable structures for cloud-native environments. Additionally, by combining AI-based code conversion engines with the **open-source ecosystem (React, Spring Boot, PostgreSQL, Kubernetes, etc.)**, it helps enterprises achieve cost reduction, operational agility, and accelerated digital transformation (DX) simultaneously.

### 🧪 CI/CD Test Status
- ✅ Automated regression testing enabled
- ✅ React, Python, C++ test suites included
- ✅ Code quality and security scanning integrated

## 🏗️ Project Structure

### 1. [SMED Map Viewer](./) (Port 3000)
- **Purpose**: Legacy SMED screen map viewer
- **Key Features**: 24x80 terminal simulation, field management, Java program integration
- **Technology**: React, TypeScript, CSS Grid
- **Run**: `npm start`

### 2. [Python Conversion Service](./ofasp-refactor/python-service/) (Port 3003)
- **Purpose**: EBCDIC/ASCII conversion backend
- **Key Features**: RESTful API, SOSI processing, batch optimization
- **Technology**: Python, Flask, Flask-CORS
- **Run**: `FLASK_PORT=3003 python -c "from src.api.app import api; api.run()"`

### 3. [System API Server](./ofasp-refactor/server/) (Port 3004)
- **Purpose**: EnduroASP system management API
- **Key Features**: System command processing, web interface integration
- **Technology**: Python, Flask
- **Run**: `ASPMGR_WEB_PORT=3004 python aspmgr_web.py`

### 4. [EnduroASP Refactor](./ofasp-refactor/) (Port 3005)
- **Purpose**: Code conversion and refactoring tool, multimodal AI chat
- **Key Features**:
  - COBOL/CL conversion, EBCDIC conversion, AI support
  - Multimodal AI chat (text, image, file upload)
  - RAG document search (/ofasp-refactor/public/RAG)
  - AI model selection (Gemma 2B, GPT-OSS 20B)
- **Technology**: React, TypeScript, CodeMirror
- **Run**: `PORT=3005 npm start`

### 5. [Chat API Server](./ofasp-refactor/server/) (Port 3006)
- **Purpose**: AI chat backend API
- **Key Features**: Ollama integration, multimodal support, RAG document search
- **Technology**: Python, Flask, Ollama API
- **Run**: `python chat_api.py`

### 6. [ASP Manager](./asp-manager/) (Port 3007)
- **Purpose**: AI-based system management interface
- **Key Features**: RAG document search, system monitoring, virtual terminal
- **Technology**: React, TensorFlow.js, Express.js
- **Run**: `PORT=3007 npm start`

### 7. [API Server](./server/) (Port 8000)
- **Purpose**: Integrated backend API server
- **Key Features**: Database integration, file management, system integration
- **Technology**: Python, Flask
- **Run**: `python api_server.py`

### 8. [Ollama Server](./ofasp-refactor/) (Port 3014)
- **Purpose**: Local AI model server
- **Key Features**: Gemma 2B, GPT-OSS 20B model services
- **Technology**: Ollama, AI model hosting
- **Run**: Auto-starts through Chat service
## 🔍 Monitoring System (Zabbix)

### 10. [Zabbix Monitoring System] (Port 3015)
- **Web Interface**: http://localhost:3015
- **Login**: Admin / zabbix
- **Purpose**: EnduroASP AX system-wide monitoring and alerts

#### 📊 Monitoring Targets
- **API Server** (Port 8000): HTTP response, process status
- **SMED Viewer** (Port 3000): HTTP response, React app status
- **Python Service** (Port 3003): Flask service status
- **Refactor Service** (Port 3005): Code conversion service status
- **Manager Service** (Port 3007): AI management interface status
- **Log Monitoring**:
  - `/home/aspuser/app/logs/` (Main logs)
  - `/home/aspuser/app/ofasp-refactor/logs/` (Refactor logs)
  - **ABEND Log**: `/home/aspuser/app/logs/abend.log` (ABEND detection history)
- **dslock_suite**: File lock management system status
- **ABEND Auto-Detection**: CEE3204S error code real-time monitoring

#### 🔧 Zabbix Components

##### PostgreSQL Database
```bash
# Database Information
Host: localhost
Port: 5432
Database: zabbix

# Main Tables
- users: Zabbix user information
- items: Monitoring item definitions
- triggers: Alert trigger settings
- history: Monitoring data history
```

##### Zabbix Server
```bash
# Service Management
service zabbix-server start|stop|restart|status

# Configuration File
/etc/zabbix/zabbix_server.conf

# Log File
/var/log/zabbix/zabbix_server.log

# Main Settings
- Server Port: 10051
- Database Connection: PostgreSQL localhost:5432/zabbix
```

##### Zabbix Agent
```bash
# Service Management
service zabbix-agent start|stop|restart|status

# Configuration Files
/etc/zabbix/zabbix_agentd.conf
/etc/zabbix/zabbix_agentd.d/EnduroASP.conf  # EnduroASP custom parameters

# Log File
/var/log/zabbix/zabbix_agentd.log

# Main Settings
- Agent Port: 10050
- Server Connection: localhost:10051
```

##### Nginx Web Server
```bash
# Service Management
service nginx start|stop|restart|status

# Configuration Files
/etc/zabbix/nginx.conf           # Zabbix-specific configuration
/etc/nginx/sites-enabled/zabbix  # Nginx site configuration

# Log Files
/var/log/nginx/access.log
/var/log/nginx/error.log

# Main Settings
- Web Port: 3015
- Document Root: /usr/share/zabbix
- PHP-FPM Connection: unix:/var/run/php/zabbix.sock
```

##### PHP-FPM
```bash
# Service Management
service php8.2-fpm start|stop|restart|status

# Configuration File
/etc/php/8.2/fpm/pool.d/zabbix.conf

# Log File
/var/log/php8.2-fpm.log

# Extension Modules
- pgsql: PostgreSQL connection
- pdo_pgsql: PDO PostgreSQL driver
```

#### 🎯 Custom Monitoring Scripts
```bash
# Script Location
/home/aspuser/app/monitoring/scripts/

# Service Status Check
check_services.py  - All EnduroASP service HTTP status check

# Log Monitoring
log_monitor.py     - Error/warning log detection and analysis

# dslock Status Check
check_dslock.py    - dslock_suite status and active lock monitoring

# ABEND Auto-Detection and Fix
check_abend.py     - ABEND CEE3204S detection and auto-fix trigger

# Configuration Files
/home/aspuser/app/monitoring/config/zabbix.conf
/etc/zabbix/zabbix_agentd.d/EnduroASP.conf  # ABEND monitoring parameters
```

#### 🚨 Alert Settings
- **Service Down**: Immediate alert on HTTP response failure
- **Log Errors**: Alert when errors/warnings detected in log files
- **System Resources**: Alert when CPU, memory, disk thresholds exceeded
- **dslock Issues**: Alert on file lock system errors
- **ABEND Detection**: Immediate alert and auto-fix trigger on CEE3204S ABEND occurrence

#### 🔄 Monitoring Intervals
- **Service Status**: Check every 60 seconds
- **Log Monitoring**: Check every 300 seconds
- **dslock Status**: Check every 120 seconds
- **ABEND Detection**: Check every 60 seconds (real-time response)
- **System Resources**: Check every 60 seconds

## 🔄 ABEND Auto-Detection and Fix System

### 🎯 Integrated Test Scenario
EnduroASP AX system implements a fully automated failure response system: **ABEND occurrence → Zabbix detection → DevOps CI/CD auto-fix → Normalization**.

### 📋 ABEND Auto-Response Process

#### 1️⃣ **ABEND Occurrence Stage**
- **Trigger**: CEE3204S ABEND occurs in MAIN001.java on F3 key input
- **Location**: `/home/aspuser/app/volume/DISK01/JAVA/MAIN001.java:handleF3Key()`
- **Log**: ABEND information recorded in `/home/aspuser/app/logs/abend.log`

#### 2️⃣ **Zabbix Real-time Detection**
- **Detection Script**: `check_abend.py` (60-second interval)
- **Zabbix Parameters**: `EnduroASP.abend.check`, `EnduroASP.abend.count`
- **Alert**: ABEND alert displayed in "EnduroASP AX" host on Zabbix UI

#### 3️⃣ **CI/CD Auto-Fix Pipeline**
- **Workflow**: ABEND Auto-Fix Pipeline (4 stages)
  1. 🔍 **Detect and Analyze ABEND**: Code checkout, log analysis, backup creation
  2. 🔧 **Auto-Fix ABEND**: F3 key handler fix, code compilation, testing
  3. 🚀 **Deploy Fixed Code**: Production deployment, service restart, deployment verification
  4. 📢 **Notify Fix Completion**: Fix result logging, monitoring update

#### 4️⃣ **Real-time Visual Monitoring**
- **URL**: http://localhost:3016/ (CI/CD Workflow Visualizer)
- **Features**:
  - Real-time workflow status display
  - Job dependency graph visualization
  - Historical ABEND count tracking
  - Auto-refresh (10-second interval)

### 🔧 **Configuration Files**
```bash
# ABEND Monitoring Configuration
/etc/zabbix/zabbix_agentd.d/EnduroASP.conf

# Detection Script
/home/aspuser/app/monitoring/scripts/check_abend.py

# Auto-Fix Target File
/home/aspuser/app/volume/DISK01/JAVA/MAIN001.java

# ABEND Log
/home/aspuser/app/logs/abend.log

# CI/CD Workflow API
/home/aspuser/app/ofasp-devops/src/pages/api/workflow-data.ts
/home/aspuser/app/ofasp-devops/src/pages/api/abend-status.ts
```

### 🧪 **Test Scenario Execution**
1. **Run MAIN001.java**: Trigger ABEND with F3 key input
2. **Zabbix Monitoring**: Check alerts at http://localhost:3015
3. **CI/CD Visualization**: Monitor pipeline progress at http://localhost:3016
4. **Auto-Fix Verification**: Verify F3 key works normally

### 📊 **Monitoring Metrics**
- **Total ABEND Occurrences**: Cumulative ABEND count from history
- **Current ABEND Count**: Currently active ABEND count
- **Workflow Status**: pending → in_progress → completed
- **Auto-Fix Success Rate**: Ratio of successfully fixed ABENDs

## 🚀 Quick Start

### Start All Services
```bash
./master-start.sh
```

### Stop All Services
```bash
./master-stop.sh
```

### Start Individual Services
```bash
# SMED Map Viewer
npm start

# Python Conversion Service
cd ofasp-refactor/python-service
FLASK_PORT=3003 python -c "from src.api.app import api; api.run()"

# System API Server
cd ofasp-refactor/server
ASPMGR_WEB_PORT=3004 python aspmgr_web.py

# EnduroASP Refactor
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

### Chat Service Management
```bash
# Start Chat Service
cd ofasp-refactor
./scripts/chat-start.sh

# Stop Chat Service
./scripts/chat-stop.sh

# Check Chat Service Status
curl http://localhost:3014/api/tags  # Ollama model list
curl http://localhost:3006/api/health # Chat API status
```

## 📋 Key Documentation

- [MASTER_CLAUDE.md](./MASTER_CLAUDE.md) - Complete project work history
- [PROJECT_CONTEXT.json](./PROJECT_CONTEXT.json) - Structured project information
- [CODING_RULES.md](./ofasp-refactor/CODING_RULES.md) - Development rules and standards
- [CHAT_SERVICE_SCRIPTS.md](./ofasp-refactor/docs/CHAT_SERVICE_SCRIPTS.md) - Chat Service management script documentation

## 🧪 Testing

### EBCDIC Conversion Test
```bash
cd ofasp-refactor/python-service
python convert_file.py /tmp/sample.ebc -e JP -s --sosi-handling space -o /tmp/output.txt
```

### 🔄 NEW: DevOps Pipeline API Endpoints

#### Pipeline Flow API (Port 3016)
```bash
# Get real-time pipeline status
GET /api/pipeline-flow-status
# Response: Status, progress, duration info for each node

# Get ABEND test scenario status
GET /api/abend-test-scenario
# Response: 7-stage test progress, current stage, overall status

# Start ABEND test scenario
POST /api/abend-test-scenario?action=start
# Function: Execute actual ABEND auto-fix process via test_complete_scenario.sh

# Update step-by-step status (called from script)
POST /api/abend-test-scenario?action=update
# Body: { "stepId": "f3-check", "status": "success", "message": "..." }
```

#### Usage Examples
```bash
# Check Pipeline status
curl http://localhost:3016/api/pipeline-flow-status

# Check ABEND test status
curl http://localhost:3016/api/abend-test-scenario

# Start ABEND test (executes actual test_complete_scenario.sh)
curl -X POST http://localhost:3016/api/abend-test-scenario?action=start
```

### API Status Check
```bash
curl http://localhost:3000         # SMED Viewer
curl http://localhost:3003/health  # Python Conversion Service
curl http://localhost:3004         # System API Server
curl http://localhost:3005         # EnduroASP Refactor
curl http://localhost:3006/api/health # Chat API Server
curl http://localhost:3007         # ASP Manager
curl http://localhost:8000         # API Server
curl http://localhost:3014/api/tags # Ollama Server
curl http://localhost:3015         # Zabbix Monitoring
curl http://localhost:3016         # EnduroASP DevOps (CI/CD Workflow Visualizer)
curl http://localhost:3011         # Prometheus
curl http://localhost:3010         # Grafana
```

### Zabbix Monitoring Status Check
```bash
# Service Status
service zabbix-server status
service zabbix-agent status
service nginx status
service php8.2-fpm status
service postgresql status

# Monitoring Script Tests
python3 /home/aspuser/app/monitoring/scripts/check_services.py --json
python3 /home/aspuser/app/monitoring/scripts/log_monitor.py --json
python3 /home/aspuser/app/monitoring/scripts/check_dslock.py --json
python3 /home/aspuser/app/monitoring/scripts/check_abend.py --json  # ABEND detection test

# Zabbix Agent Parameter Tests
zabbix_agentd -t EnduroASP.services.check
zabbix_agentd -t EnduroASP.service.api
zabbix_agentd -t EnduroASP.service.smed
zabbix_agentd -t EnduroASP.abend.check      # ABEND detection parameter test
zabbix_agentd -t EnduroASP.abend.count      # ABEND count parameter test

# Database Access
su - postgres -c "psql zabbix"
```

## 🔧 Development Environment

### Requirements
- Node.js 18+
- Python 3.10+
- npm or yarn

### Service Port Configuration
- 3000: SMED Map Viewer (Screen map viewer)
- 3003: Python EBCDIC conversion service
- 3005: EnduroASP Refactor main
- 3007: ASP Manager
- 3008: ASP Manager backend
- 3010: Grafana (Monitoring visualization)
- 3011: Prometheus (Metrics collection)
- 3014: Ollama Server (AI models)
- 3015: Zabbix (System monitoring)
- 3016: EnduroASP DevOps (CI/CD & Monitoring)
- 8000: API Server (Integrated backend)

### Environment Variables
```bash
# Python Conversion Service
FLASK_PORT=3003
REACT_APP_PYTHON_CONVERTER_URL=http://localhost:3003
CODEPAGE_BASE_PATH=/home/aspuser/app/ofasp-refactor/public/codepages

# System API Server
ASPMGR_WEB_PORT=3004

# EnduroASP Refactor
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

### Character Encoding and Internationalization Rules

#### SJIS Encoding Usage
- **Japanese Environment Support**: Script files must be written in SHIFT_JIS encoding for compatibility with ja_JP.sjis locale environment.
- **Applicable To**: Shell scripts (.sh), batch files, configuration files, and other system-level files
- **Conversion Method**: Write in UTF-8 first, then convert to SHIFT_JIS (emoji removal required)

#### Emoji Usage Prohibition
- **All Source Code**: Emojis are prohibited in source code, comments, and documentation.
- **Alternative Notation**: Use ASCII character combinations instead of emojis.
  ```bash
  # Prohibited: 🚀 Start, ✅ Success, ❌ Failure, 📝 Note, 🔧 Config
  # Recommended: [START], [OK], [NG], [NOTE], [CONFIG]
  ```
- **Exception**: Limited use allowed in UI text for user experience
- **Reasons**:
  - Emojis not supported in SHIFT_JIS encoding
  - Ensures cross-platform compatibility
  - Maintains code readability and professionalism

#### Comment Writing Guidelines
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

#### Encoding Conversion Example
```bash
# UTF-8 → SHIFT_JIS conversion (including emoji removal)
python3 -c "
with open('script.sh', 'r', encoding='utf-8') as f:
    content = f.read()
# Remove emojis and replace with ASCII alternatives
content = content.replace('🚀', '[START]').replace('✅', '[OK]').replace('❌', '[NG]')
with open('script.sh', 'w', encoding='shift_jis') as f:
    f.write(content)
"
```

## 📁 Directory Structure
```
/home/aspuser/app/
├── ofasp-refactor/          # Main refactoring platform
│   ├── src/                 # React source code
│   ├── python-service/      # Python backend
│   └── public/             # Static resources
├── asp-manager/            # AI management interface
│   ├── src/                # React source code
│   └── server.js          # Express proxy
├── server/                 # Backend services
│   └── aspmgr/            # Curses system manager
├── master-start.sh        # Start all services script
└── master-stop.sh         # Stop all services script
```

## 📋 Development Rules and Guidelines

### Internationalization Support
- **Locale Support**: ja_JP.sjis, en_US.UTF-8
- **Message Display**: Automatic encoding detection based on environment
- **Font Support**: Use terminal fonts that can display Japanese

### Key Commands
```bash
# Environment Management
./master-start.sh    # Start all services
./master-stop.sh     # Stop all services

# Check Individual Services
curl http://localhost:3000  # SMED Map Viewer
curl http://localhost:3003  # Python Conversion Service
curl http://localhost:3004  # System API Server
curl http://localhost:3005  # EnduroASP Refactor
curl http://localhost:3006  # Chat API Server
curl http://localhost:3007  # ASP Manager
curl http://localhost:8000  # API Server
curl http://localhost:3014  # Ollama Server

# Check Logs
tail -f logs/smed-viewer.log
tail -f logs/python-service.log
tail -f logs/system-api.log
tail -f logs/ofasp-refactor.log
tail -f logs/asp-manager.log
tail -f logs/api-server.log
tail -f ofasp-refactor/logs/chat-api.log
tail -f ofasp-refactor/logs/ollama.log
```


