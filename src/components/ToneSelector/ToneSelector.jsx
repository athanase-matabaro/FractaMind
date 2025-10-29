import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { strings } from '../../i18n/strings';
import './ToneSelector.css';

/**
 * ToneSelector Component
 *
 * Allows users to select their preferred tone for AI-generated content.
 * Options: Concise, Deep, Creative
 *
 * Features:
 * - Persists preference in localStorage
 * - Emits custom event 'tone:changed' for other components
 * - Keyboard accessible with arrow key navigation
 * - Visual feedback for selected tone
 *
 * @param {Object} props
 * @param {string} props.defaultTone - Initial tone (default: 'concise')
 * @param {Function} props.onChange - Callback when tone changes
 * @param {boolean} props.showDescription - Show tone descriptions (default: true)
 */
const ToneSelector = ({
  defaultTone = 'concise',
  onChange,
  showDescription = true,
}) => {
  const STORAGE_KEY = 'fractamind:tone-preference';
  const tones = ['concise', 'deep', 'creative'];

  // Load saved preference or use default
  const [selectedTone, setSelectedTone] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved && tones.includes(saved) ? saved : defaultTone;
    }
    return defaultTone;
  });

  /**
   * Handle tone selection
   */
  const handleToneSelect = (tone) => {
    setSelectedTone(tone);

    // Persist to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, tone);

      // Emit custom event for other components
      const event = new CustomEvent('tone:changed', {
        detail: { tone },
      });
      window.dispatchEvent(event);
    }

    // Call onChange callback
    if (onChange) {
      onChange(tone);
    }
  };

  /**
   * Handle keyboard navigation (arrow keys)
   */
  const handleKeyDown = (e, currentTone) => {
    const currentIndex = tones.indexOf(currentTone);
    let newIndex = currentIndex;

    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      newIndex = (currentIndex + 1) % tones.length;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      newIndex = (currentIndex - 1 + tones.length) % tones.length;
    }

    if (newIndex !== currentIndex) {
      handleToneSelect(tones[newIndex]);
      // Focus the new button
      const newButton = document.querySelector(
        `.tone-button[data-tone="${tones[newIndex]}"]`
      );
      if (newButton) {
        newButton.focus();
      }
    }
  };

  /**
   * Get icon for each tone
   */
  const getToneIcon = (tone) => {
    const icons = {
      concise: (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M3 6h14M3 10h10M3 14h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      ),
      deep: (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M3 4h14M3 8h14M3 12h14M3 16h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      ),
      creative: (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M10 2l2.5 6.5L19 11l-6.5 2.5L10 20l-2.5-6.5L1 11l6.5-2.5L10 2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        </svg>
      ),
    };
    return icons[tone];
  };

  return (
    <div className="tone-selector" role="group" aria-labelledby="tone-selector-label">
      <label id="tone-selector-label" className="tone-selector-label">
        {strings.tone.label}
      </label>

      <div className="tone-buttons" role="radiogroup" aria-labelledby="tone-selector-label">
        {tones.map((tone) => {
          const isSelected = tone === selectedTone;
          const label = strings.tone[tone];
          const description = strings.tone.description[tone];

          return (
            <button
              key={tone}
              type="button"
              data-tone={tone}
              className={`tone-button ${isSelected ? 'tone-button-selected' : ''}`}
              onClick={() => handleToneSelect(tone)}
              onKeyDown={(e) => handleKeyDown(e, tone)}
              role="radio"
              aria-checked={isSelected}
              aria-label={`${label}: ${description}`}
              tabIndex={isSelected ? 0 : -1}
            >
              <span className="tone-button-icon" aria-hidden="true">
                {getToneIcon(tone)}
              </span>
              <span className="tone-button-label">{label}</span>
              {showDescription && (
                <span className="tone-button-description">{description}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Current selection announcement for screen readers */}
      <div className="sr-only" role="status" aria-live="polite">
        {`Selected tone: ${strings.tone[selectedTone]}`}
      </div>
    </div>
  );
};

ToneSelector.propTypes = {
  defaultTone: PropTypes.oneOf(['concise', 'deep', 'creative']),
  onChange: PropTypes.func,
  showDescription: PropTypes.bool,
};

export default ToneSelector;
