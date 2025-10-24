# WoW RAG API - Local Embeddings Setup

This API now supports local embeddings using Docker to avoid depending on external APIs like HuggingFace.

## 🚀 Quick Start

### 1. Configure Environment Variables

Copy `env.example` to `.env` and configure:

```bash
cp env.example .env
```

Edit `.env` and make sure you have:
```env
EMBEDDINGS_PROVIDER=local
EMBEDDINGS_API_URL=http://localhost:8000
```

### 2. Start the Embeddings Server

**Windows (PowerShell):**
```powershell
.\embeddings-server.ps1 start
```

**Linux/Mac:**
```bash
./embeddings-server.sh start
```

### 3. Start the NestJS API

```bash
pnpm install
pnpm start:dev
```

### 4. Test the Integration

```bash
node test-embeddings.js
```

## 📁 File Structure

```
wow-rag-api/
├── embeddings-server/          # Docker server for embeddings
│   ├── app.py                 # Flask server
│   ├── requirements.txt       # Python dependencies
│   ├── Dockerfile            # Docker image
│   └── README.md             # Server documentation
├── docker-compose.yml         # Docker Compose configuration
├── embeddings-server.ps1      # PowerShell script for Windows
├── embeddings-server.sh       # Bash script for Linux/Mac
├── test-embeddings.js        # Test script
└── src/rag/embeddings/       # TypeScript implementation
    ├── local.embeddings.ts   # Client for local embeddings
    ├── huggingface.embeddings.ts
    ├── embeddings.factory.ts
    └── embeddings.interface.ts
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default Value |
|----------|-------------|---------------|
| `EMBEDDINGS_PROVIDER` | Embeddings provider (`local` or `huggingface`) | `local` |
| `EMBEDDINGS_API_URL` | URL of the local embeddings server | `http://localhost:8000` |
| `HUGGINGFACE_API_KEY` | HuggingFace API key (only if using `huggingface`) | - |

### Switching Between Providers

To use local embeddings (recommended):
```env
EMBEDDINGS_PROVIDER=local
EMBEDDINGS_API_URL=http://localhost:8000
```

To use HuggingFace (requires API key):
```env
EMBEDDINGS_PROVIDER=huggingface
HUGGINGFACE_API_KEY=your_api_key_here
```

## 🐳 Docker

### Useful Commands

```bash
# Start embeddings server
docker-compose up -d

# View logs
docker-compose logs -f embeddings-server

# Stop server
docker-compose down

# Rebuild image
docker-compose build
```

### Volumes

The Docker server mounts a volume to cache models and avoid re-downloads:
- `embeddings_cache:/root/.cache/torch/sentence_transformers`

## 🧪 Testing

### Test Embeddings Server

```bash
# Health check
curl http://localhost:8000/health

# Generate embeddings
curl -X POST http://localhost:8000/embed \
  -H "Content-Type: application/json" \
  -d '{"texts": ["Hello world", "Test text"]}'
```

### Test NestJS API

```bash
# Health check
curl http://localhost:3000/health

# RAG query
curl -X POST http://localhost:3000/rag/query \
  -H "Content-Type: application/json" \
  -d '{"query": "What is World of Warcraft?", "maxDocuments": 3}'
```

## 🔍 Monitoring

### Embeddings Server Logs

```bash
docker-compose logs -f embeddings-server
```

### RAG Debug

```bash
curl -X POST http://localhost:3000/rag/debug \
  -H "Content-Type: application/json" \
  -d '{"query": "test query"}'
```

## 🚨 Troubleshooting

### Embeddings server not responding

1. Verify Docker is running
2. Verify port 8000 is free
3. Check logs: `docker-compose logs embeddings-server`

### Connection error in NestJS

1. Verify `EMBEDDINGS_PROVIDER=local`
2. Verify `EMBEDDINGS_API_URL=http://localhost:8000`
3. Verify embeddings server is running

### Model not loading

The model downloads automatically on first use. If it fails:
1. Verify internet connection
2. Check container logs
3. Rebuild image: `docker-compose build`

## 📊 Performance

- **Model**: `all-MiniLM-L6-v2` (384 dimensions)
- **Load time**: ~30 seconds on first run
- **Memory**: ~500MB RAM
- **Latency**: ~50-100ms per text batch

## 🔄 Migration from HuggingFace

If you already have HuggingFace configured:

1. Change `EMBEDDINGS_PROVIDER` from `huggingface` to `local`
2. Start the Docker server
3. Restart NestJS
4. Done! No code changes needed
