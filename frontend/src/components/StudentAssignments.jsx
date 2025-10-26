import React, { useState, useEffect } from 'react';
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

  const token = localStorage.getItem('accessToken');

  useEffect(() => {
    fetchAssignments();
  }, [filter]);

  const fetchAssignments = async () => {
    try {
      setLoading(true);
      const url = filter === 'all' 
        ? 'http://127.0.0.1:8000/api/academics/student/assignments/'
        : `http://127.0.0.1:8000/api/academics/student/assignments/?status=${filter}`;
      
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
    const maxFileSize = 5 * 1024 * 1024; // 5MB in bytes

    const validFiles = files.filter(file => {
      // Check file type
      if (!allowedTypes.includes(file.type)) {
        showMessage(`File ${file.name} has invalid type`, 'error');
        return false;
      }
      
      // Check file size (5MB limit)
      if (file.size > maxFileSize) {
        const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
        showMessage(`File ${file.name} is too large (${fileSizeMB}MB). Maximum size is 5MB.`, 'error');
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
    const maxFileSize = 5 * 1024 * 1024; // 5MB
    for (const file of submissionFiles) {
      if (file.size > maxFileSize) {
        const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
        showMessage(`File "${file.name}" is too large (${fileSizeMB}MB). Maximum size is 5MB per file.`, 'error');
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

      const response = await fetch('http://127.0.0.1:8000/api/academics/student/assignments/submit/', {
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
        `http://127.0.0.1:8000/api/academics/student/assignments/${assignmentId}/`,
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
      setSelectedAssignment(data);
    } catch (err) {
      showMessage(err.message, 'error');
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
            <div key={assignment.id} className="assignment-card">
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
                    📚 {assignment.classroom_name}
                  </span>
                  <span className="meta-item">
                    👨‍🏫 {assignment.teacher_name}
                  </span>
                </div>
              </div>

              <div className="assignment-body">
                <p className="assignment-description">{assignment.description}</p>

                <div className="assignment-details">
                  <div className="detail-item">
                    <Calendar size={16} />
                    <span>Due: {formatDate(assignment.due_date)}</span>
                  </div>
                  {assignment.max_score && (
                    <div className="detail-item">
                      <FileText size={16} />
                      <span>Max Score: {assignment.max_score} points</span>
                    </div>
                  )}
                  {assignment.files_count > 0 && (
                    <div className="detail-item">
                      <Download size={16} />
                      <span>{assignment.files_count} attachment(s)</span>
                    </div>
                  )}
                </div>

                {/* SHOW TEACHER'S ASSIGNMENT FILES WITH DOWNLOAD LINKS */}
                {assignment.files && assignment.files.length > 0 && (
                  <div className="assignment-files">
                    <h4>📎 Assignment Files:</h4>
                    <div className="file-list">
                      {assignment.files.map((file, index) => (
                        <a 
                          key={index}
                          href={file.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="file-download-link"
                          download
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

                {assignment.my_submission && (
                  <div className="submission-info">
                    <p className="submitted-label">
                      <CheckCircle size={16} />
                      Submitted on {formatDate(assignment.my_submission.submitted_at)}
                      {assignment.my_submission.is_late && ' (Late)'}
                    </p>
                    <p className="submission-count-info">
                      Submission {assignment.my_submission.submission_count}/2
                      {assignment.my_submission.submission_count >= 2 && ' - Max submissions reached'}
                    </p>
                    {assignment.my_submission.can_view_grade && (
                      <div className="grade-display">
                        <strong>Grade: </strong>
                        {assignment.my_submission.score}/{assignment.max_score}
                      </div>
                    )}
                  </div>
                )}
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
                    Submit Assignment
                  </button>
                ) : assignment.my_submission.can_resubmit ? (
                  <button
                    onClick={() => openSubmissionModal(assignment)}
                    className="update-btn"
                  >
                    <Upload size={16} />
                    Update Submission ({assignment.my_submission.submission_count}/2)
                  </button>
                ) : (
                  <button
                    className="update-btn"
                    disabled
                    title="Maximum submissions reached"
                  >
                    <Upload size={16} />
                    Max Submissions Reached
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
                    <small className="file-size-limit">Maximum file size: 5MB per file</small>
                  </label>
                </div>

                {submissionFiles.length > 0 && (
                  <div className="selected-files">
                    <h4>Selected Files ({submissionFiles.length})</h4>
                    {submissionFiles.map((file, index) => {
                      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
                      const isTooLarge = file.size > 5 * 1024 * 1024;
                      
                      return (
                        <div key={index} className={`file-item ${isTooLarge ? 'file-too-large' : ''}`}>
                          <div className="file-info">
                            <FileText size={16} />
                            <span>{file.name}</span>
                            <small className={isTooLarge ? 'size-warning' : ''}>
                              ({formatFileSize(file.size)})
                              {isTooLarge && ' - Exceeds 5MB limit!'}
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
    </div>
  );
};

export default StudentAssignments;