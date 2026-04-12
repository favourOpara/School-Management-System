// src/pages/public/ScheduleOnboarding.jsx
import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Calendar, CheckCircle, Loader2, PlusCircle, Trash2 } from 'lucide-react';
import API_BASE_URL from '../../config';
import './ScheduleOnboarding.css';

const today = new Date().toISOString().split('T')[0];

function ScheduleOnboarding() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [submittedSlots, setSubmittedSlots] = useState([]);
  const [submittedAt, setSubmittedAt] = useState(null);
  const [slots, setSlots] = useState([{ date: '', time: '', note: '' }]);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/public/schedule-onboarding/${token}/`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setError(data.error); return; }
        setSchoolName(data.school_name);
        if (data.already_submitted) {
          setAlreadySubmitted(true);
          setSubmittedSlots(data.slots || []);
          setSubmittedAt(data.submitted_at);
          // Pre-fill form with existing slots so they can update
          if (data.slots?.length) setSlots(data.slots);
        }
      })
      .catch(() => setError('Failed to load. Please try again.'))
      .finally(() => setLoading(false));
  }, [token]);

  const updateSlot = (i, field, value) =>
    setSlots((prev) => prev.map((s, idx) => idx === i ? { ...s, [field]: value } : s));

  const addSlot = () => {
    if (slots.length < 3) setSlots((prev) => [...prev, { date: '', time: '', note: '' }]);
  };

  const removeSlot = (i) => {
    if (slots.length > 1) setSlots((prev) => prev.filter((_, idx) => idx !== i));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const filled = slots.filter((s) => s.date && s.time);
    if (filled.length === 0) {
      alert('Please fill in at least one date and time.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/public/schedule-onboarding/${token}/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slots: filled }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || 'Something went wrong.'); return; }
      setSubmittedSlots(filled);
      setDone(true);
      setAlreadySubmitted(true);
    } catch {
      alert('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatSlotDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-NG', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
  };

  const formatSubmittedAt = (iso) => {
    if (!iso) return '';
    return new Date(iso).toLocaleString('en-NG', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="so-page">
        <div className="so-loading">
          <Loader2 size={28} className="so-spinner" />
          <p>Loading…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="so-page">
        <div className="so-error-box">
          <Calendar size={40} style={{ color: '#9ca3af', marginBottom: 12 }} />
          <p>{error}</p>
          <Link to="/" style={{ color: '#2563eb', fontSize: 14 }}>Go to homepage</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="so-page">
      <nav className="so-nav">
        <Link to="/" className="so-nav-logo">
          <img src="/logo-white.svg" alt="InsightWick" style={{ height: 48, width: 'auto' }} />
        </Link>
      </nav>

      <div className="so-container">
        {/* Header */}
        <div className="so-header">
          <Calendar size={22} />
          <div>
            <h2>Schedule Your Onboarding</h2>
            <p>{schoolName}</p>
          </div>
        </div>

        <div className="so-body">
          {done ? (
            /* ── Success state ── */
            <div className="so-success">
              <CheckCircle size={48} className="so-success-icon" />
              <h3>Availability submitted!</h3>
              <p>Your onboarding expert will reach out at one of your preferred times.</p>
              <div className="so-submitted-slots">
                {submittedSlots.map((s, i) => (
                  <div key={i} className="so-submitted-slot">
                    <span className="so-slot-number">{i + 1}</span>
                    <div>
                      <div className="so-slot-date">{formatSlotDate(s.date)}</div>
                      <div className="so-slot-time">{s.time}</div>
                      {s.note && <div className="so-slot-note">{s.note}</div>}
                    </div>
                  </div>
                ))}
              </div>
              <button className="so-update-btn" onClick={() => setDone(false)}>
                Update my availability
              </button>
            </div>
          ) : (
            <>
              {/* Previously submitted banner */}
              {alreadySubmitted && submittedAt && (
                <div className="so-existing-banner">
                  <CheckCircle size={16} />
                  You submitted availability on {formatSubmittedAt(submittedAt)}. You can update it below.
                </div>
              )}

              <p className="so-intro">
                Pick up to <strong>3 dates and times</strong> that work for you. Your onboarding expert
                will contact you at one of these slots.
              </p>

              <form onSubmit={handleSubmit} className="so-form">
                {slots.map((slot, i) => (
                  <div key={i} className="so-slot-row">
                    <div className="so-slot-label">
                      <span className="so-slot-number">{i + 1}</span>
                      <span>Option {i + 1}</span>
                      {slots.length > 1 && (
                        <button
                          type="button"
                          className="so-remove-btn"
                          onClick={() => removeSlot(i)}
                          title="Remove this slot"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                    <div className="so-slot-fields">
                      <div className="so-field">
                        <label>Date</label>
                        <input
                          type="date"
                          min={today}
                          value={slot.date}
                          onChange={(e) => updateSlot(i, 'date', e.target.value)}
                          required={i === 0}
                          className="so-input"
                        />
                      </div>
                      <div className="so-field">
                        <label>Time</label>
                        <input
                          type="time"
                          value={slot.time}
                          onChange={(e) => updateSlot(i, 'time', e.target.value)}
                          required={i === 0}
                          className="so-input"
                        />
                      </div>
                      <div className="so-field so-field-note">
                        <label>Note <span className="so-optional">(optional)</span></label>
                        <input
                          type="text"
                          placeholder="e.g. Morning preferred, call my mobile"
                          value={slot.note}
                          onChange={(e) => updateSlot(i, 'note', e.target.value)}
                          className="so-input"
                          maxLength={120}
                        />
                      </div>
                    </div>
                  </div>
                ))}

                {slots.length < 3 && (
                  <button type="button" className="so-add-btn" onClick={addSlot}>
                    <PlusCircle size={16} />
                    Add another option
                  </button>
                )}

                <button type="submit" className="so-submit-btn" disabled={submitting}>
                  {submitting ? (
                    <><Loader2 size={16} className="so-spinner" /> Submitting…</>
                  ) : alreadySubmitted ? (
                    'Update My Availability'
                  ) : (
                    'Submit My Availability'
                  )}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default ScheduleOnboarding;
