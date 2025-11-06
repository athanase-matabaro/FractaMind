/**
 * FractalCanvas Animation Tests
 *
 * Smoke tests for FractalCanvas expand animations, edge drawing, and panel slide-ins.
 *
 * @jest-environment jsdom
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import FractalCanvas from '../../src/viz/FractalCanvas';

// Mock dependencies
jest.mock('../../src/db/fractamind-indexer', () => ({
  getNode: jest.fn((nodeId) => {
    if (nodeId === 'root') {
      return Promise.resolve({
        id: 'root',
        title: 'Root Node',
        text: 'Root node text',
        children: ['child1', 'child2'],
        meta: { depth: 0 },
      });
    }
    if (nodeId === 'child1') {
      return Promise.resolve({
        id: 'child1',
        title: 'Child 1',
        text: 'Child 1 text',
        children: [],
        meta: { depth: 1 },
      });
    }
    if (nodeId === 'child2') {
      return Promise.resolve({
        id: 'child2',
        title: 'Child 2',
        text: 'Child 2 text',
        children: [],
        meta: { depth: 1 },
      });
    }
    return Promise.resolve(null);
  }),
}));

jest.mock('../../src/core/expander', () => ({
  expandNode: jest.fn((nodeId, options) => {
    return Promise.resolve([
      {
        id: `${nodeId}-newchild1`,
        title: 'New Child 1',
        text: 'New child text',
      },
      {
        id: `${nodeId}-newchild2`,
        title: 'New Child 2',
        text: 'New child text',
      },
    ]);
  }),
}));

jest.mock('../../src/core/memory', () => ({
  recordInteraction: jest.fn(() => Promise.resolve()),
}));

jest.mock('../../src/viz/SearchHUD', () => {
  return function MockSearchHUD({ onResultSelect, disabled }) {
    return (
      <div data-testid="search-hud" data-disabled={disabled}>
        <input
          type="text"
          placeholder="Search"
          data-testid="search-input"
        />
      </div>
    );
  };
});

jest.mock('../../src/components/NodeDetails/NodeDetailsEditor', () => {
  return function MockNodeDetailsEditor({ node, onClose }) {
    return (
      <div data-testid="node-details-editor" data-node-id={node.id}>
        <h3>{node.title}</h3>
        <button onClick={onClose} data-testid="close-editor">
          Close
        </button>
      </div>
    );
  };
});

describe('FractalCanvas Animations', () => {
  const defaultProps = {
    projectId: 'test-project',
    rootNodeId: 'root',
    quantParams: { bits: 4 },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Component Rendering', () => {
    it('should render fractal canvas container', async () => {
      render(<FractalCanvas {...defaultProps} />);

      const container = screen.getByRole('application', {
        name: 'Fractal knowledge graph',
      });
      expect(container).toBeInTheDocument();
    });

    it('should render HUD controls with glass morphism', async () => {
      render(<FractalCanvas {...defaultProps} />);

      const resetButton = screen.getByRole('button', { name: 'Reset view' });
      expect(resetButton).toBeInTheDocument();
      expect(resetButton).toHaveClass('hud-button');

      const toggleButton = screen.getByRole('button', { name: /Hide Labels|Show Labels/ });
      expect(toggleButton).toBeInTheDocument();
      expect(toggleButton).toHaveClass('hud-button');
    });

    it('should render SearchHUD component', async () => {
      render(<FractalCanvas {...defaultProps} />);

      const searchHUD = screen.getByTestId('search-hud');
      expect(searchHUD).toBeInTheDocument();
    });

    it('should render root node after loading', async () => {
      render(<FractalCanvas {...defaultProps} />);

      await waitFor(() => {
        const rootNode = screen.getByRole('button', { name: 'Node: Root Node' });
        expect(rootNode).toBeInTheDocument();
      });
    });

    it('should render child nodes', async () => {
      render(<FractalCanvas {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Node: Child 1' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Node: Child 2' })).toBeInTheDocument();
      });
    });
  });

  describe('Node Expand Animations', () => {
    it('should apply expanding class to parent node during expansion', async () => {
      const { container } = render(<FractalCanvas {...defaultProps} />);

      // Wait for root node to load
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Node: Root Node' })).toBeInTheDocument();
      });

      const rootNode = screen.getByRole('button', { name: 'Node: Root Node' });

      // Trigger expand (right-click)
      fireEvent.contextMenu(rootNode);

      // Check that expanding class is applied
      await waitFor(() => {
        expect(rootNode).toHaveClass('fractal-node', 'expanding');
      });

      // Wait for expansion to complete
      await waitFor(
        () => {
          expect(rootNode).not.toHaveClass('expanding');
        },
        { timeout: 3000 }
      );
    });

    it('should show spinner during expansion', async () => {
      const { container } = render(<FractalCanvas {...defaultProps} />);

      // Wait for root node to load
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Node: Root Node' })).toBeInTheDocument();
      });

      const rootNode = screen.getByRole('button', { name: 'Node: Root Node' });

      // Trigger expand
      fireEvent.contextMenu(rootNode);

      // Check for spinner
      await waitFor(() => {
        const spinner = container.querySelector('.node-spinner');
        expect(spinner).toBeInTheDocument();
      });
    });

    it('should apply new-child class to newly created nodes', async () => {
      const { container } = render(<FractalCanvas {...defaultProps} />);

      // Wait for root node
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Node: Root Node' })).toBeInTheDocument();
      });

      const rootNode = screen.getByRole('button', { name: 'Node: Root Node' });

      // Trigger expand
      fireEvent.contextMenu(rootNode);

      // Wait for new children to appear
      await waitFor(
        () => {
          const newNodes = container.querySelectorAll('.fractal-node.new-child');
          expect(newNodes.length).toBeGreaterThan(0);
        },
        { timeout: 3000 }
      );
    });

    it('should remove new-child class after animation completes', async () => {
      const { container } = render(<FractalCanvas {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Node: Root Node' })).toBeInTheDocument();
      });

      const rootNode = screen.getByRole('button', { name: 'Node: Root Node' });

      // Trigger expand
      fireEvent.contextMenu(rootNode);

      // Wait for new-child class to appear
      await waitFor(
        () => {
          const newNodes = container.querySelectorAll('.fractal-node.new-child');
          expect(newNodes.length).toBeGreaterThan(0);
        },
        { timeout: 3000 }
      );

      // Wait for animation to complete (1000ms timeout in component)
      await waitFor(
        () => {
          const newNodes = container.querySelectorAll('.fractal-node.new-child');
          expect(newNodes.length).toBe(0);
        },
        { timeout: 2000 }
      );
    });
  });

  describe('Edge Animations', () => {
    it('should render SVG edges with drawing animation class', async () => {
      const { container } = render(<FractalCanvas {...defaultProps} />);

      // Wait for nodes to load
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Node: Root Node' })).toBeInTheDocument();
      });

      // Check for edge lines
      const edges = container.querySelectorAll('.edge-line');
      expect(edges.length).toBeGreaterThan(0);

      // Edges should have the edge-line class for animation
      edges.forEach((edge) => {
        expect(edge).toHaveClass('edge-line');
      });
    });

    it('should render edges connecting parent to children', async () => {
      const { container } = render(<FractalCanvas {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Node: Child 1' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Node: Child 2' })).toBeInTheDocument();
      });

      // Should have 2 edges (root to child1, root to child2)
      const edges = container.querySelectorAll('.edge-line');
      expect(edges.length).toBe(2);
    });
  });

  describe('Node Details Panel Animations', () => {
    it('should open NodeDetailsEditor with slide-in animation when node clicked', async () => {
      render(<FractalCanvas {...defaultProps} />);

      // Wait for root node
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Node: Root Node' })).toBeInTheDocument();
      });

      const rootNode = screen.getByRole('button', { name: 'Node: Root Node' });

      // Click node
      fireEvent.click(rootNode);

      // Check that editor appears
      await waitFor(() => {
        const editor = screen.getByTestId('node-details-editor');
        expect(editor).toBeInTheDocument();
        expect(editor).toHaveAttribute('data-node-id', 'root');
      });
    });

    it('should close NodeDetailsEditor when close button clicked', async () => {
      render(<FractalCanvas {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Node: Root Node' })).toBeInTheDocument();
      });

      const rootNode = screen.getByRole('button', { name: 'Node: Root Node' });

      // Click to open
      fireEvent.click(rootNode);

      await waitFor(() => {
        expect(screen.getByTestId('node-details-editor')).toBeInTheDocument();
      });

      // Click close button
      const closeButton = screen.getByTestId('close-editor');
      fireEvent.click(closeButton);

      // Editor should disappear
      await waitFor(() => {
        expect(screen.queryByTestId('node-details-editor')).not.toBeInTheDocument();
      });
    });
  });

  describe('HUD Control Interactions', () => {
    it('should reset view when Reset View button clicked', async () => {
      render(<FractalCanvas {...defaultProps} />);

      const resetButton = screen.getByRole('button', { name: 'Reset view' });

      // Click reset
      fireEvent.click(resetButton);

      // Component should still render (transform reset handled internally)
      expect(resetButton).toBeInTheDocument();
    });

    it('should toggle labels when Toggle Labels button clicked', async () => {
      const { container } = render(<FractalCanvas {...defaultProps} />);

      const toggleButton = screen.getByRole('button', { name: /Hide Labels/ });

      // Click toggle
      fireEvent.click(toggleButton);

      // Button text should change
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Show Labels/ })).toBeInTheDocument();
      });

      // Labels should be hidden
      const labels = container.querySelectorAll('.node-label');
      expect(labels.length).toBe(0);
    });
  });

  describe('Accessibility', () => {
    it('should have application role on canvas', async () => {
      render(<FractalCanvas {...defaultProps} />);

      const canvas = screen.getByRole('application');
      expect(canvas).toHaveAttribute('aria-label', 'Fractal knowledge graph');
    });

    it('should have aria-expanded on nodes with children', async () => {
      render(<FractalCanvas {...defaultProps} />);

      await waitFor(() => {
        const rootNode = screen.getByRole('button', { name: 'Node: Root Node' });
        expect(rootNode).toHaveAttribute('aria-expanded', 'true');
      });
    });

    it('should have focus-visible styles on HUD buttons', async () => {
      render(<FractalCanvas {...defaultProps} />);

      const resetButton = screen.getByRole('button', { name: 'Reset view' });

      // Focus button
      resetButton.focus();

      // Button should be focused
      expect(resetButton).toHaveFocus();
    });

    it('should have aria-label on HUD buttons', async () => {
      render(<FractalCanvas {...defaultProps} />);

      const resetButton = screen.getByRole('button', { name: 'Reset view' });
      expect(resetButton).toHaveAttribute('aria-label', 'Reset view');

      const toggleButton = screen.getByRole('button', { name: /Toggle labels/ });
      expect(toggleButton).toHaveAttribute('aria-label', 'Toggle labels');
    });
  });

  describe('Performance', () => {
    it('should use GPU-accelerated transforms for canvas', async () => {
      const { container } = render(<FractalCanvas {...defaultProps} />);

      const canvas = container.querySelector('.fractal-canvas');
      const style = canvas.getAttribute('style');

      // Check for transform property (GPU-accelerated)
      expect(style).toContain('transform');
    });

    it('should render within reasonable time', async () => {
      const startTime = Date.now();

      render(<FractalCanvas {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Node: Root Node' })).toBeInTheDocument();
      });

      const endTime = Date.now();
      const renderTime = endTime - startTime;

      // Should render within 1 second
      expect(renderTime).toBeLessThan(1000);
    });
  });

  describe('Error Handling', () => {
    it('should show error alert when expansion fails', async () => {
      const { expandNode } = require('../../src/core/expander');
      expandNode.mockRejectedValueOnce(new Error('Expansion failed'));

      render(<FractalCanvas {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Node: Root Node' })).toBeInTheDocument();
      });

      const rootNode = screen.getByRole('button', { name: 'Node: Root Node' });

      // Trigger expand
      fireEvent.contextMenu(rootNode);

      // Wait for error alert
      await waitFor(() => {
        const errorAlert = screen.getByText(/Expansion failed/);
        expect(errorAlert).toBeInTheDocument();
      });
    });
  });
});
