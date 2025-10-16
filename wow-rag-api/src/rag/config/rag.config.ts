import { ModelType } from '../models/interfaces/model.interfaces';
import { AgentType } from '../agents/interfaces/agent.interfaces';

/**
 * Configuration for the RAG system
 */
export interface RAGConfig {
  models: ModelConfiguration;
  agents: AgentConfiguration;
  retrieval: RetrievalConfiguration;
  generation: GenerationConfiguration;
  verification: VerificationConfiguration;
}

/**
 * Model configuration
 */
export interface ModelConfiguration {
  primary: {
    [ModelType.SIMILARITY]: string[];
    [ModelType.TEXT_GENERATION]: string[];
    [ModelType.EMBEDDING]: string[];
    [ModelType.MASKED_LANGUAGE_MODEL]: string[];
    [ModelType.FEATURE_EXTRACTION]: string[];
  };
  fallback: {
    [ModelType.SIMILARITY]: string[];
    [ModelType.TEXT_GENERATION]: string[];
    [ModelType.EMBEDDING]: string[];
    [ModelType.MASKED_LANGUAGE_MODEL]: string[];
    [ModelType.FEATURE_EXTRACTION]: string[];
  };
  healthCheckInterval: number;
  maxRetries: number;
  timeout: number;
}

/**
 * Agent configuration
 */
export interface AgentConfiguration {
  enabled: {
    [AgentType.RETRIEVAL]: boolean;
    [AgentType.SIMILARITY]: boolean;
    [AgentType.GENERATION]: boolean;
    [AgentType.EMBEDDING]: boolean;
    [AgentType.RERANKING]: boolean;
    [AgentType.VERIFICATION]: boolean;
  };
  instances: {
    [key: string]: {
      type: AgentType;
      models: string[];
      fallbackModels: string[];
      maxRetries: number;
      timeout: number;
      customSettings: Record<string, any>;
    };
  };
}

/**
 * Retrieval configuration
 */
export interface RetrievalConfiguration {
  defaultTopK: number;
  maxTopK: number;
  similarityThreshold: number;
  rerankingEnabled: boolean;
  rerankingAlgorithm: 'lexical' | 'semantic' | 'hybrid';
  hybridWeights: {
    semantic: number;
    lexical: number;
  };
}

/**
 * Generation configuration
 */
export interface GenerationConfiguration {
  defaultMaxTokens: number;
  defaultTemperature: number;
  defaultTopP: number;
  requireCitations: boolean;
  verificationEnabled: boolean;
  multiCandidateGeneration: boolean;
  candidateCount: number;
  stopSequences: string[];
}

/**
 * Verification configuration
 */
export interface VerificationConfiguration {
  enabled: boolean;
  confidenceThreshold: number;
  checks: {
    factualAccuracy: boolean;
    citations: boolean;
    coherence: boolean;
    relevance: boolean;
  };
  fallbackOnFailure: boolean;
}

/**
 * Default RAG configuration
 */
export const DEFAULT_RAG_CONFIG: RAGConfig = {
  models: {
    primary: {
      [ModelType.SIMILARITY]: [
        'ibm-granite/granite-embedding-english-r2',
        'google/embeddinggemma-300m',
      ],
      [ModelType.TEXT_GENERATION]: [
        'gpt2',
        'microsoft/DialoGPT-medium',
      ],
      [ModelType.EMBEDDING]: [
        'sentence-transformers/all-MiniLM-L6-v2',
      ],
      [ModelType.MASKED_LANGUAGE_MODEL]: [
        'distilbert/distilbert-base-uncased',
      ],
      [ModelType.FEATURE_EXTRACTION]: [
        'sentence-transformers/all-MiniLM-L6-v2',
      ],
    },
    fallback: {
      [ModelType.SIMILARITY]: [
        'google/embeddinggemma-300m',
      ],
      [ModelType.TEXT_GENERATION]: [
        'microsoft/DialoGPT-medium',
      ],
      [ModelType.EMBEDDING]: [],
      [ModelType.MASKED_LANGUAGE_MODEL]: [],
      [ModelType.FEATURE_EXTRACTION]: [],
    },
    healthCheckInterval: 300000, // 5 minutes
    maxRetries: 3,
    timeout: 30000,
  },
  agents: {
    enabled: {
      [AgentType.RETRIEVAL]: true,
      [AgentType.SIMILARITY]: true,
      [AgentType.GENERATION]: true,
      [AgentType.EMBEDDING]: true,
      [AgentType.RERANKING]: true,
      [AgentType.VERIFICATION]: true,
    },
    instances: {
      'primary-similarity': {
        type: AgentType.SIMILARITY,
        models: ['ibm-granite/granite-embedding-english-r2'],
        fallbackModels: ['google/embeddinggemma-300m'],
        maxRetries: 3,
        timeout: 30000,
        customSettings: {},
      },
      'primary-generation': {
        type: AgentType.GENERATION,
        models: ['gpt2'],
        fallbackModels: ['microsoft/DialoGPT-medium'],
        maxRetries: 3,
        timeout: 45000,
        customSettings: {
          requireCitations: true,
          verificationEnabled: true,
        },
      },
      'primary-embedding': {
        type: AgentType.EMBEDDING,
        models: ['sentence-transformers/all-MiniLM-L6-v2'],
        fallbackModels: [],
        maxRetries: 3,
        timeout: 30000,
        customSettings: {
          normalize: true,
        },
      },
    },
  },
  retrieval: {
    defaultTopK: 6,
    maxTopK: 20,
    similarityThreshold: 0.1,
    rerankingEnabled: true,
    rerankingAlgorithm: 'hybrid',
    hybridWeights: {
      semantic: 0.7,
      lexical: 0.3,
    },
  },
  generation: {
    defaultMaxTokens: 300,
    defaultTemperature: 0.0,
    defaultTopP: 1.0,
    requireCitations: true,
    verificationEnabled: true,
    multiCandidateGeneration: false,
    candidateCount: 3,
    stopSequences: ['\n\n'],
  },
  verification: {
    enabled: true,
    confidenceThreshold: 0.75,
    checks: {
      factualAccuracy: true,
      citations: true,
      coherence: true,
      relevance: true,
    },
    fallbackOnFailure: true,
  },
};

/**
 * Configuration profiles for different use cases
 */
export const RAG_CONFIG_PROFILES = {
  development: {
    ...DEFAULT_RAG_CONFIG,
    models: {
      ...DEFAULT_RAG_CONFIG.models,
      maxRetries: 1,
      timeout: 15000,
    },
    verification: {
      ...DEFAULT_RAG_CONFIG.verification,
      enabled: false,
    },
  },
  production: {
    ...DEFAULT_RAG_CONFIG,
    models: {
      ...DEFAULT_RAG_CONFIG.models,
      maxRetries: 5,
      timeout: 60000,
    },
    verification: {
      ...DEFAULT_RAG_CONFIG.verification,
      enabled: true,
      confidenceThreshold: 0.8,
    },
  },
  fast: {
    ...DEFAULT_RAG_CONFIG,
    retrieval: {
      ...DEFAULT_RAG_CONFIG.retrieval,
      defaultTopK: 3,
      rerankingEnabled: false,
    },
    generation: {
      ...DEFAULT_RAG_CONFIG.generation,
      defaultMaxTokens: 150,
      verificationEnabled: false,
    },
    verification: {
      ...DEFAULT_RAG_CONFIG.verification,
      enabled: false,
    },
  },
  accurate: {
    ...DEFAULT_RAG_CONFIG,
    retrieval: {
      ...DEFAULT_RAG_CONFIG.retrieval,
      defaultTopK: 10,
      rerankingEnabled: true,
    },
    generation: {
      ...DEFAULT_RAG_CONFIG.generation,
      multiCandidateGeneration: true,
      candidateCount: 5,
      verificationEnabled: true,
    },
    verification: {
      ...DEFAULT_RAG_CONFIG.verification,
      enabled: true,
      confidenceThreshold: 0.9,
    },
  },
};

/**
 * Environment-based configuration loader
 */
export class RAGConfigLoader {
  static load(environment = 'development'): RAGConfig {
    const profile = RAG_CONFIG_PROFILES[environment as keyof typeof RAG_CONFIG_PROFILES];
    if (!profile) {
      console.warn(`Unknown RAG config profile: ${environment}, using default`);
      return DEFAULT_RAG_CONFIG;
    }
    return profile;
  }

  static loadFromEnv(): RAGConfig {
    const environment = process.env.NODE_ENV || 'development';
    return this.load(environment);
  }

  static merge(base: RAGConfig, overrides: Partial<RAGConfig>): RAGConfig {
    return {
      models: { ...base.models, ...overrides.models },
      agents: { ...base.agents, ...overrides.agents },
      retrieval: { ...base.retrieval, ...overrides.retrieval },
      generation: { ...base.generation, ...overrides.generation },
      verification: { ...base.verification, ...overrides.verification },
    };
  }
}