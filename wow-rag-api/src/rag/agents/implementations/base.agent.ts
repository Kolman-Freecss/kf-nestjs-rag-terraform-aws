import { Logger } from '@nestjs/common';
import { BaseAgent, AgentType, AgentConfig, AgentResult } from '../interfaces/agent.interfaces';
import { ModelFactory } from '../../models/factory/model.factory';
import { ModelClient } from '../../models/interfaces/model.interfaces';

/**
 * Base implementation for all agents
 */
export abstract class BaseAgentImpl implements BaseAgent {
  protected readonly logger = new Logger(this.constructor.name);
  protected readonly config: Required<AgentConfig>;
  protected readonly modelClients: Map<string, ModelClient> = new Map();

  constructor(
    public readonly name: string,
    public readonly type: AgentType,
    public readonly capabilities: string[],
    config: AgentConfig,
    protected readonly modelFactory: ModelFactory,
  ) {
    this.config = {
      maxRetries: 3,
      timeout: 30000,
      fallbackModels: [],
      customSettings: {},
      ...config,
    };
  }

  /**
   * Initialize the agent by creating model clients
   */
  async initialize(): Promise<void> {
    try {
      // Create clients for primary models
      for (const modelName of this.config.modelNames) {
        const client = await this.modelFactory.createClient(modelName);
        this.modelClients.set(modelName, client);
      }

      // Create clients for fallback models
      for (const modelName of this.config.fallbackModels) {
        if (!this.modelClients.has(modelName)) {
          const client = await this.modelFactory.createClient(modelName);
          this.modelClients.set(modelName, client);
        }
      }

      this.logger.log(`Agent ${this.name} initialized with ${this.modelClients.size} model clients`);
    } catch (error) {
      this.logger.error(`Failed to initialize agent ${this.name}:`, error);
      throw error;
    }
  }

  /**
   * Check if the agent is healthy
   */
  async isHealthy(): Promise<boolean> {
    try {
      // Check if at least one primary model is healthy
      for (const modelName of this.config.modelNames) {
        const client = this.modelClients.get(modelName);
        if (client && await client.isHealthy()) {
          return true;
        }
      }

      // Check fallback models if primary models are unhealthy
      for (const modelName of this.config.fallbackModels) {
        const client = this.modelClients.get(modelName);
        if (client && await client.isHealthy()) {
          return true;
        }
      }

      return false;
    } catch (error) {
      this.logger.warn(`Health check failed for agent ${this.name}:`, error);
      return false;
    }
  }

  /**
   * Get a healthy model client with fallback logic
   */
  protected async getHealthyClient(): Promise<ModelClient | null> {
    // Try primary models first
    for (const modelName of this.config.modelNames) {
      const client = this.modelClients.get(modelName);
      if (client && await client.isHealthy()) {
        return client;
      }
    }

    // Try fallback models
    for (const modelName of this.config.fallbackModels) {
      const client = this.modelClients.get(modelName);
      if (client && await client.isHealthy()) {
        this.logger.warn(`Using fallback model ${modelName} for agent ${this.name}`);
        return client;
      }
    }

    return null;
  }

  /**
   * Execute an operation with retry logic and error handling
   */
  protected async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
  ): Promise<AgentResult<T>> {
    const startTime = Date.now();
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        const result = await Promise.race([
          operation(),
          this.createTimeoutPromise<T>(this.config.timeout),
        ]);

        return {
          success: true,
          data: result,
          metadata: {
            agentName: this.name,
            agentType: this.type,
            executionTime: Date.now() - startTime,
          },
        };
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(
          `${operationName} failed for agent ${this.name} (attempt ${attempt}/${this.config.maxRetries}):`,
          error,
        );

        if (attempt < this.config.maxRetries) {
          // Exponential backoff
          await this.sleep(Math.pow(2, attempt - 1) * 1000);
        }
      }
    }

    return {
      success: false,
      error: lastError?.message || `${operationName} failed after ${this.config.maxRetries} attempts`,
      metadata: {
        agentName: this.name,
        agentType: this.type,
        executionTime: Date.now() - startTime,
      },
    };
  }

  /**
   * Create a timeout promise
   */
  private createTimeoutPromise<T>(timeout: number): Promise<T> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeout}ms`));
      }, timeout);
    });
  }

  /**
   * Sleep for a given number of milliseconds
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Validate input parameters
   */
  protected validateInput(input: any, fieldName: string): void {
    if (input === null || input === undefined) {
      throw new Error(`${fieldName} is required`);
    }

    if (typeof input === 'string' && input.trim().length === 0) {
      throw new Error(`${fieldName} cannot be empty`);
    }

    if (Array.isArray(input) && input.length === 0) {
      throw new Error(`${fieldName} cannot be empty array`);
    }
  }

  /**
   * Calculate confidence score based on various factors
   */
  protected calculateConfidence(factors: {
    modelConfidence?: number;
    resultQuality?: number;
    contextRelevance?: number;
    executionTime?: number;
  }): number {
    const {
      modelConfidence = 0.5,
      resultQuality = 0.5,
      contextRelevance = 0.5,
      executionTime = 1000,
    } = factors;

    // Normalize execution time (faster = higher confidence, up to a point)
    const timeScore = Math.max(0, Math.min(1, (5000 - executionTime) / 5000));

    // Weighted average of all factors
    const confidence = (
      modelConfidence * 0.4 +
      resultQuality * 0.3 +
      contextRelevance * 0.2 +
      timeScore * 0.1
    );

    return Math.max(0, Math.min(1, confidence));
  }
}