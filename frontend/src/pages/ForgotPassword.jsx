import { useState } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE_URL } from '../config';
import './ForgotPassword.css';

function ForgotPassword() {
  const [identifier, setIdentifier] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Determine if input is email or username
      const isEmail = identifier.includes('@');
      const payload = isEmail
        ? { email: identifier }
        : { username: identifier };

      const response = await fetch(`${API_BASE_URL}/api/users/forgot-password/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(true);
      } else {
        setError(data.message || 'Failed to send reset email. Please try again.');
      }
    } catch (err) {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="forgot-password-container">
        <div className="forgot-password-card">
          <div className="success-container">
            <div className="success-icon-wrapper">
              <svg className="success-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="success-title">Check Your Email</h2>
            <p className="success-message">
              If an account exists with the information you provided, we've sent a password reset link to the associated email address.
            </p>
            <p className="success-hint">
              The link will expire in 1 hour for security reasons.
            </p>
            <div className="success-actions">
              <Link to="/" className="back-to-login-btn">
                Back to Login
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="forgot-password-container">
      <div className="forgot-password-card">
        {/* Logo Section */}
        <div className="forgot-password-logo">
          <img
            src="https://figilschools.com/logo.png"
            alt="FIGIL Schools Logo"
          />
          <h2 className="forgot-password-title">Forgot Password?</h2>
          <p className="forgot-password-subtitle">
            Enter your username or email and we'll send you a reset link
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="forgot-password-form">
          {error && (
            <div className="alert alert-error">
              <svg className="alert-icon" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <div className="alert-content">
                {error}
              </div>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="identifier" className="form-label">
              Username or Email
            </label>
            <div className="input-wrapper">
              <svg className="input-icon" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
              </svg>
              <input
                id="identifier"
                name="identifier"
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="forgot-password-form-input"
                placeholder="Enter your username or email"
                disabled={loading}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="forgot-password-button"
          >
            {loading ? (
              <span className="button-content">
                <div className="spinner"></div>
                Sending...
              </span>
            ) : (
              'Send Reset Link'
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="forgot-password-footer">
          <p>
            Remember your password?{' '}
            <Link to="/" className="link">
              Back to Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default ForgotPassword;
