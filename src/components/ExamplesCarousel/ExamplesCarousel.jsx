import { useState } from 'react';
import PropTypes from 'prop-types';
import { strings } from '../../i18n/strings';
import './ExamplesCarousel.css';

/**
 * ExamplesCarousel Component
 *
 * Displays example quick-pastes for different user personas.
 * Options: Student, Founder, Journalist
 *
 * Features:
 * - Card-based layout with hover effects
 * - Click to auto-fill content
 * - Keyboard accessible (arrow keys + Enter)
 * - Responsive grid
 *
 * @param {Object} props
 * @param {Function} props.onExampleSelect - Callback when example is selected (receives example object)
 */
const ExamplesCarousel = ({ onExampleSelect }) => {
  const [selectedId, setSelectedId] = useState(null);

  // Example data from strings
  const examples = [
    {
      id: 'student',
      title: strings.examples.student.title,
      description: strings.examples.student.description,
      content: strings.examples.student.content,
      icon: '📚',
    },
    {
      id: 'founder',
      title: strings.examples.founder.title,
      description: strings.examples.founder.description,
      content: strings.examples.founder.content,
      icon: '🚀',
    },
    {
      id: 'journalist',
      title: strings.examples.journalist.title,
      description: strings.examples.journalist.description,
      content: strings.examples.journalist.content,
      icon: '📰',
    },
  ];

  /**
   * Handle example selection
   */
  const handleExampleClick = (example) => {
    setSelectedId(example.id);
    if (onExampleSelect) {
      onExampleSelect(example);
    }
  };

  /**
   * Handle keyboard navigation
   */
  const handleKeyDown = (e, example) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleExampleClick(example);
    }
  };

  return (
    <div className="examples-carousel" role="region" aria-labelledby="examples-title">
      <h3 id="examples-title" className="examples-title">
        {strings.examples.title}
      </h3>
      <p className="examples-subtitle">{strings.examples.subtitle}</p>

      <div className="examples-grid" role="list">
        {examples.map((example) => {
          const isSelected = example.id === selectedId;

          return (
            <div
              key={example.id}
              className={`example-card ${isSelected ? 'example-card-selected' : ''}`}
              onClick={() => handleExampleClick(example)}
              onKeyDown={(e) => handleKeyDown(e, example)}
              role="listitem"
              tabIndex={0}
              aria-label={`${example.title}: ${example.description}`}
            >
              <div className="example-card-icon" aria-hidden="true">
                {example.icon}
              </div>
              <div className="example-card-content">
                <h4 className="example-card-title">{example.title}</h4>
                <p className="example-card-description">{example.description}</p>
              </div>
              <div className="example-card-badge" aria-hidden="true">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M6 12l6-6-6-6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected announcement for screen readers */}
      {selectedId && (
        <div className="sr-only" role="status" aria-live="polite">
          {`Selected example: ${examples.find((e) => e.id === selectedId)?.title}`}
        </div>
      )}
    </div>
  );
};

ExamplesCarousel.propTypes = {
  onExampleSelect: PropTypes.func.isRequired,
};

export default ExamplesCarousel;
