# Local Embeddings Server

This service provides local embeddings using Docker to avoid depending on external APIs like HuggingFace.

## Features

- **Model**: `all-MiniLM-L6-v2` (compatible with Xenova/all-MiniLM-L6-v2)
- **Port**: 8000
- **REST API**: Simple endpoints for generating embeddings
- **Cache**: Models are cached locally to avoid re-downloads

## Usage

### Start the server

**Windows (PowerShell):**
```powershell
.\embeddings-server.ps1 start
```

**Linux/Mac:**
```bash
./embeddings-server.sh start
```

### Check status

```powershell
.\embeddings-server.ps1 status
```

### View logs

```powershell
.\embeddings-server.ps1 logs
```

### Stop the server

```powershell
.\embeddings-server.ps1 stop
```

## API Endpoints

### Health Check
```
GET http://localhost:8000/health
```

### Generate Embeddings
```
POST http://localhost:8000/embed
Content-Type: application/json

{
  "texts": ["text 1", "text 2", "text 3"]
}
```

**Response:**
```json
{
  "embeddings": [[0.1, 0.2, ...], [0.3, 0.4, ...], ...],
  "model": "all-MiniLM-L6-v2"
}
```

## Configuration

The service is automatically configured to use the `all-MiniLM-L6-v2` model which is compatible with the Xenova model used in the frontend.

## NestJS Integration

The NestJS service is already configured to use this local server when the `local` provider is selected in the embeddings configuration.
