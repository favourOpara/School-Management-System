import React, { useState } from 'react';
import axios from 'axios';
import './AdminProfileSettings.css';

const AdminProfileSettings = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState('username');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  // Username change state
  const [usernameData, setUsernameData] = useState({
    new_username: '',
    current_password: ''
  });

  // Password change state
  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });

  const handleUsernameChange = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      const token = localStorage.getItem('accessToken');
      const response = await axios.post(
        'http://127.0.0.1:8000/api/users/admin/change-username/',
        usernameData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      setMessage(response.data.detail);
      setUsernameData({ new_username: '', current_password: '' });

      // Update username in localStorage
      localStorage.setItem('userName', response.data.new_username);
      const userData = JSON.parse(localStorage.getItem('user') || '{}');
      userData.username = response.data.new_username;
      localStorage.setItem('user', JSON.stringify(userData));

      // Reload the page to update the greeting
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to change username');
      setTimeout(() => {
        setError(null);
      }, 5000);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      const token = localStorage.getItem('accessToken');
      const response = await axios.post(
        'http://127.0.0.1:8000/api/users/admin/change-password/',
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
    <div className="admin-profile-overlay" onClick={onClose}>
      <div className="admin-profile-modal" onClick={(e) => e.stopPropagation()}>
        <div className="admin-profile-header">
          <h2>Account Settings</h2>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>

        <div className="admin-profile-tabs">
          <button
            className={`tab-btn ${activeTab === 'username' ? 'active' : ''}`}
            onClick={() => setActiveTab('username')}
          >
            Change Username
          </button>
          <button
            className={`tab-btn ${activeTab === 'password' ? 'active' : ''}`}
            onClick={() => setActiveTab('password')}
          >
            Change Password
          </button>
        </div>

        <div className="admin-profile-content">
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

          {activeTab === 'username' && (
            <form onSubmit={handleUsernameChange} className="settings-form">
              <h3>Change Your Username</h3>
              <p className="form-description">
                Your username is how you log in to the system. Choose a unique username.
              </p>

              <div className="form-group">
                <label htmlFor="new_username">New Username</label>
                <input
                  type="text"
                  id="new_username"
                  value={usernameData.new_username}
                  onChange={(e) => setUsernameData({
                    ...usernameData,
                    new_username: e.target.value
                  })}
                  placeholder="Enter new username"
                  required
                  minLength="3"
                />
                <small>Only letters, numbers, and underscores allowed</small>
              </div>

              <div className="form-group">
                <label htmlFor="username_password">Current Password</label>
                <input
                  type="password"
                  id="username_password"
                  value={usernameData.current_password}
                  onChange={(e) => setUsernameData({
                    ...usernameData,
                    current_password: e.target.value
                  })}
                  placeholder="Enter your current password"
                  required
                />
                <small>Required to confirm changes</small>
              </div>

              <button
                type="submit"
                className="submit-btn"
                disabled={loading}
              >
                {loading ? 'Updating...' : 'Update Username'}
              </button>
            </form>
          )}

          {activeTab === 'password' && (
            <form onSubmit={handlePasswordChange} className="settings-form">
              <h3>Change Your Password</h3>
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
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminProfileSettings;
