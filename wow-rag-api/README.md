# WoW RAG API

A NestJS REST API that provides intelligent question-answering about World of Warcraft using RAG (Retrieval-Augmented Generation) with local embeddings.

## 🚀 Quick Start

```bash
# Install dependencies
pnpm install

# Start development server
pnpm start:dev
```

## 🛠️ Tech Stack

- **Framework**: NestJS (Node.js)
- **Language**: TypeScript
- **RAG**: LangChain + Local Embeddings (Docker)
- **Vector Store**: MemoryVectorStore
- **AI Agent**: LangChain Agents with Tools
- **External APIs**: Blizzard API (OAuth)
- **Monitoring**: LangSmith (optional)

## 📋 Prerequisites

- Node.js 18+
- Docker (for local embeddings)
- Blizzard API credentials

## 🔧 Configuration

Copy `env.example` to `.env` and configure:

```env
EMBEDDINGS_PROVIDER=local
EMBEDDINGS_API_URL=http://localhost:8000
BLIZZARD_CLIENT_ID=your_client_id
BLIZZARD_CLIENT_SECRET=your_client_secret
```

## 🐳 Local Embeddings

Start the embeddings server:

```bash
# Windows
.\embeddings-server.ps1 start

# Linux/Mac
./embeddings-server.sh start
```

## 📚 Documentation

- **Local Embeddings**: `_docs/local-embeddings.md`
- **Agent System**: `AGENTS.md`
- **Environment Setup**: `env.example`

## 🧪 Testing

```bash
# Test embeddings integration
node test-embeddings.js

# Test RAG endpoint
curl -X POST http://localhost:3000/rag/query \
  -H "Content-Type: application/json" \
  -d '{"query": "What is World of Warcraft?"}'
```
