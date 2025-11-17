// src/components/IncompleteGradesModal.jsx
import React, { useState, useEffect } from 'react';
import { X, Users, ArrowLeft, Loader, Search, AlertTriangle, BookOpen, Bell, CheckCircle } from 'lucide-react';
import './IncompleteGradesModal.css';

const IncompleteGradesModal = ({ isOpen, onClose }) => {
  const [view, setView] = useState('classes'); // 'classes', 'students', or 'search'
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [expandedStudents, setExpandedStudents] = useState(new Set());
  const [notifyingStudent, setNotifyingStudent] = useState(null);
  const [notifiedStudents, setNotifiedStudents] = useState(new Set());

  useEffect(() => {
    if (isOpen) {
      fetchClasses();
      setView('classes');
      setSelectedClass(null);
      setSearchQuery('');
      setSearchResults([]);
      setExpandedStudents(new Set());
      setNotifiedStudents(new Set());
    }
  }, [isOpen]);

  const fetchClasses = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('accessToken');

      const response = await fetch('http://127.0.0.1:8000/api/schooladmin/analytics/incomplete-grades/classes/', {
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
        `http://127.0.0.1:8000/api/schooladmin/analytics/incomplete-grades/class/${classSessionId}/students/`,
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
        `http://127.0.0.1:8000/api/schooladmin/analytics/incomplete-grades/search/?q=${encodeURIComponent(query)}`,
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

      const response = await fetch('http://127.0.0.1:8000/api/schooladmin/analytics/incomplete-grades/notify/', {
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

  const renderIncompleteSubjects = (incompleteSubjects) => (
    <div className="incomplete-subjects-list">
      {incompleteSubjects.map((subject, index) => (
        <div key={index} className="incomplete-subject-item">
          <div className="subject-name">
            <BookOpen size={14} />
            <span>{subject.name}</span>
          </div>
          <div className="missing-components">
            {subject.missing.map((component, idx) => (
              <span key={idx} className="missing-tag">{component}</span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  if (!isOpen) return null;

  return (
    <div className="incomplete-grades-modal-overlay">
      <div className="incomplete-grades-modal">
        <div className="modal-header">
          {view === 'students' && (
            <button className="back-btn" onClick={handleBack}>
              <ArrowLeft size={20} />
            </button>
          )}
          <h2>
            {view === 'classes' ? 'Classes with Incomplete Grades' : `${selectedClass?.name} - Students with Incomplete Grades`}
          </h2>
          <button className="ig-modal-close" onClick={onClose}>
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
              <p className="no-results">No students found with incomplete grades</p>
            ) : (
              <div className="search-results-list">
                {searchResults.map((student) => (
                  <div key={student.id} className="search-result-item">
                    <div
                      className="search-result-header"
                      onClick={() => toggleStudentExpansion(`search-${student.id}`)}
                    >
                      <div className="student-info">
                        <h5>{student.full_name}</h5>
                        <p>{student.username} | {student.class_name} | {student.department}</p>
                      </div>
                      <div className="search-result-actions">
                        <div className="incomplete-count">
                          <AlertTriangle size={16} />
                          <span>{student.incomplete_subjects.length} subjects</span>
                        </div>
                        <button
                          className={`notify-btn ${notifiedStudents.has(student.id) ? 'notified' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleNotifyStudent(student.id);
                          }}
                          disabled={notifyingStudent === student.id || notifiedStudents.has(student.id)}
                        >
                          {notifiedStudents.has(student.id) ? (
                            <>
                              <CheckCircle size={14} />
                              Sent
                            </>
                          ) : notifyingStudent === student.id ? (
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
                    {expandedStudents.has(`search-${student.id}`) && renderIncompleteSubjects(student.incomplete_subjects)}
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
                  <p>No classes with students having incomplete grades</p>
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
                      <span className="count-badge warning">{cls.affected_count}</span>
                      <span className="count-label">affected</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {!loading && !error && view === 'students' && !searchQuery.trim() && (
            <div className="ig-students-list">
              {students.length === 0 ? (
                <div className="empty-state">
                  <AlertTriangle size={48} />
                  <p>No students with incomplete grades in this class</p>
                </div>
              ) : (
                students.map((student) => (
                  <div key={student.student_session_id} className="ig-student-card">
                    <div
                      className="ig-student-header"
                      onClick={() => toggleStudentExpansion(student.student_session_id)}
                    >
                      <div className="ig-student-info">
                        <div className="ig-student-name">{student.full_name}</div>
                        <div className="ig-student-username">@{student.username}</div>
                      </div>
                      <div className="ig-student-issues">
                        <div className="ig-issue-badge subjects">
                          <BookOpen size={14} />
                          <span>{student.incomplete_subjects.length} subject{student.incomplete_subjects.length !== 1 ? 's' : ''}</span>
                        </div>
                      </div>
                      <div className="ig-student-actions">
                        {notifiedStudents.has(student.id) ? (
                          <span className="ig-notified-badge">
                            <CheckCircle size={16} />
                            Notified
                          </span>
                        ) : (
                          <button
                            className="ig-notify-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleNotifyStudent(student.id);
                            }}
                            disabled={notifyingStudent === student.id}
                          >
                            <Bell size={16} />
                            {notifyingStudent === student.id ? 'Sending...' : 'Notify'}
                          </button>
                        )}
                      </div>
                    </div>
                    {expandedStudents.has(student.student_session_id) && (
                      <div className="ig-student-details">
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

export default IncompleteGradesModal;
