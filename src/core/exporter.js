/**
 * exporter.js - Project export and import functionality
 *
 * Supports:
 * - JSON export/import (full project with all nodes)
 * - Markdown summary export
 * - SVG canvas snapshot export
 * - Schema validation on import
 */

import { getNode, saveNode, initDB } from '../db/fractamind-indexer.js';
import { generateUUID } from '../utils/uuid.js';

const EXPORT_VERSION = '1.0.0';

/**
 * Get all nodes for a project by traversing from root
 * @param {string} projectId - Project ID
 * @returns {Promise<Array>} - Array of all nodes
 */
async function getAllProjectNodes(projectId) {
  const nodes = [];
  const visited = new Set();

  // Get project node
  const projectNode = await getNode(`project:${projectId}`);
  if (!projectNode) {
    throw new Error(`Project ${projectId} not found`);
  }

  // Parse project metadata
  const projectData = JSON.parse(projectNode.text);
  const rootNodeId = projectData.rootNodeId;

  // BFS traversal from root
  const queue = [rootNodeId];

  while (queue.length > 0) {
    const nodeId = queue.shift();

    if (visited.has(nodeId)) continue;
    visited.add(nodeId);

    try {
      const node = await getNode(nodeId);
      if (node) {
        nodes.push(node);

        // Add children to queue
        if (node.children && Array.isArray(node.children)) {
          queue.push(...node.children);
        }
      }
    } catch (error) {
      console.error(`Failed to load node ${nodeId}:`, error);
    }
  }

  return nodes;
}

/**
 * Export project as JSON file
 *
 * @param {string} projectId - Project ID to export
 * @param {Object} options - Export options
 * @param {boolean} options.includeEmbeddings - Include embeddings (default: true)
 * @param {boolean} options.prettify - Pretty-print JSON (default: true)
 * @returns {Promise<void>} - Triggers browser download
 */
export async function exportProjectJSON(projectId, options = {}) {
  const { includeEmbeddings = true, prettify = true } = options;

  try {
    // Get project metadata
    const projectNode = await getNode(`project:${projectId}`);
    if (!projectNode) {
      throw new Error(`Project ${projectId} not found`);
    }

    const projectData = JSON.parse(projectNode.text);

    // Get all nodes
    const nodes = await getAllProjectNodes(projectId);

    // Optionally strip embeddings to reduce file size
    const exportNodes = includeEmbeddings
      ? nodes
      // eslint-disable-next-line no-unused-vars
      : nodes.map(({ embedding: _embedding, ...node }) => node);

    // Create export object
    const exportData = {
      version: EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      project: {
        ...projectData,
        meta: {
          ...projectData.meta,
          quantParams: projectNode.meta?.quantParams || null,
        },
      },
      nodes: exportNodes,
      stats: {
        nodeCount: nodes.length,
        totalWords: nodes.reduce(
          (sum, n) => sum + (n.text?.split(/\s+/).length || 0),
          0
        ),
      },
    };

    // Convert to JSON
    const jsonString = prettify
      ? JSON.stringify(exportData, null, 2)
      : JSON.stringify(exportData);

    // Trigger download
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `fractamind-${projectData.name.replace(/[^a-z0-9]/gi, '-')}-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    console.log(`Exported project ${projectId}: ${nodes.length} nodes`);
  } catch (error) {
    console.error('Export failed:', error);
    throw new Error(`Export failed: ${error.message}`);
  }
}

/**
 * Validate import JSON schema
 * @param {Object} data - Parsed JSON data
 * @returns {{valid: boolean, errors: Array<string>}}
 */
function validateImportSchema(data) {
  const errors = [];

  if (!data.version) {
    errors.push('Missing version field');
  }

  if (!data.project || typeof data.project !== 'object') {
    errors.push('Missing or invalid project object');
  } else {
    if (!data.project.id) errors.push('Project missing id');
    if (!data.project.name) errors.push('Project missing name');
    if (!data.project.rootNodeId) errors.push('Project missing rootNodeId');
  }

  if (!Array.isArray(data.nodes)) {
    errors.push('Missing or invalid nodes array');
  } else {
    // Check first few nodes for structure
    const sampleSize = Math.min(5, data.nodes.length);
    for (let i = 0; i < sampleSize; i++) {
      const node = data.nodes[i];
      if (!node.id) errors.push(`Node ${i} missing id`);
      if (!node.title) errors.push(`Node ${i} missing title`);
      if (node.text === undefined) errors.push(`Node ${i} missing text`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Import project from JSON file
 *
 * @param {File} file - JSON file object
 * @param {Object} options - Import options
 * @param {boolean} options.regenerateIds - Generate new UUIDs (default: false)
 * @param {Function} options.onProgress - Progress callback
 * @returns {Promise<string>} - New project ID
 */
export async function importProjectJSON(file, options = {}) {
  const { regenerateIds = false, onProgress = null } = options;

  try {
    onProgress?.({ step: 'reading', progress: 0.1, message: 'Reading file...' });

    // Read file
    const text = await file.text();
    const data = JSON.parse(text);

    onProgress?.({ step: 'validating', progress: 0.2, message: 'Validating schema...' });

    // Validate schema
    const validation = validateImportSchema(data);
    if (!validation.valid) {
      throw new Error(`Invalid import file: ${validation.errors.join(', ')}`);
    }

    // Check version compatibility
    if (data.version !== EXPORT_VERSION) {
      console.warn(`Import version mismatch: ${data.version} vs ${EXPORT_VERSION}`);
    }

    onProgress?.({ step: 'preparing', progress: 0.3, message: 'Preparing import...' });

    // Initialize DB
    await initDB();

    // Generate new IDs if requested
    const idMap = new Map();
    let projectId = data.project.id;
    let rootNodeId = data.project.rootNodeId;

    if (regenerateIds) {
      projectId = generateUUID();
      rootNodeId = generateUUID();
      idMap.set(data.project.id, projectId);
      idMap.set(data.project.rootNodeId, rootNodeId);

      data.nodes.forEach((node) => {
        idMap.set(node.id, generateUUID());
      });
    }

    onProgress?.({ step: 'importing', progress: 0.4, message: 'Importing nodes...' });

    // Import nodes
    const totalNodes = data.nodes.length;
    for (let i = 0; i < totalNodes; i++) {
      const node = data.nodes[i];

      // Remap IDs if regenerating
      const newNode = regenerateIds
        ? {
            ...node,
            id: idMap.get(node.id),
            parent: node.parent ? idMap.get(node.parent) : null,
            children: node.children.map((childId) => idMap.get(childId) || childId),
            meta: {
              ...node.meta,
              projectId: idMap.get(node.meta?.projectId) || projectId,
            },
          }
        : node;

      await saveNode(newNode);

      // Update progress
      if (i % 10 === 0 || i === totalNodes - 1) {
        const progress = 0.4 + (i / totalNodes) * 0.5;
        onProgress?.({
          step: 'importing',
          progress,
          message: `Importing nodes (${i + 1}/${totalNodes})...`,
        });
      }
    }

    onProgress?.({ step: 'finalizing', progress: 0.95, message: 'Saving project metadata...' });

    // Save project node
    const projectNode = {
      id: `project:${projectId}`,
      title: `[PROJECT] ${data.project.name}`,
      text: JSON.stringify({
        ...data.project,
        id: projectId,
        rootNodeId: rootNodeId,
        importedAt: new Date().toISOString(),
      }),
      summary: `Project: ${data.project.name}`,
      children: [rootNodeId],
      parent: null,
      embedding: null,
      hilbertKeyHex: null,
      meta: {
        type: 'project',
        ...data.project.meta,
        quantParams: data.project.meta?.quantParams || null,
      },
    };

    await saveNode(projectNode);

    onProgress?.({ step: 'complete', progress: 1.0, message: 'Import complete!' });

    console.log(`Imported project ${projectId}: ${totalNodes} nodes`);

    return projectId;
  } catch (error) {
    console.error('Import failed:', error);
    throw new Error(`Import failed: ${error.message}`);
  }
}

/**
 * Export project as Markdown summary
 *
 * @param {string} projectId - Project ID
 * @param {Object} options - Export options
 * @param {number} options.depth - Maximum depth to export (default: 2)
 * @param {boolean} options.includeSnippets - Include text snippets (default: true)
 * @returns {Promise<void>} - Triggers browser download
 */
export async function exportMarkdownSummary(projectId, options = {}) {
  const { depth = 2, includeSnippets = true } = options;

  try {
    // Get project metadata
    const projectNode = await getNode(`project:${projectId}`);
    if (!projectNode) {
      throw new Error(`Project ${projectId} not found`);
    }

    const projectData = JSON.parse(projectNode.text);
    const rootNodeId = projectData.rootNodeId;

    // Build markdown
    let markdown = `# ${projectData.name}\n\n`;
    markdown += `**Created:** ${new Date(projectData.createdAt).toLocaleDateString()}\n`;
    markdown += `**Exported:** ${new Date().toLocaleDateString()}\n\n`;

    if (projectData.meta?.sourceUrl) {
      markdown += `**Source:** ${projectData.meta.sourceUrl}\n\n`;
    }

    markdown += `---\n\n`;

    // Recursive function to build tree
    const buildTree = async (nodeId, currentDepth, prefix = '') => {
      if (currentDepth > depth) return;

      const node = await getNode(nodeId);
      if (!node) return;

      // Add node title
      const indent = '#'.repeat(currentDepth + 1);
      markdown += `${indent} ${node.title}\n\n`;

      // Add snippet if enabled
      if (includeSnippets && node.text) {
        const snippet = node.text.slice(0, 200);
        markdown += `${snippet}${node.text.length > 200 ? '...' : ''}\n\n`;
      }

      // Add children
      if (node.children && node.children.length > 0 && currentDepth < depth) {
        for (const childId of node.children) {
          await buildTree(childId, currentDepth + 1, prefix + '  ');
        }
      }
    }

    // Build tree from root
    await buildTree(rootNodeId, 0);

    markdown += `\n---\n\n`;
    markdown += `*Generated by FractaMind - Privacy-First Fractal Knowledge Explorer*\n`;

    // Trigger download
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `fractamind-${projectData.name.replace(/[^a-z0-9]/gi, '-')}-summary.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    console.log(`Exported Markdown summary for project ${projectId}`);
  } catch (error) {
    console.error('Markdown export failed:', error);
    throw new Error(`Markdown export failed: ${error.message}`);
  }
}

/**
 * Export canvas as SVG snapshot
 *
 * @param {HTMLCanvasElement|string} canvasElementOrSelector - Canvas element or selector
 * @param {Object} options - Export options
 * @param {string} options.filename - Custom filename (optional)
 * @returns {Promise<void>} - Triggers browser download
 */
export async function exportCanvasSVG(canvasElementOrSelector, options = {}) {
  const { filename = `fractamind-canvas-${Date.now()}.svg` } = options;

  try {
    // Get canvas element
    const canvas =
      typeof canvasElementOrSelector === 'string'
        ? document.querySelector(canvasElementOrSelector)
        : canvasElementOrSelector;

    if (!canvas || canvas.tagName !== 'CANVAS') {
      throw new Error('Invalid canvas element');
    }

    // Convert canvas to data URL
    const dataUrl = canvas.toDataURL('image/png');

    // Create SVG with embedded image
    const width = canvas.width;
    const height = canvas.height;

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <title>FractaMind Canvas Snapshot</title>
  <desc>Exported on ${new Date().toISOString()}</desc>
  <image x="0" y="0" width="${width}" height="${height}" xlink:href="${dataUrl}" />
</svg>`;

    // Trigger download
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    console.log('Exported canvas as SVG');
  } catch (error) {
    console.error('SVG export failed:', error);
    throw new Error(`SVG export failed: ${error.message}`);
  }
}

/**
 * Get export stats for a project
 *
 * @param {string} projectId - Project ID
 * @returns {Promise<Object>} - Export statistics
 */
export async function getExportStats(projectId) {
  try {
    const nodes = await getAllProjectNodes(projectId);
    const projectNode = await getNode(`project:${projectId}`);
    const projectData = JSON.parse(projectNode.text);

    const totalWords = nodes.reduce(
      (sum, n) => sum + (n.text?.split(/\s+/).length || 0),
      0
    );

    const totalChars = nodes.reduce((sum, n) => sum + (n.text?.length || 0), 0);

    const depths = nodes.map((n) => n.meta?.depth || 0);
    const maxDepth = Math.max(...depths, 0);

    return {
      projectName: projectData.name,
      nodeCount: nodes.length,
      totalWords,
      totalChars,
      maxDepth,
      createdAt: projectData.createdAt,
      estimatedJSONSize: Math.ceil((JSON.stringify({ nodes }).length / 1024 / 1024) * 100) / 100, // MB
    };
  } catch (error) {
    console.error('Failed to get export stats:', error);
    return null;
  }
}
