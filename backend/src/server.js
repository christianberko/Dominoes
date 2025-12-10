/**
 * Main server file - sets up Express, Socket.IO, middleware, and routes.
 * Basically the entry point that gets everything running.
 */
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const session = require('express-session');
const path = require('path');
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { generateCsrfToken } = require('./utils/tokenGenerator');

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseServiceKey = process.env.REACT_APP_SUPABASE_SERVICE_KEY;

const supabase = createClient(
  supabaseUrl,
  supabaseServiceKey
);

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO with CORS
const io = socketIo(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? true // Allow same origin in production
      : "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Middleware
app.use(helmet());

app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? true // Allow same origin in production
    : "http://localhost:5173",
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration with in-memory store (sufficient for local auth testing)
app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback-secret-key',
  resave: true, // Force session to be saved back to store
  saveUninitialized: true, // Force uninitialized session to be saved
  cookie: {
    secure: false, // Allow non-HTTPS in development
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax' // Allow same-site cookies
  },
  name: 'connect.sid' // Default express-session cookie name
}));

// CSRF Token Generation Middleware (must be after session middleware)
app.use((req, res, next) => {
  // Generate token if it doesn't exist in session
  if (!req.session.csrfToken) {
    const token = generateCsrfToken(req.ip, req.headers['user-agent'], Date.now());
    req.session.csrfToken = token;
    req.session.csrfTimestamp = Date.now();
    req.session.csrfUserAgent = req.headers['user-agent'];
    req.session.csrfIP = req.ip;
  }
  next();
});

// Initialize Supabase client


// Make Supabase and Socket.IO available to routes
app.locals.supabase = supabase;
app.locals.io = io;

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/game', require('./routes/game'));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV 
  });
});

// Serve static files from React app in production
if (process.env.NODE_ENV === 'production') {
  const frontendPath = path.join(__dirname, '../../dominoes-frontend/dist');
  app.use(express.static(frontendPath));
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler - serve React app for non-API routes in production
app.use((req, res) => {
  if (process.env.NODE_ENV === 'production' && !req.path.startsWith('/api')) {
    const frontendPath = path.join(__dirname, '../../dominoes-frontend/dist/index.html');
    res.sendFile(frontendPath);
  } else {
    res.status(404).json({ error: 'Route not found' });
  }
});
// Socket.IO Handlers
require('./socket/lobbyChatHandler')(io);
require('./socket/challengeHandler')(io, supabase);
require('./socket/gameHandler')(io, supabase);

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Socket.IO chat server ready`);
  console.log(`Socket.IO challenge system ready`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = { app, server, io };
