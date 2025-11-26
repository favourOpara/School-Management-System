import React, { useState, useEffect } from 'react';
import { BookOpen, Award, CheckCircle, Clock, RefreshCw } from 'lucide-react';
import './MyGrades.css';

const MyGrades = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [gradesData, setGradesData] = useState(null);
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

  const getGradeColor = (percentage) => {
    if (!gradesData?.grading_scale) {
      // Fallback if no scale data
      if (percentage >= 90) return '#4caf50';
      if (percentage >= 80) return '#8bc34a';
      if (percentage >= 70) return '#ffc107';
      if (percentage >= 60) return '#ff9800';
      return '#f44336';
    }

    const scale = gradesData.grading_scale;
    if (percentage >= scale.a_min) return '#4caf50';
    if (percentage >= scale.b_min) return '#8bc34a';
    if (percentage >= scale.c_min) return '#ffc107';
    if (percentage >= scale.d_min) return '#ff9800';
    return '#f44336';
  };

  const getGradeLetter = (percentage) => {
    if (!gradesData?.grading_scale) {
      // Fallback if no scale data
      if (percentage >= 90) return 'A';
      if (percentage >= 80) return 'B';
      if (percentage >= 70) return 'C';
      if (percentage >= 60) return 'D';
      return 'F';
    }

    const scale = gradesData.grading_scale;
    if (percentage >= scale.a_min) return 'A';
    if (percentage >= scale.b_min) return 'B';
    if (percentage >= scale.c_min) return 'C';
    if (percentage >= scale.d_min) return 'D';
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
        <h2><Award size={28} /> Grade Check 📊</h2>
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
              const hasAssignments = subject.assignment_count > 0;

              // Calculate scores for display
              const attendanceScore = subject.attendance_score || 0;
              const assignmentScore = hasAssignments
                ? ((subject.assignment_average / 100) * gradesData.grading_config.assignment_percentage).toFixed(1)
                : 0;

              let testScore = 0;
              if (subject.manual_test_visible) {
                testScore = subject.manual_test_score || 0;
              } else if (subject.test_visible && subject.test_count > 0) {
                testScore = ((subject.test_average / 100) * gradesData.grading_config.test_percentage).toFixed(1);
              }

              let examScore = 0;
              if (subject.manual_exam_visible) {
                examScore = subject.manual_exam_score || 0;
              } else if (subject.exam_visible && subject.exam_count > 0) {
                examScore = ((subject.exam_average / 100) * gradesData.grading_config.exam_percentage).toFixed(1);
              }

              const totalScore = (
                parseFloat(attendanceScore) +
                parseFloat(assignmentScore) +
                parseFloat(testScore) +
                parseFloat(examScore)
              ).toFixed(1);

              return (
                <div key={subject.subject_id} className="subject-grade-tile">
                  {/* Subject Title Header */}
                  <div className="tile-header">
                    <h3>{subject.subject_name}</h3>
                    {subject.department && subject.department !== 'General' && (
                      <span className="tile-dept-badge">{subject.department}</span>
                    )}
                  </div>

                  {/* Teacher Info */}
                  <div className="tile-teacher">
                    {subject.teacher_name}
                  </div>

                  {/* Scores Table */}
                  <div className="scores-table">
                    <div className="score-row">
                      <span className="score-label">Attendance</span>
                      <span className="score-value">{attendanceScore}</span>
                      <span className="score-max">/ {subject.attendance_max}</span>
                    </div>

                    <div className="score-row">
                      <span className="score-label">Assignment</span>
                      <span className="score-value">
                        {hasAssignments ? assignmentScore : '-'}
                      </span>
                      <span className="score-max">/ {gradesData.grading_config.assignment_percentage}</span>
                    </div>

                    <div className="score-row">
                      <span className="score-label">Test</span>
                      <span className="score-value">
                        {(subject.test_visible || subject.manual_test_visible) ? testScore : '-'}
                      </span>
                      <span className="score-max">/ {gradesData.grading_config.test_percentage}</span>
                    </div>

                    <div className="score-row">
                      <span className="score-label">Exam</span>
                      <span className="score-value">
                        {(subject.exam_visible || subject.manual_exam_visible) ? examScore : '-'}
                      </span>
                      <span className="score-max">/ {gradesData.grading_config.exam_percentage}</span>
                    </div>
                  </div>

                  {/* Total Score */}
                  <div className="tile-total">
                    <span className="total-label">Total</span>
                    <span
                      className="total-value"
                      style={{ color: getGradeColor(totalScore) }}
                    >
                      {totalScore}
                    </span>
                    <span className="total-grade">
                      {getGradeLetter(totalScore)}
                    </span>
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