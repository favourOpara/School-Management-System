// src/components/ReportAccessModal.jsx
import React, { useState, useEffect } from 'react';
import { X, Users, Send, ArrowLeft, Loader, CheckCircle } from 'lucide-react';
import API_BASE_URL from '../config';

import './ReportAccessModal.css';

const ReportAccessModal = ({ isOpen, onClose, onRefreshStats }) => {
  const [view, setView] = useState('classes'); // 'classes' or 'students'
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sendingStudent, setSendingStudent] = useState(null);
  const [sentStudents, setSentStudents] = useState(new Set());

  useEffect(() => {
    if (isOpen) {
      fetchClasses();
      setView('classes');
      setSelectedClass(null);
      setSentStudents(new Set());
    }
  }, [isOpen]);

  const fetchClasses = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('accessToken');

      const response = await fetch(`${API_BASE_URL}/api/schooladmin/analytics/report-access/classes/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setClasses(data.classes);
      } else {
        const errorData = await response.json();
        setError(errorData.detail || 'Error fetching classes');
      }
    } catch (err) {
      console.error('Error:', err);
      setError('Failed to load classes');
    } finally {
      setLoading(false);
    }
  };

  const fetchStudents = async (classSessionId, className) => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('accessToken');

      const response = await fetch(
        `${API_BASE_URL}/api/schooladmin/analytics/report-access/class/${classSessionId}/students/`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setStudents(data.students);
        setSelectedClass({ id: classSessionId, name: className });
        setView('students');
      } else {
        const errorData = await response.json();
        setError(errorData.detail || 'Error fetching students');
      }
    } catch (err) {
      console.error('Error:', err);
      setError('Failed to load students');
    } finally {
      setLoading(false);
    }
  };

  const handleSendIndividual = async (studentSessionId) => {
    try {
      setSendingStudent(studentSessionId);
      const token = localStorage.getItem('accessToken');

      const response = await fetch(`${API_BASE_URL}/api/schooladmin/analytics/report-access/send-individual/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ student_session_id: studentSessionId })
      });

      if (response.ok) {
        // Mark as sent
        setSentStudents(prev => new Set([...prev, studentSessionId]));
        // Remove from list after animation
        setTimeout(() => {
          setStudents(prev => prev.filter(s => s.student_session_id !== studentSessionId));
          // Refresh main stats
          if (onRefreshStats) onRefreshStats();
        }, 1500);
      } else {
        const errorData = await response.json();
        alert(errorData.detail || 'Error sending report');
      }
    } catch (err) {
      console.error('Error:', err);
      alert('Failed to send report');
    } finally {
      setSendingStudent(null);
    }
  };

  const handleBack = () => {
    setView('classes');
    setSelectedClass(null);
    fetchClasses(); // Refresh classes to update counts
  };

  if (!isOpen) return null;

  return (
    <div className="report-access-modal-overlay">
      <div className="report-access-modal">
        <div className="modal-header">
          {view === 'students' && (
            <button className="back-btn" onClick={handleBack}>
              <ArrowLeft size={20} />
            </button>
          )}
          <h2>
            {view === 'classes' ? 'Classes with Eligible Students' : `${selectedClass?.name} - Eligible Students`}
          </h2>
          <button className="report-modal-close" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <div className="modal-content">
          {loading && (
            <div className="modal-loading">
              <Loader size={32} className="spinner" />
              <p>Loading...</p>
            </div>
          )}

          {error && (
            <div className="modal-error">
              <p>{error}</p>
            </div>
          )}

          {!loading && !error && view === 'classes' && (
            <div className="classes-list">
              {classes.length === 0 ? (
                <div className="empty-state">
                  <Users size={48} />
                  <p>No classes with eligible students</p>
                </div>
              ) : (
                classes.map((cls) => (
                  <div
                    key={cls.id}
                    className="class-item"
                    onClick={() => fetchStudents(cls.id, cls.name)}
                  >
                    <div className="class-info">
                      <h4>{cls.name}</h4>
                      <p>{cls.academic_year} - {cls.term}</p>
                    </div>
                    <div className="class-count">
                      <span className="count-badge">{cls.eligible_count}</span>
                      <span className="count-label">eligible</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {!loading && !error && view === 'students' && (
            <div className="students-list">
              {students.length === 0 ? (
                <div className="empty-state">
                  <CheckCircle size={48} />
                  <p>All students in this class have received their reports</p>
                </div>
              ) : (
                students.map((student) => (
                  <div
                    key={student.student_session_id}
                    className={`student-item ${sentStudents.has(student.student_session_id) ? 'sent' : ''}`}
                  >
                    <div className="student-info">
                      <h4>{student.full_name}</h4>
                      <p>{student.username} | {student.department}</p>
                    </div>
                    <button
                      className={`send-btn ${sentStudents.has(student.student_session_id) ? 'sent' : ''}`}
                      onClick={() => handleSendIndividual(student.student_session_id)}
                      disabled={sendingStudent === student.student_session_id || sentStudents.has(student.student_session_id)}
                    >
                      {sentStudents.has(student.student_session_id) ? (
                        <>
                          <CheckCircle size={16} />
                          Sent
                        </>
                      ) : sendingStudent === student.student_session_id ? (
                        <>
                          <Loader size={16} className="spinner" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Send size={16} />
                          Send Report
                        </>
                      )}
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReportAccessModal;
