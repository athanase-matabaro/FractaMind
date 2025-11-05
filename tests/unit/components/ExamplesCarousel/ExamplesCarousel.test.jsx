import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ExamplesCarousel from '../../../../src/components/ExamplesCarousel/ExamplesCarousel';
import { strings } from '../../../../src/i18n/strings';

describe('ExamplesCarousel', () => {
  const mockOnExampleSelect = jest.fn();

  beforeEach(() => {
    mockOnExampleSelect.mockClear();
  });

  describe('Rendering', () => {
    it('should render title and subtitle', () => {
      render(<ExamplesCarousel onExampleSelect={mockOnExampleSelect} />);

      expect(screen.getByText(strings.examples.title)).toBeInTheDocument();
      expect(screen.getByText(strings.examples.subtitle)).toBeInTheDocument();
    });

    it('should render all three example cards', () => {
      render(<ExamplesCarousel onExampleSelect={mockOnExampleSelect} />);

      expect(
        screen.getByText(strings.examples.student.title)
      ).toBeInTheDocument();
      expect(
        screen.getByText(strings.examples.founder.title)
      ).toBeInTheDocument();
      expect(
        screen.getByText(strings.examples.journalist.title)
      ).toBeInTheDocument();
    });

    it('should render descriptions for each example', () => {
      render(<ExamplesCarousel onExampleSelect={mockOnExampleSelect} />);

      expect(
        screen.getByText(strings.examples.student.description)
      ).toBeInTheDocument();
      expect(
        screen.getByText(strings.examples.founder.description)
      ).toBeInTheDocument();
      expect(
        screen.getByText(strings.examples.journalist.description)
      ).toBeInTheDocument();
    });

    it('should render icons for each example', () => {
      render(<ExamplesCarousel onExampleSelect={mockOnExampleSelect} />);

      expect(screen.getByText('📚')).toBeInTheDocument(); // Student
      expect(screen.getByText('🚀')).toBeInTheDocument(); // Founder
      expect(screen.getByText('📰')).toBeInTheDocument(); // Journalist
    });
  });

  describe('Selection', () => {
    it('should call onExampleSelect when card is clicked', () => {
      render(<ExamplesCarousel onExampleSelect={mockOnExampleSelect} />);

      const studentCard = screen.getByRole('listitem', {
        name: new RegExp(strings.examples.student.title, 'i'),
      });

      fireEvent.click(studentCard);

      expect(mockOnExampleSelect).toHaveBeenCalledTimes(1);
      expect(mockOnExampleSelect).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'student',
          title: strings.examples.student.title,
          description: strings.examples.student.description,
          content: strings.examples.student.content,
          icon: '📚',
        })
      );
    });

    it('should select different examples', () => {
      render(<ExamplesCarousel onExampleSelect={mockOnExampleSelect} />);

      const founderCard = screen.getByRole('listitem', {
        name: new RegExp(strings.examples.founder.title, 'i'),
      });

      fireEvent.click(founderCard);

      expect(mockOnExampleSelect).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'founder',
          title: strings.examples.founder.title,
        })
      );
    });

    it('should add selected class to clicked card', () => {
      render(<ExamplesCarousel onExampleSelect={mockOnExampleSelect} />);

      const journalistCard = screen.getByRole('listitem', {
        name: new RegExp(strings.examples.journalist.title, 'i'),
      });

      fireEvent.click(journalistCard);

      expect(journalistCard).toHaveClass('example-card-selected');
    });

    it('should only have one selected card at a time', () => {
      render(<ExamplesCarousel onExampleSelect={mockOnExampleSelect} />);

      const studentCard = screen.getByRole('listitem', {
        name: new RegExp(strings.examples.student.title, 'i'),
      });
      const founderCard = screen.getByRole('listitem', {
        name: new RegExp(strings.examples.founder.title, 'i'),
      });

      // Click student
      fireEvent.click(studentCard);
      expect(studentCard).toHaveClass('example-card-selected');

      // Click founder
      fireEvent.click(founderCard);
      expect(founderCard).toHaveClass('example-card-selected');
      expect(studentCard).not.toHaveClass('example-card-selected');
    });
  });

  describe('Keyboard Navigation', () => {
    it('should select example on Enter key', () => {
      render(<ExamplesCarousel onExampleSelect={mockOnExampleSelect} />);

      const studentCard = screen.getByRole('listitem', {
        name: new RegExp(strings.examples.student.title, 'i'),
      });

      fireEvent.keyDown(studentCard, { key: 'Enter' });

      expect(mockOnExampleSelect).toHaveBeenCalledTimes(1);
    });

    it('should select example on Space key', () => {
      render(<ExamplesCarousel onExampleSelect={mockOnExampleSelect} />);

      const founderCard = screen.getByRole('listitem', {
        name: new RegExp(strings.examples.founder.title, 'i'),
      });

      fireEvent.keyDown(founderCard, { key: ' ' });

      expect(mockOnExampleSelect).toHaveBeenCalledTimes(1);
    });

    it('should be focusable with tabIndex', () => {
      render(<ExamplesCarousel onExampleSelect={mockOnExampleSelect} />);

      const cards = screen.getAllByRole('listitem');
      cards.forEach((card) => {
        expect(card).toHaveAttribute('tabIndex', '0');
      });
    });
  });

  describe('Accessibility', () => {
    it('should have region role with labelledby', () => {
      render(<ExamplesCarousel onExampleSelect={mockOnExampleSelect} />);

      const region = screen.getByRole('region');
      expect(region).toHaveAttribute('aria-labelledby', 'examples-title');
    });

    it('should have list role for grid', () => {
      render(<ExamplesCarousel onExampleSelect={mockOnExampleSelect} />);

      const list = screen.getByRole('list');
      expect(list).toBeInTheDocument();
    });

    it('should have listitem role for each card', () => {
      render(<ExamplesCarousel onExampleSelect={mockOnExampleSelect} />);

      const items = screen.getAllByRole('listitem');
      expect(items).toHaveLength(3);
    });

    it('should have accessible names for cards', () => {
      render(<ExamplesCarousel onExampleSelect={mockOnExampleSelect} />);

      const studentCard = screen.getByRole('listitem', {
        name: `${strings.examples.student.title}: ${strings.examples.student.description}`,
      });
      expect(studentCard).toBeInTheDocument();
    });

    it('should announce selection to screen readers', () => {
      render(<ExamplesCarousel onExampleSelect={mockOnExampleSelect} />);

      const studentCard = screen.getByRole('listitem', {
        name: new RegExp(strings.examples.student.title, 'i'),
      });

      fireEvent.click(studentCard);

      // Screen reader announcement
      const announcement = screen.getByRole('status');
      expect(announcement).toHaveTextContent(
        `Selected example: ${strings.examples.student.title}`
      );
    });
  });

  describe('Content', () => {
    it('should provide full content for each example', () => {
      render(<ExamplesCarousel onExampleSelect={mockOnExampleSelect} />);

      const studentCard = screen.getByRole('listitem', {
        name: new RegExp(strings.examples.student.title, 'i'),
      });

      fireEvent.click(studentCard);

      const callArg = mockOnExampleSelect.mock.calls[0][0];
      expect(callArg.content).toBe(strings.examples.student.content);
      expect(callArg.content.length).toBeGreaterThan(100); // Ensure substantial content
    });
  });
});
