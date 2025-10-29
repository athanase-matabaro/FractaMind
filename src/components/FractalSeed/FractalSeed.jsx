import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import './FractalSeed.css';

/**
 * FractalSeed Component
 *
 * An animated SVG visualization that starts as a dot, grows branches,
 * and stabilizes into a 6-node fractal preview. Used as a visual motif
 * throughout the application (hero, loading states, expansion animations).
 *
 * Features:
 * - CSS-based animation (stroke-dashoffset + transform)
 * - Respects prefers-reduced-motion
 * - ARIA-friendly with live region announcements
 * - Customizable size, color, and animation delay
 *
 * @param {Object} props
 * @param {number} props.size - Size in pixels (default: 200)
 * @param {string} props.color - Color of branches (default: accent from tokens)
 * @param {number} props.animationDelay - Delay before animation starts in ms (default: 0)
 * @param {boolean} props.reducedMotion - Force reduced motion mode (default: auto-detect)
 * @param {boolean} props.autoPlay - Start animation automatically (default: true)
 * @param {Function} props.onComplete - Callback when animation completes
 */
const FractalSeed = ({
  size = 200,
  color = '#667eea',
  animationDelay = 0,
  reducedMotion = null,
  autoPlay = true,
  onComplete = null,
}) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const svgRef = useRef(null);

  // Detect reduced motion preference
  const prefersReducedMotion =
    reducedMotion !== null
      ? reducedMotion
      : typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;

  // Animation duration (faster if reduced motion)
  const duration = prefersReducedMotion ? 100 : 1200;

  useEffect(() => {
    if (autoPlay && !isAnimating) {
      const timer = setTimeout(() => {
        setIsAnimating(true);

        // Mark animation as complete after duration
        const completeTimer = setTimeout(() => {
          setIsComplete(true);
          if (onComplete) {
            onComplete();
          }
        }, duration + animationDelay);

        return () => clearTimeout(completeTimer);
      }, animationDelay);

      return () => clearTimeout(timer);
    }
  }, [autoPlay, animationDelay, duration, onComplete, isAnimating]);

  // Calculate center point
  const center = size / 2;

  // Node positions for a 6-node fractal
  // Central node (root) + 5 surrounding nodes
  const nodes = [
    { id: 'root', cx: center, cy: center, r: 8 },
    { id: 'n1', cx: center, cy: center - 50, r: 6 }, // Top
    { id: 'n2', cx: center + 43, cy: center + 25, r: 6 }, // Bottom right
    { id: 'n3', cx: center - 43, cy: center + 25, r: 6 }, // Bottom left
    { id: 'n4', cx: center + 35, cy: center - 25, r: 5 }, // Top right
    { id: 'n5', cx: center - 35, cy: center - 25, r: 5 }, // Top left
  ];

  // Connections (branches) between nodes
  const branches = [
    { id: 'b1', from: nodes[0], to: nodes[1], delay: 0 }, // Root to top
    { id: 'b2', from: nodes[0], to: nodes[2], delay: 100 }, // Root to bottom right
    { id: 'b3', from: nodes[0], to: nodes[3], delay: 200 }, // Root to bottom left
    { id: 'b4', from: nodes[1], to: nodes[4], delay: 300 }, // Top to top right
    { id: 'b5', from: nodes[1], to: nodes[5], delay: 400 }, // Top to top left
  ];

  // Calculate line length for stroke-dasharray animation
  const lineLength = (from, to) => {
    const dx = to.cx - from.cx;
    const dy = to.cy - from.cy;
    return Math.sqrt(dx * dx + dy * dy);
  };

  return (
    <div
      className="fractal-seed-container"
      style={{ width: size, height: size }}
      role="img"
      aria-label="Animated fractal seed growing and branching"
      aria-live="polite"
      aria-atomic="true"
    >
      <svg
        ref={svgRef}
        className={`fractal-seed ${isAnimating ? 'animating' : ''} ${
          isComplete ? 'complete' : ''
        }`}
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        xmlns="http://www.w3.org/2000/svg"
        style={{
          '--seed-color': color,
          '--animation-duration': `${duration}ms`,
        }}
      >
        {/* Branches (connections) */}
        <g className="fractal-branches">
          {branches.map((branch) => {
            const length = lineLength(branch.from, branch.to);
            return (
              <line
                key={branch.id}
                className="fractal-branch"
                x1={branch.from.cx}
                y1={branch.from.cy}
                x2={branch.to.cx}
                y2={branch.to.cy}
                stroke={color}
                strokeWidth="2"
                strokeLinecap="round"
                style={{
                  strokeDasharray: length,
                  strokeDashoffset: length,
                  animationDelay: `${branch.delay + animationDelay}ms`,
                }}
              />
            );
          })}
        </g>

        {/* Nodes */}
        <g className="fractal-nodes">
          {nodes.map((node, index) => (
            <circle
              key={node.id}
              className={`fractal-node ${
                index === 0 ? 'fractal-node-root' : ''
              }`}
              cx={node.cx}
              cy={node.cy}
              r={node.r}
              fill={color}
              style={{
                animationDelay: `${index * 100 + animationDelay}ms`,
              }}
            />
          ))}
        </g>

        {/* Central glow effect (optional, only when not reduced motion) */}
        {!prefersReducedMotion && (
          <defs>
            <radialGradient
              id={`seed-glow-${color.replace('#', '')}`}
              cx="50%"
              cy="50%"
            >
              <stop offset="0%" stopColor={color} stopOpacity="0.3" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </radialGradient>
          </defs>
        )}
        {!prefersReducedMotion && (
          <circle
            className="fractal-glow"
            cx={center}
            cy={center}
            r={40}
            fill={`url(#seed-glow-${color.replace('#', '')})`}
            style={{
              animationDelay: `${animationDelay}ms`,
            }}
          />
        )}
      </svg>

      {/* Screen reader announcement */}
      <span className="sr-only">
        {isComplete
          ? 'Fractal seed ready'
          : isAnimating
          ? 'Fractal seed growing'
          : 'Fractal seed idle'}
      </span>
    </div>
  );
};

FractalSeed.propTypes = {
  size: PropTypes.number,
  color: PropTypes.string,
  animationDelay: PropTypes.number,
  reducedMotion: PropTypes.bool,
  autoPlay: PropTypes.bool,
  onComplete: PropTypes.func,
};

export default FractalSeed;
