// src/components/ParentGradeReport.jsx
import React, { useState, useEffect } from 'react';
import { FileText, Users, BookOpen, Calendar, Printer, Loader } from 'lucide-react';
import API_BASE_URL from '../config';

import './ParentGradeReport.css';

const ParentGradeReport = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reportData, setReportData] = useState(null);

  // Selected filters
  const [selectedChild, setSelectedChild] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('');

  useEffect(() => {
    fetchGradeReport();
  }, []);

  useEffect(() => {
    if (selectedChild || selectedYear || selectedTerm) {
      fetchGradeReport();
    }
  }, [selectedChild, selectedYear, selectedTerm]);

  const fetchGradeReport = async () => {
    try {
      setLoading(true);
      setError('');
      const token = localStorage.getItem('accessToken');

      // Build query params
      let url = `${API_BASE_URL}/api/users/parent/grade-report/`;
      const params = new URLSearchParams();
      if (selectedChild) params.append('child_id', selectedChild);
      if (selectedYear) params.append('academic_year', selectedYear);
      if (selectedTerm) params.append('term', selectedTerm);
      if (params.toString()) url += `?${params.toString()}`;

      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setReportData(data);

        // Set defaults if not already set
        if (!selectedChild && data.student) {
          setSelectedChild(data.student.id);
        }
        if (!selectedYear && data.session) {
          setSelectedYear(data.session.academic_year);
        }
        if (!selectedTerm && data.session) {
          setSelectedTerm(data.session.term);
        }
      } else if (response.status === 403) {
        // Grades are incomplete - show specific message but keep filter data
        const errorData = await response.json();
        setError(errorData.detail || 'Report sheet is not available. Grades are incomplete.');
        // Store filter data even though grades are incomplete
        setReportData({
          children: errorData.children || [],
          available_sessions: errorData.available_sessions || []
        });

        // Set defaults if not already set
        if (!selectedChild && errorData.children && errorData.children.length > 0) {
          setSelectedChild(errorData.children[0].id);
        }
        if (!selectedYear && errorData.available_sessions && errorData.available_sessions.length > 0) {
          setSelectedYear(errorData.available_sessions[0].academic_year);
        }
        if (!selectedTerm && errorData.available_sessions && errorData.available_sessions.length > 0) {
          setSelectedTerm(errorData.available_sessions[0].term);
        }
      } else {
        const errorData = await response.json();
        setError(errorData.detail || 'Error fetching grade report');
        setReportData(null);
      }
    } catch (error) {
      console.error('Error:', error);
      setError('Failed to load grade report');
      setReportData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!reportData || !reportData.student || !selectedYear || !selectedTerm) {
      alert('Please wait for report to load and ensure filters are set');
      return;
    }

    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(
        `${API_BASE_URL}/api/schooladmin/reports/student/${reportData.student.id}/download/?academic_year=${selectedYear}&term=${selectedTerm}`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `report_${reportData.student.username}_${selectedYear}_${selectedTerm}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        const errorData = await response.json();
        alert(errorData.detail || 'Failed to download report');
      }
    } catch (error) {
      console.error('Error downloading report:', error);
      alert('Failed to download report');
    }
  };

  const { student, session, grading_config, subjects, summary, children, available_sessions } = reportData || {};

  return (
    <div className="parent-grade-container">
      <div className="parent-grade-header no-print">
        <FileText size={32} color="#0ea5e9" />
        <div>
          <h2>Grade Report</h2>
          <p>View your child's academic performance</p>
        </div>
      </div>

      {/* Filters - Always visible */}
      <div className="grade-filters no-print">
        {children && children.length > 1 && (
          <div className="filter-group">
            <label>
              <Users size={18} />
              Select Child
            </label>
            <select
              value={selectedChild}
              onChange={(e) => setSelectedChild(e.target.value)}
            >
              {children.map(c => (
                <option key={c.id} value={c.id}>
                  {c.full_name} ({c.username})
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="filter-group">
          <label>
            <BookOpen size={18} />
            Academic Year
          </label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
          >
            {available_sessions && [...new Set(available_sessions.map(s => s.academic_year))].map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>
            <Calendar size={18} />
            Term
          </label>
          <select
            value={selectedTerm}
            onChange={(e) => setSelectedTerm(e.target.value)}
          >
            {available_sessions && [...new Set(available_sessions.map(s => s.term))].map(term => (
              <option key={term} value={term}>{term}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="parent-grade-loading">
          <Loader size={48} className="spinner" />
          <p>Loading grade report...</p>
        </div>
      )}

      {/* Error State - Show below filters */}
      {!loading && error && (
        <div className="parent-grade-error">
          <FileText size={64} />
          <h3>Report Not Available</h3>
          <p>{error}</p>
          {available_sessions && available_sessions.length > 0 && (
            <p style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#6b7280' }}>
              Try selecting a different academic year or term above.
            </p>
          )}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && !reportData && (
        <div className="parent-grade-empty">
          <FileText size={64} />
          <h3>No Grade Data</h3>
          <p>No grade data available</p>
        </div>
      )}

      {/* Download Button - Only show when report data is available */}
      {!loading && !error && reportData && (
        <div className="download-section">
          <button className="download-report-btn" onClick={handleDownload}>
            <Printer size={20} />
            Download Report
          </button>
        </div>
      )}

      {/* Grade Summary - Only show when report data is available */}
      {!loading && !error && reportData && (
        <div className="grade-summary-card">
          <h3>Grade Summary</h3>
          <div className="summary-stats">
            <div className="stat-card">
              <div className="stat-icon">%</div>
              <div className="stat-content">
                <span className="stat-label">Average Score</span>
                <span className="stat-value">{summary.average}%</span>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">#</div>
              <div className="stat-content">
                <span className="stat-label">Class Position</span>
                <span className="stat-value">{summary.position} of {summary.total_students}</span>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">Σ</div>
              <div className="stat-content">
                <span className="stat-label">Grand Total</span>
                <span className="stat-value">{summary.grand_total}</span>
              </div>
            </div>
          </div>
          <div className="subjects-summary">
            <h4>Subject Scores</h4>
            <div className="subjects-grid">
              {subjects.map((subject, index) => (
                <div key={index} className="subject-item">
                  <div className="subject-name-sum">{subject.subject_name}</div>
                  <div className="subject-score-sum">
                    <span className="score-num">{subject.total_score}</span>
                    <span className="grade-badge">{subject.letter_grade}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Report Card - Hidden, only for printing - Only render when report data exists */}
      {!loading && !error && reportData && (
        <div className="report-card-wrapper" style={{ display: 'none' }}>
          {/* Report Card */}
          <div className="report-card">
        {/* Header */}
        <div className="report-header">
          <div className="school-logo">
            <img src="/logo.png" alt="School Logo" />
          </div>
          <h1 className="school-name">Figil High School</h1>
          <h2 className="report-title">Student Result Management System</h2>
          <p className="report-term">
            Term {session.term === 'First Term' ? 'ONE' : session.term === 'Second Term' ? 'TWO' : 'THREE'} ({session.academic_year} Academic Session Report)
          </p>
        </div>

        {/* Student Info */}
        <div className="student-info-section">
          <div className="student-details">
            <div className="detail-row-compact">
              <div className="detail-item">
                <span className="detail-label">Student ID:</span>
                <span className="detail-value">{student.student_id}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Student Name:</span>
                <span className="detail-value">{student.name}</span>
              </div>
            </div>
            <div className="detail-row-compact">
              <div className="detail-item">
                <span className="detail-label">Class:</span>
                <span className="detail-value">{student.class}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Department:</span>
                <span className="detail-value">{student.department || ''}</span>
              </div>
            </div>
          </div>
          <div className="passport-photo">
            {student.photo_url ? (
              <img src={student.photo_url} alt="Student" />
            ) : (
              <div className="photo-placeholder">
                <span>Passport Photo</span>
              </div>
            )}
          </div>
        </div>

        {/* Grades Table */}
        <div className="grades-table-container">
          <table className="grades-table">
            <thead>
              <tr>
                <th>Subjects</th>
                <th>1st Test<br />({grading_config.first_test_max}marks)</th>
                <th>2nd Test<br />({grading_config.second_test_max}marks)</th>
                <th>Exam<br />({grading_config.exam_max}marks)</th>
                <th>Total<br />({grading_config.total_max}marks)</th>
                <th>Grades</th>
              </tr>
            </thead>
            <tbody>
              {subjects.map((subject, index) => (
                <tr key={index}>
                  <td className="subject-name">{subject.subject_name}</td>
                  <td className="score">{subject.first_test_score}</td>
                  <td className="score">{subject.second_test_score}</td>
                  <td className="score">{subject.exam_score}</td>
                  <td className="score total">{subject.total_score}</td>
                  <td className="grade">{subject.letter_grade}</td>
                </tr>
              ))}
              <tr className="summary-row">
                <td className="summary-label">Grand Total</td>
                <td></td>
                <td></td>
                <td></td>
                <td className="summary-value">{summary.grand_total}</td>
                <td></td>
              </tr>
              <tr className="summary-row">
                <td className="summary-label">Average</td>
                <td></td>
                <td></td>
                <td></td>
                <td className="summary-value">{summary.average}</td>
                <td></td>
              </tr>
              <tr className="summary-row position-row">
                <td className="summary-label">Position</td>
                <td></td>
                <td></td>
                <td></td>
                <td className="summary-value">
                  {summary.position ? `${summary.position} of ${summary.total_students}` : '-'}
                </td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="report-footer">
          <p>Generated on {new Date().toLocaleString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
          }).replace(/(\d+)\/(\d+)\/(\d+),/, '$2/$1/$3,')}</p>
        </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ParentGradeReport;
