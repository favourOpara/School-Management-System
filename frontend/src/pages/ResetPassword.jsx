import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config';
import './VerifyEmail.css';

function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validate passwords
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    // Check password strength
    const hasUpper = /[A-Z]/.test(newPassword);
    const hasLower = /[a-z]/.test(newPassword);
    const hasDigit = /[0-9]/.test(newPassword);

    if (!hasUpper || !hasLower || !hasDigit) {
      setError('Password must contain at least one uppercase letter, one lowercase letter, and one number');
      return;
    }

    setLoading(true);

    try {
      const url = `${API_BASE_URL}/api/users/reset-password/${token}/`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          new_password: newPassword,
          confirm_password: confirmPassword,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(true);
        setTimeout(() => {
          navigate('/');
        }, 3000);
      } else {
        setError(data.message || 'Password reset failed. Please try again or request a new reset link.');
      }
    } catch (err) {
      setError(`Network error: ${err.message}. Please check your connection and try again.`);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="verify-container">
        <div className="verify-card">
          <div className="success-container">
            <div className="success-icon-wrapper">
              <svg className="success-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="success-title">Password Reset!</h2>
            <p className="success-message">
              Your password has been reset successfully. You can now login with your new password.
            </p>
            <p className="success-redirect">
              Redirecting to login page in 3 seconds...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="verify-container">
      <div className="verify-card">
        {/* Logo Section */}
        <div className="verify-logo">
          <img
            src="https://figilschools.com/logo.png"
            alt="FIGIL Schools Logo"
          />
          <h2 className="verify-title">Reset Your Password</h2>
          <p className="verify-subtitle">Enter your new password below</p>
        </div>

        {/* Reset Form */}
        <form onSubmit={handleSubmit} className="verify-form">
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
            <label htmlFor="newPassword" className="form-label">
              New Password
            </label>
            <input
              id="newPassword"
              name="newPassword"
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="form-input"
              placeholder="Enter your new password"
              disabled={loading}
            />
            <p className="password-hint">
              Must be at least 8 characters with uppercase, lowercase, and number
            </p>
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword" className="form-label">
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="form-input"
              placeholder="Confirm your new password"
              disabled={loading}
            />
          </div>

          <div className="alert alert-warning">
            <svg className="alert-icon" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div className="alert-content">
              <strong>Security Notice:</strong> This reset link expires in 1 hour. After resetting your password, you can login immediately.
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="verify-button"
          >
            {loading ? (
              <span className="button-content">
                <div className="spinner"></div>
                Resetting...
              </span>
            ) : (
              'Reset Password'
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="verify-footer">
          <p>
            Remember your password?{' '}
            <a href="/">
              Back to Login
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default ResetPassword;
