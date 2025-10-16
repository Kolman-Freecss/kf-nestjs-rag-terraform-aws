import { Logger } from '@nestjs/common';
import { BaseModelClient, BaseModelConfig, ModelType, ModelResponse } from '../interfaces/model.interfaces';

/**
 * Base implementation for all HuggingFace model clients
 */
export abstract class BaseHuggingFaceClient implements BaseModelClient {
  protected readonly logger = new Logger(this.constructor.name);
  protected readonly config: BaseModelConfig;

  constructor(
    public readonly modelName: string,
    public readonly modelType: ModelType,
    config: BaseModelConfig,
  ) {
    this.config = {
      maxRetries: 3,
      timeout: 30000,
      ...config,
    };
  }

  /**
   * Check if the model is healthy by making a simple request
   */
  async isHealthy(): Promise<boolean> {
    try {
      const response = await this.makeRequest('https://api-inference.huggingface.co/status', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
      });
      return response.ok;
    } catch (error) {
      this.logger.warn(`Health check failed for model ${this.modelName}:`, error);
      return false;
    }
  }

  /**
   * Make an HTTP request with retry logic and error handling
   */
  protected async makeRequest(
    url: string,
    options: RequestInit,
    retryCount = 0,
  ): Promise<Response> {
    const startTime = Date.now();
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      if (retryCount < (this.config.maxRetries || 3)) {
        this.logger.warn(
          `Request failed for ${this.modelName}, retrying (${retryCount + 1}/${this.config.maxRetries}):`,
          error,
        );
        await this.sleep(Math.pow(2, retryCount) * 1000); // Exponential backoff
        return this.makeRequest(url, options, retryCount + 1);
      }

      throw new Error(`Request failed after ${retryCount + 1} attempts: ${error.message}`);
    }
  }

  /**
   * Process API response and handle common error cases
   */
  protected async processResponse<T>(
    response: Response,
    startTime: number,
  ): Promise<ModelResponse<T>> {
    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText}`,
        metadata: {
          modelName: this.modelName,
          responseTime,
        },
      };
    }

    try {
      const data = await response.json();
      
      // Handle common HuggingFace error responses
      if (data.error) {
        if (typeof data.error === 'string' && data.error.includes('loading')) {
          return {
            success: false,
            error: `Model ${this.modelName} is still loading. Please try again later.`,
            metadata: {
              modelName: this.modelName,
              responseTime,
            },
          };
        }
        
        return {
          success: false,
          error: data.error,
          metadata: {
            modelName: this.modelName,
            responseTime,
          },
        };
      }

      return {
        success: true,
        data,
        metadata: {
          modelName: this.modelName,
          responseTime,
        },
      };
    } catch (parseError) {
      return {
        success: false,
        error: `Failed to parse response: ${parseError.message}`,
        metadata: {
          modelName: this.modelName,
          responseTime,
        },
      };
    }
  }

  /**
   * Sleep for a given number of milliseconds
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Validate input text
   */
  protected validateInput(text: string, maxLength = 10000): void {
    if (!text || typeof text !== 'string') {
      throw new Error('Input text must be a non-empty string');
    }
    
    if (text.length > maxLength) {
      throw new Error(`Input text too long: ${text.length} characters (max: ${maxLength})`);
    }
  }

  /**
   * Validate input texts array
   */
  protected validateInputs(texts: string[], maxLength = 10000): void {
    if (!Array.isArray(texts) || texts.length === 0) {
      throw new Error('Input texts must be a non-empty array');
    }
    
    texts.forEach((text, index) => {
      try {
        this.validateInput(text, maxLength);
      } catch (error) {
        throw new Error(`Invalid text at index ${index}: ${error.message}`);
      }
    });
  }
}