import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './HomePage.css';

const HomePage = () => {
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleChange = e => {
    setFormData(f => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    try {
      const { data: tokens } = await axios.post(
        'http://127.0.0.1:8000/api/token/',
        formData
      );
      localStorage.setItem('accessToken', tokens.access);
      localStorage.setItem('refreshToken', tokens.refresh);
      const { data: user } = await axios.get(
        'http://127.0.0.1:8000/api/users/me/',
        { headers: { Authorization: `Bearer ${tokens.access}` } }
      );
      navigate(`/${user.role}/dashboard`);
    } catch {
      setError('Invalid username or password.');
      localStorage.clear();
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
          />
          <input
            className="login-input"
            type="password"
            name="password"
            placeholder="Password"
            value={formData.password}
            onChange={handleChange}
            required
          />
          <button className="login-button" type="submit">
            LOG IN
          </button>
        </form>
        {error && <p className="login-error">{error}</p>}
      </div>
    </div>
  );
};

export default HomePage;
