#!/usr/bin/env bash

# Exit script on any error
set -e

# Get IP address in a NixOS-compatible way
ip_address=$(ip -4 addr show | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | grep -v 127.0.0.1 | head -n 1)

# Project directory - using absolute path
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Make module publishing script executable
chmod +x "$PROJECT_DIR/publish-module.sh"

# Define functions for different SpacetimeDB start methods
start_native_spacetimedb() {
    echo "Starting SpacetimeDB natively..."
    spacetime start &
    SPACETIME_PID=$!
    
    # Wait for SpacetimeDB to start
    echo "Waiting for SpacetimeDB to start..."
    sleep 5
    
    # Build and publish the module
    echo "Publishing the SpacetimeDB module..."
    "$PROJECT_DIR/publish-module.sh"
}

start_docker_spacetimedb() {
    echo "Starting SpacetimeDB using Docker..."
    
    # Create directory for persistent data
    mkdir -p "$HOME/.spacetimedb-data"
    
    # Check if container already exists and is running
    if docker ps | grep -q spacetimedb-server; then
        echo "SpacetimeDB is already running"
    else
        # Check if container exists but is not running
        if docker ps -a | grep -q spacetimedb-server; then
            echo "Starting existing SpacetimeDB container..."
            docker start spacetimedb-server
        else
            echo "Creating new SpacetimeDB container on port 5000..."
            docker run -d --name spacetimedb-server -p 5000:5000 \
              -v "$HOME/.spacetimedb-data:/var/lib/spacetimedb" \
              clockworklabs/spacetime start --listen-addr 0.0.0.0:5000
        fi
    fi
    
    # Wait for SpacetimeDB to start
    echo "Waiting for SpacetimeDB to initialize..."
    sleep 5
    
    # Build the module locally using absolute paths
    echo "Building Rust module..."
    MODULE_DIR="$PROJECT_DIR/spacetime-module"
    (cd "$MODULE_DIR" && cargo build --release)
    
    # Publish using Docker
    echo "Publishing module to SpacetimeDB..."
    # First check if source directory exists
    if [ ! -d "$MODULE_DIR/src" ]; then
        echo "Error: Could not find $MODULE_DIR/src"
        echo "Current directory: $(pwd)"
        echo "Module directory: $MODULE_DIR"
        exit 1
    fi
    
    # Check if container is actually running
    if ! docker ps | grep -q spacetimedb-server; then
        echo "Error: SpacetimeDB container is not running. Check Docker logs for details."
        docker logs spacetimedb-server
        exit 1
    fi
    
    # Create a temporary directory in the container
    echo "Creating temporary directory in container..."
    docker exec spacetimedb-server mkdir -p /tmp/voting-app-module
    
    # Copy our module files there using absolute paths
    echo "Copying module files to container..."
    docker cp "$MODULE_DIR/src" spacetimedb-server:/tmp/voting-app-module/
    docker cp "$MODULE_DIR/Cargo.toml" spacetimedb-server:/tmp/voting-app-module/
    
    # Publish from there
    echo "Publishing module from container..."
    docker exec spacetimedb-server bash -c "cd /tmp/voting-app-module && \
      spacetime config set api.host http://127.0.0.1:5000 && \
      spacetime publish voting-app --local-only"
    
    # No need to return to project directory since we're now using absolute paths
}

# Try to start SpacetimeDB using the most appropriate method
if command -v spacetime &> /dev/null; then
    # Native spacetime command is available
    start_native_spacetimedb
    USING_NATIVE=true
elif command -v docker &> /dev/null; then
    # Docker is available, use that instead
    start_docker_spacetimedb
    USING_DOCKER=true
else
    echo "WARNING: Neither spacetime command nor Docker found."
    echo "The frontend will run with local storage simulation."
    echo "For a better experience, please install SpacetimeDB or Docker."
fi

# Start the Next.js development server
echo "\nStarting Voting App frontend..."
echo "====================================="
echo "Main URL: http://$ip_address:3001"
echo "Admin URL: http://$ip_address:3001/admin"
echo "Presentation URL: http://$ip_address:3001/presentation"
echo "SpacetimeDB WS URL: ws://localhost:5000/voting-app"
echo "====================================="
echo ""
echo "Using host networking for SpacetimeDB - this should fix connection issues."
echo "If connection problems persist, check your firewall settings."
echo ""

# Start the frontend
cd "$PROJECT_DIR/frontend" && npm run dev

# Cleanup function to kill SpacetimeDB when script exits
cleanup() {
    echo "\nShutting down..."
    if [ -n "$SPACETIME_PID" ]; then
        echo "Stopping native SpacetimeDB..."
        kill $SPACETIME_PID || true
    fi
    if [ -n "$USING_DOCKER" ]; then
        echo "Stopping Docker SpacetimeDB..."
        docker stop spacetimedb-server >/dev/null 2>&1 || true
    fi
    echo "Done!"
}

# Register cleanup function
trap cleanup EXIT
