import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import OnboardPopover from '../../../../src/components/OnboardPopover/OnboardPopover';
import { strings } from '../../../../src/i18n/strings';

describe('OnboardPopover', () => {
  const mockOnClose = jest.fn();
  const mockOnSuccess = jest.fn();
  const mockOnImport = jest.fn();

  beforeEach(() => {
    mockOnClose.mockClear();
    mockOnSuccess.mockClear();
    mockOnImport.mockClear();
  });

  describe('Rendering', () => {
    it('should not render when isOpen is false', () => {
      render(
        <OnboardPopover
          isOpen={false}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should render when isOpen is true', () => {
      render(
        <OnboardPopover
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('should render title', () => {
      render(
        <OnboardPopover
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      expect(screen.getByText(strings.onboard.title)).toBeInTheDocument();
    });

    it('should render textarea with label', () => {
      render(
        <OnboardPopover
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const textarea = screen.getByLabelText(strings.onboard.textareaLabel);
      expect(textarea).toBeInTheDocument();
    });

    it('should render examples carousel', () => {
      render(
        <OnboardPopover
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      expect(screen.getByText(strings.examples.title)).toBeInTheDocument();
    });

    it('should render tone selector', () => {
      render(
        <OnboardPopover
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      expect(screen.getByText(strings.tone.label)).toBeInTheDocument();
    });

    it('should render submit button', () => {
      render(
        <OnboardPopover
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const submitButton = screen.getByRole('button', {
        name: strings.onboard.submitButton,
      });
      expect(submitButton).toBeInTheDocument();
    });

    it('should render cancel button', () => {
      render(
        <OnboardPopover
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const cancelButton = screen.getByRole('button', {
        name: strings.actions.cancel,
      });
      expect(cancelButton).toBeInTheDocument();
    });
  });

  describe('Close Behavior', () => {
    it('should call onClose when close button is clicked', () => {
      render(
        <OnboardPopover
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const closeButton = screen.getByLabelText('Close onboarding dialog');
      fireEvent.click(closeButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when cancel button is clicked', () => {
      render(
        <OnboardPopover
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const cancelButton = screen.getByRole('button', {
        name: strings.actions.cancel,
      });
      fireEvent.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when backdrop is clicked', () => {
      render(
        <OnboardPopover
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const backdrop = document.querySelector('.onboard-popover-backdrop');
      fireEvent.click(backdrop);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should not close when popover content is clicked', () => {
      render(
        <OnboardPopover
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const popover = document.querySelector('.onboard-popover');
      fireEvent.click(popover);

      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  describe('Text Input', () => {
    it('should update text on textarea change', () => {
      render(
        <OnboardPopover
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const textarea = screen.getByLabelText(strings.onboard.textareaLabel);
      fireEvent.change(textarea, { target: { value: 'Test content' } });

      expect(textarea).toHaveValue('Test content');
    });

    it('should disable submit button when text is empty', () => {
      render(
        <OnboardPopover
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const submitButton = screen.getByRole('button', {
        name: strings.onboard.submitButton,
      });

      expect(submitButton).toBeDisabled();
    });

    it('should enable submit button when text is not empty', () => {
      render(
        <OnboardPopover
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const textarea = screen.getByLabelText(strings.onboard.textareaLabel);
      const submitButton = screen.getByRole('button', {
        name: strings.onboard.submitButton,
      });

      fireEvent.change(textarea, { target: { value: 'Test content' } });

      expect(submitButton).not.toBeDisabled();
    });
  });

  describe('Demo Mode', () => {
    it('should use demo mode by default', async () => {
      render(
        <OnboardPopover
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
          demoMode={true}
        />
      );

      const textarea = screen.getByLabelText(strings.onboard.textareaLabel);
      fireEvent.change(textarea, { target: { value: 'Test document' } });

      const submitButton = screen.getByRole('button', {
        name: strings.onboard.submitButton,
      });
      fireEvent.click(submitButton);

      // Should show progress message
      await waitFor(() => {
        expect(screen.getByText(/Analyzing document/i)).toBeInTheDocument();
      });

      // Should eventually call onSuccess with mock result
      await waitFor(
        () => {
          expect(mockOnSuccess).toHaveBeenCalled();
        },
        { timeout: 5000 }
      );
    });

    it('should show FractalSeed during processing', async () => {
      render(
        <OnboardPopover
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
          demoMode={true}
        />
      );

      const textarea = screen.getByLabelText(strings.onboard.textareaLabel);
      fireEvent.change(textarea, { target: { value: 'Test document' } });

      const submitButton = screen.getByRole('button', {
        name: strings.onboard.submitButton,
      });
      fireEvent.click(submitButton);

      // FractalSeed should appear during summarization step
      await waitFor(() => {
        const seed = document.querySelector('.onboard-seed');
        expect(seed).toBeInTheDocument();
      });
    });
  });

  describe('Example Selection', () => {
    it('should auto-fill textarea when example is selected', () => {
      render(
        <OnboardPopover
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const studentCard = screen.getByRole('listitem', {
        name: new RegExp(strings.examples.student.title, 'i'),
      });

      fireEvent.click(studentCard);

      const textarea = screen.getByLabelText(strings.onboard.textareaLabel);
      expect(textarea).toHaveValue(strings.examples.student.content);
    });
  });

  describe('Tone Selection', () => {
    it('should track selected tone', () => {
      render(
        <OnboardPopover
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const deepButton = screen.getByRole('radio', { name: /deep/i });
      fireEvent.click(deepButton);

      expect(deepButton).toHaveAttribute('aria-checked', 'true');
    });
  });

  describe('Error Handling', () => {
    it('should show error when submitting empty text', () => {
      render(
        <OnboardPopover
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const form = screen.getByRole('dialog').querySelector('form');
      fireEvent.submit(form);

      expect(
        screen.getByText(/Please enter some text to get started/i)
      ).toBeInTheDocument();
    });

    it('should show error when import fails', async () => {
      const mockFailingImport = jest
        .fn()
        .mockRejectedValue(new Error('Import failed'));

      render(
        <OnboardPopover
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
          demoMode={false}
          onImport={mockFailingImport}
        />
      );

      const textarea = screen.getByLabelText(strings.onboard.textareaLabel);
      fireEvent.change(textarea, { target: { value: 'Test document' } });

      const submitButton = screen.getByRole('button', {
        name: strings.onboard.submitButton,
      });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/Import failed/i)).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have dialog role and aria-modal', () => {
      render(
        <OnboardPopover
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
    });

    it('should have aria-labelledby referencing title', () => {
      render(
        <OnboardPopover
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-labelledby', 'onboard-title');

      const title = document.getElementById('onboard-title');
      expect(title).toHaveTextContent(strings.onboard.title);
    });

    it('should have aria-required on textarea', () => {
      render(
        <OnboardPopover
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const textarea = screen.getByLabelText(strings.onboard.textareaLabel);
      expect(textarea).toHaveAttribute('aria-required', 'true');
    });

    it('should have aria-describedby for privacy hint', () => {
      render(
        <OnboardPopover
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const textarea = screen.getByLabelText(strings.onboard.textareaLabel);
      expect(textarea).toHaveAttribute('aria-describedby', 'onboard-hint');

      const hint = document.getElementById('onboard-hint');
      expect(hint).toHaveTextContent(strings.onboard.privacyHint);
    });
  });
});
