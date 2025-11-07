import { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import FractalSeed from '../FractalSeed/FractalSeed';
import SeedFractal from './SeedFractal';
import OnboardPopover from '../OnboardPopover/OnboardPopover';
import { handleSeedSubmit } from '../../core/importer';
import { recordInteraction } from '../../core/memory';
import { strings } from '../../i18n/strings';
import './Hero.css';

/**
 * Hero Component (v1.2 - Cinematic Fractal Theme)
 *
 * Full-screen cinematic hero with starfield background and centered composition.
 * Features:
 * - Cinematic starfield background (#030416 → #081024 gradient)
 * - Beta badge in top-left corner
 * - Centered large fractal (600px) with teal-to-violet glow
 * - 6s continuous growth loop animation
 * - Glass morphism surfaces
 * - Headline: "Make recursive art. Animate it. Export it." (48px Inter semi-bold)
 * - Centered content layout (fractal above, text below)
 * - Primary CTA opens OnboardPopover for project creation
 * - Secondary CTA triggers demo mode
 * - Fully accessible with reduced motion support
 * - Responsive breakpoints for tablet and mobile
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
   * Memoized to prevent OnboardPopover from remounting on every Hero render
   */
  const handlePopoverClose = useCallback(() => {
    setIsPopoverOpen(false);
  }, []);

  /**
   * Handle import - call the actual import pipeline
   * Memoized to prevent OnboardPopover from remounting on every Hero render
   */
  const handleImport = useCallback(async (seedText, options = {}) => {
    console.log('Hero: Starting import with seed text...', { options });

    const result = await handleSeedSubmit(
      seedText,
      {
        name: 'Imported Document',
        sourceUrl: null,
      },
      options.onProgress || null
    );

    console.log('Hero: Import complete:', {
      projectId: result.project.id,
      nodeCount: result.nodes.length,
      rootNode: result.rootNode.title,
    });

    // Record import interaction
    await recordInteraction({
      nodeId: result.rootNode.id,
      actionType: 'import',
      meta: {
        source: 'text-paste',
        nodeCount: result.nodes.length,
        projectName: result.project.name,
      },
    }).catch(err => console.error('Failed to record import interaction:', err));

    return result;
  }, []);

  /**
   * Handle successful import from popover
   * Memoized to prevent OnboardPopover from remounting on every Hero render
   */
  const handleImportSuccess = useCallback((result) => {
    setIsPopoverOpen(false);
    if (onStartImport) {
      onStartImport(result);
    }
  }, [onStartImport]);

  return (
    <section
      className={`hero ${isLoaded ? 'hero-loaded' : ''}`}
      role="banner"
      aria-labelledby="hero-title"
    >
      {/* Cinematic starfield background */}
      <div className="hero-background" aria-hidden="true">
        <SeedFractal opacity={0.08} />
      </div>

      {/* Beta badge - top left */}
      <div className="hero-beta-badge" aria-label="Beta version">
        {strings.hero.betaBadge}
      </div>

      <div className="hero-container">
        {/* Visual (centered, order 1) - Large FractalSeed with cinematic glow */}
        <div className="hero-visual" aria-hidden="true">
          <div className="hero-seed-wrapper">
            <FractalSeed
              key={seedKey}
              size={600}
              color="#ffffff"
              animationDelay={200}
              autoPlay={true}
            />
          </div>
        </div>

        {/* Content (centered, order 2) */}
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
      </div>

      {/* Onboarding Popover */}
      {isPopoverOpen && (
        <OnboardPopover
          isOpen={isPopoverOpen}
          onClose={handlePopoverClose}
          onSuccess={handleImportSuccess}
          onImport={handleImport}
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
