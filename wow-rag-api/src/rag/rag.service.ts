import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { HuggingFaceInferenceEmbeddings } from "@langchain/community/embeddings/hf";
import { Document } from "langchain/document";
import { BlizzardService } from "../blizzard/blizzard.service";
import * as path from "path";
import * as fs from "fs";
import * as csvParser from "csv-parser";

/**
 * Simplified RAG Service with basic functionality
 * Uses vector similarity search and LLM to generate responses
 */
@Injectable()
export class RagService implements OnModuleInit {
  private readonly logger = new Logger(RagService.name);
  private vectorStore: MemoryVectorStore | null = null;
  private readonly embeddings: HuggingFaceInferenceEmbeddings;
  private readonly apiKey: string;
  private readonly dataPath = path.join(process.cwd(), "data", "initial-knowledge.csv");

  constructor(
    private readonly configService: ConfigService,
    private readonly blizzardService: BlizzardService,
  ) {
    const apiKey = this.configService.get<string>("HUGGINGFACE_API_KEY");

    if (!apiKey) {
      throw new Error("HUGGINGFACE_API_KEY is required");
    }

    this.apiKey = apiKey;
    this.embeddings = new HuggingFaceInferenceEmbeddings({
      apiKey,
      model: "sentence-transformers/all-MiniLM-L6-v2",
    });

    this.logger.log("RAG Service initialized");
  }

  async onModuleInit() {
    await this.initializeVectorStore();
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
   * Query using basic RAG with vector search and text generation
   */
  async query(question: string): Promise<string> {
    if (!this.vectorStore) {
      throw new Error("Vector store not initialized");
    }
    // Retrieve relevant documents (fetch more and rerank)
    const retrieved = await this.vectorStore.similaritySearch(question, 8);

    // Simple lexical reranking to improve relevance (cheap fallback to no extra infra)
    // This is used to improve the relevance of the retrieved documents by ranking them based on their similarity to the question.
    const relevantDocs = this.rerankDocuments(question, retrieved).slice(0, 6);

    // Try to fetch live data from Blizzard API if question seems related
    let blizzardContext = "";
    try {
      // Simple keyword matching for demonstration
      const hasRealm = question.toLowerCase().includes("realm");
      if (hasRealm) {
        // Match realm name - includes letters, numbers, hyphens, and apostrophes
        // Examples: "Area-52", "Burning Blade", "Kil'jaeden"
        const re = /realm\s+([\w-']+(?:\s+[\w-']+)*)/i;
        const m = re.exec(question);
        if (m?.[1]) {
          const realmSlug = m[1].toLowerCase().replace(/\s+/g, "-").replace(/'/g, "");
          const realmData = await this.blizzardService.getRealmData(realmSlug);
          blizzardContext = `\n\nLive Blizzard API Data:\n${JSON.stringify(realmData, null, 2)}`;
        }
      }
    } catch (error) {
      this.logger.warn("Could not fetch Blizzard API data:", error);
    }
    // Build context with a character budget to avoid exceeding LLM input limits
    const { context, docIndexMap } = this.buildContextFromDocs(relevantDocs, 3000);

    // Build prompt template instructing the model to cite sources and be grounded
    const prompt = `You are a helpful assistant answering questions strictly using only the supplied information and live data. Be concise and factual. For any factual claim include citations to the provided documents using the notation [doc:N]. If you cannot answer confidently from the provided information, say "I don't know" and list the relevant documents.

Information:
${context}${blizzardContext}

Question: ${question}

Answer (include citations like [doc:1], [doc:2] when applicable):`;

    // Try models with verification and backoff
    // Note: similarity models are not suitable for text generation, so we use text generation models
    const modelList = [
      "katanemo/Arch-Router-1.5B", // Text generation model
      "HuggingFaceTB/SmolLM3-3B", // Text generation model
    ];
    const answer = await this.tryModelsWithVerification(modelList, prompt, context, docIndexMap);
    if (answer) return answer;

    // As a safe fallback, return the retrieved context with guidance
    this.logger.warn(
      "All LLM models failed verification or unavailable, returning retrieved context",
    );
    return `Based on the World of Warcraft knowledge base (retrieved documents):\n\n${context}${blizzardContext}\n\n⚠️ Note: The system could not produce a verified AI answer; please check the sources above.`;
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
    const verifierPrompt = `You are a verifier. Given the context documents and an answer, check whether each factual claim in the answer is fully supported by the context. If all claims are supported, reply with:\n"VERIFIED\nReason: <short explanation>"\nIf some claims are NOT supported reply with:\n"NOT VERIFIED\nUnsupported: <short list of unsupported claims>"\n\nContext:\n${context}\n\nAnswer:\n${answer}\n\nResult:`;

    try {
      const v = await this.callHfModel(model, verifierPrompt, {});
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
