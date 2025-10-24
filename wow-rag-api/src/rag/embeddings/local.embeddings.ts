import { Embeddings, type EmbeddingsParams } from "@langchain/core/embeddings";
import { EmbeddingsProvider } from "./embeddings.interface";

export interface LocalEmbeddingsParams extends EmbeddingsParams {
  modelName?: string;
  apiUrl?: string;
}

export class LocalEmbeddings extends Embeddings implements EmbeddingsProvider {
  readonly providerName = "local";
  readonly requiresApiKey = false;
  modelName: string;
  apiUrl: string;

  constructor(params: LocalEmbeddingsParams = {}) {
    super(params);
    this.modelName = params.modelName ?? "Xenova/all-MiniLM-L6-v2";
    this.apiUrl = params.apiUrl ?? "http://localhost:8000";
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    try {
      const response = await fetch(`${this.apiUrl}/embed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          texts: texts,
          model: this.modelName
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.embeddings;
    } catch (error) {
      throw new Error(`Failed to embed documents: ${error.message}`);
    }
  }

  async embedQuery(text: string): Promise<number[]> {
    try {
      const response = await fetch(`${this.apiUrl}/embed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          texts: [text],
          model: this.modelName
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.embeddings[0];
    } catch (error) {
      throw new Error(`Failed to embed query: ${error.message}`);
    }
  }
}
