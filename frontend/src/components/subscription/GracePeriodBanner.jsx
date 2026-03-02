import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { useSchool } from '../../contexts/SchoolContext';
import { useNavigate } from 'react-router-dom';

function GracePeriodBanner() {
  const { isInGracePeriod, getGraceDaysRemaining, schoolSlug } = useSchool();
  const navigate = useNavigate();

  if (!isInGracePeriod || !isInGracePeriod()) {
    return null;
  }

  const daysLeft = getGraceDaysRemaining ? getGraceDaysRemaining() : 0;

  const handleRenew = () => {
    navigate(`/${schoolSlug}/admin/dashboard`, { state: { tab: 'billing' } });
  };

  return (
    <div style={{
      backgroundColor: '#dc2626',
      color: '#ffffff',
      padding: '12px 16px',
      position: 'relative',
      zIndex: 50,
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexWrap: 'wrap',
        gap: '16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertTriangle style={{ width: '20px', height: '20px' }} />
          <span style={{ fontSize: '14px', fontWeight: '500' }}>
            {daysLeft === 0
              ? 'Your subscription grace period ends today! Service will be suspended.'
              : daysLeft === 1
              ? 'URGENT: 1 day left before service suspension.'
              : `Your subscription has expired. ${daysLeft} days left before service suspension.`}
          </span>
        </div>
        <button
          onClick={handleRenew}
          style={{
            backgroundColor: '#ffffff',
            color: '#dc2626',
            padding: '6px 20px',
            borderRadius: '4px',
            fontSize: '13px',
            fontWeight: '700',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Renew Now
        </button>
      </div>
    </div>
  );
}

export default GracePeriodBanner;
