import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Clock, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react';
import './TakeAssessment.css';
import { useDialog } from '../contexts/DialogContext';

const TakeAssessment = () => {
  const { showConfirm } = useDialog();
  const { assessmentId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [assessment, setAssessment] = useState(location.state?.assessment || null);
  const [answers, setAnswers] = useState({});
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!assessment) {
      // Fetch assessment if not passed via state
      fetchAssessment();
    } else {
      // Initialize timer when assessment is loaded
      setTimeRemaining(assessment.duration_minutes * 60);
    }
  }, [assessment]);

  useEffect(() => {
    if (!hasStarted || timeRemaining <= 0) return;

    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [hasStarted, timeRemaining]);

  const fetchAssessment = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`http://127.0.0.1:8000/api/academics/student/assessments/`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch assessment');

      const data = await response.json();
      const foundAssessment = data.assessments.find(a => a.id === parseInt(assessmentId));

      if (!foundAssessment) {
        setError('Assessment not found or no longer available');
        return;
      }

      setAssessment(foundAssessment);
      setTimeRemaining(foundAssessment.duration_minutes * 60);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleStartAssessment = () => {
    setHasStarted(true);
  };

  const handleAnswerChange = (questionId, answer) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }));
  };

  const handleAutoSubmit = async () => {
    await handleSubmit(true);
  };

  const handleSubmit = async (isAutoSubmit = false) => {
    const confirmMessage = isAutoSubmit
      ? 'Time is up! Your answers will be submitted automatically.'
      : `Are you sure you want to submit your ${assessment.assessment_type === 'final_exam' ? 'exam' : 'test'}?\n\nYou have answered ${Object.keys(answers).length} out of ${assessment.questions?.length || 0} questions.`;

    if (!isAutoSubmit) {
      const confirmed = await showConfirm({
        title: `Submit ${assessment.assessment_type === 'final_exam' ? 'Exam' : 'Test'}`,
        message: confirmMessage,
        confirmText: 'Submit',
        cancelText: 'Cancel',
        confirmButtonClass: 'confirm-btn-primary'
      });
      if (!confirmed) return;
    }

    try {
      setIsSubmitting(true);
      const token = localStorage.getItem('accessToken');

      const response = await fetch(`http://127.0.0.1:8000/api/academics/student/assessments/${assessmentId}/submit/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          answers: answers,
          time_taken: (assessment.duration_minutes * 60) - timeRemaining
        })
      });

      if (!response.ok) throw new Error('Failed to submit assessment');

      const data = await response.json();

      // Navigate to results or back to assessments list
      navigate('/student-dashboard?tab=assessments', {
        state: {
          message: data.message || 'Assessment submitted successfully!',
          submissionId: data.submission_id
        }
      });
    } catch (err) {
      setError(err.message);
      alert('Error submitting assessment: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const getTimeWarningClass = () => {
    if (timeRemaining <= 60) return 'critical';
    if (timeRemaining <= 300) return 'warning';
    return '';
  };

  const getAnsweredCount = () => {
    return Object.keys(answers).length;
  };

  if (error) {
    return (
      <div className="take-assessment-error">
        <AlertCircle size={48} />
        <h2>Error</h2>
        <p>{error}</p>
        <button onClick={() => navigate('/student-dashboard?tab=assessments')}>
          Back to Assessments
        </button>
      </div>
    );
  }

  if (!assessment) {
    return <div className="take-assessment-loading">Loading assessment...</div>;
  }

  if (!hasStarted) {
    return (
      <div className="assessment-instructions">
        <button
          className="back-btn"
          onClick={() => navigate('/student-dashboard?tab=assessments')}
        >
          <ArrowLeft size={20} />
          Back
        </button>

        <div className="instructions-content">
          <h1>{assessment.title}</h1>
          <p className="assessment-subject">{assessment.subject_name} - {assessment.class_name}</p>

          <div className="assessment-info-grid">
            <div className="info-item">
              <Clock size={24} />
              <div>
                <strong>Duration</strong>
                <p>{assessment.duration_minutes} minutes</p>
              </div>
            </div>
            <div className="info-item">
              <CheckCircle size={24} />
              <div>
                <strong>Questions</strong>
                <p>{assessment.questions?.length || 0} questions</p>
              </div>
            </div>
            <div className="info-item">
              <AlertCircle size={24} />
              <div>
                <strong>Total Marks</strong>
                <p>{assessment.total_marks} marks</p>
              </div>
            </div>
          </div>

          <div className="instructions-box">
            <h3>Instructions</h3>
            <ul>
              <li>Read each question carefully before answering</li>
              <li>You have {assessment.duration_minutes} minutes to complete this assessment</li>
              <li>The timer will start when you click "Start Assessment"</li>
              <li>Your answers will be automatically submitted when time runs out</li>
              <li>Make sure to submit your assessment before leaving the page</li>
              <li>You cannot pause or restart once you begin</li>
            </ul>
          </div>

          <button className="start-assessment-btn" onClick={handleStartAssessment}>
            Start Assessment
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="take-assessment-container">
      {/* Header with Timer */}
      <div className="assessment-header-fixed">
        <div className="assessment-header-content">
          <div className="assessment-title-section">
            <h2>{assessment.title}</h2>
            <p>{assessment.subject_name}</p>
          </div>
          <div className={`timer-section ${getTimeWarningClass()}`}>
            <Clock size={20} />
            <span className="timer-text">{formatTime(timeRemaining)}</span>
          </div>
        </div>
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${(getAnsweredCount() / (assessment.questions?.length || 1)) * 100}%` }}
          />
        </div>
        <p className="progress-text">
          Answered: {getAnsweredCount()} / {assessment.questions?.length || 0}
        </p>
      </div>

      {/* Questions */}
      <div className="questions-container">
        {assessment.questions && assessment.questions.map((question, index) => (
          <div key={question.id} className="question-card">
            <div className="question-header-section">
              <span className="question-number">Question {index + 1}</span>
              <span className="question-marks">{question.marks} mark{question.marks !== 1 ? 's' : ''}</span>
            </div>

            <div className="question-text">{question.question_text}</div>

            {question.image_url && (
              <div className="question-image">
                <img
                  src={question.image_url.startsWith('http')
                    ? question.image_url
                    : `http://127.0.0.1:8000${question.image_url}`
                  }
                  alt={`Question ${index + 1}`}
                />
              </div>
            )}

            {/* Multiple Choice */}
            {question.question_type === 'multiple_choice' && question.options && (
              <div className="answer-options">
                {question.options.map((option) => (
                  <label key={option.id} className="option-label">
                    <input
                      type="radio"
                      name={`question-${question.id}`}
                      value={option.id}
                      checked={answers[question.id] === option.id}
                      onChange={(e) => handleAnswerChange(question.id, parseInt(e.target.value))}
                    />
                    <span className="option-text">
                      <strong>{option.option_label}.</strong> {option.option_text}
                    </span>
                  </label>
                ))}
              </div>
            )}

            {/* True/False */}
            {question.question_type === 'true_false' && (
              <div className="answer-options">
                <label className="option-label">
                  <input
                    type="radio"
                    name={`question-${question.id}`}
                    value="True"
                    checked={answers[question.id] === 'True'}
                    onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                  />
                  <span className="option-text">True</span>
                </label>
                <label className="option-label">
                  <input
                    type="radio"
                    name={`question-${question.id}`}
                    value="False"
                    checked={answers[question.id] === 'False'}
                    onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                  />
                  <span className="option-text">False</span>
                </label>
              </div>
            )}

            {/* Fill in the Blank / Essay */}
            {(question.question_type === 'fill_blank' || question.question_type === 'essay') && (
              <div className="answer-textarea-container">
                <textarea
                  className="answer-textarea"
                  placeholder="Type your answer here..."
                  rows={question.question_type === 'essay' ? 6 : 3}
                  value={answers[question.id] || ''}
                  onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                />
              </div>
            )}

            {/* Matching */}
            {question.question_type === 'matching' && question.matching_pairs && (
              <div className="matching-container">
                <p className="matching-instruction">Match the items by typing the correct letter</p>
                {question.matching_pairs.map((pair, pairIndex) => (
                  <div key={pair.id} className="matching-row">
                    <span className="matching-left">{pair.left_item}</span>
                    <input
                      type="text"
                      className="matching-input"
                      placeholder="Letter"
                      maxLength="1"
                      value={answers[`${question.id}_${pairIndex}`] || ''}
                      onChange={(e) => handleAnswerChange(`${question.id}_${pairIndex}`, e.target.value.toUpperCase())}
                    />
                  </div>
                ))}
                <div className="matching-options">
                  <p><strong>Options:</strong></p>
                  {question.matching_pairs.map((pair, idx) => (
                    <p key={idx}>{String.fromCharCode(65 + idx)}. {pair.right_item}</p>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Submit Button */}
      <div className="submit-section">
        <button
          className="submit-assessment-btn"
          onClick={() => handleSubmit(false)}
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Submitting...' : 'Submit Assessment'}
        </button>
      </div>
    </div>
  );
};

export default TakeAssessment;
