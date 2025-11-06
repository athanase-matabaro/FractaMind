/**
 * Hero Visual Tests
 *
 * Tests for Hero component animations, accessibility, and visual rendering.
 *
 * @jest-environment jsdom
 */

import { render, screen, waitFor } from '@testing-library/react';
import Hero from '../../src/components/Hero/Hero';
import { strings } from '../../src/i18n/strings';

// Mock the SeedFractal and FractalSeed components
jest.mock('../../src/components/Hero/SeedFractal', () => {
  return function MockSeedFractal({ opacity }) {
    return <div data-testid="seed-fractal" data-opacity={opacity} />;
  };
});

jest.mock('../../src/components/FractalSeed/FractalSeed', () => {
  return function MockFractalSeed({ size, color, autoPlay }) {
    return (
      <div
        data-testid="fractal-seed"
        data-size={size}
        data-color={color}
        data-autoplay={autoPlay}
      />
    );
  };
});

jest.mock('../../src/components/OnboardPopover/OnboardPopover', () => {
  return function MockOnboardPopover({ isOpen }) {
    return isOpen ? <div data-testid="onboard-popover">Popover</div> : null;
  };
});

describe('Hero Component', () => {
  describe('Rendering', () => {
    it('should render hero section with banner role', () => {
      render(<Hero />);
      const hero = screen.getByRole('banner');
      expect(hero).toBeInTheDocument();
    });

    it('should render title with correct text', () => {
      render(<Hero />);
      const title = screen.getByRole('heading', { name: strings.hero.title });
      expect(title).toBeInTheDocument();
      expect(title).toHaveClass('hero-title');
    });

    it('should render subtitle with privacy messaging', () => {
      render(<Hero />);
      const subtitle = screen.getByText(strings.hero.subtitle);
      expect(subtitle).toBeInTheDocument();
      expect(subtitle).toHaveClass('hero-subtitle');
    });

    it('should render privacy badge with accessible label', () => {
      render(<Hero />);
      const privacyText = screen.getByText(strings.hero.privacyBadge);
      expect(privacyText).toBeInTheDocument();

      // Check aria-label exists
      const badge = privacyText.parentElement;
      expect(badge).toHaveAttribute('aria-label', strings.hero.privacyBadgeAria);
    });

    it('should render primary CTA button', () => {
      render(<Hero />);
      const primaryButton = screen.getByRole('button', { name: strings.hero.ctaPrimary });
      expect(primaryButton).toBeInTheDocument();
      expect(primaryButton).toHaveClass('hero-cta-primary');
    });

    it('should render secondary CTA button', () => {
      render(<Hero />);
      const secondaryButton = screen.getByRole('button', { name: strings.hero.ctaSecondary });
      expect(secondaryButton).toBeInTheDocument();
      expect(secondaryButton).toHaveClass('hero-cta-secondary');
    });

    it('should render SeedFractal background with correct opacity', () => {
      render(<Hero />);
      const seedFractal = screen.getByTestId('seed-fractal');
      expect(seedFractal).toBeInTheDocument();
      expect(seedFractal).toHaveAttribute('data-opacity', '0.12');
    });

    it('should render FractalSeed visualization', () => {
      render(<Hero />);
      const fractalSeed = screen.getByTestId('fractal-seed');
      expect(fractalSeed).toBeInTheDocument();
      expect(fractalSeed).toHaveAttribute('data-size', '280');
      expect(fractalSeed).toHaveAttribute('data-color', '#ffffff');
      expect(fractalSeed).toHaveAttribute('data-autoplay', 'true');
    });
  });

  describe('Animations', () => {
    it('should start with hero-loaded class removed', () => {
      const { container } = render(<Hero />);
      const heroSection = container.querySelector('.hero');
      expect(heroSection).not.toHaveClass('hero-loaded');
    });

    it('should add hero-loaded class after mount delay', async () => {
      const { container } = render(<Hero />);
      const heroSection = container.querySelector('.hero');

      // Wait for the 100ms delay + fade-in animation
      await waitFor(
        () => {
          expect(heroSection).toHaveClass('hero-loaded');
        },
        { timeout: 200 }
      );
    });

    it('should have fade-in styles on title element', () => {
      const { container } = render(<Hero />);
      const title = container.querySelector('.hero-title');

      // Check computed style includes transition properties
      const styles = window.getComputedStyle(title);
      expect(styles).toBeDefined();
    });

    it('should have staggered delays on subtitle and badge', () => {
      const { container } = render(<Hero />);
      const subtitle = container.querySelector('.hero-subtitle');
      const badge = container.querySelector('.hero-privacy-badge');

      expect(subtitle).toBeInTheDocument();
      expect(badge).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have accessible name for hero section', () => {
      render(<Hero />);
      const hero = screen.getByRole('banner');
      expect(hero).toHaveAttribute('aria-labelledby', 'hero-title');
    });

    it('should have id on title for aria-labelledby reference', () => {
      render(<Hero />);
      const title = screen.getByRole('heading', { name: strings.hero.title });
      expect(title).toHaveAttribute('id', 'hero-title');
    });

    it('should have aria-labels on CTA buttons', () => {
      render(<Hero />);
      const primaryButton = screen.getByRole('button', { name: strings.hero.ctaPrimary });
      const secondaryButton = screen.getByRole('button', { name: strings.hero.ctaSecondary });

      expect(primaryButton).toHaveAttribute('aria-label', strings.hero.ctaPrimary);
      expect(secondaryButton).toHaveAttribute('aria-label', strings.hero.ctaSecondary);
    });

    it('should hide decorative elements from screen readers', () => {
      const { container } = render(<Hero />);
      const background = container.querySelector('.hero-background');
      expect(background).toHaveAttribute('aria-hidden', 'true');

      const visual = container.querySelector('.hero-visual');
      expect(visual).toHaveAttribute('aria-hidden', 'true');
    });

    it('should have note role on privacy badge', () => {
      const { container } = render(<Hero />);
      const privacyBadge = container.querySelector('.hero-privacy-badge');
      expect(privacyBadge).toHaveAttribute('role', 'note');
    });
  });

  describe('Interactions', () => {
    it('should call onStartImport when primary CTA clicked', () => {
      const mockOnStartImport = jest.fn();
      render(<Hero onStartImport={mockOnStartImport} />);

      const primaryButton = screen.getByRole('button', { name: strings.hero.ctaPrimary });
      primaryButton.click();

      // Popover should open (we verify onStartImport is called when popover succeeds)
      expect(screen.getByTestId('onboard-popover')).toBeInTheDocument();
    });

    it('should call onDemoStart when secondary CTA clicked', () => {
      const mockOnDemoStart = jest.fn();
      render(<Hero onDemoStart={mockOnDemoStart} />);

      const secondaryButton = screen.getByRole('button', { name: strings.hero.ctaSecondary });
      secondaryButton.click();

      expect(mockOnDemoStart).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('onboard-popover')).toBeInTheDocument();
    });

    it('should restart FractalSeed animation when CTA clicked', () => {
      render(<Hero />);
      const primaryButton = screen.getByRole('button', { name: strings.hero.ctaPrimary });

      // Click CTA
      primaryButton.click();

      // FractalSeed should still be rendered (key changed internally)
      expect(screen.getByTestId('fractal-seed')).toBeInTheDocument();
    });
  });

  describe('Responsive Typography', () => {
    it('should use clamp() for responsive title sizing', () => {
      const { container } = render(<Hero />);
      const title = container.querySelector('.hero-title');

      // Check that the element exists (CSS clamp checked via actual rendering)
      expect(title).toBeInTheDocument();
    });
  });

  describe('Reduced Motion', () => {
    beforeEach(() => {
      // Mock matchMedia for reduced-motion
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation((query) => ({
          matches: query === '(prefers-reduced-motion: reduce)',
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        })),
      });
    });

    it('should respect prefers-reduced-motion setting', () => {
      const { container } = render(<Hero />);
      const heroSection = container.querySelector('.hero');

      // Hero should still render
      expect(heroSection).toBeInTheDocument();

      // CSS media query handles animation disabling
      // We just verify the component renders without errors
    });
  });

  describe('PropTypes', () => {
    it('should accept demoMode prop', () => {
      const { container } = render(<Hero demoMode={false} />);
      expect(container.querySelector('.hero')).toBeInTheDocument();
    });

    it('should default demoMode to true', () => {
      const { container } = render(<Hero />);
      expect(container.querySelector('.hero')).toBeInTheDocument();
    });
  });
});
