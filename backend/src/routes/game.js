/**
 * Game routes - handles all the game-related API calls.
 * Creating games, playing tiles, drawing, passing turns, ending games, etc.
 */
const express = require('express');
const router = express.Router();

// Middleware to check authentication
const requireAuth = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

// ============================================
// CREATE NEW GAME (called when challenge accepted)
// ============================================
router.post('/create', requireAuth, async (req, res) => {
  try {
    const { gameUuid, player1Id, player2Id, tiles } = req.body;

    // Create game record
    const { data: game, error: gameError } = await req.app.locals.supabase
      .from('Games')
      .insert([{
        game_uuid: gameUuid,
        player1_id: player1Id,
        player2_id: player2Id,
        current_turn: player1Id, // Player 1 (challenger) starts - store as player ID
        status: 'active',
        winner_id: 0, // Placeholder until game ends
        boneyard_count: 14
      }])
      .select()
      .single();

    if (gameError) {
      console.error('❌ Game creation error:', gameError);
      return res.status(500).json({ error: 'Failed to create game' });
    }

    // Insert all tiles
    const tilesToInsert = tiles.map(tile => ({
      gameID: game.gameID,
      top_value: tile.value[0],
      bottom_value: tile.value[1],
      location: tile.location,
      board_position: tile.board_position
    }));

    const { error: tilesError } = await req.app.locals.supabase
      .from('GameTiles')
      .insert(tilesToInsert);

    if (tilesError) {
      console.error('❌ Tiles insertion error:', tilesError);
      return res.status(500).json({ error: 'Failed to create game tiles' });
    }

    res.json({ 
      success: true, 
      gameID: game.gameID,
      gameUuid: game.game_uuid
    });
  } catch (error) {
    console.error('❌ Create game error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// GET ACTIVE GAME FOR CURRENT USER
// ============================================
router.get('/active', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;

    // Find active game where user is player1 or player2
    const { data: game, error: gameError } = await req.app.locals.supabase
      .from('Games')
      .select('*')
      .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (gameError || !game) {
      // No active game found - this is OK, not an error
      return res.json({ game: null });
    }

    // Get player info from Users table
    const { data: player1Data, error: p1Error } = await req.app.locals.supabase
      .from('Users')
      .select('userID, username, display_name')
      .eq('userID', game.player1_id)
      .single();

    const { data: player2Data, error: p2Error } = await req.app.locals.supabase
      .from('Users')
      .select('userID, username, display_name')
      .eq('userID', game.player2_id)
      .single();

    if (p1Error || p2Error || !player1Data || !player2Data) {
      console.error('❌ Error fetching player data:', p1Error || p2Error);
      return res.status(500).json({ error: 'Failed to load player data' });
    }

    // Format response to match game-start event structure
    const gameData = {
      gameId: game.game_uuid,
      gameDbId: game.gameID,
      player1: {
        id: player1Data.userID,
        username: player1Data.username,
        displayName: player1Data.display_name || player1Data.username
      },
      player2: {
        id: player2Data.userID,
        username: player2Data.username,
        displayName: player2Data.display_name || player2Data.username
      }
    };

    res.json({ game: gameData });
  } catch (error) {
    console.error('❌ Get active game error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// LOAD GAME STATE
// ============================================
router.get('/:gameUuid', requireAuth, async (req, res) => {
  try {
    const { gameUuid } = req.params;

    // Get game
    const { data: game, error: gameError } = await req.app.locals.supabase
      .from('Games')
      .select('*')
      .eq('game_uuid', gameUuid)
      .single();

    if (gameError || !game) {
      console.error('❌ Game not found:', gameError);
      return res.status(404).json({ error: 'Game not found' });
    }

    // Get all tiles for this game
    const { data: tiles, error: tilesError } = await req.app.locals.supabase
      .from('GameTiles')
      .select('*')
      .eq('gameID', game.gameID)
      .order('board_position', { ascending: true });

    if (tilesError) {
      console.error('❌ Tiles fetch error:', tilesError);
      return res.status(500).json({ error: 'Failed to load tiles' });
    }

    res.json({ 
      game,
      tiles: tiles.map((t, index) => {
        // Handle both titleID (database column) and tileID (if Supabase normalizes it)
        const tileId = t.titleID || t.tileID || t.titleid || `tile-${index}`;
        if (!tileId) {
          console.error('❌ Tile missing ID:', t);
        }
        return {
          tileID: tileId,
        value: [t.top_value, t.bottom_value],
        location: t.location,
        board_position: t.board_position
        };
      })
    });
  } catch (error) {
    console.error('❌ Load game error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// PLAY TILE (move tile from hand to board)
// ============================================
router.post('/:gameUuid/play', requireAuth, async (req, res) => {
  try {
    const { gameUuid } = req.params;
    const { tileId, side, boardPosition, topValue, bottomValue } = req.body;

    // Get game to find gameID
    const { data: game, error: gameError } = await req.app.locals.supabase
      .from('Games')
      .select('gameID, current_turn, player1_id, player2_id')
      .eq('game_uuid', gameUuid)
      .single();

    if (gameError || !game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Verify it's the current player's turn
    if (game.current_turn !== req.session.userId) {
      return res.status(403).json({ error: 'Not your turn' });
    }

    // Verify the tile exists and is in the player's hand
    const playerLocation = game.current_turn === game.player1_id ? 'player1_hand' : 'player2_hand';
      const { data: tileToPlay, error: tileCheckError } = await req.app.locals.supabase
      .from('GameTiles')
      .select('*')
      .eq('titleID', tileId)
      .eq('gameID', game.gameID)
      .eq('location', playerLocation)
      .single();

    if (tileCheckError || !tileToPlay) {
      return res.status(400).json({ error: 'Tile not found in your hand' });
    }

    // If placing on left (boardPosition 0), shift all existing board tiles right
    if (side === 'left' && boardPosition === 0) {
      const { data: existingBoardTiles } = await req.app.locals.supabase
        .from('GameTiles')
        .select('titleID, board_position')
        .eq('gameID', game.gameID)
        .eq('location', 'board')
        .order('board_position', { ascending: true });

      if (existingBoardTiles && existingBoardTiles.length > 0) {
        // Update all existing board tiles to shift right
        for (const existingTile of existingBoardTiles) {
          await req.app.locals.supabase
            .from('GameTiles')
            .update({ board_position: existingTile.board_position + 1 })
            .eq('titleID', existingTile.titleID);
        }
      }
    }

    // Update tile location to board with flipped values if provided
    // Note: Database column is "titleID" (with lowercase 'i')
    const updateData = { 
      location: 'board',
      board_position: boardPosition
    };
    
    // If flipped values are provided, update them (tile was flipped to match board)
    if (topValue !== undefined && bottomValue !== undefined) {
      updateData.top_value = topValue;
      updateData.bottom_value = bottomValue;
    }
    
    const { data: updatedTile, error: updateError } = await req.app.locals.supabase
      .from('GameTiles')
      .update(updateData)
      .eq('titleID', tileId)
      .eq('gameID', game.gameID)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Tile update error:', updateError);
      return res.status(500).json({ error: 'Failed to play tile' });
    }

    // Record the move
    await req.app.locals.supabase
      .from('GameMoves')
      .insert([{
        gameID: game.gameID,
        player_id: req.session.userId,
        move_type: 'play_tile',
        tile_top: updatedTile.top_value,
        tile_bottom: updatedTile.bottom_value,
        play_side: side
      }]);

    // Switch turn (current_turn stores player ID)
    const nextTurnPlayerId = game.current_turn === game.player1_id 
      ? game.player2_id 
      : game.player1_id;
    await req.app.locals.supabase
      .from('Games')
      .update({ current_turn: nextTurnPlayerId })
      .eq('gameID', game.gameID);

    res.json({ success: true, tile: updatedTile, nextTurn: nextTurnPlayerId });
  } catch (error) {
    console.error('❌ Play tile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// DRAW TILE (move tile from boneyard to hand)
// ============================================
router.post('/:gameUuid/draw', requireAuth, async (req, res) => {
  try {
    const { gameUuid } = req.params;
    const { playerLocation } = req.body; // 'player1_hand' or 'player2_hand'

    // Get game
    const { data: game, error: gameError } = await req.app.locals.supabase
      .from('Games')
      .select('gameID, boneyard_count, current_turn, player1_id, player2_id')
      .eq('game_uuid', gameUuid)
      .single();

    if (gameError || !game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Verify it's the current player's turn
    if (game.current_turn !== req.session.userId) {
      return res.status(403).json({ error: 'Not your turn' });
    }

    if (game.boneyard_count <= 0) {
      return res.status(400).json({ error: 'Boneyard is empty' });
    }

    // Get a random tile from boneyard
    const { data: boneyardTiles, error: fetchError } = await req.app.locals.supabase
      .from('GameTiles')
      .select('*')
      .eq('gameID', game.gameID)
      .eq('location', 'boneyard')
      .limit(1);

    if (fetchError || !boneyardTiles || boneyardTiles.length === 0) {
      return res.status(400).json({ error: 'No tiles in boneyard' });
    }

    const drawnTile = boneyardTiles[0];

    // Move tile to player's hand
    const { data: updatedTile, error: updateError } = await req.app.locals.supabase
      .from('GameTiles')
      .update({ location: playerLocation })
      .eq('titleID', drawnTile.titleID)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Draw tile error:', updateError);
      return res.status(500).json({ error: 'Failed to draw tile' });
    }

    // Update boneyard count and switch turn
    const nextTurnPlayerId = game.current_turn === game.player1_id 
      ? game.player2_id 
      : game.player1_id;
    await req.app.locals.supabase
      .from('Games')
      .update({ 
        boneyard_count: game.boneyard_count - 1,
        current_turn: nextTurnPlayerId
      })
      .eq('gameID', game.gameID);

    // Record the move
    await req.app.locals.supabase
      .from('GameMoves')
      .insert([{
        gameID: game.gameID,
        player_id: req.session.userId,
        move_type: 'draw_tile',
        tile_top: updatedTile.top_value,
        tile_bottom: updatedTile.bottom_value
      }]);

    res.json({ 
      success: true, 
      tile: {
        tileID: updatedTile.titleID || updatedTile.tileID,
        value: [updatedTile.top_value, updatedTile.bottom_value],
        location: updatedTile.location
      },
      boneyardCount: game.boneyard_count - 1
    });
  } catch (error) {
    console.error('❌ Draw tile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// PASS TURN
// ============================================
router.post('/:gameUuid/pass', requireAuth, async (req, res) => {
  try {
    const { gameUuid } = req.params;

    // Get game
    const { data: game, error: gameError } = await req.app.locals.supabase
      .from('Games')
      .select('gameID, current_turn, player1_id, player2_id')
      .eq('game_uuid', gameUuid)
      .single();

    if (gameError || !game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Verify it's the current player's turn
    if (game.current_turn !== req.session.userId) {
      return res.status(403).json({ error: 'Not your turn' });
    }

    // Record the pass
    await req.app.locals.supabase
      .from('GameMoves')
      .insert([{
        gameID: game.gameID,
        player_id: req.session.userId,
        move_type: 'pass'
      }]);

    // Switch turn (current_turn stores player ID)
    const nextTurnPlayerId = game.current_turn === game.player1_id 
      ? game.player2_id 
      : game.player1_id;
    await req.app.locals.supabase
      .from('Games')
      .update({ current_turn: nextTurnPlayerId })
      .eq('gameID', game.gameID);

    res.json({ success: true, nextTurn: nextTurnPlayerId });
  } catch (error) {
    console.error('❌ Pass turn error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// END GAME (set winner)
// ============================================
router.post('/:gameUuid/end', requireAuth, async (req, res) => {
  try {
    const { gameUuid } = req.params;
    const { winnerId } = req.body;

    const { error } = await req.app.locals.supabase
      .from('Games')
      .update({ 
        status: 'completed',
        winner_id: winnerId
      })
      .eq('game_uuid', gameUuid);

    if (error) {
      console.error('❌ End game error:', error);
      return res.status(500).json({ error: 'Failed to end game' });
    }

    console.log('OK Game ended, winner:', winnerId);

    res.json({ success: true });
  } catch (error) {
    console.error('❌ End game error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
