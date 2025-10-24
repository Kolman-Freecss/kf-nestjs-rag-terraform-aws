#!/bin/bash

# Start the local LLM server using Docker Compose
echo "Starting Local LLM Server (DeepSeek)..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "Error: Docker is not running. Please start Docker first."
    exit 1
fi

# Start the LLM server
docker-compose up llm-server

echo "LLM Server started on http://localhost:8001"
echo "Health check: curl http://localhost:8001/health"
