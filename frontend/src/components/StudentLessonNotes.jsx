// Student — AI Academic Assistant
// Subjects → Topics (with week) → Note detail + AI explanation
import React, { useState, useEffect } from 'react';
import { useSchool } from '../contexts/SchoolContext';

export default function StudentLessonNotes() {
  const { buildApiUrl, subscription } = useSchool();
  const hasAI = ['premium', 'custom'].includes(subscription?.plan?.name);

  // All notes, loaded once
  const [allNotes, setAllNotes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Navigation: null = subjects view, object = topics view for that subject
  const [selectedSubject, setSelectedSubject] = useState(null); // { id, name }

  // Note detail modal
  const [selectedNote, setSelectedNote] = useState(null);

  // AI explanation state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiExplanation, setAiExplanation] = useState(null);
  const [aiError, setAiError] = useState(null);
  const [expandedSection, setExpandedSection] = useState(null);

  const token = () => localStorage.getItem('accessToken');

  useEffect(() => {
    fetchNotes();
  }, []);

  const fetchNotes = async () => {
    setLoading(true);
    try {
      const res = await fetch(buildApiUrl('/schooladmin/lesson-notes/for-students/'), {
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setAllNotes(data);
    } catch {}
    setLoading(false);
  };

  // Derive unique subjects from all notes
  const subjects = (() => {
    const seen = new Set();
    const list = [];
    allNotes.forEach(n => {
      if (n.subject_id && !seen.has(n.subject_id)) {
        seen.add(n.subject_id);
        list.push({ id: n.subject_id, name: n.subject_name });
      }
    });
    return list.sort((a, b) => a.name.localeCompare(b.name));
  })();

  // Topics (notes) for selected subject, sorted by week number
  const topicsForSubject = selectedSubject
    ? [...allNotes.filter(n => n.subject_id === selectedSubject.id)]
        .sort((a, b) => (a.week_number ?? 999) - (b.week_number ?? 999))
    : [];

  const openNote = (note) => {
    setSelectedNote(note);
    setAiExplanation(null);
    setAiError(null);
    setExpandedSection(null);
  };

  const closeNote = () => {
    setSelectedNote(null);
    setAiExplanation(null);
    setAiError(null);
    setAiLoading(false);
  };

  const handleAIExplain = async () => {
    if (!selectedNote) return;
    setAiLoading(true);
    setAiError(null);
    setAiExplanation(null);
    setExpandedSection(null);
    try {
      const res = await fetch(buildApiUrl(`/schooladmin/lesson-notes/${selectedNote.id}/ai-explain/`), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token()}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await res.json();
      if (!res.ok) {
        setAiError(data.detail || 'AI explanation failed. Please try again.');
        return;
      }
      setAiExplanation(data.explanation);
    } catch {
      setAiError('Could not connect to AI. Please check your connection and try again.');
    } finally {
      setAiLoading(false);
    }
  };

  const formatDate = (d) => {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  if (loading) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>
        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>✨</div>
        Loading your subjects...
      </div>
    );
  }

  // ─── SUBJECTS VIEW ────────────────────────────────────────────────────────
  if (!selectedSubject) {
    return (
      <div style={{ maxWidth: '860px', margin: '0 auto', padding: '1.5rem' }}>
        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{ margin: '0 0 0.3rem', fontSize: '1.4rem', fontWeight: 700, color: '#111827', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            ✨ AI Academic Assistant
          </h2>
          <p style={{ margin: 0, color: '#6b7280', fontSize: '0.875rem' }}>
            {hasAI
              ? 'Choose a subject to see your lesson topics and get AI-powered explanations.'
              : 'Choose a subject to see your lesson topics.'}
          </p>
        </div>

        {subjects.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 2rem', color: '#9ca3af' }}>
            <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>📚</div>
            <p style={{ fontWeight: 600, color: '#6b7280', fontSize: '1rem', marginBottom: '0.5rem' }}>No subjects yet</p>
            <p style={{ fontSize: '0.875rem' }}>Your teachers haven't sent any lesson notes yet. Check back soon!</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
            {subjects.map((subj, idx) => {
              const noteCount = allNotes.filter(n => n.subject_id === subj.id).length;
              // Cycle through gentle accent colours for variety
              const colours = [
                { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8', dot: '#3b82f6' },
                { bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d', dot: '#22c55e' },
                { bg: '#fdf4ff', border: '#e9d5ff', text: '#7e22ce', dot: '#a855f7' },
                { bg: '#fff7ed', border: '#fed7aa', text: '#c2410c', dot: '#f97316' },
                { bg: '#fef2f2', border: '#fecaca', text: '#b91c1c', dot: '#ef4444' },
                { bg: '#f0f9ff', border: '#bae6fd', text: '#0369a1', dot: '#0ea5e9' },
              ];
              const c = colours[idx % colours.length];
              return (
                <button
                  key={subj.id}
                  onClick={() => setSelectedSubject(subj)}
                  style={{
                    background: c.bg, border: `1.5px solid ${c.border}`,
                    borderRadius: '14px', padding: '1.4rem 1.2rem',
                    cursor: 'pointer', textAlign: 'left',
                    transition: 'transform 0.15s, box-shadow 0.15s',
                    display: 'flex', flexDirection: 'column', gap: '0.75rem',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.1)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
                >
                  {/* Icon dot */}
                  <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: c.dot, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>
                    ✨
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, color: '#111827', fontSize: '0.95rem', lineHeight: 1.3 }}>
                      {subj.name}
                    </div>
                    <div style={{ marginTop: '0.3rem', fontSize: '0.78rem', color: c.text, fontWeight: 600 }}>
                      {noteCount} {noteCount === 1 ? 'topic' : 'topics'}
                    </div>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: c.text, fontWeight: 600 }}>
                    View topics →
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ─── TOPICS VIEW ──────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: '860px', margin: '0 auto', padding: '1.5rem' }}>
      {/* Back + header */}
      <div style={{ marginBottom: '1.75rem' }}>
        <button
          onClick={() => setSelectedSubject(null)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#6b7280', fontSize: '0.85rem', fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: '0.35rem',
            padding: '0', marginBottom: '0.85rem',
          }}
        >
          ← Back to Subjects
        </button>
        <h2 style={{ margin: '0 0 0.25rem', fontSize: '1.3rem', fontWeight: 700, color: '#111827' }}>
          {selectedSubject.name}
        </h2>
        <p style={{ margin: 0, color: '#6b7280', fontSize: '0.875rem' }}>
          {topicsForSubject.length} {topicsForSubject.length === 1 ? 'topic' : 'topics'} · click any topic to read the note and get AI help
        </p>
      </div>

      {topicsForSubject.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📭</div>
          <p style={{ fontWeight: 600, color: '#6b7280' }}>No notes for this subject yet</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {topicsForSubject.map(note => (
            <button
              key={note.id}
              onClick={() => openNote(note)}
              style={{
                background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px',
                padding: '1rem 1.25rem', cursor: 'pointer', textAlign: 'left',
                borderLeft: '4px solid var(--accent-color, #2563eb)',
                transition: 'box-shadow 0.15s, border-color 0.15s',
                display: 'flex', alignItems: 'center', gap: '1rem',
              }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 2px 10px rgba(0,0,0,0.08)'; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; }}
            >
              {/* Week badge */}
              <div style={{
                flexShrink: 0, width: '52px', height: '52px', borderRadius: '10px',
                background: '#eff6ff',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ fontSize: '0.6rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Week</span>
                <span style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--accent-color, #2563eb)', lineHeight: 1 }}>
                  {note.week_number ?? '—'}
                </span>
              </div>

              {/* Topic info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, color: '#111827', fontSize: '0.95rem' }}>
                  {note.topic || 'Untitled'}
                </div>
                <div style={{ marginTop: '0.2rem', fontSize: '0.78rem', color: '#6b7280' }}>
                  {note.teacher_name && <span>by {note.teacher_name}</span>}
                  {note.sent_at && <span style={{ marginLeft: '0.5rem', color: '#d1d5db' }}>· {formatDate(note.sent_at)}</span>}
                  {note.file_url && <span style={{ marginLeft: '0.5rem' }}>📎</span>}
                </div>
              </div>

              {/* AI chip — premium only */}
              {hasAI && (
                <div style={{
                  flexShrink: 0, background: '#fdf4ff', border: '1px solid #e9d5ff',
                  borderRadius: '999px', padding: '0.25rem 0.65rem',
                  fontSize: '0.72rem', fontWeight: 700, color: '#7e22ce',
                  display: 'flex', alignItems: 'center', gap: '0.25rem',
                }}>
                  ✨ AI
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Note detail + AI modal */}
      {selectedNote && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
          zIndex: 1000, padding: '1rem', overflowY: 'auto',
        }}>
          <div style={{
            background: '#fff', borderRadius: '14px', width: '100%', maxWidth: '680px',
            marginTop: '1rem', marginBottom: '1rem', overflow: 'hidden',
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          }}>
            {/* Modal header */}
            <div style={{
              background: 'var(--accent-color, #2563eb)',
              padding: '1.25rem 1.5rem',
              display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
            }}>
              <div>
                <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.2rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {selectedNote.subject_name}
                  {selectedNote.week_number != null && <span style={{ marginLeft: '0.5rem' }}>· Week {selectedNote.week_number}</span>}
                </div>
                <h3 style={{ margin: 0, color: '#fff', fontSize: '1.1rem', fontWeight: 700 }}>
                  {selectedNote.topic || 'Lesson Note'}
                </h3>
                <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                  {selectedNote.teacher_name} · {formatDate(selectedNote.sent_at)}
                </div>
              </div>
              <button onClick={closeNote} style={{
                background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff',
                fontSize: '1.2rem', cursor: 'pointer', borderRadius: '6px',
                width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>×</button>
            </div>

            {/* Modal body */}
            <div style={{ padding: '1.5rem', maxHeight: 'calc(90vh - 120px)', overflowY: 'auto' }}>

              {/* Original content */}
              {selectedNote.content && (
                <div style={{ marginBottom: '1.25rem' }}>
                  <h4 style={{ margin: '0 0 0.6rem', fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Lesson Note
                  </h4>
                  <div style={{
                    background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px',
                    padding: '1rem', fontSize: '0.9rem', color: '#374151', lineHeight: 1.7,
                    whiteSpace: 'pre-wrap',
                  }}>
                    {selectedNote.content}
                  </div>
                </div>
              )}

              {/* Attachment */}
              {selectedNote.file_url && (
                <div style={{ marginBottom: '1.25rem' }}>
                  <a
                    href={selectedNote.file_url}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                      padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db',
                      borderRadius: '7px', color: '#374151', textDecoration: 'none',
                      fontSize: '0.85rem', fontWeight: 600,
                    }}
                  >
                    📎 Download Attachment
                  </a>
                </div>
              )}

              {/* AI Explain section — premium/custom only */}
              {hasAI && (
                <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, color: '#111827', fontSize: '0.9rem' }}>
                        ✨ AI Study Helper
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.1rem' }}>
                        Get this lesson broken down in simple, easy-to-understand language
                      </div>
                    </div>
                    <button
                      onClick={handleAIExplain}
                      disabled={aiLoading}
                      style={{
                        flexShrink: 0, padding: '0.6rem 1.25rem',
                        border: 'none', borderRadius: '8px',
                        background: aiLoading ? '#9ca3af' : 'var(--accent-color, #2563eb)',
                        color: '#fff', fontWeight: 700, fontSize: '0.875rem',
                        cursor: aiLoading ? 'not-allowed' : 'pointer',
                        display: 'flex', alignItems: 'center', gap: '0.4rem',
                      }}
                    >
                      {aiLoading ? (
                        <>
                          <span style={{
                            display: 'inline-block', width: '14px', height: '14px',
                            border: '2px solid rgba(255,255,255,0.35)', borderTopColor: '#fff',
                            borderRadius: '50%', animation: 'spin 0.7s linear infinite',
                          }} />
                          Thinking...
                        </>
                      ) : '✨ Explain This'}
                    </button>
                  </div>

                  {/* AI Error */}
                  {aiError && (
                    <div style={{
                      background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px',
                      padding: '0.85rem', color: '#dc2626', fontSize: '0.85rem', marginBottom: '1rem',
                    }}>
                      {aiError}
                    </div>
                  )}

                  {/* AI Explanation */}
                  {aiExplanation && (
                    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '1.25rem' }}>
                      {aiExplanation.summary && (
                        <div style={{
                          background: '#fff', borderRadius: '8px', padding: '0.85rem 1rem',
                          marginBottom: '1rem', border: '1px solid #d1fae5',
                          fontSize: '0.9rem', color: '#065f46', fontWeight: 500, lineHeight: 1.6,
                        }}>
                          <strong style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#16a34a' }}>
                            📌 Quick Summary
                          </strong>
                          {aiExplanation.summary}
                        </div>
                      )}

                      {aiExplanation.sections && aiExplanation.sections.length > 0 && (
                        <div style={{ marginBottom: '1rem' }}>
                          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.6rem' }}>
                            📖 Breakdown
                          </div>
                          {aiExplanation.sections.map((sec, i) => {
                            const isOpen = expandedSection === i;
                            return (
                              <div key={i} style={{ marginBottom: '0.5rem', border: '1px solid #d1fae5', borderRadius: '8px', overflow: 'hidden', background: '#fff' }}>
                                <button
                                  onClick={() => setExpandedSection(isOpen ? null : i)}
                                  style={{
                                    width: '100%', background: 'none', border: 'none',
                                    padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between',
                                    alignItems: 'center', cursor: 'pointer', textAlign: 'left',
                                  }}
                                >
                                  <span style={{ fontWeight: 700, color: '#111827', fontSize: '0.875rem' }}>
                                    {sec.heading || `Part ${i + 1}`}
                                  </span>
                                  <span style={{ color: '#16a34a', fontWeight: 700, fontSize: '1rem' }}>
                                    {isOpen ? '−' : '+'}
                                  </span>
                                </button>
                                {isOpen && (
                                  <div style={{ padding: '0 1rem 1rem', borderTop: '1px solid #d1fae5' }}>
                                    <p style={{ margin: '0.75rem 0 0', fontSize: '0.875rem', color: '#374151', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                                      {sec.explanation}
                                    </p>
                                    {sec.example && (
                                      <div style={{
                                        marginTop: '0.75rem', background: '#fffbeb',
                                        border: '1px solid #fde68a', borderRadius: '6px',
                                        padding: '0.65rem 0.85rem', fontSize: '0.82rem', color: '#92400e',
                                      }}>
                                        <strong>💡 Example:</strong> {sec.example}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {aiExplanation.revision_questions && aiExplanation.revision_questions.length > 0 && (
                        <div style={{ background: '#fff', border: '1px solid #d1fae5', borderRadius: '8px', padding: '0.85rem 1rem' }}>
                          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.6rem' }}>
                            🧠 Test Yourself
                          </div>
                          <ol style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            {aiExplanation.revision_questions.map((q, i) => (
                              <li key={i} style={{ fontSize: '0.875rem', color: '#065f46', lineHeight: 1.5 }}>{q}</li>
                            ))}
                          </ol>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
