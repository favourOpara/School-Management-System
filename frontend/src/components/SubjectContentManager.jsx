// src/components/SubjectContentManager.jsx
import React, { useState, useEffect } from 'react';
import API_BASE_URL from '../config';

import './SubjectContentManager.css';

const SubjectContentManager = ({ subjectId, subjectInfo, onBack }) => {
  const [activeTab, setActiveTab] = useState('view');
  const [contentData, setContentData] = useState({
    assignments: [],
    notes: [],
    announcements: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);
  
  // Form states
  const [formData, setFormData] = useState({
    content_type: 'assignment',
    title: '',
    description: '',
    files: [],
    due_date: '',
    max_score: ''
  });
  const [previewFiles, setPreviewFiles] = useState([]);
  const [showPreview, setShowPreview] = useState(false);
  const [previewContent, setPreviewContent] = useState(null);
  const [editingContent, setEditingContent] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);

  useEffect(() => {
    fetchSubjectContent();
  }, [subjectId]);

  const fetchSubjectContent = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${API_BASE_URL}/api/academics/teacher/subjects/${subjectId}/content/`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setContentData(data.content_by_type || {
        assignments: [],
        notes: [],
        announcements: []
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, files } = e.target;
    if (type === 'file') {
      const fileArray = Array.from(files);
      setFormData(prev => ({
        ...prev,
        files: fileArray
      }));
      setPreviewFiles(fileArray);
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const removeFile = (indexToRemove) => {
    const updatedFiles = formData.files.filter((_, index) => index !== indexToRemove);
    setFormData(prev => ({
      ...prev,
      files: updatedFiles
    }));
    setPreviewFiles(updatedFiles);
    
    const fileInput = document.querySelector('input[type="file"]');
    if (fileInput && updatedFiles.length === 0) {
      fileInput.value = '';
    }
  };

  const previewFile = (file) => {
    const fileType = file.type;
    
    if (fileType.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviewContent({
          type: 'image',
          url: e.target.result,
          name: file.name
        });
        setShowPreview(true);
      };
      reader.readAsDataURL(file);
    } else if (fileType === 'application/pdf') {
      const fileUrl = URL.createObjectURL(file);
      setPreviewContent({
        type: 'pdf',
        url: fileUrl,
        name: file.name
      });
      setShowPreview(true);
    } else if (fileType.startsWith('text/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviewContent({
          type: 'text',
          content: e.target.result,
          name: file.name
        });
        setShowPreview(true);
      };
      reader.readAsText(file);
    } else {
      setPreviewContent({
        type: 'other',
        name: file.name,
        size: file.size,
        lastModified: new Date(file.lastModified).toLocaleDateString()
      });
      setShowPreview(true);
    }
  };

  const closePreview = () => {
    setShowPreview(false);
    if (previewContent && previewContent.url && previewContent.type === 'pdf') {
      URL.revokeObjectURL(previewContent.url);
    }
    setPreviewContent(null);
  };

  const handleEditContent = (content) => {
    setEditingContent(content);
    setFormData({
      content_type: content.content_type,
      title: content.title,
      description: content.description,
      files: [],
      due_date: content.due_date ? content.due_date.slice(0, 16) : '',
      max_score: content.max_score || ''
    });
    setPreviewFiles([]);
    setActiveTab('create');
  };

  const handleDeleteContent = async (contentId) => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${API_BASE_URL}/api/academics/teacher/content/${contentId}/`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      await fetchSubjectContent();
      setShowDeleteConfirm(null);
    } catch (err) {
      setError(`Failed to delete content: ${err.message}`);
      setShowDeleteConfirm(null);
    }
  };

  const cancelEdit = () => {
    setEditingContent(null);
    setFormData({
      content_type: 'assignment',
      title: '',
      description: '',
      files: [],
      due_date: '',
      max_score: ''
    });
    setPreviewFiles([]);
    setActiveTab('view');
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleContentTypeChange = (type) => {
    setFormData(prev => ({
      ...prev,
      content_type: type,
      due_date: type === 'assignment' ? prev.due_date : '',
      max_score: type === 'assignment' ? prev.max_score : ''
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setCreating(true);
    setError(null);

    try {
      const token = localStorage.getItem('accessToken');
      const submitData = new FormData();
      
      submitData.append('subject', subjectId);
      submitData.append('content_type', formData.content_type);
      submitData.append('title', formData.title);
      submitData.append('description', formData.description);
      
      formData.files.forEach((file, index) => {
        submitData.append(`file_${index}`, file);
      });
      
      if (formData.content_type === 'assignment') {
        if (formData.due_date) {
          submitData.append('due_date', formData.due_date);
        }
        if (formData.max_score) {
          submitData.append('max_score', formData.max_score);
        }
      }

      let response;
      if (editingContent) {
        // For updates, we'll delete the old content and create new one
        // This ensures consistency with the current backend structure
        
        // First delete the old content
        await fetch(`${API_BASE_URL}/api/academics/teacher/content/${editingContent.id}/`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
          }
        });
        
        // Then create new content with updated data
        response = await fetch(`${API_BASE_URL}/api/academics/teacher/content/create/`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          body: submitData
        });
      } else {
        // Create new content
        response = await fetch(`${API_BASE_URL}/api/academics/teacher/content/create/`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          body: submitData
        });
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Failed to ${editingContent ? 'update' : 'create'} content`);
      }

      setFormData({
        content_type: 'assignment',
        title: '',
        description: '',
        files: [],
        due_date: '',
        max_score: ''
      });
      setPreviewFiles([]);
      setEditingContent(null);
      
      const fileInput = document.querySelector('input[type="file"]');
      if (fileInput) fileInput.value = '';

      // Add a small delay before refreshing to ensure backend processing is complete
      setTimeout(async () => {
        await fetchSubjectContent();
        setActiveTab('view');
      }, 500);
      
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
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
      <div className="content-manager-container">
        <div className="loading-state">
          <p>Loading content...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="content-manager-container">
      <div className="content-manager-header">
        <button onClick={onBack} className="back-btn">
          ← Back to Students
        </button>
        <div className="subject-info">
          <h2>{subjectInfo.name}</h2>
          <p>{subjectInfo.classroom} - {subjectInfo.academic_year} {subjectInfo.term}</p>
        </div>
      </div>

      <div className="content-tabs">
        <button 
          className={`tab-btn ${activeTab === 'view' ? 'active' : ''}`}
          onClick={() => setActiveTab('view')}
        >
          View Content
        </button>
        <button 
          className={`tab-btn ${activeTab === 'create' ? 'active' : ''}`}
          onClick={() => setActiveTab('create')}
        >
          Create Content
        </button>
      </div>

      {error && (
        <div className="error-message">
          <p>{error}</p>
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      {activeTab === 'view' && (
        <div className="view-content-tab">
          <div className="content-summary">
            <div className="summary-card">
              <h3>Assignments</h3>
              <span className="count">{contentData.assignments?.length || 0}</span>
            </div>
            <div className="summary-card">
              <h3>Notes</h3>
              <span className="count">{contentData.notes?.length || 0}</span>
            </div>
            <div className="summary-card">
              <h3>Announcements</h3>
              <span className="count">{contentData.announcements?.length || 0}</span>
            </div>
          </div>

          <div className="content-sections">
            <div className="content-section">
              <h3>📝 Assignments</h3>
              {contentData.assignments?.length > 0 ? (
                <div className="content-list">
                  {contentData.assignments.map(item => (
                    <div key={item.id} className="content-item assignment">
                      <div className="content-header">
                        <h4>{item.title}</h4>
                        <div className="content-actions">
                          <div className="content-meta">
                            <span className="due-date">Due: {formatDate(item.due_date)}</span>
                            {item.max_score && <span className="max-score">Max: {item.max_score} pts</span>}
                            {item.is_overdue && <span className="overdue-badge">Overdue</span>}
                          </div>
                          <div className="content-buttons">
                            <button onClick={() => handleEditContent(item)} className="edit-btn" title="Edit">✏️</button>
                            <button onClick={() => setShowDeleteConfirm(item.id)} className="delete-btn" title="Delete">🗑️</button>
                          </div>
                        </div>
                      </div>
                      <p className="content-description">{item.description}</p>
                      {item.files && item.files.length > 0 && (
                        <div className="file-attachments">
                          <h5>Attachments ({item.files.length}):</h5>
                          {item.files.map((file, index) => (
                            <div key={index} className="file-attachment">
                              <a href={file.file_url} target="_blank" rel="noopener noreferrer">
                                📎 {file.original_name} ({file.formatted_file_size})
                              </a>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="content-footer">
                        <small>Created: {formatDate(item.created_at)}</small>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="no-content">No assignments yet. Create your first assignment!</p>
              )}
            </div>

            <div className="content-section">
              <h3>📄 Class Notes</h3>
              {contentData.notes?.length > 0 ? (
                <div className="content-list">
                  {contentData.notes.map(item => (
                    <div key={item.id} className="content-item note">
                      <div className="content-header">
                        <h4>{item.title}</h4>
                        <div className="content-buttons">
                          <button onClick={() => handleEditContent(item)} className="edit-btn" title="Edit">✏️</button>
                          <button onClick={() => setShowDeleteConfirm(item.id)} className="delete-btn" title="Delete">🗑️</button>
                        </div>
                      </div>
                      <p className="content-description">{item.description}</p>
                      {item.files && item.files.length > 0 && (
                        <div className="file-attachments">
                          <h5>Attachments ({item.files.length}):</h5>
                          {item.files.map((file, index) => (
                            <div key={index} className="file-attachment">
                              <a href={file.file_url} target="_blank" rel="noopener noreferrer">
                                📎 {file.original_name} ({file.formatted_file_size})
                              </a>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="content-footer">
                        <small>Created: {formatDate(item.created_at)}</small>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="no-content">No class notes yet. Upload your first note!</p>
              )}
            </div>

            <div className="content-section">
              <h3>📢 Announcements</h3>
              {contentData.announcements?.length > 0 ? (
                <div className="content-list">
                  {contentData.announcements.map(item => (
                    <div key={item.id} className="content-item announcement">
                      <div className="content-header">
                        <h4>{item.title}</h4>
                        <div className="content-buttons">
                          <button onClick={() => handleEditContent(item)} className="edit-btn" title="Edit">✏️</button>
                          <button onClick={() => setShowDeleteConfirm(item.id)} className="delete-btn" title="Delete">🗑️</button>
                        </div>
                      </div>
                      <p className="content-description">{item.description}</p>
                      {item.files && item.files.length > 0 && (
                        <div className="file-attachments">
                          <h5>Attachments ({item.files.length}):</h5>
                          {item.files.map((file, index) => (
                            <div key={index} className="file-attachment">
                              <a href={file.file_url} target="_blank" rel="noopener noreferrer">
                                📎 {file.original_name} ({file.formatted_file_size})
                              </a>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="content-footer">
                        <small>Created: {formatDate(item.created_at)}</small>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="no-content">No announcements yet. Make your first announcement!</p>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'create' && (
        <div className="create-content-tab">
          <h3>{editingContent ? 'Edit Content' : 'Create New Content'}</h3>
          
          <div className="content-type-selector">
            <button 
              className={`type-btn ${formData.content_type === 'assignment' ? 'active' : ''}`}
              onClick={() => handleContentTypeChange('assignment')}
            >
              📝 Assignment
            </button>
            <button 
              className={`type-btn ${formData.content_type === 'note' ? 'active' : ''}`}
              onClick={() => handleContentTypeChange('note')}
            >
              📄 Class Note
            </button>
            <button 
              className={`type-btn ${formData.content_type === 'announcement' ? 'active' : ''}`}
              onClick={() => handleContentTypeChange('announcement')}
            >
              📢 Announcement
            </button>
          </div>

          <form onSubmit={handleSubmit} className="content-form">
            <div className="form-group">
              <label htmlFor="title">Title *</label>
              <input
                type="text"
                id="title"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                required
                placeholder={`Enter ${formData.content_type} title`}
              />
            </div>

            <div className="form-group">
              <label htmlFor="description">Description *</label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                required
                rows="4"
                placeholder={`Describe the ${formData.content_type}...`}
              />
            </div>

            {formData.content_type === 'assignment' && (
              <>
                <div className="form-group">
                  <label htmlFor="due_date">Due Date *</label>
                  <input
                    type="datetime-local"
                    id="due_date"
                    name="due_date"
                    value={formData.due_date}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="max_score">Maximum Score</label>
                  <input
                    type="number"
                    id="max_score"
                    name="max_score"
                    value={formData.max_score}
                    onChange={handleInputChange}
                    min="1"
                    placeholder="e.g., 100"
                  />
                </div>
              </>
            )}

            <div className="form-group">
              <label htmlFor="files">Attachments (Optional)</label>
              <input
                type="file"
                id="files"
                name="files"
                onChange={handleInputChange}
                accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.ppt,.pptx,.xls,.xlsx"
                multiple
              />
              <small>Supported formats: PDF, Word, Text, Images, PowerPoint, Excel. You can select multiple files.</small>
              
              {previewFiles.length > 0 && (
                <div className="file-preview-list">
                  <h4>Selected Files ({previewFiles.length})</h4>
                  <div className="file-items">
                    {previewFiles.map((file, index) => (
                      <div key={index} className="file-item">
                        <div className="file-info">
                          <span className="file-name">{file.name}</span>
                          <span className="file-size">({formatFileSize(file.size)})</span>
                        </div>
                        <div className="file-actions">
                          <button 
                            type="button" 
                            onClick={() => previewFile(file)}
                            className="preview-btn"
                          >
                            👁️ Preview
                          </button>
                          <button 
                            type="button" 
                            onClick={() => removeFile(index)}
                            className="remove-btn"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="form-actions">
              <button type="submit" disabled={creating} className="submit-btn">
                {creating ? (editingContent ? 'Updating...' : 'Creating...') : (editingContent ? `Update ${formData.content_type}` : `Create ${formData.content_type}`)}
              </button>
              {editingContent ? (
                <button type="button" onClick={cancelEdit} className="cancel-btn">
                  Cancel Edit
                </button>
              ) : (
                <button type="button" onClick={() => setActiveTab('view')} className="cancel-btn">
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      {showPreview && previewContent && (
        <div className="preview-modal-overlay" onClick={closePreview}>
          <div className="preview-modal" onClick={(e) => e.stopPropagation()}>
            <div className="preview-header">
              <h3>Preview: {previewContent.name}</h3>
              <button onClick={closePreview} className="close-preview-btn">✕</button>
            </div>
            <div className="preview-content">
              {previewContent.type === 'image' && (
                <img 
                  src={previewContent.url} 
                  alt={previewContent.name}
                  className="preview-image"
                />
              )}
              {previewContent.type === 'pdf' && (
                <iframe 
                  src={previewContent.url}
                  className="preview-pdf"
                  title={previewContent.name}
                />
              )}
              {previewContent.type === 'text' && (
                <pre className="preview-text">{previewContent.content}</pre>
              )}
              {previewContent.type === 'other' && (
                <div className="preview-file-info">
                  <div className="file-icon">📄</div>
                  <h4>{previewContent.name}</h4>
                  <p>Size: {formatFileSize(previewContent.size)}</p>
                  <p>Last Modified: {previewContent.lastModified}</p>
                  <p>This file type cannot be previewed directly.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="preview-modal-overlay">
          <div className="delete-confirm-modal">
            <div className="delete-confirm-header">
              <h3>Confirm Delete</h3>
            </div>
            <div className="delete-confirm-content">
              <p>Are you sure you want to delete this content? This action cannot be undone.</p>
              <div className="delete-confirm-actions">
                <button 
                  onClick={() => handleDeleteContent(showDeleteConfirm)}
                  className="confirm-delete-btn"
                >
                  Yes, Delete
                </button>
                <button 
                  onClick={() => setShowDeleteConfirm(null)}
                  className="cancel-delete-btn"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubjectContentManager;