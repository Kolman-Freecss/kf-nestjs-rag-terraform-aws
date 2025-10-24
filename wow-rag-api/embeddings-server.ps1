# Embeddings Server Management Script for Windows PowerShell

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("start", "stop", "restart", "logs", "status", "build")]
    [string]$Action
)

switch ($Action) {
    "start" {
        Write-Host "Starting embeddings server..."
        docker-compose up -d
        Write-Host "Waiting for server to be ready..."
        Start-Sleep -Seconds 10
        try {
            Invoke-RestMethod -Uri "http://localhost:8000/health" -Method Get
            Write-Host "Server is ready!"
        } catch {
            Write-Host "Server not ready yet"
        }
    }
    "stop" {
        Write-Host "Stopping embeddings server..."
        docker-compose down
    }
    "restart" {
        Write-Host "Restarting embeddings server..."
        docker-compose restart
    }
    "logs" {
        docker-compose logs -f embeddings-server
    }
    "status" {
        docker-compose ps
        try {
            $health = Invoke-RestMethod -Uri "http://localhost:8000/health" -Method Get
            Write-Host "Server is healthy: $($health.status)"
        } catch {
            Write-Host "Server is not responding"
        }
    }
    "build" {
        Write-Host "Building embeddings server..."
        docker-compose build
    }
}
