import { Document } from "langchain/document";

export interface AgentInput {
  question: string;
  context?: Document[];
  metadata?: Record<string, any>;
}

export interface AgentOutput {
  answer: string;
  confidence: number;
  sources?: Document[];
  metadata?: Record<string, any>;
}

export interface BaseAgent {
  name: string;
  description: string;

  /**
   * Process a query and return an answer
   */
  process(input: AgentInput): Promise<AgentOutput>;

  /**
   * Check if this agent can handle the given query
   */
  canHandle(input: AgentInput): Promise<boolean>;
}