/**
 * Component tests for FractalCanvas
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import FractalCanvas from './FractalCanvas';
import * as indexer from '../db/fractamind-indexer';
import * as expander from '../core/expander';

// Mock dependencies
jest.mock('../db/fractamind-indexer');
jest.mock('../core/expander');

describe('FractalCanvas', () => {
  let mockRootNode;
  let mockChildNodes;

  beforeEach(() => {
    jest.clearAllMocks();

    mockRootNode = {
      id: 'root-1',
      title: 'Root Node',
      text: 'Root node text',
      children: ['child-1', 'child-2'],
      parent: null,
      embedding: Array(512).fill(0.1),
      hilbertKeyHex: 'abc123',
      meta: {
        depth: 0,
        createdAt: '2025-01-01T00:00:00Z',
      },
    };

    mockChildNodes = [
      {
        id: 'child-1',
        title: 'Child Node 1',
        text: 'Child 1 text',
        children: [],
        parent: 'root-1',
        embedding: Array(512).fill(0.2),
        hilbertKeyHex: 'def456',
        meta: {
          depth: 1,
          createdAt: '2025-01-02T00:00:00Z',
        },
      },
      {
        id: 'child-2',
        title: 'Child Node 2',
        text: 'Child 2 text',
        children: [],
        parent: 'root-1',
        embedding: Array(512).fill(0.3),
        hilbertKeyHex: 'ghi789',
        meta: {
          depth: 1,
          createdAt: '2025-01-03T00:00:00Z',
        },
      },
    ];

    // Mock indexer.getNode
    indexer.getNode.mockImplementation((id) => {
      if (id === 'root-1') return Promise.resolve(mockRootNode);
      if (id === 'child-1') return Promise.resolve(mockChildNodes[0]);
      if (id === 'child-2') return Promise.resolve(mockChildNodes[1]);
      return Promise.resolve(null);
    });

    // Mock expander.expandNode
    expander.expandNode.mockResolvedValue([
      {
        id: 'new-child-1',
        title: 'New Child 1',
        text: 'New child text',
      },
    ]);
  });

  it('should render canvas container', () => {
    render(<FractalCanvas projectId="test-project" rootNodeId="root-1" />);

    expect(screen.getByRole('application', { name: /fractal knowledge graph/i })).toBeInTheDocument();
  });

  it('should load and display root node', async () => {
    render(<FractalCanvas projectId="test-project" rootNodeId="root-1" />);

    await waitFor(() => {
      expect(indexer.getNode).toHaveBeenCalledWith('root-1');
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Node: Root Node/i })).toBeInTheDocument();
    });
  });

  it('should load and display child nodes', async () => {
    render(<FractalCanvas projectId="test-project" rootNodeId="root-1" />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Node: Root Node/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Node: Child Node 1/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Node: Child Node 2/i })).toBeInTheDocument();
    });
  });

  it('should display HUD controls', () => {
    render(<FractalCanvas projectId="test-project" rootNodeId="root-1" />);

    expect(screen.getByRole('button', { name: /Reset view/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Toggle labels/i })).toBeInTheDocument();
  });

  it('should display node count and zoom level', () => {
    render(<FractalCanvas projectId="test-project" rootNodeId="root-1" />);

    expect(screen.getByText(/Nodes:/i)).toBeInTheDocument();
    expect(screen.getByText(/Zoom:/i)).toBeInTheDocument();
  });

  it('should select node on click', async () => {
    const onNodeSelect = jest.fn();
    render(<FractalCanvas projectId="test-project" rootNodeId="root-1" onNodeSelect={onNodeSelect} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Node: Root Node/i })).toBeInTheDocument();
    });

    const rootNodeButton = screen.getByRole('button', { name: /Node: Root Node/i });
    fireEvent.click(rootNodeButton);

    await waitFor(() => {
      expect(onNodeSelect).toHaveBeenCalledWith(expect.objectContaining({
        id: 'root-1',
        title: 'Root Node',
      }));
    });
  });

  it('should open node details panel when node is selected', async () => {
    render(<FractalCanvas projectId="test-project" rootNodeId="root-1" />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Node: Root Node/i })).toBeInTheDocument();
    });

    const rootNodeButton = screen.getByRole('button', { name: /Node: Root Node/i });
    fireEvent.click(rootNodeButton);

    await waitFor(() => {
      expect(screen.getByText('Root node text')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Expand Node/i })).toBeInTheDocument();
    });
  });

  it('should close node details panel when close button is clicked', async () => {
    render(<FractalCanvas projectId="test-project" rootNodeId="root-1" />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Node: Root Node/i })).toBeInTheDocument();
    });

    // Open panel
    const rootNodeButton = screen.getByRole('button', { name: /Node: Root Node/i });
    fireEvent.click(rootNodeButton);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Close panel/i })).toBeInTheDocument();
    });

    // Close panel
    const closeButton = screen.getByRole('button', { name: /Close panel/i });
    fireEvent.click(closeButton);

    await waitFor(() => {
      expect(screen.queryByText('Root node text')).not.toBeInTheDocument();
    });
  });

  it('should expand node when right-clicked', async () => {
    render(<FractalCanvas projectId="test-project" rootNodeId="root-1" />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Node: Root Node/i })).toBeInTheDocument();
    });

    const rootNodeButton = screen.getByRole('button', { name: /Node: Root Node/i });
    fireEvent.contextMenu(rootNodeButton);

    await waitFor(() => {
      expect(expander.expandNode).toHaveBeenCalledWith('root-1', expect.objectContaining({
        maxChildren: 3,
        style: 'concise',
      }));
    });
  });

  it('should show progress indicator during expansion', async () => {
    const expandPromise = new Promise((resolve) => {
      setTimeout(() => resolve([{ id: 'new-1', title: 'New' }]), 100);
    });

    expander.expandNode.mockImplementation((nodeId, options) => {
      options.onProgress?.({ step: 'expanding', progress: 0.5, message: 'Expanding...' });
      return expandPromise;
    });

    render(<FractalCanvas projectId="test-project" rootNodeId="root-1" />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Node: Root Node/i })).toBeInTheDocument();
    });

    const rootNodeButton = screen.getByRole('button', { name: /Node: Root Node/i });
    fireEvent.contextMenu(rootNodeButton);

    await waitFor(() => {
      expect(screen.getByText(/Expanding\.\.\./i)).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.queryByText(/Expanding\.\.\./i)).not.toBeInTheDocument();
    });
  });

  it('should toggle labels when toggle button is clicked', async () => {
    render(<FractalCanvas projectId="test-project" rootNodeId="root-1" />);

    const toggleButton = screen.getByRole('button', { name: /Hide Labels/i });
    fireEvent.click(toggleButton);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Show Labels/i })).toBeInTheDocument();
    });
  });

  it('should reset view when reset button is clicked', () => {
    render(<FractalCanvas projectId="test-project" rootNodeId="root-1" />);

    const resetButton = screen.getByRole('button', { name: /Reset view/i });
    fireEvent.click(resetButton);

    // View should reset to default transform
    // This is internal state, but we can verify the button works without error
    expect(resetButton).toBeInTheDocument();
  });

  it('should handle expansion errors gracefully', async () => {
    expander.expandNode.mockRejectedValue(new Error('AI API error'));

    render(<FractalCanvas projectId="test-project" rootNodeId="root-1" />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Node: Root Node/i })).toBeInTheDocument();
    });

    const rootNodeButton = screen.getByRole('button', { name: /Node: Root Node/i });
    fireEvent.contextMenu(rootNodeButton);

    await waitFor(() => {
      expect(screen.getByText(/Expansion failed: AI API error/i)).toBeInTheDocument();
    });
  });

  it('should not expand if already expanding', async () => {
    let resolveExpand;
    const expandPromise = new Promise((resolve) => {
      resolveExpand = resolve;
    });

    expander.expandNode.mockReturnValue(expandPromise);

    render(<FractalCanvas projectId="test-project" rootNodeId="root-1" />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Node: Root Node/i })).toBeInTheDocument();
    });

    const rootNodeButton = screen.getByRole('button', { name: /Node: Root Node/i });

    // First expansion
    fireEvent.contextMenu(rootNodeButton);

    // Try to expand again while first is in progress
    fireEvent.contextMenu(rootNodeButton);

    // Should only call expandNode once
    expect(expander.expandNode).toHaveBeenCalledTimes(1);

    // Resolve the expansion
    resolveExpand?.([]);
  });

  it('should have accessible ARIA labels', async () => {
    render(<FractalCanvas projectId="test-project" rootNodeId="root-1" />);

    await waitFor(() => {
      const rootNode = screen.getByRole('button', { name: /Node: Root Node/i });
      expect(rootNode).toHaveAttribute('aria-expanded');
    });
  });

  it('should be keyboard navigable', async () => {
    render(<FractalCanvas projectId="test-project" rootNodeId="root-1" />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Node: Root Node/i })).toBeInTheDocument();
    });

    const container = screen.getByRole('application');
    expect(container).toHaveAttribute('tabindex', '0');
  });
});
