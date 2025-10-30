/**
 * Chrome Built-in AI API Wrapper
 *
 * Provides client-side wrappers for Chrome's Gemini Nano APIs:
 * - Summarizer API: Generate top-level nodes from documents
 * - Embeddings API: Generate semantic vectors for search
 * - Writer API: Expand nodes into child ideas
 * - Prompt API: Structured JSON generation
 *
 * All operations run locally in the browser with no data leaving the device.
 *
 * ROBUSTNESS FEATURES:
 * - Configurable timeouts (default: 15s)
 * - Automatic fallback to deterministic mocks on error/timeout
 * - Mock mode via VITE_AI_MODE=mock environment variable
 * - Never leaves UI in permanent loading state
 */

import * as mockHelpers from './mockHelpers.js';

// Configuration from environment variables
// Support both Vite (import.meta.env) and Jest (process.env)
function getEnvVar(name, defaultValue = '') {
  // Jest/Node environment
  if (typeof process !== 'undefined' && process.env && process.env[name]) {
    return process.env[name];
  }
  // Vite environment - use eval to prevent Jest parse error
  try {
    // eslint-disable-next-line no-eval
    const meta = eval('import.meta');
    if (meta && meta.env && meta.env[name]) {
      return meta.env[name];
    }
  } catch (e) {
    // import.meta not available in this environment
  }
  return defaultValue;
}

const DEFAULT_TIMEOUT_MS = Number(getEnvVar('VITE_AI_TIMEOUT_MS', '15000'));
const AI_MODE = getEnvVar('VITE_AI_MODE', 'live');

/**
 * Wrap a promise with a timeout
 * Rejects with TimeoutError if promise doesn't resolve/reject within ms
 *
 * @param {Promise} promise - Promise to wrap
 * @param {number} ms - Timeout in milliseconds
 * @param {string} msg - Error message for timeout
 * @returns {Promise} Race between promise and timeout
 */
function timeout(promise, ms, msg = 'Operation timed out') {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(msg)), ms)
    )
  ]);
}

/**
 * Check if mock mode is enabled globally
 * @returns {boolean} True if using mock mode
 */
export function isMockMode() {
  return AI_MODE === 'mock';
}

/**
 * Check if Chrome Built-in AI APIs are available
 */
export function checkAIAvailability() {
  const available = {
    summarizer: 'ai' in window && 'summarizer' in window.ai,
    embeddings: 'ai' in window && 'embedding' in window.ai,
    writer: 'ai' in window && 'writer' in window.ai,
    prompt: 'ai' in window && 'languageModel' in window.ai,
  };

  const allAvailable = Object.values(available).every(Boolean);

  return {
    available,
    allAvailable,
    missingAPIs: Object.entries(available)
      .filter(([, isAvail]) => !isAvail)
      .map(([api]) => api),
  };
}

/**
 * Robust JSON parser that handles common AI output issues
 * - Strips markdown code fences (```json ... ```)
 * - Removes trailing commas
 * - Handles JSON embedded in text
 */
function parseAIJSON(text) {
  try {
    // First, try direct parse
    return JSON.parse(text);
  } catch (e) {
    // Try to clean the text
    let cleaned = text.trim();

    // Remove markdown code fences
    cleaned = cleaned.replace(/```json\s*/g, '').replace(/```\s*/g, '');

    // Remove trailing commas before closing braces/brackets
    cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');

    // Try to extract JSON array or object using regex
    const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
    const objectMatch = cleaned.match(/\{[\s\S]*\}/);

    if (arrayMatch) {
      try {
        return JSON.parse(arrayMatch[0]);
      } catch (e2) {
        console.warn('Failed to parse extracted array:', e2);
      }
    }

    if (objectMatch) {
      try {
        return JSON.parse(objectMatch[0]);
      } catch (e2) {
        console.warn('Failed to parse extracted object:', e2);
      }
    }

    throw new Error(`Failed to parse AI response as JSON: ${e.message}`);
  }
}

/**
 * Summarize a document into 3-7 top-level subtopics
 * SAFE WRAPPER: Applies timeout and automatic fallback to mocks
 *
 * @param {string} text - Document text to summarize (up to ~10,000 words)
 * @param {Object} options - Summarization options
 * @param {number} options.maxTopics - Number of subtopics (default: 5)
 * @param {string} options.format - Output format: 'json' | 'markdown' (default: 'json')
 * @param {boolean} options.mock - Force mock mode (default: false)
 * @param {number} options.timeoutMs - Custom timeout (default: 15s)
 * @returns {Promise<Object>} Summary with topics array
 */
export async function summarizeDocument(text, options = {}) {
  const {
    maxTopics = 5,
    // format reserved for future use (json/markdown)
    // eslint-disable-next-line no-unused-vars
    format = 'json',
    mock = false,
    timeoutMs = DEFAULT_TIMEOUT_MS
  } = options;

  // Force mock if requested or global mock mode enabled
  if (mock || isMockMode()) {
    console.log('Using mock summarization (mode: mock)');
    return await mockHelpers.mockSummarize(text, { maxTopics });
  }

  // Check API availability
  const availability = checkAIAvailability();
  if (!availability.available.summarizer && !availability.available.prompt) {
    // Fallback for development when APIs aren't available
    console.warn('Chrome Built-in AI not available. Using fallback mock.');
    return await mockHelpers.mockSummarize(text, { maxTopics });
  }

  // Use Prompt API for structured JSON output (more reliable than Summarizer for JSON)
  if (availability.available.prompt) {
    try {
      const sessionPromise = window.ai.languageModel.create({
        systemPrompt: `You are a concise document summarizer. Return ONLY valid JSON with no markdown, no explanations.`,
      });
      const session = await timeout(sessionPromise, timeoutMs, 'Summarization session creation timed out');

      const prompt = `Summarize the following document into ${maxTopics} distinct subtopics. For each subtopic return:
- title (max 6 words)
- summary (one short sentence, max 15 words)
- keyPoints (2 short bullet points, each max 12 words)

Return STRICTLY valid JSON array format:
[{"title":"...","summary":"...","keyPoints":["...","..."]}, ...]

Document:
${text.slice(0, 8000)}

JSON output:`;

      const responsePromise = session.prompt(prompt);
      const response = await timeout(responsePromise, timeoutMs, 'Summarization prompt timed out');

      const parsed = parseAIJSON(response);

      // Validate response structure
      if (!Array.isArray(parsed)) {
        throw new Error('AI response is not an array');
      }

      // Transform to match mockHelpers output format (summary + topics)
      const validated = parsed.map((item, idx) => ({
        id: `ai-topic-${idx}`,
        title: item.title || `Topic ${idx + 1}`,
        summary: item.summary || '',
        text: item.summary || '',
        keyPoints: Array.isArray(item.keyPoints) ? item.keyPoints : [],
      }));

      return {
        summary: validated[0]?.summary || 'Document summary',
        topics: validated.slice(0, maxTopics)
      };
    } catch (error) {
      console.error('Prompt API summarization failed:', error);
      // Fall back to mock on error
      return await mockHelpers.mockSummarize(text, { maxTopics });
    }
  }

  // Fallback: Use Summarizer API (less structured output)
  if (availability.available.summarizer) {
    try {
      const summarizer = await window.ai.summarizer.create({
        type: 'key-points',
        format: 'markdown',
        length: 'medium',
      });

      const summary = await summarizer.summarize(text);

      // Parse markdown bullet points into structured format
      const lines = summary.split('\n').filter(line => line.trim());
      const topics = [];

      let currentTopic = null;
      for (const line of lines) {
        // Header (## Title) or bold (**Title**)
        if (line.match(/^##\s+/) || line.match(/^\*\*.*\*\*/)) {
          if (currentTopic) topics.push(currentTopic);
          const title = line.replace(/^##\s+/, '').replace(/\*\*/g, '').trim();
          currentTopic = {
            title: title.slice(0, 50),
            summary: '',
            keyPoints: [],
          };
        }
        // Bullet point (- or *)
        else if (line.match(/^[-*]\s+/) && currentTopic) {
          const point = line.replace(/^[-*]\s+/, '').trim();
          if (!currentTopic.summary) {
            currentTopic.summary = point;
          } else {
            currentTopic.keyPoints.push(point);
          }
        }
      }

      if (currentTopic) topics.push(currentTopic);

      return topics.slice(0, maxTopics);
    } catch (error) {
      console.error('Summarizer API failed:', error);
      return createMockSummary(text, maxTopics);
    }
  }

  // Final fallback
  return createMockSummary(text, maxTopics);
}

/**
 * Create mock summary for development/testing
 */
function createMockSummary(text, maxTopics) {
  const paragraphs = text.split(/\n{2,}/).filter(p => p.trim().length > 20);
  const numTopics = Math.min(maxTopics, Math.max(3, paragraphs.length));

  return Array.from({ length: numTopics }, (_, i) => {
    const para = paragraphs[i] || `Section ${i + 1}`;
    const words = para.trim().split(/\s+/);
    return {
      title: words.slice(0, 5).join(' '),
      summary: words.slice(0, 15).join(' '),
      keyPoints: [
        words.slice(0, 10).join(' '),
        words.slice(10, 20).join(' ') || 'Additional details',
      ],
    };
  });
}

/**
 * Generate embedding vector for text
 * SAFE WRAPPER: Applies timeout and automatic fallback to mocks
 *
 * @param {string} text - Text to embed
 * @param {Object} options - Generation options
 * @param {boolean} options.mock - Force use of deterministic mock (for testing)
 * @param {number} options.dims - Embedding dimensions (default: 512)
 * @param {number} options.timeoutMs - Custom timeout (default: 15s)
 * @returns {Promise<Float32Array>} - Embedding vector (typically 512-1536 dims)
 */
export async function generateEmbedding(text, options = {}) {
  const {
    mock = false,
    dims = 512,
    timeoutMs = DEFAULT_TIMEOUT_MS
  } = options;

  // Force mock if requested or global mock mode enabled
  if (mock || isMockMode()) {
    console.log('Using mock embedding (mode: mock)');
    return mockHelpers.mockEmbeddingFromText(text, dims);
  }

  const availability = checkAIAvailability();

  if (!availability.available.embeddings) {
    // Fallback for development
    console.warn('Chrome Embeddings API not available. Using deterministic mock.');
    return mockHelpers.mockEmbeddingFromText(text, dims);
  }

  try {
    const embedderPromise = window.ai.embedding.create();
    const embedder = await timeout(embedderPromise, timeoutMs, 'Embedding creation timed out');

    const embedPromise = embedder.embed(text.slice(0, 2000)); // Limit to ~2000 chars
    const result = await timeout(embedPromise, timeoutMs, 'Embedding generation timed out');

    // Convert to Float32Array if not already
    if (result instanceof Float32Array) {
      return result;
    }

    if (Array.isArray(result)) {
      return new Float32Array(result);
    }

    throw new Error('Unexpected embedding result format');
  } catch (error) {
    console.error('Embedding generation failed:', error);
    return mockHelpers.mockEmbeddingFromText(text, dims);
  }
}

// Removed createMockEmbedding - use mockHelpers.mockEmbeddingFromText instead

/**
 * Expand a node into 2-4 child nodes
 * SAFE WRAPPER: Applies timeout and automatic fallback to mocks
 *
 * @param {string} nodeText - Parent node text
 * @param {Object} options - Expansion options
 * @param {string} options.title - Parent node title
 * @param {number} options.numChildren - Number of children (default: 3)
 * @param {boolean} options.mock - Force mock mode (default: false)
 * @param {number} options.timeoutMs - Custom timeout (default: 15s)
 * @returns {Promise<Array<{title: string, text: string}>>}
 */
export async function expandNode(nodeText, options = {}) {
  const {
    title = '',
    numChildren = 3,
    mock = false,
    timeoutMs = DEFAULT_TIMEOUT_MS
  } = options;

  // Force mock if requested or global mock mode enabled
  if (mock || isMockMode()) {
    console.log('Using mock node expansion (mode: mock)');
    return await mockHelpers.mockExpandNode(nodeText, { title, numChildren });
  }

  const availability = checkAIAvailability();

  if (!availability.available.prompt && !availability.available.writer) {
    console.warn('No AI API available for node expansion. Using mock.');
    return await mockHelpers.mockExpandNode(nodeText, { title, numChildren });
  }

  // Use Prompt API for structured output
  if (availability.available.prompt) {
    try {
      const sessionPromise = window.ai.languageModel.create({
        systemPrompt: 'You are an idea-expander. Output ONLY valid JSON with no markdown.',
      });
      const session = await timeout(sessionPromise, timeoutMs, 'Node expansion session creation timed out');

      const prompt = `Given this node, generate ${numChildren} child nodes that expand it. For each child return:
- title (5 words max)
- text (2-3 sentences, max 40 words)

Return STRICTLY valid JSON array:
[{"title":"...","text":"..."}, ...]

Node Title: ${title}
Node Text: ${nodeText.slice(0, 1000)}

JSON output:`;

      const responsePromise = session.prompt(prompt);
      const response = await timeout(responsePromise, timeoutMs, 'Node expansion prompt timed out');

      const parsed = parseAIJSON(response);

      if (!Array.isArray(parsed)) {
        throw new Error('AI response is not an array');
      }

      const validated = parsed.map((item, idx) => ({
        title: item.title || `Sub-idea ${idx + 1}`,
        text: item.text || '',
      }));

      return validated.slice(0, numChildren);
    } catch (error) {
      console.error('Node expansion failed:', error);
      return await mockHelpers.mockExpandNode(nodeText, { title, numChildren });
    }
  }

  // Fallback: Use Writer API
  if (availability.available.writer) {
    try {
      const writer = await window.ai.writer.create({
        tone: 'neutral',
        format: 'markdown',
        length: 'short',
      });

      const prompt = `Expand "${title}" into ${numChildren} sub-topics:\n${nodeText}`;
      const response = await writer.write(prompt);

      // Parse markdown into structured nodes
      const lines = response.split('\n').filter(line => line.trim());
      const children = [];

      for (const line of lines) {
        if (line.match(/^[-*]\s+/) || line.match(/^\d+\.\s+/)) {
          const text = line.replace(/^[-*\d.]\s+/, '').trim();
          const titleMatch = text.match(/^([^:.]+)[:.]?\s*(.*)/);

          if (titleMatch) {
            children.push({
              title: titleMatch[1].trim().slice(0, 50),
              text: titleMatch[2].trim() || titleMatch[1].trim(),
            });
          } else {
            children.push({
              title: text.slice(0, 50),
              text: text,
            });
          }
        }
      }

      return children.slice(0, numChildren);
    } catch (error) {
      console.error('Writer API failed:', error);
      return createMockExpansion(nodeText, title, numChildren);
    }
  }

  return createMockExpansion(nodeText, title, numChildren);
}

/**
 * Create mock node expansion for development
 */
function createMockExpansion(nodeText, title, numChildren) {
  const words = nodeText.split(/\s+/);
  const chunkSize = Math.ceil(words.length / numChildren);

  return Array.from({ length: numChildren }, (_, i) => ({
    title: `${title} - Part ${i + 1}`,
    text: words.slice(i * chunkSize, (i + 1) * chunkSize).join(' ').slice(0, 200),
  }));
}

/**
 * Batch generate embeddings for multiple texts
 *
 * @param {string[]} texts - Array of texts to embed
 * @param {Object} options - Generation options
 * @param {boolean} options.mock - Force use of deterministic mock (for testing)
 * @returns {Promise<Float32Array[]>} - Array of embedding vectors
 */
export async function batchGenerateEmbeddings(texts, options = {}) {
  const embeddings = [];

  for (const text of texts) {
    try {
      const embedding = await generateEmbedding(text, options);
      embeddings.push(embedding);
    } catch (error) {
      console.error(`Failed to embed text: ${text.slice(0, 50)}...`, error);
      // Use zero vector as fallback
      embeddings.push(new Float32Array(512).fill(0));
    }
  }

  return embeddings;
}

/**
 * Rewrite text with specified tone and length using Writer API
 * SAFE WRAPPER: Applies timeout and automatic fallback to mocks
 *
 * @param {string} text - Original text to rewrite
 * @param {Object} options - Rewrite options
 * @param {string} options.tone - Tone: 'concise' | 'technical' | 'creative' | 'formal' | 'casual' (default: 'concise')
 * @param {string} options.length - Length: 'short' | 'medium' | 'long' (default: 'medium')
 * @param {string} options.instruction - Optional custom instruction
 * @param {boolean} options.mock - Force mock mode for testing (default: false)
 * @param {number} options.timeoutMs - Custom timeout (default: 15s)
 * @returns {Promise<string>} - Rewritten text
 */
export async function rewriteText(text, options = {}) {
  const {
    tone = 'concise',
    length = 'medium',
    instruction = '',
    mock = false,
    timeoutMs = DEFAULT_TIMEOUT_MS
  } = options;

  // Force mock mode if requested or global mock mode enabled
  if (mock || isMockMode()) {
    console.log('Using mock rewrite (mode: mock)');
    return await mockHelpers.mockRewriteText(text, { tone, length });
  }

  const availability = checkAIAvailability();

  if (!availability.available.writer && !availability.available.prompt) {
    console.warn('No AI API available for rewriting. Using mock.');
    return await mockHelpers.mockRewriteText(text, { tone, length });
  }

  // Use Prompt API for more control over rewriting
  if (availability.available.prompt) {
    try {
      const sessionPromise = window.ai.languageModel.create({
        systemPrompt: `You are a professional text rewriter. Maintain the core meaning while adjusting ${tone} tone and ${length} length.`,
      });
      const session = await timeout(sessionPromise, timeoutMs, 'Rewrite session creation timed out');

      const prompt = instruction
        ? `${instruction}\n\nOriginal text:\n${text.slice(0, 2000)}\n\nRewritten text:`
        : `Rewrite the following text with a ${tone} tone and ${length} length. Keep the core meaning but adjust the style:\n\nOriginal:\n${text.slice(0, 2000)}\n\nRewritten:`;

      const responsePromise = session.prompt(prompt);
      const response = await timeout(responsePromise, timeoutMs, 'Rewrite prompt timed out');

      // Clean up response (remove any prefixes like "Rewritten:" or quotes)
      let cleaned = response.trim();
      cleaned = cleaned.replace(/^(Rewritten:|Rewritten text:|Result:)\s*/i, '');
      cleaned = cleaned.replace(/^["']|["']$/g, '');

      return cleaned;
    } catch (error) {
      console.error('Prompt API rewrite failed:', error);
      return await mockHelpers.mockRewriteText(text, { tone, length });
    }
  }

  // Fallback: Use Writer API
  if (availability.available.writer) {
    try {
      const toneMap = {
        concise: 'neutral',
        technical: 'formal',
        creative: 'casual',
        formal: 'formal',
        casual: 'casual',
      };

      const writerPromise = window.ai.writer.create({
        tone: toneMap[tone] || 'neutral',
        format: 'plain-text',
        length: length,
      });
      const writer = await timeout(writerPromise, timeoutMs, 'Writer creation timed out');

      const prompt = instruction
        ? `${instruction}: ${text.slice(0, 2000)}`
        : `Rewrite this text: ${text.slice(0, 2000)}`;

      const writePromise = writer.write(prompt);
      const response = await timeout(writePromise, timeoutMs, 'Writer rewrite timed out');

      return response.trim();
    } catch (error) {
      console.error('Writer API rewrite failed:', error);
      return await mockHelpers.mockRewriteText(text, { tone, length });
    }
  }

  // Final fallback
  return await mockHelpers.mockRewriteText(text, { tone, length });
}

// Removed createMockRewrite - use mockHelpers.mockRewriteText instead
