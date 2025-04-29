# Real-time Voting App with SpacetimeDB

This is a real-time voting application built with Next.js and SpacetimeDB that allows users to participate in live polls with instant results visualization. The app features a smart architecture that uses SpacetimeDB when available, with automatic fallback to local storage simulation when necessary.

## Features

- Real-time synchronization with SpacetimeDB (with local fallback)
- User landing page with event info and QR code to join voting
- Mobile-friendly user voting page
- Presentation screen showing live voting options and results
- Live synchronization across all devices
- Admin panel to create polls, control voting, and view results

## Project Structure

- `/frontend` - Next.js frontend application
- `/spacetime-module` - Rust module for SpacetimeDB backend
- `/start.sh` - Universal startup script
- `/publish-module.sh` - Helper script for publishing the SpacetimeDB module

## Prerequisites

- Node.js (v16+)
- npm or yarn
- Rust (for SpacetimeDB module development)
- Optional but recommended: SpacetimeDB CLI or Docker

## Quick Start

We've created a universal startup script that makes running the app easy:

```bash
./start.sh
```

This script will:
1. Try to start SpacetimeDB (using native CLI if available, Docker as fallback)
2. Build and publish the Rust module
3. Start the Next.js development server on all network interfaces

If neither SpacetimeDB nor Docker is available, the app will automatically use a local storage simulation mode with full functionality.

## Setup Options

### Option 1: Using SpacetimeDB CLI

If you have the SpacetimeDB CLI installed:

```bash
# In one terminal, start SpacetimeDB
spacetime start

# In another terminal, build and publish the module
./publish-module.sh

# In another terminal, start the frontend
cd frontend && npm run dev
```

### Option 2: Using Docker

If you have Docker installed:

```bash
# Start SpacetimeDB in Docker
docker run -d --name spacetimedb-server -p 3000:3000 \
  -v "$HOME/.spacetimedb-data:/var/lib/spacetimedb" \
  clockworklabs/spacetime start

# Build and copy the module to Docker
./publish-module.sh

# Start the frontend
cd frontend && npm run dev
```

### Option 3: Local Simulation (no dependencies)

If you don't have SpacetimeDB or Docker:

```bash
# Just start the frontend - it will use local storage simulation
cd frontend && npm run dev
```

## Testing the App

1. Open http://[your-ip-address]:3001 in your browser for the landing page
2. Scan the QR code with your mobile device to join as a voter
3. Open http://[your-ip-address]:3001/presentation in a separate window for the presentation view
4. Open http://[your-ip-address]:3001/admin for the admin controls

## Using the Admin Panel

1. Create polls by entering questions and possible answers
2. Activate a poll to make it visible to users
3. Show results when voting is complete
4. End session when finished

## NixOS Compatibility

This application is fully compatible with NixOS and includes:
- A shell.nix file for development environment
- Smart detection of available tools
- Automatic fallback to local simulation when needed

## Project Structure

- `/frontend` - Next.js frontend application with simulated backend
- `/spacetime-module` - SpacetimeDB module (Rust) for future backend integration
- `shell.nix` - NixOS development environment configuration
- `start.sh` - Convenience script to start the application

## Network Requirements

For mobile devices to access the voting application, ensure they're on the same network as the server. The QR code automatically encodes your server's IP address for convenient access.

## Data Persistence

The current implementation uses localStorage for data persistence, which means:
- Data will persist across browser refreshes
- Each device/browser has its own local data store
- Data synchronization happens in real-time via BroadcastChannel API

## Future Enhancements

- Integration with a real SpacetimeDB backend
- User authentication
- Enhanced analytics and reporting
- Support for more complex poll types
# spacetime-delorean
