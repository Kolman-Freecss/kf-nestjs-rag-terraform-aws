# AGENTS.md - WoW RAG API

## Commands
- **Build**: `pnpm build`
- **Start Dev**: `pnpm start:dev` (watches files, shows debug logs with token usage)
- **Start Prod**: `pnpm start:prod`
- **Debug RAG**: `POST /rag/debug` endpoint shows retrieved documents (see MONITORING.md)
- **Context tuning**: See CONTEXT_STRATEGY.md for adjusting doc counts and token limits
- **No test suite**: Project has no test framework configured

## Architecture
- **NestJS** REST API with TypeScript targeting ES2024
- **Two main modules**:
  - `src/blizzard/`: Blizzard API integration (OAuth, realm/character/item endpoints)
  - `src/rag/`: RAG service using LangChain, HuggingFace embeddings, vector store (MemoryVectorStore)
- **Data**: `data/initial-knowledge.csv` contains knowledge base loaded on startup
- **Config**: Environment variables via `@nestjs/config` (see `.env.example`)
- **CORS**: Enabled for `http://localhost:4200` (Angular frontend)

## Code Style
- **Imports**: Use `@nestjs/*` decorators, `type` imports where appropriate
- **Naming**: camelCase for variables/methods, PascalCase for classes/interfaces
- **Services**: Injectable classes with Logger, constructor-based dependency injection
- **Types**: Strict null checks enabled, use interfaces in `interfaces/` subdirectories
- **Error Handling**: Try-catch blocks, logger warnings/errors, throw Error with descriptive messages
- **Comments**: Only when code is complex (e.g., RAG verification, reranking logic)
- **Domain-agnostic**: Avoid hardcoded domain-specific values; use metadata and generic patterns
