/**
 * Auth routes - handles user registration and login.
 * Does the CSRF token validation and session management stuff.
 */
const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseServiceKey = process.env.REACT_APP_SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);
// Register new user
router.post('/register', async (req, res) => {
  try {
    const { username, displayName, password, csrfToken } = req.body;
    
    // ===== CSRF TOKEN VALIDATION =====
    
    // 1. Check token exists and matches
    if (!csrfToken || csrfToken !== req.session.csrfToken) {
      return res.status(403).json({ error: 'Invalid or missing security token' });
    }
    
    // 2. Check user info matches (IP and User-Agent)
    if (process.env.NODE_ENV === 'production') {
      if (req.ip !== req.session.csrfIP) {
        return res.status(403).json({ error: 'Security validation failed - IP mismatch' });
      }
      
      if (req.headers['user-agent'] !== req.session.csrfUserAgent) {
        return res.status(403).json({ error: 'Security validation failed - Browser mismatch' });
      }
    }
    
    // 3. Check token hasn't expired (10 minutes)
    const TOKEN_EXPIRY = 10 * 60 * 1000; // 10 minutes in milliseconds
    const tokenAge = Date.now() - req.session.csrfTimestamp;
    if (tokenAge > TOKEN_EXPIRY) {
      return res.status(403).json({ error: 'Security token expired. Please refresh the page.' });
    }
    
    // 4. Clear token after successful validation (one-time use)
    delete req.session.csrfToken;
    delete req.session.csrfTimestamp;
    delete req.session.csrfUserAgent;
    delete req.session.csrfIP;
    
    // ===== PROCEED WITH NORMAL REGISTRATION =====
    
    if (!username || !displayName || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Insert user into Supabase
    const { data, error } = await supabase
      .from('Users')
      .insert([
        {
          username,
          display_name: displayName,
          password_hash: hashedPassword
        }
      ])
      .select()
      .single();

    if (error) {
      console.error('Registration error:', error);
      
      // Check for duplicate username
      if (error.code === '23505') {
        return res.status(400).json({ error: 'Username already exists' });
    }

      return res.status(400).json({ 
        error: 'Registration failed', 
        details: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }

    // Don't auto-login after registration
    // User will need to log in manually after registering

    res.json({ 
      message: 'Registration successful'
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login user
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Get user from Supabase
      const { data, error } = await supabase
      .from('Users')
      .select('*')
      .eq('username', username)
      .single();

    if (error || !data) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!data.password_hash) {
      console.error('User found but no password hash in database');
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, data.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Set session - try different possible column names
    const userId = data.userID || data.user_id || data.id;
    
    if (!userId) {
      console.error('❌ No user ID found in any expected column!');
      return res.status(500).json({ error: 'Database configuration error' });
    }
    
    req.session.userId = userId;
    req.session.username = data.username;
    req.session.displayName = data.display_name;

    // Save session before responding
    req.session.save((err) => {
      if (err) {
        console.error('❌ Session save error:', err);
        return res.status(500).json({ error: 'Login failed' });
      }
      
      console.log('OK Login successful:', data.username);

    res.json({ 
      message: 'Login successful',
        user: { id: userId, username: data.username, displayName: data.display_name }
      });
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Logout user
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.json({ message: 'Logout successful' });
  });
});

router.get('/csrf-token', (req, res) => {
  res.json({ csrfToken: req.session.csrfToken });
});

// Get current user
router.get('/me', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  res.json({ 
    user: { 
      id: req.session.userId, 
      username: req.session.username 
    } 
  });
});

module.exports = router;
