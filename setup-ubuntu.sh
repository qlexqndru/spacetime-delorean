#!/usr/bin/env bash

# This script prepares the Ubuntu environment for SpacetimeDB

# Add SpacetimeDB to PATH
echo 'export PATH="/home/docbrown/.local/bin:$PATH"' >> ~/.bashrc

# Add Rust to PATH
echo 'source "$HOME/.cargo/env"' >> ~/.bashrc

# Apply changes to current shell
export PATH="/home/docbrown/.local/bin:$PATH"
source "$HOME/.cargo/env"

# Verify installations
echo "===== Verifying installations ====="
echo -n "Node.js: "
node --version
echo -n "npm: "
npm --version
echo -n "SpacetimeDB: "
spacetime --version
echo -n "Rust: "
rustc --version
echo -n "Cargo: "
cargo --version
echo "=================================="

echo "Environment setup complete! You'll need to start a new terminal session or run:"
echo "source ~/.bashrc"
echo "before running the ubuntu-start.sh script."
