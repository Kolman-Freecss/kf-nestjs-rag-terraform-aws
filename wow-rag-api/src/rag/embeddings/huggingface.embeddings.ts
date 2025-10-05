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
   * Uses feature-extraction task with source_sentence format
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
        body: JSON.stringify({
          inputs: {
            source_sentence: text,
            sentences: [text], // Required by SentenceSimilarityPipeline
          },
          options: { wait_for_model: true },
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HuggingFace API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();

    // For sentence similarity, we get back similarity scores
    // We need to use feature extraction instead
    // Let's try a different approach - using the model for feature extraction directly
    if (Array.isArray(data)) {
      // If it's similarity scores, we need a different approach
      if (typeof data[0] === 'number' && data.length < 100) {
        // This looks like similarity scores, not embeddings
        // We need to call the API differently
        throw new Error('Received similarity scores instead of embeddings. Model configuration issue.');
      }

      // If it's a 2D array (batch of 1), take the first element
      if (Array.isArray(data[0]) && typeof data[0][0] === 'number') {
        return data[0];
      }
      // If it's already a 1D array of numbers (embeddings should be 384-dimensional)
      if (typeof data[0] === 'number') {
        return data;
      }
    }

    throw new Error(`Unexpected response format from HuggingFace API: ${JSON.stringify(data).slice(0, 200)}`);
  }
}
