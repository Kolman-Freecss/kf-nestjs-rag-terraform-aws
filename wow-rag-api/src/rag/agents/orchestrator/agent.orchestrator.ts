import { Injectable, Logger } from '@nestjs/common';
import {
  Agent,
  AgentOrchestrator,
  AgentType,
  AgentWorkflow,
  AgentWorkflowStep,
  AgentContext,
  AgentResult,
} from '../interfaces/agent.interfaces';

/**
 * Orchestrator for managing and executing multi-agent workflows
 */
@Injectable()
export class AgentOrchestratorImpl implements AgentOrchestrator {
  private readonly logger = new Logger(AgentOrchestratorImpl.name);
  private readonly agents = new Map<string, Agent>();
  private readonly agentsByType = new Map<AgentType, Agent[]>();

  /**
   * Register an agent with the orchestrator
   */
  registerAgent(agent: Agent): void {
    this.agents.set(agent.name, agent);
    
    // Add to type-based index
    if (!this.agentsByType.has(agent.type)) {
      this.agentsByType.set(agent.type, []);
    }
    this.agentsByType.get(agent.type)!.push(agent);
    
    this.logger.log(`Registered agent: ${agent.name} (${agent.type})`);
  }

  /**
   * Get an agent by name
   */
  getAgent(name: string): Agent | undefined {
    return this.agents.get(name);
  }

  /**
   * Get all agents of a specific type
   */
  getAgentsByType(type: AgentType): Agent[] {
    return this.agentsByType.get(type) || [];
  }

  /**
   * Execute a multi-agent workflow
   */
  async executeWorkflow(
    workflow: AgentWorkflow,
    context: AgentContext,
  ): Promise<AgentResult> {
    const startTime = Date.now();
    this.logger.log(`Starting workflow: ${workflow.name}`);

    try {
      let currentContext = { ...context };
      const stepResults: AgentResult[] = [];

      for (const [stepIndex, step] of workflow.steps.entries()) {
        this.logger.log(`Executing step ${stepIndex + 1}/${workflow.steps.length}: ${step.agentName}`);

        // Check if step condition is met
        if (step.condition && !step.condition(currentContext)) {
          this.logger.log(`Skipping step ${stepIndex + 1} - condition not met`);
          continue;
        }

        // Execute the step
        const stepResult = await this.executeWorkflowStep(step, currentContext);
        stepResults.push(stepResult);

        if (!stepResult.success) {
          this.logger.error(`Step ${stepIndex + 1} failed: ${stepResult.error}`);
          
          // Handle failure based on fallback strategy
          if (workflow.fallbackStrategy === 'skip') {
            this.logger.log('Skipping failed step and continuing workflow');
            continue;
          } else if (workflow.fallbackStrategy === 'retry') {
            this.logger.log('Retrying failed step');
            const retryResult = await this.executeWorkflowStep(step, currentContext);
            stepResults[stepResults.length - 1] = retryResult;
            
            if (!retryResult.success) {
              return this.createWorkflowFailureResult(workflow.name, stepResults, startTime);
            }
          } else {
            // Default: fail the entire workflow
            return this.createWorkflowFailureResult(workflow.name, stepResults, startTime);
          }
        }

        // Update context with step results
        currentContext = this.updateContextWithStepResult(currentContext, stepResult, step);
      }

      return {
        success: true,
        data: {
          workflowName: workflow.name,
          stepResults,
          finalContext: currentContext,
        },
        metadata: {
          agentName: 'orchestrator',
          agentType: AgentType.GENERATION, // Default type for orchestrator
          executionTime: Date.now() - startTime,
        },
      };
    } catch (error) {
      this.logger.error(`Workflow ${workflow.name} failed:`, error);
      return {
        success: false,
        error: error.message,
        metadata: {
          agentName: 'orchestrator',
          agentType: AgentType.GENERATION,
          executionTime: Date.now() - startTime,
        },
      };
    }
  }

  /**
   * Execute a single workflow step
   */
  private async executeWorkflowStep(
    step: AgentWorkflowStep,
    context: AgentContext,
  ): Promise<AgentResult> {
    // Get the agent for this step
    let agent = this.getAgent(step.agentName);
    
    // If specific agent not found, try to get any agent of the required type
    if (!agent) {
      const agentsOfType = this.getAgentsByType(step.agentType);
      agent = agentsOfType.find(a => a.isHealthy()) || agentsOfType[0];
    }

    if (!agent) {
      return {
        success: false,
        error: `No agent found for step: ${step.agentName} (${step.agentType})`,
        metadata: {
          agentName: step.agentName,
          agentType: step.agentType,
          executionTime: 0,
        },
      };
    }

    // Map input context if needed
    const mappedContext = this.mapStepInput(context, step);

    // Execute the agent based on its type
    try {
      const result = await this.executeAgentByType(agent, mappedContext, step);
      
      // Map output if needed
      return this.mapStepOutput(result, step);
    } catch (error) {
      return {
        success: false,
        error: error.message,
        metadata: {
          agentName: agent.name,
          agentType: agent.type,
          executionTime: 0,
        },
      };
    }
  }

  /**
   * Execute an agent based on its type
   */
  private async executeAgentByType(
    agent: Agent,
    context: AgentContext,
    step: AgentWorkflowStep,
  ): Promise<AgentResult> {
    switch (agent.type) {
      case AgentType.SIMILARITY:
        // For similarity agents, we need to determine the specific operation
        const similarityAgent = agent as any; // Type assertion for demo
        if (context.documents) {
          return await similarityAgent.rankDocuments(context.query, context.documents);
        } else {
          throw new Error('Similarity agent requires documents in context');
        }

      case AgentType.GENERATION:
        const generationAgent = agent as any;
        return await generationAgent.generate(context.query, context);

      case AgentType.RETRIEVAL:
        const retrievalAgent = agent as any;
        return await retrievalAgent.retrieve(context.query);

      case AgentType.EMBEDDING:
        const embeddingAgent = agent as any;
        return await embeddingAgent.embed(context.query);

      case AgentType.RERANKING:
        const rerankingAgent = agent as any;
        if (context.documents) {
          return await rerankingAgent.rerank(context.query, context.documents);
        } else {
          throw new Error('Reranking agent requires documents in context');
        }

      case AgentType.VERIFICATION:
        const verificationAgent = agent as any;
        if (context.previousResults && context.previousResults.length > 0) {
          const lastResult = context.previousResults[context.previousResults.length - 1];
          return await verificationAgent.verify(lastResult.data, context);
        } else {
          throw new Error('Verification agent requires previous results in context');
        }

      default:
        throw new Error(`Unsupported agent type: ${agent.type}`);
    }
  }

  /**
   * Map step input based on input mapping configuration
   */
  private mapStepInput(context: AgentContext, step: AgentWorkflowStep): AgentContext {
    if (!step.inputMapping) {
      return context;
    }

    const mappedContext = { ...context };
    
    for (const [targetField, sourceField] of Object.entries(step.inputMapping)) {
      if (sourceField in context) {
        (mappedContext as any)[targetField] = (context as any)[sourceField];
      }
    }

    return mappedContext;
  }

  /**
   * Map step output based on output mapping configuration
   */
  private mapStepOutput(result: AgentResult, step: AgentWorkflowStep): AgentResult {
    if (!step.outputMapping || !result.success) {
      return result;
    }

    const mappedData = { ...result.data };
    
    for (const [targetField, sourceField] of Object.entries(step.outputMapping)) {
      if (sourceField in result.data) {
        mappedData[targetField] = result.data[sourceField];
      }
    }

    return {
      ...result,
      data: mappedData,
    };
  }

  /**
   * Update context with step result
   */
  private updateContextWithStepResult(
    context: AgentContext,
    stepResult: AgentResult,
    step: AgentWorkflowStep,
  ): AgentContext {
    const updatedContext = { ...context };

    // Add step result to previous results
    if (!updatedContext.previousResults) {
      updatedContext.previousResults = [];
    }
    updatedContext.previousResults.push(stepResult);

    // Update specific context fields based on agent type
    if (stepResult.success && stepResult.data) {
      switch (step.agentType) {
        case AgentType.RETRIEVAL:
          updatedContext.documents = stepResult.data;
          break;
        case AgentType.EMBEDDING:
          if (!updatedContext.embeddings) {
            updatedContext.embeddings = [];
          }
          updatedContext.embeddings.push(stepResult.data);
          break;
        case AgentType.SIMILARITY:
          if (Array.isArray(stepResult.data) && typeof stepResult.data[0] === 'number') {
            updatedContext.similarities = stepResult.data;
          } else if (Array.isArray(stepResult.data)) {
            updatedContext.documents = stepResult.data;
          }
          break;
      }
    }

    return updatedContext;
  }

  /**
   * Create a workflow failure result
   */
  private createWorkflowFailureResult(
    workflowName: string,
    stepResults: AgentResult[],
    startTime: number,
  ): AgentResult {
    const failedSteps = stepResults.filter(result => !result.success);
    const errorMessages = failedSteps.map(result => result.error).join('; ');

    return {
      success: false,
      error: `Workflow ${workflowName} failed. Errors: ${errorMessages}`,
      data: {
        workflowName,
        stepResults,
        failedSteps: failedSteps.length,
      },
      metadata: {
        agentName: 'orchestrator',
        agentType: AgentType.GENERATION,
        executionTime: Date.now() - startTime,
      },
    };
  }

  /**
   * Get workflow execution statistics
   */
  getWorkflowStats(): {
    totalAgents: number;
    agentsByType: Record<AgentType, number>;
    healthyAgents: number;
  } {
    const agentsByType: Record<AgentType, number> = {} as any;
    let healthyAgents = 0;

    for (const [type, agents] of this.agentsByType.entries()) {
      agentsByType[type] = agents.length;
    }

    // Note: This is a simplified health check count
    // In a real implementation, you'd want to cache health status
    
    return {
      totalAgents: this.agents.size,
      agentsByType,
      healthyAgents, // Placeholder - would need async health checks
    };
  }

  /**
   * Create a simple RAG workflow
   */
  createRAGWorkflow(): AgentWorkflow {
    return {
      name: 'rag-workflow',
      steps: [
        {
          agentName: 'retrieval-agent',
          agentType: AgentType.RETRIEVAL,
          retryCount: 2,
        },
        {
          agentName: 'similarity-agent',
          agentType: AgentType.SIMILARITY,
          condition: (context) => !!context.documents && context.documents.length > 0,
        },
        {
          agentName: 'generation-agent',
          agentType: AgentType.GENERATION,
        },
        {
          agentName: 'verification-agent',
          agentType: AgentType.VERIFICATION,
          condition: (context) => !!context.previousResults && context.previousResults.length > 0,
        },
      ],
      fallbackStrategy: 'skip',
    };
  }
}