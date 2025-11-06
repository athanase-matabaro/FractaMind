/**
 * FractalPattern - Decorative Fractal Background Element (v1.2)
 *
 * SVG-based fractal pattern for subtle decoration throughout the UI.
 * Use cases:
 * - Panel backgrounds
 * - Card decorations
 * - Empty state illustrations
 * - Loading screens
 *
 * @param {Object} props
 * @param {number} props.opacity - Pattern opacity (0-1, default: 0.1)
 * @param {string} props.color - Pattern color (default: teal gradient)
 * @param {string} props.variant - Pattern style: 'tree' | 'mandala' | 'network' (default: 'tree')
 * @param {number} props.size - Pattern size in pixels (default: 200)
 * @param {boolean} props.animate - Enable subtle animation (default: true)
 */

import PropTypes from 'prop-types';
import './FractalPattern.css';

const FractalPattern = ({
  opacity = 0.1,
  color = 'teal',
  variant = 'tree',
  size = 200,
  animate = true,
}) => {
  const getColorStops = () => {
    if (color === 'teal') {
      return { start: '#00C2A8', end: '#6C5CE7' };
    } else if (color === 'violet') {
      return { start: '#6C5CE7', end: '#A855F7' };
    } else {
      return { start: color, end: color };
    }
  };

  const colors = getColorStops();

  /**
   * Tree fractal pattern (recursive branching)
   */
  const renderTreePattern = () => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      className={`fractal-pattern fractal-pattern-tree ${animate ? 'fractal-pattern-animate' : ''}`}
      style={{ opacity }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="treeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={colors.start} />
          <stop offset="100%" stopColor={colors.end} />
        </linearGradient>
      </defs>

      {/* Main trunk */}
      <line x1="100" y1="200" x2="100" y2="120" stroke="url(#treeGradient)" strokeWidth="3" />

      {/* Level 1 branches */}
      <line x1="100" y1="120" x2="70" y2="80" stroke="url(#treeGradient)" strokeWidth="2" />
      <line x1="100" y1="120" x2="130" y2="80" stroke="url(#treeGradient)" strokeWidth="2" />

      {/* Level 2 branches - left */}
      <line x1="70" y1="80" x2="50" y2="50" stroke="url(#treeGradient)" strokeWidth="1.5" />
      <line x1="70" y1="80" x2="85" y2="50" stroke="url(#treeGradient)" strokeWidth="1.5" />

      {/* Level 2 branches - right */}
      <line x1="130" y1="80" x2="115" y2="50" stroke="url(#treeGradient)" strokeWidth="1.5" />
      <line x1="130" y1="80" x2="150" y2="50" stroke="url(#treeGradient)" strokeWidth="1.5" />

      {/* Level 3 branches */}
      <line x1="50" y1="50" x2="35" y2="30" stroke="url(#treeGradient)" strokeWidth="1" />
      <line x1="50" y1="50" x2="60" y2="30" stroke="url(#treeGradient)" strokeWidth="1" />
      <line x1="85" y1="50" x2="75" y2="30" stroke="url(#treeGradient)" strokeWidth="1" />
      <line x1="85" y1="50" x2="95" y2="30" stroke="url(#treeGradient)" strokeWidth="1" />
      <line x1="115" y1="50" x2="105" y2="30" stroke="url(#treeGradient)" strokeWidth="1" />
      <line x1="115" y1="50" x2="125" y2="30" stroke="url(#treeGradient)" strokeWidth="1" />
      <line x1="150" y1="50" x2="140" y2="30" stroke="url(#treeGradient)" strokeWidth="1" />
      <line x1="150" y1="50" x2="165" y2="30" stroke="url(#treeGradient)" strokeWidth="1" />
    </svg>
  );

  /**
   * Mandala fractal pattern (radial symmetry)
   */
  const renderMandalaPattern = () => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      className={`fractal-pattern fractal-pattern-mandala ${animate ? 'fractal-pattern-animate' : ''}`}
      style={{ opacity }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="mandalaGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={colors.start} />
          <stop offset="100%" stopColor={colors.end} />
        </linearGradient>
      </defs>

      {/* Concentric circles */}
      <circle cx="100" cy="100" r="80" fill="none" stroke="url(#mandalaGradient)" strokeWidth="1" />
      <circle cx="100" cy="100" r="60" fill="none" stroke="url(#mandalaGradient)" strokeWidth="1.5" />
      <circle cx="100" cy="100" r="40" fill="none" stroke="url(#mandalaGradient)" strokeWidth="2" />
      <circle cx="100" cy="100" r="20" fill="none" stroke="url(#mandalaGradient)" strokeWidth="2.5" />

      {/* Radial lines (8 directions) */}
      {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => {
        const rad = (angle * Math.PI) / 180;
        const x1 = 100 + 20 * Math.cos(rad);
        const y1 = 100 + 20 * Math.sin(rad);
        const x2 = 100 + 80 * Math.cos(rad);
        const y2 = 100 + 80 * Math.sin(rad);
        return (
          <line
            key={angle}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="url(#mandalaGradient)"
            strokeWidth="1"
          />
        );
      })}
    </svg>
  );

  /**
   * Network fractal pattern (interconnected nodes)
   */
  const renderNetworkPattern = () => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      className={`fractal-pattern fractal-pattern-network ${animate ? 'fractal-pattern-animate' : ''}`}
      style={{ opacity }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="networkGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={colors.start} />
          <stop offset="100%" stopColor={colors.end} />
        </linearGradient>
      </defs>

      {/* Nodes */}
      <circle cx="50" cy="50" r="6" fill="url(#networkGradient)" />
      <circle cx="150" cy="50" r="6" fill="url(#networkGradient)" />
      <circle cx="100" cy="100" r="8" fill="url(#networkGradient)" />
      <circle cx="50" cy="150" r="6" fill="url(#networkGradient)" />
      <circle cx="150" cy="150" r="6" fill="url(#networkGradient)" />
      <circle cx="30" cy="100" r="5" fill="url(#networkGradient)" />
      <circle cx="170" cy="100" r="5" fill="url(#networkGradient)" />
      <circle cx="100" cy="30" r="5" fill="url(#networkGradient)" />
      <circle cx="100" cy="170" r="5" fill="url(#networkGradient)" />

      {/* Connections */}
      <line x1="50" y1="50" x2="100" y2="100" stroke="url(#networkGradient)" strokeWidth="1" />
      <line x1="150" y1="50" x2="100" y2="100" stroke="url(#networkGradient)" strokeWidth="1" />
      <line x1="50" y1="150" x2="100" y2="100" stroke="url(#networkGradient)" strokeWidth="1" />
      <line x1="150" y1="150" x2="100" y2="100" stroke="url(#networkGradient)" strokeWidth="1" />
      <line x1="30" y1="100" x2="100" y2="100" stroke="url(#networkGradient)" strokeWidth="1" />
      <line x1="170" y1="100" x2="100" y2="100" stroke="url(#networkGradient)" strokeWidth="1" />
      <line x1="100" y1="30" x2="100" y2="100" stroke="url(#networkGradient)" strokeWidth="1" />
      <line x1="100" y1="170" x2="100" y2="100" stroke="url(#networkGradient)" strokeWidth="1" />
    </svg>
  );

  // Render selected variant
  if (variant === 'mandala') {
    return renderMandalaPattern();
  } else if (variant === 'network') {
    return renderNetworkPattern();
  }
  return renderTreePattern();
};

FractalPattern.propTypes = {
  opacity: PropTypes.number,
  color: PropTypes.string,
  variant: PropTypes.oneOf(['tree', 'mandala', 'network']),
  size: PropTypes.number,
  animate: PropTypes.bool,
};

export default FractalPattern;
