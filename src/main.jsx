import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import ChoreComponent from './components/chore-component/ChoreComponent';
import FractalCanvas from './viz/FractalCanvas';
import { handleSeedSubmit } from './core/importer';
import './index.css';

function App() {
  const [currentView, setCurrentView] = useState('import'); // 'import' | 'fractal'
  const [importedProject, setImportedProject] = useState(null);

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
    // Could add node details panel here if needed
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
          <button
            onClick={handleBackToImport}
            style={{
              position: 'absolute',
              top: '1rem',
              left: '1rem',
              padding: '0.5rem 1rem',
              background: 'white',
              border: '2px solid #667eea',
              borderRadius: '8px',
              cursor: 'pointer',
              zIndex: 100,
              fontWeight: 600,
              color: '#667eea',
            }}
          >
            ← Back to Import
          </button>
          <FractalCanvas
            projectId={importedProject.project.id}
            rootNodeId={importedProject.rootNode.id}
            quantParams={importedProject.project.meta?.quantParams || null}
            onNodeSelect={handleNodeSelect}
          />
        </div>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
