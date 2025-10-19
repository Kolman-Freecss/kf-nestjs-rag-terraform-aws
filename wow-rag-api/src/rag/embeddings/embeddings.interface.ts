import { Embeddings } from "@langchain/core/embeddings";

/**
 * Common interface for embeddings providers
 * Allows switching between local and cloud-based embeddings
 */
export interface EmbeddingsProvider extends Embeddings {
  readonly providerName: string;
  readonly requiresApiKey: boolean;
}

/**
 * Configuration for embeddings providers
 */
export interface EmbeddingsConfig {
  provider: 'local' | 'huggingface';
  apiKey?: string;
  modelName?: string;
}