import React, { useState, useEffect } from 'react';
import { X, FileText, Download, Calendar, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import API_BASE_URL from '../config';

import './StudentSubmissionsModal.css';

const StudentSubmissionsModal = ({ student, onClose }) => {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [grading, setGrading] = useState(false);
  
  // Grading form state
  const [score, setScore] = useState('');
  const [feedback, setFeedback] = useState('');
  const [releaseGrade, setReleaseGrade] = useState(false);

  useEffect(() => {
    fetchSubmissions();
  }, [student.id]);

  const fetchSubmissions = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken');
      
      const response = await fetch(
        `${API_BASE_URL}/api/academics/student/${student.id}/submissions/`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch submissions');
      }

      const data = await response.json();
      setSubmissions(data.submissions);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGradeSubmission = async (submissionId) => {
    if (!score) {
      alert('Please enter a score');
      return;
    }

    try {
      setGrading(true);
      const token = localStorage.getItem('accessToken');
      
      const response = await fetch(
        `${API_BASE_URL}/api/academics/submission/${submissionId}/grade/`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            score: parseFloat(score),
            feedback,
            grade_released: releaseGrade
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to grade submission');
      }

      alert('Submission graded successfully!');
      fetchSubmissions();
      setSelectedSubmission(null);
      setScore('');
      setFeedback('');
      setReleaseGrade(false);
    } catch (err) {
      alert(err.message);
    } finally {
      setGrading(false);
    }
  };

  const openGradingForm = (submission) => {
    setSelectedSubmission(submission);
    setScore(submission.score || '');
    setFeedback(submission.feedback || '');
    setReleaseGrade(submission.grade_released || false);
  };

  const getStatusIcon = (status, isLate) => {
    if (status === 'graded') {
      return <CheckCircle size={20} className="status-icon graded" />;
    } else if (isLate) {
      return <AlertCircle size={20} className="status-icon late" />;
    } else {
      return <Clock size={20} className="status-icon pending" />;
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="modal-overlay">
        <div className="submissions-modal">
          <div className="modal-loading">Loading submissions...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="submissions-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>{student.full_name}'s Submissions</h2>
            <p className="student-username">@{student.username}</p>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        {error && (
          <div className="error-message">
            <AlertCircle size={20} />
            {error}
          </div>
        )}

        {selectedSubmission ? (
          // Grading Form
          <div className="grading-form">
            <button 
              className="back-btn"
              onClick={() => setSelectedSubmission(null)}
            >
              ← Back to Submissions
            </button>

            <div className="grading-details">
              <h3>{selectedSubmission.assignment.title}</h3>
              <p className="subject-info">
                {selectedSubmission.subject.name} - {selectedSubmission.subject.class}
              </p>

              <div className="submission-info">
                <div className="info-row">
                  <span className="label">Submitted:</span>
                  <span>{formatDate(selectedSubmission.submitted_at)}</span>
                </div>
                {selectedSubmission.is_late && (
                  <div className="info-row late-badge">
                    <AlertCircle size={16} />
                    <span>Submitted Late</span>
                  </div>
                )}
                <div className="info-row">
                  <span className="label">Max Score:</span>
                  <span>{selectedSubmission.assignment.max_score}</span>
                </div>
              </div>

              {selectedSubmission.submission_text && (
                <div className="submission-text-section">
                  <h4>Submission Text:</h4>
                  <p className="submission-text">{selectedSubmission.submission_text}</p>
                </div>
              )}

              {selectedSubmission.files.length > 0 && (
                <div className="files-section">
                  <h4>Attached Files:</h4>
                  <div className="files-list">
                    {selectedSubmission.files.map(file => (
                      <div key={file.id} className="file-item">
                        <FileText size={20} />
                        <div className="file-info">
                          <span className="file-name">{file.original_name}</span>
                          <span className="file-size">{file.file_size}</span>
                        </div>
                        <a 
                          href={`${API_BASE_URL}${file.file_url}`}
                          download={file.original_name}
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="download-btn"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Download size={18} />
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grading-inputs">
                <div className="form-group">
                  <label>Score *</label>
                  <input
                    type="number"
                    min="0"
                    max={selectedSubmission.assignment.max_score}
                    step="0.5"
                    value={score}
                    onChange={(e) => setScore(e.target.value)}
                    placeholder={`Max: ${selectedSubmission.assignment.max_score}`}
                  />
                </div>

                <div className="form-group">
                  <label>Feedback</label>
                  <textarea
                    rows="4"
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    placeholder="Provide feedback to the student..."
                  />
                </div>

                <div className="form-group checkbox">
                  <label>
                    <input
                      type="checkbox"
                      checked={releaseGrade}
                      onChange={(e) => setReleaseGrade(e.target.checked)}
                    />
                    Release grade to student immediately
                  </label>
                </div>

                <div className="grading-actions">
                  <button
                    className="cancel-btn"
                    onClick={() => setSelectedSubmission(null)}
                  >
                    Cancel
                  </button>
                  <button
                    className="submit-btn"
                    onClick={() => handleGradeSubmission(selectedSubmission.id)}
                    disabled={grading || !score}
                  >
                    {grading ? 'Grading...' : 'Submit Grade'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          // Submissions List
          <div className="submissions-list">
            {submissions.length === 0 ? (
              <div className="no-submissions">
                <FileText size={48} />
                <p>No submissions yet</p>
              </div>
            ) : (
              <div className="submissions-grid">
                {submissions.map(submission => (
                  <div key={submission.id} className="submission-card">
                    <div className="submission-header">
                      <div className="submission-title">
                        <h4>{submission.assignment.title}</h4>
                        <p className="subject-name">{submission.subject.name}</p>
                      </div>
                      {getStatusIcon(submission.status, submission.is_late)}
                    </div>

                    <div className="submission-details">
                      <div className="detail-row">
                        <Calendar size={16} />
                        <span>Submitted: {formatDate(submission.submitted_at)}</span>
                      </div>
                      {submission.is_late && (
                        <div className="detail-row late">
                          <AlertCircle size={16} />
                          <span>Late Submission</span>
                        </div>
                      )}
                      <div className="detail-row">
                        <FileText size={16} />
                        <span>{submission.files.length} file(s) attached</span>
                      </div>
                    </div>

                    {submission.status === 'graded' && (
                      <div className="grade-display">
                        <span className="score">
                          Score: {submission.score}/{submission.assignment.max_score}
                        </span>
                        {submission.grade_released && (
                          <span className="released-badge">Released</span>
                        )}
                      </div>
                    )}

                    <button
                      className="grade-btn"
                      onClick={() => openGradingForm(submission)}
                    >
                      {submission.status === 'graded' ? 'View/Edit Grade' : 'Grade Submission'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentSubmissionsModal;