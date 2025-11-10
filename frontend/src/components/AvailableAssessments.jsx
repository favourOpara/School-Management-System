import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, BookOpen, FileText, AlertCircle } from 'lucide-react';
import './AvailableAssessments.css';

const AvailableAssessments = () => {
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchAvailableAssessments();
  }, []);

  const fetchAvailableAssessments = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken');

      const response = await fetch('http://127.0.0.1:8000/api/academics/student/assessments/', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch assessments');
      }

      const data = await response.json();
      setAssessments(data.assessments || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStartAssessment = (assessment) => {
    // Navigate to take assessment page with assessment ID
    navigate(`/student-dashboard/take-assessment/${assessment.id}`, {
      state: { assessment }
    });
  };

  const getAssessmentTypeLabel = (type) => {
    const labels = {
      'test_1': 'Test 1',
      'test_2': 'Test 2',
      'mid_term': 'Mid-Term Exam',
      'final_exam': 'Final Exam'
    };
    return labels[type] || type;
  };

  const getAssessmentTypeClass = (type) => {
    if (type === 'final_exam') return 'exam';
    return 'test';
  };

  if (loading) {
    return <div className="assessments-loading">Loading available assessments...</div>;
  }

  if (error) {
    return (
      <div className="assessments-error">
        <AlertCircle size={20} />
        {error}
      </div>
    );
  }

  return (
    <div className="available-assessments-container">
      <div className="assessments-header">
        <h2>Available Tests & Exams</h2>
        <p>Click on any assessment to begin</p>
      </div>

      {assessments.length === 0 ? (
        <div className="no-assessments">
          <FileText size={48} />
          <h3>No Assessments Available</h3>
          <p>You have no tests or exams available at the moment. Check back later!</p>
        </div>
      ) : (
        <div className="assessments-grid">
          {assessments.map(assessment => (
            <div
              key={assessment.id}
              className={`assessment-card ${getAssessmentTypeClass(assessment.assessment_type)}`}
              onClick={() => handleStartAssessment(assessment)}
            >
              <div className="assessment-card-header">
                <span className={`assessment-type-badge ${getAssessmentTypeClass(assessment.assessment_type)}`}>
                  {getAssessmentTypeLabel(assessment.assessment_type)}
                </span>
                <span className="assessment-subject">{assessment.subject_name}</span>
              </div>

              <div className="assessment-card-body">
                <h3>{assessment.title}</h3>
                <p className="assessment-class">{assessment.class_name}</p>

                <div className="assessment-details">
                  <div className="detail-item">
                    <Clock size={16} />
                    <span>{assessment.duration_minutes} minutes</span>
                  </div>
                  <div className="detail-item">
                    <BookOpen size={16} />
                    <span>{assessment.question_count} questions</span>
                  </div>
                  <div className="detail-item">
                    <FileText size={16} />
                    <span>{assessment.total_marks} marks</span>
                  </div>
                </div>
              </div>

              <div className="assessment-card-footer">
                <button className="start-btn">
                  Start {assessment.assessment_type === 'final_exam' ? 'Exam' : 'Test'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AvailableAssessments;
