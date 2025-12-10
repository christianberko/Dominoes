/**
 * Lobby chat component - displays the chat messages and lets users send messages in the lobby.
 * Connects to the socket service for real-time messaging.
 */
import React, { useState, useEffect, useRef } from 'react';
import './LobbyChat.css';
import socketService from '../services/socketService';

const LobbyChat = ({ user }) => {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    // Join lobby (socket is already connected in App.jsx)
    socketService.joinLobby({ username: user.username, id: user.id });

    // Listen for message history
    socketService.onMessageHistory((history) => {
      setMessages(history);
    });

    // Listen for new messages
    socketService.onNewMessage((message) => {
      setMessages(prev => [...prev, message]);
    });

    // Listen for user joined
    socketService.onUserJoined((data) => {
      const systemMessage = {
        id: `system-joined-${data.username}-${Date.now()}-${Math.random()}`,
        type: 'system',
        text: `${data.username} joined the lobby`,
        timestamp: data.timestamp
      };
      setMessages(prev => [...prev, systemMessage]);
    });

    // Listen for user left
    socketService.onUserLeft((data) => {
      const systemMessage = {
        id: `system-left-${data.username}-${Date.now()}-${Math.random()}`,
        type: 'system',
        text: `${data.username} left the lobby`,
        timestamp: data.timestamp
      };
      setMessages(prev => [...prev, systemMessage]);
    });

    // Cleanup on unmount
    return () => {
      socketService.leaveLobby();
    };
  }, [user]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    
    if (inputText.trim()) {
      socketService.sendMessage(inputText);
      setInputText('');
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div className="lobby-chat">
      <div className="chat-header">
        <h3>💬 Lobby Chat</h3>
      </div>

      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="chat-empty">
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map((message) => (
            <div 
              key={message.id} 
              className={`chat-message ${message.type === 'system' ? 'system-message' : ''} ${message.username === user.username ? 'own-message' : ''}`}
            >
              {message.type === 'system' ? (
                <div className="system-text">{message.text}</div>
              ) : (
                <>
                  <div className="message-header">
                    <span className="message-username">{message.username}</span>
                    <span className="message-time">{formatTime(message.timestamp)}</span>
                  </div>
                  <div className="message-text">{message.text}</div>
                </>
              )}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <form className="chat-input-form" onSubmit={handleSendMessage}>
        <input
          type="text"
          className="chat-input"
          placeholder="Type a message..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          maxLength={200}
        />
        <button 
          type="submit" 
          className="chat-send-btn"
          disabled={!inputText.trim()}
        >
          Send
        </button>
      </form>
    </div>
  );
};

export default LobbyChat;

