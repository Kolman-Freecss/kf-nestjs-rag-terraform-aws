#!/bin/bash

# LangGraph Studio startup script
# This script starts LangGraph Studio for visualizing and debugging workflows

echo "Starting LangGraph Studio..."

# Check if langgraph is installed globally
if ! command -v langgraph &> /dev/null; then
    echo "LangGraph CLI not found. Installing..."
    pip install langgraph-cli
fi

# Set environment variables
export LANGGRAPH_API_KEY=${LANGGRAPH_API_KEY:-""}
export LANGGRAPH_PROJECT=${LANGGRAPH_PROJECT:-"wow-rag-workflow"}

# Start LangGraph Studio
echo "Starting LangGraph Studio on http://localhost:8123"
echo "Project: $LANGGRAPH_PROJECT"
echo "Press Ctrl+C to stop"

langgraph dev --port 8123 --host localhost


