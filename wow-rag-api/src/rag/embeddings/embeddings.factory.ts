import { EmbeddingsConfig, EmbeddingsProvider } from './embeddings.interface';
import { HuggingFaceEmbeddings } from './huggingface.embeddings';
import { LocalEmbeddings } from './local.embeddings';

/**
 * Factory for creating embeddings providers
 */
export class EmbeddingsFactory {
  /**
   * Create an embeddings provider based on configuration
   */
  static create(config: EmbeddingsConfig): EmbeddingsProvider {
    switch (config.provider) {
      case 'local':
        return new LocalEmbeddings({
          modelName: config.modelName || 'Xenova/all-MiniLM-L6-v2',
          apiUrl: config.apiUrl || 'http://localhost:8000',
        });

      case 'huggingface':
        if (!config.apiKey) {
          throw new Error('HuggingFace API key is required for HuggingFace embeddings');
        }
        return new HuggingFaceEmbeddings({
          apiKey: config.apiKey,
        });

      default:
        throw new Error(`Unknown embeddings provider: ${config.provider}`);
    }
  }

  /**
   * Get available providers
   */
  static getAvailableProviders(): Array<{ name: string; requiresApiKey: boolean }> {
    return [
      { name: 'local', requiresApiKey: false },
      { name: 'huggingface', requiresApiKey: true },
    ];
  }
}