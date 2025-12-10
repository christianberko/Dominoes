/**
 * Login form component - handles user login and registration.
 * Gets CSRF token, validates forms, and calls the auth API.
 */
import React, { useState, useEffect } from 'react';
import './LoginForm.css';
import apiService from '../services/api';

const LoginForm = ({ onLogin, onRegister }) => {
  const [csrfToken, setCsrfToken] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    displayName: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchCsrfToken = async () => {
      const response = await apiService.getCsrfToken();
      setCsrfToken(response.csrfToken);
    };
    fetchCsrfToken();
  }, []);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isLogin) {
        await onLogin({
          username: formData.username,
          password: formData.password
        });
      } else {
        if (formData.password !== formData.confirmPassword) {
          throw new Error('Passwords do not match');
        }
        await onRegister({
          username: formData.username,
          password: formData.password,
          displayName: formData.displayName,
          csrfToken: csrfToken  // Include CSRF token in registration
        });
        
        // After successful registration, switch to login mode
        setIsLogin(true);
        setFormData({
          username: '',
          email: '',
          password: '',
          confirmPassword: '',
          displayName: ''
        });
        setError('Registration successful! Please log in.');
        
        // Fetch new CSRF token for next registration attempt
        const response = await apiService.getCsrfToken();
        setCsrfToken(response.csrfToken);
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="retro-login-container">
      <div className="retro-login-card">
        <div className="retro-title-section">
          <h1 className="retro-title">DOMINOES</h1>
          <p className="retro-tagline">A Classic Game</p>
        </div>
        
        {error && <div className={error.includes('successful') ? 'retro-success' : 'retro-error'}>{error}</div>}
        
        <form onSubmit={handleSubmit} className="retro-form">
          
            <div className="retro-form-group">
              <label htmlFor="username" className="retro-label">Username</label>
              <input
                type="text"
                id="username"
                name="username"
                value={formData.username}
                onChange={handleChange}
                placeholder="Enter your username"
                className="retro-input"
                required={!isLogin}
              />
            </div>

            {!isLogin && (
            <div className="retro-form-group">
              <label htmlFor="confirmPassword" className="retro-label">Display Name</label>
              <input
                type="password"
                id="displayName"
                name="displayName"
                value={formData.displayName}
                onChange={handleChange}
                placeholder="Enter your display name"
                className="retro-input"
                required={!isLogin}
              />
            </div>
          )}
          
          
          <div className="retro-form-group">
            <label htmlFor="password" className="retro-label">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Enter your password"
              className="retro-input"
              required
            />
          </div>
          
          {!isLogin && (
            <div className="retro-form-group">
              <label htmlFor="confirmPassword" className="retro-label">Confirm Password</label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="Confirm your password"
                className="retro-input"
                required={!isLogin}
              />
            </div>
          )}
          
          <button 
            type="submit" 
            className="retro-btn retro-btn-primary"
            disabled={loading}
          >
            {loading ? 'Loading...' : (isLogin ? 'LOGIN' : 'REGISTER')}
          </button>
        </form>
        
        <button 
          type="button" 
          className="retro-btn retro-btn-secondary"
          onClick={() => {
            setIsLogin(!isLogin);
            setError('');
            setFormData({
              username: '',
              email: '',
              password: '',
              confirmPassword: '',
              displayName: ''
            });
          }}
        >
          {isLogin ? 'Need an account? Sign Up' : 'Have an account? Sign In'}
        </button>
      </div>
    </div>
  );
};

export default LoginForm;
