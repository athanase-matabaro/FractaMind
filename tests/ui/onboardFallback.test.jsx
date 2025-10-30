/**
 * tests/ui/onboardFallback.test.jsx
 *
 * UI tests for OnboardPopover AI timeout and fallback handling
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import OnboardPopover from '../../src/components/OnboardPopover/OnboardPopover';

// Mock child components
jest.mock('../../src/components/ToneSelector/ToneSelector', () => {
  return function ToneSelector({ defaultTone, onChange }) {
    return (
      <div data-testid="tone-selector">
        <button onClick={() => onChange('concise')}>Concise</button>
        <button onClick={() => onChange('technical')}>Technical</button>
      </div>
    );
  };
});

jest.mock('../../src/components/ExamplesCarousel/ExamplesCarousel', () => {
  return function ExamplesCarousel({ onExampleSelect }) {
    return (
      <div data-testid="examples-carousel">
        <button onClick={() => onExampleSelect({ content: 'Example text' })}>
          Example 1
        </button>
      </div>
    );
  };
});

jest.mock('../../src/components/FractalSeed/FractalSeed', () => {
  return function FractalSeed() {
    return <div data-testid="fractal-seed">Animating...</div>;
  };
});

describe('OnboardPopover AI Fallback', () => {
  const mockOnClose = jest.fn();
  const mockOnSuccess = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Demo Mode (Default)', () => {
    it('should use mock processing in demo mode', async () => {
      render(
        <OnboardPopover
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
          demoMode={true}
        />
      );

      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: 'Test document' } });

      const submitButton = screen.getByRole('button', { name: /generate fractal/i });
      fireEvent.click(submitButton);

      // Should show processing state
      await waitFor(() => {
        expect(screen.getByText(/analyzing/i)).toBeInTheDocument();
      });

      // Should eventually complete
      await waitFor(
        () => {
          expect(mockOnSuccess).toHaveBeenCalled();
        },
        { timeout: 5000 }
      );
    });

    it('should display progress messages in demo mode', async () => {
      render(
        <OnboardPopover
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
          demoMode={true}
        />
      );

      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: 'Test document' } });

      const submitButton = screen.getByRole('button', { name: /generate fractal/i });
      fireEvent.click(submitButton);

      // Should show analyzing
      await waitFor(() => {
        expect(screen.getByText(/analyzing/i)).toBeInTheDocument();
      });

      // Should show FractalSeed during summarizing
      await waitFor(() => {
        expect(screen.getByTestId('fractal-seed')).toBeInTheDocument();
      });
    });
  });

  describe('AI Timeout Handling', () => {
    it('should show error state when AI times out', async () => {
      const mockOnImport = jest.fn().mockRejectedValue(
        new Error('Operation timed out')
      );

      render(
        <OnboardPopover
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
          demoMode={false}
          onImport={mockOnImport}
        />
      );

      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: 'Test document' } });

      const submitButton = screen.getByRole('button', { name: /generate fractal/i });
      fireEvent.click(submitButton);

      // Should show timeout error
      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/timed out/i);
      });

      // Should show Retry and Demo buttons
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /continue with demo/i })
      ).toBeInTheDocument();
    });

    it('should retry when Retry button is clicked', async () => {
      const mockOnImport = jest
        .fn()
        .mockRejectedValueOnce(new Error('Operation timed out'))
        .mockResolvedValueOnce({
          project: { id: 'test-project', name: 'Test', nodeCount: 5 },
          rootNode: { id: 'root', title: 'Root', text: 'Root text' },
          nodes: []
        });

      render(
        <OnboardPopover
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
          demoMode={false}
          onImport={mockOnImport}
        />
      );

      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: 'Test document' } });

      const submitButton = screen.getByRole('button', { name: /generate fractal/i });
      fireEvent.click(submitButton);

      // Wait for timeout error
      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/timed out/i);
      });

      // Click Retry
      const retryButton = screen.getByRole('button', { name: /retry/i });
      fireEvent.click(retryButton);

      // Should call onImport again
      await waitFor(() => {
        expect(mockOnImport).toHaveBeenCalledTimes(2);
      });

      // Should succeed on second attempt
      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalled();
      });
    });

    it('should use demo summary when "Continue with demo summary" is clicked', async () => {
      const mockOnImport = jest.fn().mockRejectedValue(
        new Error('Embedding generation timed out')
      );

      render(
        <OnboardPopover
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
          demoMode={false}
          onImport={mockOnImport}
        />
      );

      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: 'Test document' } });

      const submitButton = screen.getByRole('button', { name: /generate fractal/i });
      fireEvent.click(submitButton);

      // Wait for timeout error
      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/timed out/i);
      });

      // Click "Continue with demo summary"
      const demoButton = screen.getByRole('button', {
        name: /continue with demo/i
      });
      fireEvent.click(demoButton);

      // Should complete with mock processing
      await waitFor(
        () => {
          expect(mockOnSuccess).toHaveBeenCalled();
        },
        { timeout: 5000 }
      );

      // Should have called demo processing (not real import)
      expect(mockOnImport).toHaveBeenCalledTimes(1); // Only initial call, not demo
    });
  });

  describe('Accessibility', () => {
    it('should announce progress with aria-live', async () => {
      render(
        <OnboardPopover
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
          demoMode={true}
        />
      );

      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: 'Test document' } });

      const submitButton = screen.getByRole('button', { name: /generate fractal/i });
      fireEvent.click(submitButton);

      // Progress div should have aria-live
      await waitFor(() => {
        const progressDiv = screen.getByRole('status');
        expect(progressDiv).toHaveAttribute('aria-live', 'polite');
      });
    });

    it('should announce errors with aria-live', async () => {
      const mockOnImport = jest.fn().mockRejectedValue(
        new Error('Summarizer API timed out')
      );

      render(
        <OnboardPopover
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
          demoMode={false}
          onImport={mockOnImport}
        />
      );

      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: 'Test document' } });

      const submitButton = screen.getByRole('button', { name: /generate fractal/i });
      fireEvent.click(submitButton);

      // Error alert should have aria-live
      await waitFor(() => {
        const errorAlert = screen.getByRole('alert');
        expect(errorAlert).toHaveAttribute('aria-live', 'polite');
      });
    });

    it('should have accessible labels for action buttons', async () => {
      const mockOnImport = jest.fn().mockRejectedValue(
        new Error('Operation timed out')
      );

      render(
        <OnboardPopover
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
          demoMode={false}
          onImport={mockOnImport}
        />
      );

      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: 'Test document' } });

      const submitButton = screen.getByRole('button', { name: /generate fractal/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });

      // Check aria-label on action buttons
      const retryButton = screen.getByRole('button', { name: /retry ai processing/i });
      expect(retryButton).toHaveAttribute('aria-label');

      const demoButton = screen.getByRole('button', {
        name: /continue with demo summary instead/i
      });
      expect(demoButton).toHaveAttribute('aria-label');
    });
  });

  describe('Error Messages', () => {
    it('should show generic error for non-timeout errors', async () => {
      const mockOnImport = jest.fn().mockRejectedValue(
        new Error('Network error')
      );

      render(
        <OnboardPopover
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
          demoMode={false}
          onImport={mockOnImport}
        />
      );

      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: 'Test document' } });

      const submitButton = screen.getByRole('button', { name: /generate fractal/i });
      fireEvent.click(submitButton);

      // Should show error but NOT Retry/Demo buttons (not a timeout)
      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/network error/i);
      });

      // Should NOT show action buttons for non-timeout errors
      expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument();
    });

    it('should clear error state when retrying', async () => {
      const mockOnImport = jest
        .fn()
        .mockRejectedValueOnce(new Error('Operation timed out'))
        .mockResolvedValueOnce({
          project: { id: 'test', name: 'Test', nodeCount: 3 },
          rootNode: { id: 'root', title: 'Root', text: 'Test' },
          nodes: []
        });

      render(
        <OnboardPopover
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
          demoMode={false}
          onImport={mockOnImport}
        />
      );

      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: 'Test document' } });

      const submitButton = screen.getByRole('button', { name: /generate fractal/i });
      fireEvent.click(submitButton);

      // Wait for error
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });

      // Click Retry
      const retryButton = screen.getByRole('button', { name: /retry/i });
      fireEvent.click(retryButton);

      // Error should be cleared
      await waitFor(() => {
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty text gracefully', async () => {
      render(
        <OnboardPopover
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
          demoMode={true}
        />
      );

      const submitButton = screen.getByRole('button', { name: /generate fractal/i });

      // Submit button should be disabled by default (no text)
      expect(submitButton).toBeDisabled();

      // Try clicking anyway (shouldn't do anything)
      fireEvent.click(submitButton);

      // No error should appear because button is disabled
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('should disable form controls during submission', async () => {
      render(
        <OnboardPopover
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
          demoMode={true}
        />
      );

      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: 'Test document' } });

      const submitButton = screen.getByRole('button', { name: /generate fractal/i });
      fireEvent.click(submitButton);

      // Textarea should be disabled
      await waitFor(() => {
        expect(textarea).toBeDisabled();
      });

      // Close button should be disabled
      const closeButton = screen.getByRole('button', { name: /close/i });
      expect(closeButton).toBeDisabled();
    });
  });
});
