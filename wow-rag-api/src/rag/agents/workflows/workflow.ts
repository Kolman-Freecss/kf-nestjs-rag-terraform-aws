import { AgentInput, AgentOutput } from "../abstract/base-agent.interface";
import { RagAgent } from "../rag-agent";

/**
 * Simple RAG workflow using a single intelligent agent
 */
export class RagWorkflow {
  private ragAgent: RagAgent;

  constructor(ragAgent: RagAgent) {
    this.ragAgent = ragAgent;
  }

  async run(input: AgentInput): Promise<AgentOutput> {
    try {
      return await this.ragAgent.process(input);
    } catch (error) {
      return {
        answer: `An error occurred while processing your query: ${error.message}`,
        confidence: 0.1,
        metadata: { error: error.message }
      };
    }
  }

  /**
   * Initialize vector stores for the agent
   */
  initializeVectorStore(vectorStore: any, documents: any[]): void {
    this.ragAgent.setVectorStore(vectorStore, documents);
  }
}