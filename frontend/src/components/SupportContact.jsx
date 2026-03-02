import React, { useState, useEffect } from 'react';
import { HeartHandshake, Send, CheckCircle, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { useSchool } from '../contexts/SchoolContext';
import API_BASE_URL from '../config';

const STATUS_STYLE = {
  open:        { bg: '#dbeafe', color: '#1e40af', label: 'Open' },
  assigned:    { bg: '#fef3c7', color: '#92400e', label: 'Assigned' },
  in_progress: { bg: '#ede9fe', color: '#5b21b6', label: 'In Progress' },
  resolved:    { bg: '#d1fae5', color: '#065f46', label: 'Resolved' },
};

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function SupportContact() {
  const { school } = useSchool();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [error, setError] = useState('');
  const [tickets, setTickets] = useState([]);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  const slug = school?.slug || localStorage.getItem('schoolSlug');
  const token = localStorage.getItem('accessToken');

  const fetchTickets = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/${slug}/support/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTickets(data.tickets || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingTickets(false);
    }
  };

  useEffect(() => { fetchTickets(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    if (!subject.trim() || !message.trim()) {
      setError('Please fill in both subject and message.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/${slug}/support/`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ subject: subject.trim(), message: message.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessMsg(data.message);
        setSubject('');
        setMessage('');
        fetchTickets();
      } else {
        setError(data.error || 'Failed to submit. Please try again.');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '2rem 1rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: '2rem' }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0 }}>
          <HeartHandshake size={24} />
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, color: '#0f172a' }}>Contact Support</h2>
          <p style={{ margin: 0, fontSize: '0.88rem', color: '#64748b' }}>
            Send us a message and a support specialist will get back to you within 24 hours via your registered email.
          </p>
        </div>
      </div>

      {/* Submit form */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '1.75rem', marginBottom: '2rem' }}>
        <h3 style={{ margin: '0 0 1.25rem', fontSize: '1rem', fontWeight: 700, color: '#1e293b' }}>New Support Request</h3>

        {successMsg && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 10, padding: '14px 16px', marginBottom: '1.25rem' }}>
            <CheckCircle size={20} color="#16a34a" style={{ flexShrink: 0, marginTop: 1 }} />
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#15803d', lineHeight: 1.6 }}>{successMsg}</p>
          </div>
        )}

        {error && (
          <p style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: '0.88rem', margin: '0 0 1rem' }}>{error}</p>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Subject</label>
            <input
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="e.g. Unable to generate report cards"
              style={{ width: '100%', padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.92rem', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Message</label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Describe your issue in as much detail as possible..."
              rows={5}
              style={{ width: '100%', padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.92rem', outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }}
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: submitting ? '#93c5fd' : '#2563eb', color: '#fff', border: 'none', borderRadius: 8, padding: '11px 24px', fontWeight: 600, fontSize: '0.92rem', cursor: submitting ? 'not-allowed' : 'pointer' }}
          >
            <Send size={16} />
            {submitting ? 'Sending…' : 'Send Request'}
          </button>
        </form>
      </div>

      {/* Previous tickets */}
      <div>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b', margin: '0 0 1rem' }}>Your Previous Requests</h3>

        {loadingTickets ? (
          <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Loading…</p>
        ) : tickets.length === 0 ? (
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '2rem', textAlign: 'center' }}>
            <Clock size={32} color="#cbd5e1" style={{ marginBottom: 8 }} />
            <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.9rem' }}>No support requests yet.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {tickets.map(t => {
              const st = STATUS_STYLE[t.status] || STATUS_STYLE.open;
              const isExpanded = expandedId === t.id;
              return (
                <div key={t.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
                  <div
                    onClick={() => setExpandedId(isExpanded ? null : t.id)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', cursor: 'pointer', background: isExpanded ? '#f8fafc' : '#fff' }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.subject}</div>
                      <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: 2 }}>{formatDate(t.created_at)}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 12, flexShrink: 0 }}>
                      <span style={{ background: st.bg, color: st.color, fontSize: '0.72rem', fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>{st.label}</span>
                      {isExpanded ? <ChevronUp size={16} color="#94a3b8" /> : <ChevronDown size={16} color="#94a3b8" />}
                    </div>
                  </div>

                  {isExpanded && (
                    <div style={{ padding: '0 18px 16px', borderTop: '1px solid #f1f5f9' }}>
                      <p style={{ margin: '12px 0 0', fontSize: '0.88rem', color: '#475569', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{t.message}</p>
                      {t.status === 'resolved' && t.resolved_at && (
                        <p style={{ margin: '10px 0 0', fontSize: '0.8rem', color: '#16a34a', fontWeight: 600 }}>
                          ✓ Resolved on {formatDate(t.resolved_at)}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
