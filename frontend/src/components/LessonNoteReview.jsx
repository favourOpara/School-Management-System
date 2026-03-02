// Admin/Principal — Lesson Note Review
// Weeks setting → teacher list with completion stats → drill-down → per-note review
import React, { useState, useEffect } from 'react';
import { useSchool } from '../contexts/SchoolContext';

const STATUS_META = {
  draft:          { label: 'Draft',          color: '#6b7280', bg: '#f3f4f6' },
  pending_review: { label: 'Under Review',   color: '#d97706', bg: '#fffbeb' },
  needs_revision: { label: 'Needs Revision', color: '#dc2626', bg: '#fef2f2' },
  approved:       { label: 'Approved',       color: '#16a34a', bg: '#f0fdf4' },
  sent:           { label: 'Sent',           color: '#2563eb', bg: '#eff6ff' },
};

const AI_RATING = {
  good:              { label: 'Good',              color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
  needs_improvement: { label: 'Needs Improvement', color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  poor:              { label: 'Poor',              color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
};

// ─── Reusable Note Review Panel ───────────────────────────────────────────────
function NoteReviewPanel({ note, noteId, schoolHasAI, buildApiUrl, onClose, onRefresh }) {
  const [aiLoading, setAiLoading]     = useState(false);
  const [aiError, setAiError]         = useState(null);
  const [aiData, setAiData]           = useState(
    (note.ai_rating || note.ai_feedback)
      ? { ai_rating: note.ai_rating, ai_feedback: note.ai_feedback }
      : null
  );
  const [statusForm, setStatusForm]   = useState({ status: note.note_status || '', feedback: note.admin_feedback || '' });
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusError, setStatusError]   = useState(null);
  const [emailWarning, setEmailWarning] = useState(null);

  const token = () => localStorage.getItem('accessToken');

  const handleAIReview = async (sendToTeacher = false) => {
    setAiLoading(true); setAiError(null);
    try {
      const body = new FormData();
      if (sendToTeacher) body.append('send_to_teacher', 'true');
      const res = await fetch(buildApiUrl(`/schooladmin/admin/lesson-notes/${noteId}/ai-review/`), {
        method: 'POST', headers: { Authorization: `Bearer ${token()}` }, body,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'AI review failed.');
      setAiData(data);
      if (data.email_warning) setEmailWarning(data.email_warning);
      if (sendToTeacher) {
        setStatusForm(p => ({ ...p, status: data.status }));
        onRefresh(); // closes panel and refreshes list only when sending to teacher
      }
    } catch (e) { setAiError(e.message); }
    setAiLoading(false);
  };

  const handleStatusUpdate = async () => {
    if (!statusForm.status) { setStatusError('Select a status.'); return; }
    setStatusSaving(true); setStatusError(null);
    try {
      const res = await fetch(buildApiUrl(`/schooladmin/admin/lesson-notes/${noteId}/update-status/`), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: statusForm.status, feedback: statusForm.feedback }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed.');
      if (data.email_warning) setEmailWarning(data.email_warning);
      onRefresh();
    } catch (e) { setStatusError(e.message); }
    setStatusSaving(false);
  };

  const currentAiRating = aiData?.ai_rating || note.ai_rating;
  const currentAiFeedback = aiData?.ai_feedback || note.ai_feedback;
  const st = STATUS_META[note.note_status] || null;

  return (
    <div style={{ background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: '12px', padding: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
        <div>
          <h3 style={{ margin: '0 0 0.2rem', fontSize: '1.05rem', fontWeight: 700 }}>
            Week {note.week_number} — {note.topic}
          </h3>
          <p style={{ margin: 0, fontSize: '0.8rem', color: '#6b7280' }}>
            {note.subject_name} · {note.class_session_name}
          </p>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.3rem', cursor: 'pointer', color: '#9ca3af' }}>×</button>
      </div>

      {st && <span style={{ background: st.bg, color: st.color, borderRadius: '999px', padding: '0.2rem 0.75rem', fontSize: '0.8rem', fontWeight: 700, display: 'inline-block', marginBottom: '1rem' }}>{st.label}</span>}

      {note.note_file_url && (
        <div style={{ marginBottom: '1rem' }}>
          <a href={note.note_file_url} target="_blank" rel="noreferrer"
            style={{ color: '#2563eb', fontWeight: 600, fontSize: '0.875rem' }}>
            📎 View / Download Attached File
          </a>
        </div>
      )}

      {/* Email limit warning */}
      {emailWarning && (
        <div style={{ background: '#fffbeb', border: '1.5px solid #fcd34d', borderRadius: '8px', padding: '0.65rem 0.9rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.82rem', color: '#92400e' }}>⚠️ {emailWarning}</span>
          <button onClick={() => setEmailWarning(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#92400e', fontSize: '1rem', lineHeight: 1, flexShrink: 0 }}>×</button>
        </div>
      )}

      {/* AI Review */}
      {schoolHasAI && note.note_status !== 'sent' && (
        <div style={{ background: '#f8faff', border: '1.5px solid #dbeafe', borderRadius: '10px', padding: '1rem', marginBottom: '1rem' }}>
          <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.82rem', fontWeight: 700, color: '#1e40af' }}>AI REVIEW</h4>
          {aiError && <div style={{ color: '#dc2626', fontSize: '0.8rem', marginBottom: '0.5rem' }}>{aiError}</div>}
          {currentAiRating && (() => {
            const r = AI_RATING[currentAiRating] || { label: currentAiRating, color: '#6b7280', bg: '#f3f4f6', border: '#e5e7eb' };
            return (
              <div style={{ background: r.bg, border: `1px solid ${r.border}`, borderRadius: '8px', padding: '0.75rem', marginBottom: '0.75rem' }}>
                <span style={{ fontWeight: 700, fontSize: '0.8rem', color: r.color }}>Rating: {r.label}</span>
                {currentAiFeedback && <p style={{ margin: '0.4rem 0 0', fontSize: '0.8rem', color: '#374151', whiteSpace: 'pre-wrap' }}>{currentAiFeedback}</p>}
              </div>
            );
          })()}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button onClick={() => handleAIReview(false)} disabled={aiLoading}
              style={{ padding: '0.4rem 0.8rem', border: '1px solid #bfdbfe', borderRadius: '6px', background: '#eff6ff', color: '#1d4ed8', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
              {aiLoading ? 'Running...' : currentAiRating ? 'Re-run AI' : 'Run AI Review'}
            </button>
            {!note.ai_feedback_sent_to_teacher && (
              <button onClick={() => handleAIReview(true)} disabled={aiLoading}
                style={{ padding: '0.4rem 0.8rem', border: 'none', borderRadius: '6px', background: '#1d4ed8', color: '#fff', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
                {aiLoading ? '...' : 'Send AI Feedback to Teacher'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Status update */}
      {note.note_status !== 'sent' && (
        <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '1rem', marginBottom: '1rem' }}>
          <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.8rem', fontWeight: 700, color: '#374151', textTransform: 'uppercase' }}>Update Status</h4>
          {statusError && <div style={{ color: '#dc2626', fontSize: '0.8rem', marginBottom: '0.5rem' }}>{statusError}</div>}
          <select value={statusForm.status} onChange={e => setStatusForm(p => ({ ...p, status: e.target.value }))}
            style={{ width: '100%', padding: '0.5rem 0.7rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.875rem', background: '#fff', marginBottom: '0.65rem' }}>
            <option value="">— Select status —</option>
            <option value="needs_revision">Needs Revision</option>
            <option value="approved">Approved</option>
            <option value="pending_review">Back to Pending</option>
          </select>
          <textarea value={statusForm.feedback} onChange={e => setStatusForm(p => ({ ...p, feedback: e.target.value }))}
            placeholder="Feedback to teacher (optional)..." rows={3}
            style={{ width: '100%', padding: '0.5rem 0.7rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.85rem', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: '0.65rem' }} />
          <button onClick={handleStatusUpdate} disabled={statusSaving}
            style={{ width: '100%', padding: '0.55rem', border: 'none', borderRadius: '6px', background: '#374151', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
            {statusSaving ? 'Saving...' : 'Update Status'}
          </button>
        </div>
      )}

      {/* Sent indicator — teacher handles the actual sending */}
      {note.note_status === 'sent' && (
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '1rem', textAlign: 'center' }}>
          <p style={{ margin: 0, fontWeight: 700, color: '#1e40af', fontSize: '0.875rem' }}>✅ Sent to students by teacher</p>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function LessonNoteReview() {
  const { buildApiUrl, school, subscription, hasFeature } = useSchool();

  // Derive AI availability directly from subscription context (matches backend _plan_has_ai_review logic)
  const schoolHasAI = ['premium', 'custom'].includes(subscription?.plan?.name);

  // Weeks setting
  const [weeksInput, setWeeksInput]   = useState('');
  const [weeksSaving, setWeeksSaving] = useState(false);

  // Teacher list
  const [teachers, setTeachers]         = useState([]);
  const [weeksPerTerm, setWeeksPerTerm] = useState(school?.lesson_note_weeks_per_term || 12);
  const [loadingTeachers, setLoadingTeachers] = useState(true);

  // Drill-down
  const [selectedTeacher, setSelectedTeacher]   = useState(null);  // { teacher_id, teacher_name, ... }
  const [teacherDetail, setTeacherDetail]       = useState(null);  // full detail
  const [loadingDetail, setLoadingDetail]       = useState(false);

  // Note review panel
  const [reviewNote, setReviewNote]     = useState(null);  // week object with note info
  const [expandedSubject, setExpandedSubject] = useState(null); // subject_id of open accordion

  // Notify
  const [notifying, setNotifying]     = useState(false);
  const [notifyResult, setNotifyResult] = useState('');

  const token = () => localStorage.getItem('accessToken');

  useEffect(() => {
    fetchTeachers();
  }, []);

  useEffect(() => {
    if (selectedTeacher) {
      setExpandedSubject(null);
      fetchTeacherDetail(selectedTeacher.teacher_id);
    }
  }, [selectedTeacher]);

  const fetchTeachers = async () => {
    setLoadingTeachers(true);
    try {
      const res = await fetch(buildApiUrl('/schooladmin/admin/lesson-notes/teachers/'), {
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setTeachers(data.teachers || []);
      setWeeksPerTerm(data.weeks_per_term || 12);
      setWeeksInput(String(data.weeks_per_term || 12));
    } finally {
      setLoadingTeachers(false);
    }
  };

  const fetchTeacherDetail = async (teacherId) => {
    setLoadingDetail(true);
    try {
      const res = await fetch(buildApiUrl(`/schooladmin/admin/lesson-notes/teachers/${teacherId}/`), {
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (res.ok) setTeacherDetail(await res.json());
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleSaveWeeks = async () => {
    const w = parseInt(weeksInput);
    if (!w || w < 1 || w > 52) { alert('Enter a number between 1 and 52.'); return; }
    setWeeksSaving(true);
    const res = await fetch(buildApiUrl('/schooladmin/admin/lesson-notes/weeks/'), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ weeks: w }),
    });
    if (res.ok) { setWeeksPerTerm(w); fetchTeachers(); }
    setWeeksSaving(false);
  };

  const handleNotifyAll = async () => {
    setNotifying(true); setNotifyResult('');
    const res = await fetch(buildApiUrl('/schooladmin/admin/lesson-notes/notify-all/'), {
      method: 'POST', headers: { Authorization: `Bearer ${token()}` },
    });
    const data = await res.json();
    setNotifyResult(data.detail || 'Done.');
    setNotifying(false);
  };

  const handleNotifyOne = async (teacherId) => {
    const res = await fetch(buildApiUrl(`/schooladmin/admin/lesson-notes/notify/${teacherId}/`), {
      method: 'POST', headers: { Authorization: `Bearer ${token()}` },
    });
    const data = await res.json();
    alert(data.detail);
  };

  const progressColor = (done, expected) => {
    if (done >= expected) return '#16a34a';
    if (done >= expected * 0.5) return '#d97706';
    return '#dc2626';
  };

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ margin: '0 0 0.25rem', fontSize: '1.4rem', fontWeight: 700, color: '#111827' }}>Lesson Note Review</h2>
          <p style={{ margin: 0, color: '#6b7280', fontSize: '0.875rem' }}>
            Track lesson note submissions, review content, and send to students.
          </p>
        </div>

        {/* Weeks setting */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '0.75rem 1rem' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }}>Weeks per term:</span>
          <input
            type="number" min="1" max="52" value={weeksInput}
            onChange={e => setWeeksInput(e.target.value)}
            style={{ width: '64px', padding: '0.4rem 0.5rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.9rem', textAlign: 'center' }}
          />
          <button onClick={handleSaveWeeks} disabled={weeksSaving}
            style={{ padding: '0.4rem 0.85rem', border: 'none', borderRadius: '6px', background: '#2563eb', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem' }}>
            {weeksSaving ? '...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Notify all + result */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <button onClick={handleNotifyAll} disabled={notifying}
          style={{ padding: '0.55rem 1.1rem', border: 'none', borderRadius: '8px', background: '#dc2626', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '0.875rem' }}>
          {notifying ? 'Notifying...' : '🔔 Notify All Incomplete Teachers'}
        </button>
        {notifyResult && <span style={{ fontSize: '0.85rem', color: '#16a34a', fontWeight: 600 }}>{notifyResult}</span>}
      </div>

      <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
        {/* Teacher list */}
        <div style={{ flex: selectedTeacher ? '0 0 340px' : '1', minWidth: 0 }}>
          {loadingTeachers ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>Loading teachers...</div>
          ) : teachers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>
              <p>No teachers found in this school.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {teachers.map(t => {
                const done = t.total_notes;
                const expected = t.total_expected;
                const pct = expected > 0 ? Math.min(100, Math.round((done / expected) * 100)) : 0;
                const isSelected = selectedTeacher?.teacher_id === t.teacher_id;

                return (
                  <div key={t.teacher_id} onClick={() => setSelectedTeacher(t)}
                    style={{
                      background: isSelected ? '#eff6ff' : '#fff',
                      border: `1.5px solid ${isSelected ? '#93c5fd' : '#e5e7eb'}`,
                      borderRadius: '10px', padding: '1rem', cursor: 'pointer',
                    }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ fontWeight: 700, color: '#111827', fontSize: '0.9rem' }}>{t.teacher_name}</span>
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: progressColor(done, expected) }}>
                        {done}/{expected}
                      </span>
                    </div>
                    {/* Progress bar */}
                    <div style={{ background: '#e5e7eb', borderRadius: '999px', height: '6px', marginBottom: '0.5rem', overflow: 'hidden' }}>
                      <div style={{ background: progressColor(done, expected), width: `${pct}%`, height: '100%', borderRadius: '999px' }} />
                    </div>
                    {/* Per-subject chips */}
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      {t.subjects.map(s => (
                        <span key={s.subject_id} style={{
                          fontSize: '0.72rem', fontWeight: 600, padding: '0.1rem 0.55rem',
                          borderRadius: '999px', border: `1px solid ${progressColor(s.notes_count, s.expected)}40`,
                          color: progressColor(s.notes_count, s.expected),
                          background: `${progressColor(s.notes_count, s.expected)}10`,
                        }}>
                          {s.subject_name}: {s.notes_count}/{s.expected}
                        </span>
                      ))}
                    </div>
                    {/* Notify individual */}
                    {done < expected && (
                      <button onClick={e => { e.stopPropagation(); handleNotifyOne(t.teacher_id); }}
                        style={{ marginTop: '0.5rem', padding: '0.3rem 0.65rem', border: '1px solid #fca5a5', borderRadius: '5px', background: '#fef2f2', color: '#dc2626', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600 }}>
                        Notify
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Teacher detail panel */}
        {selectedTeacher && (
          <div style={{ flex: 1, minWidth: 0 }}>
            {loadingDetail ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>Loading...</div>
            ) : teacherDetail && !reviewNote && (
              <div>
                {/* Teacher header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                  <div>
                    <h3 style={{ margin: '0 0 0.2rem', fontSize: '1.1rem', fontWeight: 700 }}>{teacherDetail.teacher_name}</h3>
                    <p style={{ margin: 0, fontSize: '0.82rem', color: '#6b7280' }}>{teacherDetail.teacher_email}</p>
                  </div>
                  <button onClick={() => { setSelectedTeacher(null); setTeacherDetail(null); }}
                    style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#9ca3af' }}>×</button>
                </div>

                {/* Subjects — accordion, one open at a time */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {teacherDetail.subjects.map(subj => {
                  const isOpen = expandedSubject === subj.subject_id;
                  return (
                    <div key={subj.subject_id} style={{ border: `1.5px solid ${isOpen ? '#93c5fd' : '#e5e7eb'}`, borderRadius: '10px', overflow: 'hidden' }}>
                      {/* Subject header — click to toggle */}
                      <button
                        onClick={() => setExpandedSubject(isOpen ? null : subj.subject_id)}
                        style={{
                          width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '0.75rem 1rem', background: isOpen ? '#eff6ff' : '#f9fafb',
                          border: 'none', cursor: 'pointer', textAlign: 'left',
                        }}
                      >
                        <div>
                          <span style={{ fontWeight: 700, color: '#111827', fontSize: '0.9rem' }}>{subj.subject_name}</span>
                          <span style={{ marginLeft: '0.5rem', fontSize: '0.78rem', color: '#6b7280' }}>{subj.class_session_name}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
                          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: progressColor(subj.notes_uploaded, subj.expected) }}>
                            {subj.notes_uploaded}/{subj.expected} notes
                          </span>
                          <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{isOpen ? '▲' : '▼'}</span>
                        </div>
                      </button>

                      {/* Week rows — only shown when open */}
                      {isOpen && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', padding: '0.65rem' }}>
                          {subj.weeks.map(w => {
                            const st = w.note_status ? STATUS_META[w.note_status] : null;
                            return (
                              <div key={w.week_number} style={{
                                display: 'flex', alignItems: 'center', gap: '0.75rem',
                                background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px',
                                padding: '0.6rem 0.85rem',
                                borderLeft: `4px solid ${st?.color || (w.topic ? '#d1d5db' : '#e5e7eb')}`,
                              }}>
                                <span style={{ flexShrink: 0, fontWeight: 700, fontSize: '0.78rem', color: '#6b7280', width: '56px' }}>Week {w.week_number}</span>
                                <span style={{ flex: 1, fontSize: '0.85rem', color: w.topic ? '#111827' : '#9ca3af', fontStyle: w.topic ? 'normal' : 'italic' }}>
                                  {w.topic || 'No topic set'}
                                </span>
                                {st && (
                                  <span style={{ background: st.bg, color: st.color, borderRadius: '999px', padding: '0.1rem 0.6rem', fontSize: '0.7rem', fontWeight: 700, flexShrink: 0 }}>
                                    {st.label}
                                  </span>
                                )}
                                {w.note_id && w.note_status !== 'sent' && (
                                  <button
                                    onClick={() => setReviewNote({ ...w, subject_name: subj.subject_name, class_session_name: subj.class_session_name })}
                                    style={{ padding: '0.3rem 0.65rem', border: 'none', borderRadius: '5px', background: '#2563eb', color: '#fff', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700, flexShrink: 0 }}>
                                    Review
                                  </button>
                                )}
                                {w.note_status === 'sent' && (
                                  <span style={{ fontSize: '0.72rem', color: '#2563eb', fontWeight: 600 }}>✓ Sent</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
                </div>
              </div>
            )}

            {/* Note review panel */}
            {reviewNote && teacherDetail && (
              <NoteReviewPanel
                note={reviewNote}
                noteId={reviewNote.note_id}
                schoolHasAI={schoolHasAI}
                buildApiUrl={buildApiUrl}
                onClose={() => setReviewNote(null)}
                onRefresh={() => {
                  fetchTeacherDetail(teacherDetail.teacher_id);
                  fetchTeachers();
                  setReviewNote(null);
                }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
