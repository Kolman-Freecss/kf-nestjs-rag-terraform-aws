import { BaseHuggingFaceClient } from './base.client';
import {
  SimilarityClient,
  SimilarityConfig,
  ModelType,
  ModelResponse,
  SimilarityResponse,
} from '../interfaces/model.interfaces';

/**
 * Client for HuggingFace sentence similarity models
 * Handles models like ibm-granite/granite-embedding-english-r2 and google/embeddinggemma-300m
 */
export class HuggingFaceSimilarityClient extends BaseHuggingFaceClient implements SimilarityClient {
  private readonly endpoint: string;

  constructor(modelName: string, config: SimilarityConfig, endpoint: string) {
    super(modelName, ModelType.SIMILARITY, config);
    this.endpoint = endpoint;
  }

  /**
   * Calculate similarity scores between a source sentence and target sentences
   */
  async calculateSimilarity(
    sourceSentence: string,
    targetSentences: string[],
  ): Promise<ModelResponse<SimilarityResponse>> {
    this.validateInput(sourceSentence);
    this.validateInputs(targetSentences);

    const startTime = Date.now();

    try {
      const response = await this.makeRequest(this.endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: {
            source_sentence: sourceSentence,
            sentences: targetSentences,
          },
          options: {
            wait_for_model: true,
            use_cache: true,
          },
        }),
      });

      const result = await this.processResponse<number[]>(response, startTime);

      if (!result.success) {
        return result as ModelResponse<SimilarityResponse>;
      }

      // Transform the response to our standard format
      const scores = Array.isArray(result.data) ? result.data : [];
      
      return {
        success: true,
        data: {
          scores,
          sourceSentence,
          targetSentences,
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
   * Find the most similar sentences with their scores
   */
  async findMostSimilar(
    sourceSentence: string,
    targetSentences: string[],
    topK = 5,
  ): Promise<ModelResponse<{ sentence: string; score: number }[]>> {
    const similarityResult = await this.calculateSimilarity(sourceSentence, targetSentences);

    if (!similarityResult.success) {
      return similarityResult as ModelResponse<{ sentence: string; score: number }[]>;
    }

    const { scores } = similarityResult.data!;
    
    // Create pairs of sentences and scores, then sort by score descending
    const scoredSentences = targetSentences
      .map((sentence, index) => ({
        sentence,
        score: scores[index] || 0,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    return {
      success: true,
      data: scoredSentences,
      metadata: similarityResult.metadata,
    };
  }

  /**
   * Health check specific to similarity models
   */
  async isHealthy(): Promise<boolean> {
    try {
      const testResult = await this.calculateSimilarity(
        'Hello world',
        ['Hello world', 'Goodbye world'],
      );
      return testResult.success;
    } catch (error) {
      this.logger.warn(`Health check failed for similarity model ${this.modelName}:`, error);
      return false;
    }
  }
}