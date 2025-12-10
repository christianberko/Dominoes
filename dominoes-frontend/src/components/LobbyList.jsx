/**
 * Lobby list component - shows online players, handles challenges, and displays the chat/rules sections.
 * Manages user status (online/busy) and the challenge popup.
 */
import React, { useState, useEffect } from 'react';
import './LobbyList.css';
import apiService from '../services/api';
import socketService from '../services/socketService';
import LobbyChat from './LobbyChat';
import ChallengePopup from './ChallengePopup';

const LobbyList = ({ user, onLogout, onGameStart }) => {
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [incomingChallenge, setIncomingChallenge] = useState(null);
  const [usersInGames, setUsersInGames] = useState(new Set()); // Track which users are in games

  useEffect(() => {
    // Initialize lobby
    const init = async () => {
      // Mark self as online
      await apiService.markOnline();
      
      // Fetch initial list of online users
      const response = await apiService.getOnlineUsers();
      setOnlineUsers(response.users || []);
      setLoading(false);
    };
    
    init();
    
    // Listen for Socket.IO events when others join/leave
    socketService.socket?.on('user-online', (userData) => {
      setOnlineUsers(prev => {
        // Don't add if already in list or if it's me
        const alreadyInList = prev.find(u => u.id === userData.id);
        const isMe = userData.id === user.id;
        
        if (alreadyInList || isMe) {
          return prev;
        }
        
        return [...prev, userData];
      });
    });
    
    socketService.socket?.on('user-offline', (userData) => {
      setOnlineUsers(prev => prev.filter(u => u.id !== userData.id));
    });
    
    // Register for challenges
    socketService.registerUser({
      id: user.id,
      username: user.username,
      displayName: user.displayName
    });
    
    // Challenge event listeners
    socketService.onChallengeReceived((data) => {
      setIncomingChallenge(data);
    });

    socketService.onChallengeDeclined((data) => {
      alert(`${data.targetName || 'User'} declined your challenge.`);
    });

    socketService.onGameStart((gameData) => {
      if (onGameStart) {
        onGameStart(gameData);
      }
    });

    socketService.onChallengeError((data) => {
      alert(`Challenge error: ${data.message}`);
    });

    // Listen for users becoming busy (in a game)
    socketService.socket?.on('user-busy', (data) => {
      setUsersInGames(prev => new Set([...prev, data.userId]));
    });

    // Listen for users becoming available (game ended)
    socketService.socket?.on('user-available', (data) => {
      setUsersInGames(prev => {
        const newSet = new Set(prev);
        newSet.delete(data.userId);
        return newSet;
      });
    });
    
    // Cleanup on unmount
    return () => {
      socketService.socket?.off('user-online');
      socketService.socket?.off('user-offline');
      socketService.socket?.off('user-busy');
      socketService.socket?.off('user-available');
    };
  }, [user, onGameStart]);

  const handleLogout = async () => {
    await apiService.markOffline();
    onLogout();
  };

  const handleChallenge = (targetUser) => {
    socketService.socket?.emit('send-challenge', {
      challengerId: user.id,
      challengerName: user.username,
      challengerDisplayName: user.displayName,
      targetId: targetUser.id,
      targetName: targetUser.username
    });
    alert(`Challenge sent to ${targetUser.displayName || targetUser.username}!`);
  };

  const handleAcceptChallenge = () => {
    if (incomingChallenge) {
      socketService.socket?.emit('accept-challenge', { challengeId: incomingChallenge.challengeId });
      setIncomingChallenge(null);
    }
  };

  const handleDeclineChallenge = () => {
    if (incomingChallenge) {
      socketService.socket?.emit('decline-challenge', { challengeId: incomingChallenge.challengeId });
      setIncomingChallenge(null);
    }
  };

  if (loading) {
    return (
      <div className="lobby-container">
        <div className="loading">Loading lobby...</div>
      </div>
    );
  }

  return (
    <div className="lobby-container">
      {/* Challenge Popup */}
      {incomingChallenge && (
        <ChallengePopup
          challenger={incomingChallenge.challenger}
          onAccept={handleAcceptChallenge}
          onDecline={handleDeclineChallenge}
        />
      )}

      <div className="lobby-content">
        {/* Left side: Online Users */}
        <div className="lobby-sidebar">
          <div className="lobby-header">
            <h2>Waiting Lobby</h2>
          </div>
          
          <div className="user-info">
            <span>Logged in as: <strong>{user.displayName || user.username}</strong></span>
            <button onClick={handleLogout} className="logout-btn">Logout</button>
          </div>

          <div className="online-users-section">
            <h3>Online Players ({onlineUsers.length})</h3>
            <div className="users-list">
              {onlineUsers.length === 0 ? (
                <div className="no-users">
                  <p>No other players online.</p>
                  <p className="hint">Waiting for opponents...</p>
                </div>
              ) : (
                onlineUsers.map((otherUser) => {
                  const isInGame = usersInGames.has(otherUser.id);
                  return (
                    <div key={otherUser.id} className="user-card">
                      <div className="user-details">
                        <div className="user-name">{otherUser.displayName || otherUser.username}</div>
                        <div className="user-status">
                          <span className={`status-dot ${isInGame ? 'busy' : 'online'}`}></span>
                          {isInGame ? 'Busy' : 'Online'}
                        </div>
                      </div>
                      <button
                        className="challenge-btn"
                        onClick={() => handleChallenge(otherUser)}
                        disabled={isInGame}
                      >
                        {isInGame ? 'Busy' : 'Challenge'}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Middle: Chat */}
        <div className="lobby-main">
          <LobbyChat user={user} />
        </div>

        {/* Right side: Rules */}
        <div className="lobby-rules">
          <div className="rules-section">
            <h3>How to Play</h3>
            <div className="rules-content">
              <div className="rule-item">
                <h4>Objective</h4>
                <p>Be the first player to play all your tiles or have the lowest total when no one can play.</p>
              </div>
              
              <div className="rule-item">
                <h4>Setup</h4>
                <p>Each player starts with 7 tiles. The remaining tiles form the "boneyard".</p>
              </div>
              
              <div className="rule-item">
                <h4>Playing Tiles</h4>
                <p>On your turn, place a tile that matches one end of the board chain. Tiles must connect matching numbers.</p>
              </div>
              
              <div className="rule-item">
                <h4>Tile Matching</h4>
                <p>A tile can be placed on either end of the chain. If needed, flip the tile so the matching number connects.</p>
              </div>
              
              <div className="rule-item">
                <h4>Drawing</h4>
                <p>If you can't play, draw from the boneyard. If the boneyard is empty, pass your turn.</p>
              </div>
              
              <div className="rule-item">
                <h4>Winning</h4>
                <p>Win by playing all your tiles first, or have the lowest total when the game ends.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LobbyList;
