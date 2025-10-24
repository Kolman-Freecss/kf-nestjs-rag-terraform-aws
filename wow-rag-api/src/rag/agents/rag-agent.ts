import { ChatPromptTemplate } from "@langchain/core/prompts";
import { ChatOpenAI } from "@langchain/openai";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AgentExecutor, createToolCallingAgent } from "langchain/agents";
import { Document } from "langchain/document";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { BlizzardService } from "../../blizzard/blizzard.service";
import { LocalLLMService } from "../llm/local-llm.service";
import { BaseAgentAbstract } from "./abstract/base-agent.abstract";
import { AgentInput, AgentOutput } from "./abstract/base-agent.interface";
import { AgentTools } from "./tools/agent-tools";

@Injectable()
export class RagAgent extends BaseAgentAbstract {
  name = "RagAgent";
  description = "Intelligent agent for World of Warcraft and general queries using LangChain tools";

  private agentExecutor: AgentExecutor | null = null;
  private vectorStore: MemoryVectorStore | null = null;
  private allLoadedDocs: Document[] = [];
  private readonly agentTools: AgentTools;

  constructor(
    private readonly configService: ConfigService,
    private readonly blizzardService: BlizzardService,
    private readonly localLLMService: LocalLLMService,
  ) {
    super();
    this.agentTools = new AgentTools(blizzardService);
  }

  /**
   * Set the vector store and initialize the agent
   */
  setVectorStore(vectorStore: MemoryVectorStore, documents: Document[]): void {
    this.vectorStore = vectorStore;
    this.allLoadedDocs = documents;
    this.logger.log(`RAG Agent vector store set with ${documents.length} documents`);
    this.initializeAgent();
  }

  /**
   * Initialize the LangChain agent with tools
   */
  private async initializeAgent(): Promise<void> {
    if (!this.vectorStore) {
      throw new Error("Vector store not initialized");
    }

    try {
      let llm: any;
      let llmType = "unknown";

      // Try OpenAI first
      const openaiApiKey = this.configService.get<string>("OPENAI_API_KEY");
      if (openaiApiKey) {
        try {
          llm = new ChatOpenAI({
            modelName: "gpt-3.5-turbo",
            temperature: 0.1,
            openAIApiKey: openaiApiKey,
          });
          llmType = "OpenAI";
          this.logger.log("Using OpenAI LLM");
        } catch (error) {
          this.logger.warn("Failed to initialize OpenAI LLM:", error);
        }
      }

      // Fallback to local LLM if OpenAI is not available
      if (!llm) {
        const isLocalAvailable = await this.localLLMService.isAvailable();
        if (isLocalAvailable) {
          try {
            // Create a custom LLM wrapper for local service
            llm = this.createLocalLLMWrapper();
          } catch (error) {
            this.logger.warn("Failed to initialize local LLM:", error);
          }
        }
      }

      // If no LLM is available, use fallback mode
      if (!llm) {
        this.logger.warn("No LLM available (OpenAI or local), using fallback mode");
        return;
      }

      // Get tools
      const tools = this.agentTools.getAllTools(this.vectorStore);

      // Create the prompt template
      const prompt = ChatPromptTemplate.fromTemplate(`
You are an intelligent assistant specialized in World of Warcraft information with access to comprehensive knowledge and live Blizzard API data.

You have access to the following tools:
{tools}

Use these tools to answer questions about World of Warcraft and general topics. Always try to provide accurate, up-to-date information.

When answering questions:
1. First search the knowledge base for relevant information
2. If the question involves specific realms or characters, use the appropriate API tools
3. Provide comprehensive answers with context
4. If you're unsure about something, say so rather than guessing

Question: {input}

{agent_scratchpad}
`);

      // Create the agent
      const agent = await createToolCallingAgent({
        llm,
        tools,
        prompt,
      });

      // Create the agent executor
      this.agentExecutor = new AgentExecutor({
        agent,
        tools,
        verbose: true,
        maxIterations: 5,
      });

      this.logger.log(`RAG Agent initialized with LangChain tools using ${llmType} LLM`);
    } catch (error) {
      this.logger.error("Failed to initialize RAG Agent:", error);
      throw error;
    }
  }

  /**
   * Check if this agent can handle queries
   */
  async canHandle(input: AgentInput): Promise<boolean> {
    // This agent can handle any query
    return true;
  }

  /**
   * Process queries using LangChain agent
   */
  async process(input: AgentInput): Promise<AgentOutput> {
    const { question, context } = input;
    this.logger.log(`RAG Agent processing: ${question.substring(0, 100)}...`);

    // If agent is not initialized, fall back to simple processing
    if (!this.agentExecutor) {
      this.logger.warn("RAG Agent not initialized, falling back to simple processing");
      return this.fallbackProcess(input);
    }

    try {
      // Use the LangChain agent to process the query
      const result = await this.agentExecutor.invoke({
        input: question,
      });

      // Extract sources from the agent's execution
      const sources = this.extractSourcesFromAgentResult(result);

      return {
        answer: result.output,
        confidence: this.calculateConfidence(question, sources, result.output),
        sources,
        metadata: {
          agent: this.name,
          documents_used: sources.length,
          langchain_agent_used: true,
          iterations: result.intermediateSteps?.length || 0
        }
      };
    } catch (error) {
      this.logger.error("Error processing with LangChain agent:", error);
      return this.fallbackProcess(input);
    }
  }

  /**
   * Create a LangChain-compatible wrapper for the local LLM service
   */
  private createLocalLLMWrapper(): any {
    return {
      async invoke(messages: any[]): Promise<any> {
        try {
          const response = await this.localLLMService.chatCompletion(messages);
          return {
            content: response.choices[0]?.message?.content || '',
            additional_kwargs: {},
          };
        } catch (error) {
          this.logger.error("Error in local LLM wrapper:", error);
          throw error;
        }
      },
      async stream(messages: any[]): Promise<any> {
        // For now, just return the invoke result
        const result = await this.invoke(messages);
        return [result];
      },
      bindTools: (tools: any[]) => {
        // Return a new instance with tools bound
        return this.createLocalLLMWrapper();
      },
    };
  }

  /**
   * Fallback processing when LangChain agent is not available
   */
  private async fallbackProcess(input: AgentInput): Promise<AgentOutput> {
    if (!this.vectorStore) {
      throw new Error("Vector store not initialized");
    }

    const { question } = input;
    this.logger.log("Using fallback processing");

    // Retrieve relevant documents
    const retrieved = await this.vectorStore.similaritySearch(question, 10);

    // Try to fetch live Blizzard data if relevant
    let blizzardContext = "";
    try {
      blizzardContext = await this.tryFetchBlizzardData(question);
    } catch (error) {
      this.logger.warn("Could not fetch Blizzard data:", error);
    }

    // Build context and generate answer
    const contextText = this.buildContext(retrieved);
    const fullContext = contextText + (blizzardContext ? `\n\nLive Blizzard Data:\n${blizzardContext}` : "");

    const answer = await this.generateAnswer(question, fullContext);

    return {
      answer,
      confidence: this.calculateConfidence(question, retrieved, answer),
      sources: retrieved,
      metadata: {
        agent: this.name,
        documents_used: retrieved.length,
        blizzard_data_fetched: !!blizzardContext,
        fallback_mode: true
      }
    };
  }

  /**
   * Try to fetch relevant Blizzard API data
   */
  private async tryFetchBlizzardData(question: string): Promise<string> {
    const lower = question.toLowerCase();

    // Check for realm queries
    if (lower.includes("realm")) {
      const realmMatch = question.match(/realm\s+([\w-']+(?:\s+[\w-']+)*)/i);
      if (realmMatch?.[1]) {
        const realmSlug = realmMatch[1].toLowerCase().replace(/\s+/g, "-").replace(/'/g, "");
        const realmData = await this.blizzardService.getRealmData(realmSlug);
        return JSON.stringify(realmData, null, 2);
      }
    }

    return "";
  }

  /**
   * Build context from retrieved documents
   */
  private buildContext(documents: Document[]): string {
    return documents.map((doc, idx) => {
      const source = doc.metadata?.source || 'unknown';
      const topic = doc.metadata?.topic || 'general';
      return `[doc:${idx + 1} | source:${source} | topic:${topic}]\n${doc.pageContent}`;
    }).join('\n\n');
  }

  /**
   * Generate answer using local LLM or simple prompt (fallback)
   */
  private async generateAnswer(question: string, context: string): Promise<string> {
    if (context.trim().length === 0) {
      return "I found relevant information but couldn't generate a specific answer.";
    }

    // Try to use local LLM if available
    const isLocalAvailable = await this.localLLMService.isAvailable();
    if (isLocalAvailable) {
      try {
        const systemMessage = `You are an intelligent assistant specialized in World of Warcraft information. 
Use the provided context to answer questions accurately and comprehensively. 
If you're unsure about something, say so rather than guessing.`;

        const prompt = `Context:\n${context}\n\nQuestion: ${question}\n\nAnswer:`;

        const answer = await this.localLLMService.generateText(prompt, systemMessage, {
          temperature: 0.3,
          maxTokens: 500,
        });

        return answer || "I couldn't generate a specific answer from the available information.";
      } catch (error) {
        this.logger.warn("Failed to use local LLM for answer generation:", error);
      }
    }

    // Fallback to simple extraction
    const lines = context.split('\n');
    const relevantContent = lines.slice(0, 5).join('\n');

    return `Based on available information:\n\n${relevantContent}`;
  }

  /**
   * Extract sources from agent execution result
   */
  private extractSourcesFromAgentResult(result: any): Document[] {
    // This is a simplified extraction - in a real implementation,
    // you'd parse the agent's intermediate steps to get actual sources
    if (this.vectorStore && result.input) {
      // For now, return empty array - sources would be extracted from tool calls
      return [];
    }
    return [];
  }
}
