// src/components/ReportSheet.jsx
import React, { useState, useEffect } from 'react';
import { FileText, Filter, Search, Printer, Download, Loader } from 'lucide-react';
import './ReportSheet.css';

const ReportSheet = () => {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');

  // Filter states
  const [academicYears, setAcademicYears] = useState([]);
  const [terms, setTerms] = useState([]);
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);

  // Selected filters
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);

  // Report data
  const [reportData, setReportData] = useState(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (selectedYear && selectedTerm) {
      fetchStudents();
    }
  }, [selectedYear, selectedTerm, selectedClass]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken');

      // Fetch sessions for academic years and terms
      const sessionResponse = await fetch('http://127.0.0.1:8000/api/academics/sessions/', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (sessionResponse.ok) {
        const sessionData = await sessionResponse.json();
        const uniqueYears = [...new Set(sessionData.map(s => s.academic_year))].sort().reverse();
        const uniqueTerms = [...new Set(sessionData.map(s => s.term))];
        setAcademicYears(uniqueYears);
        setTerms(uniqueTerms);
      }

      // Fetch classes
      const classResponse = await fetch('http://127.0.0.1:8000/api/academics/classes/', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (classResponse.ok) {
        const classData = await classResponse.json();
        setClasses(classData);
      }

    } catch (error) {
      showMessage('Error fetching initial data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchStudents = async () => {
    try {
      const token = localStorage.getItem('accessToken');

      // Build query params - class_id is optional
      let url = `http://127.0.0.1:8000/api/schooladmin/reports/students/?academic_year=${selectedYear}&term=${selectedTerm}`;
      if (selectedClass) {
        url += `&class_id=${selectedClass}`;
      }

      const response = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });

      if (response.ok) {
        const data = await response.json();
        setStudents(data.students || []);
      }
    } catch (error) {
      console.error('Error fetching students:', error);
    }
  };

  const showMessage = (text, type) => {
    setMessage(text);
    setMessageType(type);
    setTimeout(() => {
      setMessage('');
      setMessageType('');
    }, 5000);
  };

  const fetchReportSheet = async (studentId) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken');

      const response = await fetch(
        `http://127.0.0.1:8000/api/schooladmin/reports/student/${studentId}/?academic_year=${selectedYear}&term=${selectedTerm}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      if (response.ok) {
        const data = await response.json();
        setReportData(data);
        showMessage('Report sheet loaded successfully', 'success');
      } else {
        const errorData = await response.json();
        showMessage(errorData.detail || 'Error fetching report sheet', 'error');
        setReportData(null);
      }

    } catch (error) {
      showMessage('Error fetching report sheet', 'error');
      setReportData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleStudentSelect = (student) => {
    setSelectedStudent(student);
    fetchReportSheet(student.id);
  };

  const handleDownload = async () => {
    if (!selectedStudent || !selectedYear || !selectedTerm) {
      alert('Please select a student and ensure filters are set');
      return;
    }

    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(
        `http://127.0.0.1:8000/api/schooladmin/reports/student/${selectedStudent.id}/download/?academic_year=${selectedYear}&term=${selectedTerm}`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `report_${selectedStudent.username}_${selectedYear}_${selectedTerm}.pdf`;
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

  const filteredStudents = students.filter(student =>
    student.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    student.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="report-sheet-container">
      <div className="report-sheet-header no-print">
        <FileText size={32} />
        <div>
          <h2>Report Sheets</h2>
          <p>Generate and view student report sheets</p>
        </div>
      </div>

      {message && (
        <div className={`report-message ${messageType} no-print`}>
          {message}
        </div>
      )}

      {/* Filters Section */}
      <div className="report-filters-section no-print">
        <div className="filters-header">
          <Filter size={20} />
          <h3>Filter Options</h3>
        </div>

        <div className="filters-grid">
          <div className="form-group">
            <label>Academic Year *</label>
            <select
              value={selectedYear}
              onChange={(e) => {
                setSelectedYear(e.target.value);
                setReportData(null);
                setSelectedStudent(null);
              }}
            >
              <option value="">Select Academic Year</option>
              {academicYears.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Term *</label>
            <select
              value={selectedTerm}
              onChange={(e) => {
                setSelectedTerm(e.target.value);
                setReportData(null);
                setSelectedStudent(null);
              }}
            >
              <option value="">Select Term</option>
              {terms.map(term => (
                <option key={term} value={term}>{term}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Class (Optional)</label>
            <select
              value={selectedClass}
              onChange={(e) => {
                setSelectedClass(e.target.value);
                setReportData(null);
                setSelectedStudent(null);
              }}
            >
              <option value="">All Classes</option>
              {classes.map(cls => (
                <option key={cls.id} value={cls.id}>{cls.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Student Search */}
        {selectedYear && selectedTerm && students.length > 0 && (
          <div className="student-search-section">
            <div className="search-box">
              <Search size={20} />
              <input
                type="text"
                placeholder="Search student by name or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            {selectedClass && (
              <p style={{ marginTop: '8px', fontSize: '0.9rem', color: '#666' }}>
                Filtered by class. Remove class filter to search all students.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Students List */}
      {selectedYear && selectedTerm && students.length > 0 && !reportData && !loading && (
        <div className="students-list-section no-print">
          <div className="students-list-header">
            <h3>Students ({filteredStudents.length})</h3>
            <p>Click on a student to view their report sheet{selectedClass ? ' (filtered by class)' : ''}</p>
          </div>
          <div className="students-grid">
            {filteredStudents.map(student => (
              <div
                key={student.id}
                className="student-card"
                onClick={() => handleStudentSelect(student)}
              >
                <div className="student-card-content">
                  <div className="student-avatar">
                    {student.first_name.charAt(0)}{student.last_name.charAt(0)}
                  </div>
                  <div className="student-info">
                    <h4>{student.full_name}</h4>
                    <p>{student.username}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="report-loading no-print">
          <Loader size={48} className="spinner" />
          <p>Loading report sheet...</p>
        </div>
      )}

      {/* Report Sheet Display */}
      {reportData && !loading && (
        <>
          <div className="report-actions no-print">
            <button
              className="back-btn"
              onClick={() => {
                setReportData(null);
                setSelectedStudent(null);
              }}
            >
              ← Back to Students List
            </button>
            <button className="print-btn" onClick={handleDownload}>
              <Printer size={18} />
              Download Report
            </button>
          </div>

          <div className="report-card">
            {/* Header */}
            <div className="report-header">
              <div className="school-logo">
                <img src="/logo.png" alt="School Logo" />
              </div>
              <h1 className="school-name">Figil High School</h1>
              <h2 className="report-title">Student Result Management System</h2>
              <p className="report-term">
                Term {reportData.session.term === 'First Term' ? 'ONE' : reportData.session.term === 'Second Term' ? 'TWO' : 'THREE'} ({reportData.session.academic_year} Academic Session Report)
              </p>
            </div>

            {/* Student Info */}
            <div className="student-info-section">
              <div className="student-details">
                <div className="detail-row-compact">
                  <div className="detail-item">
                    <span className="detail-label">Student ID:</span>
                    <span className="detail-value">{reportData.student.student_id}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Student Name:</span>
                    <span className="detail-value">{reportData.student.name}</span>
                  </div>
                </div>
                <div className="detail-row-compact">
                  <div className="detail-item">
                    <span className="detail-label">Class:</span>
                    <span className="detail-value">{reportData.student.class}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Department:</span>
                    <span className="detail-value">{reportData.student.department || ''}</span>
                  </div>
                </div>
              </div>
              <div className="passport-photo">
                {reportData.student.photo_url ? (
                  <img src={reportData.student.photo_url} alt="Student" />
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
                    <th>1st Test<br />({reportData.grading_config.first_test_max}marks)</th>
                    <th>2nd Test<br />({reportData.grading_config.second_test_max}marks)</th>
                    <th>Exam<br />({reportData.grading_config.exam_max}marks)</th>
                    <th>Total<br />({reportData.grading_config.total_max}marks)</th>
                    <th>Grades</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.subjects.map((subject, index) => (
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
                    <td className="summary-value">{reportData.summary.grand_total}</td>
                    <td></td>
                  </tr>
                  <tr className="summary-row">
                    <td className="summary-label">Average</td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td className="summary-value">{reportData.summary.average}</td>
                    <td></td>
                  </tr>
                  <tr className="summary-row position-row">
                    <td className="summary-label">Position</td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td className="summary-value">
                      {reportData.summary.position ? `${reportData.summary.position} of ${reportData.summary.total_students}` : '-'}
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
        </>
      )}

      {/* Empty State */}
      {!reportData && !loading && selectedYear && selectedTerm && students.length === 0 && (
        <div className="report-empty-state no-print">
          <FileText size={64} />
          <h3>No Students Found</h3>
          <p>No students enrolled for the selected academic year and term{selectedClass ? ' and class' : ''}</p>
        </div>
      )}
    </div>
  );
};

export default ReportSheet;
