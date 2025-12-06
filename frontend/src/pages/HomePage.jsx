import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import API_BASE_URL from '../config';
import './HomePage.css';

const HomePage = () => {
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = e => {
    setFormData(f => ({ ...f, [e.target.name]: e.target.value }));
    if (error) setError('');
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data } = await axios.post(
        `${API_BASE_URL}/api/users/login/`,
        formData
      );

      localStorage.setItem('accessToken', data.access);
      localStorage.setItem('refreshToken', data.refresh);
      localStorage.setItem('userRole', data.role);
      localStorage.setItem('userId', data.user_id);
      localStorage.setItem('userName', data.username);

      switch (data.role) {
        case 'admin':
          navigate('/admin/dashboard');
          break;
        case 'principal':
          navigate('/principal/dashboard');
          break;
        case 'student':
          navigate('/student/dashboard');
          break;
        case 'teacher':
          navigate('/teacher/dashboard');
          break;
        case 'parent':
          navigate('/parent/dashboard');
          break;
        default:
          navigate('/dashboard');
      }

    } catch (error) {
      console.error('Login error:', error);
      if (error.response?.status === 401) {
        setError('Invalid username or password.');
      } else {
        setError('Login failed. Please try again.');
      }
      localStorage.clear();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="homepage-container">
      {/* Floating Educational Icons */}
      <svg className="floating-icon icon-1" width="80" height="80" viewBox="0 0 24 24" fill="currentColor">
        {/* Calculator/Math */}
        <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5.5 13h-3c-.28 0-.5-.22-.5-.5s.22-.5.5-.5h3c.28 0 .5.22.5.5s-.22.5-.5.5zm0-2.5h-3c-.28 0-.5-.22-.5-.5s.22-.5.5-.5h3c.28 0 .5.22.5.5s-.22.5-.5.5zm0-2.5h-3c-.28 0-.5-.22-.5-.5s.22-.5.5-.5h3c.28 0 .5.22.5.5s-.22.5-.5.5zM9 7h6c.55 0 1 .45 1 1s-.45 1-1 1H9c-.55 0-1-.45-1-1s.45-1 1-1z"/>
      </svg>

      <svg className="floating-icon icon-2" width="70" height="70" viewBox="0 0 24 24" fill="currentColor">
        {/* Book/Reading */}
        <path d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z"/>
      </svg>

      <svg className="floating-icon icon-3" width="75" height="75" viewBox="0 0 24 24" fill="currentColor">
        {/* Science/Flask */}
        <path d="M7 2v2h1v14c0 2.21 1.79 4 4 4s4-1.79 4-4V4h1V2H7zm2 2h6v3h-6V4zm6 5v9c0 1.1-.9 2-2 2s-2-.9-2-2V9h4z"/>
      </svg>

      <svg className="floating-icon icon-4" width="65" height="65" viewBox="0 0 24 24" fill="currentColor">
        {/* Globe/Geography */}
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
      </svg>

      <svg className="floating-icon icon-5" width="85" height="85" viewBox="0 0 24 24" fill="currentColor">
        {/* Functions/Math symbols */}
        <path d="M15.6 5.29c.39-.39 1.02-.39 1.41 0l3.54 3.54c.39.39.39 1.02 0 1.41l-3.54 3.54c-.39.39-1.02.39-1.41 0-.39-.39-.39-1.02 0-1.41L18.17 10l-2.58-2.58c-.38-.39-.38-1.02.01-1.41zM8.4 5.29c-.39-.39-1.02-.39-1.41 0L3.45 8.83c-.39.39-.39 1.02 0 1.41l3.54 3.54c.39.39 1.02.39 1.41 0 .39-.39.39-1.02 0-1.41L5.83 10l2.58-2.58c.38-.39.38-1.02-.01-1.41zM12 14l2-8h2l-2 8z"/>
      </svg>

      <svg className="floating-icon icon-6" width="70" height="70" viewBox="0 0 24 24" fill="currentColor">
        {/* Atom/Science */}
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 5-5v10zm2 0V7l5 5-5 5z"/>
      </svg>

      <svg className="floating-icon icon-7" width="60" height="60" viewBox="0 0 24 24" fill="currentColor">
        {/* Pencil/Writing */}
        <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
      </svg>

      <svg className="floating-icon icon-8" width="78" height="78" viewBox="0 0 24 24" fill="currentColor">
        {/* Geometry/Shapes */}
        <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14H5V5h7v12zm7 0h-5V5h5v12z"/>
      </svg>

      <img src="/logo.png" alt="Figil Schools Logo" className="logo-above" />

      <div className="login-card">
        <h2>Figil Schools</h2>

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label className="input-label" htmlFor="username">Username</label>
            <div style={{ position: 'relative' }}>
              <svg className="input-icon" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
              </svg>
              <input
                id="username"
                className="login-input"
                type="text"
                name="username"
                placeholder="Enter your username"
                value={formData.username}
                onChange={handleChange}
                required
                disabled={loading}
                autoComplete="username"
              />
            </div>
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="password">Password</label>
            <div style={{ position: 'relative' }}>
              <svg className="input-icon" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
              </svg>
              <input
                id="password"
                className="login-input"
                type="password"
                name="password"
                placeholder="Enter your password"
                value={formData.password}
                onChange={handleChange}
                required
                disabled={loading}
                autoComplete="current-password"
              />
            </div>
          </div>

          <button
            className="login-button"
            type="submit"
            disabled={loading}
          >
            {loading ? 'SIGNING IN...' : 'SIGN IN'}
          </button>
        </form>

        {error && <p className="login-error">{error}</p>}

        <div className="forgot-password-link-wrapper">
          <Link to="/forgot-password" className="forgot-password-link">
            Forgot your password?
          </Link>
        </div>

        <div className="login-footer">
          &copy; 2024 Figil Schools. All rights reserved.
        </div>
      </div>
    </div>
  );
};

export default HomePage;
