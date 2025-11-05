import { useState, useRef, useEffect } from 'react';
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
  // 🔴 TIMEOUT FIX LOADED
  console.log('%c🔴 CHORE COMPONENT LOADED - TIMEOUT FIX v2.0', 'background: red; color: white; padding: 4px; font-weight: bold');

  const [isModalOpen, setIsModalOpen] = useState(autoShow);
  const [seedText, setSeedText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progress, setProgress] = useState({ step: '', progress: 0, message: '' });
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [forceMockMode, setForceMockMode] = useState(false);

  const watchdogTimerRef = useRef(null);
  const elapsedTimerRef = useRef(null);
  const isProcessingRef = useRef(false);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (watchdogTimerRef.current) clearTimeout(watchdogTimerRef.current);
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    };
  }, []);

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
    setSecondsElapsed(0);
    setForceMockMode(false);
    isProcessingRef.current = false;
    if (watchdogTimerRef.current) clearTimeout(watchdogTimerRef.current);
    if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    // Clear force mock mode flag
    sessionStorage.removeItem('FORCE_MOCK_MODE');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!seedText.trim()) {
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(false);
    setSecondsElapsed(0);
    isProcessingRef.current = true;

    const traceId = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);

    // Check if mock mode is forced (set by recovery button)
    const isForcedMock = sessionStorage.getItem('FORCE_MOCK_MODE') === 'true';
    console.log('🔴 [CHORE] Starting import with timeout protection', { traceId, forceMockMode, isForcedMock });

    // Start elapsed timer (visual feedback)
    elapsedTimerRef.current = setInterval(() => {
      setSecondsElapsed(prev => prev + 1);
    }, 1000);

    // Watchdog timer (emergency fallback - reads from environment)
    // CORRECTED: Use VITE_AI_TIMEOUT_MS from .env (default 120s for debugging)
    const watchdogTimeoutMs = Number(import.meta.env.VITE_AI_TIMEOUT_MS || 120000);
    watchdogTimerRef.current = setTimeout(() => {
      if (isProcessingRef.current) {
        console.error(`🔴 [CHORE] EMERGENCY WATCHDOG FIRED at ${watchdogTimeoutMs}ms`, { traceId });
        isProcessingRef.current = false;
        setIsSubmitting(false);
        setError(`Processing took too long (${watchdogTimeoutMs/1000}s). Please try again or use a shorter text.`);
        if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
      }
    }, watchdogTimeoutMs);

    try {
      // Promise.race timeout (slightly less than watchdog to fire first)
      // CORRECTED: Use VITE_AI_TIMEOUT_MS - 2s buffer
      const raceTimeoutMs = watchdogTimeoutMs - 2000;
      const importPromise = onSeedSubmit(seedText.trim(), (progressData) => {
        setProgress(progressData);
      });

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          console.error(`🔴 [CHORE] Promise.race timeout at ${raceTimeoutMs}ms`, { traceId });
          reject(new Error(`Operation timed out after ${raceTimeoutMs/1000} seconds`));
        }, raceTimeoutMs);
      });

      console.log(`🔴 [CHORE] Racing import vs ${raceTimeoutMs}ms timeout`, { traceId });
      const result = await Promise.race([importPromise, timeoutPromise]);

      console.log('🔴 [CHORE] Import succeeded', { traceId });
      isProcessingRef.current = false;
      if (watchdogTimerRef.current) clearTimeout(watchdogTimerRef.current);
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);

      // Clear force mock mode flag on success (to avoid affecting next import)
      if (sessionStorage.getItem('FORCE_MOCK_MODE') === 'true') {
        console.log('🔴 [CHORE] Clearing mock mode flag after success');
        sessionStorage.removeItem('FORCE_MOCK_MODE');
      }
      setForceMockMode(false);

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
      console.error('🔴 [CHORE] Import failed', { traceId, error: err.message });
      isProcessingRef.current = false;
      if (watchdogTimerRef.current) clearTimeout(watchdogTimerRef.current);
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);

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

              {/* AI status indicators */}
              {progress.step === 'ai-ready' && (
                <div className="chore-alert chore-alert-success">
                  {progress.message}
                </div>
              )}

              {progress.step === 'warning' && (
                <div className="chore-alert chore-alert-warning">
                  <strong>Note:</strong> {progress.message}
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

              {/* Error message with recovery options */}
              {error && (
                <div className="chore-alert chore-alert-error">
                  <strong>Error:</strong> {error}

                  {error.includes('timed out') && (
                    <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button
                        onClick={async (e) => {
                          try {
                            console.log('🟡 [BUTTON] Mock Mode button clicked!');
                            e.stopPropagation();

                            // Set sessionStorage flag IMMEDIATELY
                            sessionStorage.setItem('FORCE_MOCK_MODE', 'true');
                            console.log('🟡 [BUTTON] sessionStorage set to:', sessionStorage.getItem('FORCE_MOCK_MODE'));

                            setForceMockMode(true);
                            console.log('🟡 [BUTTON] React state setForceMockMode(true) called');

                            // Clear error and trigger import
                            setError(null);
                            console.log('🟡 [BUTTON] Error cleared, calling handleSubmit in 50ms...');

                            setTimeout(async () => {
                              try {
                                console.log('🟡 [BUTTON] Timeout fired, executing handleSubmit');

                                if (!seedText.trim()) {
                                  console.error('🔴 [BUTTON] ERROR: No text to submit!');
                                  return;
                                }

                                console.log('🟡 [BUTTON] seedText exists, length:', seedText.length);

                                // Create fake event
                                const fakeEvent = { preventDefault: () => {} };
                                console.log('🟡 [BUTTON] Calling handleSubmit now...');

                                await handleSubmit(fakeEvent);

                                console.log('🟡 [BUTTON] handleSubmit completed');
                              } catch (err) {
                                console.error('🔴 [BUTTON] ERROR in setTimeout:', err);
                              }
                            }, 50);
                          } catch (err) {
                            console.error('🔴 [BUTTON] ERROR in onClick:', err);
                          }
                        }}
                        style={{
                          padding: '0.5rem 1rem',
                          fontSize: '0.875rem',
                          fontWeight: 600,
                          background: '#f59e0b',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                        }}
                      >
                        Use Mock Mode (Fast)
                      </button>
                      <button
                        onClick={() => {
                          setError(null);
                          setForceMockMode(false);
                          console.log('🔴 User requested retry with live AI');
                        }}
                        style={{
                          padding: '0.5rem 1rem',
                          fontSize: '0.875rem',
                          fontWeight: 600,
                          background: '#667eea',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                        }}
                      >
                        Retry with AI
                      </button>
                    </div>
                  )}
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
                  {isSubmitting ? `Processing... (${secondsElapsed}s)` : 'Generate Fractal'}
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
