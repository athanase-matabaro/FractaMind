import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import ChoreComponent from './components/chore-component/ChoreComponent';
import FractalCanvas from './viz/FractalCanvas';
import TimelineView from './viz/TimelineView';
import { handleSeedSubmit } from './core/importer';
import { initMemoryDB, recordInteraction } from './core/memory';
import { getNode } from './db/fractamind-indexer';
import './index.css';

function App() {
  const [currentView, setCurrentView] = useState('import'); // 'import' | 'fractal' | 'timeline'
  const [importedProject, setImportedProject] = useState(null);

  // Initialize memory database on app load
  useEffect(() => {
    initMemoryDB().catch(err => {
      console.error('Failed to initialize memory database:', err);
    });
  }, []);

  const onSeedSubmit = async (seedText, onProgress) => {
    console.log('Seed text submitted:', seedText.slice(0, 100) + '...');

    // Call the import pipeline with progress callback
    const result = await handleSeedSubmit(
      seedText,
      {
        name: 'Imported Document',
        sourceUrl: null,
      },
      onProgress
    );

    console.log('Import complete:', {
      projectId: result.project.id,
      nodeCount: result.nodes.length,
      rootNode: result.rootNode.title,
    });

    // Record import interaction
    await recordInteraction({
      nodeId: result.rootNode.id,
      actionType: 'import',
      meta: {
        source: 'text-paste',
        nodeCount: result.nodes.length,
        projectName: result.project.name,
      },
    }).catch(err => console.error('Failed to record import interaction:', err));

    setImportedProject(result);
    return result;
  };

  const handleSuccess = (result) => {
    console.log('Import succeeded! Project ready to visualize.');
    // Store project data for fractal view
    setImportedProject(result);
  };

  const handleOpenFractalView = () => {
    if (importedProject) {
      setCurrentView('fractal');
    }
  };

  const handleBackToImport = () => {
    setCurrentView('import');
  };

  const handleNodeSelect = (node) => {
    console.log('Node selected:', node.id, node.title);

    // Record view interaction
    recordInteraction({
      nodeId: node.id,
      actionType: 'view',
      embedding: node.embedding || null,
      meta: {
        title: node.title,
      },
    }).catch(err => console.error('Failed to record view interaction:', err));
  };

  const handleOpenTimeline = () => {
    setCurrentView('timeline');
  };

  const handleTimelineItemClick = async (interaction) => {
    if (interaction.nodeId && importedProject) {
      // Switch to fractal view
      setCurrentView('fractal');

      // The FractalCanvas will handle centering the node
      // We'll pass the nodeId as a prop
    }
  };

  return (
    <div className="app">
      {currentView === 'import' && (
        <>
          <ChoreComponent
            onSeedSubmit={onSeedSubmit}
            onSuccess={handleSuccess}
            onOpenFractalView={handleOpenFractalView}
            hasImportedProject={!!importedProject}
          />

          {/* Success summary (shown after import, before switching to fractal view) */}
          {importedProject && (
            <div
              style={{
                padding: '2rem',
                maxWidth: '800px',
                margin: '2rem auto',
                background: '#f9fafb',
                borderRadius: '8px',
              }}
            >
              <h2>Import Successful!</h2>
              <p>
                <strong>Project:</strong> {importedProject.project.name}
              </p>
              <p>
                <strong>Root Node:</strong> {importedProject.rootNode.title}
              </p>
              <p>
                <strong>Nodes Created:</strong> {importedProject.nodes.length}
              </p>
              <button
                onClick={handleOpenFractalView}
                style={{
                  padding: '0.75rem 1.5rem',
                  fontSize: '1rem',
                  fontWeight: 600,
                  background: '#667eea',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  marginTop: '1rem',
                }}
              >
                Open Fractal View
              </button>
              <details style={{ marginTop: '1rem' }}>
                <summary>View Nodes</summary>
                <ul>
                  {importedProject.nodes.map((node) => (
                    <li key={node.id}>
                      <strong>{node.title}</strong>
                      <br />
                      {node.text.slice(0, 100)}...
                    </li>
                  ))}
                </ul>
              </details>
            </div>
          )}
        </>
      )}

      {currentView === 'fractal' && importedProject && (
        <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
          <div style={{ position: 'absolute', top: '1rem', left: '1rem', zIndex: 100, display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={handleBackToImport}
              style={{
                padding: '0.5rem 1rem',
                background: 'white',
                border: '2px solid #667eea',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 600,
                color: '#667eea',
              }}
            >
              ← Back to Import
            </button>
            <button
              onClick={handleOpenTimeline}
              style={{
                padding: '0.5rem 1rem',
                background: 'white',
                border: '2px solid #667eea',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 600,
                color: '#667eea',
              }}
            >
              📅 Timeline
            </button>
          </div>
          <FractalCanvas
            projectId={importedProject.project.id}
            rootNodeId={importedProject.rootNode.id}
            quantParams={importedProject.project.meta?.quantParams || null}
            onNodeSelect={handleNodeSelect}
          />
        </div>
      )}

      {currentView === 'timeline' && (
        <TimelineView
          onItemClick={handleTimelineItemClick}
          onClose={() => setCurrentView(importedProject ? 'fractal' : 'import')}
        />
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
