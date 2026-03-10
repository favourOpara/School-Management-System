import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Select from 'react-select';
import { ClipboardList, Lock, Users } from 'lucide-react';
import TestSubjectsModal from './TestSubjectsModal';
import TestStudentScoresModal from './TestStudentScoresModal';
import NotYetUnlockedModal from './NotYetUnlockedModal';
import './DashboardTestsCard.css';
import { useDialog } from '../contexts/DialogContext';
import { useSchool } from '../contexts/SchoolContext';

import API_BASE_URL from '../config';

const termOptions = [
  { value: 'First Term', label: 'First Term' },
  { value: 'Second Term', label: 'Second Term' },
  { value: 'Third Term', label: 'Third Term' },
];

const getTestBarColor = (pct) => {
  if (pct < 40) return '#d32f2f';
  if (pct < 60) return '#f9a825';
  if (pct < 80) return '#fbc02d';
  return '#388e3c';
};

const selectStyles = {
  control: (base) => ({ ...base, fontSize: '0.95rem', color: '#222', backgroundColor: '#fff', borderColor: '#ccc' }),
  singleValue: (base) => ({ ...base, color: '#222' }),
  placeholder: (base) => ({ ...base, color: '#555' }),
  menu: (base) => ({ ...base, fontSize: '0.95rem', color: '#222' }),
};

const DashboardTestsCard = () => {
  const { showConfirm, showAlert } = useDialog();
  const { buildApiUrl } = useSchool();
  const [academicYears, setAcademicYears] = useState([]);
  const [selectedYear, setSelectedYear] = useState(null);
  const [selectedTerm, setSelectedTerm] = useState(termOptions[0]);
  const [classStats, setClassStats] = useState([]);
  const [isFiltered, setIsFiltered] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedClass, setSelectedClass] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [unlocking, setUnlocking] = useState(null); // 'paid' | 'attendance' | 'both' | null
  const [lastStrategy, setLastStrategy] = useState(null); // tracks which button was used last
  const [showNotUnlocked, setShowNotUnlocked] = useState(false);
  const [notUnlockedCount, setNotUnlockedCount] = useState(null);

  const token = localStorage.getItem('accessToken');
  const headers = { Authorization: `Bearer ${token}` };

  // Reset strategy tracking when year/term changes
  useEffect(() => {
    setLastStrategy(null);
    setNotUnlockedCount(null);
  }, [selectedYear, selectedTerm]);

  useEffect(() => {
    const fetchYears = async () => {
      try {
        const sessionInfoRes = await axios.get(buildApiUrl('/schooladmin/session/info/'), { headers });
        const currentYear = sessionInfoRes.data.academic_year;
        const currentTerm = sessionInfoRes.data.current_term;
        const res = await axios.get(buildApiUrl('/academics/sessions/'), { headers });
        if (Array.isArray(res.data)) {
          const years = [...new Set(res.data.map(s => s.academic_year))].sort();
          const options = years.map(y => ({ value: y, label: y }));
          setAcademicYears(options);
          const currentYearOption = options.find(opt => opt.value === currentYear);
          if (currentYearOption) {
            setSelectedYear(currentYearOption);
            const currentTermOption = termOptions.find(opt => opt.value === currentTerm);
            if (currentTermOption) setSelectedTerm(currentTermOption);
          } else if (options.length > 0) {
            setSelectedYear(options[options.length - 1]);
          }
        }
      } catch (err) {
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
        const response = await axios.get(buildApiUrl('/schooladmin/analytics/tests/'), {
          params: { academic_year: selectedYear.value, term: selectedTerm.value },
          headers,
        });
        if (response.data.stats) {
          setClassStats(response.data.stats);
          if (response.data.stats.length === 0) setError(`No test data found for ${selectedYear.value} - ${selectedTerm.value}.`);
        }
      } catch (err) {
        setClassStats([]);
        if (err.response?.status === 404) setError(`Test data not found for ${selectedYear.value} - ${selectedTerm.value}.`);
        else setError('Failed to load test completion data. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    fetchTestStats();
  }, [selectedYear, selectedTerm, isFiltered]);

  const toggleFilters = () => {
    setIsFiltered(!isFiltered);
    if (!isFiltered) setError('');
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

  const checkStrategyWarning = async (strategy) => {
    if (lastStrategy && lastStrategy !== strategy) {
      const strategyLabels = { paid: 'Paid Fees', attendance: 'Present Today', both: 'Paid + Present Today' };
      const proceed = await showConfirm({
        title: 'Switch Unlock Strategy?',
        message: `You previously unlocked using "${strategyLabels[lastStrategy]}". Switching to "${strategyLabels[strategy]}" may unlock additional students who don't meet the previous criteria. Are you sure?`,
        confirmText: 'Switch & Continue',
        cancelText: 'Cancel',
        confirmButtonClass: 'confirm-btn-warning',
      });
      return proceed;
    }
    return true;
  };

  const handleUnlock = async (strategy) => {
    if (!selectedYear || !selectedTerm) {
      showAlert({ type: 'warning', message: 'Please select academic year and term first.' });
      return;
    }

    const ok = await checkStrategyWarning(strategy);
    if (!ok) return;

    const strategyLabels = { paid: 'Paid Fees', attendance: 'Present Today', both: 'Paid + Present Today' };
    const confirmed = await showConfirm({
      title: `Unlock Tests — ${strategyLabels[strategy]}`,
      message: strategy === 'paid'
        ? `Unlock all tests for ${selectedYear.label} - ${selectedTerm.label} for students who have paid their fees?`
        : strategy === 'attendance'
        ? `Unlock all tests for ${selectedYear.label} - ${selectedTerm.label} for students who marked attendance today?`
        : `Unlock all tests for ${selectedYear.label} - ${selectedTerm.label} for students who both paid their fees AND marked attendance today?`,
      confirmText: 'Unlock',
      cancelText: 'Cancel',
    });
    if (!confirmed) return;

    const endpoints = {
      paid: '/academics/admin/assessments/unlock-for-paid/',
      attendance: '/academics/admin/assessments/unlock-attendance/',
      both: '/academics/admin/assessments/unlock-paid-and-present/',
    };

    setUnlocking(strategy);
    try {
      const res = await axios.post(
        buildApiUrl(endpoints[strategy]),
        { academic_year: selectedYear.value, term: selectedTerm.value, assessment_type: 'test' },
        { headers }
      );
      setLastStrategy(strategy);
      const count = res.data.access_records ?? res.data.students_count ?? 0;
      showAlert({ type: 'success', message: `Tests unlocked for ${count} student(s).` });

      // Fetch not-unlocked count
      const notRes = await axios.get(buildApiUrl('/academics/admin/assessments/not-unlocked/'), {
        params: { academic_year: selectedYear.value, term: selectedTerm.value, assessment_type: 'test' },
        headers,
      });
      setNotUnlockedCount(notRes.data.total_locked ?? 0);
    } catch (err) {
      showAlert({ type: 'error', message: err.response?.data?.detail || 'Failed to unlock tests. Please try again.' });
    } finally {
      setUnlocking(null);
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
        </div>

        {/* Unlock buttons */}
        <div className="tests-unlock-section">
          <p className="tests-unlock-label">Unlock tests for:</p>
          <div className="tests-unlock-btns">
            <button
              className={`tests-unlock-btn ${lastStrategy === 'paid' ? 'active' : ''}`}
              onClick={() => handleUnlock('paid')}
              disabled={!!unlocking || !selectedYear || !selectedTerm}
            >
              {unlocking === 'paid' ? '...' : '💳 Paid Fees'}
            </button>
            <button
              className={`tests-unlock-btn ${lastStrategy === 'attendance' ? 'active' : ''}`}
              onClick={() => handleUnlock('attendance')}
              disabled={!!unlocking || !selectedYear || !selectedTerm}
            >
              {unlocking === 'attendance' ? '...' : '📋 Present Today'}
            </button>
            <button
              className={`tests-unlock-btn ${lastStrategy === 'both' ? 'active' : ''}`}
              onClick={() => handleUnlock('both')}
              disabled={!!unlocking || !selectedYear || !selectedTerm}
            >
              {unlocking === 'both' ? '...' : '✅ Paid + Present'}
            </button>
          </div>
          {notUnlockedCount !== null && (
            <button
              className="tests-not-unlocked-btn"
              onClick={() => setShowNotUnlocked(true)}
            >
              <Lock size={14} />
              <span>{notUnlockedCount > 0 ? `${notUnlockedCount} student(s) not yet unlocked` : 'All students unlocked'}</span>
              {notUnlockedCount > 0 && <Users size={13} />}
            </button>
          )}
        </div>

        <div className="tests-filters">
          <Select options={academicYears} value={selectedYear} onChange={setSelectedYear} placeholder="Year" styles={selectStyles} className="tests-filter-select" />
          <Select options={termOptions} value={selectedTerm} onChange={setSelectedTerm} placeholder="Term" styles={selectStyles} className="tests-filter-select" />
          <button className="tests-dashboard-filter-btn" onClick={toggleFilters}>Filter</button>
          <button className="tests-dashboard-close-btn" onClick={toggleFilters}>Close</button>
        </div>

        <ul className="tests-class-list">
          {loading ? (
            <li className="tests-no-data">Loading test completion data...</li>
          ) : error ? (
            <li className="tests-error-data">
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <p style={{ color: '#d32f2f', marginBottom: '10px', fontWeight: '500' }}>{error}</p>
                <button onClick={handleRetry} style={{ padding: '8px 16px', backgroundColor: '#1565c0', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.9rem' }}>Retry</button>
              </div>
            </li>
          ) : window.innerWidth <= 768 && !isFiltered ? (
            <li className="tests-no-data">Select filters and click 'Filter' to view data</li>
          ) : classStats.length === 0 ? (
            <li className="tests-no-data">{selectedYear && selectedTerm ? `No test data available for ${selectedYear.label} - ${selectedTerm.label}` : 'No test data available'}</li>
          ) : (
            classStats.map(cls => (
              <li key={cls.class_id} onClick={() => setSelectedClass(cls)}>
                <span className="tests-class-name">
                  {cls.class_name}
                  {cls.total_subjects === 0 && <span style={{ fontSize: '0.8rem', color: '#666', marginLeft: '8px' }}>(No subjects)</span>}
                </span>
                <div className="tests-progress-bar">
                  <div className="tests-filled" style={{ width: `${cls.completion_percentage}%`, backgroundColor: getTestBarColor(cls.completion_percentage) }} />
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
            <p style={{ fontSize: '0.85rem', color: '#666', marginTop: '5px' }}>Showing data for {selectedYear?.label} - {selectedTerm?.label}</p>
          </div>
        )}
      </div>

      {selectedClass && (
        <TestSubjectsModal classData={selectedClass} onClose={() => setSelectedClass(null)} onSubjectClick={setSelectedSubject} />
      )}
      {selectedSubject && (
        <TestStudentScoresModal subjectData={selectedSubject} onClose={() => setSelectedSubject(null)} />
      )}
      {showNotUnlocked && selectedYear && selectedTerm && (
        <NotYetUnlockedModal
          academicYear={selectedYear.value}
          term={selectedTerm.value}
          assessmentType="test"
          onClose={() => setShowNotUnlocked(false)}
          onStudentUnlocked={() => setNotUnlockedCount(prev => Math.max(0, (prev || 1) - 1))}
        />
      )}
    </div>
  );
};

export default DashboardTestsCard;
