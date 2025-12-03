import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      // Use the new CustomTokenObtainPairView endpoint
      const { data } = await axios.post(
        `${API_BASE_URL}/api/users/login/`,
        formData
      );
      
      // Store tokens
      localStorage.setItem('accessToken', data.access);
      localStorage.setItem('refreshToken', data.refresh);

      // Store user info for easy access
      localStorage.setItem('userRole', data.role);
      localStorage.setItem('userId', data.user_id);
      localStorage.setItem('userName', data.username);
      
      // Navigate based on user role
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
          navigate('/dashboard'); // fallback
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
      <img src="/logo.png" alt="School Logo" className="logo-above" />

      <div className="login-card">
        <h2>Login</h2>
        <form onSubmit={handleSubmit}>
          <input
            className="login-input"
            type="text"
            name="username"
            placeholder="Username"
            value={formData.username}
            onChange={handleChange}
            required
            disabled={loading}
          />
          <input
            className="login-input"
            type="password"
            name="password"
            placeholder="Password"
            value={formData.password}
            onChange={handleChange}
            required
            disabled={loading}
          />
          <button 
            className="login-button" 
            type="submit" 
            disabled={loading}
          >
            {loading ? 'LOGGING IN...' : 'LOG IN'}
          </button>
        </form>
        {error && <p className="login-error">{error}</p>}
      </div>
    </div>
  );
};

export default HomePage;