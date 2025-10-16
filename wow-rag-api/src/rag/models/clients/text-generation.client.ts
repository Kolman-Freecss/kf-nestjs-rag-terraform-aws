import { BaseHuggingFaceClient } from './base.client';
import {
  TextGenerationClient,
  TextGenerationConfig,
  ModelType,
  ModelResponse,
  TextGenerationResponse,
} from '../interfaces/model.interfaces';

/**
 * Client for HuggingFace text generation models
 * Handles models like gpt2, microsoft/DialoGPT-medium, etc.
 */
export class HuggingFaceTextGenerationClient extends BaseHuggingFaceClient implements TextGenerationClient {
  private readonly endpoint: string;

  constructor(modelName: string, config: TextGenerationConfig, endpoint: string) {
    super(modelName, ModelType.TEXT_GENERATION, config);
    this.endpoint = endpoint;
  }

  /**
   * Generate text based on a prompt
   */
  async generate(
    prompt: string,
    options?: Partial<TextGenerationConfig>,
  ): Promise<ModelResponse<TextGenerationResponse>> {
    this.validateInput(prompt);

    const startTime = Date.now();
    const config = { ...this.config, ...options } as TextGenerationConfig;

    try {
      const response = await this.makeRequest(this.endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: {
            max_new_tokens: config.maxNewTokens || 300,
            temperature: config.temperature || 0.7,
            top_p: config.topP || 0.9,
            do_sample: config.doSample !== false,
            return_full_text: config.returnFullText || false,
            stop: config.stop || [],
          },
          options: {
            wait_for_model: true,
            use_cache: true,
          },
        }),
      });

      const result = await this.processResponse<any>(response, startTime);

      if (!result.success) {
        return result as ModelResponse<TextGenerationResponse>;
      }

      // Handle different response formats from HuggingFace
      let generatedText = '';
      let finishReason: string | undefined;

      if (Array.isArray(result.data) && result.data.length > 0) {
        const firstResult = result.data[0];
        generatedText = firstResult.generated_text || firstResult.text || '';
        finishReason = firstResult.finish_reason;
      } else if (result.data?.generated_text) {
        generatedText = result.data.generated_text;
        finishReason = result.data.finish_reason;
      } else if (typeof result.data === 'string') {
        generatedText = result.data;
      }

      // Clean up the generated text if return_full_text is false
      if (!config.returnFullText && generatedText.startsWith(prompt)) {
        generatedText = generatedText.slice(prompt.length).trim();
      }

      return {
        success: true,
        data: {
          generatedText,
          finishReason,
        },
        metadata: {
          ...result.metadata,
          tokensUsed: this.estimateTokens(generatedText),
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
   * Generate text with streaming (if supported by the model)
   * Note: This is a placeholder for future streaming implementation
   */
  async* generateStream(
    prompt: string,
    options?: Partial<TextGenerationConfig>,
  ): AsyncGenerator<string> {
    // For now, we'll simulate streaming by yielding the complete response
    // In a real implementation, you'd use Server-Sent Events or WebSocket
    const result = await this.generate(prompt, options);
    
    if (result.success && result.data) {
      yield result.data.generatedText;
    } else {
      throw new Error(result.error || 'Generation failed');
    }
  }

  /**
   * Health check specific to text generation models
   */
  async isHealthy(): Promise<boolean> {
    try {
      const testResult = await this.generate('Hello', { maxNewTokens: 10 });
      return testResult.success;
    } catch (error) {
      this.logger.warn(`Health check failed for text generation model ${this.modelName}:`, error);
      return false;
    }
  }

  /**
   * Estimate token count (rough approximation)
   */
  private estimateTokens(text: string): number {
    // Rough estimation: 1 token ≈ 4 characters for English text
    return Math.ceil(text.length / 4);
  }
}

/**
 * Client for masked language models like DistilBERT
 */
export class HuggingFaceMaskedLanguageClient extends BaseHuggingFaceClient implements TextGenerationClient {
  private readonly endpoint: string;

  constructor(modelName: string, config: TextGenerationConfig, endpoint: string) {
    super(modelName, ModelType.MASKED_LANGUAGE_MODEL, config);
    this.endpoint = endpoint;
  }

  /**
   * Generate text by filling masked tokens
   */
  async generate(
    prompt: string,
    options?: Partial<TextGenerationConfig>,
  ): Promise<ModelResponse<TextGenerationResponse>> {
    this.validateInput(prompt);

    // Ensure the prompt contains a [MASK] token
    if (!prompt.includes('[MASK]')) {
      return {
        success: false,
        error: 'Prompt must contain [MASK] token for masked language models',
        metadata: {
          modelName: this.modelName,
          responseTime: 0,
        },
      };
    }

    const startTime = Date.now();

    try {
      const response = await this.makeRequest(this.endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: prompt,
          options: {
            wait_for_model: true,
            use_cache: true,
          },
        }),
      });

      const result = await this.processResponse<any>(response, startTime);

      if (!result.success) {
        return result as ModelResponse<TextGenerationResponse>;
      }

      // Handle fill-mask response format
      let generatedText = prompt;
      
      if (Array.isArray(result.data) && result.data.length > 0) {
        // Take the top prediction
        const topPrediction = result.data[0];
        if (topPrediction.token_str) {
          generatedText = prompt.replace('[MASK]', topPrediction.token_str.trim());
        }
      }

      return {
        success: true,
        data: {
          generatedText,
          finishReason: 'completed',
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
   * Health check for masked language models
   */
  async isHealthy(): Promise<boolean> {
    try {
      const testResult = await this.generate('The capital of France is [MASK].');
      return testResult.success;
    } catch (error) {
      this.logger.warn(`Health check failed for masked language model ${this.modelName}:`, error);
      return false;
    }
  }
}