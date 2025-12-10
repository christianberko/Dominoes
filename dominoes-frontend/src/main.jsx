/**
 * Entry point for the React app - just renders the App component.
 */
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './App.css'

ReactDOM.createRoot(document.getElementById('app')).render(
  // Strict Mode disabled to prevent double-mounting during development
  // which causes users to be marked offline prematurely
  <App />
)

