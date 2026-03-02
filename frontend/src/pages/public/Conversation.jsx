// src/pages/public/Conversation.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Send, Loader2, MessageSquare, CheckCircle } from 'lucide-react';
import API_BASE_URL from '../../config';
import './Conversation.css';

function Conversation() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [thread, setThread] = useState([]);
  const [senderName, setSenderName] = useState(() => localStorage.getItem('conv_sender_name') || '');
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/public/conversation/${token}/`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setError(data.error); return; }
        setSchoolName(data.school_name);
        setThread(data.thread);
      })
      .catch(() => setError('Failed to load conversation.'))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thread]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!senderName.trim()) { alert('Please enter your name.'); return; }
    if (!content.trim()) { alert('Message cannot be empty.'); return; }

    setSending(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/public/conversation/${token}/reply/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sender_name: senderName.trim(), content: content.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || 'Failed to send.'); return; }
      localStorage.setItem('conv_sender_name', senderName.trim());
      setThread((prev) => [...prev, data.reply]);
      setContent('');
      setSent(true);
      setTimeout(() => setSent(false), 3000);
    } catch {
      alert('Network error. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const formatTime = (iso) => {
    const d = new Date(iso);
    return d.toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="conv-page">
        <div className="conv-loading">
          <Loader2 size={28} className="conv-spinner" />
          <p>Loading conversation…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="conv-page">
        <div className="conv-error-box">
          <MessageSquare size={40} style={{ color: '#9ca3af', marginBottom: 12 }} />
          <p>{error}</p>
          <Link to="/" style={{ color: '#2563eb', fontSize: 14 }}>Go to homepage</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="conv-page">
      <nav className="conv-nav">
        <Link to="/" className="conv-nav-logo">
          <img src="/logo-white.svg" alt="EduCare" style={{ height: 48, width: 'auto' }} />
        </Link>
      </nav>

      <div className="conv-container">
        <div className="conv-header">
          <MessageSquare size={22} />
          <div>
            <h2>Conversation</h2>
            <p>{schoolName}</p>
          </div>
        </div>

        <div className="conv-thread">
          {thread.length === 0 && (
            <p className="conv-empty">No messages yet. Use the form below to reply.</p>
          )}
          {thread.map((msg, i) => (
            <div
              key={i}
              className={`conv-bubble-wrap ${msg.direction === 'outbound' ? 'conv-outbound' : 'conv-inbound'}`}
            >
              <div className={`conv-bubble ${msg.direction === 'outbound' ? 'conv-bubble-staff' : 'conv-bubble-school'}`}>
                <div className="conv-bubble-meta">
                  <span className="conv-sender">
                    {msg.direction === 'outbound' ? '🛡 EduCare' : `🏫 ${msg.sender_name}`}
                  </span>
                  <span className="conv-time">{formatTime(msg.created_at)}</span>
                </div>
                <p className="conv-message">{msg.message}</p>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <form className="conv-reply-form" onSubmit={handleSubmit}>
          <div className="conv-reply-fields">
            <input
              type="text"
              placeholder="Your name"
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
              className="conv-name-input"
              required
            />
            <textarea
              placeholder="Type your reply here…"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="conv-textarea"
              rows={4}
              required
            />
          </div>
          <button type="submit" className="conv-send-btn" disabled={sending}>
            {sending ? (
              <><Loader2 size={16} className="conv-spinner" /> Sending…</>
            ) : sent ? (
              <><CheckCircle size={16} /> Sent!</>
            ) : (
              <><Send size={16} /> Send Reply</>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Conversation;
