import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { X, Lock, Unlock, ChevronRight, ChevronLeft, Users, AlertTriangle, Mail, Loader2 } from 'lucide-react';
import { useSchool } from '../contexts/SchoolContext';
import { useDialog } from '../contexts/DialogContext';
import './NotYetUnlockedModal.css';

const REASON_LABELS = {
  paid: 'Has not paid fees',
  attendance: 'Was absent today',
  both: 'Absent and has not paid fees',
};

const NotYetUnlockedModal = ({ academicYear, term, assessmentType, onClose, onStudentUnlocked }) => {
  const { buildApiUrl } = useSchool();
  const { showConfirm, showAlert } = useDialog();
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState([]);
  const [totalLocked, setTotalLocked] = useState(0);
  const [strategy, setStrategy] = useState('');
  const [selectedClass, setSelectedClass] = useState(null);
  const [unlockingId, setUnlockingId] = useState(null);
  const [notifyLoading, setNotifyLoading] = useState(false);
  const [capInfo, setCapInfo] = useState(null);
  const [capChecking, setCapChecking] = useState(false);

  const token = localStorage.getItem('accessToken');
  const headers = { Authorization: `Bearer ${token}` };

  const params = {
    academic_year: academicYear,
    term,
    assessment_type: assessmentType,
  };

  useEffect(() => {
    fetchNotUnlocked();
  }, []);

  const fetchNotUnlocked = async () => {
    setLoading(true);
    try {
      const res = await axios.get(buildApiUrl('/academics/admin/assessments/not-unlocked/'), { params, headers });
      setClasses(res.data.classes || []);
      setTotalLocked(res.data.total_locked || 0);
      setStrategy(res.data.strategy || '');
    } catch {
      setClasses([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckCap = async () => {
    setCapChecking(true);
    try {
      const res = await axios.get(buildApiUrl('/academics/admin/assessments/check-email-cap/'), { params, headers });
      setCapInfo(res.data);
    } catch {
      setCapInfo(null);
    } finally {
      setCapChecking(false);
    }
  };

  const handleSendNotifications = async () => {
    if (!capInfo) {
      await handleCheckCap();
      return;
    }

    if (capInfo.would_exceed) {
      const proceed = await showConfirm({
        title: 'Email Cap Warning',
        message: `Sending notifications requires ${capInfo.needed} email(s), but you only have ${capInfo.remaining} remaining today (daily limit: ${capInfo.daily_limit}). Some emails will be skipped. Do you want to send as many as possible?`,
        confirmText: 'Send Anyway',
        cancelText: 'Cancel',
        confirmButtonClass: 'confirm-btn-warning',
      });
      if (!proceed) return;
    } else {
      const proceed = await showConfirm({
        title: 'Send Notifications',
        message: `This will send ${capInfo.needed} email(s) to locked-out students and their parents explaining why they cannot access the ${assessmentType}. Continue?`,
        confirmText: 'Send',
        cancelText: 'Cancel',
      });
      if (!proceed) return;
    }

    setNotifyLoading(true);
    try {
      const res = await axios.post(buildApiUrl('/academics/admin/assessments/notify-locked/'), params, { headers });
      showAlert({ type: 'success', message: `Notifications sent: ${res.data.sent} email(s) delivered${res.data.skipped ? `, ${res.data.skipped} skipped (cap reached)` : ''}.` });
      setCapInfo(null);
    } catch {
      showAlert({ type: 'error', message: 'Failed to send notifications. Please try again.' });
    } finally {
      setNotifyLoading(false);
    }
  };

  const handleManualUnlock = async (student) => {
    setUnlockingId(student.id);
    try {
      await axios.post(
        buildApiUrl('/academics/admin/assessments/unlock-for-selected/'),
        {
          student_ids: [student.id],
          academic_year: academicYear,
          term,
          assessment_type: assessmentType,
        },
        { headers }
      );
      // Remove from local state
      setClasses(prev => prev.map(cls => {
        if (cls.class_session_id !== selectedClass.class_session_id) return cls;
        const updated = cls.students.filter(s => s.id !== student.id);
        return { ...cls, students: updated, locked_count: updated.length };
      }).filter(cls => cls.locked_count > 0));
      setTotalLocked(prev => prev - 1);
      if (onStudentUnlocked) onStudentUnlocked();

      // Update selectedClass students list
      setSelectedClass(prev => {
        const updated = prev.students.filter(s => s.id !== student.id);
        if (updated.length === 0) setSelectedClass(null);
        return { ...prev, students: updated, locked_count: updated.length };
      });
    } catch {
      showAlert({ type: 'error', message: 'Failed to unlock student. Please try again.' });
    } finally {
      setUnlockingId(null);
    }
  };

  return (
    <div className="nul-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="nul-modal">
        <div className="nul-header">
          <div className="nul-header-info">
            <Lock size={18} className="nul-header-icon" />
            <div>
              <h3 className="nul-title">Students Not Yet Unlocked</h3>
              <p className="nul-subtitle">{academicYear} · {term} · {assessmentType === 'exam' ? 'Exam' : 'Test'}</p>
            </div>
          </div>
          <button className="nul-close" onClick={onClose}><X size={18} /></button>
        </div>

        {loading ? (
          <div className="nul-loading"><Loader2 className="spinning" size={24} /><span>Loading...</span></div>
        ) : totalLocked === 0 ? (
          <div className="nul-empty">
            <Unlock size={32} className="nul-empty-icon" />
            <p>All students are unlocked.</p>
          </div>
        ) : (
          <>
            <div className="nul-summary-bar">
              <span className="nul-count-badge"><Lock size={13} />{totalLocked} student{totalLocked !== 1 ? 's' : ''} not unlocked</span>
              {strategy && <span className="nul-strategy-badge">Strategy: {strategy === 'paid' ? 'Paid Fees' : strategy === 'attendance' ? 'Attendance' : 'Paid + Present'}</span>}
            </div>

            {/* Class list or student list */}
            {!selectedClass ? (
              <ul className="nul-class-list">
                {classes.map(cls => (
                  <li key={cls.class_session_id} className="nul-class-item" onClick={() => setSelectedClass(cls)}>
                    <div className="nul-class-info">
                      <Users size={15} />
                      <span className="nul-class-name">{cls.class_name}</span>
                    </div>
                    <div className="nul-class-right">
                      <span className="nul-lock-count"><Lock size={13} />{cls.locked_count}</span>
                      <ChevronRight size={16} className="nul-chevron" />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="nul-students-view">
                <button className="nul-back-btn" onClick={() => setSelectedClass(null)}>
                  <ChevronLeft size={15} /> Back to classes
                </button>
                <p className="nul-students-class-label">{selectedClass.class_name}</p>
                <ul className="nul-student-list">
                  {selectedClass.students.map(student => (
                    <li key={student.id} className="nul-student-item">
                      <div className="nul-student-info">
                        <Lock size={14} className="nul-student-lock" />
                        <div>
                          <span className="nul-student-name">{student.name}</span>
                          <span className="nul-student-username">@{student.username}</span>
                          {strategy && <span className="nul-reason">{REASON_LABELS[strategy] || ''}</span>}
                        </div>
                      </div>
                      <button
                        className="nul-unlock-btn"
                        onClick={() => handleManualUnlock(student)}
                        disabled={unlockingId === student.id}
                      >
                        {unlockingId === student.id
                          ? <Loader2 size={14} className="spinning" />
                          : <><Unlock size={14} />Unlock</>}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Notify section */}
            <div className="nul-notify-section">
              <div className="nul-notify-info">
                <AlertTriangle size={15} className="nul-notify-icon" />
                <span>Notify locked students and their parents by email</span>
              </div>
              {capInfo && (
                <div className={`nul-cap-info ${capInfo.would_exceed ? 'nul-cap-warn' : 'nul-cap-ok'}`}>
                  {capInfo.would_exceed
                    ? <><AlertTriangle size={13} /> Needs {capInfo.needed} emails · only {capInfo.remaining} remaining today</>
                    : <><Mail size={13} /> {capInfo.needed} email(s) will be sent · {capInfo.remaining} remaining</>}
                </div>
              )}
              <div className="nul-notify-actions">
                {!capInfo && (
                  <button className="nul-check-cap-btn" onClick={handleCheckCap} disabled={capChecking}>
                    {capChecking ? <><Loader2 size={14} className="spinning" />Checking...</> : <><Mail size={14} />Check Email Cap</>}
                  </button>
                )}
                <button
                  className="nul-send-btn"
                  onClick={handleSendNotifications}
                  disabled={notifyLoading}
                >
                  {notifyLoading ? <><Loader2 size={14} className="spinning" />Sending...</> : <><Mail size={14} />Send Notifications</>}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default NotYetUnlockedModal;
