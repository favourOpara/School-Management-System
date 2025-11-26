import React, { useState, useEffect } from 'react';
import { Search, Edit2, Eye } from 'lucide-react';
import API_BASE_URL from '../config';

import './ViewQuestions.css';

const ViewQuestions = () => {
  const [sessions, setSessions] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter state
  const [selectedAcademicYear, setSelectedAcademicYear] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedType, setSelectedType] = useState('');
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
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken');

      const response = await fetch(`${API_BASE_URL}/api/academics/teacher/assigned-subjects/`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // Extract unique academic sessions
      const uniqueSessions = [];
      const sessionMap = new Map();
      const allSubjects = [];

      if (data.subjects_by_class) {
        data.subjects_by_class.forEach(classGroup => {
          const key = `${classGroup.academic_year}-${classGroup.term}`;
          if (!sessionMap.has(key)) {
            sessionMap.set(key, {
              academic_year: classGroup.academic_year,
              term: classGroup.term
            });
            uniqueSessions.push({
              academic_year: classGroup.academic_year,
              term: classGroup.term
            });
          }

          // Collect all subjects
          classGroup.subjects.forEach(subject => {
            allSubjects.push({
              ...subject,
              className: classGroup.class_name,
              academicYear: classGroup.academic_year,
              term: classGroup.term
            });
          });
        });
      }

      setSessions(uniqueSessions);
      setSubjects(allSubjects);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!selectedAcademicYear || !selectedTerm || !selectedSubject || !selectedType) {
      setError('Please select all filters before searching');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('accessToken');

      const response = await fetch(`${API_BASE_URL}/api/academics/teacher/assessments/`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // Filter assessments based on criteria
      const filtered = data.filter(assessment => {
        const subject = subjects.find(s => s.id === parseInt(selectedSubject));

        // Match subject (assessment.subject is just the ID)
        if (assessment.subject !== parseInt(selectedSubject)) {
          return false;
        }

        // Match academic year and term by parsing class_session
        // class_session format: "J.S.S.1 - 2027/2028 - First Term"
        if (assessment.class_session) {
          const parts = assessment.class_session.split(' - ');
          if (parts.length >= 3) {
            const academicYear = parts[1]; // "2027/2028"
            const term = parts[2]; // "First Term"

            if (academicYear !== selectedAcademicYear || term !== selectedTerm) {
              return false;
            }
          }
        }

        // Match assessment type
        if (selectedType === 'test') {
          return assessment.assessment_type === 'test_1' || assessment.assessment_type === 'test_2' || assessment.assessment_type === 'mid_term';
        } else if (selectedType === 'exam') {
          return assessment.assessment_type === 'final_exam';
        }

        return false;
      });

      setAssessments(filtered);
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

  const handleEditQuestion = (question) => {
    setEditingQuestion(question);

    // Prepare edit form data
    const formData = {
      question_text: question.question_text,
      marks: question.marks,
      correct_answer: question.correct_answer || '',
      options: question.options || [],
      matching_pairs: question.matching_pairs || []
    };

    setEditFormData(formData);

    // Set image preview if question has an image
    if (question.image_url) {
      const fullImageUrl = question.image_url.startsWith('http')
        ? question.image_url
        : `${API_BASE_URL}${question.image_url}`;
      setImagePreview(fullImageUrl);
    } else {
      setImagePreview(null);
    }

    // Reset image states
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

      // Check if we need to use FormData (for image upload/deletion)
      let body;
      let headers = {
        'Authorization': `Bearer ${token}`
      };

      if (newImage || deleteImage) {
        // Use FormData for image changes
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
        // Regular JSON request
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

      // Refresh the assessments list
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
            // Unset other options when marking this as correct
            return { ...opt, [field]: value };
          }
          return { ...opt, [field]: value };
        }
        // Unset is_correct for other options
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

    // Validate file size (100KB = 102400 bytes)
    if (file.size > 102400) {
      setError('Image file size cannot exceed 100KB');
      return;
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      setError('Only image files (JPEG, PNG, GIF) are allowed');
      return;
    }

    setNewImage(file);
    setDeleteImage(false);

    // Create preview URL
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

    // Restore original image if it exists
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
      'essay': 'Essay/Short Answer',
      'matching': 'Matching'
    };
    return labels[type] || type;
  };

  const getAssessmentTypeLabel = (type) => {
    const labels = {
      'test_1': 'Test 1',
      'test_2': 'Test 2',
      'mid_term': 'Mid-Term Test',
      'final_exam': 'Final Exam'
    };
    return labels[type] || type;
  };

  // Get unique academic years and terms
  const uniqueYears = [...new Set(sessions.map(s => s.academic_year))];
  const uniqueTerms = [...new Set(sessions.map(s => s.term))];

  // Filter subjects based on selected session
  const filteredSubjects = subjects.filter(s => {
    if (!selectedAcademicYear || !selectedTerm) return false;
    return s.academicYear === selectedAcademicYear && s.term === selectedTerm;
  });

  if (loading && !hasFiltered) {
    return (
      <div className="vq-main-wrapper">
        <div className="view-questions-loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="vq-main-wrapper">
      <div className="vq-page-header">
        <h2>View Questions</h2>
        <p>Filter and view your created assessments and questions</p>
      </div>

      {error && (
        <div className="view-questions-error">
          {error}
        </div>
      )}

      <div className="view-questions-filters">
        <div className="filters-grid">
          <div className="filter-group">
            <label htmlFor="academicYear">Academic Year *</label>
            <select
              id="academicYear"
              value={selectedAcademicYear}
              onChange={(e) => {
                setSelectedAcademicYear(e.target.value);
                setSelectedSubject('');
                setHasFiltered(false);
              }}
            >
              <option value="">-- Select Year --</option>
              {uniqueYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="term">Term *</label>
            <select
              id="term"
              value={selectedTerm}
              onChange={(e) => {
                setSelectedTerm(e.target.value);
                setSelectedSubject('');
                setHasFiltered(false);
              }}
            >
              <option value="">-- Select Term --</option>
              {uniqueTerms.map((term) => (
                <option key={term} value={term}>
                  {term}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="subject">Subject *</label>
            <select
              id="subject"
              value={selectedSubject}
              onChange={(e) => {
                setSelectedSubject(e.target.value);
                setHasFiltered(false);
              }}
              disabled={!selectedAcademicYear || !selectedTerm}
            >
              <option value="">-- Select Subject --</option>
              {filteredSubjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name} - {subject.className}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="type">Type *</label>
            <select
              id="type"
              value={selectedType}
              onChange={(e) => {
                setSelectedType(e.target.value);
                setHasFiltered(false);
              }}
            >
              <option value="">-- Select Type --</option>
              <option value="test">Test</option>
              <option value="exam">Exam</option>
            </select>
          </div>
        </div>

        <button
          onClick={handleSearch}
          className="search-btn"
          disabled={!selectedAcademicYear || !selectedTerm || !selectedSubject || !selectedType || loading}
        >
          <Search size={16} />
          Search
        </button>
      </div>

      {hasFiltered && (
        <div className="assessments-results">
          {loading ? (
            <div className="view-questions-loading">Searching...</div>
          ) : assessments.length === 0 ? (
            <div className="no-results">
              No assessments found matching your filters.
            </div>
          ) : (
            <div className="assessments-list">
              <h3>Found {assessments.length} assessment{assessments.length !== 1 ? 's' : ''}</h3>

              {assessments.map((assessment) => (
                <div key={assessment.id} className="assessment-card">
                  <div className="assessment-header" onClick={() => toggleAssessment(assessment.id)}>
                    <div className="assessment-info">
                      <h4>{assessment.title}</h4>
                      <div className="assessment-meta">
                        <span className="meta-item">Type: {getAssessmentTypeLabel(assessment.assessment_type)}</span>
                        <span className="meta-item">Duration: {assessment.duration_minutes} mins</span>
                        <span className="meta-item">Total: {assessment.total_marks} marks</span>
                        <span className="meta-item">Questions: {assessment.questions?.length || 0}</span>
                      </div>
                    </div>
                    <button className="toggle-btn">
                      {expandedAssessment === assessment.id ? (
                        <Eye size={20} />
                      ) : (
                        <Eye size={20} />
                      )}
                    </button>
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

      {/* Edit Modal */}
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

export default ViewQuestions;
