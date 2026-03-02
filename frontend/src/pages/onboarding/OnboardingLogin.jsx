import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserCheck, Eye, EyeOff, LogIn } from 'lucide-react';
import API_BASE_URL from '../../config';
import './OnboardingLogin.css';

function OnboardingLogin() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('onboardingAccessToken');
    if (token) navigate('/onboarding/dashboard');
  }, [navigate]);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_BASE_URL}/api/onboarding/login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email, password: form.password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Login failed.');
      }

      localStorage.setItem('onboardingAccessToken', data.access);
      localStorage.setItem('onboardingUserName', data.user.full_name || data.user.email);
      navigate('/onboarding/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ob-login-page">
      <div className="ob-login-card">
        <div className="ob-login-icon">
          <UserCheck size={32} />
        </div>
        <h1 className="ob-login-title">Onboarding Portal</h1>
        <p className="ob-login-sub">EduCare Onboarding Team Access</p>

        {error && <div className="ob-login-error">{error}</div>}

        <form onSubmit={handleSubmit} className="ob-login-form">
          <div className="ob-login-group">
            <label>Email Address</label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="agent@educare.ng"
              required
              autoFocus
            />
          </div>

          <div className="ob-login-group">
            <label>Password</label>
            <div className="ob-login-pw-wrap">
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={form.password}
                onChange={handleChange}
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                className="ob-login-pw-toggle"
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button type="submit" className="ob-login-btn" disabled={loading}>
            {loading ? (
              <span className="ob-login-spinner" />
            ) : (
              <>
                <LogIn size={18} />
                Sign In
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

export default OnboardingLogin;
