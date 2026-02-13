import React, { useState, useEffect, useCallback } from 'react';
import { useSchool } from '../contexts/SchoolContext';

const StaffSettings = () => {
  const { buildApiUrl } = useSchool();
  const token = localStorage.getItem('accessToken');

  const [allowLateBooking, setAllowLateBooking] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch(buildApiUrl('/schooladmin/staff/settings/'), { headers });
      if (res.ok) {
        const data = await res.json();
        setAllowLateBooking(data.allow_late_booking);
      }
    } catch (err) {
      setError('Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, [buildApiUrl, token]);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const handleToggle = async () => {
    const newValue = !allowLateBooking;
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch(buildApiUrl('/schooladmin/staff/settings/'), {
        method: 'PUT',
        headers,
        body: JSON.stringify({ allow_late_booking: newValue }),
      });

      if (res.ok) {
        setAllowLateBooking(newValue);
        setSuccess('Settings updated');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError('Failed to update settings');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p>Loading settings...</p>;

  return (
    <div>
      {error && <div className="staff-alert staff-alert-error">{error}</div>}
      {success && <div className="staff-alert staff-alert-success">{success}</div>}

      <div className="toggle-row">
        <div className="toggle-row-info">
          <h4>Allow Late Booking</h4>
          <p>
            {allowLateBooking
              ? 'Teachers can book on/off after the grace period, but will be marked as LATE.'
              : 'Teachers are blocked from booking after the grace period expires.'}
          </p>
        </div>
        <label className="toggle-switch">
          <input
            type="checkbox"
            checked={allowLateBooking}
            onChange={handleToggle}
            disabled={saving}
          />
          <span className="toggle-slider"></span>
        </label>
      </div>
    </div>
  );
};

export default StaffSettings;
