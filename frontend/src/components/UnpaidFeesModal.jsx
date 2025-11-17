// src/components/UnpaidFeesModal.jsx
import React, { useState, useEffect } from 'react';
import { X, Users, ArrowLeft, Loader, Search, DollarSign, Bell, CheckCircle } from 'lucide-react';
import './UnpaidFeesModal.css';

const UnpaidFeesModal = ({ isOpen, onClose }) => {
  const [view, setView] = useState('classes'); // 'classes' or 'students'
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [notifyingStudent, setNotifyingStudent] = useState(null);
  const [notifiedStudents, setNotifiedStudents] = useState(new Set());

  useEffect(() => {
    if (isOpen) {
      fetchClasses();
      setView('classes');
      setSelectedClass(null);
      setSearchQuery('');
      setSearchResults([]);
      setNotifiedStudents(new Set());
    }
  }, [isOpen]);

  const fetchClasses = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('accessToken');

      const response = await fetch('http://127.0.0.1:8000/api/schooladmin/analytics/unpaid-fees/classes/', {
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
        `http://127.0.0.1:8000/api/schooladmin/analytics/unpaid-fees/class/${classSessionId}/students/`,
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

  const handleSearch = async (query) => {
    setSearchQuery(query);

    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      setSearchLoading(true);
      const token = localStorage.getItem('accessToken');

      const response = await fetch(
        `http://127.0.0.1:8000/api/schooladmin/analytics/unpaid-fees/search/?q=${encodeURIComponent(query)}`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.students);
      }
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleBack = () => {
    setView('classes');
    setSelectedClass(null);
    fetchClasses();
  };

  const handleNotifyStudent = async (studentId) => {
    try {
      setNotifyingStudent(studentId);
      const token = localStorage.getItem('accessToken');

      const response = await fetch('http://127.0.0.1:8000/api/schooladmin/analytics/unpaid-fees/notify/', {
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

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 2
    }).format(amount);
  };

  if (!isOpen) return null;

  return (
    <div className="unpaid-fees-modal-overlay">
      <div className="unpaid-fees-modal">
        <div className="modal-header">
          {view === 'students' && (
            <button className="back-btn" onClick={handleBack}>
              <ArrowLeft size={20} />
            </button>
          )}
          <h2>
            {view === 'classes' ? 'Classes with Unpaid Fees' : `${selectedClass?.name} - Students with Unpaid Fees`}
          </h2>
          <button className="uf-modal-close" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        {/* Search Bar */}
        <div className="search-section">
          <div className="search-input-wrapper">
            <Search size={18} className="search-icon" />
            <input
              type="text"
              placeholder="Search students by name or username..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="search-input"
            />
            {searchLoading && <Loader size={18} className="spinner search-spinner" />}
          </div>
        </div>

        {/* Search Results */}
        {searchQuery.trim().length >= 2 && (
          <div className="search-results">
            <h4>Search Results ({searchResults.length})</h4>
            {searchResults.length === 0 ? (
              <p className="no-results">No students found with unpaid fees</p>
            ) : (
              <div className="search-results-list">
                {searchResults.map((student) => (
                  <div key={student.student_id} className="search-result-item">
                    <div className="search-result-header">
                      <div className="student-info">
                        <h5>{student.student_name}</h5>
                        <p>{student.username} | {student.class_name}</p>
                      </div>
                      <div className="search-result-actions">
                        <div className="balance-amount">
                          <DollarSign size={16} />
                          <span>{formatCurrency(student.balance)}</span>
                        </div>
                        <button
                          className={`notify-btn ${notifiedStudents.has(student.student_id) ? 'notified' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleNotifyStudent(student.student_id);
                          }}
                          disabled={notifyingStudent === student.student_id || notifiedStudents.has(student.student_id)}
                        >
                          {notifiedStudents.has(student.student_id) ? (
                            <>
                              <CheckCircle size={14} />
                              Sent
                            </>
                          ) : notifyingStudent === student.student_id ? (
                            <>
                              <Loader size={14} className="spinner" />
                              Sending...
                            </>
                          ) : (
                            <>
                              <Bell size={14} />
                              Notify
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

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

          {!loading && !error && view === 'classes' && !searchQuery.trim() && (
            <div className="classes-list">
              {classes.length === 0 ? (
                <div className="empty-state">
                  <Users size={48} />
                  <p>No classes with students having unpaid fees (with complete grades)</p>
                </div>
              ) : (
                classes.map((cls) => (
                  <div
                    key={cls.class_session_id}
                    className="class-item"
                    onClick={() => fetchStudents(cls.class_session_id, cls.class_name)}
                  >
                    <div className="class-info">
                      <h4>{cls.class_name}</h4>
                    </div>
                    <div className="class-count">
                      <span className="count-badge danger">{cls.affected_count}</span>
                      <span className="count-label">affected</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {!loading && !error && view === 'students' && !searchQuery.trim() && (
            <div className="students-list">
              {students.length === 0 ? (
                <div className="empty-state">
                  <DollarSign size={48} />
                  <p>No students with unpaid fees in this class</p>
                </div>
              ) : (
                students.map((student) => (
                  <div key={student.student_id} className="student-item">
                    <div className="student-header">
                      <div className="student-info">
                        <h4>{student.student_name}</h4>
                        <p>{student.username}</p>
                      </div>
                      <div className="student-actions">
                        <div className="balance-badge">
                          <DollarSign size={16} />
                          <span>{formatCurrency(student.balance)}</span>
                        </div>
                        <button
                          className={`notify-btn ${notifiedStudents.has(student.student_id) ? 'notified' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleNotifyStudent(student.student_id);
                          }}
                          disabled={notifyingStudent === student.student_id || notifiedStudents.has(student.student_id)}
                        >
                          {notifiedStudents.has(student.student_id) ? (
                            <>
                              <CheckCircle size={14} />
                              Sent
                            </>
                          ) : notifyingStudent === student.student_id ? (
                            <>
                              <Loader size={14} className="spinner" />
                              Sending...
                            </>
                          ) : (
                            <>
                              <Bell size={14} />
                              Notify
                            </>
                          )}
                        </button>
                      </div>
                    </div>
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

export default UnpaidFeesModal;
