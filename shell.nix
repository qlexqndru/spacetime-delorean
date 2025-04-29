{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  buildInputs = with pkgs; [
    # For SpacetimeDB
    docker
    docker-compose
    
    # For Rust module development (optional)
    rustc
    cargo
    rustfmt
    clippy
    
    # For Next.js frontend
    nodejs_20
    yarn
    
    # Development tools
    git
    curl
    jq
  ];

  shellHook = ''
    echo "Voting App Development Environment"
    echo "=================================="
    echo "Available commands:"
    echo "  install-spacetimedb: Install SpacetimeDB CLI"
    echo "  start-spacetimedb:   Start SpacetimeDB via Docker (persistent data)"
    echo "  setup-frontend:      Initialize Next.js frontend"
    echo ""
    
    # Create a directory for SpacetimeDB data persistence
    mkdir -p "$HOME/.spacetimedb-data"
    
    function install-spacetimedb {
      echo "Installing SpacetimeDB CLI..."
      curl -fsSL https://install.spacetimedb.com | bash
      export PATH="$HOME/.spacetime/bin:$PATH"
      echo "SpacetimeDB CLI installed! Please run 'source ~/.bashrc' or restart your shell."
    }
    
    function start-spacetimedb {
      echo "Starting SpacetimeDB with persistent data..."
      docker run --rm -p 3000:3000 -v "$HOME/.spacetimedb-data:/var/lib/spacetimedb" clockworklabs/spacetime start
    }

    function setup-frontend {
      cd frontend && yarn install
    }

    # Export the functions so they're available in the shell
    export -f install-spacetimedb
    export -f start-spacetimedb
    export -f setup-frontend
    
    # Add SpacetimeDB to PATH if it exists
    if [ -d "$HOME/.spacetime/bin" ]; then
      export PATH="$HOME/.spacetime/bin:$PATH"
      echo "SpacetimeDB CLI found in path."
    else
      echo "SpacetimeDB CLI not found. Run 'install-spacetimedb' to install it."
    fi
  '';
}
