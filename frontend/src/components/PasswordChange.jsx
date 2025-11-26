import React, { useState } from 'react';
import axios from 'axios';
import './PasswordChange.css';

const PasswordChange = ({ onClose }) => {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  // Password change state
  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      const token = localStorage.getItem('accessToken');
      const response = await axios.post(
        'http://127.0.0.1:8000/api/users/change-password/',
        passwordData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      setMessage(response.data.detail);
      setPasswordData({
        current_password: '',
        new_password: '',
        confirm_password: ''
      });

      setTimeout(() => {
        setMessage('Password updated! Redirecting to login...');
        setTimeout(() => {
          // Clear tokens and redirect to login
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          window.location.href = '/login';
        }, 2000);
      }, 3000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to change password');
      setTimeout(() => {
        setError(null);
      }, 5000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="password-change-overlay" onClick={onClose}>
      <div className="password-change-modal" onClick={(e) => e.stopPropagation()}>
        <div className="password-change-header">
          <h2>Change Password</h2>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>

        <div className="password-change-content">
          {message && (
            <div className="success-message">
              <span className="icon">✓</span>
              {message}
            </div>
          )}

          {error && (
            <div className="error-message">
              <span className="icon">✕</span>
              {error}
            </div>
          )}

          <form onSubmit={handlePasswordChange} className="settings-form">
            <p className="form-description">
              Your password must be at least 8 characters and contain uppercase, lowercase, and numbers.
            </p>

            <div className="form-group">
              <label htmlFor="current_password">Current Password</label>
              <input
                type="password"
                id="current_password"
                value={passwordData.current_password}
                onChange={(e) => setPasswordData({
                  ...passwordData,
                  current_password: e.target.value
                })}
                placeholder="Enter current password"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="new_password">New Password</label>
              <input
                type="password"
                id="new_password"
                value={passwordData.new_password}
                onChange={(e) => setPasswordData({
                  ...passwordData,
                  new_password: e.target.value
                })}
                placeholder="Enter new password"
                required
                minLength="8"
              />
              <small>At least 8 characters with uppercase, lowercase, and number</small>
            </div>

            <div className="form-group">
              <label htmlFor="confirm_password">Confirm New Password</label>
              <input
                type="password"
                id="confirm_password"
                value={passwordData.confirm_password}
                onChange={(e) => setPasswordData({
                  ...passwordData,
                  confirm_password: e.target.value
                })}
                placeholder="Confirm new password"
                required
                minLength="8"
              />
            </div>

            <button
              type="submit"
              className="submit-btn"
              disabled={loading}
            >
              {loading ? 'Updating...' : 'Update Password'}
            </button>

            <p className="warning-note">
              ⚠️ You will be logged out after changing your password
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};

export default PasswordChange;
