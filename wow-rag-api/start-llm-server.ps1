# Start the local LLM server using Docker Compose
Write-Host "Starting Local LLM Server (DeepSeek)..." -ForegroundColor Green

# Check if Docker is running
try {
    docker info | Out-Null
} catch {
    Write-Host "Error: Docker is not running. Please start Docker first." -ForegroundColor Red
    exit 1
}

# Start the LLM server
docker-compose up llm-server

Write-Host "LLM Server started on http://localhost:8001" -ForegroundColor Green
Write-Host "Health check: curl http://localhost:8001/health" -ForegroundColor Yellow
