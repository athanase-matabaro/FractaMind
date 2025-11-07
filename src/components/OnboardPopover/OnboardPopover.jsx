import { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import ToneSelector from '../ToneSelector/ToneSelector';
import ExamplesCarousel from '../ExamplesCarousel/ExamplesCarousel';
import FractalSeed from '../FractalSeed/FractalSeed';
// FORCE RELOAD - Timeout Fix v2.0 Active
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
  const [aiTimedOut, setAiTimedOut] = useState(false);
  // usedFallback tracks if user chose demo mode after timeout
  // eslint-disable-next-line no-unused-vars
  const [usedFallback, setUsedFallback] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [ariaLiveMessage, setAriaLiveMessage] = useState('');

  const textareaRef = useRef(null);
  const modalRef = useRef(null);
  const watchdogTimerRef = useRef(null);
  const isProcessingRef = useRef(false); // Track if we're still processing
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const elapsedTimerRef = useRef(null);

  /**
   * Component mount/unmount tracking - runs ONCE on mount, cleanup on unmount
   */
  useEffect(() => {
    const mountTime = Date.now();
    console.log('%c✅ ONBOARD POPOVER MOUNTED', 'background: green; color: white; padding: 4px; font-weight: bold', {
      mountTime: new Date(mountTime).toISOString(),
      demoMode,
      hasImportFn: !!onImport,
    });
    console.log('Features: Promise.race (28s) + Watchdog (30s) + DOM fallback + Visual timer');

    return () => {
      const unmountTime = Date.now();
      const lifetime = unmountTime - mountTime;
      console.log('%c❌ ONBOARD POPOVER UNMOUNTED', 'background: orange; color: white; padding: 4px; font-weight: bold', {
        lifetime: `${lifetime}ms`,
        unmountTime: new Date(unmountTime).toISOString(),
      });
    };
  }, [demoMode, onImport]);

  /**
   * Track re-renders during processing (DEBUG)
   */
  useEffect(() => {
    if (isSubmitting) {
      console.log('[OnboardPopover] Re-render during processing:', {
        isSubmitting,
        progress: progress.step,
        showSeed,
        secondsElapsed,
        aiTimedOut,
        hasError: !!error,
      });
    }
  }, [isSubmitting, progress.step, showSeed, secondsElapsed, aiTimedOut, error]);

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
   * Handle Escape key to close and Ctrl+Enter to submit
   */
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Escape to close
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        onClose();
      }

      // Ctrl+Enter (or Cmd+Enter on Mac) to submit
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && isOpen && !isSubmitting && text.trim()) {
        e.preventDefault();
        // Trigger form submission
        const form = document.querySelector('.onboard-form');
        if (form) {
          form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose, text]);

  /**
   * Cleanup all timers on unmount
   */
  useEffect(() => {
    return () => {
      if (watchdogTimerRef.current) {
        clearTimeout(watchdogTimerRef.current);
      }
      if (elapsedTimerRef.current) {
        clearInterval(elapsedTimerRef.current);
      }
    };
  }, []);

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
   * Handle retry after AI timeout
   */
  const handleRetry = async () => {
    setError(null);
    setAiTimedOut(false);
    setUsedFallback(false);
    // Trigger re-submission
    const fakeEvent = { preventDefault: () => {} };
    await handleSubmit(fakeEvent);
  };

  /**
   * Handle continuing with demo/fallback summary
   */
  const handleUseDemoSummary = async () => {
    setError(null);
    setAiTimedOut(false);
    setUsedFallback(true);
    setIsSubmitting(true);

    try {
      // Force mock mode for demo
      const result = await mockProcessing();
      setProgress({ step: 'complete', message: strings.processing.success });
      await sleep(800);

      if (onSuccess) {
        onSuccess(result);
      }
    } catch (err) {
      console.error('Demo summary failed:', err);
      setError('Demo summary failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
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
    setAiTimedOut(false);
    setSecondsElapsed(0);
    isProcessingRef.current = true; // Mark as processing

    // Announce to screen readers
    setAriaLiveMessage(strings.onboard.progressAnnouncement);

    const traceId = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
    console.info('[UI] submit -> import call', { traceId, mode: demoMode ? 'demo' : 'live' });

    // Start elapsed time counter (visual feedback for user)
    elapsedTimerRef.current = setInterval(() => {
      setSecondsElapsed(prev => prev + 1);
    }, 1000);

    // UI Watchdog: Maximum 30 seconds for entire operation
    // This is a LAST RESORT fallback if Promise.race somehow doesn't work
    console.log('[UI] Setting watchdog timer for 30s', { traceId });
    watchdogTimerRef.current = setTimeout(() => {
      console.log('[UI] Watchdog timer fired!', { traceId, isStillProcessing: isProcessingRef.current });
      if (isProcessingRef.current) {
        console.error('[UI] EMERGENCY WATCHDOG ACTIVATED - forcing stop', { traceId, maxMs: 30000 });
        isProcessingRef.current = false;
        setIsSubmitting(false);
        setAiTimedOut(true);
        setError('Processing took too long. You can retry or continue with a demo summary.');
        setShowSeed(false);

        // NUCLEAR OPTION: Force update the button text directly in DOM
        // This bypasses React state entirely in case setState is failing
        try {
          const submitButton = document.querySelector('button[type="submit"]');
          if (submitButton && submitButton.textContent === 'Processing...') {
            submitButton.textContent = 'Retry';
            submitButton.disabled = false;
            console.log('[UI] Forcibly updated button via DOM manipulation');
          }
        } catch (domError) {
          console.error('[UI] Failed to manipulate DOM:', domError);
        }
      } else {
        console.log('[UI] Watchdog fired but processing already complete');
      }
    }, 30000);

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

        if (typeof onImport !== 'function') {
          throw new Error(`onImport is not a function, got: ${typeof onImport}`);
        }

        // CRITICAL: Wrap import with Promise.race for hard timeout enforcement
        // This ensures we NEVER wait indefinitely for a hung import operation
        const importPromise = onImport(text, {
          tone: selectedTone,
          onProgress: (progressData) => {
            try {
              if (progressData && typeof progressData === 'object') {
                setProgress(progressData);
                if (progressData.step === 'summarizing' || progressData.step === 'embedding') {
                  setShowSeed(true);
                }
              } else {
                console.warn('[OnboardPopover] Invalid progress data:', progressData);
              }
            } catch (progressError) {
              console.error('[OnboardPopover] Error in onProgress callback:', progressError);
            }
          },
        });

        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => {
            console.error('[UI] Import Promise.race timeout fired at 28s');
            reject(new Error('Import operation timed out after 28 seconds'));
          }, 28000); // Fire at 28s, before UI watchdog at 30s
        });

        console.log('[UI] Racing import promise against 28s timeout');
        result = await Promise.race([importPromise, timeoutPromise]);
      }

      console.info('[UI] import returned', { traceId, ok: !!result });

      // Clear all timers on success
      isProcessingRef.current = false;
      if (watchdogTimerRef.current) {
        clearTimeout(watchdogTimerRef.current);
        watchdogTimerRef.current = null;
      }
      if (elapsedTimerRef.current) {
        clearInterval(elapsedTimerRef.current);
        elapsedTimerRef.current = null;
      }

      // Success!
      setProgress({ step: 'complete', message: strings.processing.success });
      setAriaLiveMessage(strings.onboard.successAnnouncement);
      await sleep(800);

      if (onSuccess) {
        onSuccess(result);
      }
    } catch (err) {
      console.error('Import failed:', err);
      console.warn('[UI] import fallback', { traceId, error: err.message });

      // Clear all timers on error
      isProcessingRef.current = false;
      if (watchdogTimerRef.current) {
        clearTimeout(watchdogTimerRef.current);
        watchdogTimerRef.current = null;
      }
      if (elapsedTimerRef.current) {
        clearInterval(elapsedTimerRef.current);
        elapsedTimerRef.current = null;
      }

      // Check if error is a timeout
      if (err.message && err.message.toLowerCase().includes('timed out')) {
        setAiTimedOut(true);
        setError('AI processing timed out. You can retry or continue with a demo summary.');
      } else {
        setError(err.message || strings.processing.error);
      }

      // Log fallback event
      console.warn('AI fallback used', {
        reason: err.message,
        mode: demoMode ? 'demo' : 'live',
        timestamp: new Date().toISOString()
      });

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
      className={`onboard-popover-backdrop ${isSubmitting ? 'onboard-backdrop-blurred' : ''}`}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboard-title"
    >
      {/* Aria-live region for screen reader announcements */}
      <div
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {ariaLiveMessage}
      </div>

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
          {/* Textarea with floating label */}
          <div className="onboard-input-wrapper">
            <label
              htmlFor="onboard-textarea"
              className={`onboard-label ${(isFocused || text) ? 'onboard-label-floating' : ''}`}
            >
              {strings.onboard.textareaLabel}
            </label>
            <textarea
              id="onboard-textarea"
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              className="onboard-textarea"
              placeholder={isFocused ? strings.onboard.textareaPlaceholder : ''}
              rows={10}
              disabled={isSubmitting}
              aria-required="true"
              aria-describedby="onboard-hint onboard-helper onboard-keyboard-hint"
            />

            {/* Helper chips */}
            {!text && !isSubmitting && (
              <div className="onboard-helper-chips">
                <span className="onboard-chip">Paste an article</span>
                <span className="onboard-chip">URL</span>
                <span className="onboard-chip">Notes</span>
              </div>
            )}
          </div>

          {/* Helper hint */}
          <p id="onboard-helper" className="onboard-hint">
            {strings.onboard.helperHint}
          </p>

          {/* Keyboard hint */}
          <p id="onboard-keyboard-hint" className="onboard-keyboard-hint">
            <kbd>Ctrl</kbd> + <kbd>Enter</kbd> to generate
          </p>

          {/* Privacy hint */}
          <p id="onboard-hint" className="onboard-privacy-hint">
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
              <p className="onboard-progress-message">
                {aiTimedOut ? 'AI timed out — Retry / Demo' : progress.message}
              </p>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="onboard-error" role="alert" aria-live="polite">
              <strong>Error:</strong> {error}
              {aiTimedOut && (
                <div className="onboard-error-actions">
                  <button
                    type="button"
                    className="onboard-button onboard-button-secondary"
                    onClick={handleRetry}
                    aria-label="Retry AI processing"
                  >
                    Retry
                  </button>
                  <button
                    type="button"
                    className="onboard-button onboard-button-primary"
                    onClick={handleUseDemoSummary}
                    aria-label="Continue with demo summary instead"
                  >
                    Continue with demo summary
                  </button>
                </div>
              )}
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
                ? `${strings.onboard.submittingButton} (${secondsElapsed}s)`
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
