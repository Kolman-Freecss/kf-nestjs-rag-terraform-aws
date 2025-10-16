import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { HuggingFaceInferenceEmbeddings } from "@langchain/community/embeddings/hf";
import { Document } from "langchain/document";
import { BlizzardService } from "../blizzard/blizzard.service";
import { ModelFactory } from "./models/factory/model.factory";
import { AgentOrchestratorImpl } from "./agents/orchestrator/agent.orchestrator";
import { SimilarityAgentImpl } from "./agents/implementations/similarity.agent";
import { GenerationAgentImpl } from "./agents/implementations/generation.agent";
import { RAGConfigLoader, RAGConfig } from "./config/rag.config";
import { ModelType, SimilarityClient, TextGenerationClient } from "./models/interfaces/model.interfaces";
import { AgentType, AgentContext } from "./agents/interfaces/agent.interfaces";
import * as path from "path";
import * as fs from "fs";
import * as csvParser from "csv-parser";

/**
 * Enhanced RAG Service with multi-agent architecture and scalable model management
 * Supports multiple HuggingFace models with different API patterns
 */
@Injectable()
export class RagService implements OnModuleInit {
  private readonly logger = new Logger(RagService.name);
  private vectorStore: MemoryVectorStore | null = null;
  private readonly embeddings: HuggingFaceInferenceEmbeddings;
  private readonly apiKey: string;
  private readonly dataPath = path.join(process.cwd(), "data", "initial-knowledge.csv");
  private readonly config: RAGConfig;
  private readonly orchestrator: AgentOrchestratorImpl;
  private similarityAgent: SimilarityAgentImpl | null = null;
  private generationAgent: GenerationAgentImpl | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly blizzardService: BlizzardService,
    private readonly modelFactory: ModelFactory,
  ) {
    const apiKey = this.configService.get<string>("HUGGINGFACE_API_KEY");

    if (!apiKey) {
      throw new Error("HUGGINGFACE_API_KEY is required");
    }

    this.apiKey = apiKey;
    this.config = RAGConfigLoader.loadFromEnv();
    this.orchestrator = new AgentOrchestratorImpl();

    // Keep backward compatibility with existing embedding system
    this.embeddings = new HuggingFaceInferenceEmbeddings({
      apiKey,
      model: "sentence-transformers/all-MiniLM-L6-v2",
    });

    this.logger.log("Enhanced RAG Service initialized with multi-agent architecture");
  }

  async onModuleInit() {
    await this.initializeVectorStore();
    await this.initializeAgents();
  }

  /**
   * Initialize or load vector store
   */
  private async initializeVectorStore(): Promise<void> {
    // MemoryVectorStore doesn't persist, so always create from docs
    this.logger.log("Creating new vector store from CSV data");
    const docs = await this.loadInitialDocuments();
    this.vectorStore = await MemoryVectorStore.fromDocuments(docs, this.embeddings);
    this.logger.log("Vector store created in memory");
  }

  /**
   * Initialize agents for multi-agent RAG workflow
   */
  private async initializeAgents(): Promise<void> {
    try {
      // Initialize similarity agent
      if (this.config.agents.enabled[AgentType.SIMILARITY]) {
        const similarityConfig = this.config.agents.instances['primary-similarity'];
        if (similarityConfig) {
          this.similarityAgent = new SimilarityAgentImpl(
            {
              name: 'primary-similarity',
              modelNames: similarityConfig.models,
              fallbackModels: similarityConfig.fallbackModels,
              maxRetries: similarityConfig.maxRetries,
              timeout: similarityConfig.timeout,
              customSettings: similarityConfig.customSettings,
            },
            this.modelFactory,
          );
          await this.similarityAgent.initialize();
          this.orchestrator.registerAgent(this.similarityAgent);
        }
      }

      // Initialize generation agent
      if (this.config.agents.enabled[AgentType.GENERATION]) {
        const generationConfig = this.config.agents.instances['primary-generation'];
        if (generationConfig) {
          this.generationAgent = new GenerationAgentImpl(
            {
              name: 'primary-generation',
              modelNames: generationConfig.models,
              fallbackModels: generationConfig.fallbackModels,
              maxRetries: generationConfig.maxRetries,
              timeout: generationConfig.timeout,
              customSettings: generationConfig.customSettings,
            },
            this.modelFactory,
          );
          await this.generationAgent.initialize();
          this.orchestrator.registerAgent(this.generationAgent);
        }
      }

      this.logger.log("Multi-agent system initialized successfully");
    } catch (error) {
      this.logger.error("Failed to initialize agents:", error);
      throw error;
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
        .on("data", (row) => {
          // Filter out empty/undefined content and trim whitespace
          if (row.content && row.content.trim().length > 0) {
            documents.push(
              new Document({
                pageContent: row.content.trim(),
                metadata: {
                  source: "knowledge-base",
                  topic: row.topic || "general",
                },
              }),
            );
          }
        })
        .on("end", () => {
          this.logger.log(`Loaded ${documents.length} documents from CSV`);
          resolve(documents);
        })
        .on("error", (error) => {
          this.logger.error("Error reading CSV file:", error);
          reject(error);
        });
    });
  }

  /**
   * Add custom documents to the knowledge base
   */
  async addDocument(content: string, metadata: Record<string, any> = {}): Promise<void> {
    if (!this.vectorStore) {
      throw new Error("Vector store not initialized");
    }

    const doc = new Document({
      pageContent: content,
      metadata: { ...metadata, source: "user-added" },
    });

    await this.vectorStore.addDocuments([doc]);
    this.logger.log("Document added to vector store (in-memory only)");
  }

  /**
   * Enhanced query method using multi-agent RAG architecture
   * Supports different model types and provides fallback mechanisms
   */
  async query(question: string): Promise<string> {
    if (!this.vectorStore) {
      throw new Error("Vector store not initialized");
    }

    try {
      // Use the new multi-agent approach if agents are available
      if (this.similarityAgent && this.generationAgent) {
        return await this.queryWithAgents(question);
      }

      // Fallback to legacy approach
      return await this.queryLegacy(question);
    } catch (error) {
      this.logger.error("Query failed:", error);
      
      // Final fallback to legacy approach
      try {
        return await this.queryLegacy(question);
      } catch (fallbackError) {
        this.logger.error("Fallback query also failed:", fallbackError);
        return `I apologize, but I'm unable to process your question at the moment due to technical difficulties. Please try again later.`;
      }
    }
  }

  /**
   * Query using the new multi-agent architecture
   */
  private async queryWithAgents(question: string): Promise<string> {
    // Step 1: Retrieve relevant documents
    const retrieved = await this.vectorStore!.similaritySearch(
      question, 
      this.config.retrieval.defaultTopK + 2
    );

    // Step 2: Use similarity agent for reranking if enabled
    let relevantDocs = retrieved;
    if (this.similarityAgent && this.config.retrieval.rerankingEnabled) {
      const rankingResult = await this.similarityAgent.hybridRankDocuments(
        question,
        retrieved,
        this.config.retrieval.hybridWeights.semantic,
        this.config.retrieval.hybridWeights.lexical,
      );
      
      if (rankingResult.success) {
        relevantDocs = rankingResult.data!.slice(0, this.config.retrieval.defaultTopK);
        this.logger.log(`Documents reranked using ${this.similarityAgent.name}`);
      } else {
        this.logger.warn("Document reranking failed, using original order");
        relevantDocs = retrieved.slice(0, this.config.retrieval.defaultTopK);
      }
    } else {
      relevantDocs = retrieved.slice(0, this.config.retrieval.defaultTopK);
    }

    // Step 3: Fetch Blizzard API data if relevant
    const blizzardContext = await this.fetchBlizzardContext(question);

    // Step 4: Create agent context
    const agentContext: AgentContext = {
      query: question,
      documents: relevantDocs,
      metadata: {
        blizzardContext,
        retrievalMethod: 'vector-similarity',
        rerankingUsed: this.config.retrieval.rerankingEnabled,
      },
    };

    // Step 5: Use generation agent to create response
    if (this.generationAgent) {
      const generationResult = this.config.generation.verificationEnabled
        ? await this.generationAgent.generateWithVerification(question, agentContext, {
            maxTokens: this.config.generation.defaultMaxTokens,
            temperature: this.config.generation.defaultTemperature,
            topP: this.config.generation.defaultTopP,
            requireCitations: this.config.generation.requireCitations,
            includeContext: true,
            stopSequences: this.config.generation.stopSequences,
          })
        : await this.generationAgent.generate(question, agentContext, {
            maxTokens: this.config.generation.defaultMaxTokens,
            temperature: this.config.generation.defaultTemperature,
            topP: this.config.generation.defaultTopP,
            requireCitations: this.config.generation.requireCitations,
            includeContext: true,
            stopSequences: this.config.generation.stopSequences,
          });

      if (generationResult.success) {
        const response = this.config.generation.verificationEnabled 
          ? (generationResult.data as any).text 
          : generationResult.data as string;
        
        // Add metadata about the generation process
        const metadata = this.config.generation.verificationEnabled 
          ? `\n\n_Generated using ${generationResult.metadata?.modelUsed || 'unknown model'} (verified: ${(generationResult.data as any).verified}, confidence: ${((generationResult.data as any).confidence * 100).toFixed(1)}%)_`
          : `\n\n_Generated using ${generationResult.metadata?.modelUsed || 'unknown model'}_`;

        return response + (process.env.NODE_ENV === 'development' ? metadata : '');
      } else {
        this.logger.warn("Generation agent failed:", generationResult.error);
      }
    }

    // Fallback to legacy approach if agents fail
    return await this.queryLegacy(question);
  }

  /**
   * Legacy query method (backward compatibility)
   */
  private async queryLegacy(question: string): Promise<string> {
    // Retrieve relevant documents (fetch more and rerank)
    const retrieved = await this.vectorStore!.similaritySearch(question, 8);

    // Simple lexical reranking to improve relevance (cheap fallback to no extra infra)
    const relevantDocs = this.rerankDocuments(question, retrieved).slice(0, 6);

    // Try to fetch live data from Blizzard API if question seems related
    const blizzardContext = await this.fetchBlizzardContext(question);
    
    // Build context with a character budget to avoid exceeding LLM input limits
    const { context, docIndexMap } = this.buildContextFromDocs(relevantDocs, 3000);

    // Build prompt template instructing the model to cite sources and be grounded
    const prompt = `You are a helpful assistant answering questions strictly using only the supplied information and live data. Be concise and factual. For any factual claim include citations to the provided documents using the notation [doc:N]. If you cannot answer confidently from the provided information, say "I don't know" and list the relevant documents.

Information:
${context}${blizzardContext}

Question: ${question}

Answer (include citations like [doc:1], [doc:2] when applicable):`;

    // Try models with verification and backoff
    const modelList = [
      "google/embeddinggemma-300m",
      "ibm-granite/granite-embedding-english-r2",
      "distilbert/distilbert-base-uncased",
    ];
    const answer = await this.tryModelsWithVerification(modelList, prompt, context, docIndexMap);
    if (answer) return answer;

    // As a safe fallback, return the retrieved context with guidance
    this.logger.warn(
      "All LLM models failed verification or unavailable, returning retrieved context",
    );
    return `Based on the World of Warcraft knowledge base (retrieved documents):\n\n${context}${blizzardContext}\n\n⚠️ Note: The system could not produce a verified AI answer; please check the sources above.`;
  }

  /**
   * Fetch Blizzard API context if relevant to the question
   */
  private async fetchBlizzardContext(question: string): Promise<string> {
    try {
      // Simple keyword matching for demonstration
      const hasRealm = question.toLowerCase().includes("realm");
      if (hasRealm) {
        // Match realm name - includes letters, numbers, hyphens, and apostrophes
        const re = /realm\s+([\w-']+(?:\s+[\w-']+)*)/i;
        const m = re.exec(question);
        if (m?.[1]) {
          const realmSlug = m[1].toLowerCase().replace(/\s+/g, "-").replace(/'/g, "");
          const realmData = await this.blizzardService.getRealmData(realmSlug);
          return `\n\nLive Blizzard API Data:\n${JSON.stringify(realmData, null, 2)}`;
        }
      }
    } catch (error) {
      this.logger.warn("Could not fetch Blizzard API data:", error);
    }
    return "";
  }

  /** Try a list of models with retries, verification and backoff. Returns verified answer or empty string */
  private async tryModelsWithVerification(
    models: string[],
    prompt: string,
    context: string,
    docIndexMap: Record<number, Document>,
  ): Promise<string> {
    for (const model of models) {
      let attempt = 0;
      const maxAttempts = 3;
      while (attempt < maxAttempts) {
        attempt += 1;
        try {
          this.logger.log(`Calling model ${model} (attempt ${attempt})`);
          const generated = await this.callHfModel(model, prompt, {
            max_new_tokens: 300, // limit response length
            temperature: 0.0, // deterministic
            top_p: 1.0, // no nucleus sampling for consistency
            do_sample: false, // no sampling for consistency
            return_full_text: false, // only return generated part
            stop: ["\n\n"], // stop at double newline
          });

          if (!generated || generated.trim().length === 0) {
            this.logger.warn(`Model ${model} returned empty response`);
            continue;
          }

          this.logger.log(`Model ${model} returned an answer, running verifier`);
          const verification = await this.verifyAnswer(
            model,
            generated.trim(),
            context,
            docIndexMap,
          );
          if (verification?.confident) return generated.trim();
          this.logger.warn(
            `Model ${model} verification failed or not confident: ${verification?.reason || "unknown"}`,
          );
        } catch (error) {
          this.logger.error(`Error calling model ${model}: ${error?.message || error}`);
          await this.sleep(500 * attempt);
        }
      }
    }
    return "";
  }

  /**
   * Rerank documents with a cheap lexical overlap scorer.
   * This provides a simple re-ordering without additional API calls.
   *
   * How it works:
   * - Tokenize the question and each document's content.
   * - Calculate the overlap score between the question and each document.
   * - Normalize the overlap score by dividing it by the length of the document's tokens.
   * - Sort the documents based on their normalized overlap scores.
   */
  private rerankDocuments(question: string, docs: Document[]): Document[] {
    // Tokenize the question and each document's content. By tokenizing, we ensure that the overlap score is calculated based on the actual words in the documents, rather than just the number of characters.
    // How to tokenize: Split the text into words using a regular expression that matches non-word characters.
    const qTokens = question
      .toLowerCase()
      .split(/[^\w']+/)
      .filter(Boolean);
    return docs
      .map((doc) => {
        const text = (doc.pageContent || "").toLowerCase();
        const tokens = text.split(/[^\w']+/).filter(Boolean);
        // overlap score
        const overlap = qTokens.reduce((acc, t) => acc + (tokens.includes(t) ? 1 : 0), 0);
        const norm = tokens.length ? overlap / tokens.length : 0;
        return { doc, score: norm };
      })
      .sort((a, b) => b.score - a.score)
      .map((x) => x.doc);
  }

  /** Build a context string from documents but cap by character budget. Returns a map of docs indices used.
   *
   * Why? Because we want to ensure that the context string is not too long, and we want to prioritize the documents that are most relevant to the question. Because the LLM may not be able to handle long context strings, we need to cap the length of the context string.
   */
  private buildContextFromDocs(
    docs: Document[],
    maxChars = 3000,
  ): { context: string; docIndexMap: Record<number, Document> } {
    let chars = 0;
    const parts: string[] = [];
    const map: Record<number, Document> = {};
    for (let i = 0; i < docs.length; i++) {
      const doc = docs[i];
      const header = `[doc:${i + 1} | topic:${doc.metadata?.topic || "unknown"} | source:${doc.metadata?.source || "unknown"}]\n`;
      const text = `${header}${doc.pageContent}\n---\n`;
      if (chars + text.length > maxChars) break;
      parts.push(text);
      map[i + 1] = doc;
      chars += text.length;
    }
    return { context: parts.join("\n"), docIndexMap: map };
  }

  /** Call the HuggingFace Inference API for a given model and prompt. */
  private async callHfModel(
    model: string,
    prompt: string,
    params: Record<string, any>,
  ): Promise<string> {
    const response = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: params,
        options: { wait_for_model: false, use_cache: true },
      }),
    });

    if (!response.ok) {
      const txt = await response.text();
      this.logger.warn(`HF model ${model} returned status ${response.status}: ${txt}`);
      return "";
    }

    const data = await response.json();
    if (data.error && typeof data.error === "string" && data.error.includes("loading")) {
      this.logger.warn(`Model ${model} is loading`);
      return "";
    }

    let generated = "";
    if (Array.isArray(data) && data.length > 0) {
      generated = data[0].generated_text || data[0].text || "";
    } else if (data.generated_text) {
      generated = data.generated_text;
    } else if (typeof data === "string") {
      generated = data;
    }
    return generated || "";
  }

  /** Verification step: ask the LLM to check that the answer's claims are supported by the context.
   *
   * Why? Because we want to ensure that the answer is accurate and supported by the context. By asking the LLM to verify the answer, we can catch any errors or inconsistencies in the answer and provide a more reliable response.
   *
   * How? By asking the LLM to match citations in the answer against context.
   */
  private async verifyAnswer(
    model: string,
    answer: string,
    context: string,
    docIndexMap: Record<number, Document>,
  ): Promise<{ confident: boolean; reason?: string }> {
    // The verifier prompt asks the model to match citations in the answer against context
    const verifierPrompt = `You are a verifier. Given the context documents and an answer, check whether each factual claim in the answer is fully supported by the context. If all claims are supported, reply with:\n"VERIFIED\nReason: <short explanation>"\nIf some claims are NOT supported reply with:\n"NOT VERIFIED\nUnsupported: <short list of unsupported claims>"\n\nContext:\n${context}\n\nAnswer:\n${answer}\n\nResult:`;

    try {
      const v = await this.callHfModel(model, verifierPrompt, {
        max_new_tokens: 200,
        temperature: 0.0,
        do_sample: false,
      });
      if (!v) return { confident: false, reason: "no verifier response" };
      const text = v.toLowerCase();
      if (text.includes("verified")) return { confident: true, reason: "verifier confirmed" };
      return { confident: false, reason: v.trim().split("\n")[0] };
    } catch (error) {
      this.logger.warn("Verifier error:", error);
      return { confident: false, reason: "verifier error" };
    }
  }

  /**
   * Sleep for a given number of milliseconds.
   *
   * Why? Because we want to introduce a delay between requests to avoid rate limiting.
   *
   * How? By using the setTimeout function to delay the execution of the callback.
   */
  private sleep(ms: number) {
    return new Promise((res) => setTimeout(res, ms));
  }

  /**
   * Get system health status including agent and model health
   */
  async getSystemHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    agents: Record<string, boolean>;
    models: Record<string, boolean>;
    vectorStore: boolean;
  }> {
    const health = {
      status: 'healthy' as const,
      agents: {} as Record<string, boolean>,
      models: {} as Record<string, boolean>,
      vectorStore: !!this.vectorStore,
    };

    // Check agent health
    if (this.similarityAgent) {
      health.agents['similarity'] = await this.similarityAgent.isHealthy();
    }
    if (this.generationAgent) {
      health.agents['generation'] = await this.generationAgent.isHealthy();
    }

    // Check model health for primary models
    for (const modelType of Object.values(ModelType)) {
      const models = this.config.models.primary[modelType];
      for (const modelName of models) {
        try {
          health.models[modelName] = await this.modelFactory.checkModelHealth(modelName);
        } catch (error) {
          health.models[modelName] = false;
        }
      }
    }

    // Determine overall status
    const agentHealthy = Object.values(health.agents).every(Boolean);
    const modelHealthy = Object.values(health.models).some(Boolean); // At least one model healthy
    
    if (!health.vectorStore || !agentHealthy || !modelHealthy) {
      health.status = Object.values(health.models).filter(Boolean).length > 0 ? 'degraded' : 'unhealthy';
    }

    return health;
  }

  /**
   * Get configuration information
   */
  getConfiguration(): {
    models: { primary: string[]; fallback: string[] };
    agents: string[];
    retrieval: { topK: number; reranking: boolean };
    generation: { verification: boolean; citations: boolean };
  } {
    const primaryModels = Object.values(this.config.models.primary).flat();
    const fallbackModels = Object.values(this.config.models.fallback).flat();
    const enabledAgents = Object.entries(this.config.agents.enabled)
      .filter(([, enabled]) => enabled)
      .map(([type]) => type);

    return {
      models: {
        primary: primaryModels,
        fallback: fallbackModels,
      },
      agents: enabledAgents,
      retrieval: {
        topK: this.config.retrieval.defaultTopK,
        reranking: this.config.retrieval.rerankingEnabled,
      },
      generation: {
        verification: this.config.generation.verificationEnabled,
        citations: this.config.generation.requireCitations,
      },
    };
  }

  /**
   * Test different similarity models with a sample query
   */
  async testSimilarityModels(
    sourceSentence: string,
    targetSentences: string[],
  ): Promise<Record<string, { success: boolean; scores?: number[]; error?: string; responseTime: number }>> {
    const results: Record<string, any> = {};
    const similarityModels = this.config.models.primary[ModelType.SIMILARITY];

    for (const modelName of similarityModels) {
      const startTime = Date.now();
      try {
        const client = await this.modelFactory.createClient(modelName) as SimilarityClient;
        const response = await client.calculateSimilarity(sourceSentence, targetSentences);
        
        results[modelName] = {
          success: response.success,
          scores: response.success ? response.data?.scores : undefined,
          error: response.error,
          responseTime: Date.now() - startTime,
        };
      } catch (error) {
        results[modelName] = {
          success: false,
          error: error.message,
          responseTime: Date.now() - startTime,
        };
      }
    }

    return results;
  }

  /**
   * Test different text generation models with a sample prompt
   */
  async testGenerationModels(
    prompt: string,
  ): Promise<Record<string, { success: boolean; text?: string; error?: string; responseTime: number }>> {
    const results: Record<string, any> = {};
    const generationModels = this.config.models.primary[ModelType.TEXT_GENERATION];

    for (const modelName of generationModels) {
      const startTime = Date.now();
      try {
        const client = await this.modelFactory.createClient(modelName) as TextGenerationClient;
        const response = await client.generate(prompt, {
          maxNewTokens: 100,
          temperature: 0.7,
        });
        
        results[modelName] = {
          success: response.success,
          text: response.success ? response.data?.generatedText : undefined,
          error: response.error,
          responseTime: Date.now() - startTime,
        };
      } catch (error) {
        results[modelName] = {
          success: false,
          error: error.message,
          responseTime: Date.now() - startTime,
        };
      }
    }

    return results;
  }

  /**
   * Get statistics about the RAG system
   */
  getStatistics(): {
    vectorStore: { documentCount: number };
    agents: { registered: number; healthy: number };
    models: { registered: number; types: Record<ModelType, number> };
  } {
    const modelsByType: Record<ModelType, number> = {} as any;
    
    for (const modelType of Object.values(ModelType)) {
      modelsByType[modelType] = this.config.models.primary[modelType].length;
    }

    return {
      vectorStore: {
        documentCount: this.vectorStore?.memoryVectors?.length || 0,
      },
      agents: {
        registered: this.orchestrator.getWorkflowStats().totalAgents,
        healthy: 0, // Would need async health checks
      },
      models: {
        registered: Object.values(this.config.models.primary).flat().length,
        types: modelsByType,
      },
    };
  }
}
