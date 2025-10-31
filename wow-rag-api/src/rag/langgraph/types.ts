import { Document } from "langchain/document";

/**
 * State interface for LangGraph workflow
 */
export interface WorkflowState {
  // Input
  question: string;
  context?: string;
  
  // Processing state
  currentStep: string;
  iteration: number;
  
  // Agent results
  ragResult?: AgentResult;
  blizzardResult?: AgentResult;
  finalResult?: AgentResult;
  
  // Metadata
  metadata: {
    startTime: number;
    endTime?: number;
    totalSteps: number;
    errors: string[];
  };
}

/**
 * Agent result interface
 */
export interface AgentResult {
  answer: string;
  confidence: number;
  sources: Document[];
  metadata: {
    agent: string;
    documents_used: number;
    processing_time: number;
    [key: string]: any;
  };
}

/**
 * Node function type for LangGraph
 */
export type NodeFunction = (state: WorkflowState) => Promise<Partial<WorkflowState>>;

/**
 * Edge condition type for LangGraph
 */
export type EdgeCondition = (state: WorkflowState) => string;

/**
 * Workflow configuration
 */
export interface WorkflowConfig {
  maxIterations: number;
  enableBlizzardAgent: boolean;
  enableRagAgent: boolean;
  confidenceThreshold: number;
  timeoutMs: number;
}


