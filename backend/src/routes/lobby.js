/**
 * Lobby routes - handles fetching lobby data from the database.
 * Not really used much since we're doing most of this via Socket.IO now.
 */
const express = require('express');
const router = express.Router();

// Get lobby list
router.get('/', async (req, res) => {
  try {
    const { data, error } = await req.app.locals.supabase
      .from('game_lobbies')
      .select(`
        *,
        players:game_players(count)
      `)
      .eq('status', 'waiting')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Lobby fetch error:', error);
      return res.status(500).json({ error: 'Failed to fetch lobbies' });
    }

    res.json({ lobbies: data || [] });
  } catch (error) {
    console.error('Lobby error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new lobby
router.post('/', async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { name, maxPlayers = 4 } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Lobby name is required' });
    }

    const { data, error } = await req.app.locals.supabase
      .from('game_lobbies')
      .insert([
        {
          name,
          max_players: maxPlayers,
          created_by: req.session.userId,
          status: 'waiting',
          created_at: new Date().toISOString()
        }
      ])
      .select()
      .single();

    if (error) {
      console.error('Lobby creation error:', error);
      return res.status(500).json({ error: 'Failed to create lobby' });
    }

    // Add creator as first player
    await req.app.locals.supabase
      .from('game_players')
      .insert([
        {
          lobby_id: data.id,
          user_id: req.session.userId,
          username: req.session.username,
          position: 0,
          joined_at: new Date().toISOString()
        }
      ]);

    res.json({ lobby: data });
  } catch (error) {
    console.error('Lobby creation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Join lobby
router.post('/:id/join', async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const lobbyId = req.params.id;

    // Check if lobby exists and has space
    const { data: lobby, error: lobbyError } = await req.app.locals.supabase
      .from('game_lobbies')
      .select('*, players:game_players(*)')
      .eq('id', lobbyId)
      .single();

    if (lobbyError || !lobby) {
      return res.status(404).json({ error: 'Lobby not found' });
    }

    if (lobby.status !== 'waiting') {
      return res.status(400).json({ error: 'Lobby is not accepting players' });
    }

    if (lobby.players.length >= lobby.max_players) {
      return res.status(400).json({ error: 'Lobby is full' });
    }

    // Check if user is already in lobby
    const existingPlayer = lobby.players.find(p => p.user_id === req.session.userId);
    if (existingPlayer) {
      return res.status(400).json({ error: 'Already in this lobby' });
    }

    // Add player to lobby
    const { error: joinError } = await req.app.locals.supabase
      .from('game_players')
      .insert([
        {
          lobby_id: lobbyId,
          user_id: req.session.userId,
          username: req.session.username,
          position: lobby.players.length,
          joined_at: new Date().toISOString()
        }
      ]);

    if (joinError) {
      console.error('Join lobby error:', joinError);
      return res.status(500).json({ error: 'Failed to join lobby' });
    }

    res.json({ message: 'Successfully joined lobby' });
  } catch (error) {
    console.error('Join lobby error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Leave lobby
router.post('/:id/leave', async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const lobbyId = req.params.id;

    const { error } = await req.app.locals.supabase
      .from('game_players')
      .delete()
      .eq('lobby_id', lobbyId)
      .eq('user_id', req.session.userId);

    if (error) {
      console.error('Leave lobby error:', error);
      return res.status(500).json({ error: 'Failed to leave lobby' });
    }

    res.json({ message: 'Successfully left lobby' });
  } catch (error) {
    console.error('Leave lobby error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
