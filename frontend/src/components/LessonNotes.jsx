// Teacher — Lesson Notes
// Subject selector → week grid → enter topic per week → upload note per topic → view feedback
import React, { useState, useEffect, useRef } from 'react';
import { useSchool } from '../contexts/SchoolContext';

const STATUS_META = {
  draft:          { label: 'Draft',          color: '#6b7280', bg: '#f3f4f6' },
  pending_review: { label: 'Under Review',   color: '#d97706', bg: '#fffbeb' },
  needs_revision: { label: 'Needs Revision', color: '#dc2626', bg: '#fef2f2' },
  approved:       { label: 'Approved',       color: '#16a34a', bg: '#f0fdf4' },
  sent:           { label: 'Sent',           color: '#2563eb', bg: '#eff6ff' },
};

const AI_RATING = {
  good:             { label: 'Good',             color: '#16a34a' },
  needs_improvement:{ label: 'Needs Improvement',color: '#d97706' },
  poor:             { label: 'Poor',             color: '#dc2626' },
};

export default function LessonNotes() {
  const { buildApiUrl, school } = useSchool();
  const weeksPerTerm = school?.lesson_note_weeks_per_term || 12;

  // Subjects from assigned-subjects endpoint
  const [subjects, setSubjects] = useState([]);   // [{ subject_id, subject_name, class_session_name, plans:[] }]
  const [selectedSubjectId, setSelectedSubjectId] = useState(null);
  const [loadingSubjects, setLoadingSubjects] = useState(true);

  // Topic plans for selected subject
  const [plans, setPlans] = useState([]);  // indexed by week_number

  // Inline editing
  const [editingWeek, setEditingWeek] = useState(null);   // week_number being edited
  const [editingTopic, setEditingTopic] = useState('');
  const [savingTopic, setSavingTopic] = useState(false);

  // Note upload modal
  const [noteModal, setNoteModal] = useState(null);  // { plan } or null
  const [noteContent, setNoteContent] = useState('');
  const [noteFile, setNoteFile] = useState(null);
  const [noteSubmitNow, setNoteSubmitNow] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [noteError, setNoteError] = useState(null);
  const fileInputRef = useRef(null);

  // View feedback modal
  const [viewModal, setViewModal] = useState(null);  // { plan }

  // Send to students
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState(null);

  const token = () => localStorage.getItem('accessToken');

  useEffect(() => {
    fetchSubjects();
  }, []);

  useEffect(() => {
    if (selectedSubjectId) fetchPlans(selectedSubjectId);
  }, [selectedSubjectId]);

  const fetchSubjects = async () => {
    setLoadingSubjects(true);
    try {
      const res = await fetch(buildApiUrl('/academics/teacher/assigned-subjects/'), {
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      const groups = data.subjects_by_class || [];
      const list = groups.map(g => ({
        subject_id: g.class_session_id,   // We need individual subjects, not groups
        groups: g,
      }));
      // Flatten to individual subjects
      const flat = [];
      groups.forEach(g => {
        (g.subjects || []).forEach(s => {
          flat.push({
            subject_id: s.id,
            subject_name: s.name,
            class_session_id: g.class_session_id,
            class_session_name: `${g.classroom} — ${g.academic_year} ${g.term}`,
          });
        });
      });
      setSubjects(flat);
      if (flat.length > 0 && !selectedSubjectId) setSelectedSubjectId(flat[0].subject_id);
    } finally {
      setLoadingSubjects(false);
    }
  };

  const fetchPlans = async (subjectId) => {
    try {
      const res = await fetch(buildApiUrl(`/schooladmin/topic-plans/?subject_id=${subjectId}`), {
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      // data is array of grouped subjects; filter for selected subject
      const match = data.find(g => String(g.subject_id) === String(subjectId));
      setPlans(match ? match.plans : []);
    } catch {}
  };

  const planForWeek = (w) => plans.find(p => p.week_number === w) || null;

  const handleSaveTopic = async (weekNumber) => {
    if (!editingTopic.trim()) return;
    setSavingTopic(true);
    try {
      const plan = planForWeek(weekNumber);
      if (plan) {
        // Update existing
        await fetch(buildApiUrl(`/schooladmin/topic-plans/${plan.id}/`), {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ topic: editingTopic }),
        });
      } else {
        // Create new
        await fetch(buildApiUrl('/schooladmin/topic-plans/'), {
          method: 'POST',
          headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ subject_id: selectedSubjectId, week_number: weekNumber, topic: editingTopic }),
        });
      }
      setEditingWeek(null);
      setEditingTopic('');
      fetchPlans(selectedSubjectId);
    } catch {}
    setSavingTopic(false);
  };

  const handleDeletePlan = async (plan) => {
    if (!window.confirm(`Delete Week ${plan.week_number}: "${plan.topic}"?`)) return;
    await fetch(buildApiUrl(`/schooladmin/topic-plans/${plan.id}/`), {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token()}` },
    });
    fetchPlans(selectedSubjectId);
  };

  const openNoteModal = (plan) => {
    setNoteModal({ plan });
    setNoteContent('');
    setNoteFile(null);
    setNoteSubmitNow(false);
    setNoteError(null);
  };

  const openViewModal = (plan) => {
    setViewModal({ plan });
    setSendResult(null);
  };

  const handleSaveNote = async () => {
    if (!noteContent.trim() && !noteFile) {
      setNoteError('Provide content text or upload a file.');
      return;
    }
    setSavingNote(true);
    setNoteError(null);
    const plan = noteModal.plan;
    const body = new FormData();
    body.append('subject_id', selectedSubjectId);
    body.append('topic', plan.topic);
    body.append('topic_plan_id', plan.id);
    body.append('content', noteContent);
    if (noteFile) body.append('file', noteFile);
    if (noteSubmitNow) body.append('submit', 'true');

    try {
      let res;
      if (plan.note_id) {
        res = await fetch(buildApiUrl(`/schooladmin/lesson-notes/${plan.note_id}/`), {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token()}` },
          body,
        });
      } else {
        res = await fetch(buildApiUrl('/schooladmin/lesson-notes/'), {
          method: 'POST',
          headers: { Authorization: `Bearer ${token()}` },
          body,
        });
      }
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to save.');
      }
      setNoteModal(null);
      fetchPlans(selectedSubjectId);
    } catch (e) {
      setNoteError(e.message);
    } finally {
      setSavingNote(false);
    }
  };

  const handleSendToStudents = async (noteId) => {
    setSending(true);
    setSendResult(null);
    try {
      const res = await fetch(buildApiUrl(`/schooladmin/lesson-notes/${noteId}/teacher-send/`), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to send.');
      setSendResult({ success: true, students: data.students_notified });
      fetchPlans(selectedSubjectId);
    } catch (e) {
      setSendResult({ success: false, message: e.message });
    }
    setSending(false);
  };

  const selectedSubject = subjects.find(s => String(s.subject_id) === String(selectedSubjectId));
  const completedWeeks = Array.from({ length: weeksPerTerm }, (_, i) => i + 1)
    .filter(w => planForWeek(w)?.note_id).length;

  if (loadingSubjects) {
    return <div style={{ padding: '2rem', color: '#6b7280', textAlign: 'center' }}>Loading subjects...</div>;
  }

  if (subjects.length === 0) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af' }}>
        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📚</div>
        <p>No subjects assigned to you yet. Contact your admin.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '1.5rem', maxWidth: '960px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ margin: '0 0 0.25rem', fontSize: '1.4rem', fontWeight: 700, color: '#111827' }}>My Lesson Notes</h2>
        <p style={{ margin: 0, color: '#6b7280', fontSize: '0.875rem' }}>
          Plan your topics for each week, then upload a lesson note per topic for admin review.
        </p>
      </div>

      {/* Subject tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem', borderBottom: '2px solid #e5e7eb', paddingBottom: '0' }}>
        {subjects.map(s => {
          const isActive = String(s.subject_id) === String(selectedSubjectId);
          return (
            <button
              key={s.subject_id}
              onClick={() => setSelectedSubjectId(s.subject_id)}
              style={{
                padding: '0.5rem 1.1rem', border: 'none', borderRadius: '6px 6px 0 0',
                background: isActive ? '#2563eb' : '#f3f4f6',
                color: isActive ? '#fff' : '#374151',
                fontWeight: isActive ? 700 : 500,
                cursor: 'pointer', fontSize: '0.875rem',
                marginBottom: '-2px',
                borderBottom: isActive ? '2px solid #2563eb' : '2px solid transparent',
              }}
            >
              {s.subject_name}
              <span style={{ marginLeft: '0.4rem', fontSize: '0.72rem', opacity: 0.8 }}>
                {s.class_session_name?.split('—')[0]?.trim()}
              </span>
            </button>
          );
        })}
      </div>

      {/* Progress bar */}
      {selectedSubject && (
        <div style={{ marginBottom: '1.25rem', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.85rem', color: '#374151' }}>
            <span><strong>{selectedSubject.subject_name}</strong> — {selectedSubject.class_session_name}</span>
            <span style={{ fontWeight: 700, color: completedWeeks >= weeksPerTerm ? '#16a34a' : '#d97706' }}>
              {completedWeeks} / {weeksPerTerm} notes uploaded
            </span>
          </div>
          <div style={{ background: '#e5e7eb', borderRadius: '999px', height: '8px', overflow: 'hidden' }}>
            <div style={{
              background: completedWeeks >= weeksPerTerm ? '#16a34a' : '#2563eb',
              width: `${Math.min(100, (completedWeeks / weeksPerTerm) * 100)}%`,
              height: '100%', borderRadius: '999px', transition: 'width 0.3s',
            }} />
          </div>
        </div>
      )}

      {/* Week grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        {Array.from({ length: weeksPerTerm }, (_, i) => i + 1).map(week => {
          const plan = planForWeek(week);
          const note = plan;  // plan contains note fields
          const st = note?.note_status ? STATUS_META[note.note_status] : null;
          const isEditing = editingWeek === week;

          return (
            <div key={week} style={{
              background: '#fff', border: '1px solid #e5e7eb', borderRadius: '10px',
              padding: '0.85rem 1rem',
              borderLeft: `4px solid ${st?.color || (plan ? '#2563eb' : '#d1d5db')}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
                {/* Week badge */}
                <div style={{
                  flexShrink: 0, width: '52px', height: '52px', borderRadius: '10px',
                  background: st?.bg || (plan ? '#eff6ff' : '#f3f4f6'),
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ fontSize: '0.65rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase' }}>Week</span>
                  <span style={{ fontSize: '1.15rem', fontWeight: 800, color: st?.color || (plan ? '#2563eb' : '#9ca3af') }}>{week}</span>
                </div>

                {/* Topic entry */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {isEditing ? (
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <input
                        autoFocus
                        value={editingTopic}
                        onChange={e => setEditingTopic(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleSaveTopic(week); if (e.key === 'Escape') setEditingWeek(null); }}
                        placeholder={`Topic for Week ${week}...`}
                        style={{ flex: 1, padding: '0.5rem 0.7rem', border: '1.5px solid #2563eb', borderRadius: '6px', fontSize: '0.875rem' }}
                      />
                      <button onClick={() => handleSaveTopic(week)} disabled={savingTopic}
                        style={{ padding: '0.5rem 0.85rem', border: 'none', borderRadius: '6px', background: '#2563eb', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem' }}>
                        {savingTopic ? '...' : 'Save'}
                      </button>
                      <button onClick={() => setEditingWeek(null)}
                        style={{ padding: '0.5rem 0.7rem', border: '1px solid #d1d5db', borderRadius: '6px', background: '#fff', cursor: 'pointer', fontSize: '0.8rem', color: '#6b7280' }}>
                        Cancel
                      </button>
                    </div>
                  ) : plan ? (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, color: '#111827', fontSize: '0.9rem' }}>{plan.topic}</span>
                        {st && (
                          <span style={{ background: st.bg, color: st.color, borderRadius: '999px', padding: '0.1rem 0.6rem', fontSize: '0.72rem', fontWeight: 700 }}>
                            {st.label}
                          </span>
                        )}
                        {plan.ai_rating && (
                          <span style={{ color: AI_RATING[plan.ai_rating]?.color, fontSize: '0.72rem', fontWeight: 600 }}>
                            AI: {AI_RATING[plan.ai_rating]?.label}
                          </span>
                        )}
                      </div>
                      {plan.note_status === 'needs_revision' && plan.admin_feedback && (
                        <div style={{ marginTop: '0.4rem', fontSize: '0.78rem', color: '#92400e', background: '#fff7ed', borderRadius: '5px', padding: '0.4rem 0.6rem' }}>
                          <strong>Feedback:</strong> {plan.admin_feedback}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span style={{ color: '#9ca3af', fontSize: '0.875rem', fontStyle: 'italic' }}>No topic planned yet</span>
                  )}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0, alignItems: 'center' }}>
                  {!isEditing && (!note?.note_status || note.note_status === 'needs_revision' || !note.note_id) && (
                    <button
                      onClick={() => { setEditingWeek(week); setEditingTopic(plan?.topic || ''); }}
                      style={{ padding: '0.35rem 0.7rem', border: '1px solid #d1d5db', borderRadius: '6px', background: '#f9fafb', cursor: 'pointer', fontSize: '0.78rem', color: '#374151' }}>
                      {plan ? 'Edit Topic' : '+ Topic'}
                    </button>
                  )}
                  {plan && !note?.note_id && (
                    <button
                      onClick={() => openNoteModal(plan)}
                      style={{ padding: '0.35rem 0.7rem', border: 'none', borderRadius: '6px', background: '#2563eb', color: '#fff', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}>
                      Upload Note
                    </button>
                  )}
                  {plan && note?.note_id && note.note_status !== 'sent' && note.note_status !== 'approved' && (
                    <button
                      onClick={() => openNoteModal(plan)}
                      style={{ padding: '0.35rem 0.7rem', border: '1px solid #93c5fd', borderRadius: '6px', background: '#eff6ff', color: '#1d4ed8', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}>
                      {note.note_status === 'needs_revision' ? 'Revise & Resubmit' : 'Edit Note'}
                    </button>
                  )}
                  {plan && note?.note_id && (
                    <button
                      onClick={() => openViewModal(plan)}
                      style={{ padding: '0.35rem 0.7rem', border: '1px solid #d1d5db', borderRadius: '6px', background: '#f9fafb', cursor: 'pointer', fontSize: '0.78rem', color: '#374151' }}>
                      View
                    </button>
                  )}
                  {plan && !note?.note_id && (
                    <button
                      onClick={() => handleDeletePlan(plan)}
                      style={{ padding: '0.35rem 0.5rem', border: '1px solid #fecaca', borderRadius: '6px', background: '#fef2f2', cursor: 'pointer', fontSize: '0.78rem', color: '#dc2626' }}>
                      ✕
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Note upload modal */}
      {noteModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '2rem', width: '100%', maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ margin: '0 0 0.4rem', fontSize: '1.1rem', fontWeight: 700 }}>
              Week {noteModal.plan.week_number} — {noteModal.plan.topic}
            </h3>
            <p style={{ margin: '0 0 1.25rem', color: '#6b7280', fontSize: '0.85rem' }}>
              Upload your lesson note for this topic. You can type it directly or attach a file.
            </p>

            {noteError && (
              <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '6px', padding: '0.7rem', color: '#dc2626', marginBottom: '1rem', fontSize: '0.85rem' }}>{noteError}</div>
            )}

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem', color: '#374151', marginBottom: '0.35rem' }}>Content</label>
              <textarea
                value={noteContent}
                onChange={e => setNoteContent(e.target.value)}
                rows={8}
                placeholder="Type your lesson note here..."
                style={{ width: '100%', padding: '0.65rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.875rem', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem', color: '#374151', marginBottom: '0.35rem' }}>Or attach a file (PDF / DOCX)</label>
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{ border: '2px dashed #d1d5db', borderRadius: '8px', padding: '0.85rem', textAlign: 'center', cursor: 'pointer', background: '#f9fafb', fontSize: '0.85rem', color: '#6b7280' }}>
                {noteFile ? <span style={{ color: '#2563eb' }}>📎 {noteFile.name}</span> : 'Click to upload PDF or DOCX'}
              </div>
              <input ref={fileInputRef} type="file" accept=".pdf,.docx,.doc" style={{ display: 'none' }}
                onChange={e => setNoteFile(e.target.files[0] || null)} />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setNoteModal(null)} disabled={savingNote}
                style={{ padding: '0.6rem 1.1rem', border: '1px solid #d1d5db', borderRadius: '6px', background: '#fff', cursor: 'pointer', fontWeight: 600, color: '#374151' }}>
                Cancel
              </button>
              <button onClick={() => { setNoteSubmitNow(false); handleSaveNote(); }} disabled={savingNote}
                style={{ padding: '0.6rem 1.1rem', border: '1px solid #d1d5db', borderRadius: '6px', background: '#f9fafb', cursor: 'pointer', fontWeight: 600, color: '#374151' }}>
                {savingNote ? 'Saving...' : 'Save Draft'}
              </button>
              <button onClick={() => { setNoteSubmitNow(true); handleSaveNote(); }} disabled={savingNote}
                style={{ padding: '0.6rem 1.1rem', border: 'none', borderRadius: '6px', background: '#2563eb', color: '#fff', cursor: 'pointer', fontWeight: 700 }}>
                {savingNote ? 'Submitting...' : 'Submit for Review'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View / feedback modal */}
      {viewModal && (() => {
        const plan = viewModal.plan;
        const st = plan.note_status ? STATUS_META[plan.note_status] : null;
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
            <div style={{ background: '#fff', borderRadius: '12px', padding: '2rem', width: '100%', maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>Week {plan.week_number} — {plan.topic}</h3>
                <button onClick={() => setViewModal(null)} style={{ background: 'none', border: 'none', fontSize: '1.3rem', cursor: 'pointer', color: '#9ca3af' }}>×</button>
              </div>
              {st && <span style={{ background: st.bg, color: st.color, borderRadius: '999px', padding: '0.2rem 0.75rem', fontSize: '0.8rem', fontWeight: 700 }}>{st.label}</span>}
              {plan.admin_feedback && (
                <div style={{ marginTop: '1rem', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '8px', padding: '0.85rem' }}>
                  <strong style={{ fontSize: '0.82rem', color: '#92400e' }}>Admin Feedback</strong>
                  <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem', color: '#78350f', whiteSpace: 'pre-wrap' }}>{plan.admin_feedback}</p>
                </div>
              )}
              {plan.ai_rating && (
                <div style={{ marginTop: '0.75rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '0.85rem' }}>
                  <strong style={{ fontSize: '0.82rem', color: '#166534' }}>AI Rating: {AI_RATING[plan.ai_rating]?.label}</strong>
                </div>
              )}

              {/* Send to Students — only available when approved */}
              {plan.note_status === 'approved' && (
                <div style={{ marginTop: '1.25rem', background: '#f0fdf4', border: '1.5px solid #bbf7d0', borderRadius: '8px', padding: '1rem' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#166534', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.5rem' }}>
                    Send to Students
                  </div>
                  <p style={{ margin: '0 0 0.75rem', fontSize: '0.82rem', color: '#15803d' }}>
                    Your note has been approved by the admin. You can now send it to your students.
                  </p>
                  {sendResult && (
                    <div style={{
                      padding: '0.55rem 0.75rem', borderRadius: '6px', marginBottom: '0.65rem',
                      fontSize: '0.82rem',
                      background: sendResult.success ? '#dcfce7' : '#fef2f2',
                      color: sendResult.success ? '#166534' : '#dc2626',
                    }}>
                      {sendResult.success
                        ? `✅ Sent! ${sendResult.students} student(s) notified.`
                        : sendResult.message}
                    </div>
                  )}
                  {!sendResult?.success && (
                    <button
                      onClick={() => handleSendToStudents(plan.note_id)}
                      disabled={sending}
                      style={{
                        width: '100%', padding: '0.6rem', border: 'none', borderRadius: '6px',
                        background: sending ? '#9ca3af' : '#16a34a',
                        color: '#fff', fontWeight: 700, cursor: sending ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {sending ? 'Sending...' : '📤 Send to Students'}
                    </button>
                  )}
                </div>
              )}

              {plan.note_status === 'sent' && (
                <div style={{ marginTop: '1.25rem', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '0.85rem', textAlign: 'center' }}>
                  <p style={{ margin: 0, fontWeight: 700, color: '#1e40af', fontSize: '0.875rem' }}>✅ Already sent to students</p>
                </div>
              )}

              <div style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                {(plan.note_status === 'draft' || plan.note_status === 'needs_revision') && (
                  <button onClick={() => { setViewModal(null); openNoteModal(plan); }}
                    style={{ padding: '0.6rem 1.1rem', border: 'none', borderRadius: '6px', background: '#2563eb', color: '#fff', cursor: 'pointer', fontWeight: 700 }}>
                    {plan.note_status === 'needs_revision' ? 'Revise & Resubmit' : 'Edit Note'}
                  </button>
                )}
                <button onClick={() => setViewModal(null)}
                  style={{ padding: '0.6rem 1.1rem', border: '1px solid #d1d5db', borderRadius: '6px', background: '#fff', cursor: 'pointer', fontWeight: 600, color: '#374151' }}>
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
