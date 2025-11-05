import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChoreComponent from '../../../../src/components/chore-component/ChoreComponent';

describe('ChoreComponent', () => {
  const mockOnSeedSubmit = jest.fn();

  beforeEach(() => {
    mockOnSeedSubmit.mockClear();
  });

  describe('Hero Section', () => {
    it('renders headline and description', () => {
      render(<ChoreComponent onSeedSubmit={mockOnSeedSubmit} />);

      expect(screen.getByText(/explore ideas like a fractal/i)).toBeInTheDocument();
      expect(
        screen.getByText(/turn any text into an interactive, zoomable map/i)
      ).toBeInTheDocument();
    });

    it('renders CTA button', () => {
      render(<ChoreComponent onSeedSubmit={mockOnSeedSubmit} />);

      const ctaButton = screen.getByRole('button', {
        name: /open text input to start exploring/i,
      });
      expect(ctaButton).toBeInTheDocument();
      expect(ctaButton).toHaveTextContent(/paste text or url to begin/i);
    });

    it('opens modal when CTA button is clicked', () => {
      render(<ChoreComponent onSeedSubmit={mockOnSeedSubmit} />);

      const ctaButton = screen.getByRole('button', {
        name: /open text input to start exploring/i,
      });
      fireEvent.click(ctaButton);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText(/start your knowledge fractal/i)).toBeInTheDocument();
    });
  });

  describe('Modal', () => {
    it('renders modal when autoShow is true', () => {
      render(<ChoreComponent onSeedSubmit={mockOnSeedSubmit} autoShow={true} />);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText(/start your knowledge fractal/i)).toBeInTheDocument();
    });

    it('does not render hero section when modal is open', () => {
      render(<ChoreComponent onSeedSubmit={mockOnSeedSubmit} autoShow={true} />);

      expect(screen.queryByText(/explore ideas like a fractal/i)).not.toBeInTheDocument();
    });

    it('renders textarea with placeholder text', () => {
      render(<ChoreComponent onSeedSubmit={mockOnSeedSubmit} autoShow={true} />);

      const textarea = screen.getByLabelText(/paste text, an article, or a url/i);
      expect(textarea).toBeInTheDocument();
      expect(textarea).toHaveAttribute('placeholder', expect.stringContaining('Paste your content'));
    });

    it('renders privacy notice', () => {
      render(<ChoreComponent onSeedSubmit={mockOnSeedSubmit} autoShow={true} />);

      expect(
        screen.getByText(/all processing happens locally in your browser/i)
      ).toBeInTheDocument();
    });

    it('closes modal when close button is clicked', () => {
      render(<ChoreComponent onSeedSubmit={mockOnSeedSubmit} autoShow={true} />);

      const closeButton = screen.getByRole('button', { name: /close modal/i });
      fireEvent.click(closeButton);

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('closes modal when overlay is clicked', () => {
      render(<ChoreComponent onSeedSubmit={mockOnSeedSubmit} autoShow={true} />);

      const overlay = screen.getByRole('dialog');
      fireEvent.click(overlay);

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('does not close modal when content is clicked', () => {
      render(<ChoreComponent onSeedSubmit={mockOnSeedSubmit} autoShow={true} />);

      const modalTitle = screen.getByText(/start your knowledge fractal/i);
      fireEvent.click(modalTitle);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('closes modal when Cancel button is clicked', () => {
      render(<ChoreComponent onSeedSubmit={mockOnSeedSubmit} autoShow={true} />);

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      fireEvent.click(cancelButton);

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('closes modal on Escape key press', () => {
      render(<ChoreComponent onSeedSubmit={mockOnSeedSubmit} autoShow={true} />);

      const overlay = screen.getByRole('dialog');
      fireEvent.keyDown(overlay, { key: 'Escape', code: 'Escape' });

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('Form Submission', () => {
    it('submit button is disabled when textarea is empty', () => {
      render(<ChoreComponent onSeedSubmit={mockOnSeedSubmit} autoShow={true} />);

      const submitButton = screen.getByRole('button', { name: /generate fractal/i });
      expect(submitButton).toBeDisabled();
    });

    it('submit button is enabled when textarea has text', async () => {
      const user = userEvent.setup();
      render(<ChoreComponent onSeedSubmit={mockOnSeedSubmit} autoShow={true} />);

      const textarea = screen.getByLabelText(/paste text, an article, or a url/i);
      await user.type(textarea, 'Sample text for testing');

      const submitButton = screen.getByRole('button', { name: /generate fractal/i });
      expect(submitButton).toBeEnabled();
    });

    it('calls onSeedSubmit with trimmed text when form is submitted', async () => {
      const user = userEvent.setup();
      render(<ChoreComponent onSeedSubmit={mockOnSeedSubmit} autoShow={true} />);

      const textarea = screen.getByLabelText(/paste text, an article, or a url/i);
      await user.type(textarea, '  Sample text for testing  ');

      const submitButton = screen.getByRole('button', { name: /generate fractal/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnSeedSubmit).toHaveBeenCalledWith('Sample text for testing', expect.any(Function));
        expect(mockOnSeedSubmit).toHaveBeenCalledTimes(1);
      });
    });

    it('shows success message after submission but keeps modal open', async () => {
      const user = userEvent.setup();
      render(<ChoreComponent onSeedSubmit={mockOnSeedSubmit} autoShow={true} />);

      const textarea = screen.getByLabelText(/paste text, an article, or a url/i);
      await user.type(textarea, 'Sample text');

      const submitButton = screen.getByRole('button', { name: /generate fractal/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/success!/i)).toBeInTheDocument();
        expect(screen.getByRole('dialog')).toBeInTheDocument(); // Modal stays open
      });
    });

    it('shows "Processing..." text while submitting', async () => {
      const user = userEvent.setup();
      let resolveSubmit;
      const delayedSubmit = jest.fn(
        (text, onProgress) => {
          onProgress?.({ step: 'importing', progress: 0.5, message: 'Processing...' });
          return new Promise((resolve) => (resolveSubmit = resolve));
        }
      );

      render(<ChoreComponent onSeedSubmit={delayedSubmit} autoShow={true} />);

      const textarea = screen.getByLabelText(/paste text, an article, or a url/i);
      await user.type(textarea, 'Sample text');

      const submitButton = screen.getByRole('button', { name: /generate fractal/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/processing\.\.\./i)).toBeInTheDocument();
      });
      expect(submitButton).toBeDisabled();

      resolveSubmit();
    });

    it('does not submit when textarea contains only whitespace', async () => {
      const user = userEvent.setup();
      render(<ChoreComponent onSeedSubmit={mockOnSeedSubmit} autoShow={true} />);

      const textarea = screen.getByLabelText(/paste text, an article, or a url/i);
      await user.type(textarea, '   ');

      const submitButton = screen.getByRole('button', { name: /generate fractal/i });
      expect(submitButton).toBeDisabled();
    });

    it('handles submission errors gracefully', async () => {
      const user = userEvent.setup();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const errorSubmit = jest.fn(() => Promise.reject(new Error('Test error')));

      render(<ChoreComponent onSeedSubmit={errorSubmit} autoShow={true} />);

      const textarea = screen.getByLabelText(/paste text, an article, or a url/i);
      await user.type(textarea, 'Sample text');

      const submitButton = screen.getByRole('button', { name: /generate fractal/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalled();
      });

      // Modal should remain open on error
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      consoleErrorSpy.mockRestore();
    });

    it('clears textarea when modal is closed and reopened', async () => {
      const user = userEvent.setup();
      render(<ChoreComponent onSeedSubmit={mockOnSeedSubmit} />);

      // Open modal
      const ctaButton = screen.getByRole('button', {
        name: /open text input to start exploring/i,
      });
      await user.click(ctaButton);

      // Type text
      const textarea = screen.getByLabelText(/paste text, an article, or a url/i);
      await user.type(textarea, 'Sample text');

      // Close modal
      const closeButton = screen.getByRole('button', { name: /close modal/i });
      await user.click(closeButton);

      // Reopen modal
      await user.click(screen.getByRole('button', {
        name: /open text input to start exploring/i,
      }));

      // Textarea should be empty
      const newTextarea = screen.getByLabelText(/paste text, an article, or a url/i);
      expect(newTextarea).toHaveValue('');
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels for modal', () => {
      render(<ChoreComponent onSeedSubmit={mockOnSeedSubmit} autoShow={true} />);

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-labelledby', 'chore-modal-title');
    });

    it('textarea has required and describedby attributes', () => {
      render(<ChoreComponent onSeedSubmit={mockOnSeedSubmit} autoShow={true} />);

      const textarea = screen.getByLabelText(/paste text, an article, or a url/i);
      expect(textarea).toHaveAttribute('aria-required', 'true');
      expect(textarea).toHaveAttribute('aria-describedby', 'seed-input-hint');
    });

    it('autofocuses textarea when modal opens', () => {
      render(<ChoreComponent onSeedSubmit={mockOnSeedSubmit} autoShow={true} />);

      const textarea = screen.getByLabelText(/paste text, an article, or a url/i);
      expect(document.activeElement).toBe(textarea);
    });
  });
});
