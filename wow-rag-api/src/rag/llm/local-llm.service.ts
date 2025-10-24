import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
    ChatCompletionRequest,
    ChatCompletionResponse,
    ChatMessage,
    LocalLLMConfig
} from './interfaces/local-llm.interface';

@Injectable()
export class LocalLLMService {
  private readonly logger = new Logger(LocalLLMService.name);
  private readonly config: LocalLLMConfig;

  constructor(private readonly configService: ConfigService) {
    this.config = {
      baseUrl: this.configService.get<string>('LOCAL_LLM_BASE_URL', 'http://localhost:8001'),
      apiKey: this.configService.get<string>('LOCAL_LLM_API_KEY'),
      model: this.configService.get<string>('LOCAL_LLM_MODEL', 'deepseek-coder'),
      temperature: this.configService.get<number>('LOCAL_LLM_TEMPERATURE', 0.7),
      maxTokens: this.configService.get<number>('LOCAL_LLM_MAX_TOKENS', 1000),
    };
  }

  /**
   * Check if the local LLM server is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.baseUrl}/health`);
      if (response.ok) {
        const data = await response.json();
        return data.model_loaded === true;
      }
      return false;
    } catch (error) {
      this.logger.debug(`Local LLM server not available: ${error.message}`);
      return false;
    }
  }

  /**
   * Generate a chat completion using the local LLM
   */
  async chatCompletion(
    messages: ChatMessage[],
    options?: {
      temperature?: number;
      maxTokens?: number;
      model?: string;
    }
  ): Promise<ChatCompletionResponse> {
    const request: ChatCompletionRequest = {
      messages,
      temperature: options?.temperature ?? this.config.temperature,
      max_tokens: options?.maxTokens ?? this.config.maxTokens,
      model: options?.model ?? this.config.model,
    };

    try {
      const response = await fetch(`${this.config.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` }),
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Local LLM request failed: ${response.status} ${errorText}`);
      }

      const data: ChatCompletionResponse = await response.json();
      this.logger.debug(`Local LLM response generated with ${data.usage.total_tokens} tokens`);
      
      return data;
    } catch (error) {
      this.logger.error(`Error calling local LLM: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate a simple text response for a given prompt
   */
  async generateText(
    prompt: string,
    systemMessage?: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<string> {
    const messages: ChatMessage[] = [];
    
    if (systemMessage) {
      messages.push({ role: 'system', content: systemMessage });
    }
    
    messages.push({ role: 'user', content: prompt });

    const response = await this.chatCompletion(messages, options);
    return response.choices[0]?.message?.content || '';
  }

  /**
   * Get available models from the local LLM server
   */
  async getModels(): Promise<any[]> {
    try {
      const response = await fetch(`${this.config.baseUrl}/models`);
      if (response.ok) {
        const data = await response.json();
        return data.data || [];
      }
      return [];
    } catch (error) {
      this.logger.warn(`Could not fetch models from local LLM: ${error.message}`);
      return [];
    }
  }
}
