import React, { useState, useEffect } from 'react';
import API_BASE_URL from '../config';

import { 
  FileText, Calendar, Clock, CheckCircle, AlertCircle, 
  Upload, X, Eye, Download, Trash2 
} from 'lucide-react';
import './StudentAssignments.css';

const StudentAssignments = () => {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all'); // all, pending, submitted, overdue
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [showSubmissionModal, setShowSubmissionModal] = useState(false);
  const [submissionFiles, setSubmissionFiles] = useState([]);
  const [submissionText, setSubmissionText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [detailsAssignment, setDetailsAssignment] = useState(null);

  const token = localStorage.getItem('accessToken');

  useEffect(() => {
    fetchAssignments();
  }, [filter]);

  const fetchAssignments = async () => {
    try {
      setLoading(true);
      const url = filter === 'all' 
        ? `${API_BASE_URL}/api/academics/student/assignments/`
        : `${API_BASE_URL}/api/academics/student/assignments/?status=${filter}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch assignments');
      }

      const data = await response.json();
      setAssignments(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (text, type) => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: '' }), 5000);
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/png',
      'image/jpeg',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/zip',
      'text/csv',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    const maxFileSize = 100 * 1024; // 100KB in bytes

    const validFiles = files.filter(file => {
      // Check file type
      if (!allowedTypes.includes(file.type)) {
        showMessage(`File ${file.name} has invalid type`, 'error');
        return false;
      }

      // Check file size (100KB limit)
      if (file.size > maxFileSize) {
        const fileSizeKB = (file.size / 1024).toFixed(2);
        showMessage(`File ${file.name} is too large (${fileSizeKB}KB). Maximum size is 100KB.`, 'error');
        return false;
      }
      
      return true;
    });

    setSubmissionFiles(prev => [...prev, ...validFiles]);
  };

  const removeFile = (index) => {
    setSubmissionFiles(prev => prev.filter((_, i) => i !== index));
  };

  const openSubmissionModal = (assignment) => {
    setSelectedAssignment(assignment);
    setShowSubmissionModal(true);
    
    // If there's an existing submission, load its data
    if (assignment.my_submission) {
      setSubmissionText(assignment.my_submission.submission_text || '');
    }
  };

  const closeSubmissionModal = () => {
    setShowSubmissionModal(false);
    setSelectedAssignment(null);
    setSubmissionFiles([]);
    setSubmissionText('');
  };

  const handleSubmitAssignment = async () => {
    if (submissionFiles.length === 0 && !submissionText.trim()) {
      showMessage('Please add files or text for your submission', 'error');
      return;
    }

    // Validate file sizes before submission
    const maxFileSize = 100 * 1024; // 100KB
    for (const file of submissionFiles) {
      if (file.size > maxFileSize) {
        const fileSizeKB = (file.size / 1024).toFixed(2);
        showMessage(`File "${file.name}" is too large (${fileSizeKB}KB). Maximum size is 100KB per file.`, 'error');
        return;
      }
    }

    try {
      setSubmitting(true);
      const formData = new FormData();
      
      formData.append('assignment_id', selectedAssignment.id);
      formData.append('submission_text', submissionText);
      
      submissionFiles.forEach(file => {
        formData.append('files', file);
      });

      const response = await fetch(`${API_BASE_URL}/api/academics/student/assignments/submit/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to submit assignment');
      }

      const data = await response.json();
      showMessage(data.message, 'success');
      closeSubmissionModal();
      fetchAssignments();
    } catch (err) {
      showMessage(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const viewSubmissionDetails = async (assignmentId) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/academics/student/assignments/${assignmentId}/`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch assignment details');
      }

      const data = await response.json();
      setDetailsAssignment(data);
      setShowDetailsModal(true);
    } catch (err) {
      showMessage(err.message, 'error');
    }
  };

  const closeDetailsModal = () => {
    setShowDetailsModal(false);
    setDetailsAssignment(null);
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

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusBadge = (assignment) => {
    if (assignment.my_submission) {
      const submission = assignment.my_submission;
      if (submission.can_view_grade) {
        return <span className="status-badge graded">Graded: {submission.score}/{assignment.max_score}</span>;
      }
      if (submission.status === 'graded') {
        return <span className="status-badge graded-pending">Graded (Pending Release)</span>;
      }
      if (submission.is_late) {
        return <span className="status-badge late">Submitted Late</span>;
      }
      return <span className="status-badge submitted">Submitted</span>;
    }
    
    if (assignment.is_overdue) {
      return <span className="status-badge overdue">Overdue</span>;
    }
    
    return <span className="status-badge pending">Pending</span>;
  };

  const filteredAssignments = assignments;

  if (loading) {
    return (
      <div className="assignments-container">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading assignments...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="assignments-container">
        <div className="error-state">
          <AlertCircle size={48} />
          <h3>Error</h3>
          <p>{error}</p>
          <button onClick={fetchAssignments} className="retry-btn">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="assignments-container">
      {/* Header */}
      <div className="assignments-header">
        <div>
          <h1>📝 My Assignments</h1>
          <p>View and submit your assignments</p>
        </div>
      </div>

      {/* Message */}
      {message.text && (
        <div className={`message ${message.type}`}>
          {message.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle size={20} />}
          {message.text}
        </div>
      )}

      {/* Filter Tabs */}
      <div className="filter-tabs">
        <button
          className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All Assignments
        </button>
        <button
          className={`filter-tab ${filter === 'pending' ? 'active' : ''}`}
          onClick={() => setFilter('pending')}
        >
          Pending
        </button>
        <button
          className={`filter-tab ${filter === 'submitted' ? 'active' : ''}`}
          onClick={() => setFilter('submitted')}
        >
          Submitted
        </button>
        <button
          className={`filter-tab ${filter === 'overdue' ? 'active' : ''}`}
          onClick={() => setFilter('overdue')}
        >
          Overdue
        </button>
      </div>

      {/* Assignments List */}
      <div className="assignments-list">
        {filteredAssignments.length === 0 ? (
          <div className="empty-state">
            <FileText size={64} />
            <h3>No assignments found</h3>
            <p>
              {filter === 'pending' 
                ? 'You have no pending assignments' 
                : filter === 'submitted'
                ? 'You haven\'t submitted any assignments yet'
                : filter === 'overdue'
                ? 'You have no overdue assignments'
                : 'No assignments available'}
            </p>
          </div>
        ) : (
          filteredAssignments.map((assignment) => (
            <div key={assignment.id} className="assignment-card compact">
              <div className="assignment-header">
                <div className="assignment-title-section">
                  <h3>{assignment.title}</h3>
                  {getStatusBadge(assignment)}
                </div>
                <div className="assignment-meta">
                  <span className="meta-item">
                    <FileText size={16} />
                    {assignment.subject_name}
                  </span>
                  <span className="meta-item">
                    <Calendar size={16} />
                    Due: {formatDate(assignment.due_date)}
                  </span>
                </div>
              </div>

              <div className="assignment-actions">
                <button
                  onClick={() => viewSubmissionDetails(assignment.id)}
                  className="view-btn"
                >
                  <Eye size={16} />
                  View Details
                </button>
                {!assignment.my_submission ? (
                  <button
                    onClick={() => openSubmissionModal(assignment)}
                    className="submit-btn"
                    disabled={assignment.is_overdue}
                  >
                    <Upload size={16} />
                    Submit
                  </button>
                ) : assignment.my_submission.can_resubmit ? (
                  <button
                    onClick={() => openSubmissionModal(assignment)}
                    className="update-btn"
                  >
                    <Upload size={16} />
                    Update ({assignment.my_submission.submission_count}/2)
                  </button>
                ) : (
                  <button
                    className="update-btn"
                    disabled
                    title="Maximum submissions reached"
                  >
                    Max Reached
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Submission Modal */}
      {showSubmissionModal && selectedAssignment && (
        <div className="modal-overlay" onClick={closeSubmissionModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Submit Assignment</h2>
              <button onClick={closeSubmissionModal} className="close-btn">
                <X size={24} />
              </button>
            </div>

            <div className="modal-body">
              <div className="assignment-info-box">
                <h3>{selectedAssignment.title}</h3>
                <p>{selectedAssignment.description}</p>
                <div className="info-row">
                  <span>Due: {formatDate(selectedAssignment.due_date)}</span>
                  {selectedAssignment.max_score && (
                    <span>Max Score: {selectedAssignment.max_score} points</span>
                  )}
                </div>
              </div>

              <div className="form-group">
                <label>Submission Text (Optional)</label>
                <textarea
                  value={submissionText}
                  onChange={(e) => setSubmissionText(e.target.value)}
                  placeholder="Add any notes or comments about your submission..."
                  rows="4"
                />
              </div>

              <div className="form-group">
                <label>Upload Files *</label>
                <div className="file-upload-area">
                  <input
                    type="file"
                    id="file-input"
                    multiple
                    accept=".pdf,.docx,.png,.jpeg,.jpg,.ppt,.pptx,.zip,.csv,.xlsx"
                    onChange={handleFileSelect}
                    style={{ display: 'none' }}
                  />
                  <label htmlFor="file-input" className="file-upload-label">
                    <Upload size={24} />
                    <span>Click to upload files</span>
                    <small>Supported: PDF, DOCX, PNG, JPEG, PPT, ZIP, CSV, XLSX</small>
                    <small className="file-size-limit">Maximum file size: 100KB per file</small>
                  </label>
                </div>

                {submissionFiles.length > 0 && (
                  <div className="selected-files">
                    <h4>Selected Files ({submissionFiles.length})</h4>
                    {submissionFiles.map((file, index) => {
                      const fileSizeKB = (file.size / 1024).toFixed(2);
                      const isTooLarge = file.size > 100 * 1024;
                      
                      return (
                        <div key={index} className={`file-item ${isTooLarge ? 'file-too-large' : ''}`}>
                          <div className="file-info">
                            <FileText size={16} />
                            <span>{file.name}</span>
                            <small className={isTooLarge ? 'size-warning' : ''}>
                              ({formatFileSize(file.size)})
                              {isTooLarge && ' - Exceeds 100KB limit!'}
                            </small>
                          </div>
                          <button
                            onClick={() => removeFile(index)}
                            className="remove-file-btn"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button
                onClick={closeSubmissionModal}
                className="cancel-btn"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitAssignment}
                className="submit-modal-btn"
                disabled={submitting}
              >
                {submitting ? 'Submitting...' : 'Submit Assignment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {showDetailsModal && detailsAssignment && (
        <div className="modal-overlay" onClick={closeDetailsModal}>
          <div className="modal-content details-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Assignment Details</h2>
              <button onClick={closeDetailsModal} className="close-btn">
                <X size={24} />
              </button>
            </div>

            <div className="modal-body">
              <div className="details-section">
                <h3>{detailsAssignment.title}</h3>
                {getStatusBadge(detailsAssignment)}
              </div>

              <div className="details-meta">
                <div className="meta-row">
                  <span><FileText size={16} /> Subject:</span>
                  <strong>{detailsAssignment.subject_name}</strong>
                </div>
                <div className="meta-row">
                  <span>📚 Class:</span>
                  <strong>{detailsAssignment.classroom_name}</strong>
                </div>
                <div className="meta-row">
                  <span>👨‍🏫 Teacher:</span>
                  <strong>{detailsAssignment.teacher_name}</strong>
                </div>
                <div className="meta-row">
                  <span><Calendar size={16} /> Due Date:</span>
                  <strong>{formatDate(detailsAssignment.due_date)}</strong>
                </div>
                {detailsAssignment.max_score && (
                  <div className="meta-row">
                    <span>Max Score:</span>
                    <strong>{detailsAssignment.max_score} points</strong>
                  </div>
                )}
              </div>

              <div className="details-description">
                <h4>Description</h4>
                <p>{detailsAssignment.description}</p>
              </div>

              {detailsAssignment.files && detailsAssignment.files.length > 0 && (
                <div className="details-files">
                  <h4>📎 Assignment Files</h4>
                  <div className="file-list">
                    {detailsAssignment.files.map((file, index) => (
                      <a
                        key={index}
                        href={file.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="file-download-link"
                      >
                        <FileText size={16} />
                        <span>{file.original_name}</span>
                        <small>({file.formatted_file_size})</small>
                        <Download size={14} className="download-icon" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {detailsAssignment.my_submission && (
                <div className="details-submission">
                  <h4>Your Submission</h4>
                  <div className="submission-details">
                    <p>
                      <CheckCircle size={16} />
                      Submitted on {formatDate(detailsAssignment.my_submission.submitted_at)}
                      {detailsAssignment.my_submission.is_late && ' (Late)'}
                    </p>
                    <p>
                      Submission Count: {detailsAssignment.my_submission.submission_count}/2
                    </p>
                    {detailsAssignment.my_submission.can_view_grade && (
                      <div className="grade-display">
                        <strong>Grade: </strong>
                        {detailsAssignment.my_submission.score}/{detailsAssignment.max_score}
                      </div>
                    )}
                    {detailsAssignment.my_submission.feedback && (
                      <div className="feedback-section">
                        <strong>Teacher Feedback:</strong>
                        <p>{detailsAssignment.my_submission.feedback}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button onClick={closeDetailsModal} className="cancel-btn">
                Close
              </button>
              {!detailsAssignment.my_submission ? (
                <button
                  onClick={() => {
                    closeDetailsModal();
                    openSubmissionModal(detailsAssignment);
                  }}
                  className="submit-modal-btn"
                  disabled={detailsAssignment.is_overdue}
                >
                  <Upload size={16} />
                  Submit Assignment
                </button>
              ) : detailsAssignment.my_submission.can_resubmit && (
                <button
                  onClick={() => {
                    closeDetailsModal();
                    openSubmissionModal(detailsAssignment);
                  }}
                  className="submit-modal-btn"
                >
                  <Upload size={16} />
                  Update Submission
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentAssignments;