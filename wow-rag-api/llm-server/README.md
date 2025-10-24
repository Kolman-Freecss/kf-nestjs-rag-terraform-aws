# Local LLM Server

This directory contains a FastAPI-based local LLM server that provides OpenAI-compatible endpoints for running DeepSeek models locally using Docker.

## Features

- **OpenAI-compatible API**: Uses the same `/v1/chat/completions` endpoint format
- **DeepSeek Model**: Uses `deepseek-ai/deepseek-coder-6.7b-instruct` by default
- **GPU Support**: Automatically detects and uses CUDA if available
- **Docker Ready**: Complete Docker setup with health checks
- **Memory Efficient**: Uses appropriate precision based on hardware

## Quick Start

### Using Docker Compose (Recommended)

The LLM server is already configured in the main `docker-compose.yml`:

```bash
# Start the LLM server
docker-compose up llm-server

# Or start all services including embeddings
docker-compose up
```

### Manual Docker Build

```bash
# Build the image
docker build -t local-llm-server .

# Run the container
docker run -p 8001:8001 \
  -e MODEL_NAME=deepseek-ai/deepseek-coder-6.7b-instruct \
  -v llm_cache:/root/.cache/huggingface \
  local-llm-server
```

## Configuration

### Environment Variables

- `MODEL_NAME`: HuggingFace model name (default: `deepseek-ai/deepseek-coder-6.7b-instruct`)
- `PORT`: Server port (default: `8001`)

### Model Options

You can use different DeepSeek models by changing the `MODEL_NAME`:

- `deepseek-ai/deepseek-coder-6.7b-instruct` (default, good balance)
- `deepseek-ai/deepseek-coder-1.3b-instruct` (smaller, faster)
- `deepseek-ai/deepseek-coder-33b-instruct` (larger, more capable)

## API Usage

The server provides OpenAI-compatible endpoints:

### Chat Completions

```bash
curl -X POST http://localhost:8001/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "Hello, how are you?"}
    ],
    "temperature": 0.7,
    "max_tokens": 1000
  }'
```

### Health Check

```bash
curl http://localhost:8001/health
```

### List Models

```bash
curl http://localhost:8001/models
```

## Integration with NestJS

The RAG agent automatically detects when the local LLM server is available and uses it as a fallback when OpenAI API key is not configured.

## Performance Notes

- **First Request**: May take 30-60 seconds to load the model
- **Memory Usage**: ~6GB RAM for 6.7B model, ~2GB for 1.3B model
- **GPU**: Significantly faster with CUDA-compatible GPU
- **Caching**: Models are cached in Docker volume to avoid re-downloading

## Troubleshooting

### Out of Memory
- Use a smaller model: `MODEL_NAME=deepseek-ai/deepseek-coder-1.3b-instruct`
- Increase Docker memory limits
- Use CPU-only mode (slower but uses less memory)

### Slow Performance
- Ensure CUDA is available: `docker run --gpus all ...`
- Use a smaller model for faster inference
- Reduce `max_tokens` in requests

### Model Loading Issues
- Check internet connection for model download
- Verify HuggingFace model name is correct
- Check Docker logs: `docker-compose logs llm-server`
