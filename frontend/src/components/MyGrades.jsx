import React, { useState, useEffect } from 'react';
import { BookOpen, Award, CheckCircle, Clock, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import './MyGrades.css';

const MyGrades = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [gradesData, setGradesData] = useState(null);
  const [expandedSubject, setExpandedSubject] = useState(null);
  
  // Filter states
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('');
  const [availableSessions, setAvailableSessions] = useState([]);

  useEffect(() => {
    fetchGrades();
  }, []);

  const fetchGrades = async (year = '', term = '') => {
    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken');
      
      // Build URL with optional filters
      let url = 'http://127.0.0.1:8000/api/schooladmin/student/grades/';
      const params = new URLSearchParams();
      if (year) params.append('academic_year', year);
      if (term) params.append('term', term);
      if (params.toString()) url += `?${params.toString()}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch grades');
      }

      const data = await response.json();
      setGradesData(data);
      setAvailableSessions(data.available_sessions || []);
      
      // Set initial filter values if not already set
      if (!selectedYear && data.academic_year) {
        setSelectedYear(data.academic_year);
      }
      if (!selectedTerm && data.term) {
        setSelectedTerm(data.term);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = () => {
    if (selectedYear && selectedTerm) {
      fetchGrades(selectedYear, selectedTerm);
    }
  };

  const toggleSubject = (subjectId) => {
    setExpandedSubject(expandedSubject === subjectId ? null : subjectId);
  };

  const getGradeColor = (percentage) => {
    if (percentage >= 90) return '#4caf50';
    if (percentage >= 80) return '#8bc34a';
    if (percentage >= 70) return '#ffc107';
    if (percentage >= 60) return '#ff9800';
    return '#f44336';
  };

  const getGradeLetter = (percentage) => {
    if (percentage >= 90) return 'A';
    if (percentage >= 80) return 'B';
    if (percentage >= 70) return 'C';
    if (percentage >= 60) return 'D';
    return 'F';
  };

  if (loading) {
    return (
      <div className="my-grades-container">
        <div className="loading-state">
          <Clock size={48} className="loading-icon" />
          <p>Loading your grades...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="my-grades-container">
        <div className="error-state">
          <p className="error-message">{error}</p>
          <button onClick={() => fetchGrades()} className="retry-btn">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="my-grades-container">
      <div className="grades-header">
        <h2>My Grades</h2>
        <div className="grades-session-info">
          {gradesData && (
            <span className="session-badge">
              {gradesData.academic_year} - {gradesData.term}
            </span>
          )}
        </div>
      </div>

      {/* Filters Section */}
      {availableSessions.length > 0 && (
        <div className="filters-section">
          <h3>Filter by Academic Session</h3>
          <div className="filters-grid">
            <div className="filter-group">
              <label>Academic Year</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
              >
                <option value="">Select Year</option>
                {[...new Set(availableSessions.map(s => s.academic_year))].map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label>Term</label>
              <select
                value={selectedTerm}
                onChange={(e) => setSelectedTerm(e.target.value)}
              >
                <option value="">Select Term</option>
                {[...new Set(availableSessions.map(s => s.term))].map(term => (
                  <option key={term} value={term}>{term}</option>
                ))}
              </select>
            </div>

            <button 
              className="filter-apply-btn"
              onClick={handleFilterChange}
              disabled={!selectedYear || !selectedTerm}
            >
              <RefreshCw size={18} />
              Apply Filter
            </button>
          </div>
        </div>
      )}

      {!gradesData || gradesData.subjects.length === 0 ? (
        <div className="empty-state">
          <BookOpen size={48} />
          <p>{gradesData?.message || 'No grades available yet'}</p>
        </div>
      ) : (
        <>
          <div className="grades-info-card">
            <h3>What You're Seeing</h3>
            <div className="info-grid">
              <div className="info-item">
                <CheckCircle size={20} />
                <div>
                  <strong>Attendance</strong>
                  <p>Your attendance score (out of {gradesData.grading_config.attendance_percentage}%)</p>
                </div>
              </div>
              <div className="info-item">
                <Award size={20} />
                <div>
                  <strong>Assignment Grades</strong>
                  <p>Released assignment scores from your teacher</p>
                </div>
              </div>
              <div className="info-item">
                <CheckCircle size={20} />
                <div>
                  <strong>Test & Exam Scores</strong>
                  <p>Results released by admin will appear below</p>
                </div>
              </div>
            </div>
          </div>

          <div className="subjects-grid">
            {gradesData.subjects.map(subject => {
              const isExpanded = expandedSubject === subject.subject_id;
              const hasAssignments = subject.assignment_count > 0;
              
              return (
                <div key={subject.subject_id} className="subject-card">
                  <div className="subject-card-header">
                    <div className="subject-info">
                      <div className="subject-title">
                        <BookOpen size={20} />
                        <h3>{subject.subject_name}</h3>
                      </div>
                      <p className="subject-meta">
                        {subject.teacher_name} • {subject.class_name}
                        {subject.department && subject.department !== 'General' && (
                          <span className="dept-badge">{subject.department}</span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="subject-card-body">
                    {/* Attendance Score */}
                    <div className="grade-section">
                      <div className="grade-header">
                        <span className="grade-label">Attendance</span>
                        <span className="grade-value">
                          {subject.attendance_score}/{subject.attendance_max}
                        </span>
                      </div>
                      <div className="progress-bar">
                        <div 
                          className="progress-fill"
                          style={{
                            width: `${subject.attendance_percentage}%`,
                            backgroundColor: getGradeColor(subject.attendance_percentage)
                          }}
                        />
                      </div>
                      <div className="grade-footer">
                        <span className="percentage">{subject.attendance_percentage}%</span>
                        <span 
                          className="letter-grade"
                          style={{ color: getGradeColor(subject.attendance_percentage) }}
                        >
                          {getGradeLetter(subject.attendance_percentage)}
                        </span>
                      </div>
                    </div>

                    {/* Assignment Grades */}
                    <div className="grade-section">
                      <div className="grade-header">
                        <span className="grade-label">
                          Assignments
                          {hasAssignments && (
                            <span className="assignment-count">
                              ({subject.assignment_count} graded)
                            </span>
                          )}
                        </span>
                        {hasAssignments && (
                          <span className="grade-value">
                            Average: {subject.assignment_average}%
                          </span>
                        )}
                      </div>

                      {hasAssignments ? (
                        <>
                          <div className="progress-bar">
                            <div 
                              className="progress-fill"
                              style={{
                                width: `${subject.assignment_average}%`,
                                backgroundColor: getGradeColor(subject.assignment_average)
                              }}
                            />
                          </div>
                          <div className="grade-footer">
                            <span className="percentage">{subject.assignment_average}%</span>
                            <span 
                              className="letter-grade"
                              style={{ color: getGradeColor(subject.assignment_average) }}
                            >
                              {getGradeLetter(subject.assignment_average)}
                            </span>
                          </div>

                          {/* Expandable Assignment Details */}
                          <button 
                            className="expand-btn"
                            onClick={() => toggleSubject(subject.subject_id)}
                          >
                            {isExpanded ? (
                              <>
                                <ChevronUp size={16} />
                                Hide Details
                              </>
                            ) : (
                              <>
                                <ChevronDown size={16} />
                                View Details
                              </>
                            )}
                          </button>

                          {isExpanded && (
                            <div className="assignment-details">
                              {subject.assignment_details.map((assignment, index) => (
                                <div key={index} className="assignment-item">
                                  <div className="assignment-header">
                                    <h4>{assignment.assignment_title}</h4>
                                    <span 
                                      className="assignment-score"
                                      style={{ color: getGradeColor(assignment.percentage) }}
                                    >
                                      {assignment.score}/{assignment.max_score}
                                    </span>
                                  </div>
                                  <div className="assignment-meta">
                                    <span className="percentage">
                                      {assignment.percentage}%
                                    </span>
                                    <span className="graded-date">
                                      Graded: {new Date(assignment.graded_at).toLocaleDateString()}
                                    </span>
                                  </div>
                                  {assignment.feedback && (
                                    <div className="assignment-feedback">
                                      <strong>Feedback:</strong>
                                      <p>{assignment.feedback}</p>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      ) : (
                        <p className="no-data">No assignment grades yet</p>
                      )}
                    </div>

                    {/* Test Scores */}
                    {subject.test_visible && (
                      <div className="grade-section">
                        <div className="grade-header">
                          <span className="grade-label">
                            Tests
                            {subject.test_count > 0 && (
                              <span className="assignment-count">
                                ({subject.test_count} test{subject.test_count !== 1 ? 's' : ''})
                              </span>
                            )}
                          </span>
                          {subject.test_count > 0 && (
                            <span className="grade-value">
                              Average: {subject.test_average}%
                            </span>
                          )}
                        </div>

                        {subject.test_count > 0 ? (
                          <>
                            <div className="progress-bar">
                              <div
                                className="progress-fill"
                                style={{
                                  width: `${subject.test_average}%`,
                                  backgroundColor: getGradeColor(subject.test_average)
                                }}
                              />
                            </div>
                            <div className="grade-footer">
                              <span className="percentage">{subject.test_average}%</span>
                              <span
                                className="letter-grade"
                                style={{ color: getGradeColor(subject.test_average) }}
                              >
                                {getGradeLetter(subject.test_average)}
                              </span>
                            </div>

                            {/* Expandable Test Details */}
                            <button
                              className="expand-btn"
                              onClick={() => toggleSubject('test_' + subject.subject_id)}
                            >
                              {expandedSubject === 'test_' + subject.subject_id ? (
                                <>
                                  <ChevronUp size={16} />
                                  Hide Details
                                </>
                              ) : (
                                <>
                                  <ChevronDown size={16} />
                                  View Details
                                </>
                              )}
                            </button>

                            {expandedSubject === 'test_' + subject.subject_id && (
                              <div className="assignment-details">
                                {subject.test_details.map((test, index) => (
                                  <div key={index} className="assignment-item">
                                    <div className="assignment-header">
                                      <h4>{test.test_title}</h4>
                                      <span
                                        className="assignment-score"
                                        style={{ color: getGradeColor(test.percentage) }}
                                      >
                                        {test.score}/{test.max_score}
                                      </span>
                                    </div>
                                    <div className="assignment-meta">
                                      <span className="test-type-badge">{test.test_type}</span>
                                      <span className="percentage">
                                        {test.percentage}%
                                      </span>
                                      {test.not_submitted && (
                                        <span className="not-submitted-badge">Not submitted</span>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </>
                        ) : (
                          <p className="no-data">No test scores yet</p>
                        )}
                      </div>
                    )}

                    {/* Exam Scores */}
                    {subject.exam_visible && (
                      <div className="grade-section">
                        <div className="grade-header">
                          <span className="grade-label">
                            Exams
                            {subject.exam_count > 0 && (
                              <span className="assignment-count">
                                ({subject.exam_count} exam{subject.exam_count !== 1 ? 's' : ''})
                              </span>
                            )}
                          </span>
                          {subject.exam_count > 0 && (
                            <span className="grade-value">
                              Average: {subject.exam_average}%
                            </span>
                          )}
                        </div>

                        {subject.exam_count > 0 ? (
                          <>
                            <div className="progress-bar">
                              <div
                                className="progress-fill"
                                style={{
                                  width: `${subject.exam_average}%`,
                                  backgroundColor: getGradeColor(subject.exam_average)
                                }}
                              />
                            </div>
                            <div className="grade-footer">
                              <span className="percentage">{subject.exam_average}%</span>
                              <span
                                className="letter-grade"
                                style={{ color: getGradeColor(subject.exam_average) }}
                              >
                                {getGradeLetter(subject.exam_average)}
                              </span>
                            </div>

                            {/* Expandable Exam Details */}
                            <button
                              className="expand-btn"
                              onClick={() => toggleSubject('exam_' + subject.subject_id)}
                            >
                              {expandedSubject === 'exam_' + subject.subject_id ? (
                                <>
                                  <ChevronUp size={16} />
                                  Hide Details
                                </>
                              ) : (
                                <>
                                  <ChevronDown size={16} />
                                  View Details
                                </>
                              )}
                            </button>

                            {expandedSubject === 'exam_' + subject.subject_id && (
                              <div className="assignment-details">
                                {subject.exam_details.map((exam, index) => (
                                  <div key={index} className="assignment-item">
                                    <div className="assignment-header">
                                      <h4>{exam.exam_title}</h4>
                                      <span
                                        className="assignment-score"
                                        style={{ color: getGradeColor(exam.percentage) }}
                                      >
                                        {exam.score}/{exam.max_score}
                                      </span>
                                    </div>
                                    <div className="assignment-meta">
                                      <span className="percentage">
                                        {exam.percentage}%
                                      </span>
                                      {exam.not_submitted && (
                                        <span className="not-submitted-badge">Not submitted</span>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </>
                        ) : (
                          <p className="no-data">No exam scores yet</p>
                        )}
                      </div>
                    )}

                    {/* Hidden Grades Notice - only show if no tests/exams released */}
                    {!subject.test_visible && !subject.exam_visible && (
                      <div className="hidden-grades-notice">
                        <Clock size={16} />
                        <span>Test and exam results will be released by admin</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export default MyGrades;