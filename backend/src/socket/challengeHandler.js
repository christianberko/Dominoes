/**
 * Challenge handler - manages real-time game challenges between players.
 * Handles sending challenges, accepting/declining them, and creating games when accepted.
 */
const activeChallenges = new Map(); // Store pending challenges: challengeId -> { challenger, challenged, timestamp }
const userSocketMap = new Map(); // Map userId to socketId for direct messaging

// Helper: Generate domino set and shuffle
function generateAndShuffleDominoes() {
  const set = [];
  for (let i = 0; i <= 6; i++) {
    for (let j = i; j <= 6; j++) {
      set.push([i, j]);
    }
  }
  // Shuffle
  for (let i = set.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [set[i], set[j]] = [set[j], set[i]];
  }
  return set;
}

module.exports = (io, supabase) => {
  io.on('connection', (socket) => {
    
    // Register user's socket for direct messaging
    socket.on('register-user', (userData) => {
      userSocketMap.set(userData.id, socket.id);
      socket.userId = userData.id;
      socket.userData = userData;
      
      console.log(`OK User ${userData.username} registered with socket ${socket.id}`);
    });

    // Send a challenge to another user
    socket.on('send-challenge', ({ challengerId, challengerName, challengerDisplayName, targetId, targetName }) => {
      const challengeId = `${challengerId}-${targetId}-${Date.now()}`;
      
      // Store challenge
      activeChallenges.set(challengeId, {
        challengeId,
        challengerId,
        challengerName,
        challengerDisplayName,
        targetId,
        targetName,
        timestamp: Date.now()
      });

      // Get target user's socket - try both as number and string
      let targetSocketId = userSocketMap.get(targetId);
      if (!targetSocketId) {
        targetSocketId = userSocketMap.get(Number(targetId));
      }
      if (!targetSocketId) {
        targetSocketId = userSocketMap.get(String(targetId));
      }
      
      if (targetSocketId) {
        io.to(targetSocketId).emit('challenge-received', {
          challengeId,
          challenger: {
            id: challengerId,
            username: challengerName,
            displayName: challengerDisplayName
          }
        });
        
        console.log(`OK Challenge sent: ${challengerName} -> ${targetName}`);
      } else {
        socket.emit('challenge-error', { 
          message: 'User is not online' 
        });
        console.log(`✗ Target user ${targetName} not found`);
      }
    });

    // Accept a challenge
    socket.on('accept-challenge', async ({ challengeId }) => {
      const challenge = activeChallenges.get(challengeId);
      
      if (!challenge) {
        socket.emit('challenge-error', { message: 'Challenge not found or expired' });
        return;
      }

      console.log(`OK Challenge accepted: ${challenge.challengerName} vs ${challenge.targetName}`);

      // Get both users' sockets
      const challengerSocketId = userSocketMap.get(challenge.challengerId);
      const targetSocketId = userSocketMap.get(challenge.targetId);

      // Generate and deal tiles
      const allTiles = generateAndShuffleDominoes();
      const player1Hand = allTiles.splice(0, 7);
      const player2Hand = allTiles.splice(0, 7);
      const boneyard = allTiles; // Remaining 14 tiles

      // Generate proper UUID (using crypto.randomUUID if available, otherwise fallback)
      const gameUuid = typeof crypto !== 'undefined' && crypto.randomUUID 
        ? crypto.randomUUID() 
        : `xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
          });

      // Prepare tiles for database
      const tilesToInsert = [];
      
      // Player 1 hand
      player1Hand.forEach(tile => {
        tilesToInsert.push({
          value: tile,
          location: 'player1_hand',
          board_position: -1 // Use -1 for tiles not on board
        });
      });
      
      // Player 2 hand
      player2Hand.forEach(tile => {
        tilesToInsert.push({
          value: tile,
          location: 'player2_hand',
          board_position: -1 // Use -1 for tiles not on board
        });
      });
      
      // Boneyard
      boneyard.forEach(tile => {
        tilesToInsert.push({
          value: tile,
          location: 'boneyard',
          board_position: -1 // Use -1 for tiles not on board
        });
      });

      try {
        // Create game in database
        const { data: game, error: gameError } = await supabase
          .from('Games')
          .insert([{
            game_uuid: gameUuid,
            player1_id: challenge.challengerId,
            player2_id: challenge.targetId,
            current_turn: challenge.challengerId, // Store as player1_id (challenger is always player1)
            status: 'active',
            winner_id: 0, // Placeholder until game ends
            boneyard_count: boneyard.length
          }])
          .select()
          .single();

        if (gameError) {
          console.error('❌ Game creation error:', gameError);
          socket.emit('challenge-error', { message: 'Failed to create game' });
          return;
        }

        // Insert all tiles
        const tileInserts = tilesToInsert.map(tile => ({
          gameID: game.gameID,
          top_value: tile.value[0],
          bottom_value: tile.value[1],
          location: tile.location,
          board_position: tile.board_position
        }));

        const { error: tilesError } = await supabase
          .from('GameTiles')
          .insert(tileInserts);

        if (tilesError) {
          console.error('❌ Tiles insertion error:', tilesError);
          socket.emit('challenge-error', { message: 'Failed to create game tiles' });
          return;
        }

        // Create game session data
        const gameData = {
          gameId: gameUuid,
          gameDbId: game.gameID,
          player1: {
            id: challenge.challengerId,
            username: challenge.challengerName,
            displayName: challenge.challengerDisplayName
          },
          player2: {
            id: challenge.targetId,
            username: challenge.targetName,
            displayName: socket.userData?.displayName || challenge.targetName
          }
        };

        // Notify both users to start the game
        if (challengerSocketId) {
          io.to(challengerSocketId).emit('game-start', gameData);
        }
        if (targetSocketId) {
          io.to(targetSocketId).emit('game-start', gameData);
        }

        // Notify all users that these players are now busy
        io.emit('user-busy', { 
          userId: challenge.challengerId,
          username: challenge.challengerName
        });
        io.emit('user-busy', { 
          userId: challenge.targetId,
          username: challenge.targetName
        });

        // Remove challenge from active list
        activeChallenges.delete(challengeId);
        
        console.log(`OK Game started: ${challenge.challengerName} vs ${challenge.targetName}`);
      } catch (error) {
        console.error('❌ Error creating game:', error);
        socket.emit('challenge-error', { message: 'Failed to create game' });
      }
    });

    // Decline a challenge
    socket.on('decline-challenge', ({ challengeId }) => {
      const challenge = activeChallenges.get(challengeId);
      
      if (!challenge) {
        return;
      }

      console.log(`✗ Challenge declined: ${challenge.challengerName} vs ${challenge.targetName}`);

      // Notify challenger that challenge was declined
      const challengerSocketId = userSocketMap.get(challenge.challengerId);
      if (challengerSocketId) {
        io.to(challengerSocketId).emit('challenge-declined', {
          targetName: challenge.targetName
        });
      }

      // Remove challenge
      activeChallenges.delete(challengeId);
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      if (socket.userId) {
        userSocketMap.delete(socket.userId);
        console.log(`User ${socket.userData?.username} disconnected from challenges`);
        
        // Cancel any pending challenges involving this user
        for (const [challengeId, challenge] of activeChallenges.entries()) {
          if (challenge.challengerId === socket.userId || challenge.targetId === socket.userId) {
            activeChallenges.delete(challengeId);
          }
        }
      }
    });
  });

  // Clean up expired challenges (older than 2 minutes)
  setInterval(() => {
    const now = Date.now();
    const EXPIRY = 2 * 60 * 1000; // 2 minutes
    
    for (const [challengeId, challenge] of activeChallenges.entries()) {
      if (now - challenge.timestamp > EXPIRY) {
        activeChallenges.delete(challengeId);
      }
    }
  }, 60 * 1000); // Run every minute
};

