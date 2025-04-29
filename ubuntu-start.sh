#!/usr/bin/env bash

# Exit script on any error
set -e

# Get IP address in a Ubuntu-compatible way
ip_address=$(hostname -I | awk '{print $1}')

# Project directory - using absolute path
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Start SpacetimeDB
echo "Starting SpacetimeDB..."
# Kill any existing SpacetimeDB process
pkill -f "spacetime start" || true
# Start spacetime in the background
spacetime start --listen-addr 0.0.0.0:5000 &
SPACETIME_PID=$!

# Wait for SpacetimeDB to start
echo "Waiting for SpacetimeDB to initialize..."
sleep 5

# Build the module
echo "Building Rust module..."
MODULE_DIR="$PROJECT_DIR/spacetime-module"
(cd "$MODULE_DIR" && cargo build --release)

# Publish module
echo "Publishing module to SpacetimeDB..."
(cd "$MODULE_DIR" && spacetime publish voting-app --local-only)

# Start the Next.js development server
echo -e "\nStarting Voting App frontend..."
echo "====================================="
echo "Main URL: http://$ip_address:3001"
echo "Admin URL: http://$ip_address:3001/admin"
echo "Presentation URL: http://$ip_address:3001/presentation"
echo "SpacetimeDB WS URL: ws://localhost:5000/voting-app"
echo "====================================="
echo ""
echo "Running on Ubuntu with native SpacetimeDB"
echo ""

# Start the frontend
cd "$PROJECT_DIR/frontend" && npm run dev

# Cleanup function to kill SpacetimeDB when script exits
cleanup() {
    echo -e "\nShutting down..."
    if [ -n "$SPACETIME_PID" ]; then
        echo "Stopping SpacetimeDB..."
        kill $SPACETIME_PID || true
    fi
    echo "Done!"
}

# Register cleanup function
trap cleanup EXIT
