import React, { useState, useEffect } from 'react';
import axios from 'axios';
import API_BASE_URL from '../config';

import './TestSubjectsModal.css';

const TestSubjectsModal = ({ classData, onClose, onSubjectClick }) => {
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const token = localStorage.getItem('accessToken');
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        setLoading(true);
        setError('');

        const response = await axios.get(
          `${API_BASE_URL}/api/schooladmin/analytics/tests/class/${classData.session_id}/subjects/`,
          { headers }
        );

        setSubjects(response.data.subjects || []);
      } catch (err) {
        console.error('Error fetching subjects:', err);
        setError('Failed to load subjects. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    if (classData?.session_id) {
      fetchSubjects();
    }
  }, [classData]);

  const getCompletionColor = (percentage) => {
    if (percentage < 40) return '#d32f2f';
    if (percentage < 60) return '#f9a825';
    if (percentage < 80) return '#fbc02d';
    return '#388e3c';
  };

  return (
    <div className="test-modal-overlay" onClick={onClose}>
      <div className="test-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="test-modal-header">
          <div>
            <h2>{classData?.class_name} - Subjects</h2>
            <p className="test-modal-subtitle">
              {classData?.academic_year} - {classData?.term}
            </p>
          </div>
          <button className="test-modal-close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="test-modal-body">
          {loading ? (
            <div className="test-modal-loading">Loading subjects...</div>
          ) : error ? (
            <div className="test-modal-error">{error}</div>
          ) : subjects.length === 0 ? (
            <div className="test-modal-no-data">No subjects found for this class</div>
          ) : (
            <div className="test-subjects-list">
              {subjects.map((subject) => (
                <div
                  key={subject.subject_id}
                  className={`test-subject-item ${!subject.has_tests ? 'no-tests' : ''}`}
                  onClick={() => subject.has_tests && onSubjectClick(subject)}
                >
                  <div className="test-subject-info">
                    <h3 className="test-subject-name">{subject.subject_name}</h3>
                    <p className="test-subject-teacher">Teacher: {subject.teacher_name}</p>
                    {subject.has_tests ? (
                      <p className="test-subject-stats">
                        {subject.test_count} test{subject.test_count !== 1 ? 's' : ''} •
                        {' '}{subject.students_completed}/{subject.total_students} students completed
                      </p>
                    ) : (
                      <p className="test-subject-no-tests">No tests available</p>
                    )}
                  </div>

                  {subject.has_tests && (
                    <div className="test-subject-completion">
                      <div className="test-subject-progress-bar">
                        <div
                          className="test-subject-progress-fill"
                          style={{
                            width: `${subject.completion_percentage}%`,
                            backgroundColor: getCompletionColor(subject.completion_percentage)
                          }}
                        />
                      </div>
                      <span className="test-subject-percentage">
                        {subject.completion_percentage}%
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TestSubjectsModal;
