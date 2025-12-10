/**
 * Domino tile component - renders a single domino tile in the player's hand.
 * Shows the dots/pips and handles selection for playing.
 */
import React from 'react';
import './DominoTile.css';

const DominoTile = ({ 
  topValue, 
  bottomValue, 
  isHorizontal = true, 
  isSelected = false,
  onClick,
  className = ''
}) => {
  // Generate dots for a given value (0-6)
  // Positions are scaled for 50x50 tile halves (from 100x100 system)
  const renderDots = (value) => {
    const dots = [];
    const positions = {
      1: [[25, 25]],
      2: [[12.5, 12.5], [37.5, 37.5]],
      3: [[12.5, 12.5], [25, 25], [37.5, 37.5]],
      4: [[12.5, 12.5], [37.5, 12.5], [12.5, 37.5], [37.5, 37.5]],
      5: [[12.5, 12.5], [37.5, 12.5], [25, 25], [12.5, 37.5], [37.5, 37.5]],
      6: [[12.5, 12.5], [37.5, 12.5], [12.5, 25], [37.5, 25], [12.5, 37.5], [37.5, 37.5]]
    };

    if (value === 0) return null;

    const dotPositions = positions[value] || [];
    return dotPositions.map((pos, idx) => (
      <circle
        key={idx}
        cx={pos[0]}
        cy={pos[1]}
        r="4"
        className="domino-dot"
      />
    ));
  };

  const width = isHorizontal ? 120 : 60;
  const height = isHorizontal ? 60 : 120;

  return (
    <div 
      className={`domino-tile-container ${isSelected ? 'selected' : ''} ${className}`}
      onClick={onClick}
      style={{ 
        cursor: onClick ? 'pointer' : 'default',
        display: 'inline-block'
      }}
    >
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="domino-svg"
      >
        {/* Domino background */}
        <rect
          x="2"
          y="2"
          width={width - 4}
          height={height - 4}
          rx="6"
          className="domino-background"
        />
        
        {/* Border */}
        <rect
          x="2"
          y="2"
          width={width - 4}
          height={height - 4}
          rx="6"
          className="domino-border"
          fill="none"
          strokeWidth="3"
        />

        {isHorizontal ? (
          <>
            {/* Left half */}
            <g transform="translate(5, 5)">
              {renderDots(topValue)}
            </g>
            
            {/* Divider line */}
            <line
              x1="60"
              y1="5"
              x2="60"
              y2={height - 5}
              className="domino-divider"
              strokeWidth="2"
            />
            
            {/* Right half */}
            <g transform="translate(65, 5)">
              {renderDots(bottomValue)}
            </g>
          </>
        ) : (
          <>
            {/* Top half */}
            <g transform="translate(5, 5)">
              {renderDots(topValue)}
            </g>
            
            {/* Divider line */}
            <line
              x1="5"
              y1="60"
              x2={width - 5}
              y2="60"
              className="domino-divider"
              strokeWidth="2"
            />
            
            {/* Bottom half */}
            <g transform="translate(5, 65)">
              {renderDots(bottomValue)}
            </g>
          </>
        )}
      </svg>
    </div>
  );
};

export default DominoTile;

