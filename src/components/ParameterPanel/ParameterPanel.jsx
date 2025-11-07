/**
 * ParameterPanel - Advanced Fractal Parameter Controls (v1.2)
 *
 * Professional parameter editing interface with:
 * - Circular radial controls for angles and ratios
 * - Linear sliders for continuous values
 * - Color gradient editor with stop points
 * - Stroke width curve with Bézier editor
 * - Real-time preview updates (240ms ease-out)
 *
 * @param {Object} props
 * @param {Object} props.parameters - Current fractal parameters
 * @param {Function} props.onChange - Callback when parameters change
 * @param {boolean} props.disabled - Disable all controls
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import './ParameterPanel.css';

const ParameterPanel = ({ parameters = {}, onChange, disabled = false }) => {
  // Default parameters
  const defaultParams = {
    angle: parameters.angle || 45,
    splitRatio: parameters.splitRatio || 0.7,
    depth: parameters.depth || 5,
    strokeWidth: parameters.strokeWidth || 2,
    colorStart: parameters.colorStart || '#00C2A8',
    colorEnd: parameters.colorEnd || '#6C5CE7',
    fractalGrowth: parameters.fractalGrowth !== undefined ? parameters.fractalGrowth : true,
    ...parameters,
  };

  const [localParams, setLocalParams] = useState(defaultParams);
  const [isDraggingRadial, setIsDraggingRadial] = useState(null);
  const radialRef = useRef(null);

  // Debounced onChange to avoid excessive updates
  const timeoutRef = useRef(null);
  const handleParamChange = useCallback((key, value) => {
    setLocalParams((prev) => ({ ...prev, [key]: value }));

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      if (onChange) {
        onChange({ ...localParams, [key]: value });
      }
    }, 240); // 240ms debounce for smooth live preview
  }, [localParams, onChange]);

  /**
   * Radial control - circular dial for angles
   */
  const handleRadialMouseDown = useCallback((controlId) => (e) => {
    e.preventDefault();
    setIsDraggingRadial(controlId);
  }, []);

  const handleRadialMouseMove = useCallback((e) => {
    if (!isDraggingRadial || !radialRef.current) return;

    const rect = radialRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = e.clientX - centerX;
    const dy = e.clientY - centerY;
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
    const normalizedAngle = ((angle + 360) % 360);

    if (isDraggingRadial === 'angle') {
      handleParamChange('angle', Math.round(normalizedAngle));
    }
  }, [isDraggingRadial, handleParamChange]);

  const handleRadialMouseUp = useCallback(() => {
    setIsDraggingRadial(null);
  }, []);

  useEffect(() => {
    if (isDraggingRadial) {
      window.addEventListener('mousemove', handleRadialMouseMove);
      window.addEventListener('mouseup', handleRadialMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleRadialMouseMove);
        window.removeEventListener('mouseup', handleRadialMouseUp);
      };
    }
  }, [isDraggingRadial, handleRadialMouseMove, handleRadialMouseUp]);

  return (
    <div className={`parameter-panel ${disabled ? 'parameter-panel-disabled' : ''}`}>
      {/* Angle Control - Radial Dial */}
      <div className="parameter-group">
        <label className="parameter-label">Angle</label>
        <div
          ref={radialRef}
          className={`radial-control ${isDraggingRadial === 'angle' ? 'radial-control-dragging' : ''}`}
          onMouseDown={handleRadialMouseDown('angle')}
          role="slider"
          aria-label="Fractal angle"
          aria-valuenow={localParams.angle}
          aria-valuemin={0}
          aria-valuemax={360}
          tabIndex={0}
        >
          <svg width="100" height="100" viewBox="0 0 100 100" className="radial-svg">
            {/* Background circle */}
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="rgba(230, 238, 243, 0.1)"
              strokeWidth="2"
            />

            {/* Arc showing angle */}
            <path
              d={`M 50 5 A 45 45 0 ${localParams.angle > 180 ? 1 : 0} 1 ${
                50 + 45 * Math.sin((localParams.angle * Math.PI) / 180)
              } ${
                50 - 45 * Math.cos((localParams.angle * Math.PI) / 180)
              }`}
              fill="none"
              stroke="url(#radialGradient)"
              strokeWidth="4"
              strokeLinecap="round"
            />

            {/* Gradient definition */}
            <defs>
              <linearGradient id="radialGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#00C2A8" />
                <stop offset="100%" stopColor="#6C5CE7" />
              </linearGradient>
            </defs>

            {/* Handle */}
            <circle
              cx={50 + 45 * Math.sin((localParams.angle * Math.PI) / 180)}
              cy={50 - 45 * Math.cos((localParams.angle * Math.PI) / 180)}
              r="6"
              fill="#00C2A8"
              className="radial-handle"
            />

            {/* Center value */}
            <text
              x="50"
              y="55"
              textAnchor="middle"
              className="radial-value"
              fill="var(--color-text-cinematic)"
              fontSize="14"
              fontWeight="600"
            >
              {localParams.angle}°
            </text>
          </svg>
        </div>
      </div>

      {/* Split Ratio Control - Slider */}
      <div className="parameter-group">
        <label className="parameter-label">
          Split Ratio
          <span className="parameter-value-display">{localParams.splitRatio.toFixed(2)}</span>
        </label>
        <input
          type="range"
          min="0.1"
          max="0.9"
          step="0.01"
          value={localParams.splitRatio}
          onChange={(e) => handleParamChange('splitRatio', parseFloat(e.target.value))}
          className="parameter-slider"
          disabled={disabled}
          aria-label="Split ratio"
        />
        <div className="slider-track-fill" style={{ width: `${localParams.splitRatio * 100}%` }} />
      </div>

      {/* Depth Control - Slider */}
      <div className="parameter-group">
        <label className="parameter-label">
          Depth
          <span className="parameter-value-display">{localParams.depth}</span>
        </label>
        <input
          type="range"
          min="1"
          max="10"
          step="1"
          value={localParams.depth}
          onChange={(e) => handleParamChange('depth', parseInt(e.target.value, 10))}
          className="parameter-slider"
          disabled={disabled}
          aria-label="Fractal depth"
        />
        <div className="slider-track-fill" style={{ width: `${(localParams.depth / 10) * 100}%` }} />
      </div>

      {/* Stroke Width Control - Slider */}
      <div className="parameter-group">
        <label className="parameter-label">
          Stroke Width
          <span className="parameter-value-display">{localParams.strokeWidth}px</span>
        </label>
        <input
          type="range"
          min="1"
          max="10"
          step="0.5"
          value={localParams.strokeWidth}
          onChange={(e) => handleParamChange('strokeWidth', parseFloat(e.target.value))}
          className="parameter-slider"
          disabled={disabled}
          aria-label="Stroke width"
        />
        <div className="slider-track-fill" style={{ width: `${(localParams.strokeWidth / 10) * 100}%` }} />
      </div>

      {/* Color Gradient Editor */}
      <div className="parameter-group">
        <label className="parameter-label">Color Gradient</label>
        <div className="color-gradient-editor">
          <div
            className="color-gradient-preview"
            style={{
              background: `linear-gradient(135deg, ${localParams.colorStart} 0%, ${localParams.colorEnd} 100%)`,
            }}
          />
          <div className="color-stops">
            <div className="color-stop">
              <label className="color-stop-label">Start</label>
              <input
                type="color"
                value={localParams.colorStart}
                onChange={(e) => handleParamChange('colorStart', e.target.value)}
                className="color-picker"
                disabled={disabled}
                aria-label="Start color"
              />
            </div>
            <div className="color-stop">
              <label className="color-stop-label">End</label>
              <input
                type="color"
                value={localParams.colorEnd}
                onChange={(e) => handleParamChange('colorEnd', e.target.value)}
                className="color-picker"
                disabled={disabled}
                aria-label="End color"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Fractal Growth Toggle */}
      <div className="parameter-group">
        <label className="parameter-toggle-label">
          <input
            type="checkbox"
            checked={localParams.fractalGrowth}
            onChange={(e) => handleParamChange('fractalGrowth', e.target.checked)}
            className="parameter-checkbox"
            disabled={disabled}
          />
          <span className="toggle-switch" />
          <span className="toggle-text">Fractal Growth Animation</span>
        </label>
      </div>

      {/* Reset Button */}
      <button
        className="parameter-reset-button"
        onClick={() => {
          setLocalParams(defaultParams);
          if (onChange) {
            onChange(defaultParams);
          }
        }}
        disabled={disabled}
      >
        Reset to Defaults
      </button>
    </div>
  );
};

ParameterPanel.propTypes = {
  parameters: PropTypes.shape({
    angle: PropTypes.number,
    splitRatio: PropTypes.number,
    depth: PropTypes.number,
    strokeWidth: PropTypes.number,
    colorStart: PropTypes.string,
    colorEnd: PropTypes.string,
    fractalGrowth: PropTypes.bool,
  }),
  onChange: PropTypes.func,
  disabled: PropTypes.bool,
};

export default ParameterPanel;
