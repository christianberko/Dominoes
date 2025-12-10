/**
 * Lobby chat handler - manages real-time chat messages in the lobby.
 * Stores message history and broadcasts new messages to everyone.
 */
const messageHistory = []; // Store last 50 messages
const MAX_HISTORY = 50;

module.exports = (io) => {
  io.on('connection', (socket) => {
    // User joins lobby chat
    socket.on('join-lobby', (userData) => {
      socket.join('lobby');
      socket.userData = userData;
      
      // Send message history to the new user
      socket.emit('message-history', messageHistory);
      
      // Notify others that user joined
      socket.to('lobby').emit('user-joined', {
        username: userData.username,
        timestamp: Date.now()
      });
    });

    // User sends a message
    socket.on('lobby-message', (messageData) => {
      if (!socket.userData) {
        console.log('❌ Message from unauthenticated socket');
        return;
      }

      const message = {
        id: `${Date.now()}-${socket.id}`,
        username: socket.userData.username,
        text: messageData.text,
        timestamp: Date.now()
      };

      // Add to history
      messageHistory.push(message);
      if (messageHistory.length > MAX_HISTORY) {
        messageHistory.shift(); // Remove oldest
      }

      // Broadcast to everyone in lobby (including sender)
      io.to('lobby').emit('new-message', message);
    });

    // User leaves lobby
    socket.on('leave-lobby', () => {
      if (socket.userData) {
        socket.to('lobby').emit('user-left', {
          username: socket.userData.username,
          timestamp: Date.now()
        });
        
        socket.leave('lobby');
      }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      if (socket.userData) {
        socket.to('lobby').emit('user-left', {
          username: socket.userData.username,
          timestamp: Date.now()
        });
      }
    });
  });
};

