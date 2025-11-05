import './SeedFractal.css';

/**
 * SeedFractal Background Component
 *
 * Animated SVG for Hero background with subtle pulse animation.
 * This is a decorative element that provides ambient motion behind the hero heading.
 *
 * Features:
 * - Gentle pulsing scale animation (0.98 → 1.02) at 6s loop
 * - Staggered opacity flicker for depth
 * - Respects prefers-reduced-motion
 * - Positioned behind content (pointer-events: none)
 *
 * @param {Object} props
 * @param {number} props.opacity - Base opacity (default: 0.15)
 */
const SeedFractal = ({ opacity = 0.15 }) => {
  return (
    <svg
      className="seed-fractal"
      width="600"
      height="600"
      viewBox="0 0 600 600"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ '--seed-opacity': opacity }}
    >
      {/* Central glow */}
      <defs>
        <radialGradient id="seed-glow" cx="50%" cy="50%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.2" />
          <stop offset="50%" stopColor="#8ad3ff" stopOpacity="0.1" />
          <stop offset="100%" stopColor="#667eea" stopOpacity="0" />
        </radialGradient>
        <filter id="blur">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2" />
        </filter>
      </defs>

      {/* Background glow circle */}
      <circle
        className="seed-glow-circle"
        cx="300"
        cy="300"
        r="200"
        fill="url(#seed-glow)"
      />

      {/* Fractal structure - concentric rings with connecting nodes */}
      <g className="seed-structure" filter="url(#blur)">
        {/* Inner ring - 3 nodes */}
        <g className="seed-ring seed-ring-1">
          <circle cx="300" cy="220" r="6" className="seed-node" />
          <circle cx="370" cy="290" r="6" className="seed-node" />
          <circle cx="230" cy="290" r="6" className="seed-node" />

          <line x1="300" y1="220" x2="370" y2="290" className="seed-edge" />
          <line x1="300" y1="220" x2="230" y2="290" className="seed-edge" />
          <line x1="230" y1="290" x2="370" y2="290" className="seed-edge" />
        </g>

        {/* Middle ring - 5 nodes */}
        <g className="seed-ring seed-ring-2">
          <circle cx="300" cy="180" r="5" className="seed-node" />
          <circle cx="400" cy="260" r="5" className="seed-node" />
          <circle cx="380" cy="360" r="5" className="seed-node" />
          <circle cx="220" cy="360" r="5" className="seed-node" />
          <circle cx="200" cy="260" r="5" className="seed-node" />

          <line x1="300" y1="180" x2="400" y2="260" className="seed-edge" />
          <line x1="400" y1="260" x2="380" y2="360" className="seed-edge" />
          <line x1="380" y1="360" x2="220" y2="360" className="seed-edge" />
          <line x1="220" y1="360" x2="200" y2="260" className="seed-edge" />
          <line x1="200" y1="260" x2="300" y2="180" className="seed-edge" />
        </g>

        {/* Outer ring - 8 nodes */}
        <g className="seed-ring seed-ring-3">
          <circle cx="300" cy="140" r="4" className="seed-node" />
          <circle cx="385" cy="175" r="4" className="seed-node" />
          <circle cx="430" cy="260" r="4" className="seed-node" />
          <circle cx="420" cy="360" r="4" className="seed-node" />
          <circle cx="350" cy="420" r="4" className="seed-node" />
          <circle cx="250" cy="420" r="4" className="seed-node" />
          <circle cx="180" cy="360" r="4" className="seed-node" />
          <circle cx="170" cy="260" r="4" className="seed-node" />
        </g>

        {/* Central node */}
        <circle cx="300" cy="300" r="8" className="seed-node seed-node-center" />
      </g>
    </svg>
  );
};

export default SeedFractal;
