# WoW RAG API

A NestJS REST API that provides intelligent question-answering about World of Warcraft using RAG (Retrieval-Augmented Generation) with local embeddings and **local LLM support**.

## 🚀 Quick Start

```bash
# Install dependencies
pnpm install

# Start local services (embeddings + LLM)
docker-compose up -d

# Start development server
pnpm start:dev
```

## 🛠️ Tech Stack

- **Framework**: NestJS (Node.js)
- **Language**: TypeScript
- **RAG**: LangChain + Local Embeddings (Docker)
- **LLM**: OpenAI GPT-3.5-turbo OR Local DeepSeek (Docker)
- **Vector Store**: MemoryVectorStore
- **AI Agent**: LangChain Agents with Tools
- **External APIs**: Blizzard API (OAuth)
- **Monitoring**: LangSmith (optional)

## 📋 Prerequisites

- Node.js 18+
- Docker (for local embeddings and LLM)
- Blizzard API credentials
- **Optional**: OpenAI API key (for hybrid mode)

## 🔧 Configuration

Create a `.env` file in the `wow-rag-api` directory with the following variables:

### Required Environment Variables

#### Blizzard API Configuration
```env
BLIZZARD_CLIENT_ID=your_blizzard_client_id
BLIZZARD_CLIENT_SECRET=your_blizzard_client_secret
```

#### OpenAI Configuration (Optional)
```env
# Only needed if you want to use OpenAI instead of local LLM
OPENAI_API_KEY=your_openai_api_key_here
```

#### Local LLM Configuration (DeepSeek)
```env
# Base URL for the local LLM server
LOCAL_LLM_BASE_URL=http://localhost:8001

# API key (usually not needed for local server)
LOCAL_LLM_API_KEY=

# Model name (should match the model running in Docker)
LOCAL_LLM_MODEL=deepseek-coder

# Generation parameters
LOCAL_LLM_TEMPERATURE=0.7
LOCAL_LLM_MAX_TOKENS=1000
```

#### Embeddings Configuration
```env
# Use local embeddings server
EMBEDDINGS_TYPE=local
EMBEDDINGS_BASE_URL=http://localhost:8000
EMBEDDINGS_MODEL_NAME=all-MiniLM-L6-v2
```

#### Application Configuration
```env
PORT=3000
NODE_ENV=development
```

### Usage Modes

#### 1. **Local LLM Only** (Recommended for Free Usage)
- Don't set `OPENAI_API_KEY`
- Start the local LLM server: `docker-compose up llm-server`
- The system will automatically use DeepSeek model

#### 2. **OpenAI Only**
- Set `OPENAI_API_KEY`
- Don't start the local LLM server
- Uses OpenAI GPT-3.5-turbo

#### 3. **Hybrid Mode** (Recommended)
- Set `OPENAI_API_KEY`
- Start the local LLM server
- Uses OpenAI first, falls back to local LLM if OpenAI fails

### Model Options

You can change the DeepSeek model by modifying the `MODEL_NAME` in `docker-compose.yml`:

- `deepseek-ai/deepseek-coder-1.3b-instruct` - Smaller, faster (2GB RAM)
- `deepseek-ai/deepseek-coder-6.7b-instruct` - Default, balanced (6GB RAM)
- `deepseek-ai/deepseek-coder-33b-instruct` - Larger, more capable (16GB+ RAM)

## 🐳 Docker Services

The system includes two Docker services:

### LLM Server (Port 8001)
- Runs DeepSeek model locally
- Provides OpenAI-compatible API
- Memory: ~6GB for 6.7B model

### Embeddings Server (Port 8000)
- Runs sentence-transformers locally
- Provides embeddings for RAG
- Memory: ~1GB

### Starting the Services

```bash
# Start all services
docker-compose up

# Start only LLM server
docker-compose up llm-server

# Start only embeddings server
docker-compose up embeddings-server

# Start in background
docker-compose up -d
```

## 🤖 LLM Modes

### 1. **Local LLM Only** (Free!)
- No OpenAI API key needed
- Uses DeepSeek model locally
- ~6GB RAM for 6.7B model

### 2. **OpenAI Only**
- Requires OpenAI API key
- Uses GPT-3.5-turbo
- No local resources needed

### 3. **Hybrid Mode** (Recommended)
- Uses OpenAI first, falls back to local LLM
- Best of both worlds
- Automatic failover

### Quick Start Scripts
```bash
# Windows
.\start-llm-server.ps1

# Linux/Mac
./start-llm-server.sh
```

## 📚 Documentation

- **Local Embeddings**: `_docs/local-embeddings.md`
- **Local LLM**: `llm-server/README.md`
- **Agent System**: `AGENTS.md`

## 🧪 Testing

```bash
# Test embeddings integration
node test-embeddings.js

# Test local LLM server
node test-local-llm.js

# Test RAG endpoint
curl -X POST http://localhost:3000/rag/query \
  -H "Content-Type: application/json" \
  -d '{"query": "What is World of Warcraft?"}'

# Test local LLM health
curl http://localhost:8001/health
```

## 🔧 Troubleshooting

### Out of Memory
- Use smaller model: `MODEL_NAME=deepseek-ai/deepseek-coder-1.3b-instruct`
- Increase Docker memory limits
- Close other applications

### Slow Performance
- Ensure GPU is available: `docker run --gpus all ...`
- Use smaller model
- Reduce `LOCAL_LLM_MAX_TOKENS`

### Connection Issues
- Check if services are running: `docker-compose ps`
- Check logs: `docker-compose logs llm-server`
- Verify ports are not blocked

## 🎯 Features

- **Free Local LLM**: DeepSeek model running locally
- **Hybrid Mode**: OpenAI + Local LLM fallback
- **RAG System**: Knowledge base + live Blizzard API
- **LangChain Agents**: Tool-calling AI agents
- **Local Embeddings**: No external API calls
- **Docker Ready**: One-command setup

## 🔍 API Endpoints

- `POST /rag/query` - Main RAG query endpoint
- `POST /rag/debug` - Debug retrieved documents
- `GET /blizzard/realms` - List WoW realms
- `GET /blizzard/realm/{slug}` - Get realm details
- `GET /blizzard/character/{realm}/{name}` - Get character info
