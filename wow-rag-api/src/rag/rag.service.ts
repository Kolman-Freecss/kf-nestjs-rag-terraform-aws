import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FaissStore } from '@langchain/community/vectorstores/faiss';
import { Document } from 'langchain/document';
import { BlizzardService } from '../blizzard/blizzard.service';
import { HuggingFaceEmbeddings } from './embeddings/huggingface.embeddings';
import * as path from 'path';
import * as fs from 'fs';
import * as csvParser from 'csv-parser';

/**
 * Service for RAG (Retrieval Augmented Generation) operations using DeepSeek
 */
@Injectable()
export class RagService implements OnModuleInit {
  private readonly logger = new Logger(RagService.name);
  private vectorStore: FaissStore | null = null;
  private apiKey: string;
  private embeddings: HuggingFaceEmbeddings;
  private readonly vectorStorePath = path.join(process.cwd(), 'vectorstore');
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
    this.embeddings = new HuggingFaceEmbeddings({ apiKey });
  }

  async onModuleInit() {
    await this.initializeVectorStore();
  }

  /**
   * Initialize or load vector store
   */
  private async initializeVectorStore(): Promise<void> {
    try {
      // Try to load existing vector store
      this.vectorStore = await FaissStore.load(
        this.vectorStorePath,
        this.embeddings,
      );
      this.logger.log('Loaded existing vector store');
    } catch (error) {
      // Create new vector store if doesn't exist
      this.logger.log('Creating new vector store from CSV data');
      const docs = await this.loadInitialDocuments();
      this.vectorStore = await FaissStore.fromDocuments(docs, this.embeddings);
      await this.vectorStore.save(this.vectorStorePath);
      this.logger.log('Vector store created and saved');
    }
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
          if (row.content) {
            documents.push(
              new Document({
                pageContent: row.content,
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
    await this.vectorStore.save(this.vectorStorePath);
    this.logger.log('Document added to vector store');
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
        const match = question.match(/realm\s+(\w+)/i);
        if (match) {
          const realmData = await this.blizzardService.getRealmData(match[1]);
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

    // Create prompt for DeepSeek
    const prompt = `You are a knowledgeable World of Warcraft assistant. Use the following context to answer the question.
If you don't know the answer based on the context, say so.

Context:
${context}${blizzardContext}

Question: ${question}

Answer:`;

    // Query DeepSeek model via HuggingFace Inference API
    try {
      const response = await fetch(
        'https://api-inference.huggingface.co/models/deepseek-ai/DeepSeek-V3.2-Exp',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            inputs: prompt,
            parameters: {
              max_new_tokens: 500,
              temperature: 0.7,
              top_p: 0.95,
              return_full_text: false,
            },
          }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`HuggingFace API error: ${response.statusText} - ${errorText}`);
        throw new Error(`Failed to query DeepSeek: ${response.statusText}`);
      }

      const data = await response.json();

      // Handle different response formats
      if (Array.isArray(data) && data.length > 0) {
        return data[0].generated_text || data[0];
      } else if (data.generated_text) {
        return data.generated_text;
      } else if (typeof data === 'string') {
        return data;
      }

      this.logger.error('Unexpected response format from DeepSeek');
      throw new Error('Unexpected response format from DeepSeek model');
    } catch (error) {
      this.logger.error('Error querying DeepSeek:', error);
      throw error;
    }
  }
}
