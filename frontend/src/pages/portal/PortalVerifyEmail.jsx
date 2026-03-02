// src/pages/portal/PortalVerifyEmail.jsx
import React, { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2, Mail } from 'lucide-react';
import API_BASE_URL from '../../config';
import './PortalLogin.css';

function PortalVerifyEmail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [status, setStatus] = useState('verifying'); // 'verifying' | 'success' | 'error' | 'no_token'
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('no_token');
      return;
    }

    const verify = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/public/verify-email/?token=${encodeURIComponent(token)}`);
        const data = await response.json();

        if (response.ok) {
          setStatus('success');
          setMessage(data.message || 'Email verified successfully!');
        } else {
          setStatus('error');
          setMessage(data.error || 'Verification failed. The link may be invalid or expired.');
        }
      } catch {
        setStatus('error');
        setMessage('Something went wrong. Please try again.');
      }
    };

    verify();
  }, [token]);

  return (
    <div className="portal-login-page">
      <div className="portal-login-bg">
        <div className="portal-login-blob portal-login-blob-1" />
        <div className="portal-login-blob portal-login-blob-2" />
      </div>

      <nav className="portal-login-nav">
        <Link to="/" className="portal-login-logo">
          <img src="/logo-white.svg" alt="EduCare" style={{ height: '60px', width: 'auto' }} />
        </Link>
      </nav>

      <div className="portal-login-container">
        <div className="portal-login-card" style={{ textAlign: 'center' }}>
          {status === 'verifying' && (
            <>
              <Loader2 size={56} style={{ color: '#3b82f6', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
              <h2 style={{ margin: '0 0 8px', fontSize: '22px', color: '#1e293b' }}>Verifying your email…</h2>
              <p style={{ color: '#64748b', margin: 0 }}>Please wait a moment.</p>
            </>
          )}

          {status === 'success' && (
            <>
              <CheckCircle size={56} style={{ color: '#10b981', margin: '0 auto 16px' }} />
              <h2 style={{ margin: '0 0 8px', fontSize: '22px', color: '#1e293b' }}>Email Verified!</h2>
              <p style={{ color: '#64748b', marginBottom: '24px' }}>{message}</p>
              <button
                onClick={() => navigate('/portal')}
                className="portal-login-submit"
                style={{ width: 'auto', padding: '12px 32px', margin: '0 auto', display: 'inline-flex' }}
              >
                Go to Admin Portal
              </button>
            </>
          )}

          {(status === 'error' || status === 'no_token') && (
            <>
              <XCircle size={56} style={{ color: '#ef4444', margin: '0 auto 16px' }} />
              <h2 style={{ margin: '0 0 8px', fontSize: '22px', color: '#1e293b' }}>Verification Failed</h2>
              <p style={{ color: '#64748b', marginBottom: '24px' }}>
                {status === 'no_token'
                  ? 'No verification token found. Please use the link from your email.'
                  : message}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center' }}>
                <Link to="/portal" style={{ color: '#3b82f6', textDecoration: 'none', fontSize: '14px' }}>
                  Back to Admin Portal Login
                </Link>
                <ResendSection />
              </div>
            </>
          )}
        </div>

        <p className="portal-login-help">
          Need help? <Link to="/contact-sales">Contact Support</Link>
        </p>
      </div>
    </div>
  );
}

function ResendSection() {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [resendError, setResendError] = useState('');

  const handleResend = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSending(true);
    setResendError('');
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/public/resend-verification/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (response.ok) {
        setSent(true);
      } else {
        setResendError(data.error || 'Failed to resend. Please try again.');
      }
    } catch {
      setResendError('Something went wrong. Please try again.');
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <p style={{ color: '#10b981', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <CheckCircle size={16} /> Verification email sent! Check your inbox.
      </p>
    );
  }

  return (
    <form onSubmit={handleResend} style={{ width: '100%', maxWidth: '320px' }}>
      <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '8px' }}>Resend verification email:</p>
      {resendError && <p style={{ color: '#ef4444', fontSize: '13px', marginBottom: '6px' }}>{resendError}</p>}
      <div style={{ display: 'flex', gap: '8px' }}>
        <div className="portal-login-input-wrapper" style={{ flex: 1 }}>
          <Mail size={18} />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
          />
        </div>
        <button
          type="submit"
          className="portal-login-submit"
          disabled={sending}
          style={{ width: 'auto', padding: '0 16px', flexShrink: 0 }}
        >
          {sending ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : 'Send'}
        </button>
      </div>
    </form>
  );
}

export default PortalVerifyEmail;
