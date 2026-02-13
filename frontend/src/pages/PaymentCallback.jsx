import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config';
import './PaymentCallback.css';

const PaymentCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('verifying'); // verifying, success, failed
  const [message, setMessage] = useState('');
  const [schoolInfo, setSchoolInfo] = useState(null);
  const verifiedRef = useRef(false);

  const isPortal = searchParams.get('from') === 'portal';

  useEffect(() => {
    const reference = searchParams.get('reference') || searchParams.get('trxref');

    if (!reference) {
      setStatus('failed');
      setMessage('No payment reference found. Please contact support.');
      return;
    }

    if (verifiedRef.current) return;
    verifiedRef.current = true;

    const verifyPayment = async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/public/verify-payment/${reference}/`
        );
        const data = await response.json();

        if (response.ok && data.verified) {
          setStatus('success');
          setSchoolInfo({
            name: data.school_name,
            slug: data.school_slug,
            plan: data.plan_name,
          });
          setMessage(
            isPortal
              ? 'Your plan has been upgraded successfully.'
              : 'Your payment has been confirmed and your subscription is now active.'
          );
        } else {
          setStatus('failed');
          setMessage(data.error || data.detail || 'Payment verification failed. Please contact support.');
        }
      } catch {
        setStatus('failed');
        setMessage('Unable to verify payment. Please contact support.');
      }
    };

    verifyPayment();
  }, [searchParams, isPortal]);

  const handleContinue = () => {
    if (isPortal) {
      navigate('/portal/dashboard');
    } else {
      navigate('/portal/login');
    }
  };

  const buttonLabel = isPortal ? 'Back to Admin Portal' : 'Go to Admin Portal';

  return (
    <div className="payment-callback-container">
      <div className="payment-callback-card">
        {status === 'verifying' && (
          <div className="payment-callback-verifying">
            <div className="payment-callback-spinner" />
            <h2>Verifying Your Payment</h2>
            <p>Please do not close or refresh this page.</p>
            <p className="payment-callback-subtext">This may take a few moments...</p>
          </div>
        )}

        {status === 'success' && (
          <div className="payment-callback-success">
            <div className="payment-callback-icon-wrapper success">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h2>{isPortal ? 'Upgrade Successful' : 'Payment Successful'}</h2>
            <p>{message}</p>
            {schoolInfo && (
              <div className="payment-callback-details">
                <div className="payment-callback-detail-row">
                  <span>School</span>
                  <strong>{schoolInfo.name}</strong>
                </div>
                <div className="payment-callback-detail-row">
                  <span>Plan</span>
                  <strong>{schoolInfo.plan}</strong>
                </div>
              </div>
            )}
            <button className="payment-callback-btn" onClick={handleContinue}>
              {buttonLabel}
            </button>
          </div>
        )}

        {status === 'failed' && (
          <div className="payment-callback-failed">
            <div className="payment-callback-icon-wrapper failed">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </div>
            <h2>Payment Verification Failed</h2>
            <p>{message}</p>
            <p className="payment-callback-subtext">
              If you were charged, your subscription will still be activated automatically.
              You can also sign in to the Admin Portal to check your subscription status.
            </p>
            <button className="payment-callback-btn" onClick={handleContinue}>
              {buttonLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PaymentCallback;
