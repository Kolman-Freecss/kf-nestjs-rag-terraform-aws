# Enhanced RAG Service with Multi-Agent Architecture

This enhanced RAG (Retrieval Augmented Generation) service provides a scalable, multi-agent architecture that supports different HuggingFace model types with various API patterns.

## Architecture Overview

### 🏗️ Core Components

1. **Model Factory Pattern** - Abstracts different HuggingFace model types
2. **Multi-Agent System** - Specialized agents for different RAG tasks
3. **Configuration System** - Environment-based configuration management
4. **Orchestrator** - Coordinates multi-agent workflows

### 📊 Supported Model Types

#### Similarity Models
- **ibm-granite/granite-embedding-english-r2**
- **google/embeddinggemma-300m**
- API Pattern: `/pipeline/sentence-similarity`
- Input: `{ inputs: { source_sentence: string, sentences: string[] } }`

#### Text Generation Models
- **gpt2**
- **microsoft/DialoGPT-medium**
- API Pattern: `/models/{model-name}`
- Input: `{ inputs: string, parameters: {...} }`

#### Embedding Models
- **sentence-transformers/all-MiniLM-L6-v2**
- API Pattern: `/models/{model-name}` (feature extraction)
- Input: `{ inputs: string }`

#### Masked Language Models
- **distilbert/distilbert-base-uncased**
- API Pattern: `/models/{model-name}` (fill-mask)
- Input: `{ inputs: string }` (with [MASK] tokens)

## 🤖 Agent Types

### SimilarityAgent
- **Purpose**: Calculate text similarity and rank documents
- **Capabilities**: 
  - Sentence similarity calculation
  - Document ranking
  - Hybrid ranking (semantic + lexical)
- **Models**: Uses similarity models (granite, embeddinggemma)

### GenerationAgent
- **Purpose**: Generate text responses using language models
- **Capabilities**:
  - Text generation with context
  - Response verification
  - Multi-candidate generation
- **Models**: Uses text generation models (gpt2, DialoGPT)

### EmbeddingAgent (Future)
- **Purpose**: Generate embeddings for semantic search
- **Capabilities**: Text embedding, batch processing
- **Models**: Uses embedding models (sentence-transformers)

## 🔧 Configuration

### Environment Profiles

```typescript
// Development - Fast, minimal verification
RAG_CONFIG_PROFILES.development

// Production - Robust, full verification
RAG_CONFIG_PROFILES.production

// Fast - Quick responses, minimal processing
RAG_CONFIG_PROFILES.fast

// Accurate - Maximum quality, full processing
RAG_CONFIG_PROFILES.accurate
```

### Model Configuration

```typescript
{
  models: {
    primary: {
      [ModelType.SIMILARITY]: ['ibm-granite/granite-embedding-english-r2'],
      [ModelType.TEXT_GENERATION]: ['gpt2'],
      // ...
    },
    fallback: {
      [ModelType.SIMILARITY]: ['google/embeddinggemma-300m'],
      // ...
    }
  }
}
```

## 🚀 Usage Examples

### Basic Query
```typescript
const ragService = new RagService(configService, blizzardService, modelFactory);
const response = await ragService.query("What is the best class for PvP?");
```

### Health Check
```typescript
const health = await ragService.getSystemHealth();
console.log(health.status); // 'healthy' | 'degraded' | 'unhealthy'
```

### Model Testing
```typescript
// Test similarity models
const similarityResults = await ragService.testSimilarityModels(
  "Hello world",
  ["Hello world", "Goodbye world", "How are you?"]
);

// Test generation models
const generationResults = await ragService.testGenerationModels(
  "The capital of France is"
);
```

### Configuration Info
```typescript
const config = ragService.getConfiguration();
console.log(config.models.primary); // List of primary models
console.log(config.agents); // List of enabled agents
```

## 🔄 Workflow

### Enhanced RAG Workflow

1. **Document Retrieval**: Vector similarity search in knowledge base
2. **Document Reranking**: Hybrid semantic + lexical ranking using SimilarityAgent
3. **Context Enrichment**: Add Blizzard API data if relevant
4. **Response Generation**: Generate response using GenerationAgent
5. **Verification**: Verify response quality and accuracy (optional)
6. **Fallback**: Use legacy approach if agents fail

### Legacy Compatibility

The service maintains backward compatibility with the original implementation:
- Falls back to legacy approach if agents are unavailable
- Preserves existing API interface
- Maintains same response format

## 🛠️ Extensibility

### Adding New Models

1. Register model in `ModelRegistry`:
```typescript
ModelRegistry.registerModel({
  modelName: 'new-model',
  modelType: ModelType.TEXT_GENERATION,
  pipelineType: PipelineType.TEXT_GENERATION,
  endpoint: 'https://api-inference.huggingface.co/models/new-model',
  // ...
});
```

2. Update configuration:
```typescript
const config = {
  models: {
    primary: {
      [ModelType.TEXT_GENERATION]: ['new-model'],
    }
  }
};
```

### Adding New Agents

1. Implement agent interface:
```typescript
class CustomAgent extends BaseAgentImpl implements CustomAgentInterface {
  // Implementation
}
```

2. Register with orchestrator:
```typescript
orchestrator.registerAgent(new CustomAgent(config, modelFactory));
```

## 🔍 Monitoring & Debugging

### Health Monitoring
- System health endpoint shows agent and model status
- Individual model health checks
- Vector store status monitoring

### Performance Metrics
- Response times per model
- Success/failure rates
- Agent execution statistics

### Development Mode
- Detailed logging
- Response metadata (model used, confidence scores)
- Verification results

## 🚨 Error Handling

### Graceful Degradation
1. **Agent Failure**: Falls back to legacy approach
2. **Model Failure**: Uses fallback models
3. **Complete Failure**: Returns helpful error message

### Retry Logic
- Exponential backoff for failed requests
- Model-level retry configuration
- Agent-level retry configuration

## 🔐 Security Considerations

- API keys managed through configuration service
- Input validation at multiple levels
- Rate limiting and timeout protection
- Secure error handling (no sensitive data in errors)

## 📈 Performance Optimizations

- **Model Client Caching**: Reuse model clients across requests
- **Health Check Caching**: Cache model health status
- **Batch Processing**: Support for batch operations
- **Async Operations**: Non-blocking agent execution

## 🧪 Testing

The service includes comprehensive testing capabilities:
- Model-specific testing endpoints
- Agent health verification
- End-to-end workflow testing
- Performance benchmarking

This architecture provides a solid foundation for scaling RAG operations across different model types while maintaining reliability and performance.