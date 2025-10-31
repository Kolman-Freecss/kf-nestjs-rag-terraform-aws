import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as csvParser from "csv-parser";
import * as fs from "fs";
import { Document } from "langchain/document";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import * as path from "path";
import { encoding_for_model, type Tiktoken } from "tiktoken";
import { BlizzardService } from "../blizzard/blizzard.service";
import { LangSmithConfig } from "./agents/langsmith-config";
import { RagAgent } from "./agents/rag-agent";
import { RagWorkflow } from "./agents/workflows";
import { EmbeddingsFactory } from "./embeddings/embeddings.factory";
import { EmbeddingsConfig, EmbeddingsProvider } from "./embeddings/embeddings.interface";
import { LangGraphWorkflow } from "./langgraph/workflow";
import { WorkflowNodes } from "./langgraph/nodes";
import { WorkflowEdges } from "./langgraph/edges";

/**
 * RAG Service with LangGraph Multi-Agent Workflow
 * Uses LangGraph to orchestrate multiple agents for intelligent query processing
 */
@Injectable()
export class RagService implements OnModuleInit {
  private readonly logger = new Logger(RagService.name);
  private vectorStore: MemoryVectorStore | null = null;
  private readonly embeddings: EmbeddingsProvider;
  private readonly apiKey: string;
  private readonly dataDir = path.join(process.cwd(), "data");
  private readonly textSplitter: RecursiveCharacterTextSplitter;
  private tokenizer: Tiktoken;

  // Legacy RAG system (kept for fallback)
  private ragWorkflow: RagWorkflow;
  private ragAgent: RagAgent;

  // LangGraph system (injected via constructor)

  constructor(
    private readonly configService: ConfigService,
    private readonly blizzardService: BlizzardService,
    private readonly workflowNodes: WorkflowNodes,
    private readonly workflowEdges: WorkflowEdges,
    private readonly langGraphWorkflow: LangGraphWorkflow,
  ) {
    const apiKey = this.configService.get<string>("HUGGINGFACE_API_KEY");
    const embeddingsProvider = this.configService.get<string>("EMBEDDINGS_PROVIDER") || "local";
    const embeddingsApiUrl = this.configService.get<string>("EMBEDDINGS_API_URL") || "http://localhost:8000";
    const langsmithApiKey = this.configService.get<string>("LANGSMITH_API_KEY");

    this.apiKey = apiKey || "";

    // Initialize LangSmith tracing
    LangSmithConfig.initialize(langsmithApiKey);

    // Create embeddings provider based on configuration
    const embeddingsConfig: EmbeddingsConfig = {
      provider: embeddingsProvider as 'local' | 'huggingface',
      apiKey: this.apiKey,
      modelName: "Xenova/all-MiniLM-L6-v2",
      apiUrl: embeddingsApiUrl,
    };

    this.embeddings = EmbeddingsFactory.create(embeddingsConfig);
    this.logger.log(`Using embeddings provider: ${this.embeddings.providerName}`);

    this.textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 500,
      chunkOverlap: 50,
      separators: ["\n\n", "\n", ". ", ", ", " ", ""],
    });

    this.tokenizer = encoding_for_model("gpt-3.5-turbo");

    // Initialize legacy RAG agent (for fallback)
    this.ragAgent = new RagAgent(this.configService, this.blizzardService);
    this.ragWorkflow = new RagWorkflow(this.ragAgent);

    this.logger.log("RAG Service with LangGraph Multi-Agent Workflow initialized");
  }

  async onModuleInit() {
    await this.initializeVectorStore();

    // Set up legacy agent with vector store after initialization
    if (this.vectorStore && this.allLoadedDocs) {
      this.ragWorkflow.initializeVectorStore(this.vectorStore, this.allLoadedDocs);
    }

    // Initialize LangGraph workflow
    this.langGraphWorkflow.initializeWorkflow();
    this.logger.log("LangGraph workflow initialized and ready");
  }

  /**
   * Initialize or load vector store
   */
  private async initializeVectorStore(): Promise<void> {
    // MemoryVectorStore doesn't persist, so always create from docs
    this.logger.log("Creating new vector store from CSV data");
    const docs = await this.loadInitialDocuments();
    this.allLoadedDocs = docs; // Store for keyword search
    this.vectorStore = await MemoryVectorStore.fromDocuments(docs, this.embeddings);
    this.logger.log(`Vector store created with ${docs.length} documents in memory`);
  }

  /**
   * Load initial documents from all CSV files in data directory
   */
  private async loadInitialDocuments(): Promise<Document[]> {
    if (!fs.existsSync(this.dataDir)) {
      this.logger.warn(`Data directory not found at ${this.dataDir}, using empty knowledge base`);
      return [];
    }

    const csvFiles = fs.readdirSync(this.dataDir).filter(file => file.endsWith('.csv'));
    this.logger.log(`Found ${csvFiles.length} CSV files to load`);

    const allDocuments: Document[] = [];

    for (const csvFile of csvFiles) {
      const filePath = path.join(this.dataDir, csvFile);
      const docs = await this.loadCsvFile(filePath, csvFile);
      allDocuments.push(...docs);
    }

    this.logger.log(`Loaded total of ${allDocuments.length} rows from all CSV files`);
    return allDocuments;
  }

  /**
   * Load documents from a single CSV file
   */
  private async loadCsvFile(filePath: string, fileName: string): Promise<Document[]> {
    return new Promise(async (resolve, reject) => {
      const rows: Document[] = [];

      fs.createReadStream(filePath)
        .pipe(csvParser())
        .on("data", (row) => {
          if (row.content && row.content.trim().length > 0) {
            rows.push(
              new Document({
                pageContent: row.content.trim(),
                metadata: {
                  source: fileName.replace('.csv', ''),
                  topic: row.topic || "general",
                },
              }),
            );
          }
        })
        .on("end", async () => {
          this.logger.log(`Loaded ${rows.length} rows from ${fileName}`);
          
          const chunkedDocs: Document[] = [];
          for (const doc of rows) {
            const splits = await this.textSplitter.createDocuments(
              [doc.pageContent],
              [doc.metadata]
            );
            chunkedDocs.push(...splits);
          }
          
          this.logger.log(`Split into ${chunkedDocs.length} chunks from ${fileName}`);
          resolve(chunkedDocs);
        })
        .on("error", (error) => {
          this.logger.error(`Error reading CSV file ${fileName}:`, error);
          reject(error);
        });
    });
  }

  private allLoadedDocs: Document[] = [];

  /**
   * Classify query type using LLM (aggregation vs specific)
   */
  private async classifyQuery(question: string): Promise<boolean> {
    const prompt = `Classify this question as either SPECIFIC or AGGREGATION.

SPECIFIC: Questions asking about one particular item, fact, or entity.
Examples: "What is X?", "Tell me about Y", "Which one is Z?"

AGGREGATION: Questions asking about multiple items, counting, listing all.
Examples: "How many X are there?", "List all Y", "What are the Z?"

Question: ${question}

Answer with only one word: SPECIFIC or AGGREGATION`;

    try {
      const response = await this.callHfModel("katanemo/Arch-Router-1.5B", prompt, {});
      const classification = response.trim().toUpperCase();
      return classification.includes('AGGREGATION');
    } catch (error) {
      this.logger.warn('Query classification failed, defaulting to SPECIFIC');
      return false;
    }
  }

  /**
   * Keyword-based search as fallback (searches in loaded documents)
   */
  private async keywordSearch(question: string, limit: number): Promise<Document[]> {
    const qLower = question.toLowerCase();
    const qTokens = qLower.split(/\W+/).filter(t => t.length > 2);
    
    return this.allLoadedDocs
      .map(doc => {
        const text = (doc.pageContent || '').toLowerCase();
        const source = (doc.metadata?.source || '').toLowerCase();
        const topic = (doc.metadata?.topic || '').toLowerCase();
        
        let score = 0;
        qTokens.forEach(token => {
          if (text.includes(token)) score += 2;
          if (source.includes(token)) score += 3;
          if (topic.includes(token)) score += 3;
        });
        
        return { doc, score };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(item => item.doc);
  }

  /**
   * Merge vector and keyword results, removing duplicates
   */
  private mergeResults(vectorResults: Document[], keywordResults: Document[]): Document[] {
    const seen = new Set<string>();
    const merged: Document[] = [];
    
    for (const doc of [...vectorResults, ...keywordResults]) {
      const key = `${doc.metadata?.source}:${doc.pageContent.substring(0, 50)}`;
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(doc);
      }
    }
    
    return merged;
  }

  /**
   * Diversify results to include documents from different sources (for aggregation)
   */
  private diversifyResults(docs: Document[], limit: number): Document[] {
    const result: Document[] = [];
    const sourceCount = new Map<string, number>();
    
    // First pass: take best from each unique source
    for (const doc of docs) {
      const source = doc.metadata?.source || 'unknown';
      const count = sourceCount.get(source) || 0;
      
      if (count < 2) { // Max 2 docs per source in first pass
        result.push(doc);
        sourceCount.set(source, count + 1);
      }
      
      if (result.length >= limit) break;
    }
    
    // Second pass: fill remaining with highest scored
    if (result.length < limit) {
      for (const doc of docs) {
        if (!result.includes(doc)) {
          result.push(doc);
          if (result.length >= limit) break;
        }
      }
    }
    
    return result;
  }

  /**
   * Get all documents in the vector store (for debugging)
   */
  async getAllDocuments(): Promise<any> {
    return {
      total: this.allLoadedDocs.length,
      documents: this.allLoadedDocs.map((doc, idx) => ({
        index: idx + 1,
        source: doc.metadata?.source,
        topic: doc.metadata?.topic,
        content: doc.pageContent,
      })),
      sources: [...new Set(this.allLoadedDocs.map(d => d.metadata?.source))],
      topics: [...new Set(this.allLoadedDocs.map(d => d.metadata?.topic))],
    };
  }

  /**
   * Get information about the RAG agents and workflow
   */
  async getAgentInfo(): Promise<any> {
    return {
      system_type: "langgraph-multi-agent",
      langgraph_enabled: true,
      legacy_agent: {
        name: this.ragAgent.name,
        description: this.ragAgent.description,
        langchain_enabled: true,
        tools_available: 3, // knowledge_search, get_realm_info, get_character_info
      },
      langgraph_workflow: {
        nodes: ["initialize", "rag_agent", "blizzard_agent", "synthesis"],
        edges: ["afterInitialize", "afterRagAgent", "afterBlizzardAgent", "afterSynthesis"],
        parallel_execution: true,
        max_iterations: 3,
        confidence_threshold: 0.6,
      },
      langsmith_enabled: LangSmithConfig.isEnabled(),
      system_status: "langgraph-multi-agent-active"
    };
  }

  /**
   * Debug method: retrieve documents without generating answer
   */
  async debugQuery(question: string): Promise<any> {
    if (!this.vectorStore) {
      throw new Error("Vector store not initialized");
    }
    
    const retrieved = await this.vectorStore.similaritySearch(question, 8);
    const reranked = this.rerankDocuments(question, retrieved).slice(0, 6);
    const { context, docIndexMap } = this.buildContextFromDocs(reranked, 750);
    
    return {
      question,
      totalRetrieved: retrieved.length,
      retrievedDocs: retrieved.map((doc, idx) => ({
        rank: idx + 1,
        source: doc.metadata?.source,
        topic: doc.metadata?.topic,
        content: doc.pageContent,
      })),
      topReranked: reranked.map((doc, idx) => ({
        rank: idx + 1,
        source: doc.metadata?.source,
        topic: doc.metadata?.topic,
        content: doc.pageContent,
      })),
      contextUsed: context,
    };
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
   * Query using LangGraph multi-agent workflow for intelligent routing and processing
   */
  async query(question: string): Promise<string> {
    this.logger.log(`Processing query with LangGraph multi-agent workflow: ${question.substring(0, 100)}...`);

    try {
      // Log operation to LangSmith if enabled
      LangSmithConfig.logOperation("langgraph_query_start", {
        question: question.substring(0, 200),
        timestamp: new Date().toISOString(),
        workflow_type: "langgraph"
      });

      if (!this.vectorStore) {
        throw new Error("Vector store not initialized");
      }

      // Use LangGraph workflow to process the query
      const result = await this.langGraphWorkflow.execute(
        question,
        this.vectorStore
      );

      // Log successful completion
      LangSmithConfig.logOperation("langgraph_query_complete", {
        question: question.substring(0, 200),
        confidence: result.confidence,
        agent: result.metadata?.agent,
        response_length: result.answer.length,
        documents_used: result.sources.length
      });

      this.logger.log(`LangGraph query completed by agent: ${result.metadata?.agent} (confidence: ${result.confidence})`);

      return result.answer;

    } catch (error) {
      this.logger.error(`LangGraph query failed:`, error);

      // Log error to LangSmith
      LangSmithConfig.logOperation("langgraph_query_error", {
        question: question.substring(0, 200),
        error: error.message,
        workflow_type: "langgraph"
      });

      // Fallback to legacy RAG workflow if LangGraph fails
      this.logger.warn("Falling back to legacy RAG workflow");
      return this.fallbackToLegacyQuery(question);
    }
  }

  /**
   * Fallback query method using legacy RAG workflow
   */
  private async fallbackToLegacyQuery(question: string): Promise<string> {
    try {
      // Use the legacy RAG workflow
      const result = await this.ragWorkflow.run({
        question,
        metadata: {
          query_timestamp: new Date().toISOString(),
          agent_system: "legacy-fallback"
        }
      });

      return result.answer;
    } catch (error) {
      this.logger.error("Legacy RAG workflow also failed:", error);
      
      // Final fallback - simple similarity search
      if (!this.vectorStore) {
        throw new Error("Vector store not initialized");
      }

      const docs = await this.vectorStore.similaritySearch(question, 3);
      const formatted = docs.map((doc, idx) =>
        `${idx + 1}. ${doc.pageContent.substring(0, 200)}...`
      ).join('\n\n');

      return `Fallback response - Based on available information:\n\n${formatted}`;
    }
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
          const generated = await this.callHfModel(model, prompt, {});

          if (!generated || generated.trim().length === 0) {
            this.logger.warn(`Model ${model} returned empty response`);
            continue;
          }

          this.logger.log(`Model ${model} returned an answer, running verifier`);
          
          // First check: Simple lexical verification - does answer contain words from context?
          const lexicalCheck = this.simpleLexicalVerification(generated.trim(), context);
          if (!lexicalCheck.valid) {
            this.logger.warn(`Model ${model} failed lexical verification: ${lexicalCheck.reason}`);
            continue;
          }
          
          // Second check: LLM-based verification
          const verification = await this.verifyAnswer(
            model,
            generated.trim(),
            context,
            docIndexMap,
          );
          if (verification?.confident) return generated.trim();
          this.logger.warn(
            `Model ${model} verification failed: ${verification?.reason || "unknown"}`,
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
   * Generic lexical verification: checks if key terms in answer exist in context
   */
  private simpleLexicalVerification(
    answer: string,
    context: string,
  ): { valid: boolean; reason?: string } {
    const contextLower = context.toLowerCase();
    const answerLower = answer.toLowerCase();
    
    // 1. Check quoted phrases (exact matches required)
    const quotedPhrases = answer.match(/'([^']+)'|"([^"]+)"/g) || [];
    for (const phrase of quotedPhrases) {
      const clean = phrase.replace(/['"]/g, '').toLowerCase();
      if (clean.length > 5 && !contextLower.includes(clean)) {
        this.logger.warn(`Verification failed: Quoted "${clean}" not in context`);
        return { valid: false, reason: `Quoted phrase not found in context` };
      }
    }
    
    // 2. Check multi-word proper nouns (likely invented names)
    const properNouns = answer.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}\b/g) || [];
    for (const noun of properNouns) {
      const nounLower = noun.toLowerCase();
      // Only validate if 3+ words or looks like a title
      if (noun.split(' ').length >= 2 && !contextLower.includes(nounLower)) {
        this.logger.warn(`Verification failed: Proper noun "${noun}" not in context`);
        return { valid: false, reason: `Multi-word proper noun not found in context` };
      }
    }
    
    // 3. Check that answer doesn't start with the question (repetition check)
    const answerStart = answerLower.substring(0, 50);
    if (answerStart.includes('let') && answerStart.includes('tackle') || 
        answerStart.includes('user is asking')) {
      this.logger.warn(`Verification failed: Answer repeats/analyzes question`);
      return { valid: false, reason: `Answer repeats the question` };
    }
    
    return { valid: true };
  }

  /**
   * Rerank documents using generic scoring based on lexical overlap and metadata.
   */
  private rerankDocuments(question: string, docs: Document[]): Document[] {
    const qLower = question.toLowerCase();
    const qTokens = qLower.split(/\W+/).filter(t => t.length > 2);
    
    return docs
      .map((doc) => {
        const text = (doc.pageContent || "").toLowerCase();
        const tokens = text.split(/\W+/).filter(Boolean);
        const source = (doc.metadata?.source || '').toLowerCase();
        const topic = (doc.metadata?.topic || '').toLowerCase();
        
        let score = 0;
        
        // 1. Exact phrase match (very strong signal)
        if (text.includes(qLower)) score += 10;
        
        // 2. Token overlap (TF-IDF style without IDF)
        const tokenOverlap = qTokens.filter(t => tokens.includes(t)).length;
        score += (tokenOverlap / Math.max(qTokens.length, 1)) * 5;
        
        // 3. Metadata overlap (generic - matches any metadata field)
        qTokens.forEach(qt => {
          if (source.includes(qt)) score += 8;
          if (topic.includes(qt)) score += 6;
        });
        
        // 4. Content in question matches document metadata fields
        if (source && qLower.includes(source.replace(/_/g, ' '))) score += 12;
        if (topic && qLower.includes(topic.replace(/_/g, ' '))) score += 10;
        
        return { doc, score };
      })
      .sort((a, b) => b.score - a.score)
      .map((x) => x.doc);
  }

  /** Build a context string from documents but cap by token budget. Returns a map of docs indices used.
   *
   * Iterates through documents until the token budget is exhausted.
   * This allows aggregation queries to include ALL relevant docs up to the limit.
   */
  private buildContextFromDocs(
    docs: Document[],
    maxTokens = 750,
  ): { context: string; docIndexMap: Record<number, Document>; docsIncluded: number; docsSkipped: number } {
    let tokens = 0;
    const parts: string[] = [];
    const map: Record<number, Document> = {};
    let included = 0;
    
    for (let i = 0; i < docs.length; i++) {
      const doc = docs[i];
      const header = `[doc:${i + 1} | topic:${doc.metadata?.topic || "unknown"} | source:${doc.metadata?.source || "unknown"}]\n`;
      const text = `${header}${doc.pageContent}\n---\n`;
      
      const textTokens = this.tokenizer.encode(text).length;
      if (tokens + textTokens > maxTokens) break;
      
      parts.push(text);
      map[i + 1] = doc;
      tokens += textTokens;
      included++;
    }
    
    return { 
      context: parts.join("\n"), 
      docIndexMap: map,
      docsIncluded: included,
      docsSkipped: docs.length - included
    };
  }

  /** Build user-friendly formatted response from documents */
  private formatDocumentsForUser(docs: Document[]): string {
    return docs.map((doc, idx) => {
      const source = doc.metadata?.source || 'unknown';
      const sourceName = source.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      return `${idx + 1}. **${sourceName}**\n   ${doc.pageContent}`;
    }).join('\n\n');
  }

  /** Call the HuggingFace Inference API for a given model and prompt. */
  private async callHfModel(
    model: string,
    prompt: string,
    params: Record<string, any>,
  ): Promise<string> {
    // Use chat completions endpoint for the new models
    const endpoint = "https://router.huggingface.co/v1/chat/completions";

    const requestBody = {
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      model: `${model}:hf-inference`,
    };

    this.logger.log(`Calling model ${model} | params: ${JSON.stringify(params)} | endpoint: ${endpoint}`);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const txt = await response.text();
      this.logger.warn(`HF model ${model} returned status ${response.status}: ${txt}`);
      return "";
    }

    const data = await response.json();
    if (data.error) {
      this.logger.warn(`Model ${model} error:`, data.error);
      return "";
    }

    // Extract the response from chat completion format
    return data.choices?.[0]?.message?.content || "";
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
    const verifierPrompt = `You are a strict verifier. Check if EVERY word and claim in the answer below comes directly from the context documents.

VERIFICATION RULES:
1. The answer must quote or paraphrase text that exists in the context
2. NO external knowledge allowed - if information is not in context, it's NOT VERIFIED
3. Check that citations [doc:N] reference valid documents
4. Any made-up facts, names, or details = NOT VERIFIED

Context:
${context}

Answer:
${answer}

Respond ONLY with:
- "VERIFIED" if every claim comes from the context
- "NOT VERIFIED: <specific invented facts>" if any information was added

Result:`;

    try {
      const v = await this.callHfModel(model, verifierPrompt, {});
      this.logger.log(`Verifier result: ${v}`);
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
}
