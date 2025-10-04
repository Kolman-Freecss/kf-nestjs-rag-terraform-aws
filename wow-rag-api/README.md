# WoW RAG API

NestJS API integrating Blizzard WoW API with RAG (Retrieval Augmented Generation) capabilities.

## Features

- **Blizzard API Integration**: Fetch WoW realm, character, and item data
- **RAG System**: Query WoW knowledge using DeepSeek-V3.2-Exp via HuggingFace
- **Vector Store**: FAISS-based knowledge base with custom embeddings
- **CSV Knowledge Base**: Initial data loaded from CSV file

## Tech Stack

- NestJS
- LangChain.js (Vector Store)
- DeepSeek-V3.2-Exp (LLM via HuggingFace)
  - Why? High-quality, open-source model fine-tuned for knowledge tasks
- HuggingFace Inference API
  - Why? Access to advanced models without heavy local resources
- FAISS Vector Store
  - Why? Lightweight, easy to set up, and efficient for local use
- Sentence Transformers (Embeddings)
  - Why? Proven performance for semantic search tasks

## Setup

```bash
# Install dependencies
pnpm install

# Configure environment
cp .env.example .env
# Edit .env with your credentials
```

### Required Environment Variables

```env
BLIZZARD_CLIENT_ID=your_blizzard_client_id
BLIZZARD_CLIENT_SECRET=your_blizzard_client_secret
BLIZZARD_REGION=us
HUGGINGFACE_API_KEY=your_huggingface_api_key
PORT=3000
```

Get your HuggingFace API key from: https://huggingface.co/settings/tokens

## Running

```bash
# Development
pnpm start:dev

# Production
pnpm build
pnpm start:prod
```

## API Endpoints

### Blizzard API

- `GET /blizzard/realm/:slug` - Get realm data
- `GET /blizzard/character/:realm/:name` - Get character data
- `GET /blizzard/items/search?q=query` - Search items

### RAG System

- `POST /rag/query` - Ask questions about WoW
  ```json
  { "question": "What are the WoW expansions?" }
  ```

- `POST /rag/documents` - Add custom knowledge
  ```json
  {
    "content": "Custom WoW knowledge...",
    "metadata": { "topic": "custom" }
  }
  ```

## Project Structure

```
src/
├── blizzard/
│   ├── interfaces/        # DTOs and interfaces
│   ├── blizzard.service.ts
│   ├── blizzard.controller.ts
│   └── blizzard.module.ts
├── rag/
│   ├── interfaces/        # DTOs and interfaces
│   ├── rag.service.ts
│   ├── rag.controller.ts
│   └── rag.module.ts
├── app.module.ts
└── main.ts
data/
└── initial-knowledge.csv  # Initial WoW knowledge base
```

## Notes

- Vector store persists in `vectorstore/` directory
- Initial knowledge loaded from `data/initial-knowledge.csv`
- Add custom WoW data by editing the CSV file (format: `content,topic`)
- RAG queries automatically fetch live Blizzard data when relevant
- Uses DeepSeek-V3.2-Exp model via HuggingFace Inference API
- Embeddings generated with sentence-transformers/all-MiniLM-L6-v2
