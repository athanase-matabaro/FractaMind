import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ToneSelector from '../../../src/components/ToneSelector/ToneSelector';
import { strings } from '../../../src/i18n/strings';

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock;

describe('ToneSelector', () => {
  beforeEach(() => {
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
  });

  describe('Rendering', () => {
    it('should render all three tone options', () => {
      render(<ToneSelector />);

      expect(screen.getByText(strings.tone.concise)).toBeInTheDocument();
      expect(screen.getByText(strings.tone.deep)).toBeInTheDocument();
      expect(screen.getByText(strings.tone.creative)).toBeInTheDocument();
    });

    it('should render tone label', () => {
      render(<ToneSelector />);

      expect(screen.getByText(strings.tone.label)).toBeInTheDocument();
    });

    it('should render descriptions by default', () => {
      render(<ToneSelector />);

      expect(
        screen.getByText(strings.tone.description.concise)
      ).toBeInTheDocument();
      expect(screen.getByText(strings.tone.description.deep)).toBeInTheDocument();
      expect(
        screen.getByText(strings.tone.description.creative)
      ).toBeInTheDocument();
    });

    it('should hide descriptions when showDescription is false', () => {
      render(<ToneSelector showDescription={false} />);

      expect(
        screen.queryByText(strings.tone.description.concise)
      ).not.toBeInTheDocument();
    });
  });

  describe('Selection', () => {
    it('should select default tone (concise)', () => {
      render(<ToneSelector />);

      const conciseButton = screen.getByRole('radio', { name: /concise/i });
      expect(conciseButton).toHaveAttribute('aria-checked', 'true');
    });

    it('should use custom defaultTone', () => {
      render(<ToneSelector defaultTone="deep" />);

      const deepButton = screen.getByRole('radio', { name: /deep/i });
      expect(deepButton).toHaveAttribute('aria-checked', 'true');
    });

    it('should change selection on click', () => {
      render(<ToneSelector />);

      const deepButton = screen.getByRole('radio', { name: /deep/i });
      fireEvent.click(deepButton);

      expect(deepButton).toHaveAttribute('aria-checked', 'true');
    });

    it('should call onChange callback when tone changes', () => {
      const mockOnChange = jest.fn();
      render(<ToneSelector onChange={mockOnChange} />);

      const creativeButton = screen.getByRole('radio', { name: /creative/i });
      fireEvent.click(creativeButton);

      expect(mockOnChange).toHaveBeenCalledWith('creative');
    });
  });

  describe('Persistence', () => {
    it('should save selection to localStorage', () => {
      render(<ToneSelector />);

      const deepButton = screen.getByRole('radio', { name: /deep/i });
      fireEvent.click(deepButton);

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'fractamind:tone-preference',
        'deep'
      );
    });

    it('should load saved preference from localStorage', () => {
      localStorageMock.getItem.mockReturnValue('creative');

      render(<ToneSelector />);

      const creativeButton = screen.getByRole('radio', { name: /creative/i });
      expect(creativeButton).toHaveAttribute('aria-checked', 'true');
    });

    it('should emit custom event on tone change', () => {
      const mockListener = jest.fn();
      window.addEventListener('tone:changed', mockListener);

      render(<ToneSelector />);

      const deepButton = screen.getByRole('radio', { name: /deep/i });
      fireEvent.click(deepButton);

      expect(mockListener).toHaveBeenCalled();
      expect(mockListener.mock.calls[0][0].detail).toEqual({ tone: 'deep' });

      window.removeEventListener('tone:changed', mockListener);
    });
  });

  describe('Keyboard Navigation', () => {
    it('should navigate with arrow right key', () => {
      render(<ToneSelector />);

      const conciseButton = screen.getByRole('radio', { name: /concise/i });
      const deepButton = screen.getByRole('radio', { name: /deep/i });

      // Focus concise
      conciseButton.focus();

      // Press arrow right
      fireEvent.keyDown(conciseButton, { key: 'ArrowRight' });

      expect(deepButton).toHaveAttribute('aria-checked', 'true');
    });

    it('should navigate with arrow left key', () => {
      render(<ToneSelector defaultTone="deep" />);

      const conciseButton = screen.getByRole('radio', { name: /concise/i });
      const deepButton = screen.getByRole('radio', { name: /deep/i });

      // Focus deep
      deepButton.focus();

      // Press arrow left
      fireEvent.keyDown(deepButton, { key: 'ArrowLeft' });

      expect(conciseButton).toHaveAttribute('aria-checked', 'true');
    });

    it('should wrap around with arrow navigation', () => {
      render(<ToneSelector defaultTone="creative" />);

      const conciseButton = screen.getByRole('radio', { name: /concise/i });
      const creativeButton = screen.getByRole('radio', { name: /creative/i });

      // Focus creative (last)
      creativeButton.focus();

      // Press arrow right - should wrap to concise (first)
      fireEvent.keyDown(creativeButton, { key: 'ArrowRight' });

      expect(conciseButton).toHaveAttribute('aria-checked', 'true');
    });
  });

  describe('Accessibility', () => {
    it('should have radiogroup role', () => {
      render(<ToneSelector />);

      const radiogroup = screen.getByRole('radiogroup');
      expect(radiogroup).toBeInTheDocument();
    });

    it('should have proper ARIA labels', () => {
      render(<ToneSelector />);

      const conciseButton = screen.getByRole('radio', { name: /concise/i });
      expect(conciseButton).toHaveAccessibleName();
    });

    it('should manage tabIndex correctly', () => {
      render(<ToneSelector />);

      const conciseButton = screen.getByRole('radio', { name: /concise/i });
      const deepButton = screen.getByRole('radio', { name: /deep/i });
      const creativeButton = screen.getByRole('radio', { name: /creative/i });

      // Only selected button should have tabIndex 0
      expect(conciseButton).toHaveAttribute('tabIndex', '0');
      expect(deepButton).toHaveAttribute('tabIndex', '-1');
      expect(creativeButton).toHaveAttribute('tabIndex', '-1');
    });

    it('should announce selection change', () => {
      render(<ToneSelector />);

      const deepButton = screen.getByRole('radio', { name: /deep/i });
      fireEvent.click(deepButton);

      // Screen reader announcement
      expect(screen.getByText(/Selected tone: Deep/i)).toBeInTheDocument();
    });
  });
});
