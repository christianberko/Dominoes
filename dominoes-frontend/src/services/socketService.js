/**
 * Socket service - manages the Socket.IO connection and all real-time events.
 * Handles challenges, chat, game events, and user status updates.
 */
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';

class SocketService {
  constructor() {
    this.socket = null;
    this.connected = false;
  }

  connect() {
    if (this.socket && this.connected) {
      return;
    }

    this.socket = io(SOCKET_URL, {
      withCredentials: true,
      transports: ['websocket', 'polling']
    });

    this.socket.on('connect', () => {
      this.connected = true;
    });

    this.socket.on('disconnect', () => {
      this.connected = false;
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ Socket connection error:', error);
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
    }
  }

  // Register user for direct messaging (challenges, etc.)
  registerUser(userData) {
    if (this.socket && this.connected) {
      this.socket.emit('register-user', userData);
    } else {
      console.error('✗ Cannot register - socket not connected!');
    }
  }

  // Lobby Chat Methods
  joinLobby(userData) {
    if (this.socket) {
      this.socket.emit('join-lobby', userData);
    }
  }

  leaveLobby() {
    if (this.socket) {
      this.socket.emit('leave-lobby');
    }
  }

  sendMessage(text) {
    if (this.socket && text.trim()) {
      this.socket.emit('lobby-message', { text: text.trim() });
    }
  }

  // Challenge Methods
  sendChallenge({ challengerId, challengerName, challengerDisplayName, targetId, targetName }) {
    if (this.socket && this.connected) {
      this.socket.emit('send-challenge', {
        challengerId,
        challengerName,
        challengerDisplayName,
        targetId,
        targetName
      });
    } else {
      console.error('✗ Cannot send challenge - socket not connected!');
    }
  }

  acceptChallenge(challengeId) {
    if (this.socket) {
      this.socket.emit('accept-challenge', { challengeId });
    }
  }

  declineChallenge(challengeId) {
    if (this.socket) {
      this.socket.emit('decline-challenge', { challengeId });
    }
  }

  // Event Listeners
  onMessageHistory(callback) {
    if (this.socket) {
      this.socket.on('message-history', callback);
    }
  }

  onNewMessage(callback) {
    if (this.socket) {
      this.socket.on('new-message', callback);
    }
  }

  onUserJoined(callback) {
    if (this.socket) {
      this.socket.on('user-joined', callback);
    }
  }

  onUserLeft(callback) {
    if (this.socket) {
      this.socket.on('user-left', callback);
    }
  }

  // Challenge Event Listeners
  onChallengeReceived(callback) {
    if (this.socket) {
      this.socket.on('challenge-received', callback);
    }
  }

  onChallengeDeclined(callback) {
    if (this.socket) {
      this.socket.on('challenge-declined', callback);
    }
  }

  onGameStart(callback) {
    if (this.socket) {
      this.socket.on('game-start', callback);
    }
  }

  onChallengeError(callback) {
    if (this.socket) {
      this.socket.on('challenge-error', callback);
    }
  }

  // Cleanup chat listeners only (keep challenge listeners)
  removeAllListeners() {
    if (this.socket) {
      this.socket.off('message-history');
      this.socket.off('new-message');
      this.socket.off('user-joined');
      this.socket.off('user-left');
      // Don't remove challenge listeners - they need to persist
    }
  }
}

export default new SocketService();

