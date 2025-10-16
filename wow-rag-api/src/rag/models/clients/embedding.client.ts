import { BaseHuggingFaceClient } from './base.client';
import {
  EmbeddingClient,
  EmbeddingConfig,
  ModelType,
  ModelResponse,
  EmbeddingResponse,
} from '../interfaces/model.interfaces';

/**
 * Client for HuggingFace embedding models
 * Handles models like sentence-transformers/all-MiniLM-L6-v2
 */
export class HuggingFaceEmbeddingClient extends BaseHuggingFaceClient implements EmbeddingClient {
  private readonly endpoint: string;

  constructor(modelName: string, config: EmbeddingConfig, endpoint: string) {
    super(modelName, ModelType.EMBEDDING, config);
    this.endpoint = endpoint;
  }

  /**
   * Generate embedding for a single text
   */
  async embed(text: string): Promise<ModelResponse<EmbeddingResponse>> {
    this.validateInput(text);

    const startTime = Date.now();

    try {
      const response = await this.makeRequest(this.endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: text,
          options: {
            wait_for_model: true,
            use_cache: true,
          },
        }),
      });

      const result = await this.processResponse<any>(response, startTime);

      if (!result.success) {
        return result as ModelResponse<EmbeddingResponse>;
      }

      // Handle different response formats from HuggingFace
      let embeddings: number[] = [];

      if (Array.isArray(result.data)) {
        // If it's a 2D array (batch of 1), take the first element
        if (Array.isArray(result.data[0]) && typeof result.data[0][0] === 'number') {
          embeddings = result.data[0];
        }
        // If it's already a 1D array of numbers
        else if (typeof result.data[0] === 'number') {
          embeddings = result.data;
        }
      }

      if (embeddings.length === 0) {
        return {
          success: false,
          error: `Unexpected response format from embedding model: ${JSON.stringify(result.data).slice(0, 200)}`,
          metadata: result.metadata,
        };
      }

      // Normalize embeddings if requested
      const config = this.config as EmbeddingConfig;
      if (config.normalize) {
        embeddings = this.normalizeVector(embeddings);
      }

      return {
        success: true,
        data: {
          embeddings,
          dimensions: embeddings.length,
        },
        metadata: result.metadata,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        metadata: {
          modelName: this.modelName,
          responseTime: Date.now() - startTime,
        },
      };
    }
  }

  /**
   * Generate embeddings for multiple texts
   */
  async embedBatch(texts: string[]): Promise<ModelResponse<EmbeddingResponse[]>> {
    this.validateInputs(texts);

    const startTime = Date.now();

    try {
      // For batch processing, we'll make individual requests
      // Some models support batch processing, but for simplicity, we'll use individual requests
      const embedPromises = texts.map(text => this.embed(text));
      const results = await Promise.all(embedPromises);

      // Check if any requests failed
      const failedResults = results.filter(result => !result.success);
      if (failedResults.length > 0) {
        return {
          success: false,
          error: `${failedResults.length} out of ${texts.length} embedding requests failed`,
          metadata: {
            modelName: this.modelName,
            responseTime: Date.now() - startTime,
          },
        };
      }

      // Extract successful embeddings
      const embeddings = results.map(result => result.data!);

      return {
        success: true,
        data: embeddings,
        metadata: {
          modelName: this.modelName,
          responseTime: Date.now() - startTime,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        metadata: {
          modelName: this.modelName,
          responseTime: Date.now() - startTime,
        },
      };
    }
  }

  /**
   * Health check specific to embedding models
   */
  async isHealthy(): Promise<boolean> {
    try {
      const testResult = await this.embed('Hello world');
      return testResult.success && testResult.data!.embeddings.length > 0;
    } catch (error) {
      this.logger.warn(`Health check failed for embedding model ${this.modelName}:`, error);
      return false;
    }
  }

  /**
   * Normalize a vector to unit length
   */
  private normalizeVector(vector: number[]): number[] {
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    if (magnitude === 0) return vector;
    return vector.map(val => val / magnitude);
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  static cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have the same length');
    }

    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));

    if (magnitudeA === 0 || magnitudeB === 0) return 0;
    return dotProduct / (magnitudeA * magnitudeB);
  }

  /**
   * Find the most similar embeddings to a query embedding
   */
  static findMostSimilar(
    queryEmbedding: number[],
    candidateEmbeddings: { embedding: number[]; metadata?: any }[],
    topK = 5,
  ): { similarity: number; metadata?: any }[] {
    const similarities = candidateEmbeddings.map(candidate => ({
      similarity: this.cosineSimilarity(queryEmbedding, candidate.embedding),
      metadata: candidate.metadata,
    }));

    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);
  }
}