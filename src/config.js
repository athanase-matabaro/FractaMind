/**
 * config.js
 *
 * Application configuration and feature flags
 */

/**
 * Helper to get environment variable from either import.meta.env (Vite) or process.env (Node.js)
 * @param {string} key - Environment variable key (with VITE_ prefix)
 * @returns {string|undefined} Environment variable value
 */
function getEnv(key) {
  // In Node.js environment (scripts)
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key];
  }
  // In Vite/browser environment
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env[key];
  }
  // Fallback to undefined
  return undefined;
}

/**
 * Feature flags for conditional feature enablement
 */
export const FEATURE_FLAGS = {
  /**
   * Workspace multi-document federation
   * - Enables /workspace route
   * - Enables cross-project search
   * - Enables project management UI
   *
   * Set to false to disable workspace feature in emergency
   */
  FEATURE_WORKSPACE: getEnv('VITE_FEATURE_WORKSPACE') !== 'false',

  /**
   * Timeline view (Phase 4)
   */
  FEATURE_TIMELINE: true,

  /**
   * Node editing and rewriting
   */
  FEATURE_NODE_EDITING: true,

  /**
   * Export functionality (JSON/Markdown)
   */
  FEATURE_EXPORT: true,

  /**
   * Contextual links and semantic suggestions (Phase 6)
   * - Enables automatic link suggestions between nodes
   * - Enables manual link creation with relation types
   * - Enables link confidence scoring and provenance tracking
   *
   * Set to false to disable contextualization feature
   */
  FEATURE_CONTEXTUAL_LINKS: getEnv('VITE_FEATURE_CONTEXTUAL_LINKS') !== 'false',

  /**
   * Cross-project reasoning and collaborative intelligence (Phase 7)
   * - Enables cross-project relation inference
   * - Enables online topic modeling
   * - Enables CRDT-based collaborative editing
   * - Enables multi-format exports with provenance
   *
   * Set to false to disable Phase 7 features
   */
  FEATURE_PHASE7: getEnv('VITE_PHASE7_ENABLED') !== 'false',
};

/**
 * Performance budgets and limits
 */
export const PERFORMANCE = {
  /**
   * Maximum embeddings to load into memory at once
   */
  MAX_EMBEDDINGS_IN_RAM: 5000,

  /**
   * Maximum nodes per project for optimal performance
   */
  MAX_NODES_PER_PROJECT: 10000,

  /**
   * Cross-search timeout (milliseconds)
   */
  CROSS_SEARCH_TIMEOUT: 30000,

  /**
   * Main thread blocking threshold (milliseconds)
   */
  MAX_BLOCKING_TIME: 150,
};

/**
 * Search configuration
 */
export const SEARCH = {
  /**
   * Default number of results to return
   */
  DEFAULT_TOP_K: 20,

  /**
   * Default Morton range scan radius power (2^radiusPower)
   */
  DEFAULT_RADIUS_POWER: 12,

  /**
   * Enable freshness boost for recent content
   */
  ENABLE_FRESHNESS_BOOST: true,

  /**
   * Maximum freshness boost multiplier
   */
  MAX_FRESHNESS_BOOST: 1.5,

  /**
   * Freshness decay half-life in days
   */
  FRESHNESS_DECAY_DAYS: 30,
};

/**
 * Workspace configuration
 */
export const WORKSPACE = {
  /**
   * Default project weight for search ranking
   */
  DEFAULT_PROJECT_WEIGHT: 1.0,

  /**
   * Minimum allowed project weight
   */
  MIN_PROJECT_WEIGHT: 0.1,

  /**
   * Maximum allowed project weight
   */
  MAX_PROJECT_WEIGHT: 3.0,

  /**
   * Maximum number of concurrent project searches
   */
  MAX_CONCURRENT_SEARCHES: 3,
};

/**
 * AI Configuration
 */
export const AI = {
  /**
   * Use mock AI responses in tests
   */
  USE_MOCKS_IN_TESTS: true,

  /**
   * Embedding dimensions (typically 512 or 1536 depending on model)
   */
  EMBEDDING_DIMENSIONS: 512,

  /**
   * Maximum text length for embedding (characters)
   */
  MAX_EMBEDDING_TEXT_LENGTH: 2000,
};

/**
 * Contextualization and Linking Configuration (Phase 6)
 */
export const CONTEXTUALIZATION = {
  /**
   * Number of top suggestions to return
   */
  SUGGEST_TOP_K: parseInt(getEnv('VITE_CONTEXT_SUGGEST_TOPK')) || 8,

  /**
   * Cosine similarity threshold for auto link candidates
   */
  LINK_SIM_THRESHOLD: parseFloat(getEnv('VITE_LINK_SIM_THRESHOLD')) || 0.78,

  /**
   * Context decay half-life in hours for recency bias
   */
  CONTEXT_HALF_LIFE_HOURS: parseFloat(getEnv('VITE_CONTEXT_HALF_LIFE_HOURS')) || 72,

  /**
   * Maximum batch size for background link processing
   */
  LINK_MAX_BATCH: parseInt(getEnv('VITE_LINK_MAX_BATCH')) || 2000,

  /**
   * Confidence score weights for link calculation
   */
  CONFIDENCE_WEIGHTS: {
    semantic: 0.5,    // w_sim: cosine similarity weight
    ai: 0.3,          // w_ai: AI relation confidence weight
    lexical: 0.1,     // w_lex: n-gram overlap weight
    contextual: 0.1,  // w_bias: contextual recency/action bias weight
  },

  /**
   * Relation types taxonomy
   */
  RELATION_TYPES: [
    { id: 'clarifies', label: 'Clarifies', icon: '💡', description: 'Explains or elaborates on the target' },
    { id: 'contradicts', label: 'Contradicts', icon: '⚡', description: 'Presents opposing view or information' },
    { id: 'elaborates', label: 'Elaborates', icon: '📝', description: 'Provides additional detail' },
    { id: 'example-of', label: 'Example Of', icon: '🔍', description: 'Concrete instance or case' },
    { id: 'causes', label: 'Causes', icon: '➡️', description: 'Causal relationship' },
    { id: 'depends-on', label: 'Depends On', icon: '🔗', description: 'Logical or temporal dependency' },
    { id: 'similar-to', label: 'Similar To', icon: '🔄', description: 'Thematically or structurally similar' },
    { id: 'references', label: 'References', icon: '📌', description: 'Cites or mentions' },
    { id: 'related', label: 'Related', icon: '🌐', description: 'General connection' },
  ],
};

/**
 * Cross-Project Reasoning and Federated Intelligence Configuration (Phase 7)
 */
export const PHASE7 = {
  /**
   * Maximum reasoning depth for cross-project inference chains
   */
  REASONER_MAX_DEPTH: parseInt(getEnv('VITE_REASONER_MAX_DEPTH')) || 3,

  /**
   * Reasoning confidence blending weights [w_sim, w_ai, w_lex, w_bias]
   */
  REASONER_CONF_BLEND: (() => {
    const blend = getEnv('VITE_REASONER_CONF_BLEND');
    if (blend) {
      const parts = blend.split(',').map(parseFloat);
      return {
        semantic: parts[0] || 0.5,
        ai: parts[1] || 0.3,
        lexical: parts[2] || 0.1,
        contextual: parts[3] || 0.1,
      };
    }
    return {
      semantic: 0.5,
      ai: 0.3,
      lexical: 0.1,
      contextual: 0.1,
    };
  })(),

  /**
   * Topic modeling time window in minutes
   */
  TOPIC_WINDOW_MINUTES: parseInt(getEnv('VITE_TOPIC_WINDOW_MINUTES')) || 60,

  /**
   * Number of topics for clustering
   */
  TOPIC_NUM_TOPICS: parseInt(getEnv('VITE_TOPIC_NUM_TOPICS')) || 40,

  /**
   * CRDT implementation: 'automerge' or 'yjs'
   */
  COLLAB_CRDT: getEnv('VITE_COLLAB_CRDT') || 'automerge',

  /**
   * Reasoner timeout in milliseconds (target for prefilter + scoring)
   */
  REASONER_TIMEOUT_MS: parseInt(getEnv('VITE_REASONER_TIMEOUT_MS')) || 250,

  /**
   * Maximum batch size for cross-project reasoning
   */
  REASONER_MAX_BATCH: parseInt(getEnv('VITE_REASONER_MAX_BATCH')) || 2000,

  /**
   * Performance targets for validation
   */
  PERFORMANCE_TARGETS: {
    PREFILTER_SCORING_MEAN_MS: 250,
    PREFILTER_SCORING_P95_MS: 400,
    TOPIC_UPDATE_MEAN_MS: 500,
    CHAIN_SEARCH_P95_MS: 700,
  },
};

/**
 * Check if a feature is enabled
 * @param {string} featureName - Name of the feature flag
 * @returns {boolean} True if feature is enabled
 */
export function isFeatureEnabled(featureName) {
  return FEATURE_FLAGS[featureName] === true;
}

/**
 * Get configuration value
 * @param {string} category - Config category (e.g., 'SEARCH', 'WORKSPACE')
 * @param {string} key - Config key
 * @returns {*} Configuration value
 */
export function getConfig(category, key) {
  const categoryConfig = {
    PERFORMANCE,
    SEARCH,
    WORKSPACE,
    AI,
    CONTEXTUALIZATION,
    PHASE7,
  }[category];

  if (!categoryConfig) {
    throw new Error(`Unknown config category: ${category}`);
  }

  if (!(key in categoryConfig)) {
    throw new Error(`Unknown config key: ${key} in category ${category}`);
  }

  return categoryConfig[key];
}

export default {
  FEATURE_FLAGS,
  PERFORMANCE,
  SEARCH,
  WORKSPACE,
  AI,
  CONTEXTUALIZATION,
  PHASE7,
  isFeatureEnabled,
  getConfig,
};
