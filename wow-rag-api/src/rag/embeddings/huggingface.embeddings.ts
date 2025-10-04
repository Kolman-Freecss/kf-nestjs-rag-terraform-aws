import { Embeddings, EmbeddingsParams } from '@langchain/core/embeddings';

/**
 * Custom HuggingFace embeddings implementation using Inference API
 */
export class HuggingFaceEmbeddings extends Embeddings {
  private apiKey: string;

  constructor(params: EmbeddingsParams & { apiKey: string }) {
    super(params);
    this.apiKey = params.apiKey;
  }

  /**
   * Generate embeddings for multiple documents
   */
  async embedDocuments(texts: string[]): Promise<number[][]> {
    const embeddings = await Promise.all(
      texts.map((text) => this.callEmbeddingAPI(text)),
    );
    return embeddings;
  }

  /**
   * Generate embedding for a single query
   */
  async embedQuery(text: string): Promise<number[]> {
    return this.callEmbeddingAPI(text);
  }

  /**
   * Call HuggingFace Inference API for embeddings
   */
  private async callEmbeddingAPI(text: string): Promise<number[]> {
    const response = await fetch(
      'https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inputs: text }),
      },
    );

    if (!response.ok) {
      throw new Error(`HuggingFace API error: ${response.statusText}`);
    }

    const data = await response.json();
    return Array.isArray(data) ? data : data.embeddings || data[0];
  }
}
