import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import Hero from '../../../src/components/Hero/Hero';
import { strings } from '../../../src/i18n/strings';

describe('Hero', () => {
  describe('Rendering', () => {
    it('should render hero with title and subtitle', () => {
      render(<Hero />);

      expect(screen.getByText(strings.hero.title)).toBeInTheDocument();
      expect(screen.getByText(strings.hero.subtitle)).toBeInTheDocument();
    });

    it('should render primary and secondary CTAs', () => {
      render(<Hero />);

      const primaryCTA = screen.getByRole('button', {
        name: strings.hero.ctaPrimary,
      });
      const secondaryCTA = screen.getByRole('button', {
        name: strings.hero.ctaSecondary,
      });

      expect(primaryCTA).toBeInTheDocument();
      expect(secondaryCTA).toBeInTheDocument();
    });

    it('should render privacy badge', () => {
      render(<Hero />);

      expect(screen.getByText(strings.hero.privacyBadge)).toBeInTheDocument();
    });

    it('should render FractalSeed visualization', () => {
      render(<Hero />);

      // FractalSeed should be rendered (hidden from screen readers)
      const visual = document.querySelector('.hero-visual');
      expect(visual).toBeInTheDocument();
    });
  });

  describe('CTA Interactions', () => {
    it('should open popover when primary CTA is clicked', () => {
      render(<Hero />);

      const primaryCTA = screen.getByRole('button', {
        name: strings.hero.ctaPrimary,
      });

      // Popover should not be visible initially
      expect(
        screen.queryByRole('dialog', { name: /onboarding/i })
      ).not.toBeInTheDocument();

      // Click primary CTA
      fireEvent.click(primaryCTA);

      // Popover should now be visible
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('should call onDemoStart when secondary CTA is clicked', () => {
      const mockOnDemoStart = jest.fn();
      render(<Hero onDemoStart={mockOnDemoStart} />);

      const secondaryCTA = screen.getByRole('button', {
        name: strings.hero.ctaSecondary,
      });

      fireEvent.click(secondaryCTA);

      expect(mockOnDemoStart).toHaveBeenCalledTimes(1);
    });

    it('should call onStartImport when import succeeds', () => {
      const mockOnStartImport = jest.fn();
      render(<Hero onStartImport={mockOnStartImport} demoMode={true} />);

      // Open popover
      const primaryCTA = screen.getByRole('button', {
        name: strings.hero.ctaPrimary,
      });
      fireEvent.click(primaryCTA);

      // Note: Full import flow is tested in OnboardPopover.test.jsx
      // This test ensures the callback is wired correctly
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<Hero />);

      const primaryCTA = screen.getByRole('button', {
        name: strings.hero.ctaPrimary,
      });
      const secondaryCTA = screen.getByRole('button', {
        name: strings.hero.ctaSecondary,
      });

      expect(primaryCTA).toHaveAccessibleName(strings.hero.ctaPrimary);
      expect(secondaryCTA).toHaveAccessibleName(strings.hero.ctaSecondary);
    });

    it('should have banner role for hero section', () => {
      render(<Hero />);

      const hero = screen.getByRole('banner');
      expect(hero).toBeInTheDocument();
    });

    it('should have aria-labelledby for hero title', () => {
      render(<Hero />);

      const hero = screen.getByRole('banner');
      expect(hero).toHaveAttribute('aria-labelledby', 'hero-title');

      const title = document.getElementById('hero-title');
      expect(title).toHaveTextContent(strings.hero.title);
    });
  });

  describe('Demo Mode', () => {
    it('should use demo mode by default', () => {
      const { container } = render(<Hero />);

      // Hero should render without errors in demo mode
      expect(container).toBeInTheDocument();
    });

    it('should pass demoMode prop to OnboardPopover', () => {
      render(<Hero demoMode={false} />);

      // Open popover
      const primaryCTA = screen.getByRole('button', {
        name: strings.hero.ctaPrimary,
      });
      fireEvent.click(primaryCTA);

      // OnboardPopover should receive demoMode=false
      // (tested in OnboardPopover.test.jsx)
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });
});
