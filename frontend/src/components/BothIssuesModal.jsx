// src/components/BothIssuesModal.jsx
import React, { useState, useEffect } from 'react';
import { X, Users, ArrowLeft, Loader, AlertTriangle, BookOpen, Bell, CheckCircle, DollarSign } from 'lucide-react';
import API_BASE_URL from '../config';

import './BothIssuesModal.css';

const BothIssuesModal = ({ isOpen, onClose }) => {
  const [view, setView] = useState('classes');
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedStudents, setExpandedStudents] = useState(new Set());
  const [notifyingStudent, setNotifyingStudent] = useState(null);
  const [notifiedStudents, setNotifiedStudents] = useState(new Set());
  const [sendingBulk, setSendingBulk] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);

  useEffect(() => {
    if (isOpen) {
      fetchClasses();
      setView('classes');
      setSelectedClass(null);
      setExpandedStudents(new Set());
      setNotifiedStudents(new Set());
      setBulkResult(null);
    }
  }, [isOpen]);

  const fetchClasses = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('accessToken');

      const response = await fetch(`${API_BASE_URL}/api/schooladmin/analytics/both-issues/classes/`, {
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
        `${API_BASE_URL}/api/schooladmin/analytics/both-issues/class/${classSessionId}/students/`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setStudents(data.students);
        setSelectedClass({ id: classSessionId, name: className });
        setView('students');
        setExpandedStudents(new Set());
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

  const handleBack = () => {
    setView('classes');
    setSelectedClass(null);
    fetchClasses();
    setExpandedStudents(new Set());
  };

  const toggleStudentExpansion = (studentId) => {
    setExpandedStudents(prev => {
      const newSet = new Set(prev);
      if (newSet.has(studentId)) {
        newSet.delete(studentId);
      } else {
        newSet.add(studentId);
      }
      return newSet;
    });
  };

  const handleNotifyStudent = async (studentId) => {
    try {
      setNotifyingStudent(studentId);
      const token = localStorage.getItem('accessToken');

      const response = await fetch(`${API_BASE_URL}/api/schooladmin/analytics/both-issues/notify/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ student_id: studentId })
      });

      if (response.ok) {
        setNotifiedStudents(prev => new Set([...prev, studentId]));
      } else {
        const errorData = await response.json();
        alert(errorData.detail || 'Error sending notification');
      }
    } catch (err) {
      console.error('Error:', err);
      alert('Failed to send notification');
    } finally {
      setNotifyingStudent(null);
    }
  };

  const handleNotifyAll = async () => {
    try {
      setSendingBulk(true);
      setBulkResult(null);
      const token = localStorage.getItem('accessToken');

      const response = await fetch(`${API_BASE_URL}/api/schooladmin/analytics/both-issues/notify-all/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setBulkResult({
          success: true,
          message: data.message,
          count: data.notifications_sent
        });
      } else {
        const errorData = await response.json();
        setBulkResult({
          success: false,
          message: errorData.detail || 'Error sending notifications'
        });
      }
    } catch (err) {
      console.error('Error:', err);
      setBulkResult({
        success: false,
        message: 'Failed to send notifications'
      });
    } finally {
      setSendingBulk(false);
    }
  };

  const renderIncompleteSubjects = (incompleteSubjects) => (
    <div className="bi-incomplete-subjects-list">
      {incompleteSubjects.map((subject, index) => (
        <div key={index} className="bi-incomplete-subject-item">
          <div className="bi-subject-name">
            <BookOpen size={14} />
            <span>{subject.name}</span>
          </div>
          <div className="bi-missing-components">
            {subject.missing.map((component, idx) => (
              <span key={idx} className="bi-missing-tag">{component}</span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  if (!isOpen) return null;

  return (
    <div className="bi-modal-overlay">
      <div className="bi-modal">
        <div className="bi-modal-header">
          {view === 'students' && (
            <button className="bi-back-btn" onClick={handleBack}>
              <ArrowLeft size={20} />
            </button>
          )}
          <h2>
            {view === 'classes' ? 'Classes with Unpaid Fees & Incomplete Grades' : `${selectedClass?.name} - Students`}
          </h2>
          <button className="bi-modal-close" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        {view === 'classes' && (
          <div className="bi-notify-all-section">
            <button
              className="bi-notify-all-btn"
              onClick={handleNotifyAll}
              disabled={sendingBulk || classes.length === 0}
            >
              <Bell size={18} />
              {sendingBulk ? 'Sending...' : 'Notify All Students'}
            </button>
            {bulkResult && (
              <div className={`bi-bulk-result ${bulkResult.success ? 'success' : 'error'}`}>
                <p>{bulkResult.message}</p>
                <button onClick={() => setBulkResult(null)} className="bi-close-result">×</button>
              </div>
            )}
          </div>
        )}

        <div className="bi-modal-content">
          {loading ? (
            <div className="bi-loading">
              <Loader size={32} className="bi-spinner" />
              <p>Loading...</p>
            </div>
          ) : error ? (
            <div className="bi-error">
              <AlertTriangle size={32} />
              <p>{error}</p>
            </div>
          ) : view === 'classes' ? (
            <div className="bi-classes-list">
              {classes.length === 0 ? (
                <div className="bi-empty">
                  <CheckCircle size={48} color="#10b981" />
                  <p>No students with both unpaid fees and incomplete grades</p>
                </div>
              ) : (
                classes.map(cls => (
                  <div
                    key={cls.class_session_id}
                    className="bi-class-item"
                    onClick={() => fetchStudents(cls.class_session_id, cls.class_name)}
                  >
                    <div className="bi-class-info">
                      <Users size={20} />
                      <span className="bi-class-name">{cls.class_name}</span>
                    </div>
                    <div className="bi-class-count">
                      <span className="bi-count-badge">{cls.students_count}</span>
                      <span className="bi-count-label">student{cls.students_count !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="bi-students-list">
              {students.length === 0 ? (
                <div className="bi-empty">
                  <CheckCircle size={48} color="#10b981" />
                  <p>No students with both issues in this class</p>
                </div>
              ) : (
                students.map(student => (
                  <div key={student.student_id} className="bi-student-card">
                    <div
                      className="bi-student-header"
                      onClick={() => toggleStudentExpansion(student.student_id)}
                    >
                      <div className="bi-student-info">
                        <div className="bi-student-name">{student.student_name}</div>
                        <div className="bi-student-username">@{student.username}</div>
                      </div>
                      <div className="bi-student-issues">
                        <div className="bi-issue-badge balance">
                          <DollarSign size={14} />
                          <span>₦{student.balance.toLocaleString()}</span>
                        </div>
                        <div className="bi-issue-badge subjects">
                          <BookOpen size={14} />
                          <span>{student.incomplete_subjects_count} subject{student.incomplete_subjects_count !== 1 ? 's' : ''}</span>
                        </div>
                      </div>
                      <div className="bi-student-actions">
                        {notifiedStudents.has(student.student_id) ? (
                          <span className="bi-notified-badge">
                            <CheckCircle size={16} />
                            Notified
                          </span>
                        ) : (
                          <button
                            className="bi-notify-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleNotifyStudent(student.student_id);
                            }}
                            disabled={notifyingStudent === student.student_id}
                          >
                            <Bell size={16} />
                            {notifyingStudent === student.student_id ? 'Sending...' : 'Notify'}
                          </button>
                        )}
                      </div>
                    </div>
                    {expandedStudents.has(student.student_id) && (
                      <div className="bi-student-details">
                        <h4>Incomplete Subjects:</h4>
                        {renderIncompleteSubjects(student.incomplete_subjects)}
                      </div>
                    )}
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

export default BothIssuesModal;
