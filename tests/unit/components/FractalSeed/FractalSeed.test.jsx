import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import FractalSeed from '../../../../src/components/FractalSeed/FractalSeed';

describe('FractalSeed', () => {
  describe('Rendering', () => {
    it('should render SVG with correct dimensions', () => {
      render(<FractalSeed size={200} />);

      const svg = document.querySelector('.fractal-seed');
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveAttribute('width', '200');
      expect(svg).toHaveAttribute('height', '200');
    });

    it('should render with custom color', () => {
      render(<FractalSeed color="#ff0000" />);

      const svg = document.querySelector('.fractal-seed');
      expect(svg).toHaveStyle({ '--seed-color': '#ff0000' });
    });

    it('should have ARIA label', () => {
      render(<FractalSeed />);

      const container = screen.getByRole('img');
      expect(container).toHaveAttribute(
        'aria-label',
        'Animated fractal seed growing and branching'
      );
    });

    it('should render 6 nodes', () => {
      render(<FractalSeed />);

      const nodes = document.querySelectorAll('.fractal-node');
      expect(nodes).toHaveLength(6);
    });

    it('should render 5 branches', () => {
      render(<FractalSeed />);

      const branches = document.querySelectorAll('.fractal-branch');
      expect(branches).toHaveLength(5);
    });
  });

  describe('Animation', () => {
    it('should start animation when autoPlay is true', async () => {
      render(<FractalSeed autoPlay={true} />);

      const svg = document.querySelector('.fractal-seed');

      await waitFor(
        () => {
          expect(svg).toHaveClass('animating');
        },
        { timeout: 100 }
      );
    });

    it('should not auto-animate when autoPlay is false', () => {
      render(<FractalSeed autoPlay={false} />);

      const svg = document.querySelector('.fractal-seed');
      expect(svg).not.toHaveClass('animating');
    });

    it('should call onComplete callback when animation finishes', async () => {
      const mockOnComplete = jest.fn();
      render(
        <FractalSeed autoPlay={true} animationDelay={0} onComplete={mockOnComplete} />
      );

      // Animation should complete after duration (default 1200ms or 100ms for reduced motion)
      await waitFor(
        () => {
          expect(mockOnComplete).toHaveBeenCalledTimes(1);
        },
        { timeout: 1500 }
      );
    });

    it('should apply animation delay', async () => {
      render(<FractalSeed autoPlay={true} animationDelay={500} />);

      const svg = document.querySelector('.fractal-seed');

      // Should not be animating immediately
      expect(svg).not.toHaveClass('animating');

      // Should be animating after delay
      await waitFor(
        () => {
          expect(svg).toHaveClass('animating');
        },
        { timeout: 600 }
      );
    });
  });

  describe('Reduced Motion', () => {
    it('should respect reducedMotion prop', () => {
      render(<FractalSeed reducedMotion={true} />);

      // Glow effect should not be rendered in reduced motion
      const glow = document.querySelector('.fractal-glow');
      expect(glow).not.toBeInTheDocument();
    });

    it('should use faster animation in reduced motion', () => {
      render(<FractalSeed reducedMotion={true} autoPlay={true} />);

      const svg = document.querySelector('.fractal-seed');
      // Reduced motion uses 100ms instead of 1200ms
      expect(svg).toHaveStyle({ '--animation-duration': '100ms' });
    });

    it('should render glow in normal motion mode', () => {
      render(<FractalSeed reducedMotion={false} />);

      const glow = document.querySelector('.fractal-glow');
      expect(glow).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have aria-live region', () => {
      render(<FractalSeed />);

      const container = screen.getByRole('img');
      expect(container).toHaveAttribute('aria-live', 'polite');
      expect(container).toHaveAttribute('aria-atomic', 'true');
    });

    it('should announce idle state', () => {
      render(<FractalSeed autoPlay={false} />);

      expect(screen.getByText('Fractal seed idle')).toBeInTheDocument();
    });

    it('should announce growing state during animation', async () => {
      render(<FractalSeed autoPlay={true} />);

      await waitFor(() => {
        expect(screen.getByText('Fractal seed growing')).toBeInTheDocument();
      });
    });

    it('should announce ready state when complete', async () => {
      render(<FractalSeed autoPlay={true} animationDelay={0} />);

      await waitFor(
        () => {
          expect(screen.getByText('Fractal seed ready')).toBeInTheDocument();
        },
        { timeout: 1500 }
      );
    });
  });

  describe('Props', () => {
    it('should accept custom size', () => {
      render(<FractalSeed size={300} />);

      const svg = document.querySelector('.fractal-seed');
      expect(svg).toHaveAttribute('width', '300');
      expect(svg).toHaveAttribute('height', '300');
    });

    it('should accept custom color', () => {
      render(<FractalSeed color="#00ff00" />);

      const svg = document.querySelector('.fractal-seed');
      expect(svg).toHaveStyle({ '--seed-color': '#00ff00' });
    });

    it('should use default props when not specified', () => {
      render(<FractalSeed />);

      const svg = document.querySelector('.fractal-seed');
      expect(svg).toHaveAttribute('width', '200'); // default size
    });
  });
});
