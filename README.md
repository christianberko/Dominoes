ISTE 442 Project - Online Multiplayer Dominoes Game

A real-time multiplayer dominoes game built with React and Node.js. Players can challenge each other, play games in real-time, and chat in the lobby. Everything syncs up via Socket.IO so moves happen instantly.

## Repository

https://github.com/christianberko/Dominoes

## Architecture Overview

The project is split into two main parts - a React frontend and a Node.js/Express backend. They communicate via REST APIs for regular stuff (login, game state, etc.) and Socket.IO for real-time events (moves, chat, challenges).

### Frontend (`dominoes-frontend/`)

The frontend is a React app built with Vite. It handles all the UI, user interactions, and connects to the backend via:
- **REST API** (`services/api.js`) - For auth, game state, user management
- **Socket.IO** (`services/socketService.js`) - For real-time events like moves, chat, challenges

Main components:
- `LoginForm` - User registration and login
- `LobbyList` - Shows online players, handles challenges, displays chat and rules
- `GameBoard` - The actual game interface where you play tiles
- `SVGBoard` - Renders the game board using SVG
- `LobbyChat` - Chat component for the lobby

### Backend (`backend/`)

The backend is an Express server that handles:
- **REST Routes** (`routes/`) - Auth, game operations, user management
- **Socket.IO Handlers** (`socket/`) - Real-time game events, challenges, chat
- **Database** - Uses Supabase (PostgreSQL) for persistence

Main parts:
- `server.js` - Sets up Express, Socket.IO, middleware, routes
- `routes/auth.js` - Registration, login, session management with CSRF protection
- `routes/game.js` - Creating games, playing tiles, drawing, passing, ending games
- `routes/users.js` - Online/offline user status
- `socket/challengeHandler.js` - Manages challenges between players
- `socket/gameHandler.js` - Handles real-time game moves and events
- `socket/lobbyChatHandler.js` - Lobby chat messaging


## How It Works

### Authentication Flow

1. User registers/logs in via `LoginForm`
2. Backend validates credentials, creates session with CSRF token
3. Frontend stores session cookie, user data in state
4. Socket.IO connection established for real-time features

### Game Flow

1. **Lobby** - Users see online players, can send challenges
2. **Challenge** - Player A challenges Player B, popup appears
3. **Accept** - Game created in database, both players join Socket.IO room
4. **Playing** - Moves sent via Socket.IO, game state synced from database
5. **End** - Winner determined, game marked complete, players return to lobby

### Real-Time Communication

- **Socket.IO rooms** - Each game has its own room for broadcasting moves
- **Lobby room** - All users in lobby for chat and status updates
- **Direct messaging** - Challenges sent directly to target user's socket

### Data Flow

- **Game state** - Stored in Supabase, loaded on game start/reconnect
- **Real-time moves** - Broadcast via Socket.IO, then persisted to database
- **User status** - In-memory Map on backend, synced via Socket.IO events





