#!/bin/bash

# LangGraph Workflow Test Script for Linux/Mac
# This script tests the LangGraph workflow implementation

echo "🚀 Starting LangGraph Workflow Test..."
echo ""

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js first."
    exit 1
fi

# Check if pnpm is available
if ! command -v pnpm &> /dev/null; then
    echo "❌ pnpm not found. Please install pnpm first."
    exit 1
fi

# Build the project first
echo "🔨 Building project..."
pnpm build
if [ $? -ne 0 ]; then
    echo "❌ Build failed"
    exit 1
fi

# Run the test
echo "🧪 Running LangGraph workflow test..."
node test-langgraph-workflow.js

if [ $? -eq 0 ]; then
    echo "✅ Test completed successfully!"
else
    echo "❌ Test failed"
    exit 1
fi

echo ""
echo "🎉 LangGraph Workflow Test Finished!"


