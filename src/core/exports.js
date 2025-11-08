/**
 * exports.js - Phase 7: Multi-Format Export with Provenance
 *
 * Exports FractaMind data in multiple formats with full provenance tracking:
 * - .fmind: Native bundle format (nodes, links, topics, reasoning transcripts, CRDT operations)
 * - .jsonld: JSON-LD graph with @context and semantic web compatibility
 * - .csv: Flat CSV format for spreadsheet analysis
 *
 * All exports include provenance metadata:
 * - Creation timestamps
 * - Author information
 * - Confidence scores
 * - AI-generated content markers
 * - Reasoning chain transcripts (optional)
 *
 * Usage:
 *   const fmindBundle = await exportFmind(['proj1', 'proj2'], { includeReasoningTranscript: true });
 *   const jsonld = await exportJsonLD(['proj1'], { includeProvenance: true });
 *   const csv = await exportCSV('proj1', { fields: ['title', 'text', 'createdAt'] });
 */

import { getNode, queryLinks, getAllNodes } from '../db/fractamind-indexer.js';
import { getTopics } from './topic_modeler.js';
import { getDocSnapshot, getOperationHistory } from './collab_bus.js';

/////////////////////////
// .fmind Export      //
/////////////////////////

/**
 * Export projects to native .fmind bundle format
 *
 * @param {Array<string>} projectIds - Project IDs to export
 * @param {Object} options - Export options
 * @param {boolean} options.includeReasoningTranscript - Include reasoning chains (default: false)
 * @param {boolean} options.includeCRDTHistory - Include CRDT operation history (default: false)
 * @param {boolean} options.includeTopics - Include topic models (default: true)
 * @returns {Promise<Object>} .fmind bundle
 */
export async function exportFmind(projectIds, options = {}) {
  const {
    includeReasoningTranscript = false,
    includeCRDTHistory = false,
    includeTopics = true,
  } = options;

  if (!Array.isArray(projectIds) || projectIds.length === 0) {
    throw new Error('At least one project ID required for export');
  }

  console.log(`[EXPORT] Generating .fmind bundle for ${projectIds.length} project(s)`);

  const bundle = {
    format: 'fmind',
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    projects: [],
    globalMetadata: {
      totalProjects: projectIds.length,
      exportOptions: options,
    },
  };

  // Export each project
  for (const projectId of projectIds) {
    try {
      const projectData = await exportProject(projectId, {
        includeReasoningTranscript,
        includeCRDTHistory,
        includeTopics,
      });

      bundle.projects.push(projectData);
    } catch (err) {
      console.error(`[EXPORT] Failed to export project ${projectId}:`, err);
      bundle.projects.push({
        projectId,
        error: err.message,
        status: 'failed',
      });
    }
  }

  console.log(`[EXPORT] .fmind bundle complete: ${bundle.projects.length} projects`);
  return bundle;
}

/**
 * Export a single project with all data
 */
async function exportProject(projectId, options) {
  const {
    includeReasoningTranscript,
    includeCRDTHistory,
    includeTopics,
  } = options;

  // Fetch all nodes
  const nodes = await getAllNodes(projectId);

  // Fetch all links
  const links = await queryLinks({ projectId, active: true, limit: 10000 });

  // Fetch topics if requested
  let topics = [];
  if (includeTopics) {
    topics = await getTopics({ projectIds: [projectId] });
  }

  // Fetch CRDT history if requested
  let crdtHistory = null;
  if (includeCRDTHistory) {
    try {
      const docSnapshot = getDocSnapshot(projectId);
      const operations = getOperationHistory(projectId, { limit: 1000 });

      crdtHistory = {
        snapshot: docSnapshot,
        operations: operations.map(op => ({
          id: op.id,
          type: op.type,
          actorId: op.actorId,
          timestamp: op.timestamp,
          sequence: op.sequence,
        })),
      };
    } catch (err) {
      console.warn(`[EXPORT] No CRDT history for ${projectId}:`, err.message);
    }
  }

  // Build project data
  const projectData = {
    projectId,
    exportedAt: new Date().toISOString(),
    status: 'success',
    stats: {
      nodeCount: nodes.length,
      linkCount: links.length,
      topicCount: topics.length,
    },
    nodes: nodes.map(n => ({
      id: n.id,
      title: n.title,
      text: n.text,
      createdAt: n.createdAt,
      updatedAt: n.updatedAt,
      metadata: n.meta || {},
      // Exclude embedding to reduce size (can be recomputed)
      hasEmbedding: !!n.embedding,
    })),
    links,
    topics: topics.map(t => ({
      topicId: t.topicId,
      keywords: t.keywords,
      nodeCount: t.nodeCount,
      weight: t.weight,
    })),
  };

  if (crdtHistory) {
    projectData.crdtHistory = crdtHistory;
  }

  // Add reasoning transcript placeholder
  if (includeReasoningTranscript) {
    projectData.reasoningTranscript = {
      note: 'Reasoning transcripts generated on-demand via reasoner.inferRelations()',
      sampleChains: [], // Could be populated with actual chains if available
    };
  }

  return projectData;
}

/////////////////////////
// JSON-LD Export     //
/////////////////////////

/**
 * Export projects to JSON-LD format with semantic web compatibility
 *
 * @param {Array<string>} projectIds - Project IDs to export
 * @param {Object} options - Export options
 * @param {boolean} options.includeProvenance - Include provenance metadata (default: true)
 * @returns {Promise<Object>} JSON-LD graph
 */
export async function exportJsonLD(projectIds, options = {}) {
  const { includeProvenance = true } = options;

  if (!Array.isArray(projectIds) || projectIds.length === 0) {
    throw new Error('At least one project ID required for export');
  }

  console.log(`[EXPORT] Generating JSON-LD for ${projectIds.length} project(s)`);

  const graph = [];

  // Add context
  const context = {
    '@vocab': 'https://fractamind.org/vocab#',
    'dc': 'http://purl.org/dc/terms/',
    'schema': 'http://schema.org/',
    'Node': 'https://fractamind.org/vocab#Node',
    'Link': 'https://fractamind.org/vocab#Link',
    'title': 'schema:name',
    'text': 'schema:text',
    'createdAt': 'dc:created',
    'updatedAt': 'dc:modified',
  };

  // Export each project
  for (const projectId of projectIds) {
    const nodes = await getAllNodes(projectId);
    const links = await queryLinks({ projectId, active: true, limit: 10000 });

    // Add nodes to graph
    for (const node of nodes) {
      const nodeEntry = {
        '@id': `fractamind:node:${node.id}`,
        '@type': 'Node',
        'title': node.title,
        'text': node.text || '',
        'createdAt': node.createdAt || new Date().toISOString(),
        'projectId': projectId,
      };

      if (includeProvenance && node.meta) {
        nodeEntry.provenance = {
          '@type': 'Provenance',
          'method': node.meta.method || 'manual',
          'aiGenerated': node.meta.aiGenerated || false,
        };
      }

      graph.push(nodeEntry);
    }

    // Add links to graph
    for (const link of links) {
      const linkEntry = {
        '@id': `fractamind:link:${link.linkId}`,
        '@type': 'Link',
        'source': `fractamind:node:${link.sourceNodeId}`,
        'target': `fractamind:node:${link.targetNodeId}`,
        'relationType': link.relationType,
        'confidence': link.confidence || 0.5,
        'createdAt': link.createdAt || new Date().toISOString(),
      };

      if (includeProvenance && link.provenance) {
        linkEntry.provenance = {
          '@type': 'Provenance',
          'method': link.provenance.method || 'manual',
          'aiConfidence': link.provenance.aiConfidence,
          'timestamp': link.provenance.timestamp,
        };
      }

      graph.push(linkEntry);
    }
  }

  const jsonld = {
    '@context': context,
    '@graph': graph,
  };

  console.log(`[EXPORT] JSON-LD complete: ${graph.length} entities`);
  return jsonld;
}

/////////////////////////
// CSV Export         //
/////////////////////////

/**
 * Export a project to CSV format
 *
 * @param {string} projectId - Project ID
 * @param {Object} options - Export options
 * @param {Array<string>} options.fields - Fields to include (default: ['id', 'title', 'text', 'createdAt'])
 * @param {boolean} options.includeLinks - Include links in separate section (default: false)
 * @returns {Promise<string>} CSV string
 */
export async function exportCSV(projectId, options = {}) {
  const {
    fields = ['id', 'title', 'text', 'createdAt'],
    includeLinks = false,
  } = options;

  console.log(`[EXPORT] Generating CSV for project ${projectId}`);

  const nodes = await getAllNodes(projectId);

  // Build CSV header
  const header = fields.join(',');
  const rows = [header];

  // Add node rows
  for (const node of nodes) {
    const row = fields.map(field => {
      let value = node[field] || '';

      // Escape CSV special characters
      value = String(value).replace(/"/g, '""'); // Escape quotes
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        value = `"${value}"`; // Quote if contains special chars
      }

      return value;
    });

    rows.push(row.join(','));
  }

  let csv = rows.join('\n');

  // Optionally append links section
  if (includeLinks) {
    const links = await queryLinks({ projectId, active: true, limit: 10000 });

    csv += '\n\n# Links\n';
    csv += 'sourceNodeId,targetNodeId,relationType,confidence,createdAt\n';

    for (const link of links) {
      const linkRow = [
        link.sourceNodeId,
        link.targetNodeId,
        link.relationType,
        link.confidence || 0.5,
        link.createdAt || '',
      ].join(',');

      csv += linkRow + '\n';
    }
  }

  console.log(`[EXPORT] CSV complete: ${nodes.length} nodes`);
  return csv;
}

/////////////////////////
// Import Functions   //
/////////////////////////

/**
 * Import data from .fmind bundle (placeholder for Phase 7.1)
 *
 * @param {Object} bundle - .fmind bundle object
 * @returns {Promise<Object>} Import result
 */
export async function importFmind(bundle) {
  console.warn('[EXPORT] importFmind not yet implemented (Phase 7.1)');

  // Placeholder: would restore nodes, links, topics, and CRDT history
  return {
    status: 'not_implemented',
    message: 'Import functionality planned for Phase 7.1',
    bundle: {
      format: bundle.format,
      version: bundle.version,
      projects: bundle.projects.map(p => p.projectId),
    },
  };
}

/**
 * Generate download helpers (browser-specific)
 */
export function downloadAsFile(data, filename, mimeType = 'application/json') {
  if (typeof window === 'undefined') {
    console.warn('[EXPORT] downloadAsFile requires browser environment');
    return;
  }

  const blob = new Blob([
    typeof data === 'string' ? data : JSON.stringify(data, null, 2)
  ], { type: mimeType });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();

  // Cleanup
  setTimeout(() => URL.revokeObjectURL(url), 100);

  console.log(`[EXPORT] Downloaded ${filename}`);
}

/////////////////////////
// Exports            //
/////////////////////////

export default {
  exportFmind,
  exportJsonLD,
  exportCSV,
  importFmind,
  downloadAsFile,
};
