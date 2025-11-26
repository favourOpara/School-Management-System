import { useState } from 'react';
import axios from 'axios';

import API_BASE_URL from '../config';

const AdminLogin = ({ onLogin }) => {
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const res = await axios.post(`${API_BASE_URL}/api/token/`, formData);
      const { access, refresh } = res.data;
      localStorage.setItem('accessToken', access);
      localStorage.setItem('refreshToken', refresh);
      onLogin(); // navigate to dashboard
    } catch (err) {
      setError('Invalid credentials');
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: 'auto', paddingTop: '2rem' }}>
      <h2>Admin Login</h2>
      <form onSubmit={handleSubmit}>
        <input type="text" name="username" placeholder="Username" onChange={handleChange} required />
        <input type="password" name="password" placeholder="Password" onChange={handleChange} required />
        <button type="submit">Login</button>
        {error && <p style={{ color: 'red' }}>{error}</p>}
      </form>
    </div>
  );
};

export default AdminLogin;
