import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './TestStudentScoresModal.css';
import { useDialog } from '../contexts/DialogContext';

const TestStudentScoresModal = ({ subjectData, onClose }) => {
  const { showConfirm, showAlert } = useDialog();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingCell, setEditingCell] = useState(null); // Changed to store {studentId, assessmentId}
  const [editValue, setEditValue] = useState('');
  const [unlocking, setUnlocking] = useState(false);

  const token = localStorage.getItem('accessToken');
  const headers = { Authorization: `Bearer ${token}` };

  const fetchScores = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await axios.get(
        `http://127.0.0.1:8000/api/schooladmin/analytics/tests/subject/${subjectData.subject_id}/scores/`,
        { headers }
      );

      console.log('Fetched scores data:', response.data);

      // Log submission IDs to check for duplicates
      const submissionIds = [];
      const allScores = [];
      response.data.students?.forEach(student => {
        student.test_scores?.forEach(score => {
          allScores.push({
            student: student.student_name,
            assessment: score.title,
            submission_id: score.submission_id,
            score: score.score,
            total_marks: score.total_marks,
            is_submitted: score.is_submitted
          });
          if (score.submission_id) {
            submissionIds.push({
              student: student.student_name,
              assessment: score.title,
              submission_id: score.submission_id
            });
          }
        });
      });
      console.log('All scores:', allScores);
      console.log('Submission IDs with submissions:', submissionIds);

      // Check for duplicate submission IDs
      const submissionIdCounts = {};
      submissionIds.forEach(item => {
        const id = item.submission_id;
        submissionIdCounts[id] = (submissionIdCounts[id] || 0) + 1;
      });

      const duplicates = Object.entries(submissionIdCounts)
        .filter(([id, count]) => count > 1)
        .map(([id, count]) => ({ submission_id: id, count }));

      if (duplicates.length > 0) {
        console.error('⚠️ DUPLICATE SUBMISSION IDs FOUND:', duplicates);
        console.error('This will cause issues! Each submission should have a unique ID.');
      } else {
        console.log('✅ No duplicate submission IDs found');
      }

      setData(response.data);
    } catch (err) {
      console.error('Error fetching test scores:', err);
      setError('Failed to load test scores. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (subjectData?.subject_id) {
      fetchScores();
    }
  }, [subjectData]);

  const handleEditScore = (studentId, assessmentId, submissionId, currentScore, studentName, assessmentTitle) => {
    console.log('Starting edit:', { studentId, assessmentId, submissionId, currentScore, studentName, assessmentTitle });
    setEditingCell({ studentId, assessmentId });
    setEditValue(currentScore.toString());
  };

  const handleSaveScore = async (studentId, assessmentId, submissionId, totalMarks, isManual = false) => {
    try {
      const scoreValue = parseFloat(editValue);

      console.log('Saving score:', { studentId, assessmentId, submissionId, scoreValue, totalMarks, isManual });

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

      // Build request data based on whether this is a manual or online test score
      let requestData;
      if (isManual || !assessmentId) {
        // Manual test score - send student_id, subject_id, and is_manual flag
        requestData = {
          student_id: studentId,
          subject_id: data.subject_id,
          score: scoreValue,
          is_manual: true
        };
      } else if (submissionId) {
        // Online test with existing submission
        requestData = { submission_id: submissionId, score: scoreValue };
      } else {
        // Online test without submission - create new submission
        requestData = { student_id: studentId, assessment_id: assessmentId, score: scoreValue };
      }

      console.log('Request data:', requestData);

      const response = await axios.post(
        'http://127.0.0.1:8000/api/schooladmin/analytics/tests/scores/update/',
        requestData,
        { headers }
      );

      console.log('Update response:', response.data);

      setEditingCell(null);
      setEditValue('');
      fetchScores(); // Reload data
    } catch (err) {
      console.error('Error updating score:', err);
      showAlert({
        type: 'error',
        message: 'Failed to update score. Please try again.'
      });
    }
  };

  const handleCancelEdit = () => {
    setEditingCell(null);
    setEditValue('');
  };

  const handleUnlockScores = async () => {
    const confirmed = await showConfirm({
      title: 'Unlock Test Scores',
      message: 'Are you sure you want to unlock test scores for this subject? Students will be able to see their results.',
      confirmText: 'Unlock',
      cancelText: 'Cancel',
      confirmButtonClass: 'confirm-btn-warning'
    });
    if (!confirmed) return;

    try {
      setUnlocking(true);

      await axios.post(
        'http://127.0.0.1:8000/api/schooladmin/analytics/tests/scores/unlock/',
        {
          subject_id: subjectData.subject_id
        },
        { headers }
      );

      showAlert({
        type: 'success',
        message: 'Test scores unlocked successfully!'
      });
      fetchScores(); // Reload data
    } catch (err) {
      console.error('Error unlocking scores:', err);
      showAlert({
        type: 'error',
        message: 'Failed to unlock test scores. Please try again.'
      });
    } finally {
      setUnlocking(false);
    }
  };

  const allScoresReleased = data?.assessments?.every(a => a.is_released) ?? false;

  return (
    <div className="test-modal-overlay" onClick={onClose}>
      <div className="test-scores-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="test-modal-header">
          <div>
            <h2>{data?.subject_name || 'Test Scores'}</h2>
            <p className="test-modal-subtitle">
              {data?.class_name} • {data?.academic_year} - {data?.term}
            </p>
            {data?.teacher_name && (
              <p className="test-modal-subtitle">Teacher: {data.teacher_name}</p>
            )}
          </div>
          <button className="test-modal-close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        {!allScoresReleased && data && (
          <div className="test-scores-unlock-section">
            <p className="unlock-message">
              Test scores are currently locked. Click the button below to release scores to students.
            </p>
            <button
              className="unlock-btn"
              onClick={handleUnlockScores}
              disabled={unlocking}
            >
              {unlocking ? 'Unlocking...' : 'Unlock Test Scores for This Subject'}
            </button>
          </div>
        )}

        <div className="test-modal-body test-scores-body">
          {loading ? (
            <div className="test-modal-loading">Loading test scores...</div>
          ) : error ? (
            <div className="test-modal-error">{error}</div>
          ) : !data || data.students.length === 0 ? (
            <div className="test-modal-no-data">No students found for this subject</div>
          ) : (
            <div className="test-scores-table-wrapper">
              <table className="test-scores-table">
                <thead>
                  <tr>
                    <th className="sticky-col">Student</th>
                    {data.assessments.map((assessment) => (
                      <th key={assessment.id}>
                        <div className="assessment-header">
                          <span className="assessment-title">{assessment.type_display}</span>
                          <span className="assessment-marks">({assessment.total_marks} marks)</span>
                          <span className={`assessment-status ${assessment.is_released ? 'released' : 'locked'}`}>
                            {assessment.is_released ? '🔓 Unlocked' : '🔒 Locked'}
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
                      {student.test_scores.map((score) => {
                        const isEditing = editingCell?.studentId === student.student_id &&
                                         editingCell?.assessmentId === score.assessment_id;
                        const canEdit = true; // All scores can now be edited (creates submission if needed)

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
                                    score.is_manual
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
                              className={`score-display ${score.is_submitted ? 'submitted' : 'not-submitted'} ${score.is_manual ? 'manual' : ''} editable`}
                              onClick={() => {
                                console.log('Clicked to edit:', {
                                  student: student.student_name,
                                  assessment: score.title,
                                  student_id: student.student_id,
                                  assessment_id: score.assessment_id,
                                  submission_id: score.submission_id,
                                  current_score: score.score,
                                  is_manual: score.is_manual
                                });
                                handleEditScore(
                                  student.student_id,
                                  score.assessment_id,
                                  score.submission_id,
                                  score.score,
                                  student.student_name,
                                  score.title
                                );
                              }}
                            >
                              <span className="score-value">{score.score}</span>
                              <span className="score-total">/{score.total_marks}</span>
                              {score.is_manual && (
                                <span className="manual-badge">Manual</span>
                              )}
                              {!score.is_submitted && !score.is_manual && (
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

export default TestStudentScoresModal;
