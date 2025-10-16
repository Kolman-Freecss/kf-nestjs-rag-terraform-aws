import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ModelRegistry } from '../registry/model.registry';
import { HuggingFaceSimilarityClient } from '../clients/similarity.client';
import { HuggingFaceTextGenerationClient, HuggingFaceMaskedLanguageClient } from '../clients/text-generation.client';
import { HuggingFaceEmbeddingClient } from '../clients/embedding.client';
import {
  ModelClient,
  ModelType,
  BaseModelConfig,
  TextGenerationConfig,
  EmbeddingConfig,
  SimilarityConfig,
} from '../interfaces/model.interfaces';

/**
 * Factory for creating HuggingFace model clients
 */
@Injectable()
export class ModelFactory {
  private readonly logger = new Logger(ModelFactory.name);
  private readonly clientCache = new Map<string, ModelClient>();
  private readonly apiKey: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('HUGGINGFACE_API_KEY');
    if (!apiKey) {
      throw new Error('HUGGINGFACE_API_KEY is required');
    }
    this.apiKey = apiKey;
  }

  /**
   * Create a model client for the specified model
   */
  async createClient(
    modelName: string,
    config?: Partial<BaseModelConfig>,
  ): Promise<ModelClient> {
    // Check cache first
    const cacheKey = `${modelName}-${JSON.stringify(config || {})}`;
    if (this.clientCache.has(cacheKey)) {
      return this.clientCache.get(cacheKey)!;
    }

    // Get model configuration from registry
    const modelEntry = ModelRegistry.getModel(modelName);
    if (!modelEntry) {
      throw new Error(`Model ${modelName} not found in registry`);
    }

    // Merge configurations
    const finalConfig = {
      ...modelEntry.defaultConfig,
      ...config,
      modelName,
      apiKey: this.apiKey,
    } as BaseModelConfig;

    let client: ModelClient;

    // Create appropriate client based on model type
    switch (modelEntry.modelType) {
      case ModelType.SIMILARITY:
        client = new HuggingFaceSimilarityClient(
          modelName,
          finalConfig as SimilarityConfig,
          modelEntry.endpoint,
        );
        break;

      case ModelType.TEXT_GENERATION:
        client = new HuggingFaceTextGenerationClient(
          modelName,
          finalConfig as TextGenerationConfig,
          modelEntry.endpoint,
        );
        break;

      case ModelType.MASKED_LANGUAGE_MODEL:
        client = new HuggingFaceMaskedLanguageClient(
          modelName,
          finalConfig as TextGenerationConfig,
          modelEntry.endpoint,
        );
        break;

      case ModelType.EMBEDDING:
      case ModelType.FEATURE_EXTRACTION:
        client = new HuggingFaceEmbeddingClient(
          modelName,
          finalConfig as EmbeddingConfig,
          modelEntry.endpoint,
        );
        break;

      default:
        throw new Error(`Unsupported model type: ${modelEntry.modelType}`);
    }

    // Cache the client
    this.clientCache.set(cacheKey, client);
    
    this.logger.log(`Created client for model ${modelName} (${modelEntry.modelType})`);
    return client;
  }

  /**
   * Create multiple clients for different models
   */
  async createClients(
    modelConfigs: Array<{ modelName: string; config?: Partial<BaseModelConfig> }>,
  ): Promise<ModelClient[]> {
    const clientPromises = modelConfigs.map(({ modelName, config }) =>
      this.createClient(modelName, config),
    );
    return Promise.all(clientPromises);
  }

  /**
   * Get clients by model type
   */
  async getClientsByType(
    modelType: ModelType,
    config?: Partial<BaseModelConfig>,
  ): Promise<ModelClient[]> {
    const models = ModelRegistry.getModelsByType(modelType);
    const clientPromises = models.map(model =>
      this.createClient(model.modelName, config),
    );
    return Promise.all(clientPromises);
  }

  /**
   * Get default clients for each model type
   */
  async getDefaultClients(): Promise<Record<ModelType, ModelClient>> {
    const defaultModels = ModelRegistry.getDefaultModels();
    const clients: Partial<Record<ModelType, ModelClient>> = {};

    for (const [modelType, modelName] of Object.entries(defaultModels)) {
      try {
        clients[modelType as ModelType] = await this.createClient(modelName);
      } catch (error) {
        this.logger.warn(`Failed to create default client for ${modelType}:`, error);
      }
    }

    return clients as Record<ModelType, ModelClient>;
  }

  /**
   * Health check for a specific model
   */
  async checkModelHealth(modelName: string): Promise<boolean> {
    try {
      const client = await this.createClient(modelName);
      return await client.isHealthy();
    } catch (error) {
      this.logger.warn(`Health check failed for model ${modelName}:`, error);
      return false;
    }
  }

  /**
   * Health check for all models of a specific type
   */
  async checkModelsHealthByType(modelType: ModelType): Promise<Record<string, boolean>> {
    const models = ModelRegistry.getModelsByType(modelType);
    const healthChecks: Record<string, boolean> = {};

    await Promise.all(
      models.map(async model => {
        healthChecks[model.modelName] = await this.checkModelHealth(model.modelName);
      }),
    );

    return healthChecks;
  }

  /**
   * Get healthy models of a specific type
   */
  async getHealthyModelsByType(modelType: ModelType): Promise<string[]> {
    const healthChecks = await this.checkModelsHealthByType(modelType);
    return Object.entries(healthChecks)
      .filter(([, isHealthy]) => isHealthy)
      .map(([modelName]) => modelName);
  }

  /**
   * Clear client cache
   */
  clearCache(): void {
    this.clientCache.clear();
    this.logger.log('Model client cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.clientCache.size,
      keys: Array.from(this.clientCache.keys()),
    };
  }
}