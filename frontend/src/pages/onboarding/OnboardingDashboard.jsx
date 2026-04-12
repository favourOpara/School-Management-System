import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UserCheck,
  LogOut,
  PlayCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Phone,
  Mail,
  Calendar,
  Tag,
  Users,
  BookOpen,
  Layout,
  BookMarked,
  UserPlus,
  ClipboardCheck,
  GraduationCap,
  StickyNote,
  AlertCircle,
  ClipboardList,
  MessageSquare,
  Clock,
  Building2,
  HeartHandshake,
  MessageCircle,
  Reply,
} from 'lucide-react';
import API_BASE_URL from '../../config';
import './OnboardingDashboard.css';

/* ────────── helpers ────────── */
const formatDate = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-NG', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
};

/** Parse "[DD Mon YYYY HH:MM]\ntext" entries separated by \n\n */
const parseNotes = (str) => {
  if (!str || !str.trim()) return [];
  return str.split('\n\n').filter(Boolean).map((entry) => {
    const match = entry.match(/^\[([^\]]+)\]\n([\s\S]*)$/);
    if (match) return { ts: match[1], text: match[2].trim() };
    return { ts: null, text: entry.trim() };
  }).reverse(); // newest first
};

const REG_LABELS = {
  trial: '30-Day Trial',
  termly_trial: 'Termly Trial (4 mo.)',
  subscribe: 'Paid Subscription',
};

/* ══════════════════════════════════════════════════════════
   SHARED REPLY THREAD COMPONENT (onboarding agent)
   ══════════════════════════════════════════════════════════ */
function ReplyThread({ thread = [], replies = [], replyEndpoint, agentName, onNewReply }) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  // Use unified thread if available; normalise old replies format as fallback
  const items = thread.length > 0 ? thread : replies.map(r => ({
    direction: 'outbound',
    sender_name: r.sender_name,
    message: r.message,
    created_at: r.created_at,
    email_sent: r.email_sent,
  }));

  const handleSend = async () => {
    if (!message.trim()) return;
    setSending(true);
    setError('');
    const data = await onboardFetch(replyEndpoint, {
      method: 'POST',
      body: JSON.stringify({ message: message.trim() }),
    });
    if (data) {
      setMessage('');
      onNewReply(data.reply);
    } else {
      setError('Failed to send reply. Please try again.');
    }
    setSending(false);
  };

  return (
    <div className="ob-reply-thread">
      <div className="ob-reply-heading">
        <MessageCircle size={13} /> Conversation with School
      </div>

      {items.length === 0 ? (
        <p className="ob-reply-empty">No messages yet. Send the first message below.</p>
      ) : (
        <div className="ob-reply-list">
          {[...items].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)).map((item, i) => {
            const outbound = item.direction === 'outbound';
            return (
              <div key={i} className={`ob-reply-bubble ${outbound ? 'ob-reply-agent' : 'ob-reply-school'}`}>
                <div className="ob-reply-meta">
                  <span className="ob-reply-sender">
                    {outbound ? `👤 ${item.sender_name}` : `🏫 ${item.sender_name}`}
                  </span>
                  <span className="ob-reply-time">
                    {new Date(item.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    {outbound && item.email_sent !== undefined && (
                      <span className={`ob-reply-status ${item.email_sent ? 'ob-reply-sent' : 'ob-reply-fail'}`}>
                        {item.email_sent ? '✓ emailed' : '⚠ not sent'}
                      </span>
                    )}
                  </span>
                </div>
                <p className="ob-reply-text">{item.message}</p>
              </div>
            );
          })}
        </div>
      )}

      <div className="ob-reply-compose">
        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="Type your reply to the school…"
          rows={2}
          className="ob-reply-input"
          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSend(); }}
        />
        <button
          onClick={handleSend}
          disabled={sending || !message.trim()}
          className={`ob-reply-btn ${sending || !message.trim() ? 'ob-reply-btn--disabled' : ''}`}
        >
          <Reply size={14} />
          {sending ? 'Sending…' : 'Send'}
        </button>
      </div>
      {error && <p className="ob-reply-error">{error}</p>}
    </div>
  );
}

const CHECKLIST_META = [
  { key: 'students_imported',     label: 'Students imported',     icon: <Users size={15} /> },
  { key: 'teachers_added',        label: 'Teachers added',        icon: <UserCheck size={15} /> },
  { key: 'classes_setup',         label: 'Classes set up',        icon: <Layout size={15} /> },
  { key: 'subjects_setup',        label: 'Subjects configured',   icon: <BookOpen size={15} /> },
  { key: 'parents_added',         label: 'Parents linked',        icon: <UserPlus size={15} /> },
  { key: 'attendance_configured', label: 'Attendance configured', icon: <ClipboardCheck size={15} /> },
  { key: 'grading_configured',    label: 'Grading configured',    icon: <GraduationCap size={15} /> },
];

/* ────────── API helper ────────── */
const onboardFetch = async (path, options = {}) => {
  const token = localStorage.getItem('onboardingAccessToken');
  if (!token) {
    window.location.href = '/onboarding/login';
    return null;
  }
  const res = await fetch(`${API_BASE_URL}/api/onboarding/${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (res.status === 401 || res.status === 403) {
    localStorage.removeItem('onboardingAccessToken');
    localStorage.removeItem('onboardingUserName');
    window.location.href = '/onboarding/login';
    return null;
  }
  return res.json();
};

/* ────────── School Card ────────── */
function SchoolCard({ record, onUpdate, readOnly }) {
  const [expanded, setExpanded] = useState(false);
  const [checklist, setChecklist] = useState({ ...record.checklist });
  const [localReplies, setLocalReplies] = useState(record.thread || []);
  const agentName = localStorage.getItem('onboardingUserName') || 'Onboarding Agent';
  const [newNote, setNewNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  const progress = CHECKLIST_META.filter((m) => checklist[m.key]).length;
  const progressPct = Math.round((progress / CHECKLIST_META.length) * 100);

  const handleCheck = (key, val) => setChecklist((prev) => ({ ...prev, [key]: val }));

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg('');
    const payload = { ...checklist };
    if (newNote.trim()) payload.new_note = newNote.trim();
    const ok = await onUpdate(record.id, payload);
    if (ok) {
      setNewNote('');
      setSaveMsg('Saved!');
      setTimeout(() => setSaveMsg(''), 2500);
    }
    setSaving(false);
  };

  const handleMarkComplete = async () => {
    setCompleting(true);
    const payload = { ...checklist, status: 'completed' };
    if (newNote.trim()) payload.new_note = newNote.trim();
    await onUpdate(record.id, payload);
    setCompleting(false);
  };

  return (
    <div className={`ob-card ${readOnly ? 'ob-card--completed' : 'ob-card--active'}`}>
      {/* Header */}
      <div className="ob-card-header" onClick={() => setExpanded((v) => !v)}>
        <div className="ob-card-left">
          <div className="ob-card-school" style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
            {record.school_name}
            {record.unread_school_messages > 0 && (
              <span style={{ background: '#dc2626', color: '#fff', borderRadius: '999px', fontSize: '0.62rem', fontWeight: 700, padding: '1px 6px', lineHeight: 1.4 }}>
                {record.unread_school_messages} new
              </span>
            )}
          </div>
          <div className="ob-card-meta">
            <span className="ob-card-plan">{record.plan_name}</span>
            <span className="ob-card-reg">
              <Tag size={12} />
              {REG_LABELS[record.registration_type] || record.registration_type || 'Unknown'}
            </span>
          </div>
        </div>
        <div className="ob-card-right">
          {readOnly ? (
            <span className="ob-status-badge ob-badge--done">
              <CheckCircle2 size={13} /> Done
            </span>
          ) : (
            <div className="ob-progress-wrap">
              <div className="ob-progress-bar">
                <div className="ob-progress-fill" style={{ width: `${progressPct}%` }} />
              </div>
              <span className="ob-progress-chip">{progress}/{CHECKLIST_META.length}</span>
            </div>
          )}
          {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </div>

      {/* Contact info */}
      <div className="ob-card-info">
        <span><Mail size={13} /> {record.school_email}</span>
        {record.school_phone && <span><Phone size={13} /> {record.school_phone}</span>}
        <span><Calendar size={13} /> Registered {formatDate(record.registered_at)}</span>
        {readOnly && record.completed_at && (
          <span className="ob-done-date"><CheckCircle2 size={13} /> Completed {formatDate(record.completed_at)}</span>
        )}
      </div>

      {/* Expanded body */}
      {expanded && (
        <div className="ob-card-body">

          {/* Preferred availability slots */}
          {record.preferred_slots?.length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              <div className="ob-checklist-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Calendar size={13} /> School's Available Times
              </div>
              <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                {record.preferred_slots.map((slot, si) => (
                  <div key={si} style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px', padding: '8px 12px', fontSize: '0.82rem' }}>
                    <div style={{ fontWeight: 600, color: '#166534' }}>
                      {new Date(slot.date + 'T00:00:00').toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                    <div style={{ color: '#374151', marginTop: '2px' }}>{slot.time}</div>
                    {slot.note && <div style={{ color: '#6b7280', fontSize: '0.75rem', marginTop: '2px', fontStyle: 'italic' }}>{slot.note}</div>}
                  </div>
                ))}
              </div>
              {record.scheduling_submitted_at && (
                <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.4rem' }}>
                  Submitted {formatDate(record.scheduling_submitted_at)}
                </div>
              )}
            </div>
          )}

          <div className="ob-checklist-title">Setup Checklist</div>
          <div className="ob-checklist">
            {CHECKLIST_META.map((item) => (
              <label key={item.key} className="ob-checklist-item">
                <input
                  type="checkbox"
                  checked={!!checklist[item.key]}
                  onChange={(e) => !readOnly && handleCheck(item.key, e.target.checked)}
                  disabled={readOnly}
                />
                <span className="ob-checklist-icon">{item.icon}</span>
                <span className={checklist[item.key] ? 'ob-checked' : ''}>{item.label}</span>
              </label>
            ))}
          </div>

          {/* Admin notes history */}
          {record.admin_notes && (
            <div className="ob-admin-notes">
              <div className="ob-admin-notes-label">
                <AlertCircle size={14} /> Notes from Admin
              </div>
              {parseNotes(record.admin_notes).map((entry, i) => (
                <div key={i} className="ob-note-entry ob-note-entry--admin">
                  {entry.ts && <span className="ob-note-ts">{entry.ts}</span>}
                  <p className="ob-note-text">{entry.text}</p>
                </div>
              ))}
            </div>
          )}

          {/* Staff notes history */}
          <div className="ob-notes-section">
            <div className="ob-notes-label">
              <StickyNote size={14} /> Notes History
            </div>
            {parseNotes(record.notes).length > 0 ? (
              <div className="ob-note-history">
                {parseNotes(record.notes).map((entry, i) => (
                  <div key={i} className="ob-note-entry">
                    {entry.ts && <span className="ob-note-ts">{entry.ts}</span>}
                    <p className="ob-note-text">{entry.text}</p>
                  </div>
                ))}
              </div>
            ) : (
              !readOnly && <p className="ob-notes-empty">No notes yet.</p>
            )}

            {!readOnly && (
              <>
                <label className="ob-notes-label" style={{ marginTop: '0.75rem' }}>
                  <BookMarked size={14} /> Add a Note
                </label>
                <textarea
                  className="ob-notes"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Type a note about this school's setup…"
                  rows={3}
                />
              </>
            )}
          </div>

          {!readOnly && (
            <div className="ob-card-actions">
              <button className="ob-btn ob-btn--save" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save Progress'}
              </button>
              <button
                className="ob-btn ob-btn--complete"
                onClick={handleMarkComplete}
                disabled={completing}
              >
                <CheckCircle2 size={15} />
                {completing ? 'Marking…' : 'Mark Complete'}
              </button>
              {saveMsg && <span className="ob-save-msg">{saveMsg}</span>}
            </div>
          )}

          {/* Reply thread */}
          <ReplyThread
            thread={localReplies}
            replyEndpoint={`schools/${record.id}/reply/`}
            agentName={agentName}
            onNewReply={r => setLocalReplies(prev => [...prev, r])}
          />
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════
   CONTACTS SECTION
   ════════════════════════════════════════════════ */
function ContactCard({ contact, onUpdate }) {
  const [expanded, setExpanded] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [localReplies, setLocalReplies] = useState(contact.replies || []);
  const agentName = localStorage.getItem('onboardingUserName') || 'Onboarding Agent';

  const handleSave = async (newStatus) => {
    setSaving(true);
    const payload = {};
    if (newStatus) payload.status = newStatus;
    if (newNote.trim()) payload.new_note = newNote.trim();
    const ok = await onUpdate(contact.id, payload);
    if (ok) {
      setNewNote('');
      setSaveMsg(newStatus === 'resolved' ? 'Marked resolved!' : 'Saved!');
      setTimeout(() => setSaveMsg(''), 2500);
    }
    setSaving(false);
  };

  const isResolved = contact.status === 'resolved';

  return (
    <div className={`ob-card ${isResolved ? 'ob-card--completed' : 'ob-card--active'}`}>
      <div className="ob-card-header" onClick={() => setExpanded(v => !v)}>
        <div className="ob-card-left">
          <div className="ob-card-school">{contact.school_name}</div>
          <div className="ob-card-meta">
            <span className="ob-card-reg"><Mail size={12} /> {contact.email}</span>
            {contact.phone && <span className="ob-card-reg"><Phone size={12} /> {contact.phone}</span>}
          </div>
        </div>
        <div className="ob-card-right">
          <span className={`ob-status-badge ${isResolved ? 'ob-badge--done' : ''}`}
            style={!isResolved ? { background: '#ede9fe', color: '#5b21b6', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', fontWeight: 600, padding: '0.25rem 0.6rem', borderRadius: '20px' } : {}}>
            {isResolved ? <><CheckCircle2 size={13} /> Done</> : <><Clock size={13} /> {contact.status.replace('_', ' ')}</>}
          </span>
          {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </div>

      <div className="ob-card-info">
        <span><Building2 size={13} /> {contact.contact_name}</span>
        <span><Calendar size={13} /> Received {formatDate(contact.created_at)}</span>
        {contact.assigned_at && <span><UserCheck size={13} /> Assigned {formatDate(contact.assigned_at)}</span>}
      </div>

      {expanded && (
        <div className="ob-card-body">
          {/* Their message */}
          <div>
            <div className="ob-checklist-title">Their Message</div>
            <p style={{ fontSize: '0.875rem', color: '#374151', lineHeight: '1.65', margin: '0.4rem 0 0', whiteSpace: 'pre-wrap' }}>
              {contact.message}
            </p>
            {(contact.expected_students || contact.expected_staff) && (
              <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.6rem', fontSize: '0.8rem', color: '#64748b' }}>
                {contact.expected_students && <span><strong>Students:</strong> {contact.expected_students}</span>}
                {contact.expected_staff && <span><strong>Staff:</strong> {contact.expected_staff}</span>}
              </div>
            )}
          </div>

          {/* Admin notes */}
          {contact.admin_notes && (
            <div className="ob-admin-notes">
              <div className="ob-admin-notes-label">
                <AlertCircle size={14} /> Notes from Admin
              </div>
              {parseNotes(contact.admin_notes).map((entry, i) => (
                <div key={i} className="ob-note-entry ob-note-entry--admin">
                  {entry.ts && <span className="ob-note-ts">{entry.ts}</span>}
                  <p className="ob-note-text">{entry.text}</p>
                </div>
              ))}
            </div>
          )}

          {/* Add note + actions */}
          {!isResolved && (
            <div className="ob-notes-section">
              <label className="ob-notes-label"><StickyNote size={14} /> Add a Note</label>
              <textarea
                className="ob-notes"
                value={newNote}
                onChange={e => setNewNote(e.target.value)}
                placeholder="Log your outreach attempt, outcome, follow-up…"
                rows={3}
              />
              <div className="ob-card-actions" style={{ marginTop: '0.5rem' }}>
                <button className="ob-btn ob-btn--save" onClick={() => handleSave()} disabled={saving}>
                  {saving ? 'Saving…' : 'Save Note'}
                </button>
                <button
                  className="ob-btn ob-btn--complete"
                  onClick={() => handleSave('resolved')}
                  disabled={saving}
                >
                  <CheckCircle2 size={15} /> Mark Resolved
                </button>
                {saveMsg && <span className="ob-save-msg">{saveMsg}</span>}
              </div>
            </div>
          )}

          {/* Reply thread */}
          <ReplyThread
            replies={localReplies}
            replyEndpoint={`contacts/${contact.id}/reply/`}
            agentName={agentName}
            onNewReply={r => setLocalReplies(prev => [...prev, r])}
          />
        </div>
      )}
    </div>
  );
}

function ContactsSection() {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('active');

  const load = useCallback(async () => {
    setLoading(true);
    const data = await onboardFetch(`contacts/?status=${tab}`);
    if (data) setContacts(data.contacts || []);
    setLoading(false);
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  const handleUpdate = async (id, payload) => {
    const res = await onboardFetch(`contacts/${id}/update/`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    if (res?.message) { load(); return true; }
    return false;
  };

  return (
    <>
      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        {[{ key: 'active', label: 'Pending' }, { key: 'resolved', label: 'Resolved' }].map(t => (
          <button
            key={t.key}
            className={`ob-tab${tab === t.key ? ' active' : ''}`}
            style={{ borderBottom: tab === t.key ? '2px solid #2563eb' : '2px solid transparent' }}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="ob-loading"><span className="ob-spinner" /> Loading…</div>
      ) : contacts.length === 0 ? (
        <div className="ob-empty">
          <AlertCircle size={40} />
          <p>{tab === 'active' ? 'No contact tasks assigned to you yet.' : 'No resolved contacts yet.'}</p>
        </div>
      ) : (
        <div className="ob-school-list">
          {contacts.map(c => (
            <ContactCard key={c.id} contact={c} onUpdate={handleUpdate} />
          ))}
        </div>
      )}
    </>
  );
}

/* ════════════════════════════════════════════════
   SUPPORT SECTION
   ════════════════════════════════════════════════ */
const SUPPORT_STATUS_STYLE = {
  open:        { bg: '#dbeafe', color: '#1e40af', label: 'Open' },
  assigned:    { bg: '#fef3c7', color: '#92400e', label: 'Assigned' },
  in_progress: { bg: '#ede9fe', color: '#5b21b6', label: 'In Progress' },
  resolved:    { bg: '#d1fae5', color: '#065f46', label: 'Resolved' },
};

function SupportCard({ ticket, onUpdate }) {
  const [expanded, setExpanded] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [localReplies, setLocalReplies] = useState(ticket.replies || []);
  const agentName = localStorage.getItem('onboardingUserName') || 'Onboarding Agent';

  const isResolved = ticket.status === 'resolved';
  const st = SUPPORT_STATUS_STYLE[ticket.status] || SUPPORT_STATUS_STYLE.open;

  const handleSave = async (newStatus) => {
    setSaving(true);
    const payload = {};
    if (newStatus) payload.status = newStatus;
    if (newNote.trim()) payload.new_note = newNote.trim();
    const ok = await onUpdate(ticket.id, payload);
    if (ok) {
      setNewNote('');
      setSaveMsg(newStatus === 'resolved' ? 'Marked resolved!' : 'Saved!');
      setTimeout(() => setSaveMsg(''), 2500);
    }
    setSaving(false);
  };

  return (
    <div className={`ob-card ${isResolved ? 'ob-card--completed' : 'ob-card--active'}`}>
      <div className="ob-card-header" onClick={() => setExpanded(v => !v)}>
        <div className="ob-card-left">
          <div className="ob-card-school">{ticket.subject}</div>
          <div className="ob-card-meta">
            <span className="ob-card-reg"><Building2 size={12} /> {ticket.school_name}</span>
            <span className="ob-card-reg"><Mail size={12} /> {ticket.submitted_by_email}</span>
          </div>
        </div>
        <div className="ob-card-right">
          <span style={{ background: st.bg, color: st.color, fontSize: '0.72rem', fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>
            {st.label}
          </span>
          {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </div>

      <div className="ob-card-info">
        <span><UserCheck size={13} /> {ticket.submitted_by_name}</span>
        <span><Calendar size={13} /> Received {formatDate(ticket.created_at)}</span>
        {ticket.assigned_at && <span><Clock size={13} /> Assigned {formatDate(ticket.assigned_at)}</span>}
        {isResolved && ticket.resolved_at && (
          <span style={{ color: '#16a34a', fontWeight: 600 }}>
            <CheckCircle2 size={13} /> Resolved {formatDate(ticket.resolved_at)}
          </span>
        )}
      </div>

      {expanded && (
        <div className="ob-card-body">
          {/* Their message */}
          <div>
            <div className="ob-checklist-title">Their Message</div>
            <p style={{ fontSize: '0.875rem', color: '#374151', lineHeight: '1.65', margin: '0.4rem 0 0', whiteSpace: 'pre-wrap' }}>
              {ticket.message}
            </p>
          </div>

          {/* Admin notes */}
          {ticket.admin_notes && (
            <div className="ob-admin-notes">
              <div className="ob-admin-notes-label"><AlertCircle size={14} /> Notes from Admin</div>
              {parseNotes(ticket.admin_notes).map((entry, i) => (
                <div key={i} className="ob-note-entry ob-note-entry--admin">
                  {entry.ts && <span className="ob-note-ts">{entry.ts}</span>}
                  <p className="ob-note-text">{entry.text}</p>
                </div>
              ))}
            </div>
          )}

          {/* My notes history */}
          {ticket.agent_notes && (
            <div className="ob-notes-section">
              <div className="ob-notes-label"><StickyNote size={14} /> Notes History</div>
              <div className="ob-note-history">
                {parseNotes(ticket.agent_notes).map((entry, i) => (
                  <div key={i} className="ob-note-entry">
                    {entry.ts && <span className="ob-note-ts">{entry.ts}</span>}
                    <p className="ob-note-text">{entry.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          {!isResolved && (
            <div className="ob-notes-section">
              <label className="ob-notes-label"><BookMarked size={14} /> Add a Note</label>
              <textarea
                className="ob-notes"
                value={newNote}
                onChange={e => setNewNote(e.target.value)}
                placeholder="Log your response, action taken, follow-up…"
                rows={3}
              />
              <div className="ob-card-actions" style={{ marginTop: '0.5rem' }}>
                {ticket.status !== 'in_progress' && (
                  <button className="ob-btn ob-btn--save" onClick={() => handleSave('in_progress')} disabled={saving}>
                    <PlayCircle size={15} /> {saving ? 'Saving…' : 'Mark In Progress'}
                  </button>
                )}
                {ticket.status === 'in_progress' && (
                  <button className="ob-btn ob-btn--save" onClick={() => handleSave()} disabled={saving}>
                    {saving ? 'Saving…' : 'Save Note'}
                  </button>
                )}
                <button className="ob-btn ob-btn--complete" onClick={() => handleSave('resolved')} disabled={saving}>
                  <CheckCircle2 size={15} /> Mark Resolved
                </button>
                {saveMsg && <span className="ob-save-msg">{saveMsg}</span>}
              </div>
            </div>
          )}

          {/* Reply thread */}
          <ReplyThread
            replies={localReplies}
            replyEndpoint={`support/${ticket.id}/reply/`}
            agentName={agentName}
            onNewReply={r => setLocalReplies(prev => [...prev, r])}
          />
        </div>
      )}
    </div>
  );
}

function SupportSection() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusTab, setStatusTab] = useState('active');

  const load = useCallback(async () => {
    setLoading(true);
    const data = await onboardFetch(`support/?status=${statusTab}`);
    if (data) setTickets(data.tickets || []);
    setLoading(false);
  }, [statusTab]);

  useEffect(() => { load(); }, [load]);

  const handleUpdate = async (id, payload) => {
    const res = await onboardFetch(`support/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    if (res?.message) { load(); return true; }
    return false;
  };

  return (
    <>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        {[{ key: 'active', label: 'Active' }, { key: 'resolved', label: 'Resolved' }].map(t => (
          <button
            key={t.key}
            className={`ob-tab${statusTab === t.key ? ' active' : ''}`}
            style={{ borderBottom: statusTab === t.key ? '2px solid #2563eb' : '2px solid transparent' }}
            onClick={() => setStatusTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="ob-loading"><span className="ob-spinner" /> Loading…</div>
      ) : tickets.length === 0 ? (
        <div className="ob-empty">
          <HeartHandshake size={40} />
          <p>{statusTab === 'active' ? 'No support tickets assigned to you yet.' : 'No resolved tickets yet.'}</p>
        </div>
      ) : (
        <div className="ob-school-list">
          {tickets.map(t => (
            <SupportCard key={t.id} ticket={t} onUpdate={handleUpdate} />
          ))}
        </div>
      )}
    </>
  );
}

/* ════════════════════════════════════════════════
   MAIN DASHBOARD
   ════════════════════════════════════════════════ */
function OnboardingDashboard() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('active');
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);

  const agentName = localStorage.getItem('onboardingUserName') || 'Agent';

  useEffect(() => {
    const token = localStorage.getItem('onboardingAccessToken');
    if (!token) navigate('/onboarding/login');
  }, [navigate]);

  const loadSchools = useCallback(async (statusKey) => {
    if (statusKey === 'contacts' || statusKey === 'support') return; // handled by dedicated sections
    setLoading(true);
    const data = await onboardFetch(`schools/?status=${statusKey}`);
    if (data) setSchools(data.schools || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadSchools(tab);
  }, [tab, loadSchools]);

  const handleUpdate = async (recordId, payload) => {
    const res = await onboardFetch(`schools/${recordId}/update/`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    if (res?.message) {
      loadSchools(tab);
      return true;
    }
    return false;
  };

  const handleLogout = () => {
    localStorage.removeItem('onboardingAccessToken');
    localStorage.removeItem('onboardingUserName');
    navigate('/onboarding/login');
  };

  const TABS = [
    { key: 'active',    label: 'My Tasks',   icon: <ClipboardList size={16} /> },
    { key: 'completed', label: 'Completed',  icon: <CheckCircle2 size={16} /> },
    { key: 'contacts',  label: 'Contacts',   icon: <MessageSquare size={16} /> },
    { key: 'support',   label: 'Support',    icon: <HeartHandshake size={16} /> },
  ];

  return (
    <div className="ob-dash">
      {/* Header */}
      <header className="ob-header">
        <div className="ob-header-left">
          <div className="ob-header-icon">
            <UserCheck size={22} />
          </div>
          <div>
            <div className="ob-header-title">InsightWick Onboarding</div>
            <div className="ob-header-sub">Welcome, {agentName}</div>
          </div>
        </div>
        <button className="ob-logout-btn" onClick={handleLogout}>
          <LogOut size={16} /> Sign Out
        </button>
      </header>

      {/* Tabs */}
      <div className="ob-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`ob-tab ${tab === t.key ? 'active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <main className="ob-main">
        {tab === 'contacts' ? (
          <ContactsSection />
        ) : tab === 'support' ? (
          <SupportSection />
        ) : loading ? (
          <div className="ob-loading">
            <span className="ob-spinner" />
            Loading…
          </div>
        ) : schools.length === 0 ? (
          <div className="ob-empty">
            <AlertCircle size={40} />
            <p>
              {tab === 'active'
                ? 'No schools assigned to you yet. Check back soon!'
                : 'No completed schools yet.'}
            </p>
          </div>
        ) : (
          <div className="ob-school-list">
            {schools.map((s) => (
              <SchoolCard
                key={s.id}
                record={s}
                onUpdate={handleUpdate}
                readOnly={tab === 'completed'}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default OnboardingDashboard;
