/**
 * Game handler - handles real-time game events like playing tiles, drawing, passing.
 * Also manages when players leave or disconnect during a game.
 */
const activeGames = new Map(); // Map gameId -> { player1SocketId, player2SocketId }

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
      
      // Store socket IDs for both players
      if (!game.player1SocketId) {
        game.player1SocketId = socket.id;
        game.player1Id = playerId;
      } else if (!game.player2SocketId) {
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
      // Find and clean up games this player was in
      for (const [gameId, game] of activeGames.entries()) {
        if (game.player1SocketId === socket.id || game.player2SocketId === socket.id) {
          const player1Id = game.player1Id;
          const player2Id = game.player2Id;
          
          // Notify other player
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
          
          // Could optionally end the game or mark it as abandoned here
        }
      }
    });
  });
};

