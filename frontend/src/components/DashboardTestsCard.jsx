import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Select from 'react-select';
import { ClipboardList } from 'lucide-react';
import TestSubjectsModal from './TestSubjectsModal';
import TestStudentScoresModal from './TestStudentScoresModal';
import './DashboardTestsCard.css';
import { useDialog } from '../contexts/DialogContext';

const termOptions = [
  { value: 'First Term', label: 'First Term' },
  { value: 'Second Term', label: 'Second Term' },
  { value: 'Third Term', label: 'Third Term' },
];

const getTestBarColor = (pct) => {
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

const DashboardTestsCard = () => {
  const { showConfirm, showAlert } = useDialog();
  const [academicYears, setAcademicYears] = useState([]);
  const [selectedYear, setSelectedYear] = useState(null);
  const [selectedTerm, setSelectedTerm] = useState(termOptions[0]);
  const [classStats, setClassStats] = useState([]);
  const [isFiltered, setIsFiltered] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedClass, setSelectedClass] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [unlocking, setUnlocking] = useState(false);

  const token = localStorage.getItem('accessToken');
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    const fetchYears = async () => {
      try {
        // First, get the current active session
        const sessionInfoRes = await axios.get('http://127.0.0.1:8000/api/schooladmin/session/info/', { headers });
        const currentYear = sessionInfoRes.data.academic_year;
        const currentTerm = sessionInfoRes.data.current_term;

        // Then get all available sessions
        const res = await axios.get('http://127.0.0.1:8000/api/academics/sessions/', { headers });
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
    const fetchTestStats = async () => {
      if (!selectedYear || !selectedTerm || (window.innerWidth <= 768 && !isFiltered)) return;

      setLoading(true);
      setError('');

      try {
        const response = await axios.get('http://127.0.0.1:8000/api/schooladmin/analytics/tests/', {
          params: {
            academic_year: selectedYear.value,
            term: selectedTerm.value
          },
          headers
        });

        if (response.data.stats) {
          setClassStats(response.data.stats);

          if (response.data.stats.length === 0) {
            setError(`No test data found for ${selectedYear.value} - ${selectedTerm.value}.`);
          }
        }

      } catch (err) {
        console.error('Error fetching test stats:', err);
        setClassStats([]);
        if (err.response?.status === 404) {
          setError(`Test data not found for ${selectedYear.value} - ${selectedTerm.value}.`);
        } else {
          setError('Failed to load test completion data. Please try again.');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchTestStats();
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

  const handleUnlockAll = async () => {
    if (!selectedYear || !selectedTerm) {
      showAlert({
        type: 'warning',
        message: 'Please select academic year and term first'
      });
      return;
    }

    const confirmed = await showConfirm({
      title: 'Unlock All Test Scores',
      message: `Are you sure you want to unlock ALL test scores for ${selectedYear.label} - ${selectedTerm.label}? Students will be able to see their results.`,
      confirmText: 'Unlock All',
      cancelText: 'Cancel',
      confirmButtonClass: 'confirm-btn-warning'
    });
    if (!confirmed) return;

    try {
      setUnlocking(true);

      await axios.post(
        'http://127.0.0.1:8000/api/schooladmin/analytics/tests/scores/unlock/',
        {
          academic_year: selectedYear.value,
          term: selectedTerm.value
        },
        { headers }
      );

      showAlert({
        type: 'success',
        message: 'All test scores unlocked successfully!'
      });
    } catch (err) {
      console.error('Error unlocking test scores:', err);
      showAlert({
        type: 'error',
        message: 'Failed to unlock test scores. Please try again.'
      });
    } finally {
      setUnlocking(false);
    }
  };

  return (
    <div className={`tests-dashboard-wrapper ${isFiltered ? 'tests-filters-active' : ''}`}>
      <div className="dashboard-card tests-dashboard-card">
        <div className="tests-card-header">
          <ClipboardList size={28} color="#f59e0b" />
          <div>
            <h2>Tests Average by Class</h2>
            <p>Track test completion rates</p>
          </div>
          <button
            className="tests-unlock-all-btn"
            onClick={handleUnlockAll}
            disabled={unlocking || !selectedYear || !selectedTerm}
          >
            {unlocking ? 'Unlocking...' : '🔓 Unlock All'}
          </button>
        </div>

        <div className="tests-filters">
          <Select
            options={academicYears}
            value={selectedYear}
            onChange={setSelectedYear}
            placeholder="Year"
            styles={selectStyles}
            className="tests-filter-select"
          />
          <Select
            options={termOptions}
            value={selectedTerm}
            onChange={setSelectedTerm}
            placeholder="Term"
            styles={selectStyles}
            className="tests-filter-select"
          />
          <button
            className="tests-dashboard-filter-btn"
            onClick={toggleFilters}
          >
            Filter
          </button>
          <button
            className="tests-dashboard-close-btn"
            onClick={toggleFilters}
          >
            Close
          </button>
        </div>

        <ul className="tests-class-list">
          {loading ? (
            <li className="tests-no-data">Loading test completion data...</li>
          ) : error ? (
            <li className="tests-error-data">
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
            <li className="tests-no-data">Select filters and click 'Filter' to view data</li>
          ) : classStats.length === 0 ? (
            <li className="tests-no-data">
              {selectedYear && selectedTerm ?
                `No test data available for ${selectedYear.label} - ${selectedTerm.label}` :
                'No test data available'
              }
            </li>
          ) : (
            classStats.map(cls => (
              <li key={cls.class_id} onClick={() => handleClassClick(cls)}>
                <span className="tests-class-name">
                  {cls.class_name}
                  {cls.total_subjects === 0 && (
                    <span style={{ fontSize: '0.8rem', color: '#666', marginLeft: '8px' }}>
                      (No subjects)
                    </span>
                  )}
                </span>
                <div className="tests-progress-bar">
                  <div
                    className="tests-filled"
                    style={{
                      width: `${cls.completion_percentage}%`,
                      backgroundColor: getTestBarColor(cls.completion_percentage)
                    }}
                  />
                </div>
                <span className="tests-pct-label">{cls.completion_percentage}%</span>
              </li>
            ))
          )}
        </ul>

        {classStats.length > 0 && (
          <div className="tests-summary">
            <p className="tests-summary-text">
              Overall: {classStats.reduce((sum, cls) => sum + cls.students_completed, 0)} test submissions out of{' '}
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
        <TestSubjectsModal
          classData={selectedClass}
          onClose={() => setSelectedClass(null)}
          onSubjectClick={handleSubjectClick}
        />
      )}

      {selectedSubject && (
        <TestStudentScoresModal
          subjectData={selectedSubject}
          onClose={() => setSelectedSubject(null)}
        />
      )}
    </div>
  );
};

export default DashboardTestsCard;
