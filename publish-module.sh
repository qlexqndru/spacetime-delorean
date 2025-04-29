#!/usr/bin/env bash

# Exit on any error
set -e

echo "Building and publishing the SpacetimeDB module..."
echo "================================================="

# Move to the module directory
cd "$(dirname "$0")/spacetime-module"

# Build the module
echo "Building Rust module..."
cargo build --release

# Publish to SpacetimeDB (using the module name 'voting-app')
echo "Publishing module to SpacetimeDB..."
spacetime publish --project-path . voting-app

echo ""
echo "Module published successfully!"
echo "================================================="
echo "Module is now available at: ws://localhost:3000/spacetimedb/voting-app"
echo ""
