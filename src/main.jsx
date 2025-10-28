import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import ChoreComponent from './components/chore-component/ChoreComponent';
import { handleSeedSubmit } from './core/importer';
import './index.css';

function App() {
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
    // TODO: Navigate to fractal visualization
  };

  return (
    <div className="app">
      <ChoreComponent onSeedSubmit={onSeedSubmit} onSuccess={handleSuccess} />

      {/* Placeholder UI for imported project */}
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
          <details>
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
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
