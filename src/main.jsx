import React from 'react';
import ReactDOM from 'react-dom/client';
import ChoreComponent from './components/chore-component/ChoreComponent';
import './index.css';

function App() {
  const handleSeedSubmit = async (seedText) => {
    console.log('Seed text submitted:', seedText);

    // TODO: Connect to AI pipeline
    // 1. Call Chrome Summarizer API to generate top-level nodes
    // 2. Create FractalNode objects with UUIDs
    // 3. Generate embeddings for each node
    // 4. Compute Morton keys using fractamind-indexer
    // 5. Save nodes to IndexedDB
    // 6. Render fractal visualization

    // For now, just log the input
    alert(`Received ${seedText.length} characters. AI integration coming soon!`);
  };

  return (
    <div className="app">
      <ChoreComponent onSeedSubmit={handleSeedSubmit} />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
