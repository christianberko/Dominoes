/**
 * Game board component - the main game interface where players play tiles, draw, and pass.
 * Handles all game logic, tile placement, win conditions, and real-time updates from the opponent.
 */
import React, { useState, useEffect } from 'react';
import './GameBoard.css';
import DominoTile from './DominoTile';
import SVGBoard from './SVGBoard';
import socketService from '../services/socketService';
import api from '../services/api';

const GameBoard = ({ gameData, currentUser, onLeaveGame }) => {
  const { gameId, player1, player2 } = gameData;
  
  // Determine which player is the current user
  const isPlayer1 = currentUser.id === player1.id;
  const playerNumber = isPlayer1 ? 1 : 2;
  const opponent = isPlayer1 ? player2 : player1;
  const playerHandLocation = isPlayer1 ? 'player1_hand' : 'player2_hand';
  const opponentHandLocation = isPlayer1 ? 'player2_hand' : 'player1_hand';

  // Game state
  const [playerHand, setPlayerHand] = useState([]);
  const [opponentHandCount, setOpponentHandCount] = useState(7);
  const [boardChain, setBoardChain] = useState([]);
  const [selectedTile, setSelectedTile] = useState(null);
  const [currentTurn, setCurrentTurn] = useState(1); // 1 or 2
  const [boneyardCount, setBoneyardCount] = useState(14);
  const [gameMessage, setGameMessage] = useState('Loading game...');
  const [gameStatus, setGameStatus] = useState('active');
  const [winnerId, setWinnerId] = useState(null);
  const [gameDbId, setGameDbId] = useState(null);

  const isMyTurn = currentTurn === playerNumber;

  // Load game from database on mount
  useEffect(() => {
    loadGameFromDatabase();
    
    // Join game room for Socket.IO
    socketService.socket?.emit('join-game', { 
      gameId, 
      playerId: currentUser.id 
    });

    // Listen for opponent moves
    socketService.socket?.on('opponent-played', handleOpponentPlayed);
    socketService.socket?.on('opponent-drew', handleOpponentDrew);
    socketService.socket?.on('opponent-passed', handleOpponentPassed);
    socketService.socket?.on('game-ended', handleGameEnded);
    socketService.socket?.on('opponent-disconnected', handleOpponentDisconnected);

    return () => {
      // Clean up Socket.IO listeners
      socketService.socket?.off('opponent-played', handleOpponentPlayed);
      socketService.socket?.off('opponent-drew', handleOpponentDrew);
      socketService.socket?.off('opponent-passed', handleOpponentPassed);
      socketService.socket?.off('game-ended', handleGameEnded);
      socketService.socket?.off('opponent-disconnected', handleOpponentDisconnected);
    };
  }, [gameId]);

  const loadGameFromDatabase = async () => {
    try {
      const response = await api.getGameState(gameId);
      const { game, tiles } = response;
      
      if (!game || !tiles) {
        console.error('✗ Invalid game data:', { game, tiles });
        setGameMessage('Failed to load game data. Please refresh.');
        return;
      }

      setGameDbId(game.gameID);
      // Convert current_turn (player ID) to player number (1 or 2)
      const currentTurnPlayerId = game.current_turn;
      const currentTurnPlayerNumber = currentTurnPlayerId === player1.id ? 1 : 2;
      setCurrentTurn(currentTurnPlayerNumber);
      setBoneyardCount(game.boneyard_count);
      setGameStatus(game.status);

      // Separate tiles by location
      const myHand = tiles.filter(t => t.location === playerHandLocation);
      const opponentHand = tiles.filter(t => t.location === opponentHandLocation);
      const boardTiles = tiles.filter(t => t.location === 'board').sort((a, b) => a.board_position - b.board_position);

      const mappedHand = myHand
        .filter(t => t && t.value && Array.isArray(t.value) && t.value.length >= 2)
        .map((t, index) => {
          // Handle both titleID and tileID from database
          const tileId = t.tileID || t.titleID || `tile-${index}`;
          if (!tileId) {
            console.error('❌ Tile missing ID:', t);
            return null;
          }
          return { 
            id: tileId, 
        top: t.value[0], 
        bottom: t.value[1] 
          };
        })
        .filter(t => t !== null); // Remove any null entries
      setPlayerHand(mappedHand);
      setOpponentHandCount(opponentHand.length);
      setBoardChain(boardTiles
        .filter(t => t && t.value && Array.isArray(t.value) && t.value.length >= 2)
        .map((t, index) => ({ 
          id: t.tileID || t.titleID || `board-tile-${index}`, 
        top: t.value[0], 
        bottom: t.value[1],
        isHorizontal: true 
      })));

      // Check if it's current user's turn (compare player IDs)
      if (game.current_turn === currentUser.id) {
        setGameMessage('Your turn!');
      } else {
        setGameMessage(`${opponent.displayName || opponent.username}'s turn...`);
      }
    } catch (error) {
      console.error('❌ Failed to load game:', error);
      setGameMessage('Failed to load game. Please refresh.');
    }
  };

  const canPlayTile = (tile) => {
    if (!tile) return false;
    // First tile can always be played
    if (boardChain.length === 0) return true;
    
    // Check if tile matches either end of the board
    const leftEnd = boardChain[0].top;
    const rightEnd = boardChain[boardChain.length - 1].bottom;

    return tile.top === leftEnd || tile.top === rightEnd || 
           tile.bottom === leftEnd || tile.bottom === rightEnd;
  };

  // Check if selected tile can be played
  const selectedTileCanPlay = selectedTile ? canPlayTile(selectedTile) : false;

  const playTile = async (tile, side) => {
    if (!isMyTurn) {
      setGameMessage('Not your turn!');
      return;
    }

    if (!canPlayTile(tile)) {
      setGameMessage('This tile cannot be played!');
      return;
    }

    if (!tile || !tile.id) {
      setGameMessage('Invalid tile selected!');
      return;
    }

    try {
      const isFirstTile = boardChain.length === 0;
      const leftEnd = boardChain.length > 0 ? boardChain[0].top : null;
      const rightEnd = boardChain.length > 0 ? boardChain[boardChain.length - 1].bottom : null;

      let boardPosition;
      let newTile = { ...tile, isHorizontal: true };

      if (isFirstTile) {
        // First tile - can be placed anywhere, no orientation adjustment needed
        boardPosition = 0;
        newTile = { id: tile.id, top: tile.top, bottom: tile.bottom, isHorizontal: true };
        setBoardChain([newTile]);
      } else if (side === 'left') {
        boardPosition = 0; // Will be prepended
        // When placing on left, tile's RIGHT side (bottom) must match board's LEFT end
        // Adjust orientation so the tile's right side (bottom) matches the board's left end
        if (tile.bottom === leftEnd) {
          // Tile's right side already matches - keep orientation
          newTile = { id: tile.id, top: tile.top, bottom: tile.bottom, isHorizontal: true };
        } else if (tile.top === leftEnd) {
          // Tile's left side matches - flip it so right side (new bottom) matches
          newTile = { id: tile.id, top: tile.bottom, bottom: tile.top, isHorizontal: true };
        } else {
          // Tile doesn't match - shouldn't happen if canPlayTile works correctly
          setGameMessage('Tile does not match the board!');
          return;
        }
        setBoardChain([newTile, ...boardChain]);
      } else {
        boardPosition = boardChain.length; // Will be appended
        // When placing on right, tile's LEFT side (top) must match board's RIGHT end
        // Adjust orientation so the tile's left side (top) matches the board's right end
        if (tile.top === rightEnd) {
          // Tile's left side already matches - keep orientation
          newTile = { id: tile.id, top: tile.top, bottom: tile.bottom, isHorizontal: true };
        } else if (tile.bottom === rightEnd) {
          // Tile's right side matches - flip it so left side (new top) matches
          newTile = { id: tile.id, top: tile.bottom, bottom: tile.top, isHorizontal: true };
        } else {
          // Tile doesn't match - shouldn't happen if canPlayTile works correctly
          setGameMessage('Tile does not match the board!');
          return;
        }
        setBoardChain([...boardChain, newTile]);
      }

      // Remove from hand locally
      const updatedHand = playerHand.filter(t => t.id !== tile.id);
      setPlayerHand(updatedHand);
      setSelectedTile(null);
      setGameMessage('Waiting for opponent...');

      // Send move to API with flipped tile values
      await api.playTile(gameId, tile.id, side, boardPosition, newTile.top, newTile.bottom);

      // Broadcast via Socket.IO
      socketService.socket?.emit('play-tile', {
        gameId,
        tile: newTile,
        side,
        boardPosition
      });

      // Check win condition (check before reloading)
      if (updatedHand.length === 0) {
        await endGame(currentUser.id);
        return;
      }

      // Reload game state to get updated turn from backend
      setTimeout(() => {
        loadGameFromDatabase();
      }, 500);
    } catch (error) {
      console.error('❌ Failed to play tile:', error);
      setGameMessage(`Failed to play tile: ${error.message || 'Unknown error'}. Refreshing game...`);
      // Reload to sync state
      setTimeout(() => {
        loadGameFromDatabase();
      }, 1000);
    }
  };

  const drawFromBoneyard = async () => {
    if (!isMyTurn) {
      setGameMessage('Not your turn!');
      return;
    }

    if (boneyardCount === 0) {
      setGameMessage('Boneyard is empty! Passing turn...');
      await passTurn();
      return;
    }

    try {
      const response = await api.drawTile(gameId, playerHandLocation);
      const { tile, boneyardCount: newBoneyardCount } = response;

      // Add to hand
      setPlayerHand(prev => [...prev, { 
        id: tile.tileID, 
        top: tile.value[0], 
        bottom: tile.value[1] 
      }]);
      setBoneyardCount(newBoneyardCount);
      setGameMessage(`Drew [${tile.value[0]}|${tile.value[1]}] from boneyard.`);

      // Notify opponent
      socketService.socket?.emit('draw-tile', {
        gameId,
        playerId: currentUser.id
      });

      // Reload game state to get updated turn from backend
      // Use a longer delay to ensure backend has processed the turn switch
      setTimeout(() => {
        loadGameFromDatabase();
      }, 800);
    } catch (error) {
      console.error('❌ Failed to draw tile:', error);
      setGameMessage('Failed to draw tile.');
    }
  };

  const passTurn = async () => {
    if (!isMyTurn) {
      setGameMessage('Not your turn!');
      return;
    }

    try {
      await api.passTurn(gameId);
      
      // Reload game state to get updated turn from backend
      setTimeout(() => {
        loadGameFromDatabase();
      }, 500);
      setGameMessage('You passed your turn.');

      // Notify opponent
      socketService.socket?.emit('pass-turn', {
        gameId,
        playerId: currentUser.id
      });
    } catch (error) {
      console.error('❌ Failed to pass turn:', error);
    }
  };

  const endGame = async (winnerUserId) => {
    try {
      await api.endGame(gameId, winnerUserId);
      
      setGameStatus('completed');
      setWinnerId(winnerUserId);
      
      if (winnerUserId === currentUser.id) {
        setGameMessage('🎉 You win! You played all your tiles!');
      } else {
        setGameMessage(`😢 ${opponent.displayName || opponent.username} wins!`);
      }

      // Notify opponent
      socketService.socket?.emit('end-game', {
        gameId,
        winnerId: winnerUserId
      });
    } catch (error) {
      console.error('❌ Failed to end game:', error);
    }
  };

  // Socket.IO event handlers
  const handleOpponentPlayed = ({ tile, side, boardPosition }) => {
    if (side === 'left') {
      setBoardChain(prev => [tile, ...prev]);
    } else {
      setBoardChain(prev => [...prev, tile]);
    }
    
    setOpponentHandCount(prev => prev - 1);
    // Reload game state to get updated turn from backend
    setTimeout(() => {
      loadGameFromDatabase();
    }, 500);
    setGameMessage(`Opponent played [${tile.top}|${tile.bottom}]. Your turn!`);

    // Check if opponent won
    if (opponentHandCount === 1) { // Will be 0 after decrement
      endGame(opponent.id);
    }
  };

  const handleOpponentDrew = ({ playerId }) => {
    setOpponentHandCount(prev => prev + 1);
    setBoneyardCount(prev => prev - 1);
    setGameMessage('Opponent drew from boneyard. Your turn!');
    // Reload game state to get updated turn from backend
    setTimeout(() => {
      loadGameFromDatabase();
    }, 800);
  };

  const handleOpponentPassed = ({ playerId }) => {
    // Reload game state to get updated turn from backend
    setTimeout(() => {
      loadGameFromDatabase();
    }, 500);
    setGameMessage('Opponent passed. Your turn!');
  };

  const handleGameEnded = ({ winnerId }) => {
    setGameStatus('completed');
    setWinnerId(winnerId);
    
    if (winnerId === currentUser.id) {
      setGameMessage('🎉 You win!');
    } else {
      setGameMessage(`😢 ${opponent.displayName || opponent.username} wins!`);
    }
  };

  const handleOpponentDisconnected = () => {
    setGameMessage('⚠️ Opponent disconnected. You win by default!');
    // Set current user as winner and show game over screen
    // (Backend already updated the database when opponent left)
    setGameStatus('completed');
    setWinnerId(currentUser.id);
  };

  return (
    <div className="game-board-container">
      <div className="game-header">
        <div className="game-info">
          <h2>Dominoes Game</h2>
          <div className="players-info">
            <div className="player-badge you">
              <span className="player-label">You:</span>
              <span className="player-name">{currentUser.displayName || currentUser.username}</span>
              <span className="tile-count">{playerHand.length} tiles</span>
            </div>
            <span className="vs-text">VS</span>
            <div className="player-badge opponent">
              <span className="player-label">Opponent:</span>
              <span className="player-name">{opponent.displayName || opponent.username}</span>
              <span className="tile-count">{opponentHandCount} tiles</span>
            </div>
          </div>
        </div>
        <button 
          className="leave-game-btn" 
          onClick={() => {
            // Notify backend that player is leaving (backend will end game and notify opponent)
            socketService.socket?.emit('leave-game', { gameId });
            // Return to lobby
            onLeaveGame();
          }}
        >
          ← Leave Game
        </button>
      </div>

      <div className="game-status">
        <div className="status-item">
          <span className="status-label">Boneyard:</span>
          <span className="status-value">{boneyardCount} tiles</span>
        </div>
        <div className="game-message-box">
          {gameMessage}
        </div>
        <div className="status-item">
          <span className="status-label">Turn:</span>
          <span className={`status-value ${isMyTurn ? 'your-turn' : 'opponent-turn'}`}>
            {isMyTurn ? 'Your Turn' : "Opponent's Turn"}
          </span>
        </div>
      </div>

      <div className="game-content">

        {/* Game Board - SVG Domino Chain */}
        <div className="board-area">
          <h4>Game Board</h4>
          <SVGBoard
            tiles={boardChain}
            selectedTile={selectedTile}
            canPlayTile={selectedTileCanPlay}
            isMyTurn={isMyTurn}
            onPlayLeft={() => {
              if (selectedTile && selectedTileCanPlay) {
                playTile(selectedTile, 'left');
              }
            }}
            onPlayRight={() => {
              if (selectedTile && selectedTileCanPlay) {
                playTile(selectedTile, 'right');
              }
            }}
          />
        </div>

        {/* Player's hand */}
        <div className="player-hand">
          <h4>Your Hand</h4>
          <div className="tiles-row">
            {playerHand.map((tile, index) => (
              <div key={tile.id || `tile-${index}`} className="player-tile-wrapper">
                <DominoTile
                  topValue={tile.top}
                  bottomValue={tile.bottom}
                  isHorizontal={false}
                  isSelected={selectedTile?.id === tile.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!tile || !tile.id) {
                      console.error('❌ Invalid tile clicked:', tile);
                      return;
                    }
                    if (isMyTurn && gameStatus === 'active') {
                      const newSelected = selectedTile?.id === tile.id ? null : tile;
                      setSelectedTile(newSelected);
                      if (newSelected) {
                        const canPlay = canPlayTile(newSelected);
                        setGameMessage(canPlay 
                          ? 'Tile selected! Click "Play Here" on the board to place it.' 
                          : 'This tile cannot be played on the current board.');
                      } else {
                        setGameMessage('Tile deselected.');
                      }
                    } else {
                      setGameMessage(isMyTurn ? 'Game is not active' : 'Not your turn!');
                    }
                  }}
                  className={!isMyTurn || gameStatus !== 'active' ? 'disabled' : 'player-hand-tile'}
                />
              </div>
            ))}
          </div>
          <div className="player-actions">
            <button 
              className="draw-btn"
              onClick={drawFromBoneyard}
              disabled={!isMyTurn || boneyardCount === 0 || gameStatus !== 'active'}
            >
              Draw from Boneyard ({boneyardCount})
            </button>
            <button 
              className="pass-btn"
              onClick={passTurn}
              disabled={!isMyTurn || gameStatus !== 'active'}
            >
              Pass Turn
            </button>
          </div>
        </div>
      </div>

      {(gameStatus === 'completed' || gameStatus === 'abandoned') && (
        <div className="game-over-overlay">
          <div className="game-over-modal">
            <h2>{winnerId === currentUser.id ? '🎉 Victory!' : '😢 Defeat'}</h2>
            <p>
              {winnerId === currentUser.id 
                ? 'Congratulations! You won the game!' 
                : `${opponent.displayName || opponent.username} won the game.`}
            </p>
            <button className="return-lobby-btn" onClick={onLeaveGame}>
              Return to Lobby
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default GameBoard;
