import React, { useState, useEffect } from 'react';
import axios from 'axios';
import API_BASE_URL from '../config';

import './ExamSubjectsModal.css';

const ExamSubjectsModal = ({ classData, onClose, onSubjectClick }) => {
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
          `${API_BASE_URL}/api/schooladmin/analytics/exams/class/${classData.session_id}/subjects/`,
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
    <div className="exam-modal-overlay" onClick={onClose}>
      <div className="exam-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="exam-modal-header">
          <div>
            <h2>{classData?.class_name} - Subjects</h2>
            <p className="exam-modal-subtitle">
              Exam Completion Status
            </p>
          </div>
          <button className="exam-modal-close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="exam-modal-body">
          {loading ? (
            <div className="exam-modal-loading">Loading subjects...</div>
          ) : error ? (
            <div className="exam-modal-error">{error}</div>
          ) : subjects.length === 0 ? (
            <div className="exam-modal-no-data">No subjects found for this class</div>
          ) : (
            <div className="exam-subjects-list">
              {subjects.map((subject) => (
                <div
                  key={subject.subject_id}
                  className={`exam-subject-item ${!subject.has_exams ? 'no-exams' : ''}`}
                  onClick={() => subject.has_exams && onSubjectClick(subject)}
                >
                  <div className="exam-subject-info">
                    <h3 className="exam-subject-name">{subject.subject_name}</h3>
                    <p className="exam-subject-teacher">Teacher: {subject.teacher_name}</p>
                    {subject.has_exams ? (
                      <p className="exam-subject-stats">
                        {subject.students_completed}/{subject.total_students} students completed
                      </p>
                    ) : (
                      <p className="exam-subject-no-exams">No exams available</p>
                    )}
                  </div>

                  {subject.has_exams && (
                    <div className="exam-subject-completion">
                      <div className="exam-subject-progress-bar">
                        <div
                          className="exam-subject-progress-fill"
                          style={{
                            width: `${subject.completion_percentage}%`,
                            backgroundColor: getCompletionColor(subject.completion_percentage)
                          }}
                        />
                      </div>
                      <span className="exam-subject-percentage">
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

export default ExamSubjectsModal;
