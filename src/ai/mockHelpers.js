/**
 * mockHelpers.js
 *
 * Deterministic mock implementations for Chrome Built-in AI APIs
 * Used for testing and as fallback when AI is unavailable/slow
 *
 * All mocks are deterministic (same input → same output) for testing reliability
 */

import crypto from 'crypto';

/**
 * Generate deterministic mock embedding from text
 * Uses SHA-256 hash of text + seed to create reproducible embeddings
 *
 * @param {string} text - Input text to embed
 * @param {number} dims - Embedding dimensions (default: 512)
 * @param {string} seed - Seed for determinism (default: 'mock')
 * @returns {Float32Array} Deterministic embedding vector
 */
export function mockEmbeddingFromText(text, dims = 512, seed = 'mock') {
  // Create hash from text + seed
  const hash = crypto
    .createHash('sha256')
    .update(text + seed)
    .digest();

  const embedding = new Float32Array(dims);

  // Fill embedding using hash bytes (repeat hash if needed)
  for (let i = 0; i < dims; i++) {
    const hashIndex = i % hash.length;
    const byteValue = hash[hashIndex];

    // Normalize to [-1, 1] range
    embedding[i] = (byteValue / 255) * 2 - 1;

    // Add variation using sine waves based on position and hash
    const phase = (hash[(i * 7) % hash.length] / 255) * Math.PI * 2;
    embedding[i] += Math.sin(i * 0.1 + phase) * 0.1;
  }

  // Normalize the vector (unit length)
  const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  for (let i = 0; i < dims; i++) {
    embedding[i] /= norm;
  }

  return embedding;
}

/**
 * Generate deterministic mock summary from text
 * Extracts key sentences and creates a predictable summary structure
 *
 * @param {string} text - Input text to summarize
 * @param {Object} options - Summarization options
 * @param {number} options.maxTopics - Number of topics to generate (default: 5)
 * @returns {Promise<Object>} Summary with topics array
 */
export async function mockSummarize(text, options = {}) {
  const { maxTopics = 5 } = options;

  // Split text into sentences
  const sentences = text
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 10);

  // If text is too short, return simple summary
  if (sentences.length === 0) {
    return {
      summary: 'Summary not available for short text',
      topics: [{
        id: 'mock-root',
        title: 'Main Topic',
        text: text.slice(0, 200),
        summary: text.slice(0, 100),
        keyPoints: ['Short content provided']
      }]
    };
  }

  // Extract first sentence as overall summary
  const summary = sentences[0] || 'Document summary';

  // Generate topics by chunking sentences
  const topics = [];
  const sentencesPerTopic = Math.ceil(sentences.length / maxTopics);

  for (let i = 0; i < maxTopics && i * sentencesPerTopic < sentences.length; i++) {
    const topicSentences = sentences.slice(
      i * sentencesPerTopic,
      (i + 1) * sentencesPerTopic
    );

    if (topicSentences.length === 0) break;

    // Extract first few words as title
    const firstWords = topicSentences[0].split(/\s+/).slice(0, 5).join(' ');
    const title = firstWords.length > 0 ? firstWords : `Topic ${i + 1}`;

    // Combine sentences for text and summary
    const topicText = topicSentences.join('. ');
    const topicSummary = topicSentences[0].slice(0, 100);

    // Extract key points (max 2 per topic)
    const keyPoints = topicSentences.slice(0, 2).map(s =>
      s.length > 50 ? s.slice(0, 47) + '...' : s
    );

    topics.push({
      id: `mock-topic-${i}`,
      title,
      text: topicText.slice(0, 500), // Limit length
      summary: topicSummary,
      keyPoints: keyPoints.length > 0 ? keyPoints : ['No key points extracted']
    });
  }

  return {
    summary,
    topics: topics.length > 0 ? topics : [{
      id: 'mock-root',
      title: 'Main Topic',
      text: text.slice(0, 200),
      summary: summary,
      keyPoints: ['Mock summary generated']
    }]
  };
}

/**
 * Mock expand node - generate child nodes from parent text
 * Creates 2-4 deterministic child nodes based on text content
 *
 * @param {string} nodeText - Parent node text
 * @param {Object} options - Expansion options
 * @param {string} options.title - Parent node title
 * @param {number} options.numChildren - Number of children (default: 3)
 * @returns {Promise<Array>} Array of child node objects
 */
export async function mockExpandNode(nodeText, options = {}) {
  const { title = '', numChildren = 3 } = options;

  // Split text into chunks
  const words = nodeText.split(/\s+/).filter(w => w.length > 0);
  const chunkSize = Math.ceil(words.length / numChildren);

  if (words.length < numChildren * 2) {
    // Text too short, create minimal children
    return [{
      title: `${title} - Details`,
      text: nodeText
    }];
  }

  const children = [];
  for (let i = 0; i < numChildren && i * chunkSize < words.length; i++) {
    const chunk = words.slice(i * chunkSize, (i + 1) * chunkSize);

    if (chunk.length === 0) break;

    // Generate title from first few words
    const childTitle = chunk.slice(0, 5).join(' ');

    // Generate text from chunk
    const childText = chunk.join(' ').slice(0, 200);

    children.push({
      title: childTitle.length > 0 ? childTitle : `${title} - Part ${i + 1}`,
      text: childText.length > 0 ? childText : nodeText.slice(0, 100)
    });
  }

  return children.length > 0 ? children : [{
    title: `${title} - Details`,
    text: nodeText.slice(0, 200)
  }];
}

/**
 * Mock rewrite text - returns slightly modified version
 * Deterministic transformation based on tone parameter
 *
 * @param {string} text - Text to rewrite
 * @param {Object} options - Rewrite options
 * @param {string} options.tone - Tone: 'concise' | 'technical' | 'creative' (default: 'concise')
 * @param {string} options.length - Length: 'short' | 'medium' | 'long' (default: 'medium')
 * @returns {Promise<string>} Rewritten text
 */
export async function mockRewriteText(text, options = {}) {
  const { tone = 'concise', length = 'medium' } = options;

  // Deterministic transformation based on options
  let result = text;

  // Apply tone transformation (affects content style)
  if (tone === 'concise') {
    // Shorten to ~60% for concise tone
    const targetLength = Math.floor(text.length * 0.6);
    result = text.slice(0, targetLength);
    // Try to end at sentence boundary
    const lastPeriod = result.lastIndexOf('.');
    if (lastPeriod > targetLength * 0.8) {
      result = result.slice(0, lastPeriod + 1);
    }
  } else if (tone === 'technical') {
    // Add "Technical note:" prefix
    result = `Technical note: ${text}`;
  } else if (tone === 'creative') {
    // Add "Exploring the concept:" prefix
    result = `Exploring the concept: ${text}`;
  }

  // Apply length transformation (further modifies length)
  if (length === 'short') {
    // Further reduce to max 100 chars
    result = result.slice(0, Math.min(result.length, 100));
  } else if (length === 'long') {
    // Expand by repeating first sentence (deterministic)
    const sentences = result.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (sentences.length > 0) {
      result = result + ' ' + sentences[0] + '.';
    }
  }

  // Ensure result is not empty
  return result.length > 0 ? result : text;
}

/**
 * Check if mock mode should be used based on environment
 *
 * @returns {boolean} True if mock mode is enabled
 */
export function isMockMode() {
  // Check if running in test environment (Jest) or Node
  if (typeof process !== 'undefined' && process.env) {
    return process.env.VITE_AI_MODE === 'mock';
  }
  // Check Vite environment (browser) - use eval to prevent Jest parse error
  try {
    // eslint-disable-next-line no-eval
    const meta = eval('import.meta');
    if (meta && meta.env) {
      return meta.env.VITE_AI_MODE === 'mock';
    }
  } catch (e) {
    // import.meta not available in this environment
  }
  return false;
}

/**
 * Get configured AI timeout in milliseconds
 *
 * @returns {number} Timeout in milliseconds (default: 15000)
 */
export function getAITimeout() {
  let timeout;

  // Check if running in test environment (Jest) or Node
  if (typeof process !== 'undefined' && process.env) {
    timeout = Number(process.env.VITE_AI_TIMEOUT_MS);
  }
  // Check Vite environment (browser) - use eval to prevent Jest parse error
  else {
    try {
      // eslint-disable-next-line no-eval
      const meta = eval('import.meta');
      if (meta && meta.env) {
        timeout = Number(meta.env.VITE_AI_TIMEOUT_MS);
      }
    } catch (e) {
      // import.meta not available in this environment
    }
  }

  return !isNaN(timeout) && timeout > 0 ? timeout : 15000;
}

export default {
  mockEmbeddingFromText,
  mockSummarize,
  mockExpandNode,
  mockRewriteText,
  isMockMode,
  getAITimeout
};
