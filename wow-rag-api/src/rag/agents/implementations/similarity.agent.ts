import { Document } from 'langchain/document';
import { BaseAgentImpl } from './base.agent';
import { SimilarityAgent, AgentType, AgentConfig, AgentResult } from '../interfaces/agent.interfaces';
import { ModelFactory } from '../../models/factory/model.factory';
import { SimilarityClient } from '../../models/interfaces/model.interfaces';

/**
 * Agent responsible for calculating text similarity and ranking documents
 */
export class SimilarityAgentImpl extends BaseAgentImpl implements SimilarityAgent {
  constructor(config: AgentConfig, modelFactory: ModelFactory) {
    super(
      config.name,
      AgentType.SIMILARITY,
      ['sentence-similarity', 'document-ranking', 'semantic-search'],
      config,
      modelFactory,
    );
  }

  /**
   * Calculate similarity scores between a source sentence and target sentences
   */
  async calculateSimilarity(
    sourceSentence: string,
    targetSentences: string[],
  ): Promise<AgentResult<number[]>> {
    this.validateInput(sourceSentence, 'sourceSentence');
    this.validateInput(targetSentences, 'targetSentences');

    return this.executeWithRetry(async () => {
      const client = await this.getHealthyClient() as SimilarityClient;
      if (!client) {
        throw new Error('No healthy similarity model available');
      }

      const response = await client.calculateSimilarity(sourceSentence, targetSentences);
      if (!response.success) {
        throw new Error(response.error || 'Similarity calculation failed');
      }

      return response.data!.scores;
    }, 'calculateSimilarity');
  }

  /**
   * Find the most similar sentences with their scores
   */
  async findMostSimilar(
    sourceSentence: string,
    targetSentences: string[],
    topK = 5,
  ): Promise<AgentResult<{ sentence: string; score: number }[]>> {
    this.validateInput(sourceSentence, 'sourceSentence');
    this.validateInput(targetSentences, 'targetSentences');

    return this.executeWithRetry(async () => {
      const client = await this.getHealthyClient() as SimilarityClient;
      if (!client) {
        throw new Error('No healthy similarity model available');
      }

      const response = await client.findMostSimilar(sourceSentence, targetSentences, topK);
      if (!response.success) {
        throw new Error(response.error || 'Most similar search failed');
      }

      return response.data!;
    }, 'findMostSimilar');
  }

  /**
   * Rank documents based on their similarity to a query
   */
  async rankDocuments(query: string, documents: Document[]): Promise<AgentResult<Document[]>> {
    this.validateInput(query, 'query');
    this.validateInput(documents, 'documents');

    return this.executeWithRetry(async () => {
      // Extract text content from documents
      const documentTexts = documents.map(doc => doc.pageContent);
      
      // Calculate similarities
      const client = await this.getHealthyClient() as SimilarityClient;
      if (!client) {
        throw new Error('No healthy similarity model available');
      }

      const response = await client.calculateSimilarity(query, documentTexts);
      if (!response.success) {
        throw new Error(response.error || 'Document ranking failed');
      }

      const scores = response.data!.scores;

      // Create document-score pairs and sort by score descending
      const rankedDocuments = documents
        .map((doc, index) => ({
          document: doc,
          score: scores[index] || 0,
        }))
        .sort((a, b) => b.score - a.score)
        .map(item => item.document);

      return rankedDocuments;
    }, 'rankDocuments');
  }

  /**
   * Hybrid ranking that combines lexical and semantic similarity
   */
  async hybridRankDocuments(
    query: string,
    documents: Document[],
    semanticWeight = 0.7,
    lexicalWeight = 0.3,
  ): Promise<AgentResult<Document[]>> {
    this.validateInput(query, 'query');
    this.validateInput(documents, 'documents');

    return this.executeWithRetry(async () => {
      // Get semantic scores
      const semanticResult = await this.rankDocuments(query, documents);
      if (!semanticResult.success) {
        throw new Error('Semantic ranking failed');
      }

      // Calculate lexical scores (simple keyword overlap)
      const lexicalScores = this.calculateLexicalScores(query, documents);

      // Combine scores
      const combinedScores = documents.map((doc, index) => {
        const semanticRank = semanticResult.data!.findIndex(d => d === doc);
        const semanticScore = semanticRank >= 0 ? (documents.length - semanticRank) / documents.length : 0;
        const lexicalScore = lexicalScores[index];
        
        return {
          document: doc,
          score: semanticScore * semanticWeight + lexicalScore * lexicalWeight,
        };
      });

      // Sort by combined score
      const rankedDocuments = combinedScores
        .sort((a, b) => b.score - a.score)
        .map(item => item.document);

      return rankedDocuments;
    }, 'hybridRankDocuments');
  }

  /**
   * Calculate lexical similarity scores using keyword overlap
   */
  private calculateLexicalScores(query: string, documents: Document[]): number[] {
    const queryTokens = this.tokenize(query.toLowerCase());
    
    return documents.map(doc => {
      const docTokens = this.tokenize(doc.pageContent.toLowerCase());
      const overlap = queryTokens.filter(token => docTokens.includes(token)).length;
      return docTokens.length > 0 ? overlap / docTokens.length : 0;
    });
  }

  /**
   * Simple tokenization
   */
  private tokenize(text: string): string[] {
    return text
      .split(/[^\w']+/)
      .filter(token => token.length > 0)
      .filter(token => !this.isStopWord(token));
  }

  /**
   * Check if a word is a stop word
   */
  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
      'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those',
    ]);
    return stopWords.has(word);
  }

  /**
   * Batch similarity calculation for multiple queries
   */
  async batchCalculateSimilarity(
    queries: string[],
    targetSentences: string[],
  ): Promise<AgentResult<number[][]>> {
    this.validateInput(queries, 'queries');
    this.validateInput(targetSentences, 'targetSentences');

    return this.executeWithRetry(async () => {
      const results: number[][] = [];
      
      for (const query of queries) {
        const result = await this.calculateSimilarity(query, targetSentences);
        if (!result.success) {
          throw new Error(`Batch similarity calculation failed for query: ${query}`);
        }
        results.push(result.data!);
      }

      return results;
    }, 'batchCalculateSimilarity');
  }
}