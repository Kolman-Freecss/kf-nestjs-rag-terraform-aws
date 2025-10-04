# WoW RAG API

NestJS-based API that integrates Blizzard's World of Warcraft API with a RAG (Retrieval Augmented Generation) system powered by DeepSeek AI.

## Features

- **Blizzard WoW API Integration**: Fetch realm, character, and item data
- **RAG System**: Query WoW knowledge using DeepSeek-V3.2-Exp via HuggingFace
- **Vector Store**: FAISS-based knowledge base with custom embeddings
- **CSV Knowledge Base**: Initial data loaded from CSV file
- **Decoupled Architecture**: Clean separation of concerns with interfaces and services

## Tech Stack

- **Framework**: NestJS with TypeScript
- **Package Manager**: pnpm
- **LLM**: DeepSeek-V3.2-Exp (via HuggingFace Inference API)
- **Vector Store**: FAISS with LangChain.js
- **Embeddings**: sentence-transformers/all-MiniLM-L6-v2
- **HTTP Client**: Axios

## Project Structure

```
wow-rag-api/
├── src/
│   ├── blizzard/              # Blizzard API integration
│   │   ├── interfaces/        # DTOs and interfaces
│   │   ├── blizzard.service.ts
│   │   ├── blizzard.controller.ts
│   │   └── blizzard.module.ts
│   ├── rag/                   # RAG system
│   │   ├── interfaces/        # DTOs and interfaces
│   │   ├── embeddings/        # Custom embeddings
│   │   ├── rag.service.ts
│   │   ├── rag.controller.ts
│   │   └── rag.module.ts
│   ├── app.module.ts
│   └── main.ts
├── data/
│   └── initial-knowledge.csv  # Initial WoW knowledge
├── vectorstore/               # Persisted vector embeddings
└── .env                       # Environment variables
```

## Prerequisites

- Node.js 18+
- pnpm 8+
- Blizzard Developer Account
- HuggingFace Account

## Setup

### 1. Create Blizzard API Client

1. Go to [Blizzard Developer Portal](https://develop.battle.net/)
2. Click **"Create Client"** or navigate to **"My Clients"**
3. Fill in the client details:
   - **Client Name**: `wow-rag-api` (or any name)
   - **Redirect URLs**: Not required for this use case (leave blank or use `http://localhost`)
   - Check the box for **"I agree to the API Terms of Service"**
4. Click **"Create Client"**
5. Copy your **Client ID** and **Client Secret** (save them securely)

### 2. Create HuggingFace API Token

1. Go to [HuggingFace Settings](https://huggingface.co/settings/tokens)
2. Click **"New token"**
3. Fill in:
   - **Name**: `wow-rag-api` (or any name)
   - **Type**: Select **"Read"** (sufficient for inference)
4. Click **"Generate token"**
5. Copy your token (it won't be shown again)

### 3. Install Dependencies

```bash
cd wow-rag-api
pnpm install
```

### 4. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
# Blizzard API Configuration
BLIZZARD_CLIENT_ID=your_blizzard_client_id_here
BLIZZARD_CLIENT_SECRET=your_blizzard_client_secret_here
BLIZZARD_REGION=us  # Options: us, eu, kr, tw, cn

# HuggingFace Configuration
HUGGINGFACE_API_KEY=your_huggingface_api_key_here

# Server Configuration
PORT=3000
```

### 5. Customize Knowledge Base (Optional)

Edit `data/initial-knowledge.csv` to add your own WoW knowledge:

```csv
content,topic
"Your WoW knowledge here...",custom
"More information about a specific topic",raids
```

## Running the Application

### Development Mode

```bash
pnpm start:dev
```

The API will be available at `http://localhost:3000`

### Production Mode

```bash
pnpm build
pnpm start:prod
```

## API Endpoints

### Blizzard API

#### Get Realm Data
```http
GET /blizzard/realm/:slug
```
Example: `GET /blizzard/realm/area-52`

#### Get Character Data
```http
GET /blizzard/character/:realm/:name
```
Example: `GET /blizzard/character/area-52/arthas`

#### Search Items
```http
GET /blizzard/items/search?q=thunderfury
```

### RAG System

#### Query WoW Knowledge
```http
POST /rag/query
Content-Type: application/json

{
  "question": "What are the WoW expansions?"
}
```

Response:
```json
{
  "question": "What are the WoW expansions?",
  "answer": "World of Warcraft has multiple expansions including..."
}
```

#### Add Custom Knowledge
```http
POST /rag/documents
Content-Type: application/json

{
  "content": "Mythic+ is a challenging endgame dungeon system...",
  "metadata": {
    "topic": "endgame",
    "difficulty": "mythic"
  }
}
```

Response:
```json
{
  "message": "Document added successfully"
}
```

## How It Works

### RAG Pipeline

1. **Question Received**: User submits a question via `/rag/query`
2. **Vector Search**: System searches the FAISS vector store for relevant knowledge
3. **Blizzard API Integration**: If question contains keywords like "realm", live data is fetched
4. **Context Building**: Combines retrieved documents with live API data
5. **LLM Query**: Sends context + question to DeepSeek-V3.2-Exp
6. **Response**: Returns AI-generated answer based on context

### Vector Store

- **Embeddings Model**: `sentence-transformers/all-MiniLM-L6-v2`
- **Storage**: Persisted in `vectorstore/` directory
- **Initial Load**: Automatically loads from `data/initial-knowledge.csv` on first run
- **Updates**: New documents added via API are persisted automatically

## Development

### Adding New Blizzard API Endpoints

1. Add method in `src/blizzard/blizzard.service.ts`
2. Add route in `src/blizzard/blizzard.controller.ts`
3. Use appropriate namespace: `dynamic-`, `static-`, or `profile-`

### Testing API Calls

Using curl:

```bash
# Get realm data
curl http://localhost:3000/blizzard/realm/area-52

# Query RAG
curl -X POST http://localhost:3000/rag/query \
  -H "Content-Type: application/json" \
  -d '{"question": "What classes can I play?"}'
```

## Troubleshooting

### Blizzard API 401 Unauthorized
- Verify `BLIZZARD_CLIENT_ID` and `BLIZZARD_CLIENT_SECRET` are correct
- Ensure your client is active in the Blizzard Developer Portal
- Check that the region matches your client configuration

### HuggingFace API Errors
- Verify `HUGGINGFACE_API_KEY` is valid
- Check your HuggingFace account has access to the models
- Note: Free tier may have rate limits

### Vector Store Issues
- Delete `vectorstore/` directory to rebuild from scratch
- Ensure `data/initial-knowledge.csv` exists and has valid format
- Check CSV has `content,topic` header row

## Infrastructure

See [TODO.md](wow-rag-api/TODO.md) for AWS infrastructure provisioning with Terraform.

## License

MIT

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes following NestJS best practices
4. Submit a pull request

## Support

For Blizzard API issues: [Blizzard API Forums](https://us.forums.blizzard.com/en/blizzard/c/api-discussion)
For HuggingFace issues: [HuggingFace Forums](https://discuss.huggingface.co/)
