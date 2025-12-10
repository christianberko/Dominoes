/**
 * Main App component - handles routing between login, lobby, and game views.
 * Manages user authentication state and connects to the socket service.
 */
import React, { useState, useEffect } from 'react';
import './App.css';
import LoginForm from './components/LoginForm';
import LobbyList from './components/LobbyList';
import GameBoard from './components/GameBoard';
import socketService from './services/socketService';
import apiService from './services/api';

function App() {
  const [user, setUser] = useState(null);
  const [currentView, setCurrentView] = useState('login'); // login, lobby, game
  const [currentGame, setCurrentGame] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    checkAuthStatus();
    
    // Connect to socket
    socketService.connect();

    return () => {
      socketService.disconnect();
    };
  }, []);

  const checkAuthStatus = async () => {
    try {
      const response = await apiService.getCurrentUser();
      setUser(response.user);
      
      // Check if user has an active game
      try {
        const activeGameResponse = await apiService.getActiveGame();
        if (activeGameResponse.game) {
          // User has an active game - resume it
          setCurrentGame(activeGameResponse.game);
          setCurrentView('game');
        } else {
          // No active game - go to lobby
          setCurrentView('lobby');
        }
      } catch (gameError) {
        // If checking for active game fails, just go to lobby
        console.error('Error checking for active game:', gameError);
        setCurrentView('lobby');
      }
    } catch (error) {
      console.log('User not authenticated');
      setCurrentView('login');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (credentials) => {
    try {
      const response = await apiService.login(credentials);
      setUser(response.user);
      setCurrentView('lobby');
      // Don't mark online here - let LobbyList component handle it
    } catch (error) {
      throw error;
    }
  };

  const handleRegister = async (userData) => {
    try {
      const response = await apiService.register(userData);
      // Don't auto-login after registration
      // Let LoginForm handle the redirect to login screen
    } catch (error) {
      throw error;
    }
  };

  const handleLogout = async () => {
    try {
      await apiService.markOffline();
      await apiService.logout();
      setUser(null);
      setCurrentView('login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleGameStart = (gameData) => {
    setCurrentGame(gameData);
    setCurrentView('game');
  };

  const handleLeaveGame = () => {
    setCurrentGame(null);
    setCurrentView('lobby');
  };

  if (loading) {
    return (
      <div className="app">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="app">
      <main className={currentView === 'login' ? 'app-main-login' : 'app-main'}>
        {currentView === 'login' && (
          <LoginForm 
            onLogin={handleLogin}
            onRegister={handleRegister}
          />
        )}
        
        {currentView === 'lobby' && user && (
          <LobbyList 
            user={user}
            onLogout={handleLogout}
            onGameStart={handleGameStart}
          />
        )}
        
        {currentView === 'game' && user && currentGame && (
          <GameBoard 
            gameData={currentGame}
            currentUser={user}
            onLeaveGame={handleLeaveGame}
          />
        )}
      </main>
    </div>
  );
}

export default App;
