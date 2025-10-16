import { ModelRegistryEntry, ModelType, PipelineType } from '../interfaces/model.interfaces';

/**
 * Registry of supported HuggingFace models with their configurations
 */
export class ModelRegistry {
  private static readonly models: Map<string, ModelRegistryEntry> = new Map([
    // Embedding/Similarity Models
    [
      'ibm-granite/granite-embedding-english-r2',
      {
        modelName: 'ibm-granite/granite-embedding-english-r2',
        modelType: ModelType.SIMILARITY,
        pipelineType: PipelineType.SENTENCE_SIMILARITY,
        endpoint: 'https://router.huggingface.co/hf-inference/models/ibm-granite/granite-embedding-english-r2/pipeline/sentence-similarity',
        defaultConfig: {
          maxRetries: 3,
          timeout: 30000,
        },
        capabilities: ['sentence-similarity', 'semantic-search'],
        description: 'IBM Granite embedding model for English text similarity',
      },
    ],
    [
      'google/embeddinggemma-300m',
      {
        modelName: 'google/embeddinggemma-300m',
        modelType: ModelType.SIMILARITY,
        pipelineType: PipelineType.SENTENCE_SIMILARITY,
        endpoint: 'https://router.huggingface.co/hf-inference/models/google/embeddinggemma-300m/pipeline/sentence-similarity',
        defaultConfig: {
          maxRetries: 3,
          timeout: 30000,
        },
        capabilities: ['sentence-similarity', 'semantic-search'],
        description: 'Google EmbeddingGemma 300M model for text embeddings',
      },
    ],
    [
      'sentence-transformers/all-MiniLM-L6-v2',
      {
        modelName: 'sentence-transformers/all-MiniLM-L6-v2',
        modelType: ModelType.EMBEDDING,
        pipelineType: PipelineType.FEATURE_EXTRACTION,
        endpoint: 'https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2',
        defaultConfig: {
          maxRetries: 3,
          timeout: 30000,
          dimensions: 384,
        },
        capabilities: ['feature-extraction', 'embeddings'],
        description: 'Sentence transformer model for generating embeddings',
      },
    ],
    // Text Generation Models
    [
      'distilbert/distilbert-base-uncased',
      {
        modelName: 'distilbert/distilbert-base-uncased',
        modelType: ModelType.MASKED_LANGUAGE_MODEL,
        pipelineType: PipelineType.FILL_MASK,
        endpoint: 'https://router.huggingface.co/hf-inference/models/distilbert/distilbert-base-uncased',
        defaultConfig: {
          maxRetries: 3,
          timeout: 30000,
        },
        capabilities: ['fill-mask', 'text-completion'],
        description: 'DistilBERT model for masked language modeling',
      },
    ],
    // Additional models for text generation
    [
      'microsoft/DialoGPT-medium',
      {
        modelName: 'microsoft/DialoGPT-medium',
        modelType: ModelType.TEXT_GENERATION,
        pipelineType: PipelineType.TEXT_GENERATION,
        endpoint: 'https://api-inference.huggingface.co/models/microsoft/DialoGPT-medium',
        defaultConfig: {
          maxRetries: 3,
          timeout: 30000,
          maxNewTokens: 300,
          temperature: 0.7,
          topP: 0.9,
        },
        capabilities: ['text-generation', 'conversation'],
        description: 'DialoGPT model for conversational text generation',
      },
    ],
    [
      'gpt2',
      {
        modelName: 'gpt2',
        modelType: ModelType.TEXT_GENERATION,
        pipelineType: PipelineType.TEXT_GENERATION,
        endpoint: 'https://api-inference.huggingface.co/models/gpt2',
        defaultConfig: {
          maxRetries: 3,
          timeout: 30000,
          maxNewTokens: 300,
          temperature: 0.7,
          topP: 0.9,
        },
        capabilities: ['text-generation'],
        description: 'GPT-2 model for text generation',
      },
    ],
  ]);

  /**
   * Get model configuration by name
   */
  static getModel(modelName: string): ModelRegistryEntry | undefined {
    return this.models.get(modelName);
  }

  /**
   * Get all models of a specific type
   */
  static getModelsByType(modelType: ModelType): ModelRegistryEntry[] {
    return Array.from(this.models.values()).filter(model => model.modelType === modelType);
  }

  /**
   * Get all available models
   */
  static getAllModels(): ModelRegistryEntry[] {
    return Array.from(this.models.values());
  }

  /**
   * Check if a model is registered
   */
  static hasModel(modelName: string): boolean {
    return this.models.has(modelName);
  }

  /**
   * Register a new model
   */
  static registerModel(entry: ModelRegistryEntry): void {
    this.models.set(entry.modelName, entry);
  }

  /**
   * Get models by capability
   */
  static getModelsByCapability(capability: string): ModelRegistryEntry[] {
    return Array.from(this.models.values()).filter(model => 
      model.capabilities.includes(capability)
    );
  }

  /**
   * Get default models for each type (for fallback scenarios)
   */
  static getDefaultModels(): Record<ModelType, string> {
    return {
      [ModelType.TEXT_GENERATION]: 'gpt2',
      [ModelType.EMBEDDING]: 'sentence-transformers/all-MiniLM-L6-v2',
      [ModelType.SIMILARITY]: 'ibm-granite/granite-embedding-english-r2',
      [ModelType.FEATURE_EXTRACTION]: 'sentence-transformers/all-MiniLM-L6-v2',
      [ModelType.MASKED_LANGUAGE_MODEL]: 'distilbert/distilbert-base-uncased',
    };
  }
}