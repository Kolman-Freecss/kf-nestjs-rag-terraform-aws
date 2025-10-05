import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MemoryVectorStore } from 'langchain/vectorstores/memory';
import { HuggingFaceInferenceEmbeddings } from '@langchain/community/embeddings/hf';
import { Document } from 'langchain/document';
import { BlizzardService } from '../blizzard/blizzard.service';
import * as path from 'path';
import * as fs from 'fs';
import * as csvParser from 'csv-parser';

/**
 * Service for RAG (Retrieval Augmented Generation) operations
 * Uses vector similarity search and LLM to generate responses
 */
@Injectable()
export class RagService implements OnModuleInit {
  private readonly logger = new Logger(RagService.name);
  private vectorStore: MemoryVectorStore | null = null;
  private embeddings: HuggingFaceInferenceEmbeddings;
  private apiKey: string;
  private readonly dataPath = path.join(process.cwd(), 'data', 'initial-knowledge.csv');

  constructor(
    private readonly configService: ConfigService,
    private readonly blizzardService: BlizzardService,
  ) {
    const apiKey = this.configService.get<string>('HUGGINGFACE_API_KEY');

    if (!apiKey) {
      throw new Error('HUGGINGFACE_API_KEY is required');
    }

    this.apiKey = apiKey;
    this.embeddings = new HuggingFaceInferenceEmbeddings({
      apiKey,
      model: 'sentence-transformers/all-MiniLM-L6-v2',
    });

    this.logger.log('RAG Service initialized');
  }

  async onModuleInit() {
    await this.initializeVectorStore();
  }

  /**
   * Initialize or load vector store
   */
  private async initializeVectorStore(): Promise<void> {
    // MemoryVectorStore doesn't persist, so always create from docs
    this.logger.log('Creating new vector store from CSV data');
    const docs = await this.loadInitialDocuments();
    this.vectorStore = await MemoryVectorStore.fromDocuments(docs, this.embeddings);
    this.logger.log('Vector store created in memory');
  }

  /**
   * Load initial documents from CSV file
   */
  private async loadInitialDocuments(): Promise<Document[]> {
    return new Promise((resolve, reject) => {
      const documents: Document[] = [];

      if (!fs.existsSync(this.dataPath)) {
        this.logger.warn(`CSV file not found at ${this.dataPath}, using empty knowledge base`);
        resolve([]);
        return;
      }

      fs.createReadStream(this.dataPath)
        .pipe(csvParser())
        .on('data', (row) => {
          // Filter out empty/undefined content and trim whitespace
          if (row.content && row.content.trim().length > 0) {
            documents.push(
              new Document({
                pageContent: row.content.trim(),
                metadata: {
                  source: 'knowledge-base',
                  topic: row.topic || 'general'
                },
              }),
            );
          }
        })
        .on('end', () => {
          this.logger.log(`Loaded ${documents.length} documents from CSV`);
          resolve(documents);
        })
        .on('error', (error) => {
          this.logger.error('Error reading CSV file:', error);
          reject(error);
        });
    });
  }

  /**
   * Add custom documents to the knowledge base
   */
  async addDocument(content: string, metadata: Record<string, any> = {}): Promise<void> {
    if (!this.vectorStore) {
      throw new Error('Vector store not initialized');
    }

    const doc = new Document({
      pageContent: content,
      metadata: { ...metadata, source: 'user-added' },
    });

    await this.vectorStore.addDocuments([doc]);
    this.logger.log('Document added to vector store (in-memory only)');
  }

  /**
   * Query using RAG with DeepSeek and Blizzard API integration
   */
  async query(question: string): Promise<string> {
    if (!this.vectorStore) {
      throw new Error('Vector store not initialized');
    }

    // Retrieve relevant documents
    const relevantDocs = await this.vectorStore.similaritySearch(question, 3);

    // Try to fetch live data from Blizzard API if question seems related
    let blizzardContext = '';
    try {
      // Simple keyword matching for demonstration
      if (question.toLowerCase().includes('realm')) {
        // Match realm name - includes letters, numbers, hyphens, and apostrophes
        // Examples: "Area-52", "Burning Blade", "Kil'jaeden"
        const match = question.match(/realm\s+([\w-']+(?:\s+[\w-']+)*)/i);
        if (match) {
          const realmSlug = match[1].toLowerCase().replace(/\s+/g, '-').replace(/'/g, '');
          const realmData = await this.blizzardService.getRealmData(realmSlug);
          blizzardContext = `\n\nLive Blizzard API Data:\n${JSON.stringify(realmData, null, 2)}`;
        }
      }
    } catch (error) {
      this.logger.warn('Could not fetch Blizzard API data:', error);
    }

    // Create context from retrieved documents
    const context = relevantDocs
      .map((doc) => doc.pageContent)
      .join('\n\n');

    // Build prompt for the LLM - using a format optimized for smaller models
    const prompt = `Answer this question about World of Warcraft using only the information provided.

Information:
${context}${blizzardContext}

Question: ${question}

Answer:`;

    // Try to query HuggingFace LLM with multiple fallback models
    const models = [
      'mistralai/Mistral-7B-Instruct-v0.3', // Try Mistral first (instruction-tuned)
      'google/flan-t5-xxl',                  // Google's T5 model
      'bigscience/bloom-560m',               // BLOOM smaller model
    ];

    for (const model of models) {
      try {
        this.logger.log(`Trying model: ${model}`);

        const response = await fetch(
          `https://api-inference.huggingface.co/models/${model}`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              inputs: prompt,
              parameters: {
                max_new_tokens: 300,
                temperature: 0.7,
                top_p: 0.95,
                do_sample: true,
                return_full_text: false,
              },
              options: {
                wait_for_model: false, // Don't wait if model is loading
                use_cache: true,
              },
            }),
          },
        );

        if (!response.ok) {
          const errorText = await response.text();
          this.logger.warn(`Model ${model} failed: ${response.status} - ${errorText}`);
          continue; // Try next model
        }

        const data = await response.json();

        // Check if model is loading
        if (data.error && data.error.includes('loading')) {
          this.logger.warn(`Model ${model} is loading, trying next...`);
          continue;
        }

        // Extract generated text from various response formats
        let generatedText = '';
        if (Array.isArray(data) && data.length > 0) {
          generatedText = data[0].generated_text || data[0].text || '';
        } else if (data.generated_text) {
          generatedText = data.generated_text;
        } else if (typeof data === 'string') {
          generatedText = data;
        }

        if (generatedText && generatedText.trim().length > 0) {
          this.logger.log(`Successfully got response from ${model}`);
          return generatedText.trim();
        }

        this.logger.warn(`Model ${model} returned empty response`);
      } catch (error) {
        this.logger.error(`Error with model ${model}:`, error.message);
        continue; // Try next model
      }
    }

    // If all models failed, return context directly
    this.logger.warn('All LLM models failed or unavailable, returning context directly');
    return `Based on the World of Warcraft knowledge base:\n\n${context}${blizzardContext}\n\n⚠️ Note: AI generation currently unavailable. The free tier models may be loading or rate limited. Showing retrieved information instead.`;
  }
}
