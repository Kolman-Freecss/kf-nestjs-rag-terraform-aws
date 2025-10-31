import { Injectable, Logger } from "@nestjs/common";
import { StateGraph, END, START } from "@langchain/langgraph";
import { Document } from "langchain/document";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { WorkflowState, WorkflowConfig, AgentResult } from "./types";
import { WorkflowNodes } from "./nodes";
import { WorkflowEdges } from "./edges";

@Injectable()
export class LangGraphWorkflow {
  private readonly logger = new Logger(LangGraphWorkflow.name);
  private workflow: StateGraph<WorkflowState> | null = null;
  private readonly config: WorkflowConfig;

  constructor(
    private readonly workflowNodes: WorkflowNodes,
    private readonly workflowEdges: WorkflowEdges,
  ) {
    this.config = {
      maxIterations: 3,
      enableBlizzardAgent: true,
      enableRagAgent: true,
      confidenceThreshold: 0.6,
      timeoutMs: 30000, // 30 seconds
    };
  }

  /**
   * Initialize the LangGraph workflow
   */
  initializeWorkflow(): void {
    this.logger.log("Initializing LangGraph workflow");

    // Create the state graph
    this.workflow = new StateGraph<WorkflowState>({
      channels: {
        question: { value: (x: string) => x },
        context: { value: (x?: string) => x },
        currentStep: { value: (x: string) => x },
        iteration: { value: (x: number) => x },
        ragResult: { value: (x?: AgentResult) => x },
        blizzardResult: { value: (x?: AgentResult) => x },
        finalResult: { value: (x?: AgentResult) => x },
        metadata: { value: (x: any) => x },
      },
    });

    // Add nodes
    this.workflow.addNode("initialize", this.workflowNodes.initialize);
    this.workflow.addNode("rag_agent", this.workflowNodes.ragAgent);
    this.workflow.addNode("blizzard_agent", this.workflowNodes.blizzardAgent);
    this.workflow.addNode("synthesis", this.workflowNodes.synthesis);

    // Add edges
    this.workflow.addEdge(START, "initialize");
    
    // From initialize
    this.workflow.addConditionalEdges(
      "initialize",
      this.workflowEdges.afterInitialize,
      {
        "parallel_agents": "rag_agent", // Will be handled by parallel execution
        "rag_only": "rag_agent",
        "blizzard_only": "blizzard_agent",
      }
    );

    // From RAG agent
    this.workflow.addConditionalEdges(
      "rag_agent",
      this.workflowEdges.afterRagAgent,
      {
        "blizzard_fallback": "blizzard_agent",
        "blizzard_additional": "blizzard_agent",
        "synthesis": "synthesis",
        "end": END,
      }
    );

    // From Blizzard agent
    this.workflow.addConditionalEdges(
      "blizzard_agent",
      this.workflowEdges.afterBlizzardAgent,
      {
        "synthesis": "synthesis",
        "end": END,
      }
    );

    // From synthesis
    this.workflow.addConditionalEdges(
      "synthesis",
      this.workflowEdges.afterSynthesis,
      {
        "end": END,
        "fallback_response": END,
        "retry": "initialize", // Retry from beginning
      }
    );

    // Compile the workflow
    this.workflow = this.workflow.compile();

    this.logger.log("LangGraph workflow initialized successfully");
  }

  /**
   * Execute the workflow with a question
   */
  async execute(
    question: string,
    vectorStore: MemoryVectorStore,
    context?: string
  ): Promise<AgentResult> {
    if (!this.workflow) {
      throw new Error("Workflow not initialized. Call initializeWorkflow() first.");
    }

    this.logger.log(`Executing workflow for question: ${question.substring(0, 100)}...`);

    // Create initial state
    const initialState: WorkflowState = {
      question,
      context,
      currentStep: "start",
      iteration: 0,
      metadata: {
        startTime: Date.now(),
        totalSteps: 0,
        errors: [],
      },
    };

    // Add vector store to state for nodes to access
    (initialState as any).vectorStore = vectorStore;

    try {
      // Execute the workflow
      const result = await this.workflow.invoke(initialState, {
        recursionLimit: this.config.maxIterations,
      });

      // Extract final result
      if (result.finalResult) {
        this.logger.log(`Workflow completed successfully with confidence: ${result.finalResult.confidence}`);
        return result.finalResult;
      }

      // Fallback if no final result
      this.logger.warn("Workflow completed but no final result found");
      return this.createFallbackResult(question, result);

    } catch (error) {
      this.logger.error("Workflow execution failed:", error);
      return this.createErrorResult(question, error);
    }
  }

  /**
   * Execute workflow with parallel agent execution
   */
  async executeParallel(
    question: string,
    vectorStore: MemoryVectorStore,
    context?: string
  ): Promise<AgentResult> {
    this.logger.log(`Executing parallel workflow for question: ${question.substring(0, 100)}...`);

    const initialState: WorkflowState = {
      question,
      context,
      currentStep: "start",
      iteration: 0,
      metadata: {
        startTime: Date.now(),
        totalSteps: 0,
        errors: [],
      },
    };

    (initialState as any).vectorStore = vectorStore;

    try {
      // Execute RAG and Blizzard agents in parallel
      const [ragResult, blizzardResult] = await Promise.allSettled([
        this.executeRagAgent(question, vectorStore),
        this.executeBlizzardAgent(question),
      ]);

      // Process results
      const state: Partial<WorkflowState> = {
        ...initialState,
        currentStep: "parallel_completed",
      };

      if (ragResult.status === "fulfilled") {
        state.ragResult = ragResult.value;
      } else {
        this.logger.warn("RAG agent failed:", ragResult.reason);
        state.metadata = {
          ...state.metadata!,
          errors: [...(state.metadata?.errors || []), `RAG: ${ragResult.reason.message}`],
        };
      }

      if (blizzardResult.status === "fulfilled") {
        state.blizzardResult = blizzardResult.value;
      } else {
        this.logger.warn("Blizzard agent failed:", blizzardResult.reason);
        state.metadata = {
          ...state.metadata!,
          errors: [...(state.metadata?.errors || []), `Blizzard: ${blizzardResult.reason.message}`],
        };
      }

      // Synthesize results
      const synthesisResult = await this.workflowNodes.synthesis(state as WorkflowState);

      if (synthesisResult.finalResult) {
        this.logger.log(`Parallel workflow completed successfully with confidence: ${synthesisResult.finalResult.confidence}`);
        return synthesisResult.finalResult;
      }

      return this.createFallbackResult(question, state);

    } catch (error) {
      this.logger.error("Parallel workflow execution failed:", error);
      return this.createErrorResult(question, error);
    }
  }

  /**
   * Execute RAG agent independently
   */
  private async executeRagAgent(question: string, vectorStore: MemoryVectorStore): Promise<AgentResult> {
    const state: WorkflowState = {
      question,
      currentStep: "rag_start",
      iteration: 0,
      metadata: { startTime: Date.now(), totalSteps: 0, errors: [] },
    };

    (state as any).vectorStore = vectorStore;
    const result = await this.workflowNodes.ragAgent(state);
    return result.ragResult!;
  }

  /**
   * Execute Blizzard agent independently
   */
  private async executeBlizzardAgent(question: string): Promise<AgentResult> {
    const state: WorkflowState = {
      question,
      currentStep: "blizzard_start",
      iteration: 0,
      metadata: { startTime: Date.now(), totalSteps: 0, errors: [] },
    };

    const result = await this.workflowNodes.blizzardAgent(state);
    return result.blizzardResult!;
  }

  /**
   * Create fallback result when workflow doesn't produce final result
   */
  private createFallbackResult(question: string, state: Partial<WorkflowState>): AgentResult {
    let answer = "I couldn't process your question properly.";
    let sources: Document[] = [];
    let confidence = 0.3;

    // Try to use available results
    if (state.ragResult) {
      answer = state.ragResult.answer;
      sources = state.ragResult.sources;
      confidence = state.ragResult.confidence;
    } else if (state.blizzardResult) {
      answer = state.blizzardResult.answer;
      confidence = state.blizzardResult.confidence;
    }

    return {
      answer,
      confidence,
      sources,
      metadata: {
        agent: "Fallback",
        documents_used: sources.length,
        processing_time: Date.now() - (state.metadata?.startTime || Date.now()),
        fallback_mode: true,
        errors: state.metadata?.errors || [],
      },
    };
  }

  /**
   * Create error result when workflow fails
   */
  private createErrorResult(question: string, error: any): AgentResult {
    return {
      answer: `I encountered an error while processing your question: ${error.message}`,
      confidence: 0.1,
      sources: [],
      metadata: {
        agent: "Error",
        documents_used: 0,
        processing_time: 0,
        error_mode: true,
        error_message: error.message,
      },
    };
  }

  /**
   * Get workflow configuration
   */
  getConfig(): WorkflowConfig {
    return { ...this.config };
  }

  /**
   * Update workflow configuration
   */
  updateConfig(newConfig: Partial<WorkflowConfig>): void {
    Object.assign(this.config, newConfig);
    this.logger.log("Workflow configuration updated");
  }
}


