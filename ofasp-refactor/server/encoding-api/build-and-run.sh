#!/bin/bash

# ASP Encoding API Build and Run Script

API_DIR="/home/aspuser/app/server/encoding-api"
JAR_NAME="encoding-api-1.0.0.jar"
PID_FILE="$API_DIR/api.pid"

echo "=== ASP Encoding API Build and Run Script ==="

# Function to check if API is running
check_api_status() {
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if ps -p $PID > /dev/null 2>&1; then
            echo "API is running (PID: $PID)"
            return 0
        else
            echo "PID file exists but process is not running, cleaning up..."
            rm -f "$PID_FILE"
        fi
    fi
    echo "API is not running"
    return 1
}

# Function to stop API
stop_api() {
    echo "Stopping ASP Encoding API..."
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if ps -p $PID > /dev/null 2>&1; then
            kill $PID
            echo "Waiting for process to stop..."
            sleep 3
            if ps -p $PID > /dev/null 2>&1; then
                echo "Force killing process..."
                kill -9 $PID
            fi
        fi
        rm -f "$PID_FILE"
        echo "API stopped"
    else
        echo "API was not running"
    fi
}

# Function to build API
build_api() {
    echo "Building ASP Encoding API..."
    cd "$API_DIR"
    
    # Check if Maven is available
    if ! command -v mvn &> /dev/null; then
        echo "Error: Maven is not installed"
        exit 1
    fi
    
    # Clean and build
    mvn clean package -DskipTests
    
    if [ $? -eq 0 ]; then
        echo "Build successful!"
        return 0
    else
        echo "Build failed!"
        return 1
    fi
}

# Function to start API
start_api() {
    echo "Starting ASP Encoding API..."
    cd "$API_DIR"
    
    # Check if JAR exists
    if [ ! -f "target/$JAR_NAME" ]; then
        echo "JAR file not found. Building first..."
        build_api
        if [ $? -ne 0 ]; then
            echo "Cannot start API: build failed"
            exit 1
        fi
    fi
    
    # Create logs directory
    mkdir -p logs
    
    # Start the API in background
    nohup java -jar "target/$JAR_NAME" > logs/console.log 2>&1 &
    
    # Save PID
    echo $! > "$PID_FILE"
    
    echo "API started (PID: $!)"
    echo "Logs: $API_DIR/logs/"
    echo "Console log: $API_DIR/logs/console.log"
    echo "Application log: $API_DIR/logs/encoding-api.log"
    
    # Wait a moment and check if it's running
    sleep 3
    if check_api_status > /dev/null; then
        echo "API is running successfully!"
        echo "Health check: curl http://localhost:8080/api/encoding/health"
        echo "API info: curl http://localhost:8080/api/encoding/info"
    else
        echo "API failed to start. Check logs for details."
        exit 1
    fi
}

# Main script logic
case "${1:-start}" in
    "build")
        build_api
        ;;
    "start")
        if check_api_status > /dev/null; then
            echo "API is already running"
        else
            start_api
        fi
        ;;
    "stop")
        stop_api
        ;;
    "restart")
        stop_api
        sleep 2
        start_api
        ;;
    "status")
        check_api_status
        ;;
    "rebuild")
        stop_api
        sleep 2
        build_api
        if [ $? -eq 0 ]; then
            start_api
        fi
        ;;
    "logs")
        echo "=== Console Log ==="
        tail -f "$API_DIR/logs/console.log" 2>/dev/null || echo "Console log not found"
        ;;
    "help")
        echo "Usage: $0 {build|start|stop|restart|status|rebuild|logs|help}"
        echo ""
        echo "Commands:"
        echo "  build    - Build the API JAR file"
        echo "  start    - Start the API (builds if needed)"
        echo "  stop     - Stop the API"
        echo "  restart  - Stop and start the API"
        echo "  status   - Check if API is running"
        echo "  rebuild  - Stop, rebuild, and start"
        echo "  logs     - Follow console logs"
        echo "  help     - Show this help"
        ;;
    *)
        echo "Invalid command. Use '$0 help' for usage information."
        exit 1
        ;;
esac