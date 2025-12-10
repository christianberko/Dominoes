/**
 * SVG board component - renders the game board and all played tiles using SVG.
 * Handles tile positioning, click handlers for placing tiles, and visual feedback.
 */
import React from 'react';
import './SVGBoard.css';

// Component to render a single domino tile in SVG
const SVGDominoTile = ({ topValue, bottomValue, x, y, isHorizontal = true, onClick }) => {
  const width = isHorizontal ? 120 : 60;
  const height = isHorizontal ? 60 : 120;

  // Generate dots for a given value (0-6)
  // 
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

  return (
    <g 
      transform={`translate(${x}, ${y})`}
      className="svg-domino-tile"
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
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
    </g>
  );
};

// Main SVG Board Component
const SVGBoard = ({ tiles, selectedTile, canPlayTile, isMyTurn, onPlayLeft, onPlayRight }) => {
  // Calculate positions for tiles
  const TILE_WIDTH = 120;
  const TILE_HEIGHT = 60;
  const TILE_SPACING = 5;
  const BOARD_PADDING = 20;
  const BOARD_HEIGHT = 250; // Increased height for more space

  // Calculate board width based on number of tiles
  const boardWidth = tiles.length > 0 
    ? tiles.length * (TILE_WIDTH + TILE_SPACING) + BOARD_PADDING * 2
    : 800; // Default width for empty board

  // Calculate center Y position
  const centerY = BOARD_HEIGHT / 2 - TILE_HEIGHT / 2;

  return (
    <div className="svg-board-container">
      <svg
        width={boardWidth}
        height={BOARD_HEIGHT}
        viewBox={`0 0 ${boardWidth} ${BOARD_HEIGHT}`}
        className="svg-board"
      >
        {/* Board background */}
        <rect
          x="0"
          y="0"
          width={boardWidth}
          height={BOARD_HEIGHT}
          className="board-background"
        />

        {/* Board border */}
        <rect
          x="0"
          y="0"
          width={boardWidth}
          height={BOARD_HEIGHT}
          className="board-border"
          fill="none"
        />

        {tiles.length === 0 ? (
          <>
            <text
              x={boardWidth / 2}
              y={BOARD_HEIGHT / 2 - 30}
              textAnchor="middle"
              className="empty-board-text"
            >
              Board is empty. Play the first tile!
            </text>
            {/* Show play button when board is empty and tile is selected */}
            {selectedTile && canPlayTile && isMyTurn && (
              <g 
                className="play-button center"
                onClick={(e) => {
                  e.stopPropagation();
                  onPlayLeft();
                }}
                style={{ cursor: 'pointer' }}
              >
                <rect
                  x={boardWidth / 2 - 50}
                  y={BOARD_HEIGHT / 2 + 10}
                  width="100"
                  height="40"
                  rx="8"
                  className="play-button-bg"
                />
                <text
                  x={boardWidth / 2}
                  y={BOARD_HEIGHT / 2 + 35}
                  textAnchor="middle"
                  className="play-button-text"
                >
                  Play First Tile
                </text>
              </g>
            )}
          </>
        ) : (
          <>
            {/* Render play position buttons if tile is selected and can be played */}
            {selectedTile && canPlayTile && isMyTurn && (
              <>
                {/* Left play button */}
                <g 
                  className="play-button left"
                  onClick={(e) => {
                    e.stopPropagation();
                    onPlayLeft();
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <rect
                    x={BOARD_PADDING - 10}
                    y={centerY - 20}
                    width="100"
                    height="40"
                    rx="8"
                    className="play-button-bg"
                  />
                  <text
                    x={BOARD_PADDING + 40}
                    y={centerY + 5}
                    textAnchor="middle"
                    className="play-button-text"
                  >
                    ← Play Here
                  </text>
                </g>

                {/* Right play button */}
                <g 
                  className="play-button right"
                  onClick={(e) => {
                    e.stopPropagation();
                    onPlayRight();
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <rect
                    x={boardWidth - BOARD_PADDING - 90}
                    y={centerY - 20}
                    width="100"
                    height="40"
                    rx="8"
                    className="play-button-bg"
                  />
                  <text
                    x={boardWidth - BOARD_PADDING - 40}
                    y={centerY + 5}
                    textAnchor="middle"
                    className="play-button-text"
                  >
                    Play Here →
                  </text>
                </g>
              </>
            )}

            {/* Render domino tiles */}
            {tiles.map((tile, index) => {
              const x = BOARD_PADDING + index * (TILE_WIDTH + TILE_SPACING);
              const y = centerY;
              
              return (
                <SVGDominoTile
                  key={tile.id || index}
                  topValue={tile.top}
                  bottomValue={tile.bottom}
                  x={x}
                  y={y}
                  isHorizontal={true}
                />
              );
            })}
          </>
        )}
      </svg>
    </div>
  );
};

export default SVGBoard;

