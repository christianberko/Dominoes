/**
 * Game handler - handles real-time game events like playing tiles, drawing, passing.
 * Also manages when players leave or disconnect during a game.
 */
const activeGames = new Map(); // Map gameId -> { player1SocketId, player2SocketId, player1Id, player2Id }
const disconnectTimeouts = new Map(); // Map `${gameId}-${playerId}` -> timeout

module.exports = (io, supabase) => {
  io.on('connection', (socket) => {
    
    // Join a game room
    socket.on('join-game', ({ gameId, playerId }) => {
      socket.join(gameId);
      
      // Track which players are in which games
      if (!activeGames.has(gameId)) {
        activeGames.set(gameId, {});
      }
      const game = activeGames.get(gameId);
      
      // Check if this player is reconnecting (same player ID, different socket)
      const timeoutKey = `${gameId}-${playerId}`;
      if (disconnectTimeouts.has(timeoutKey)) {
        // Player reconnected - cancel the disconnect timeout
        clearTimeout(disconnectTimeouts.get(timeoutKey));
        disconnectTimeouts.delete(timeoutKey);
        console.log(`Player ${playerId} reconnected to game ${gameId}`);
      }
      
      // Store socket IDs for both players
      if (game.player1Id === playerId) {
        // Player 1 reconnecting - update socket ID
        game.player1SocketId = socket.id;
      } else if (game.player2Id === playerId) {
        // Player 2 reconnecting - update socket ID
        game.player2SocketId = socket.id;
      } else if (!game.player1SocketId) {
        // New player 1
        game.player1SocketId = socket.id;
        game.player1Id = playerId;
      } else if (!game.player2SocketId) {
        // New player 2
        game.player2SocketId = socket.id;
        game.player2Id = playerId;
      }
      
      console.log(`Player ${playerId} joined game ${gameId}`);
    });

    // Player plays a tile
    socket.on('play-tile', async ({ gameId, tile, side, boardPosition }) => {
      try {
        socket.to(gameId).emit('opponent-played', {
          tile,
          side,
          boardPosition
        });
      } catch (error) {
        console.error('❌ Play tile error:', error);
        socket.emit('game-error', { message: 'Failed to play tile' });
      }
    });

    // Player draws a tile
    socket.on('draw-tile', async ({ gameId, playerId }) => {
      try {
        socket.to(gameId).emit('opponent-drew', {
          playerId
        });
      } catch (error) {
        console.error('❌ Draw tile error:', error);
        socket.emit('game-error', { message: 'Failed to draw tile' });
      }
    });

    // Player passes turn
    socket.on('pass-turn', async ({ gameId, playerId }) => {
      try {
        socket.to(gameId).emit('opponent-passed', {
          playerId
        });
      } catch (error) {
        console.error('❌ Pass turn error:', error);
        socket.emit('game-error', { message: 'Failed to pass turn' });
      }
    });

    // Game ended
    socket.on('end-game', async ({ gameId, winnerId }) => {
      try {
        // Get player IDs before cleaning up
        const game = activeGames.get(gameId);
        const player1Id = game?.player1Id;
        const player2Id = game?.player2Id;
        
        // Broadcast game end to all players in the game
        io.to(gameId).emit('game-ended', {
          winnerId
        });
        
        // Clean up game from active games
        activeGames.delete(gameId);
        
        // Notify all users that these players are now available
        if (player1Id) {
          io.emit('user-available', { userId: player1Id });
        }
        if (player2Id) {
          io.emit('user-available', { userId: player2Id });
        }
        
        console.log(`OK Game ${gameId} ended`);
      } catch (error) {
        console.error('❌ End game error:', error);
      }
    });

    // Request game sync (when a player needs the current state)
    socket.on('request-game-sync', async ({ gameId }) => {
      try {
        // Get game state from database
        const { data: game, error: gameError } = await supabase
          .from('Games')
          .select('*')
          .eq('game_uuid', gameId)
          .single();

        if (gameError || !game) {
          socket.emit('game-error', { message: 'Game not found' });
          return;
        }

        // Get all tiles
        const { data: tiles, error: tilesError } = await supabase
          .from('GameTiles')
          .select('*')
          .eq('gameID', game.gameID)
          .order('board_position', { ascending: true });

        if (tilesError) {
          socket.emit('game-error', { message: 'Failed to load tiles' });
          return;
        }

        // Send game state to requester
        socket.emit('game-synced', {
          game,
          tiles: tiles.map(t => ({
            tileID: t.tileID,
            value: [t.top_value, t.bottom_value],
            location: t.location,
            board_position: t.board_position
          }))
        });
      } catch (error) {
        console.error('❌ Game sync error:', error);
        socket.emit('game-error', { message: 'Failed to sync game' });
      }
    });

    // Handle player leaving game (via Leave Game button)
    socket.on('leave-game', async ({ gameId }) => {
      const game = activeGames.get(gameId);
      if (!game) {
        return;
      }

      const player1Id = game.player1Id;
      const player2Id = game.player2Id;
      const leavingPlayerId = game.player1SocketId === socket.id ? player1Id : 
                              game.player2SocketId === socket.id ? player2Id : null;
      const remainingPlayerId = leavingPlayerId === player1Id ? player2Id : player1Id;

      // Clear any pending disconnect timeout for this player
      if (leavingPlayerId) {
        const timeoutKey = `${gameId}-${leavingPlayerId}`;
        if (disconnectTimeouts.has(timeoutKey)) {
          clearTimeout(disconnectTimeouts.get(timeoutKey));
          disconnectTimeouts.delete(timeoutKey);
        }
      }

      // End the game with remaining player as winner
      try {
        const { error } = await supabase
          .from('Games')
          .update({ 
            status: 'completed',
            winner_id: remainingPlayerId
          })
          .eq('game_uuid', gameId);

        if (error) {
          console.error('❌ Failed to end game when player left:', error);
        }
      } catch (error) {
        console.error('❌ Error ending game:', error);
      }

      // Notify remaining player that opponent left
      socket.to(gameId).emit('opponent-disconnected');

      // Clean up game
      activeGames.delete(gameId);

      // Notify all users that these players are now available
      if (player1Id) {
        io.emit('user-available', { userId: player1Id });
      }
      if (player2Id) {
        io.emit('user-available', { userId: player2Id });
      }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      // Find games this player was in
      for (const [gameId, game] of activeGames.entries()) {
        let disconnectedPlayerId = null;
        
        if (game.player1SocketId === socket.id) {
          disconnectedPlayerId = game.player1Id;
          // Clear socket ID but keep player ID (they might reconnect)
          game.player1SocketId = null;
        } else if (game.player2SocketId === socket.id) {
          disconnectedPlayerId = game.player2Id;
          // Clear socket ID but keep player ID (they might reconnect)
          game.player2SocketId = null;
        }
        
        if (disconnectedPlayerId) {
          const timeoutKey = `${gameId}-${disconnectedPlayerId}`;
          
          // Set a timeout to end the game if player doesn't reconnect
          const timeout = setTimeout(async () => {
            // Player didn't reconnect - end the game
            const currentGame = activeGames.get(gameId);
            if (!currentGame) {
              return; // Game already cleaned up
            }
            
            const player1Id = currentGame.player1Id;
            const player2Id = currentGame.player2Id;
            const remainingPlayerId = disconnectedPlayerId === player1Id ? player2Id : player1Id;
            
            // End the game in database
            try {
              const { error } = await supabase
                .from('Games')
                .update({ 
                  status: 'completed',
                  winner_id: remainingPlayerId
                })
                .eq('game_uuid', gameId);
              
              if (error) {
                console.error('❌ Failed to end game on disconnect timeout:', error);
              }
            } catch (error) {
              console.error('❌ Error ending game on disconnect:', error);
            }
            
            // Notify remaining player
            io.to(gameId).emit('opponent-disconnected');
            
            // Clean up game
            activeGames.delete(gameId);
            disconnectTimeouts.delete(timeoutKey);
            
            // Notify all users that these players are now available
            if (player1Id) {
              io.emit('user-available', { userId: player1Id });
            }
            if (player2Id) {
              io.emit('user-available', { userId: player2Id });
            }
          }, 15000); // 15 second timeout
          
          disconnectTimeouts.set(timeoutKey, timeout);
          console.log(`Player ${disconnectedPlayerId} disconnected from game ${gameId}, waiting for reconnect...`);
        }
      }
    });
  });
};

