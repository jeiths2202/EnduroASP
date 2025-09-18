# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Development Commands

### Frontend Applications

#### ASP Manager (Port 3007)
```bash
cd asp-manager
npm install
npm start                  # Runs on port 3007
npm run build             # Production build without sourcemaps
npm test                  # Run tests
```

#### OpenASP Refactor (Port 3005)
```bash
cd ofasp-refactor
npm install
npm start                  # Default language (English)
npm run start:ja          # Japanese interface
npm run start:ko          # Korean interface
npm run build:prod        # Production build
npm test                  # Run tests
```

### Backend Services

#### Python API Server (Port 8000)
```bash
cd server
python api_server.py      # Main API server
python postgresql_api_server.py  # PostgreSQL API endpoints
```

#### Chat API Server (Port 3006)
```bash
cd ofasp-refactor/server
python chat_api.py        # AI chat backend with Ollama integration
```

#### System Commands API (Port 3004)
```bash
cd server/system-cmds
ASPMGR_WEB_PORT=3004 python aspmgr_web.py
```

### Database Operations
```bash
# PostgreSQL setup
psql -U postgres -d openasp < database/catalog_schema.sql
psql -U postgres -d openasp < database/create_asp_terminal_table.sql
psql -U postgres -d openasp < database/create_jobinfo_table.sql
```

### dslock_suite (C Library)
```bash
cd ofasp-refactor/dslock_suite
make clean
make all                  # Build all components
make test                # Run stress tests
```

### Testing

#### End-to-End Testing
```bash
npm install               # Install Playwright at root
npx playwright test       # Run E2E tests for all services
npx playwright test --ui  # Open test UI
```

#### Unit Testing
```bash
# React components
cd asp-manager && npm test
cd ofasp-refactor && npm test

# Python tests
cd server && python -m pytest
cd ofasp-refactor/server && python -m pytest
```

## Architecture Overview

### Multi-Service Architecture
EnduroASP AX is a distributed system consisting of multiple microservices that communicate via REST APIs and WebSockets:

1. **Frontend Layer**
   - React-based SPAs (asp-manager, ofasp-refactor)
   - TypeScript, Tailwind CSS, i18n support
   - WebSocket connections for real-time features

2. **API Gateway Layer**
   - api_server.py: Central API orchestration
   - Handles EBCDIC/ASCII encoding conversions
   - Session management via PostgreSQL

3. **Service Layer**
   - **System Commands**: CL/COBOL execution, job management
   - **Chat Service**: AI-powered assistance with RAG
   - **Encoding Service**: SJIS/EBCDIC/ASCII conversions
   - **SMED Processing**: Legacy screen map handling

4. **Data Layer**
   - PostgreSQL: Catalog, sessions, job info
   - DBIO abstraction: Supports multiple backends
   - File-based storage: Legacy data formats

### Key Integration Points

#### WebSocket Hub Architecture
- Central hub at `/server/websocket_hub.py`
- Manages persistent connections for terminal sessions
- Handles SMED map display updates
- Timeout configured via `config/asp.conf`

#### DBIO System
- Located in `/dbio/` module
- Provides database abstraction layer
- Backends: PostgreSQL, MySQL, SQLite, JSON
- Used by system commands for catalog operations

#### Encoding System
- Smart encoding detection and conversion
- Handles EBCDIC, ASCII, SJIS, JEF, KEIS
- Java Spring Boot service for complex conversions
- Python services for batch operations

#### Job Management
- SBMJOB/REFJOB commands in `/server/system-cmds/functions/`
- Job info stored in PostgreSQL `jobinfo` table
- Queue management with priority handling
- ABEND detection and recovery

### Session and State Management
- PostgreSQL-based session persistence
- WebSocket connections for real-time state sync
- Workstation authentication via iframe messaging
- Terminal state preservation across reconnects

### AI Integration
- Ollama server for local LLM inference
- RAG system with ChromaDB vector storage
- Multi-modal support (text, images, PDFs)
- Model selection: Gemma 2B, GPT-OSS 20B

## Configuration Files

- `/config/asp.conf`: System-wide configuration
- `/config/catalog.json`: Initial catalog data
- `/.env.example`: Environment variables template
- Database schemas in `/database/*.sql`

## Port Allocation

- 3000: SMED Map Viewer
- 3003: Python EBCDIC Conversion Service
- 3004: System Commands API
- 3005: OpenASP Refactor UI
- 3006: Chat API Server
- 3007: ASP Manager UI
- 3014: Ollama AI Server
- 3015: Zabbix Monitoring
- 8000: Main API Server

## Development Workflow

### Running a Single Test
```bash
# React component test
cd asp-manager
npm test -- --testNamePattern="specific test name"

# Python specific test
cd server
python -m pytest path/to/test.py::TestClass::test_method -v

# Playwright specific test
npx playwright test path/to/test.spec.ts --headed
```

### Debugging Services
```bash
# Check service logs
tail -f logs/*.log
tail -f ofasp-refactor/logs/*.log

# Monitor ABEND events
tail -f logs/abend.log

# WebSocket debugging
python server/websocket_hub_client.py
```

### Database Debugging
```bash
# Connect to PostgreSQL
psql -U postgres -d openasp

# Check catalog objects
SELECT * FROM catalog_objects WHERE name LIKE 'PGM%';

# View active sessions
SELECT * FROM asp_sessions WHERE active = true;
```

## Critical Components

### Terminal Emulation System
- 24x80 character terminal simulation
- SMED map processing with field validation
- Located in `ofasp-refactor/src/components/SmedMapDisplay.tsx`
- WebSocket-based screen updates

### Job Queue System
- Priority-based job scheduling
- ABEND recovery mechanisms
- Job dependencies and sequencing
- Implementation in `server/system-cmds/functions/sbmjob.py`

### Catalog Management
- Object registry for programs, files, libraries
- PostgreSQL-backed with JSON fallback
- Migration tools in `dbio/migration.py`
- Access via `asp_commands.py` functions

### Encoding Pipeline
- Multi-stage conversion process
- Codepage tables in `ofasp-refactor/public/codepages/`
- Java service for complex transformations
- Python batch processor for bulk operations