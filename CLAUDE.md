# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

WoW RAG API: A NestJS-based REST API that combines Blizzard's World of Warcraft API with a RAG (Retrieval Augmented Generation) system powered by DeepSeek AI via HuggingFace.

**Working Directory**: Always operate in `wow-rag-api/` subdirectory (not the root).

## Essential Commands

```bash
# Development
cd wow-rag-api
pnpm install              # Install dependencies
pnpm start:dev           # Run in watch mode (http://localhost:3000)

# Production
pnpm build               # Compile TypeScript
pnpm start:prod          # Run production build

# Testing API
curl http://localhost:3000/blizzard/realm/area-52
curl -X POST http://localhost:3000/rag/query \
  -H "Content-Type: application/json" \
  -d '{"question": "What are WoW expansions?"}'
```

## Architecture

### Two-Module System

1. **Blizzard Module** (`src/blizzard/`)
   - Handles OAuth 2.0 client credentials flow with Blizzard API
   - Token caching with auto-refresh (expires 1 min before actual expiry)
   - Region-aware endpoints (CN uses `gateway.battlenet.com.cn`, others use `{region}.battle.net`)
   - Three namespace types:
     - `dynamic-{region}`: Real-time data (realms)
     - `profile-{region}`: Character profiles
     - `static-{region}`: Static data (items)

2. **RAG Module** (`src/rag/`)
   - Uses **MemoryVectorStore** (in-memory, no persistence - restarts from CSV on each boot)
   - Embeddings via HuggingFace Inference API (`sentence-transformers/all-MiniLM-L6-v2`)
   - LLM queries sent to DeepSeek-V3.2-Exp via HuggingFace
   - Keyword detection for live Blizzard API integration (e.g., "realm" triggers API call)

### Key Design Patterns

**Dependency Injection**: All modules use NestJS DI. Services injected via constructor.

**Interface Segregation**: DTOs and interfaces separated in `interfaces/` subdirectories within each module.

**Configuration**: Global `ConfigModule` provides environment variables to all modules.

**CSV-Driven Knowledge Base**: `data/initial-knowledge.csv` loaded on startup with format:
```csv
content,topic
"Knowledge text here",topic_name
```

## Critical Implementation Details

### Blizzard API OAuth Flow
```typescript
// Token cached in-memory with expiry tracking
private accessToken: string | null = null;
private tokenExpiry: number = 0;

// CN region special case
private getOAuthRegion(region: string): string {
  return region === 'cn' ? 'gateway.battlenet.com.cn' : `${region}.battle.net`;
}
```

### RAG Query Pipeline
1. User submits question → `RagController.query()`
2. Vector similarity search retrieves top 3 relevant docs
3. Keyword detection checks for "realm" to fetch live Blizzard data
4. Context built from: retrieved docs + optional Blizzard API response
5. Prompt sent to DeepSeek-V3.2-Exp via HuggingFace Inference API
6. Generated answer returned to user

### Vector Store Limitations
**Important**: Using `MemoryVectorStore` means:
- No persistence between restarts
- Always rebuilds from CSV on startup
- `addDocument()` changes are lost on restart
- Consider migrating to FAISS/HNSW for production (requires native compilation)

## Environment Configuration

Required `.env` variables (create from `.env.example`):
```env
BLIZZARD_CLIENT_ID=         # From develop.battle.net
BLIZZARD_CLIENT_SECRET=     # From develop.battle.net
BLIZZARD_REGION=us          # us, eu, kr, tw, cn
HUGGINGFACE_API_KEY=        # From huggingface.co/settings/tokens
PORT=3000
```

## Adding New Functionality

### New Blizzard API Endpoint
1. Add method in `src/blizzard/blizzard.service.ts` (use correct namespace)
2. Add route in `src/blizzard/blizzard.controller.ts`
3. Export interface types in `src/blizzard/interfaces/`

### Expanding RAG Knowledge
- Edit `data/initial-knowledge.csv` (requires app restart)
- Or use `POST /rag/documents` (temporary until restart)

### Keyword-Based API Integration
Modify `RagService.query()` around line 120:
```typescript
// Add new keyword detection
if (question.toLowerCase().includes('character')) {
  const match = question.match(/character\s+(\w+)/i);
  // Fetch from Blizzard API
}
```

## Common Pitfalls

1. **Working Directory**: Commands must run in `wow-rag-api/`, not repo root
2. **Package Manager**: Use `pnpm`, not `npm` or `yarn`
3. **Native Dependencies**: `faiss-node` and `hnswlib-node` require compilation - that's why we use `MemoryVectorStore`
4. **API Keys**: HuggingFace key must have "Read" permissions for Inference API
5. **Blizzard Regions**: China (CN) has different OAuth endpoint
6. **Vector Store**: Changes via `/rag/documents` are ephemeral (memory-only)

## Code Style

- All code in English (comments, variables, documentation)
- Interfaces in separate files under `interfaces/` directories
- Use JSDoc comments for public methods
- DTOs as TypeScript interfaces (not classes)
- Error logging via NestJS Logger, not console.log
