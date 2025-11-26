import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Select from 'react-select';
import { FileText } from 'lucide-react';
import ExamSubjectsModal from './ExamSubjectsModal';
import ExamStudentScoresModal from './ExamStudentScoresModal';
import API_BASE_URL from '../config';

import './DashboardExamsCard.css';

const termOptions = [
  { value: 'First Term', label: 'First Term' },
  { value: 'Second Term', label: 'Second Term' },
  { value: 'Third Term', label: 'Third Term' },
];

const getExamBarColor = (pct) => {
  if (pct < 40) return '#d32f2f';  // Red for poor completion
  if (pct < 60) return '#f9a825';  // Orange for fair completion
  if (pct < 80) return '#fbc02d';  // Yellow for good completion
  return '#388e3c';                // Green for excellent completion
};

const selectStyles = {
  control: (base) => ({
    ...base,
    fontSize: '0.95rem',
    color: '#222',
    backgroundColor: '#fff',
    borderColor: '#ccc',
  }),
  singleValue: (base) => ({
    ...base,
    color: '#222',
  }),
  placeholder: (base) => ({
    ...base,
    color: '#555',
  }),
  menu: (base) => ({
    ...base,
    fontSize: '0.95rem',
    color: '#222',
  }),
};

const DashboardExamsCard = () => {
  const [academicYears, setAcademicYears] = useState([]);
  const [selectedYear, setSelectedYear] = useState(null);
  const [selectedTerm, setSelectedTerm] = useState(termOptions[0]);
  const [classStats, setClassStats] = useState([]);
  const [isFiltered, setIsFiltered] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedClass, setSelectedClass] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState(null);

  const token = localStorage.getItem('accessToken');
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    const fetchYears = async () => {
      try {
        // First, get the current active session
        const sessionInfoRes = await axios.get(`${API_BASE_URL}/api/schooladmin/session/info/`, { headers });
        const currentYear = sessionInfoRes.data.academic_year;
        const currentTerm = sessionInfoRes.data.current_term;

        // Then get all available sessions
        const res = await axios.get(`${API_BASE_URL}/api/academics/sessions/`, { headers });
        if (Array.isArray(res.data)) {
          const years = [...new Set(res.data.map(s => s.academic_year))].sort();
          const options = years.map(y => ({ value: y, label: y }));
          setAcademicYears(options);

          // Set the current active session as default
          const currentYearOption = options.find(opt => opt.value === currentYear);
          if (currentYearOption) {
            setSelectedYear(currentYearOption);
            const currentTermOption = termOptions.find(opt => opt.value === currentTerm);
            if (currentTermOption) {
              setSelectedTerm(currentTermOption);
            }
          } else if (options.length > 0) {
            // Fallback to the last year if current year is not found
            setSelectedYear(options[options.length - 1]);
          }
        }
      } catch (err) {
        console.error('Error fetching academic years:', err);
        setError('Failed to load academic years');
      }
    };
    fetchYears();
  }, []);

  useEffect(() => {
    const fetchExamStats = async () => {
      if (!selectedYear || !selectedTerm || (window.innerWidth <= 768 && !isFiltered)) return;

      setLoading(true);
      setError('');

      try {
        const response = await axios.get(`${API_BASE_URL}/api/schooladmin/analytics/exams/`, {
          params: {
            academic_year: selectedYear.value,
            term: selectedTerm.value
          },
          headers
        });

        if (response.data.stats) {
          setClassStats(response.data.stats);

          if (response.data.stats.length === 0) {
            setError(`No exam data found for ${selectedYear.value} - ${selectedTerm.value}.`);
          }
        }

      } catch (err) {
        console.error('Error fetching exam stats:', err);
        setClassStats([]);
        if (err.response?.status === 404) {
          setError(`Exam data not found for ${selectedYear.value} - ${selectedTerm.value}.`);
        } else {
          setError('Failed to load exam completion data. Please try again.');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchExamStats();
  }, [selectedYear, selectedTerm, isFiltered]);

  const toggleFilters = () => {
    setIsFiltered(!isFiltered);
    if (!isFiltered) {
      setError('');
    }
  };

  const handleRetry = () => {
    setError('');
    setIsFiltered(prev => !prev);
    setTimeout(() => setIsFiltered(prev => !prev), 100);
  };

  const calculateOverallCompletion = () => {
    if (classStats.length === 0) return 0;
    const totalPossible = classStats.reduce((sum, cls) => sum + (cls.total_possible_submissions || cls.total_students), 0);
    const totalCompleted = classStats.reduce((sum, cls) => sum + cls.students_completed, 0);
    return totalPossible > 0 ? Math.round((totalCompleted / totalPossible) * 100) : 0;
  };

  const handleClassClick = (classData) => {
    setSelectedClass(classData);
  };

  const handleSubjectClick = (subjectData) => {
    setSelectedSubject(subjectData);
  };

  return (
    <div className={`exams-dashboard-wrapper ${isFiltered ? 'exams-filters-active' : ''}`}>
      <div className="dashboard-card exams-dashboard-card">
        <div className="exams-card-header">
          <FileText size={28} color="#8b5cf6" />
          <div>
            <h2>Exams Completed by Class</h2>
            <p>Track exam completion rates</p>
          </div>
        </div>

        <div className="exams-filters">
          <Select
            options={academicYears}
            value={selectedYear}
            onChange={setSelectedYear}
            placeholder="Year"
            styles={selectStyles}
            className="exams-filter-select"
          />
          <Select
            options={termOptions}
            value={selectedTerm}
            onChange={setSelectedTerm}
            placeholder="Term"
            styles={selectStyles}
            className="exams-filter-select"
          />
          <button
            className="exams-dashboard-filter-btn"
            onClick={toggleFilters}
          >
            Filter
          </button>
          <button
            className="exams-dashboard-close-btn"
            onClick={toggleFilters}
          >
            Close
          </button>
        </div>

        <ul className="exams-class-list">
          {loading ? (
            <li className="exams-no-data">Loading exam completion data...</li>
          ) : error ? (
            <li className="exams-error-data">
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <p style={{ color: '#d32f2f', marginBottom: '10px', fontWeight: '500' }}>
                  {error}
                </p>
                <button
                  onClick={handleRetry}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#1565c0',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.9rem'
                  }}
                >
                  Retry
                </button>
              </div>
            </li>
          ) : window.innerWidth <= 768 && !isFiltered ? (
            <li className="exams-no-data">Select filters and click 'Filter' to view data</li>
          ) : classStats.length === 0 ? (
            <li className="exams-no-data">
              {selectedYear && selectedTerm ?
                `No exam data available for ${selectedYear.label} - ${selectedTerm.label}` :
                'No exam data available'
              }
            </li>
          ) : (
            classStats.map(cls => (
              <li key={cls.class_id} onClick={() => handleClassClick(cls)}>
                <span className="exams-class-name">
                  {cls.class_name}
                  {cls.total_subjects === 0 && (
                    <span style={{ fontSize: '0.8rem', color: '#666', marginLeft: '8px' }}>
                      (No subjects)
                    </span>
                  )}
                </span>
                <div className="exams-progress-bar">
                  <div
                    className="exams-filled"
                    style={{
                      width: `${cls.completion_percentage}%`,
                      backgroundColor: getExamBarColor(cls.completion_percentage)
                    }}
                  />
                </div>
                <span className="exams-pct-label">{cls.completion_percentage}%</span>
              </li>
            ))
          )}
        </ul>

        {classStats.length > 0 && (
          <div className="exams-summary">
            <p className="exams-summary-text">
              Overall: {classStats.reduce((sum, cls) => sum + cls.students_completed, 0)} exam submissions out of{' '}
              {classStats.reduce((sum, cls) => sum + (cls.total_possible_submissions || cls.total_students), 0)} total possible
              {' '}({calculateOverallCompletion()}%)
            </p>
            <p style={{ fontSize: '0.85rem', color: '#666', marginTop: '5px' }}>
              Showing data for {selectedYear?.label} - {selectedTerm?.label}
            </p>
          </div>
        )}
      </div>

      {selectedClass && (
        <ExamSubjectsModal
          classData={selectedClass}
          onClose={() => setSelectedClass(null)}
          onSubjectClick={handleSubjectClick}
        />
      )}

      {selectedSubject && (
        <ExamStudentScoresModal
          subjectData={selectedSubject}
          onClose={() => setSelectedSubject(null)}
        />
      )}
    </div>
  );
};

export default DashboardExamsCard;
