/**
 * API service - handles all HTTP requests to the backend.
 * Wraps fetch calls with proper error handling and session management.
 */
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

class ApiService {
  constructor() {
    this.baseURL = API_BASE_URL;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      credentials: 'include', // Include cookies for session management
      ...options,
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  // Auth endpoints
  async register(userData) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async login(credentials) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  }

  async logout() {
    return this.request('/auth/logout', {
      method: 'POST',
    });
  }

  async getCsrfToken() {
    return this.request('/auth/csrf-token');
  }

  async getCurrentUser() {
    return this.request('/auth/me');
  }

  // User endpoints
  async getOnlineUsers() {
    return this.request('/users/online');
  }

  async markOnline() {
    return this.request('/users/online', {
      method: 'POST',
    });
  }

  async markOffline() {
    return this.request('/users/offline', {
      method: 'POST',
    });
  }

  async updateStatus(status) {
    return this.request('/users/status', {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  // Lobby endpoints
  async getLobbies() {
    return this.request('/lobby');
  }

  async createLobby(lobbyData) {
    return this.request('/lobby', {
      method: 'POST',
      body: JSON.stringify(lobbyData),
    });
  }

  async joinLobby(lobbyId) {
    return this.request(`/lobby/${lobbyId}/join`, {
      method: 'POST',
    });
  }

  async leaveLobby(lobbyId) {
    return this.request(`/lobby/${lobbyId}/leave`, {
      method: 'POST',
    });
  }

  // Game endpoints
  async getActiveGame() {
    return this.request('/game/active');
  }

  async getGameState(gameUuid) {
    return this.request(`/game/${gameUuid}`);
  }

  async playTile(gameUuid, tileId, side, boardPosition, topValue, bottomValue) {
    return this.request(`/game/${gameUuid}/play`, {
      method: 'POST',
      body: JSON.stringify({ tileId, side, boardPosition, topValue, bottomValue }),
    });
  }

  async drawTile(gameUuid, playerLocation) {
    return this.request(`/game/${gameUuid}/draw`, {
      method: 'POST',
      body: JSON.stringify({ playerLocation }),
    });
  }

  async passTurn(gameUuid) {
    return this.request(`/game/${gameUuid}/pass`, {
      method: 'POST',
    });
  }

  async endGame(gameUuid, winnerId) {
    return this.request(`/game/${gameUuid}/end`, {
      method: 'POST',
      body: JSON.stringify({ winnerId }),
    });
  }

  // Health check
  async healthCheck() {
    return this.request('/health');
  }
}

export default new ApiService();
