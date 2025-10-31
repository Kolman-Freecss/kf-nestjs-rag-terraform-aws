# LangGraph Studio startup script for Windows
# This script starts LangGraph Studio for visualizing and debugging workflows

Write-Host "Starting LangGraph Studio..." -ForegroundColor Green

# Check if langgraph is installed globally
try {
    $null = Get-Command langgraph -ErrorAction Stop
    Write-Host "LangGraph CLI found" -ForegroundColor Green
} catch {
    Write-Host "LangGraph CLI not found. Installing..." -ForegroundColor Yellow
    pip install langgraph-cli
}

# Set environment variables
$env:LANGGRAPH_API_KEY = if ($env:LANGGRAPH_API_KEY) { $env:LANGGRAPH_API_KEY } else { "" }
$env:LANGGRAPH_PROJECT = if ($env:LANGGRAPH_PROJECT) { $env:LANGGRAPH_PROJECT } else { "wow-rag-workflow" }

# Start LangGraph Studio
Write-Host "Starting LangGraph Studio on http://localhost:8123" -ForegroundColor Cyan
Write-Host "Project: $env:LANGGRAPH_PROJECT" -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop" -ForegroundColor Yellow

langgraph dev --port 8123 --host localhost


