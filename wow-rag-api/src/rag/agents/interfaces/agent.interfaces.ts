import { Document } from 'langchain/document';
import { ModelClient } from '../../models/interfaces/model.interfaces';

/**
 * Base interface for all agents in the multi-agent system
 */
export interface BaseAgent {
  readonly name: string;
  readonly type: AgentType;
  readonly capabilities: string[];
  isHealthy(): Promise<boolean>;
}

/**
 * Types of agents in the system
 */
export enum AgentType {
  RETRIEVAL = 'retrieval',
  SIMILARITY = 'similarity',
  GENERATION = 'generation',
  EMBEDDING = 'embedding',
  RERANKING = 'reranking',
  VERIFICATION = 'verification',
}

/**
 * Configuration for agent initialization
 */
export interface AgentConfig {
  name: string;
  modelNames: string[];
  fallbackModels?: string[];
  maxRetries?: number;
  timeout?: number;
  customSettings?: Record<string, any>;
}

/**
 * Result from agent execution
 */
export interface AgentResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  metadata: {
    agentName: string;
    agentType: AgentType;
    modelUsed?: string;
    executionTime: number;
    confidence?: number;
  };
}

/**
 * Context passed between agents
 */
export interface AgentContext {
  query: string;
  documents?: Document[];
  embeddings?: number[][];
  similarities?: number[];
  previousResults?: AgentResult[];
  metadata?: Record<string, any>;
}

/**
 * Interface for retrieval agents
 * Responsible for finding relevant documents from the knowledge base
 */
export interface RetrievalAgent extends BaseAgent {
  retrieve(query: string, topK?: number): Promise<AgentResult<Document[]>>;
  addDocuments(documents: Document[]): Promise<AgentResult<void>>;
  searchSimilar(embedding: number[], topK?: number): Promise<AgentResult<Document[]>>;
}

/**
 * Interface for similarity agents
 * Responsible for calculating similarity between texts
 */
export interface SimilarityAgent extends BaseAgent {
  calculateSimilarity(
    sourceSentence: string,
    targetSentences: string[],
  ): Promise<AgentResult<number[]>>;
  findMostSimilar(
    sourceSentence: string,
    targetSentences: string[],
    topK?: number,
  ): Promise<AgentResult<{ sentence: string; score: number }[]>>;
  rankDocuments(query: string, documents: Document[]): Promise<AgentResult<Document[]>>;
}

/**
 * Interface for generation agents
 * Responsible for generating text responses
 */
export interface GenerationAgent extends BaseAgent {
  generate(
    prompt: string,
    context?: AgentContext,
    options?: GenerationOptions,
  ): Promise<AgentResult<string>>;
  generateWithVerification(
    prompt: string,
    context: AgentContext,
    options?: GenerationOptions,
  ): Promise<AgentResult<{ text: string; verified: boolean; confidence: number }>>;
}

/**
 * Interface for embedding agents
 * Responsible for generating embeddings from text
 */
export interface EmbeddingAgent extends BaseAgent {
  embed(text: string): Promise<AgentResult<number[]>>;
  embedBatch(texts: string[]): Promise<AgentResult<number[][]>>;
  calculateSimilarity(embedding1: number[], embedding2: number[]): number;
}

/**
 * Interface for reranking agents
 * Responsible for reordering documents based on relevance
 */
export interface RerankingAgent extends BaseAgent {
  rerank(
    query: string,
    documents: Document[],
    options?: RerankingOptions,
  ): Promise<AgentResult<Document[]>>;
  scoreDocuments(
    query: string,
    documents: Document[],
  ): Promise<AgentResult<{ document: Document; score: number }[]>>;
}

/**
 * Interface for verification agents
 * Responsible for verifying the quality and accuracy of generated content
 */
export interface VerificationAgent extends BaseAgent {
  verify(
    generatedText: string,
    context: AgentContext,
    options?: VerificationOptions,
  ): Promise<AgentResult<{ verified: boolean; confidence: number; issues?: string[] }>>;
  checkFactualAccuracy(
    text: string,
    sourceDocuments: Document[],
  ): Promise<AgentResult<{ accurate: boolean; confidence: number; citations?: string[] }>>;
}

/**
 * Options for text generation
 */
export interface GenerationOptions {
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  stopSequences?: string[];
  includeContext?: boolean;
  requireCitations?: boolean;
}

/**
 * Options for document reranking
 */
export interface RerankingOptions {
  algorithm?: 'lexical' | 'semantic' | 'hybrid';
  weights?: { lexical?: number; semantic?: number };
  maxDocuments?: number;
}

/**
 * Options for content verification
 */
export interface VerificationOptions {
  checkFactualAccuracy?: boolean;
  checkCitations?: boolean;
  checkCoherence?: boolean;
  confidenceThreshold?: number;
}

/**
 * Union type for all agent types
 */
export type Agent = 
  | RetrievalAgent 
  | SimilarityAgent 
  | GenerationAgent 
  | EmbeddingAgent 
  | RerankingAgent 
  | VerificationAgent;

/**
 * Agent registry entry
 */
export interface AgentRegistryEntry {
  name: string;
  type: AgentType;
  description: string;
  capabilities: string[];
  requiredModelTypes: string[];
  defaultConfig: Partial<AgentConfig>;
}

/**
 * Multi-agent orchestrator interface
 */
export interface AgentOrchestrator {
  registerAgent(agent: Agent): void;
  getAgent(name: string): Agent | undefined;
  getAgentsByType(type: AgentType): Agent[];
  executeWorkflow(workflow: AgentWorkflow, context: AgentContext): Promise<AgentResult>;
}

/**
 * Workflow definition for multi-agent execution
 */
export interface AgentWorkflow {
  name: string;
  steps: AgentWorkflowStep[];
  fallbackStrategy?: 'skip' | 'retry' | 'alternative';
}

/**
 * Individual step in an agent workflow
 */
export interface AgentWorkflowStep {
  agentName: string;
  agentType: AgentType;
  inputMapping?: Record<string, string>;
  outputMapping?: Record<string, string>;
  condition?: (context: AgentContext) => boolean;
  retryCount?: number;
  timeout?: number;
}