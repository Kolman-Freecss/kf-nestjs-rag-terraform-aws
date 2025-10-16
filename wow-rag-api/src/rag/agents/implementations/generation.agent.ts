import { BaseAgentImpl } from './base.agent';
import {
  GenerationAgent,
  AgentType,
  AgentConfig,
  AgentResult,
  AgentContext,
  GenerationOptions,
} from '../interfaces/agent.interfaces';
import { ModelFactory } from '../../models/factory/model.factory';
import { TextGenerationClient } from '../../models/interfaces/model.interfaces';

/**
 * Agent responsible for generating text responses using language models
 */
export class GenerationAgentImpl extends BaseAgentImpl implements GenerationAgent {
  constructor(config: AgentConfig, modelFactory: ModelFactory) {
    super(
      config.name,
      AgentType.GENERATION,
      ['text-generation', 'response-generation', 'content-creation'],
      config,
      modelFactory,
    );
  }

  /**
   * Generate text based on a prompt and context
   */
  async generate(
    prompt: string,
    context?: AgentContext,
    options?: GenerationOptions,
  ): Promise<AgentResult<string>> {
    this.validateInput(prompt, 'prompt');

    return this.executeWithRetry(async () => {
      const client = await this.getHealthyClient() as TextGenerationClient;
      if (!client) {
        throw new Error('No healthy text generation model available');
      }

      // Build the full prompt with context if provided
      const fullPrompt = this.buildPrompt(prompt, context, options);

      const response = await client.generate(fullPrompt, {
        maxNewTokens: options?.maxTokens || 300,
        temperature: options?.temperature || 0.7,
        topP: options?.topP || 0.9,
        stop: options?.stopSequences || [],
        returnFullText: false,
      });

      if (!response.success) {
        throw new Error(response.error || 'Text generation failed');
      }

      let generatedText = response.data!.generatedText;

      // Post-process the generated text
      generatedText = this.postProcessGeneration(generatedText, options);

      return generatedText;
    }, 'generate');
  }

  /**
   * Generate text with built-in verification
   */
  async generateWithVerification(
    prompt: string,
    context: AgentContext,
    options?: GenerationOptions,
  ): Promise<AgentResult<{ text: string; verified: boolean; confidence: number }>> {
    this.validateInput(prompt, 'prompt');
    this.validateInput(context, 'context');

    return this.executeWithRetry(async () => {
      // Generate the initial response
      const generationResult = await this.generate(prompt, context, options);
      if (!generationResult.success) {
        throw new Error(generationResult.error || 'Generation failed');
      }

      const generatedText = generationResult.data!;

      // Perform verification
      const verification = await this.verifyGeneration(generatedText, context);

      return {
        text: generatedText,
        verified: verification.verified,
        confidence: verification.confidence,
      };
    }, 'generateWithVerification');
  }

  /**
   * Build the full prompt with context and instructions
   */
  private buildPrompt(
    prompt: string,
    context?: AgentContext,
    options?: GenerationOptions,
  ): string {
    let fullPrompt = '';

    // Add system instructions
    fullPrompt += this.getSystemInstructions(options);

    // Add context if available and requested
    if (options?.includeContext && context?.documents) {
      fullPrompt += this.buildContextSection(context);
    }

    // Add the main prompt
    fullPrompt += `\n\nQuestion: ${prompt}\n\nAnswer:`;

    return fullPrompt;
  }

  /**
   * Get system instructions for the model
   */
  private getSystemInstructions(options?: GenerationOptions): string {
    let instructions = 'You are a helpful assistant that provides accurate and informative responses.';

    if (options?.requireCitations) {
      instructions += ' Always cite your sources using the notation [doc:N] when referencing provided documents.';
    }

    instructions += ' Be concise and factual. If you cannot answer confidently from the provided information, say "I don\'t know".';

    return instructions;
  }

  /**
   * Build the context section from documents
   */
  private buildContextSection(context: AgentContext): string {
    if (!context.documents || context.documents.length === 0) {
      return '';
    }

    let contextSection = '\n\nContext Information:\n';
    
    context.documents.forEach((doc, index) => {
      const docNumber = index + 1;
      const topic = doc.metadata?.topic || 'unknown';
      const source = doc.metadata?.source || 'unknown';
      
      contextSection += `[doc:${docNumber} | topic:${topic} | source:${source}]\n`;
      contextSection += `${doc.pageContent}\n---\n`;
    });

    return contextSection;
  }

  /**
   * Post-process the generated text
   */
  private postProcessGeneration(text: string, options?: GenerationOptions): string {
    let processed = text.trim();

    // Remove any unwanted prefixes or suffixes
    processed = processed.replace(/^(Answer:|Response:)\s*/i, '');
    
    // Clean up extra whitespace
    processed = processed.replace(/\s+/g, ' ').trim();

    // Ensure proper sentence ending
    if (processed && !processed.match(/[.!?]$/)) {
      processed += '.';
    }

    return processed;
  }

  /**
   * Verify the quality of generated text
   */
  private async verifyGeneration(
    generatedText: string,
    context: AgentContext,
  ): Promise<{ verified: boolean; confidence: number }> {
    try {
      // Basic verification checks
      const checks = {
        hasContent: generatedText.trim().length > 0,
        isCoherent: this.checkCoherence(generatedText),
        hasValidCitations: this.checkCitations(generatedText, context),
        isFactuallyConsistent: await this.checkFactualConsistency(generatedText, context),
      };

      // Calculate confidence based on checks
      const passedChecks = Object.values(checks).filter(Boolean).length;
      const totalChecks = Object.keys(checks).length;
      const confidence = passedChecks / totalChecks;

      // Consider verified if confidence is above threshold
      const verified = confidence >= 0.75;

      return { verified, confidence };
    } catch (error) {
      this.logger.warn('Verification failed:', error);
      return { verified: false, confidence: 0 };
    }
  }

  /**
   * Check if the text is coherent
   */
  private checkCoherence(text: string): boolean {
    // Basic coherence checks
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    // Must have at least one complete sentence
    if (sentences.length === 0) return false;
    
    // Check for reasonable sentence length
    const avgSentenceLength = sentences.reduce((sum, s) => sum + s.trim().split(/\s+/).length, 0) / sentences.length;
    if (avgSentenceLength < 3 || avgSentenceLength > 50) return false;
    
    // Check for repetitive content
    const words = text.toLowerCase().split(/\s+/);
    const uniqueWords = new Set(words);
    const repetitionRatio = uniqueWords.size / words.length;
    if (repetitionRatio < 0.5) return false;

    return true;
  }

  /**
   * Check if citations are valid
   */
  private checkCitations(text: string, context: AgentContext): boolean {
    const citationPattern = /\[doc:(\d+)\]/g;
    const citations = Array.from(text.matchAll(citationPattern));
    
    if (citations.length === 0) {
      // No citations required if no documents provided
      return !context.documents || context.documents.length === 0;
    }

    // Check if all citations reference valid documents
    const maxDocIndex = context.documents?.length || 0;
    return citations.every(match => {
      const docIndex = parseInt(match[1]);
      return docIndex >= 1 && docIndex <= maxDocIndex;
    });
  }

  /**
   * Check factual consistency with provided context
   */
  private async checkFactualConsistency(
    text: string,
    context: AgentContext,
  ): Promise<boolean> {
    // This is a simplified check - in a real implementation,
    // you might use another model for fact-checking
    
    if (!context.documents || context.documents.length === 0) {
      return true; // Can't verify without context
    }

    // Check if the generated text contains information that contradicts the context
    const contextText = context.documents.map(doc => doc.pageContent).join(' ').toLowerCase();
    const generatedLower = text.toLowerCase();

    // Simple keyword-based consistency check
    // This is very basic and should be replaced with more sophisticated methods
    const keyPhrases = this.extractKeyPhrases(generatedLower);
    const contextPhrases = this.extractKeyPhrases(contextText);

    // Check if key phrases from generation appear in context
    const supportedPhrases = keyPhrases.filter(phrase => 
      contextPhrases.some(contextPhrase => 
        contextPhrase.includes(phrase) || phrase.includes(contextPhrase)
      )
    );

    // Consider consistent if at least 50% of key phrases are supported
    return supportedPhrases.length >= keyPhrases.length * 0.5;
  }

  /**
   * Extract key phrases from text
   */
  private extractKeyPhrases(text: string): string[] {
    // Simple extraction of noun phrases and important terms
    const words = text.split(/\s+/).filter(word => word.length > 3);
    const stopWords = new Set(['this', 'that', 'with', 'from', 'they', 'them', 'their', 'there', 'where', 'when', 'what', 'which', 'while']);
    
    return words
      .filter(word => !stopWords.has(word))
      .filter(word => /^[a-zA-Z]+$/.test(word))
      .slice(0, 10); // Limit to top 10 key words
  }

  /**
   * Generate multiple responses and select the best one
   */
  async generateWithSelection(
    prompt: string,
    context?: AgentContext,
    options?: GenerationOptions,
    numCandidates = 3,
  ): Promise<AgentResult<{ text: string; confidence: number }>> {
    return this.executeWithRetry(async () => {
      const candidates: Array<{ text: string; confidence: number }> = [];

      // Generate multiple candidates
      for (let i = 0; i < numCandidates; i++) {
        const result = await this.generate(prompt, context, {
          ...options,
          temperature: (options?.temperature || 0.7) + (i * 0.1), // Vary temperature
        });

        if (result.success) {
          const verification = await this.verifyGeneration(result.data!, context || { query: prompt });
          candidates.push({
            text: result.data!,
            confidence: verification.confidence,
          });
        }
      }

      if (candidates.length === 0) {
        throw new Error('Failed to generate any valid candidates');
      }

      // Select the candidate with highest confidence
      const bestCandidate = candidates.reduce((best, current) => 
        current.confidence > best.confidence ? current : best
      );

      return bestCandidate;
    }, 'generateWithSelection');
  }
}