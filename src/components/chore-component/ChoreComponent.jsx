import { useState } from 'react';
import './ChoreComponent.css';

/**
 * ChoreComponent - Initial onboarding/hero widget for FractaMind
 *
 * Provides a friendly entry point for users to paste text or URLs.
 * Opens a modal with a multi-line text input and emits seed text via callback.
 *
 * @param {Object} props
 * @param {Function} props.onSeedSubmit - Callback function called with submitted text
 * @param {boolean} props.autoShow - If true, modal opens on mount (default: false)
 * @param {Function} props.onSuccess - Callback when import succeeds (optional)
 * @param {Function} props.onOpenFractalView - Callback to navigate to fractal view (optional)
 * @param {boolean} props.hasImportedProject - Whether a project has been imported (optional)
 */
const ChoreComponent = ({ onSeedSubmit, autoShow = false, onSuccess, onOpenFractalView, hasImportedProject = false }) => {
  const [isModalOpen, setIsModalOpen] = useState(autoShow);
  const [seedText, setSeedText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progress, setProgress] = useState({ step: '', progress: 0, message: '' });
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleOpen = () => {
    setIsModalOpen(true);
    setError(null);
    setSuccess(false);
  };

  const handleClose = () => {
    setIsModalOpen(false);
    setSeedText('');
    setError(null);
    setSuccess(false);
    setProgress({ step: '', progress: 0, message: '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!seedText.trim()) {
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      // Call onSeedSubmit with progress callback
      const result = await onSeedSubmit(seedText.trim(), (progressData) => {
        setProgress(progressData);
      });

      setSuccess(true);
      setProgress({ step: 'complete', progress: 1.0, message: 'Import complete!' });

      // Call success callback if provided
      if (onSuccess) {
        onSuccess(result);
      }

      // Don't auto-close - let user click "Open Fractal View" button
      // setTimeout(() => {
      //   handleClose();
      // }, 1500);
    } catch (err) {
      console.error('Error submitting seed text:', err);
      setError(err.message || 'Import failed. Please try again.');
      setProgress({ step: 'error', progress: 0, message: '' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e) => {
    // Close modal on Escape key
    if (e.key === 'Escape') {
      handleClose();
    }
  };

  return (
    <div className="chore-component">
      {/* Hero/CTA Section */}
      {!isModalOpen && (
        <div className="chore-hero">
          <h1 className="chore-headline">
            Explore Ideas Like a Fractal
          </h1>
          <p className="chore-description">
            Turn any text into an interactive, zoomable map of knowledge. Privacy-first, AI-powered.
          </p>
          <button
            onClick={handleOpen}
            className="chore-cta-button"
            aria-label="Open text input to start exploring"
          >
            Paste Text or URL to Begin
          </button>
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div
          className="chore-modal-overlay"
          onClick={(e) => {
            // Close modal if clicking overlay (not modal content)
            if (e.target === e.currentTarget) {
              handleClose();
            }
          }}
          onKeyDown={handleKeyDown}
          role="dialog"
          aria-modal="true"
          aria-labelledby="chore-modal-title"
        >
          <div className="chore-modal-content">
            <button
              onClick={handleClose}
              className="chore-modal-close"
              aria-label="Close modal"
            >
              ×
            </button>

            <h2 id="chore-modal-title" className="chore-modal-title">
              Start Your Knowledge Fractal
            </h2>

            <form onSubmit={handleSubmit} className="chore-modal-form">
              <label htmlFor="seed-input" className="chore-label">
                Paste text, an article, or a URL to explore:
              </label>
              <textarea
                id="seed-input"
                value={seedText}
                onChange={(e) => setSeedText(e.target.value)}
                className="chore-textarea"
                placeholder="Paste your content here... (up to ~10,000 words)

Examples:
• Copy/paste an article or research paper
• Drop a URL to extract text
• Enter your notes or brainstorm ideas"
                rows={12}
                autoFocus
                disabled={isSubmitting}
                aria-required="true"
                aria-describedby="seed-input-hint"
              />
              <p id="seed-input-hint" className="chore-hint">
                All processing happens locally in your browser. Your data never leaves your device.
              </p>

              {/* Progress indicator */}
              {isSubmitting && progress.message && (
                <div className="chore-progress">
                  <div className="chore-progress-bar-container">
                    <div
                      className="chore-progress-bar"
                      style={{ width: `${progress.progress * 100}%` }}
                    />
                  </div>
                  <p className="chore-progress-message">{progress.message}</p>
                </div>
              )}

              {/* Success message */}
              {success && (
                <div className="chore-alert chore-alert-success">
                  <strong>Success!</strong> Your fractal is ready to explore.
                  {onOpenFractalView && (
                    <button
                      onClick={() => {
                        handleClose();
                        onOpenFractalView();
                      }}
                      style={{
                        display: 'block',
                        marginTop: '0.75rem',
                        padding: '0.5rem 1rem',
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        background: '#065f46',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                      }}
                    >
                      Open Fractal View →
                    </button>
                  )}
                </div>
              )}

              {/* Error message */}
              {error && (
                <div className="chore-alert chore-alert-error">
                  <strong>Error:</strong> {error}
                </div>
              )}

              <div className="chore-modal-actions">
                <button
                  type="button"
                  onClick={handleClose}
                  className="chore-button chore-button-secondary"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="chore-button chore-button-primary"
                  disabled={!seedText.trim() || isSubmitting}
                  aria-label="Submit text to generate fractal"
                >
                  {isSubmitting ? progress.message || 'Processing...' : 'Generate Fractal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChoreComponent;
