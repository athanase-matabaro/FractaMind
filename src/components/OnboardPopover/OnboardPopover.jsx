import { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import ToneSelector from '../ToneSelector/ToneSelector';
import ExamplesCarousel from '../ExamplesCarousel/ExamplesCarousel';
import FractalSeed from '../FractalSeed/FractalSeed';
import { strings } from '../../i18n/strings';
import './OnboardPopover.css';

/**
 * OnboardPopover Component
 *
 * Modal popover for onboarding users through the import process.
 * Features:
 * - Textarea for pasting content
 * - Examples carousel for quick starts
 * - Tone selector for personalization
 * - Demo mode for mock processing
 * - Real import integration
 * - Animated feedback with FractalSeed
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Control popover visibility
 * @param {Function} props.onClose - Callback when popover is closed
 * @param {Function} props.onSuccess - Callback when import succeeds
 * @param {boolean} props.demoMode - Use mock processing (default: true)
 * @param {Function} props.onImport - Real import function (required if not demoMode)
 */
const OnboardPopover = ({
  isOpen,
  onClose,
  onSuccess,
  demoMode = true,
  onImport,
}) => {
  const [text, setText] = useState('');
  const [selectedTone, setSelectedTone] = useState('concise');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSeed, setShowSeed] = useState(false);
  const [progress, setProgress] = useState({ message: '', step: '' });
  const [error, setError] = useState(null);

  const textareaRef = useRef(null);
  const modalRef = useRef(null);

  /**
   * Focus textarea when popover opens
   */
  useEffect(() => {
    if (isOpen && textareaRef.current) {
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
        }
      }, 100);
    }
  }, [isOpen]);

  /**
   * Handle Escape key to close
   */
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, isSubmitting, onClose]);

  /**
   * Handle example selection from carousel
   */
  const handleExampleSelect = (example) => {
    setText(example.content);
    // Scroll to textarea
    if (textareaRef.current) {
      // scrollIntoView might not be available in test environment
      if (typeof textareaRef.current.scrollIntoView === 'function') {
        textareaRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      textareaRef.current.focus();
    }
  };

  /**
   * Handle tone change
   */
  const handleToneChange = (tone) => {
    setSelectedTone(tone);
  };

  /**
   * Mock processing for demo mode
   */
  const mockProcessing = async () => {
    // Step 1: Analyzing
    setProgress({ step: 'analyzing', message: strings.processing.analyzing });
    await sleep(800);

    // Step 2: Summarizing
    setProgress({ step: 'summarizing', message: strings.processing.summarizing });
    setShowSeed(true);
    await sleep(1200);

    // Step 3: Embedding
    setProgress({ step: 'embedding', message: strings.processing.embedding });
    await sleep(1000);

    // Step 4: Complete
    setProgress({ step: 'complete', message: strings.processing.complete });
    await sleep(500);

    // Return mock result
    return {
      project: {
        id: 'demo-project-' + Date.now(),
        name: 'Demo Project',
        nodeCount: 7,
      },
      rootNode: {
        id: 'demo-root',
        title: 'Demo Fractal',
        text: text.slice(0, 200),
      },
      nodes: Array.from({ length: 6 }, (_, i) => ({
        id: `demo-node-${i}`,
        title: `Idea ${i + 1}`,
        text: `This is idea ${i + 1} from your document.`,
      })),
    };
  };

  /**
   * Handle form submission
   */
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!text.trim()) {
      setError('Please enter some text to get started.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setShowSeed(false);

    try {
      let result;

      if (demoMode) {
        // Use mock processing
        result = await mockProcessing();
      } else {
        // Use real import function
        if (!onImport) {
          throw new Error('Import function not provided');
        }

        result = await onImport(text, {
          tone: selectedTone,
          onProgress: (progressData) => {
            setProgress(progressData);
            if (progressData.step === 'summarizing' || progressData.step === 'embedding') {
              setShowSeed(true);
            }
          },
        });
      }

      // Success!
      setProgress({ step: 'complete', message: strings.processing.success });
      await sleep(800);

      if (onSuccess) {
        onSuccess(result);
      }
    } catch (err) {
      console.error('Import failed:', err);
      setError(err.message || strings.processing.error);
      setShowSeed(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Handle backdrop click to close
   */
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget && !isSubmitting) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="onboard-popover-backdrop"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboard-title"
    >
      <div className="onboard-popover" ref={modalRef}>
        {/* Close button */}
        <button
          className="onboard-close"
          onClick={onClose}
          disabled={isSubmitting}
          aria-label="Close onboarding dialog"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>

        {/* Title */}
        <h2 id="onboard-title" className="onboard-title">
          {strings.onboard.title}
        </h2>

        {/* Examples carousel (before form) */}
        <ExamplesCarousel onExampleSelect={handleExampleSelect} />

        {/* Form */}
        <form onSubmit={handleSubmit} className="onboard-form">
          {/* Textarea */}
          <label htmlFor="onboard-textarea" className="onboard-label">
            {strings.onboard.textareaLabel}
          </label>
          <textarea
            id="onboard-textarea"
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="onboard-textarea"
            placeholder={strings.onboard.textareaPlaceholder}
            rows={10}
            disabled={isSubmitting}
            aria-required="true"
            aria-describedby="onboard-hint"
          />

          {/* Privacy hint */}
          <p id="onboard-hint" className="onboard-hint">
            {strings.onboard.privacyHint}
          </p>

          {/* Tone selector */}
          <ToneSelector
            defaultTone={selectedTone}
            onChange={handleToneChange}
            showDescription={false}
          />

          {/* Progress indicator with FractalSeed */}
          {isSubmitting && (
            <div className="onboard-progress" role="status" aria-live="polite">
              {showSeed && (
                <div className="onboard-seed">
                  <FractalSeed size={120} color="#667eea" autoPlay={true} />
                </div>
              )}
              <p className="onboard-progress-message">{progress.message}</p>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="onboard-error" role="alert">
              <strong>Error:</strong> {error}
            </div>
          )}

          {/* Actions */}
          <div className="onboard-actions">
            <button
              type="button"
              className="onboard-button onboard-button-secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              {strings.actions.cancel}
            </button>
            <button
              type="submit"
              className="onboard-button onboard-button-primary"
              disabled={!text.trim() || isSubmitting}
            >
              {isSubmitting
                ? strings.onboard.submittingButton
                : strings.onboard.submitButton}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/**
 * Helper: sleep
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

OnboardPopover.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSuccess: PropTypes.func,
  demoMode: PropTypes.bool,
  onImport: PropTypes.func,
};

export default OnboardPopover;
