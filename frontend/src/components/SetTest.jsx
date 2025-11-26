import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Save } from 'lucide-react';
import './SetTest.css';

const SetTest = () => {
  const [sessions, setSessions] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Academic session filter state
  const [selectedAcademicYear, setSelectedAcademicYear] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('');
  const [sessionSelected, setSessionSelected] = useState(false);

  // Form state
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedTopic, setSelectedTopic] = useState('');
  const [testTitle, setTestTitle] = useState('');
  const [testDuration, setTestDuration] = useState('');
  const [assessmentType, setAssessmentType] = useState('test_1');
  const [questions, setQuestions] = useState([
    {
      question_type: 'multiple_choice',
      question: '',
      marks: '',
      options: [
        { text: '', label: 'A', is_correct: false },
        { text: '', label: 'B', is_correct: false },
        { text: '', label: 'C', is_correct: false },
        { text: '', label: 'D', is_correct: false }
      ],
      correct_answer: '',
      matching_pairs: [
        { left: '', right: '' },
        { left: '', right: '' }
      ],
      image: null,
      imagePreview: null
    }
  ]);
  const [bulkQuestionCount, setBulkQuestionCount] = useState('');

  useEffect(() => {
    fetchSessions();
  }, []);

  useEffect(() => {
    if (selectedSubject) {
      fetchTopics(selectedSubject);
    }
  }, [selectedSubject]);

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken');

      const response = await fetch('http://127.0.0.1:8000/api/academics/teacher/assigned-subjects/', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 401) {
        setError('Authentication failed. Please log in again.');
        return;
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // Extract unique academic sessions
      const uniqueSessions = [];
      const sessionMap = new Map();

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
        });
      }

      setSessions(uniqueSessions);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSessionConfirm = async () => {
    if (!selectedAcademicYear || !selectedTerm) {
      setError('Please select both academic year and term');
      return;
    }

    setError(null);
    setSessionSelected(true);

    // Fetch subjects for the selected session
    await fetchSubjectsForSession(selectedAcademicYear, selectedTerm);
  };

  const fetchSubjectsForSession = async (academicYear, term) => {
    try {
      const token = localStorage.getItem('accessToken');

      const response = await fetch('http://127.0.0.1:8000/api/academics/teacher/assigned-subjects/', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // Filter subjects for selected session
      const filteredSubjects = [];
      if (data.subjects_by_class) {
        data.subjects_by_class.forEach(classGroup => {
          if (classGroup.academic_year === academicYear && classGroup.term === term) {
            classGroup.subjects.forEach(subject => {
              filteredSubjects.push({
                ...subject,
                className: classGroup.class_name,
                classSession: classGroup.class_session,
                academicYear: classGroup.academic_year,
                term: classGroup.term
              });
            });
          }
        });
      }

      setSubjects(filteredSubjects);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleChangeSession = () => {
    setSessionSelected(false);
    setSelectedSubject('');
    setSelectedTopic('');
    setSubjects([]);
    setTopics([]);
  };

  const fetchTopics = async (subjectId) => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`http://127.0.0.1:8000/api/academics/topics/?subject_id=${subjectId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setTopics(data);
      }
    } catch (err) {
      console.error('Error fetching topics:', err);
    }
  };

  const getDefaultQuestionData = (type) => {
    const base = {
      question_type: type,
      question: '',
      marks: '',
      correct_answer: '',
      options: [],
      matching_pairs: [],
      image: null,
      imagePreview: null
    };

    if (type === 'multiple_choice') {
      base.options = [
        { text: '', label: 'A', is_correct: false },
        { text: '', label: 'B', is_correct: false },
        { text: '', label: 'C', is_correct: false },
        { text: '', label: 'D', is_correct: false }
      ];
    } else if (type === 'matching') {
      base.matching_pairs = [
        { left: '', right: '' },
        { left: '', right: '' }
      ];
    }

    return base;
  };

  const handleAddQuestion = () => {
    setQuestions([...questions, getDefaultQuestionData('multiple_choice')]);
  };

  const handleBulkAddQuestions = () => {
    const count = parseInt(bulkQuestionCount);
    if (count && count > 0 && count <= 50) {
      const newQuestions = [];
      for (let i = 0; i < count; i++) {
        newQuestions.push(getDefaultQuestionData('multiple_choice'));
      }
      setQuestions([...questions, ...newQuestions]);
      setBulkQuestionCount('');
    }
  };

  const handleRemoveQuestion = (index) => {
    if (questions.length > 1) {
      const newQuestions = questions.filter((_, i) => i !== index);
      setQuestions(newQuestions);
    }
  };

  const handleQuestionChange = (index, field, value) => {
    const newQuestions = [...questions];
    newQuestions[index][field] = value;
    setQuestions(newQuestions);
  };

  const handleQuestionTypeChange = (index, newType) => {
    const newQuestions = [...questions];
    const oldQuestion = newQuestions[index];
    newQuestions[index] = {
      ...getDefaultQuestionData(newType),
      question: oldQuestion.question,
      marks: oldQuestion.marks,
      image: oldQuestion.image,
      imagePreview: oldQuestion.imagePreview
    };
    setQuestions(newQuestions);
  };

  const handleOptionChange = (questionIndex, optionIndex, field, value) => {
    const newQuestions = [...questions];
    newQuestions[questionIndex].options[optionIndex][field] = value;

    // If setting this option as correct, unset others
    if (field === 'is_correct' && value === true) {
      newQuestions[questionIndex].options.forEach((opt, idx) => {
        if (idx !== optionIndex) {
          opt.is_correct = false;
        }
      });
    }

    setQuestions(newQuestions);
  };

  const handleMatchingPairChange = (questionIndex, pairIndex, field, value) => {
    const newQuestions = [...questions];
    newQuestions[questionIndex].matching_pairs[pairIndex][field] = value;
    setQuestions(newQuestions);
  };

  const addMatchingPair = (questionIndex) => {
    const newQuestions = [...questions];
    newQuestions[questionIndex].matching_pairs.push({ left: '', right: '' });
    setQuestions(newQuestions);
  };

  const removeMatchingPair = (questionIndex, pairIndex) => {
    const newQuestions = [...questions];
    if (newQuestions[questionIndex].matching_pairs.length > 2) {
      newQuestions[questionIndex].matching_pairs = newQuestions[questionIndex].matching_pairs.filter((_, i) => i !== pairIndex);
      setQuestions(newQuestions);
    }
  };

  const handleImageChange = (index, file) => {
    if (!file) {
      const newQuestions = [...questions];
      newQuestions[index].image = null;
      newQuestions[index].imagePreview = null;
      setQuestions(newQuestions);
      return;
    }

    // Validate file size (100KB = 102400 bytes)
    if (file.size > 102400) {
      setError(`Image for question ${index + 1} exceeds 100KB limit. Please choose a smaller image.`);
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError(`File for question ${index + 1} must be an image.`);
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      const newQuestions = [...questions];
      newQuestions[index].image = file;
      newQuestions[index].imagePreview = reader.result;
      setQuestions(newQuestions);
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const calculateTotalMarks = () => {
    return questions.reduce((total, q) => {
      const marks = parseFloat(q.marks) || 0;
      return total + marks;
    }, 0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Validation
    if (!selectedSubject) {
      setError('Please select a subject');
      return;
    }

    if (!testDuration || testDuration <= 0) {
      setError('Please enter a valid test duration');
      return;
    }

    const hasEmptyQuestions = questions.some(q => !q.question.trim() || !q.marks);
    if (hasEmptyQuestions) {
      setError('Please fill in all question fields');
      return;
    }

    // Validate question-type specific fields
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (q.question_type === 'multiple_choice') {
        const hasEmptyOption = q.options.some(opt => !opt.text.trim());
        if (hasEmptyOption) {
          setError(`Question ${i + 1}: All options must have text`);
          return;
        }
        const correctCount = q.options.filter(opt => opt.is_correct).length;
        if (correctCount !== 1) {
          setError(`Question ${i + 1}: Select exactly one correct answer`);
          return;
        }
      } else if (q.question_type === 'true_false') {
        if (!q.correct_answer) {
          setError(`Question ${i + 1}: Select True or False as correct answer`);
          return;
        }
      } else if (q.question_type === 'fill_blank') {
        if (!q.correct_answer.trim()) {
          setError(`Question ${i + 1}: Provide the correct answer`);
          return;
        }
      } else if (q.question_type === 'matching') {
        const hasEmptyPair = q.matching_pairs.some(pair => !pair.left.trim() || !pair.right.trim());
        if (hasEmptyPair) {
          setError(`Question ${i + 1}: All matching pairs must be filled`);
          return;
        }
      }
    }

    try {
      const token = localStorage.getItem('accessToken');
      const totalMarks = calculateTotalMarks();

      // Check if any questions have images
      const hasImages = questions.some(q => q.image);

      if (hasImages) {
        // Use FormData for multipart upload if images exist
        const formData = new FormData();

        // Prepare questions data without images
        const questionsData = questions.map(q => ({
          question_type: q.question_type,
          question: q.question,
          marks: parseFloat(q.marks),
          correct_answer: q.correct_answer || '',
          options: q.question_type === 'multiple_choice' ? q.options : undefined,
          matching_pairs: q.question_type === 'matching' ? q.matching_pairs : undefined
        }));

        // Add JSON data as a single field
        const testData = {
          subject_id: parseInt(selectedSubject),
          title: 'Test',
          assessment_type: 'test_1',
          duration_minutes: parseInt(testDuration),
          total_marks: totalMarks,
          questions: questionsData
        };

        formData.append('data', JSON.stringify(testData));

        // Add images with keys like 'image_1', 'image_2', etc.
        questions.forEach((q, index) => {
          if (q.image) {
            formData.append(`image_${index + 1}`, q.image);
          }
        });

        const response = await fetch('http://127.0.0.1:8000/api/academics/teacher/create-assessment/', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            // Don't set Content-Type - browser will set it with boundary for multipart
          },
          body: formData
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || JSON.stringify(errorData));
        }

        const data = await response.json();
        setSuccess('Test created successfully!');
      } else {
        // Use JSON for requests without images
        const testData = {
          subject_id: parseInt(selectedSubject),
          title: 'Test',
          assessment_type: 'test_1',
          duration_minutes: parseInt(testDuration),
          total_marks: totalMarks,
          questions: questions.map(q => ({
            question_type: q.question_type,
            question: q.question,
            marks: parseFloat(q.marks),
            correct_answer: q.correct_answer || '',
            options: q.question_type === 'multiple_choice' ? q.options : undefined,
            matching_pairs: q.question_type === 'matching' ? q.matching_pairs : undefined
          }))
        };

        const response = await fetch('http://127.0.0.1:8000/api/academics/teacher/create-assessment/', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(testData)
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || JSON.stringify(errorData));
        }

        const data = await response.json();
        setSuccess('Test created successfully!');
      }

      // Reset form
      setSelectedSubject('');
      setTestDuration('');
      setQuestions([getDefaultQuestionData('multiple_choice')]);

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  const renderQuestionTypeFields = (question, questionIndex) => {
    switch (question.question_type) {
      case 'multiple_choice':
        return (
          <div className="question-options">
            <label>Options:</label>
            {question.options.map((option, optionIndex) => (
              <div key={optionIndex} className="option-row">
                <span className="option-label">{option.label}</span>
                <input
                  type="text"
                  value={option.text}
                  onChange={(e) => handleOptionChange(questionIndex, optionIndex, 'text', e.target.value)}
                  placeholder={`Option ${option.label}`}
                  required
                />
                <label className="correct-checkbox">
                  <input
                    type="radio"
                    name={`correct-${questionIndex}`}
                    checked={option.is_correct}
                    onChange={(e) => handleOptionChange(questionIndex, optionIndex, 'is_correct', e.target.checked)}
                  />
                  <span>Correct</span>
                </label>
              </div>
            ))}
          </div>
        );

      case 'true_false':
        return (
          <div className="question-true-false">
            <label htmlFor={`correct-answer-${questionIndex}`}>Correct Answer:</label>
            <select
              id={`correct-answer-${questionIndex}`}
              value={question.correct_answer}
              onChange={(e) => handleQuestionChange(questionIndex, 'correct_answer', e.target.value)}
              required
            >
              <option value="">-- Select --</option>
              <option value="True">True</option>
              <option value="False">False</option>
            </select>
          </div>
        );

      case 'fill_blank':
      case 'essay':
        return (
          <div className="question-text-answer">
            <label htmlFor={`correct-answer-${questionIndex}`}>
              {question.question_type === 'essay' ? 'Marking Guide (Optional):' : 'Correct Answer:'}
            </label>
            <textarea
              id={`correct-answer-${questionIndex}`}
              value={question.correct_answer}
              onChange={(e) => handleQuestionChange(questionIndex, 'correct_answer', e.target.value)}
              placeholder={question.question_type === 'essay' ? 'Provide marking criteria...' : 'Enter the correct answer...'}
              rows="3"
              required={question.question_type === 'fill_blank'}
            />
          </div>
        );

      case 'matching':
        return (
          <div className="question-matching">
            <div className="matching-header">
              <label>Matching Pairs:</label>
              <button
                type="button"
                onClick={() => addMatchingPair(questionIndex)}
                className="add-pair-btn"
              >
                <Plus size={14} /> Add Pair
              </button>
            </div>
            {question.matching_pairs.map((pair, pairIndex) => (
              <div key={pairIndex} className="matching-pair-row">
                <input
                  type="text"
                  value={pair.left}
                  onChange={(e) => handleMatchingPairChange(questionIndex, pairIndex, 'left', e.target.value)}
                  placeholder="Left item"
                  required
                />
                <span className="arrow">→</span>
                <input
                  type="text"
                  value={pair.right}
                  onChange={(e) => handleMatchingPairChange(questionIndex, pairIndex, 'right', e.target.value)}
                  placeholder="Right item (match)"
                  required
                />
                {question.matching_pairs.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removeMatchingPair(questionIndex, pairIndex)}
                    className="remove-pair-btn"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        );

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="set-test-container">
        <div className="set-test-loading">Loading assigned subjects...</div>
      </div>
    );
  }

  // Get unique academic years and terms from sessions
  const uniqueYears = [...new Set(sessions.map(s => s.academic_year))];
  const uniqueTerms = [...new Set(sessions.map(s => s.term))];

  return (
    <div className="set-test-container">
      {error && (
        <div className="set-test-error">
          {error}
        </div>
      )}

      {success && (
        <div className="set-test-success">
          {success}
        </div>
      )}

      {!sessionSelected ? (
        <div className="session-filter-container">
          <h3>Select Academic Session</h3>
          <p>Choose the academic year and term for this test</p>

          <div className="session-filter-grid">
            <div className="session-filter-group">
              <label htmlFor="academicYear">Academic Year *</label>
              <select
                id="academicYear"
                value={selectedAcademicYear}
                onChange={(e) => setSelectedAcademicYear(e.target.value)}
                className="session-filter-select"
              >
                <option value="">-- Select Year --</option>
                {uniqueYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>

            <div className="session-filter-group">
              <label htmlFor="term">Term *</label>
              <select
                id="term"
                value={selectedTerm}
                onChange={(e) => setSelectedTerm(e.target.value)}
                className="session-filter-select"
              >
                <option value="">-- Select Term --</option>
                {uniqueTerms.map((term) => (
                  <option key={term} value={term}>
                    {term}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSessionConfirm}
            className="session-confirm-btn"
            disabled={!selectedAcademicYear || !selectedTerm}
          >
            Continue
          </button>
        </div>
      ) : (
        <>
          <div className="set-test-header">
            <h2>Create Test Questions</h2>
            <p>Build your test question bank with multiple question types</p>
          </div>

          <div className="selected-session-banner">
            <div>
              <strong>Selected Session:</strong> {selectedAcademicYear} - {selectedTerm}
            </div>
            <button
              type="button"
              onClick={handleChangeSession}
              className="change-session-btn"
            >
              Change Session
            </button>
          </div>

          <form onSubmit={handleSubmit} className="set-test-form">
        <div className="set-test-form-grid">
          <div className="set-test-form-group">
            <label htmlFor="subject">Select Subject *</label>
            <select
              id="subject"
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              required
            >
              <option value="">-- Select Subject --</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name} - {subject.className}
                </option>
              ))}
            </select>
          </div>

          <div className="set-test-form-group">
            <label htmlFor="testDuration">Duration (minutes) *</label>
            <input
              type="number"
              id="testDuration"
              value={testDuration}
              onChange={(e) => setTestDuration(e.target.value)}
              placeholder="e.g., 60"
              min="1"
              required
            />
          </div>
        </div>

        <div className="set-test-questions-section">
          <div className="set-test-questions-header">
            <h3>Questions</h3>
            <div className="question-actions-group">
              <button
                type="button"
                onClick={handleAddQuestion}
                className="set-test-add-question-btn"
              >
                <Plus size={16} />
                Add 1
              </button>
              <div className="bulk-add-group">
                <input
                  type="number"
                  value={bulkQuestionCount}
                  onChange={(e) => setBulkQuestionCount(e.target.value)}
                  placeholder="10"
                  min="1"
                  max="50"
                  className="bulk-question-input"
                />
                <button
                  type="button"
                  onClick={handleBulkAddQuestions}
                  className="set-test-add-question-btn"
                  disabled={!bulkQuestionCount || parseInt(bulkQuestionCount) <= 0 || parseInt(bulkQuestionCount) > 50}
                >
                  <Plus size={16} />
                  Add Multiple
                </button>
              </div>
            </div>
          </div>

          {questions.map((question, index) => (
            <div key={index} className="set-test-question-item">
              <div className="set-test-question-header">
                <span className="set-test-question-number">Question {index + 1}</span>
                {questions.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveQuestion(index)}
                    className="set-test-remove-question-btn"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>

              <div className="set-test-question-type-selector">
                <label htmlFor={`type-${index}`}>Question Type:</label>
                <select
                  id={`type-${index}`}
                  value={question.question_type}
                  onChange={(e) => handleQuestionTypeChange(index, e.target.value)}
                  className="question-type-select"
                >
                  <option value="multiple_choice">Multiple Choice</option>
                  <option value="true_false">True/False</option>
                  <option value="fill_blank">Fill in the Blanks</option>
                  <option value="essay">Essay/Short Answer</option>
                  <option value="matching">Matching</option>
                </select>
              </div>

              <div className="set-test-question-fields">
                <div className="set-test-question-field">
                  <label htmlFor={`question-${index}`}>Question Text *</label>
                  <textarea
                    id={`question-${index}`}
                    value={question.question}
                    onChange={(e) => handleQuestionChange(index, 'question', e.target.value)}
                    placeholder="Enter your question here..."
                    rows="3"
                    required
                  />
                </div>

                <div className="set-test-marks-field">
                  <label htmlFor={`marks-${index}`}>Marks *</label>
                  <input
                    type="number"
                    id={`marks-${index}`}
                    value={question.marks}
                    onChange={(e) => handleQuestionChange(index, 'marks', e.target.value)}
                    placeholder="10"
                    min="0.5"
                    step="0.5"
                    required
                  />
                </div>
              </div>

              {renderQuestionTypeFields(question, index)}

              <div className="set-test-image-field">
                <label htmlFor={`image-${index}`}>
                  Image (Optional - Max 100KB)
                </label>
                <input
                  type="file"
                  id={`image-${index}`}
                  accept="image/*"
                  onChange={(e) => handleImageChange(index, e.target.files[0])}
                  className="set-test-image-input"
                />
                {question.imagePreview && (
                  <div className="set-test-image-preview">
                    <img src={question.imagePreview} alt={`Question ${index + 1}`} />
                    <button
                      type="button"
                      onClick={() => handleImageChange(index, null)}
                      className="set-test-remove-image-btn"
                    >
                      Remove Image
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

          <div className="set-test-total-marks">
            <strong>Total Marks: {calculateTotalMarks()}</strong>
          </div>
        </div>

        <div className="set-test-form-actions">
          <button type="submit" className="set-test-submit-btn">
            <Save size={16} />
            Create Assessment
          </button>
        </div>
      </form>
        </>
      )}
    </div>
  );
};

export default SetTest;
