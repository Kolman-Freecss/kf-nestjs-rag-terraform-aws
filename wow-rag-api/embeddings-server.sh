#!/bin/bash

# Embeddings Server Management Script

case "$1" in
    start)
        echo "Starting embeddings server..."
        docker-compose up -d
        echo "Waiting for server to be ready..."
        sleep 10
        curl -f http://localhost:8000/health || echo "Server not ready yet"
        ;;
    stop)
        echo "Stopping embeddings server..."
        docker-compose down
        ;;
    restart)
        echo "Restarting embeddings server..."
        docker-compose restart
        ;;
    logs)
        docker-compose logs -f embeddings-server
        ;;
    status)
        docker-compose ps
        curl -f http://localhost:8000/health && echo "Server is healthy" || echo "Server is not responding"
        ;;
    build)
        echo "Building embeddings server..."
        docker-compose build
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|logs|status|build}"
        echo ""
        echo "Commands:"
        echo "  start   - Start the embeddings server"
        echo "  stop    - Stop the embeddings server"
        echo "  restart - Restart the embeddings server"
        echo "  logs    - Show server logs"
        echo "  status  - Check server status"
        echo "  build   - Build the Docker image"
        exit 1
        ;;
esac
