/**
 * Base interface for all HuggingFace model configurations
 */
export interface BaseModelConfig {
  modelName: string;
  apiKey: string;
  maxRetries?: number;
  timeout?: number;
}

/**
 * Configuration for text generation models
 */
export interface TextGenerationConfig extends BaseModelConfig {
  maxNewTokens?: number;
  temperature?: number;
  topP?: number;
  doSample?: boolean;
  returnFullText?: boolean;
  stop?: string[];
}

/**
 * Configuration for embedding models
 */
export interface EmbeddingConfig extends BaseModelConfig {
  dimensions?: number;
  normalize?: boolean;
}

/**
 * Configuration for similarity models
 */
export interface SimilarityConfig extends BaseModelConfig {
  threshold?: number;
  maxSentences?: number;
}

/**
 * Model types supported by the system
 */
export enum ModelType {
  TEXT_GENERATION = 'text-generation',
  EMBEDDING = 'embedding',
  SIMILARITY = 'similarity',
  FEATURE_EXTRACTION = 'feature-extraction',
  MASKED_LANGUAGE_MODEL = 'masked-language-model'
}

/**
 * Model pipeline types for HuggingFace API
 */
export enum PipelineType {
  TEXT_GENERATION = 'text-generation',
  SENTENCE_SIMILARITY = 'sentence-similarity',
  FEATURE_EXTRACTION = 'feature-extraction',
  FILL_MASK = 'fill-mask'
}

/**
 * Base response interface for all model calls
 */
export interface ModelResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: {
    modelName: string;
    responseTime: number;
    tokensUsed?: number;
  };
}

/**
 * Text generation response
 */
export interface TextGenerationResponse {
  generatedText: string;
  finishReason?: string;
}

/**
 * Embedding response
 */
export interface EmbeddingResponse {
  embeddings: number[];
  dimensions: number;
}

/**
 * Similarity response
 */
export interface SimilarityResponse {
  scores: number[];
  sourceSentence: string;
  targetSentences: string[];
}

/**
 * Base interface for all model clients
 */
export interface BaseModelClient {
  readonly modelName: string;
  readonly modelType: ModelType;
  isHealthy(): Promise<boolean>;
}

/**
 * Interface for text generation models
 */
export interface TextGenerationClient extends BaseModelClient {
  generate(prompt: string, options?: Partial<TextGenerationConfig>): Promise<ModelResponse<TextGenerationResponse>>;
  generateStream?(prompt: string, options?: Partial<TextGenerationConfig>): AsyncGenerator<string>;
}

/**
 * Interface for embedding models
 */
export interface EmbeddingClient extends BaseModelClient {
  embed(text: string): Promise<ModelResponse<EmbeddingResponse>>;
  embedBatch(texts: string[]): Promise<ModelResponse<EmbeddingResponse[]>>;
}

/**
 * Interface for similarity models
 */
export interface SimilarityClient extends BaseModelClient {
  calculateSimilarity(sourceSentence: string, targetSentences: string[]): Promise<ModelResponse<SimilarityResponse>>;
  findMostSimilar(sourceSentence: string, targetSentences: string[], topK?: number): Promise<ModelResponse<{ sentence: string; score: number }[]>>;
}

/**
 * Union type for all model clients
 */
export type ModelClient = TextGenerationClient | EmbeddingClient | SimilarityClient;

/**
 * Model registry entry
 */
export interface ModelRegistryEntry {
  modelName: string;
  modelType: ModelType;
  pipelineType: PipelineType;
  endpoint: string;
  defaultConfig: Partial<BaseModelConfig>;
  capabilities: string[];
  description?: string;
}