import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './ExamStudentScoresModal.css';
import { useDialog } from '../contexts/DialogContext';

const ExamStudentScoresModal = ({ subjectData, onClose }) => {
  const { showAlert } = useDialog();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState('');

  const token = localStorage.getItem('accessToken');
  const headers = { Authorization: `Bearer ${token}` };

  const fetchScores = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await axios.get(
        `http://127.0.0.1:8000/api/schooladmin/analytics/exams/subject/${subjectData.subject_id}/scores/`,
        { headers }
      );

      console.log('Fetched exam scores data:', response.data);

      setData(response.data);
    } catch (err) {
      console.error('Error fetching exam scores:', err);
      setError('Failed to load exam scores. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (subjectData?.subject_id) {
      fetchScores();
    }
  }, [subjectData]);

  const handleEditScore = (studentId, assessmentId, submissionId, currentScore) => {
    console.log('Starting edit:', { studentId, assessmentId, submissionId, currentScore });
    setEditingCell({ studentId, assessmentId });
    setEditValue(currentScore.toString());
  };

  const handleSaveScore = async (studentId, assessmentId, submissionId, totalMarks, isManual = false) => {
    try {
      const scoreValue = parseFloat(editValue);

      console.log('Saving exam score:', { studentId, assessmentId, submissionId, scoreValue, totalMarks, isManual });

      if (isNaN(scoreValue) || scoreValue < 0) {
        showAlert({
          type: 'error',
          message: 'Please enter a valid score'
        });
        return;
      }

      if (scoreValue > totalMarks) {
        showAlert({
          type: 'error',
          message: `Score cannot exceed ${totalMarks}`
        });
        return;
      }

      // Build request data based on whether this is a manual or online exam score
      let requestData;
      if (isManual || assessmentId === 0) {
        // Manual exam score - send student_id, subject_id, and is_manual flag
        requestData = {
          student_id: studentId,
          subject_id: data.subject_id,
          score: scoreValue,
          is_manual: true
        };
      } else if (submissionId) {
        // Online exam with existing submission
        requestData = { submission_id: submissionId, score: scoreValue };
      } else {
        // Online exam without submission - create new submission
        requestData = { student_id: studentId, assessment_id: assessmentId, score: scoreValue };
      }

      console.log('Request data:', requestData);

      const response = await axios.post(
        'http://127.0.0.1:8000/api/schooladmin/analytics/exams/scores/update/',
        requestData,
        { headers }
      );

      console.log('Update response:', response.data);

      setEditingCell(null);
      setEditValue('');
      fetchScores();
    } catch (err) {
      console.error('Error updating exam score:', err);
      showAlert({
        type: 'error',
        message: 'Failed to update exam score. Please try again.'
      });
    }
  };

  const handleCancelEdit = () => {
    setEditingCell(null);
    setEditValue('');
  };

  const allScoresReleased = data?.assessments?.every(a => a.is_released) ?? false;

  return (
    <div className="exam-modal-overlay" onClick={onClose}>
      <div className="exam-scores-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="exam-modal-header">
          <div>
            <h2>{data?.subject_name || 'Exam Scores'}</h2>
            <p className="exam-modal-subtitle">
              {data?.class_name} • {data?.academic_year} - {data?.term}
            </p>
            {data?.teacher_name && (
              <p className="exam-modal-subtitle">Teacher: {data.teacher_name}</p>
            )}
          </div>
          <button className="exam-modal-close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        {!allScoresReleased && data && (
          <div className="exam-scores-notice-section">
            <p className="notice-message">
              {allScoresReleased
                ? '✅ All exam scores have been released to students'
                : '⚠️ Some exam scores are not yet released. Students cannot view unreleased scores.'}
            </p>
          </div>
        )}

        <div className="exam-modal-body exam-scores-body">
          {loading ? (
            <div className="exam-modal-loading">Loading exam scores...</div>
          ) : error ? (
            <div className="exam-modal-error">{error}</div>
          ) : !data || data.students.length === 0 ? (
            <div className="exam-modal-no-data">No students found for this subject</div>
          ) : (
            <div className="exam-scores-table-wrapper">
              <table className="exam-scores-table">
                <thead>
                  <tr>
                    <th className="sticky-col">Student</th>
                    {data.assessments.map((assessment) => (
                      <th key={assessment.id}>
                        <div className="assessment-header">
                          <span className="assessment-title">{assessment.type_display}</span>
                          <span className="assessment-marks">({assessment.total_marks} marks)</span>
                          <span className={`assessment-status ${assessment.is_released ? 'released' : 'locked'}`}>
                            {assessment.is_released ? '🔓 Released' : '🔒 Not Released'}
                          </span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.students.map((student) => (
                    <tr key={student.student_id}>
                      <td className="sticky-col student-name-cell">
                        <div className="student-name">{student.student_name}</div>
                        <div className="student-username">{student.username}</div>
                      </td>
                      {student.exam_scores.map((score) => {
                        const isEditing = editingCell?.studentId === student.student_id &&
                                         editingCell?.assessmentId === score.assessment_id;
                        const isManual = score.assessment_id === 0 || !score.submission_id;

                        return (
                        <td key={`${student.student_id}-${score.assessment_id}`} className="score-cell">
                          {isEditing ? (
                            <div className="score-edit-container">
                              <input
                                type="number"
                                className="score-input"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                min="0"
                                max={score.total_marks}
                                step="0.5"
                                autoFocus
                              />
                              <div className="score-edit-actions">
                                <button
                                  className="score-save-btn"
                                  onClick={() => handleSaveScore(
                                    student.student_id,
                                    score.assessment_id,
                                    score.submission_id,
                                    score.total_marks,
                                    isManual
                                  )}
                                >
                                  ✓
                                </button>
                                <button
                                  className="score-cancel-btn"
                                  onClick={handleCancelEdit}
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div
                              className={`score-display ${score.is_submitted ? 'submitted' : 'not-submitted'} ${isManual && score.is_submitted ? 'manual' : ''} editable`}
                              onClick={() => {
                                console.log('Clicked to edit exam score:', {
                                  student: student.student_name,
                                  assessment: score.title,
                                  student_id: student.student_id,
                                  assessment_id: score.assessment_id,
                                  submission_id: score.submission_id,
                                  current_score: score.score,
                                  is_manual: isManual
                                });
                                handleEditScore(
                                  student.student_id,
                                  score.assessment_id,
                                  score.submission_id,
                                  score.score
                                );
                              }}
                            >
                              <span className="score-value">{score.score}</span>
                              <span className="score-total">/{score.total_marks}</span>
                              {isManual && score.is_submitted && (
                                <span className="manual-badge">Manual</span>
                              )}
                              {!score.is_submitted && (
                                <span className="not-submitted-badge">Not submitted</span>
                              )}
                            </div>
                          )}
                        </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExamStudentScoresModal;
