import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import Hero from './components/Hero/Hero';
import FractalCanvas from './viz/FractalCanvas';
import TimelineView from './viz/TimelineView';
import WorkspaceView from './viz/WorkspaceView';
import { initMemoryDB, recordInteraction } from './core/memory';
import { initRegistry } from './core/projectRegistry';
import { initFederation } from './core/federation';
import { getNode } from './db/fractamind-indexer';
import './index.css';

function App() {
  const [currentView, setCurrentView] = useState('import');
  const [importedProject, setImportedProject] = useState(null);

  useEffect(() => {
    Promise.all([
      initMemoryDB(),
      initRegistry(),
      initFederation()
    ]).catch(err => {
      console.error('Failed to initialize databases:', err);
    });
  }, []);

  // Track view changes
  useEffect(() => {
    console.log(`%c🔄 VIEW CHANGED: ${currentView}`, 'background: teal; color: white; padding: 4px; font-weight: bold', {
      hasImportedProject: !!importedProject,
      projectId: importedProject?.project?.id,
    });
  }, [currentView, importedProject]);

  const handleStartImport = (result) => {
    console.log('%c📊 IMPORT COMPLETE - Switching to Fractal View', 'background: purple; color: white; padding: 4px; font-weight: bold', {
      projectId: result?.project?.id,
      rootNodeId: result?.rootNode?.id,
      nodeCount: result?.nodes?.length,
      hasQuantParams: !!result?.project?.meta?.quantParams,
    });
    setImportedProject(result);
    setCurrentView('fractal');
  };

  const handleDemoStart = () => {
    console.log('Demo mode requested');
  };

  const handleBackToImport = () => {
    setCurrentView('import');
  };

  const handleNodeSelect = (node) => {
    console.log('Node selected:', node.id, node.title);
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
      setCurrentView('fractal');
    }
  };

  const handleOpenWorkspace = () => {
    setCurrentView('workspace');
  };

  const handleWorkspaceNodeClick = async ({ nodeId, projectId }) => {
    if (!importedProject || importedProject.project.id !== projectId) {
      try {
        const node = await getNode(nodeId);
        if (node) {
          console.log('Workspace node clicked:', { nodeId, projectId });
          setCurrentView('fractal');
        }
      } catch (error) {
        console.error('Failed to load node:', error);
      }
    } else {
      setCurrentView('fractal');
    }
  };

  return (
    <div className="app">
      {currentView === 'import' && (
        <Hero
          onStartImport={handleStartImport}
          onDemoStart={handleDemoStart}
          demoMode={false}
        />
      )}

      {currentView === 'fractal' && importedProject && (
        <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
          <div style={{ position: 'absolute', top: '5rem', right: '1rem', zIndex: 200, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <button
              onClick={handleBackToImport}
              style={{
                padding: '0.625rem 1.25rem',
                background: 'rgba(255, 255, 255, 0.05)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 500,
                color: 'rgba(255, 255, 255, 0.8)',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.target.style.background = 'rgba(255, 255, 255, 0.1)';
                e.target.style.borderColor = '#667eea';
                e.target.style.color = 'white';
                e.target.style.boxShadow = '0 4px 16px rgba(102, 126, 234, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'rgba(255, 255, 255, 0.05)';
                e.target.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                e.target.style.color = 'rgba(255, 255, 255, 0.8)';
                e.target.style.boxShadow = 'none';
              }}
            >
              ← Back to Import
            </button>
            <button
              onClick={handleOpenTimeline}
              style={{
                padding: '0.625rem 1.25rem',
                background: 'rgba(255, 255, 255, 0.05)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 500,
                color: 'rgba(255, 255, 255, 0.8)',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.target.style.background = 'rgba(255, 255, 255, 0.1)';
                e.target.style.borderColor = '#667eea';
                e.target.style.color = 'white';
                e.target.style.boxShadow = '0 4px 16px rgba(102, 126, 234, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'rgba(255, 255, 255, 0.05)';
                e.target.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                e.target.style.color = 'rgba(255, 255, 255, 0.8)';
                e.target.style.boxShadow = 'none';
              }}
            >
              📅 Timeline
            </button>
            <button
              onClick={handleOpenWorkspace}
              style={{
                padding: '0.625rem 1.25rem',
                background: 'rgba(255, 255, 255, 0.05)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 500,
                color: 'rgba(255, 255, 255, 0.8)',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.target.style.background = 'rgba(255, 255, 255, 0.1)';
                e.target.style.borderColor = '#667eea';
                e.target.style.color = 'white';
                e.target.style.boxShadow = '0 4px 16px rgba(102, 126, 234, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'rgba(255, 255, 255, 0.05)';
                e.target.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                e.target.style.color = 'rgba(255, 255, 255, 0.8)';
                e.target.style.boxShadow = 'none';
              }}
            >
              🏢 Workspace
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

      {currentView === 'workspace' && (
        <WorkspaceView
          onNodeClick={handleWorkspaceNodeClick}
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
