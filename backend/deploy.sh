#!/bin/bash
#
# NeureCore Backend — Production Deployment Script
# Usage: ./deploy.sh [command]
#
# Commands:
#   setup     - Initial setup (copy env, generate secrets)
#   build     - Build Docker images
#   up        - Start all services
#   migrate   - Run database migrations
#   logs      - Show logs (follow mode)
#   restart   - Restart backend service
#   down      - Stop all services
#   status    - Show service status
#   health    - Check API health endpoint
#

set -e  # Exit on error

COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper functions
info() {
    echo -e "${GREEN}✓${NC} $1"
}

warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

error() {
    echo -e "${RED}✗${NC} $1"
    exit 1
}

# Check if .env exists
check_env() {
    if [ ! -f "$ENV_FILE" ]; then
        error ".env file not found! Run './deploy.sh setup' first."
    fi
}

# Setup command
cmd_setup() {
    info "Setting up production environment..."
    
    if [ -f "$ENV_FILE" ]; then
        warn ".env already exists. Backing up to .env.backup"
        cp "$ENV_FILE" "$ENV_FILE.backup"
    fi
    
    if [ -f ".env.production" ]; then
        cp .env.production "$ENV_FILE"
        info "Copied .env.production to .env"
    else
        error ".env.production template not found!"
    fi
    
    # Generate JWT secret
    JWT_SECRET=$(openssl rand -hex 32)
    info "Generated JWT secret"
    
    # Generate passwords
    POSTGRES_PASSWORD=$(openssl rand -hex 16)
    REDIS_PASSWORD=$(openssl rand -hex 16)
    info "Generated database passwords"
    
    # Replace placeholders in .env
    sed -i "s/CHANGE_ME_MINIMUM_32_CHARACTERS_RANDOM_STRING_HERE_USE_OPENSSL_RAND_HEX_32/$JWT_SECRET/" "$ENV_FILE"
    sed -i "s/CHANGE_ME_STRONG_PASSWORD_HERE/$POSTGRES_PASSWORD/" "$ENV_FILE"
    sed -i "s/CHANGE_ME_REDIS_PASSWORD/$REDIS_PASSWORD/" "$ENV_FILE"
    
    chmod 600 "$ENV_FILE"
    info "Set .env permissions to 600"
    
    echo ""
    info "Setup complete!"
    warn "IMPORTANT: Review and update the following in .env:"
    echo "  - TENANT_FRONTEND_URL"
    echo "  - ADMIN_FRONTEND_URL"
    echo "  - OPENAI_API_KEY (if using AI features)"
    echo "  - ANTHROPIC_API_KEY (if using AI features)"
    echo ""
    echo "Generated credentials saved in: $ENV_FILE"
}

# Build command
cmd_build() {
    check_env
    info "Building Docker images..."
    docker compose -f "$COMPOSE_FILE" build --no-cache
    info "Build complete!"
}

# Up command
cmd_up() {
    check_env
    info "Starting all services..."
    docker compose -f "$COMPOSE_FILE" up -d
    info "Services started!"
    echo ""
    cmd_status
}

# Migrate command
cmd_migrate() {
    check_env
    info "Running database migrations..."
    
    # Wait for services to be healthy
    info "Waiting for services to be ready..."
    sleep 5
    
    docker compose -f "$COMPOSE_FILE" exec backend npx prisma migrate deploy
    info "Migrations complete!"
}

# Logs command
cmd_logs() {
    check_env
    docker compose -f "$COMPOSE_FILE" logs -f backend
}

# Restart command
cmd_restart() {
    check_env
    info "Restarting backend service..."
    docker compose -f "$COMPOSE_FILE" restart backend
    info "Backend restarted!"
}

# Down command
cmd_down() {
    check_env
    warn "Stopping all services..."
    docker compose -f "$COMPOSE_FILE" down
    info "All services stopped!"
}

# Status command
cmd_status() {
    check_env
    echo ""
    info "Service Status:"
    docker compose -f "$COMPOSE_FILE" ps
    echo ""
}

# Health command
cmd_health() {
    check_env
    info "Checking API health..."
    
    BACKEND_PORT=$(grep "^BACKEND_PORT=" "$ENV_FILE" | cut -d '=' -f2 || echo "3000")
    
    if curl -s -f "http://localhost:${BACKEND_PORT}/api/health" > /dev/null 2>&1; then
        info "✓ Backend is healthy!"
        curl -s "http://localhost:${BACKEND_PORT}/api/health" | jq . || cat
    else
        error "Backend health check failed!"
    fi
}

# Main command dispatcher
case "${1:-}" in
    setup)
        cmd_setup
        ;;
    build)
        cmd_build
        ;;
    up)
        cmd_up
        ;;
    migrate)
        cmd_migrate
        ;;
    logs)
        cmd_logs
        ;;
    restart)
        cmd_restart
        ;;
    down)
        cmd_down
        ;;
    status)
        cmd_status
        ;;
    health)
        cmd_health
        ;;
    *)
        echo "NeureCore Backend Deployment Script"
        echo ""
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  setup     - Initial setup (copy env, generate secrets)"
        echo "  build     - Build Docker images"
        echo "  up        - Start all services"
        echo "  migrate   - Run database migrations"
        echo "  logs      - Show logs (follow mode)"
        echo "  restart   - Restart backend service"
        echo "  down      - Stop all services"
        echo "  status    - Show service status"
        echo "  health    - Check API health endpoint"
        echo ""
        echo "Example workflow:"
        echo "  $0 setup"
        echo "  $0 build"
        echo "  $0 up"
        echo "  $0 migrate"
        echo "  $0 health"
        exit 1
        ;;
esac
