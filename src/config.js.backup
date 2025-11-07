/**
 * config.js
 *
 * Application configuration and feature flags
 */

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
  FEATURE_WORKSPACE: import.meta.env.VITE_FEATURE_WORKSPACE !== 'false',

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
  isFeatureEnabled,
  getConfig,
};
