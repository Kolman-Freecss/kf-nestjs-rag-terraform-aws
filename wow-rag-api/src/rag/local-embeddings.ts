import { Embeddings, type EmbeddingsParams } from "@langchain/core/embeddings";
import { EmbeddingsProvider } from "./embeddings/embeddings.interface";

export interface LocalEmbeddingsParams extends EmbeddingsParams {
  modelName?: string;
}

export class LocalEmbeddings extends Embeddings implements EmbeddingsProvider {
  readonly providerName = "local";
  readonly requiresApiKey = false;
  modelName: string;

  constructor(params: LocalEmbeddingsParams = {}) {
    super(params);
    this.modelName = params.modelName ?? "Xenova/all-MiniLM-L6-v2";
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    // Placeholder implementation - local embeddings disabled
    throw new Error("Local embeddings are currently disabled. Please use HuggingFace embeddings instead.");
  }

  async embedQuery(text: string): Promise<number[]> {
    // Placeholder implementation - local embeddings disabled
    throw new Error("Local embeddings are currently disabled. Please use HuggingFace embeddings instead.");
  }
}
