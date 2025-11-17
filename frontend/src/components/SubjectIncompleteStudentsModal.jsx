import React, { useState, useEffect } from 'react';
import { X, Search, AlertCircle, User } from 'lucide-react';
import './SubjectIncompleteStudentsModal.css';

const SubjectIncompleteStudentsModal = ({ subject, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (subject) {
      fetchIncompleteStudents();
    }
  }, [subject]);

  const fetchIncompleteStudents = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('accessToken');

      const response = await fetch(
        `http://127.0.0.1:8000/api/schooladmin/analytics/subject-grading/${subject.subject_id}/incomplete/`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (response.ok) {
        const result = await response.json();
        setData(result);
      } else {
        const errorData = await response.json();
        setError(errorData.detail || 'Error fetching incomplete students');
      }
    } catch (err) {
      console.error('Error:', err);
      setError('Failed to load incomplete students');
    } finally {
      setLoading(false);
    }
  };

  const getFilteredStudents = () => {
    if (!data || !data.students) return [];

    if (!searchTerm) return data.students;

    const search = searchTerm.toLowerCase();
    return data.students.filter(s =>
      s.student_name.toLowerCase().includes(search) ||
      s.username.toLowerCase().includes(search)
    );
  };

  const getMissingScoreClass = (score) => {
    return score === 0 ? 'missing' : 'present';
  };

  return (
    <div className="sism-overlay" onClick={onClose}>
      <div className="sism-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sism-header">
          <div className="sism-title">
            <h3>Incomplete Grades</h3>
            <p>{subject.subject_name} - {subject.class_name}</p>
          </div>
          <button className="sism-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {data && (
          <div className="sism-info">
            <div className="sism-info-item">
              <span className="sism-label">Teacher:</span>
              <span className="sism-value">{data.teacher_name}</span>
            </div>
            <div className="sism-info-item">
              <span className="sism-label">Total Incomplete:</span>
              <span className="sism-value sism-incomplete-count">{data.total_incomplete}</span>
            </div>
          </div>
        )}

        <div className="sism-search-container">
          <Search size={16} className="sism-search-icon" />
          <input
            type="text"
            placeholder="Search students..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="sism-search-input"
          />
        </div>

        <div className="sism-content">
          {loading ? (
            <div className="sism-loading">
              <div className="sism-spinner"></div>
              <p>Loading students...</p>
            </div>
          ) : error ? (
            <div className="sism-error">
              <AlertCircle size={32} />
              <p>{error}</p>
            </div>
          ) : getFilteredStudents().length === 0 ? (
            <div className="sism-empty">
              <User size={32} />
              <p>{searchTerm ? 'No students found matching your search' : 'No incomplete students'}</p>
            </div>
          ) : (
            <div className="sism-students-list">
              {getFilteredStudents().map((student) => (
                <div key={student.student_id} className="sism-student-item">
                  <div className="sism-student-info">
                    <div className="sism-student-name">{student.student_name}</div>
                    <div className="sism-student-username">@{student.username}</div>
                  </div>
                  <div className="sism-missing-scores">
                    <div className="sism-missing-label">Missing:</div>
                    <div className="sism-missing-tags">
                      {student.missing_scores.map((score, idx) => (
                        <span key={idx} className="sism-missing-tag">
                          {score}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="sism-current-scores">
                    <div className="sism-score-label">Current Scores:</div>
                    <div className="sism-scores-grid">
                      <div className={`sism-score-item ${getMissingScoreClass(student.current_scores.attendance + student.current_scores.assignment)}`}>
                        <span className="sism-score-type">Att/Assign</span>
                        <span className="sism-score-value">
                          {(student.current_scores.attendance + student.current_scores.assignment).toFixed(1)}
                        </span>
                      </div>
                      <div className={`sism-score-item ${getMissingScoreClass(student.current_scores.test)}`}>
                        <span className="sism-score-type">Test</span>
                        <span className="sism-score-value">{student.current_scores.test.toFixed(1)}</span>
                      </div>
                      <div className={`sism-score-item ${getMissingScoreClass(student.current_scores.exam)}`}>
                        <span className="sism-score-type">Exam</span>
                        <span className="sism-score-value">{student.current_scores.exam.toFixed(1)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SubjectIncompleteStudentsModal;
