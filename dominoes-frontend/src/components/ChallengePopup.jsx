/**
 * Challenge popup component - shows when a player receives a challenge.
 * Simple overlay with accept/decline buttons.
 */
import React from 'react';
import './ChallengePopup.css';

const ChallengePopup = ({ challenger, onAccept, onDecline }) => {
  return (
    <div className="challenge-overlay">
      <div className="challenge-popup">
        <h3 className="challenge-title">Incoming Challenge!</h3>
        <p className="challenge-message">
          <span className="challenger-name">{challenger.displayName || challenger.username}</span> has challenged you to a game of Dominoes!
        </p>
        <div className="challenge-actions">
          <button className="challenge-accept-btn" onClick={onAccept}>Accept</button>
          <button className="challenge-decline-btn" onClick={onDecline}>Decline</button>
        </div>
      </div>
    </div>
  );
};

export default ChallengePopup;

