import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import FractalSeed from '../FractalSeed/FractalSeed';
import SeedFractal from './SeedFractal';
import OnboardPopover from '../OnboardPopover/OnboardPopover';
import { strings } from '../../i18n/strings';
import './Hero.css';

/**
 * Hero Component
 *
 * Full-bleed hero section for FractaMind homepage.
 * Features:
 * - Twilight gradient background
 * - Left: Headline + subhead + CTAs + privacy badge
 * - Right: Animated FractalSeed preview
 * - Primary CTA opens OnboardPopover for micro-commit
 * - Secondary CTA plays demo with mock pipeline
 * - Fully accessible and responsive
 *
 * @param {Object} props
 * @param {Function} props.onStartImport - Callback when user completes onboarding
 * @param {Function} props.onDemoStart - Callback when demo is requested
 * @param {boolean} props.demoMode - Enable demo mode with mock data (default: true)
 */
const Hero = ({ onStartImport, onDemoStart, demoMode = true }) => {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [seedKey, setSeedKey] = useState(0); // Key to restart animation
  const [isLoaded, setIsLoaded] = useState(false); // For fade-in animation

  // Trigger fade-in animation on mount
  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 100);
    return () => clearTimeout(timer);
  }, []);

  /**
   * Handle primary CTA click - open onboarding popover
   */
  const handlePrimaryCTA = () => {
    setIsPopoverOpen(true);
    // Restart seed animation
    setSeedKey((prev) => prev + 1);
  };

  /**
   * Handle secondary CTA click - start demo
   */
  const handleSecondaryCTA = () => {
    if (onDemoStart) {
      onDemoStart();
    }
    // Also open popover with demo content pre-filled
    setIsPopoverOpen(true);
  };

  /**
   * Handle popover close
   */
  const handlePopoverClose = () => {
    setIsPopoverOpen(false);
  };

  /**
   * Handle successful import from popover
   */
  const handleImportSuccess = (result) => {
    setIsPopoverOpen(false);
    if (onStartImport) {
      onStartImport(result);
    }
  };

  return (
    <section
      className={`hero ${isLoaded ? 'hero-loaded' : ''}`}
      role="banner"
      aria-labelledby="hero-title"
    >
      {/* Background gradient with animated fractal */}
      <div className="hero-background" aria-hidden="true">
        <SeedFractal opacity={0.12} />
      </div>

      <div className="hero-container">
        {/* Content (left side) */}
        <div className="hero-content">
          <h1 id="hero-title" className="hero-title">
            {strings.hero.title}
          </h1>

          <p className="hero-subtitle">
            {strings.hero.subtitle}
          </p>

          {/* CTAs */}
          <div className="hero-actions">
            <button
              className="hero-cta hero-cta-primary"
              onClick={handlePrimaryCTA}
              aria-label={strings.hero.ctaPrimary}
            >
              {strings.hero.ctaPrimary}
            </button>

            <button
              className="hero-cta hero-cta-secondary"
              onClick={handleSecondaryCTA}
              aria-label={strings.hero.ctaSecondary}
            >
              {strings.hero.ctaSecondary}
            </button>
          </div>

          {/* Privacy badge */}
          <div className="hero-privacy-badge" role="note">
            <svg
              className="hero-privacy-icon"
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M8 1L3 3V7C3 10.5 5.5 13.5 8 14.5C10.5 13.5 13 10.5 13 7V3L8 1Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
              <path
                d="M6 8L7.5 9.5L10 6.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="hero-privacy-text" aria-label={strings.hero.privacyBadgeAria}>
              {strings.hero.privacyBadge}
            </span>
          </div>
        </div>

        {/* Visual (right side) - FractalSeed animation */}
        <div className="hero-visual" aria-hidden="true">
          <div className="hero-seed-wrapper">
            <FractalSeed
              key={seedKey}
              size={280}
              color="#ffffff"
              animationDelay={300}
              autoPlay={true}
            />
          </div>
        </div>
      </div>

      {/* Onboarding Popover */}
      {isPopoverOpen && (
        <OnboardPopover
          isOpen={isPopoverOpen}
          onClose={handlePopoverClose}
          onSuccess={handleImportSuccess}
          demoMode={demoMode}
        />
      )}
    </section>
  );
};

Hero.propTypes = {
  onStartImport: PropTypes.func,
  onDemoStart: PropTypes.func,
  demoMode: PropTypes.bool,
};

export default Hero;
