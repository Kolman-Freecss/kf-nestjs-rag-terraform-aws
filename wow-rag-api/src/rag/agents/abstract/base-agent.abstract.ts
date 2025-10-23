import { Injectable, Logger } from "@nestjs/common";
import { BaseAgent, AgentInput, AgentOutput } from "./base-agent.interface";

@Injectable()
export abstract class BaseAgentAbstract implements BaseAgent {
  protected readonly logger = new Logger(this.constructor.name);

  abstract name: string;
  abstract description: string;

  abstract process(input: AgentInput): Promise<AgentOutput>;
  abstract canHandle(input: AgentInput): Promise<boolean>;

  /**
   * Helper method to calculate confidence based on context relevance
   */
  protected calculateConfidence(
    question: string,
    context: any[],
    answer: string
  ): number {
    if (!context || context.length === 0) return 0.1;

    const questionLower = question.toLowerCase();
    const answerLower = answer.toLowerCase();

    let score = 0;

    // Check if answer contains keywords from question
    const questionWords = questionLower.split(/\W+/).filter(w => w.length > 2);
    const answerWords = answerLower.split(/\W+/).filter(w => w.length > 2);
    const overlap = questionWords.filter(w => answerWords.includes(w)).length;
    score += (overlap / Math.max(questionWords.length, 1)) * 0.4;

    // Check if context was used (simple heuristic)
    const contextText = context.map(c => c.pageContent || '').join(' ').toLowerCase();
    const contextOverlap = questionWords.filter(w => contextText.includes(w)).length;
    score += (contextOverlap / Math.max(questionWords.length, 1)) * 0.6;

    return Math.min(Math.max(score, 0.1), 1.0);
  }

  /**
   * Helper method to extract relevant keywords from question
   */
  protected extractKeywords(question: string): string[] {
    const lower = question.toLowerCase();
    // Remove common stop words and return meaningful words
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'what', 'how', 'why', 'when', 'where', 'who']);
    return lower.split(/\W+/).filter(word => word.length > 2 && !stopWords.has(word));
  }
}