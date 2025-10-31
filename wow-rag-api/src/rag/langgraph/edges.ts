import { Injectable, Logger } from "@nestjs/common";
import { WorkflowState, EdgeCondition } from "./types";

@Injectable()
export class WorkflowEdges {
  private readonly logger = new Logger(WorkflowEdges.name);

  /**
   * Determine next step after initialization
   */
  afterInitialize: EdgeCondition = (state: WorkflowState): string => {
    this.logger.log("Determining next step after initialization");
    
    // Check if we should use both agents or just RAG
    const shouldUseBlizzard = this.shouldUseBlizzardAgent(state.question);
    
    if (shouldUseBlizzard) {
      return "parallel_agents"; // Run RAG and Blizzard in parallel
    } else {
      return "rag_only"; // Run only RAG agent
    }
  };

  /**
   * Determine next step after RAG agent
   */
  afterRagAgent: EdgeCondition = (state: WorkflowState): string => {
    this.logger.log("Determining next step after RAG agent");
    
    // If RAG failed, try Blizzard as fallback
    if (state.currentStep === "rag_failed") {
      return "blizzard_fallback";
    }
    
    // If we have a good RAG result and no Blizzard needed, go to synthesis
    if (state.ragResult && state.ragResult.confidence > 0.7) {
      return "synthesis";
    }
    
    // If confidence is low, try Blizzard for additional context
    if (state.ragResult && state.ragResult.confidence < 0.5) {
      return "blizzard_additional";
    }
    
    return "synthesis";
  };

  /**
   * Determine next step after Blizzard agent
   */
  afterBlizzardAgent: EdgeCondition = (state: WorkflowState): string => {
    this.logger.log("Determining next step after Blizzard agent");
    
    // Always go to synthesis after Blizzard
    return "synthesis";
  };

  /**
   * Determine next step after parallel execution
   */
  afterParallelAgents: EdgeCondition = (state: WorkflowState): string => {
    this.logger.log("Determining next step after parallel agents");
    
    // Check if we have results from both agents
    const hasRagResult = !!state.ragResult;
    const hasBlizzardResult = !!state.blizzardResult;
    
    if (hasRagResult && hasBlizzardResult) {
      return "synthesis";
    } else if (hasRagResult || hasBlizzardResult) {
      return "synthesis"; // Synthesize with what we have
    } else {
      return "fallback_response"; // Both failed
    }
  };

  /**
   * Determine next step after synthesis
   */
  afterSynthesis: EdgeCondition = (state: WorkflowState): string => {
    this.logger.log("Determining next step after synthesis");
    
    if (state.currentStep === "synthesis_completed") {
      return "end";
    } else if (state.currentStep === "synthesis_failed") {
      return "fallback_response";
    }
    
    return "end";
  };

  /**
   * Determine if we should retry or give up
   */
  shouldRetry: EdgeCondition = (state: WorkflowState): string => {
    this.logger.log("Checking if should retry");
    
    // Don't retry if we've exceeded max iterations
    if (state.iteration >= 3) {
      return "fallback_response";
    }
    
    // Don't retry if we have a good result
    if (state.finalResult && state.finalResult.confidence > 0.6) {
      return "end";
    }
    
    // Retry if we have errors but haven't exceeded max iterations
    if (state.metadata.errors.length > 0 && state.iteration < 2) {
      return "retry";
    }
    
    return "end";
  };

  /**
   * Determine if we should use Blizzard agent based on question content
   */
  private shouldUseBlizzardAgent(question: string): boolean {
    const lower = question.toLowerCase();
    
    // Keywords that suggest we need live Blizzard data
    const blizzardKeywords = [
      "realm", "server", "character", "char", "guild", "item", "auction",
      "live", "current", "real-time", "now", "today", "recent"
    ];
    
    return blizzardKeywords.some(keyword => lower.includes(keyword));
  }

  /**
   * Check if question is WoW-related
   */
  private isWoWRelated(question: string): boolean {
    const lower = question.toLowerCase();
    
    const wowKeywords = [
      "wow", "world of warcraft", "warcraft", "blizzard", "horde", "alliance",
      "azeroth", "draenei", "dwarf", "elf", "gnome", "human", "orc", "tauren",
      "troll", "undead", "blood elf", "night elf", "worgen", "goblin", "pandaren"
    ];
    
    return wowKeywords.some(keyword => lower.includes(keyword));
  }

  /**
   * Determine if we need additional context
   */
  private needsAdditionalContext(state: WorkflowState): boolean {
    if (!state.ragResult) return true;
    
    // Check if answer is too short or generic
    if (state.ragResult.answer.length < 50) return true;
    
    // Check if confidence is too low
    if (state.ragResult.confidence < 0.4) return true;
    
    return false;
  }
}


