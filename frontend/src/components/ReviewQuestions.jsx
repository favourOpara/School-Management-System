import React, { useState, useEffect } from 'react';
import { Search, Edit2, Eye, Lock, Unlock, Trash2 } from 'lucide-react';
import './ReviewQuestions.css';
import { useDialog } from '../contexts/DialogContext';

import API_BASE_URL from '../config';

const ReviewQuestions = () => {
  const { showConfirm, showAlert } = useDialog();
  const [sessions, setSessions] = useState([]);
  const [classes, setClasses] = useState([]);
  const [allSubjects, setAllSubjects] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter state
  const [selectedAssessmentType, setSelectedAssessmentType] = useState('');
  const [selectedAcademicYear, setSelectedAcademicYear] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [hasFiltered, setHasFiltered] = useState(false);

  // Expanded assessment state
  const [expandedAssessment, setExpandedAssessment] = useState(null);

  // Edit modal state
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [editFormData, setEditFormData] = useState(null);
  const [saving, setSaving] = useState(false);
  const [newImage, setNewImage] = useState(null);
  const [deleteImage, setDeleteImage] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);

  useEffect(() => {
    fetchSessionsAndSubjects();
  }, []);

  const fetchSessionsAndSubjects = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken');

      // Fetch all class sessions
      const sessionsResponse = await fetch(`${API_BASE_URL}/api/academics/sessions/`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!sessionsResponse.ok) {
        throw new Error(`HTTP error! status: ${sessionsResponse.status}`);
      }

      const sessionsData = await sessionsResponse.json();

      // Extract unique academic sessions
      const uniqueSessions = [];
      const sessionMap = new Map();

      if (sessionsData && Array.isArray(sessionsData)) {
        sessionsData.forEach(session => {
          const key = `${session.academic_year}-${session.term}`;
          if (!sessionMap.has(key)) {
            sessionMap.set(key, true);
            uniqueSessions.push({
              academic_year: session.academic_year,
              term: session.term
            });
          }
        });
      }

      setSessions(uniqueSessions);

      // Fetch all classes
      const classesResponse = await fetch(`${API_BASE_URL}/api/academics/classes/`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!classesResponse.ok) {
        throw new Error(`HTTP error! status: ${classesResponse.status}`);
      }

      const classesData = await classesResponse.json();
      setClasses(classesData || []);

      // Fetch all subjects
      const subjectsResponse = await fetch(`${API_BASE_URL}/api/academics/subjects/list/`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!subjectsResponse.ok) {
        throw new Error(`HTTP error! status: ${subjectsResponse.status}`);
      }

      const subjectsData = await subjectsResponse.json();
      setAllSubjects(subjectsData || []);

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!selectedAssessmentType || !selectedAcademicYear || !selectedTerm) {
      setError('Please select assessment type, academic year, and term to search');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('accessToken');

      const params = new URLSearchParams();
      params.append('academic_year', selectedAcademicYear);
      params.append('term', selectedTerm);

      // Add subject filter if selected
      if (selectedSubject) {
        params.append('subject_id', selectedSubject);
      }

      const response = await fetch(`${API_BASE_URL}/api/academics/admin/assessments/?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch assessments');
      }

      const data = await response.json();

      // Filter by assessment type on frontend
      let filteredAssessments = data.assessments || [];
      if (selectedAssessmentType === 'test') {
        filteredAssessments = filteredAssessments.filter(a =>
          a.assessment_type === 'test_1' ||
          a.assessment_type === 'test_2' ||
          a.assessment_type === 'mid_term'
        );
      } else if (selectedAssessmentType === 'exam') {
        filteredAssessments = filteredAssessments.filter(a =>
          a.assessment_type === 'final_exam'
        );
      }

      setAssessments(filteredAssessments);
      setHasFiltered(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleAssessment = (assessmentId) => {
    setExpandedAssessment(expandedAssessment === assessmentId ? null : assessmentId);
  };

  const handleToggleRelease = async (assessmentId) => {
    try {
      const token = localStorage.getItem('accessToken');

      const response = await fetch(`${API_BASE_URL}/api/academics/admin/assessments/${assessmentId}/toggle-release/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to toggle release status');
      }

      // Refresh assessments
      await handleSearch();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteAssessment = async (assessment) => {
    const confirmMessage = `Are you sure you want to delete "${assessment.title}"?\n\nThis will permanently delete:\n- ${assessment.questions?.length || 0} questions\n- All associated options and answers\n\nThis action cannot be undone.`;

    const confirmed = await showConfirm({
      title: 'Delete Assessment',
      message: confirmMessage,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      confirmButtonClass: 'confirm-btn-danger'
    });
    if (!confirmed) return;

    try {
      const token = localStorage.getItem('accessToken');

      const response = await fetch(`${API_BASE_URL}/api/academics/admin/assessments/${assessment.id}/delete/`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete assessment');
      }

      const data = await response.json();
      showAlert({
        type: 'success',
        message: data.message
      });

      // Refresh assessments
      await handleSearch();
    } catch (err) {
      setError(err.message);
      showAlert({
        type: 'error',
        message: 'Error deleting assessment: ' + err.message
      });
    }
  };

  const handleUnlockAll = async () => {
    if (!selectedAssessmentType) {
      setError('Please select assessment type before unlocking all');
      return;
    }

    const typeLabel = selectedAssessmentType === 'test' ? 'tests' : 'exams';
    const filterSummary = selectedSubject
      ? 'for the selected subject'
      : selectedClass
      ? 'for the selected class'
      : selectedTerm && selectedAcademicYear
      ? `for ${selectedTerm} ${selectedAcademicYear}`
      : 'matching the current filters';

    const confirmed = await showConfirm({
      title: 'Unlock Assessments',
      message: `Are you sure you want to unlock all ${typeLabel} ${filterSummary}?`,
      confirmText: 'Unlock',
      cancelText: 'Cancel',
      confirmButtonClass: 'confirm-btn-warning'
    });
    if (!confirmed) return;

    try {
      const token = localStorage.getItem('accessToken');
      const requestBody = {
        assessment_type: selectedAssessmentType  // Always include assessment type
      };

      // Only add other filters that are selected
      if (selectedAcademicYear) requestBody.academic_year = selectedAcademicYear;
      if (selectedTerm) requestBody.term = selectedTerm;
      if (selectedSubject) requestBody.subject_id = selectedSubject;

      const response = await fetch(`${API_BASE_URL}/api/academics/admin/assessments/unlock-all/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error('Failed to unlock assessments');
      }

      const data = await response.json();
      alert(data.message);

      // Refresh assessments if filters are applied
      if (hasFiltered) {
        await handleSearch();
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEditQuestion = (question) => {
    setEditingQuestion(question);

    const formData = {
      question_text: question.question_text,
      marks: question.marks,
      correct_answer: question.correct_answer || '',
      options: question.options || [],
      matching_pairs: question.matching_pairs || []
    };

    setEditFormData(formData);

    if (question.image_url) {
      const fullImageUrl = question.image_url.startsWith('http')
        ? question.image_url
        : `${API_BASE_URL}${question.image_url}`;
      setImagePreview(fullImageUrl);
    } else {
      setImagePreview(null);
    }

    setNewImage(null);
    setDeleteImage(false);
  };

  const handleCloseEditModal = () => {
    setEditingQuestion(null);
    setEditFormData(null);
    setNewImage(null);
    setDeleteImage(false);
    setImagePreview(null);
  };

  const handleSaveQuestion = async () => {
    if (!editingQuestion || !editFormData) return;

    try {
      setSaving(true);
      setError(null);
      const token = localStorage.getItem('accessToken');

      const updateData = {
        question_text: editFormData.question_text,
        marks: parseFloat(editFormData.marks),
        correct_answer: editFormData.correct_answer,
        options: editingQuestion.question_type === 'multiple_choice' ? editFormData.options : undefined,
        matching_pairs: editingQuestion.question_type === 'matching' ? editFormData.matching_pairs : undefined
      };

      let body;
      let headers = {
        'Authorization': `Bearer ${token}`
      };

      if (newImage || deleteImage) {
        const formData = new FormData();
        formData.append('data', JSON.stringify(updateData));

        if (newImage) {
          formData.append('image', newImage);
        }

        if (deleteImage) {
          formData.append('delete_image', 'true');
        }

        body = formData;
      } else {
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify(updateData);
      }

      const response = await fetch(`${API_BASE_URL}/api/academics/questions/${editingQuestion.id}/`, {
        method: 'PATCH',
        headers: headers,
        body: body
      });

      if (!response.ok) {
        throw new Error('Failed to update question');
      }

      await handleSearch();
      handleCloseEditModal();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleFormChange = (field, value) => {
    setEditFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleOptionChange = (optionIndex, field, value) => {
    setEditFormData(prev => ({
      ...prev,
      options: prev.options.map((opt, idx) => {
        if (idx === optionIndex) {
          if (field === 'is_correct' && value === true) {
            return { ...opt, [field]: value };
          }
          return { ...opt, [field]: value };
        }
        if (field === 'is_correct' && value === true) {
          return { ...opt, is_correct: false };
        }
        return opt;
      })
    }));
  };

  const handleMatchingPairChange = (pairIndex, field, value) => {
    setEditFormData(prev => ({
      ...prev,
      matching_pairs: prev.matching_pairs.map((pair, idx) =>
        idx === pairIndex ? { ...pair, [field]: value } : pair
      )
    }));
  };

  const handleImageChange = (file) => {
    if (!file) return;

    if (file.size > 102400) {
      setError('Image file size cannot exceed 100KB');
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      setError('Only image files (JPEG, PNG, GIF) are allowed');
      return;
    }

    setNewImage(file);
    setDeleteImage(false);

    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteImage = () => {
    setDeleteImage(true);
    setNewImage(null);
    setImagePreview(null);
  };

  const handleRemoveNewImage = () => {
    setNewImage(null);

    if (editingQuestion.image_url) {
      const fullImageUrl = editingQuestion.image_url.startsWith('http')
        ? editingQuestion.image_url
        : `${API_BASE_URL}${editingQuestion.image_url}`;
      setImagePreview(fullImageUrl);
      setDeleteImage(false);
    } else {
      setImagePreview(null);
    }
  };

  const getQuestionTypeLabel = (type) => {
    const labels = {
      'multiple_choice': 'Multiple Choice',
      'true_false': 'True/False',
      'fill_blank': 'Fill in the Blanks',
      'essay': 'Essay',
      'matching': 'Matching'
    };
    return labels[type] || type;
  };

  const getAssessmentTypeLabel = (type) => {
    const labels = {
      'test_1': 'Test 1',
      'test_2': 'Test 2',
      'mid_term': 'Mid-Term',
      'final_exam': 'Final Exam'
    };
    return labels[type] || type;
  };

  const uniqueYears = [...new Set(sessions.map(s => s.academic_year))];
  const uniqueTerms = [...new Set(sessions.map(s => s.term))];

  // Filter subjects by selected class
  const filteredSubjects = selectedClass
    ? allSubjects.filter(subject => {
        // Check if subject's class_session.classroom.id matches selected class
        return subject.class_session?.classroom?.id === parseInt(selectedClass);
      })
    : allSubjects;

  return (
    <div className="review-questions-container">
      <div className="review-questions-header">
        <h2>Review Questions</h2>
        <p>Review and manage assessments created by teachers</p>
      </div>

      {error && <div className="review-questions-error">{error}</div>}

      {loading && !hasFiltered ? (
        <div className="review-questions-loading">Loading...</div>
      ) : (
        <>
          {/* Filters */}
          <div className="review-questions-filters">
            <div className="filters-grid">
              <div className="filter-group">
                <label>Assessment Type *</label>
                <select
                  value={selectedAssessmentType}
                  onChange={(e) => setSelectedAssessmentType(e.target.value)}
                >
                  <option value="">-- Select Type --</option>
                  <option value="test">Tests</option>
                  <option value="exam">Exams</option>
                </select>
              </div>

              <div className="filter-group">
                <label>Academic Year *</label>
                <select
                  value={selectedAcademicYear}
                  onChange={(e) => setSelectedAcademicYear(e.target.value)}
                  disabled={!selectedAssessmentType}
                >
                  <option value="">-- Select Year --</option>
                  {uniqueYears.map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>

              <div className="filter-group">
                <label>Term *</label>
                <select
                  value={selectedTerm}
                  onChange={(e) => setSelectedTerm(e.target.value)}
                  disabled={!selectedAcademicYear}
                >
                  <option value="">-- Select Term --</option>
                  {uniqueTerms.map(term => (
                    <option key={term} value={term}>{term}</option>
                  ))}
                </select>
              </div>

              <div className="filter-group">
                <label>Class (Optional)</label>
                <select
                  value={selectedClass}
                  onChange={(e) => {
                    setSelectedClass(e.target.value);
                    setSelectedSubject(''); // Reset subject when class changes
                  }}
                  disabled={!selectedTerm}
                >
                  <option value="">-- All Classes --</option>
                  {classes.map(cls => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="filter-group">
                <label>Subject (Optional)</label>
                <select
                  value={selectedSubject}
                  onChange={(e) => setSelectedSubject(e.target.value)}
                  disabled={!selectedTerm}
                >
                  <option value="">-- All Subjects --</option>
                  {filteredSubjects.map(subject => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                className="search-btn"
                onClick={handleSearch}
                disabled={!selectedAssessmentType || !selectedAcademicYear || !selectedTerm || loading}
              >
                <Search size={20} />
                Search
              </button>
            </div>

            {selectedAssessmentType && (
              <div className="unlock-all-section">
                <button className="unlock-all-btn" onClick={handleUnlockAll}>
                  <Unlock size={18} />
                  Unlock All {selectedAssessmentType === 'test' ? 'Tests' : 'Exams'}
                  {selectedSubject ? ' for Selected Subject' :
                   selectedClass ? ' for Selected Class' :
                   selectedTerm && selectedAcademicYear ? ` for ${selectedTerm} ${selectedAcademicYear}` :
                   ''}
                </button>
              </div>
            )}
          </div>

          {/* Results */}
          {hasFiltered && (
            <div className="assessments-results">
              {assessments.length === 0 ? (
                <div className="no-results">No assessments found matching your filters.</div>
              ) : (
                <div className="assessments-list">
                  <h3>Found {assessments.length} assessment(s)</h3>

                  {assessments.map(assessment => (
                    <div key={assessment.id} className="assessment-card">
                      <div className="assessment-header" onClick={() => toggleAssessment(assessment.id)}>
                        <div className="assessment-info">
                          <h4>{assessment.title}</h4>
                          <div className="assessment-meta">
                            <span className="meta-item">Type: {getAssessmentTypeLabel(assessment.assessment_type)}</span>
                            <span className="meta-item">Duration: {assessment.duration_minutes} mins</span>
                            <span className="meta-item">Total: {assessment.total_marks} marks</span>
                            <span className="meta-item">Questions: {assessment.questions?.length || 0}</span>
                            <span className="meta-item">Created by: {assessment.created_by_name}</span>
                            <span className={`meta-item status-badge ${assessment.is_released ? 'released' : 'locked'}`}>
                              {assessment.is_released ? (
                                <><Unlock size={14} /> Released</>
                              ) : (
                                <><Lock size={14} /> Locked</>
                              )}
                            </span>
                          </div>
                        </div>
                        <div className="assessment-actions">
                          <button
                            className={`toggle-release-btn ${assessment.is_released ? 'lock' : 'unlock'}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleRelease(assessment.id);
                            }}
                          >
                            {assessment.is_released ? <Lock size={16} /> : <Unlock size={16} />}
                            {assessment.is_released ? 'Lock' : 'Unlock'}
                          </button>
                          <button className="toggle-btn">
                            <Eye size={20} />
                          </button>
                          <button
                            className="delete-assessment-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteAssessment(assessment);
                            }}
                            title="Delete Assessment"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>

                      {expandedAssessment === assessment.id && (
                        <div className="assessment-questions">
                          {assessment.questions && assessment.questions.length > 0 ? (
                            assessment.questions.map((question, index) => (
                              <div key={question.id} className="question-item">
                                <div className="question-header">
                                  <span className="question-number">Q{index + 1}</span>
                                  <span className="question-type-badge">{getQuestionTypeLabel(question.question_type)}</span>
                                  <span className="question-marks">{question.marks} marks</span>
                                  <button
                                    className="edit-question-btn"
                                    onClick={() => handleEditQuestion(question)}
                                  >
                                    <Edit2 size={16} />
                                    Edit
                                  </button>
                                </div>
                                <div className="question-text">{question.question_text}</div>

                                {question.image_url && (
                                  <div className="question-image">
                                    <img
                                      src={question.image_url.startsWith('http')
                                        ? question.image_url
                                        : `${API_BASE_URL}${question.image_url}`
                                      }
                                      alt={`Question ${index + 1}`}
                                    />
                                  </div>
                                )}

                                {question.question_type === 'multiple_choice' && question.options && (
                                  <div className="question-options">
                                    {question.options.map((option) => (
                                      <div key={option.id} className={`option ${option.is_correct ? 'correct' : ''}`}>
                                        <span className="option-label">{option.option_label}.</span>
                                        <span className="option-text">{option.option_text}</span>
                                        {option.is_correct && <span className="correct-badge">✓ Correct</span>}
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {question.question_type === 'true_false' && (
                                  <div className="question-answer">
                                    <strong>Correct Answer:</strong> {question.correct_answer}
                                  </div>
                                )}

                                {question.question_type === 'fill_blank' && (
                                  <div className="question-answer">
                                    <strong>Correct Answer:</strong> {question.correct_answer}
                                  </div>
                                )}

                                {question.question_type === 'essay' && question.correct_answer && (
                                  <div className="question-answer">
                                    <strong>Marking Guide:</strong> {question.correct_answer}
                                  </div>
                                )}

                                {question.question_type === 'matching' && question.matching_pairs && (
                                  <div className="matching-pairs">
                                    <strong>Matching Pairs:</strong>
                                    {question.matching_pairs.map((pair) => (
                                      <div key={pair.id} className="matching-pair">
                                        <span>{pair.left_item}</span>
                                        <span className="arrow">→</span>
                                        <span>{pair.right_item}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))
                          ) : (
                            <div className="no-questions">No questions found for this assessment.</div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Edit Modal - Same as ViewQuestions */}
      {editingQuestion && editFormData && (
        <div className="edit-modal-overlay" onClick={handleCloseEditModal}>
          <div className="edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="edit-modal-header">
              <h3>Edit Question</h3>
              <button className="close-modal-btn" onClick={handleCloseEditModal}>×</button>
            </div>

            <div className="edit-modal-body">
              <div className="edit-form-group">
                <label>Question Text</label>
                <textarea
                  value={editFormData.question_text}
                  onChange={(e) => handleFormChange('question_text', e.target.value)}
                  rows="4"
                />
              </div>

              <div className="edit-form-group">
                <label>Marks</label>
                <input
                  type="number"
                  value={editFormData.marks}
                  onChange={(e) => handleFormChange('marks', e.target.value)}
                  min="0.5"
                  step="0.5"
                />
              </div>

              {/* Image Section */}
              <div className="edit-form-group">
                <label>Question Image (Optional - Max 100KB)</label>

                {imagePreview && !deleteImage && (
                  <div className="current-image-preview">
                    <img src={imagePreview} alt="Question" />
                    <div className="image-actions">
                      {newImage ? (
                        <button
                          type="button"
                          className="remove-image-btn"
                          onClick={handleRemoveNewImage}
                        >
                          Remove New Image
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="delete-image-btn"
                          onClick={handleDeleteImage}
                        >
                          Delete Image
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {(!imagePreview || deleteImage) && (
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageChange(e.target.files[0])}
                  />
                )}

                {deleteImage && editingQuestion.image_url && (
                  <p className="image-delete-notice">Image will be deleted when you save</p>
                )}
              </div>

              {editingQuestion.question_type === 'multiple_choice' && (
                <div className="edit-form-group">
                  <label>Options</label>
                  {editFormData.options.map((option, index) => (
                    <div key={index} className="edit-option-row">
                      <span className="option-label">{option.option_label}</span>
                      <input
                        type="text"
                        value={option.option_text}
                        onChange={(e) => handleOptionChange(index, 'option_text', e.target.value)}
                      />
                      <label className="correct-checkbox">
                        <input
                          type="radio"
                          name="correct-option"
                          checked={option.is_correct}
                          onChange={(e) => handleOptionChange(index, 'is_correct', e.target.checked)}
                        />
                        <span>Correct</span>
                      </label>
                    </div>
                  ))}
                </div>
              )}

              {editingQuestion.question_type === 'true_false' && (
                <div className="edit-form-group">
                  <label>Correct Answer</label>
                  <select
                    value={editFormData.correct_answer}
                    onChange={(e) => handleFormChange('correct_answer', e.target.value)}
                  >
                    <option value="">-- Select --</option>
                    <option value="True">True</option>
                    <option value="False">False</option>
                  </select>
                </div>
              )}

              {(editingQuestion.question_type === 'fill_blank' || editingQuestion.question_type === 'essay') && (
                <div className="edit-form-group">
                  <label>{editingQuestion.question_type === 'essay' ? 'Marking Guide' : 'Correct Answer'}</label>
                  <textarea
                    value={editFormData.correct_answer}
                    onChange={(e) => handleFormChange('correct_answer', e.target.value)}
                    rows="3"
                  />
                </div>
              )}

              {editingQuestion.question_type === 'matching' && (
                <div className="edit-form-group">
                  <label>Matching Pairs</label>
                  {editFormData.matching_pairs.map((pair, index) => (
                    <div key={index} className="edit-matching-row">
                      <input
                        type="text"
                        value={pair.left_item}
                        onChange={(e) => handleMatchingPairChange(index, 'left_item', e.target.value)}
                        placeholder="Left item"
                      />
                      <span className="arrow">→</span>
                      <input
                        type="text"
                        value={pair.right_item}
                        onChange={(e) => handleMatchingPairChange(index, 'right_item', e.target.value)}
                        placeholder="Right item"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="edit-modal-footer">
              <button className="cancel-btn" onClick={handleCloseEditModal} disabled={saving}>
                Cancel
              </button>
              <button className="save-btn" onClick={handleSaveQuestion} disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReviewQuestions;
