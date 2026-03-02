import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Eye,
  EyeOff,
  Loader2,
  User,
  Lock,
  ArrowRight,
  Shield,
} from 'lucide-react';
import API_BASE_URL from '../../config';
import './PlatformLogin.css';

function PlatformLogin() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.username || !formData.password) {
      setError('Please enter your username and password');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/superadmin/login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: formData.username,
          password: formData.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.detail || 'Invalid credentials');
      }

      localStorage.setItem('platformAccessToken', data.access);
      localStorage.setItem('platformRefreshToken', data.refresh);
      localStorage.setItem(
        'platformUserName',
        `${data.user.first_name} ${data.user.last_name}`.trim() || data.user.username
      );
      localStorage.setItem('platformMode', 'true');

      navigate('/platform/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="platform-login-page">
      <div className="platform-login-bg">
        <div className="platform-login-blob platform-login-blob-1" />
        <div className="platform-login-blob platform-login-blob-2" />
      </div>

      <nav className="platform-login-nav">
        <Link to="/" className="platform-login-logo">
          <img src="/logo-white.svg" alt="EduCare" style={{height: '60px', width: 'auto'}} />
        </Link>
      </nav>

      <div className="platform-login-container">
        <div className="platform-login-card">
          <div className="platform-login-header">
            <div className="platform-login-icon">
              <Shield size={28} />
            </div>
            <h1>Platform Admin</h1>
            <p>Sign in to manage the platform</p>
          </div>

          {error && (
            <div className="platform-login-error">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="platform-login-form">
            <div className="platform-login-field">
              <label>Username</label>
              <div className="platform-login-input-wrapper">
                <User size={20} />
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  placeholder="Enter your username"
                  autoComplete="username"
                />
              </div>
            </div>

            <div className="platform-login-field">
              <label>Password</label>
              <div className="platform-login-input-wrapper">
                <Lock size={20} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="platform-login-toggle-password"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="platform-login-submit"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="platform-login-spinner" size={20} />
                  Signing in...
                </>
              ) : (
                <>
                  Sign In
                  <ArrowRight size={20} />
                </>
              )}
            </button>
          </form>
        </div>

        <p className="platform-login-help">
          Need help? <Link to="/contact-sales">Contact Support</Link>
        </p>
      </div>
    </div>
  );
}

export default PlatformLogin;
