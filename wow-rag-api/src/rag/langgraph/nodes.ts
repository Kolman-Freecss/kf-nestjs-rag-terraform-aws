import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Document } from "langchain/document";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { BlizzardService } from "../../blizzard/blizzard.service";
import { LocalLLMService } from "../llm/local-llm.service";
import { WorkflowState, AgentResult, NodeFunction } from "./types";

@Injectable()
export class WorkflowNodes {
  private readonly logger = new Logger(WorkflowNodes.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly blizzardService: BlizzardService,
    private readonly localLLMService: LocalLLMService,
  ) {
    // Constructor is empty but dependencies are injected
  }

  /**
   * Initial node - validates input and prepares state
   */
  initialize: NodeFunction = async (state: WorkflowState): Promise<Partial<WorkflowState>> => {
    this.logger.log(`Initializing workflow for question: ${state.question.substring(0, 100)}...`);
    
    return {
      currentStep: "initialized",
      iteration: 0,
      metadata: {
        ...state.metadata,
        startTime: Date.now(),
        totalSteps: 0,
        errors: []
      }
    };
  };

  /**
   * RAG Agent node - processes question using knowledge base
   */
  ragAgent: NodeFunction = async (state: WorkflowState): Promise<Partial<WorkflowState>> => {
    this.logger.log("Processing with RAG Agent");
    
    try {
      // This would be injected from the main service
      const vectorStore = (state as any).vectorStore as MemoryVectorStore;
      
      if (!vectorStore) {
        throw new Error("Vector store not available");
      }

      // Retrieve relevant documents
      const retrieved = await vectorStore.similaritySearch(state.question, 10);
      
      // Generate answer using local LLM
      const answer = await this.generateRagAnswer(state.question, retrieved);
      
      const ragResult: AgentResult = {
        answer,
        confidence: this.calculateConfidence(state.question, retrieved, answer),
        sources: retrieved,
        metadata: {
          agent: "RAG",
          documents_used: retrieved.length,
          processing_time: Date.now() - state.metadata.startTime,
          rag_mode: true
        }
      };

      return {
        currentStep: "rag_completed",
        ragResult,
        metadata: {
          ...state.metadata,
          totalSteps: state.metadata.totalSteps + 1
        }
      };
    } catch (error) {
      this.logger.error("RAG Agent error:", error);
      return {
        currentStep: "rag_failed",
        metadata: {
          ...state.metadata,
          errors: [...state.metadata.errors, `RAG Agent: ${error.message}`]
        }
      };
    }
  };

  /**
   * Blizzard Agent node - fetches live data from Blizzard API
   */
  blizzardAgent: NodeFunction = async (state: WorkflowState): Promise<Partial<WorkflowState>> => {
    this.logger.log("Processing with Blizzard Agent");
    
    try {
      const blizzardData = await this.fetchBlizzardData(state.question);
      
      const blizzardResult: AgentResult = {
        answer: blizzardData,
        confidence: 0.8, // High confidence for live data
        sources: [],
        metadata: {
          agent: "Blizzard",
          documents_used: 0,
          processing_time: Date.now() - state.metadata.startTime,
          blizzard_api_used: true
        }
      };

      return {
        currentStep: "blizzard_completed",
        blizzardResult,
        metadata: {
          ...state.metadata,
          totalSteps: state.metadata.totalSteps + 1
        }
      };
    } catch (error) {
      this.logger.error("Blizzard Agent error:", error);
      return {
        currentStep: "blizzard_failed",
        metadata: {
          ...state.metadata,
          errors: [...state.metadata.errors, `Blizzard Agent: ${error.message}`]
        }
      };
    }
  };

  /**
   * Synthesis node - combines results from multiple agents
   */
  synthesis: NodeFunction = async (state: WorkflowState): Promise<Partial<WorkflowState>> => {
    this.logger.log("Synthesizing results from multiple agents");
    
    try {
      const { ragResult, blizzardResult } = state;
      
      let finalAnswer = "";
      let combinedSources: Document[] = [];
      let combinedMetadata: any = {};

      // Combine RAG results
      if (ragResult) {
        finalAnswer += `Knowledge Base Information:\n${ragResult.answer}\n\n`;
        combinedSources = [...combinedSources, ...ragResult.sources];
        combinedMetadata = { ...combinedMetadata, ...ragResult.metadata };
      }

      // Combine Blizzard results
      if (blizzardResult) {
        finalAnswer += `Live Game Data:\n${blizzardResult.answer}\n\n`;
        combinedMetadata = { ...combinedMetadata, ...blizzardResult.metadata };
      }

      // Generate final synthesized answer
      const synthesizedAnswer = await this.generateSynthesizedAnswer(
        state.question,
        finalAnswer,
        combinedSources
      );

      const finalResult: AgentResult = {
        answer: synthesizedAnswer,
        confidence: this.calculateFinalConfidence(ragResult, blizzardResult),
        sources: combinedSources,
        metadata: {
          agent: "Synthesis",
          documents_used: combinedSources.length,
          processing_time: Date.now() - state.metadata.startTime,
          synthesis_mode: true,
          ...combinedMetadata
        }
      };

      return {
        currentStep: "synthesis_completed",
        finalResult,
        metadata: {
          ...state.metadata,
          totalSteps: state.metadata.totalSteps + 1,
          endTime: Date.now()
        }
      };
    } catch (error) {
      this.logger.error("Synthesis error:", error);
      return {
        currentStep: "synthesis_failed",
        metadata: {
          ...state.metadata,
          errors: [...state.metadata.errors, `Synthesis: ${error.message}`]
        }
      };
    }
  };

  /**
   * Generate answer using RAG
   */
  private async generateRagAnswer(question: string, documents: Document[]): Promise<string> {
    const context = documents.map((doc, idx) => {
      const source = doc.metadata?.source || 'unknown';
      const topic = doc.metadata?.topic || 'general';
      return `[doc:${idx + 1} | source:${source} | topic:${topic}]\n${doc.pageContent}`;
    }).join('\n\n');

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
        this.logger.warn("Failed to use local LLM for RAG answer:", error);
      }
    }

    // Fallback
    const lines = context.split('\n');
    const relevantContent = lines.slice(0, 5).join('\n');
    return `Based on available information:\n\n${relevantContent}`;
  }

  /**
   * Fetch Blizzard API data
   */
  private async fetchBlizzardData(question: string): Promise<string> {
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

    // Check for character queries
    if (lower.includes("character") || lower.includes("char")) {
      const charMatch = question.match(/(?:character|char)\s+([\w-']+)/i);
      if (charMatch?.[1]) {
        const charName = charMatch[1];
        // You would implement character data fetching here
        return `Character data for ${charName} would be fetched here`;
      }
    }

    return "No specific Blizzard data found for this query.";
  }

  /**
   * Generate synthesized answer
   */
  private async generateSynthesizedAnswer(
    question: string,
    combinedContext: string,
    sources: Document[]
  ): Promise<string> {
    const isLocalAvailable = await this.localLLMService.isAvailable();
    if (isLocalAvailable) {
      try {
        const systemMessage = `You are an intelligent assistant that synthesizes information from multiple sources.
Combine the knowledge base information and live game data to provide a comprehensive answer.
Prioritize accuracy and provide context for your information sources.`;

        const prompt = `Question: ${question}\n\nCombined Information:\n${combinedContext}\n\nSynthesized Answer:`;

        const answer = await this.localLLMService.generateText(prompt, systemMessage, {
          temperature: 0.2,
          maxTokens: 800,
        });

        return answer || "I couldn't synthesize a comprehensive answer.";
      } catch (error) {
        this.logger.warn("Failed to use local LLM for synthesis:", error);
      }
    }

    // Fallback
    return `Synthesized Answer:\n\n${combinedContext}`;
  }

  /**
   * Calculate confidence for RAG results
   */
  private calculateConfidence(question: string, sources: Document[], answer: string): number {
    let confidence = 0.5; // Base confidence

    // Increase confidence based on number of sources
    if (sources.length > 0) {
      confidence += Math.min(sources.length * 0.1, 0.3);
    }

    // Increase confidence if answer is substantial
    if (answer.length > 100) {
      confidence += 0.1;
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Calculate final confidence combining all agents
   */
  private calculateFinalConfidence(ragResult?: AgentResult, blizzardResult?: AgentResult): number {
    let totalConfidence = 0;
    let count = 0;

    if (ragResult) {
      totalConfidence += ragResult.confidence;
      count++;
    }

    if (blizzardResult) {
      totalConfidence += blizzardResult.confidence;
      count++;
    }

    return count > 0 ? totalConfidence / count : 0.5;
  }
}
