# LangGraph Workflow Test Script for Windows
# This script tests the LangGraph workflow implementation

Write-Host "🚀 Starting LangGraph Workflow Test..." -ForegroundColor Green
Write-Host ""

try {
    # Check if Node.js is available
    if (!(Get-Command node -ErrorAction SilentlyContinue)) {
        Write-Host "❌ Node.js not found. Please install Node.js first." -ForegroundColor Red
        exit 1
    }

    # Check if pnpm is available
    if (!(Get-Command pnpm -ErrorAction SilentlyContinue)) {
        Write-Host "❌ pnpm not found. Please install pnpm first." -ForegroundColor Red
        exit 1
    }

    # Build the project first
    Write-Host "🔨 Building project..." -ForegroundColor Yellow
    pnpm build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Build failed" -ForegroundColor Red
        exit 1
    }

    # Run the test
    Write-Host "🧪 Running LangGraph workflow test..." -ForegroundColor Yellow
    node test-langgraph-workflow.js

    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Test completed successfully!" -ForegroundColor Green
    } else {
        Write-Host "❌ Test failed" -ForegroundColor Red
        exit 1
    }

} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🎉 LangGraph Workflow Test Finished!" -ForegroundColor Cyan


