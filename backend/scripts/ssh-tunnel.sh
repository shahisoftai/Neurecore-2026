#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# SSH Tunnel Manager for Contabo PostgreSQL + Redis
# Usage: ./scripts/ssh-tunnel.sh [start|stop|status]
# ═══════════════════════════════════════════════════════════════════════════

TUNNEL_PID_FILE="/tmp/neurecore_tunnel.pid"
SSH_HOST="contabo"
LOCAL_PG_PORT="15433"
LOCAL_REDIS_PORT="16380"
REMOTE_PG_PORT="5432"
REMOTE_REDIS_PORT="6379"

start_tunnel() {
    # Check if tunnel already running
    if [ -f "$TUNNEL_PID_FILE" ]; then
        OLD_PID=$(cat "$TUNNEL_PID_FILE")
        if kill -0 "$OLD_PID" 2>/dev/null; then
            echo "Tunnel already running with PID $OLD_PID"
            return 0
        else
            echo "Stale PID file found, cleaning up..."
            rm -f "$TUNNEL_PID_FILE"
        fi
    fi
    
    echo "Starting SSH tunnel to Contabo..."
    
    # PostgreSQL tunnel: localhost:15433 -> remote:5432
    # Redis tunnel: localhost:16380 -> remote:6379
    # -f: background, -N: no exec, -o: options
    
    ssh -f -N \
        -L "${LOCAL_PG_PORT}:127.0.0.1:${REMOTE_PG_PORT}" \
        -L "${LOCAL_REDIS_PORT}:127.0.0.1:${REMOTE_REDIS_PORT}" \
        -o StrictHostKeyChecking=no \
        -o ServerAliveInterval=30 \
        -o ServerAliveCountMax=3 \
        -o TCPKeepAlive=yes \
        "$SSH_HOST"
    
    TUNNEL_PID=$!
    echo $TUNNEL_PID > "$TUNNEL_PID_FILE"
    
    sleep 2
    
    # Verify tunnel is working
    if kill -0 "$TUNNEL_PID" 2>/dev/null; then
        echo "✓ SSH tunnel started successfully (PID: $TUNNEL_PID)"
        echo "  PostgreSQL: localhost:${LOCAL_PG_PORT} -> contabo:${REMOTE_PG_PORT}"
        echo "  Redis:       localhost:${LOCAL_REDIS_PORT} -> contabo:${REMOTE_REDIS_PORT}"
        return 0
    else
        echo "✗ Failed to start tunnel"
        rm -f "$TUNNEL_PID_FILE"
        return 1
    fi
}

stop_tunnel() {
    if [ -f "$TUNNEL_PID_FILE" ]; then
        PID=$(cat "$TUNNEL_PID_FILE")
        if kill -0 "$PID" 2>/dev/null; then
            echo "Stopping SSH tunnel (PID: $PID)..."
            kill "$PID" 2>/dev/null
            sleep 1
            echo "✓ Tunnel stopped"
        else
            echo "Tunnel not running"
        fi
        rm -f "$TUNNEL_PID_FILE"
    else
        echo "No tunnel PID file found"
    fi
}

status() {
    if [ -f "$TUNNEL_PID_FILE" ]; then
        PID=$(cat "$TUNNEL_PID_FILE")
        if kill -0 "$PID" 2>/dev/null; then
            echo "✓ Tunnel running (PID: $PID)"
            return 0
        else
            echo "✗ Tunnel not running (stale PID file)"
            return 1
        fi
    else
        echo "○ Tunnel not running"
        return 1
    fi
}

case "${1:-start}" in
    start)
        start_tunnel
        ;;
    stop)
        stop_tunnel
        ;;
    status)
        status
        ;;
    *)
        echo "Usage: $0 [start|stop|status]"
        exit 1
        ;;
esac
