#!/bin/bash

# Start SSH service
service ssh start

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL..."
while ! pg_isready -h postgres -p 5432 -U aspuser > /dev/null 2>&1; do
    sleep 1
done
echo "PostgreSQL is ready!"

# Switch to aspuser and start services
su - aspuser << 'EOF'
cd /app

# Install npm dependencies if needed
if [ -d "/app/ofasp-refactor" ] && [ ! -d "/app/ofasp-refactor/node_modules" ]; then
    echo "Installing ofasp-refactor dependencies..."
    cd /app/ofasp-refactor
    npm install
fi

if [ -d "/app/asp-manager" ] && [ ! -d "/app/asp-manager/node_modules" ]; then
    echo "Installing asp-manager dependencies..."
    cd /app/asp-manager
    npm install
fi

if [ -d "/app/ofasp-devops" ] && [ ! -d "/app/ofasp-devops/node_modules" ]; then
    echo "Installing ofasp-devops dependencies..."
    cd /app/ofasp-devops
    npm install
fi

# Start services in background
cd /app

# Python services
if [ -f "/app/server/api_server.py" ]; then
    echo "Starting API Server on port 8000..."
    nohup python3 /app/server/api_server.py > /app/logs/api-server.log 2>&1 &
fi

if [ -d "/app/ofasp-refactor/python-service" ]; then
    echo "Starting Python EBCDIC Service on port 3003..."
    cd /app/ofasp-refactor/python-service
    FLASK_PORT=3003 nohup python3 -c "from src.api.app import api; api.run()" > /app/logs/python-service.log 2>&1 &
fi

if [ -f "/app/ofasp-refactor/server/aspmgr_web.py" ]; then
    echo "Starting System API Server on port 3004..."
    ASPMGR_WEB_PORT=3004 nohup python3 /app/ofasp-refactor/server/aspmgr_web.py > /app/logs/system-api.log 2>&1 &
fi

if [ -f "/app/ofasp-refactor/server/chat_api.py" ]; then
    echo "Starting Chat API Server on port 3006..."
    nohup python3 /app/ofasp-refactor/server/chat_api.py > /app/logs/chat-api.log 2>&1 &
fi

# Node.js services
if [ -d "/app/ofasp-refactor" ]; then
    echo "Starting EnduroASP Refactor on port 3005..."
    cd /app/ofasp-refactor
    PORT=3005 nohup npm start > /app/logs/ofasp-refactor.log 2>&1 &
fi

if [ -d "/app/asp-manager" ]; then
    echo "Starting ASP Manager on port 3007..."
    cd /app/asp-manager
    PORT=3007 nohup npm start > /app/logs/asp-manager.log 2>&1 &
fi

if [ -d "/app/ofasp-devops" ]; then
    echo "Starting EnduroASP DevOps on port 3016..."
    cd /app/ofasp-devops
    PORT=3016 nohup npm run dev > /app/logs/ofasp-devops.log 2>&1 &
fi

echo "All services started. Logs available in /app/logs/"
echo "Access the services at:"
echo "  - API Server: http://localhost:8000"
echo "  - Python EBCDIC Service: http://localhost:3003"
echo "  - System API Server: http://localhost:3004"
echo "  - EnduroASP Refactor: http://localhost:3005"
echo "  - Chat API Server: http://localhost:3006"
echo "  - ASP Manager: http://localhost:3007"
echo "  - EnduroASP DevOps: http://localhost:3016"
echo "  - Zabbix Monitoring: http://localhost:3015 (Admin/zabbix)"
echo "  - Ollama AI Server: http://localhost:3014"

# Keep container running
cd /app
bash
EOF

# Keep the container running
tail -f /dev/null