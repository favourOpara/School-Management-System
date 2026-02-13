// src/pages/portal/PortalLogin.jsx
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  GraduationCap,
  Eye,
  EyeOff,
  Loader2,
  Mail,
  Lock,
  ArrowRight,
  Settings,
} from 'lucide-react';
import API_BASE_URL from '../../config';
import './PortalLogin.css';

function PortalLogin() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.email || !formData.password) {
      setError('Please enter your email and password');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // First, we need to find the school associated with this admin's email
      // Try to login and get the school info
      const response = await fetch(`${API_BASE_URL}/api/portal/login/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.detail || 'Invalid credentials');
      }

      // Store portal auth data (using portal-specific keys to avoid conflicts with school system)
      localStorage.setItem('portalAccessToken', data.access);
      localStorage.setItem('portalRefreshToken', data.refresh);
      localStorage.setItem('portalUserName', `${data.user.first_name} ${data.user.last_name}`);
      localStorage.setItem('portalSchoolSlug', data.school.slug);
      localStorage.setItem('portalSchoolName', data.school.name);
      localStorage.setItem('portalMode', 'true');

      // Navigate to portal dashboard
      navigate('/portal/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="portal-login-page">
      {/* Background */}
      <div className="portal-login-bg">
        <div className="portal-login-blob portal-login-blob-1" />
        <div className="portal-login-blob portal-login-blob-2" />
      </div>

      {/* Navigation */}
      <nav className="portal-login-nav">
        <Link to="/" className="portal-login-logo">
          <div className="portal-login-logo-icon">
            <GraduationCap />
          </div>
          <span className="portal-login-logo-text">EduCare</span>
        </Link>
      </nav>

      {/* Login Card */}
      <div className="portal-login-container">
        <div className="portal-login-card">
          <div className="portal-login-header">
            <div className="portal-login-icon">
              <Settings size={28} />
            </div>
            <h1>Admin Portal</h1>
            <p>Sign in to manage your school settings</p>
          </div>

          {error && (
            <div className="portal-login-error">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="portal-login-form">
            <div className="portal-login-field">
              <label>Email Address</label>
              <div className="portal-login-input-wrapper">
                <Mail size={20} />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="admin@yourschool.edu"
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="portal-login-field">
              <label>Password</label>
              <div className="portal-login-input-wrapper">
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
                  className="portal-login-toggle-password"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="portal-login-submit"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="portal-login-spinner" size={20} />
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

          <div className="portal-login-footer">
            <p>
              Don't have an account?{' '}
              <Link to="/register">Register your school</Link>
            </p>
          </div>
        </div>

        <p className="portal-login-help">
          Need help? <Link to="/contact-sales">Contact Support</Link>
        </p>
      </div>
    </div>
  );
}

export default PortalLogin;
