/**
 * User routes - manages online/offline status for users in the lobby.
 * Keeps track of who's online and broadcasts it via Socket.IO.
 */
const express = require('express');
const router = express.Router();

// Simple in-memory store for online users
const onlineUsers = new Map(); // userId -> { id, username, displayName }

// Middleware to check authentication
const requireAuth = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

// Get all online users (excluding yourself)
router.get('/online', requireAuth, (req, res) => {
  try {
    const currentUserId = req.session.userId;
    const allUsers = Array.from(onlineUsers.values());
    
    // Filter out current user
    const otherUsers = allUsers.filter(u => u.id !== currentUserId);
    
    res.json({ users: otherUsers });
  } catch (error) {
    console.error('Get online users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Mark user as online (called when entering lobby)
router.post('/online', requireAuth, (req, res) => {
  try {
    const user = {
      id: req.session.userId,
      username: req.session.username,
      displayName: req.session.displayName || req.session.username
    };
    
    onlineUsers.set(user.id, user);
    
    console.log(`OK ${user.username} marked ONLINE. Total online: ${onlineUsers.size}`);
    
    // Notify Socket.IO that user joined
    if (req.app.locals.io) {
      req.app.locals.io.emit('user-online', user);
    } else {
      console.error('❌ Socket.IO not available on app.locals.io');
    }
    
    res.json({ message: 'Marked as online', user });
  } catch (error) {
    console.error('Mark online error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Mark user as offline (called when leaving lobby or logging out)
router.post('/offline', requireAuth, (req, res) => {
  try {
    const userId = req.session.userId;
    const username = req.session.username;
    
    onlineUsers.delete(userId);
    
    console.log(`✗ ${username} marked OFFLINE. Total online: ${onlineUsers.size}`);
    
    // Notify Socket.IO that user left
    if (req.app.locals.io) {
      req.app.locals.io.emit('user-offline', { id: userId, username });
    } else {
      console.error('❌ Socket.IO not available on app.locals.io');
    }
    
    res.json({ message: 'Marked as offline' });
  } catch (error) {
    console.error('Mark offline error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Export the Map so Socket.IO handlers can access it
module.exports = router;
module.exports.onlineUsers = onlineUsers;
