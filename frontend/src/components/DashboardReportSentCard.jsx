// src/components/DashboardReportSentCard.jsx
import React, { useState, useEffect } from 'react';
import { Send, CheckCircle, XCircle, AlertCircle, Loader } from 'lucide-react';
import Select from 'react-select';
import './DashboardReportSentCard.css';
import ReportSentModal from './ReportSentModal';

const termOptions = [
  { value: 'First Term', label: 'First Term' },
  { value: 'Second Term', label: 'Second Term' },
  { value: 'Third Term', label: 'Third Term' },
];

const selectStyles = {
  control: (base) => ({
    ...base,
    fontSize: '0.85rem',
    minHeight: '32px',
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
    fontSize: '0.85rem',
    color: '#222',
    zIndex: 9999,
  }),
  valueContainer: (base) => ({
    ...base,
    padding: '0 6px',
  }),
  dropdownIndicator: (base) => ({
    ...base,
    padding: '4px',
  }),
};

const DashboardReportSentCard = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  const [selectedClass, setSelectedClass] = useState(null);
  const [academicYears, setAcademicYears] = useState([]);
  const [selectedYear, setSelectedYear] = useState(null);
  const [selectedTerm, setSelectedTerm] = useState(termOptions[0]);
  const [isFiltered, setIsFiltered] = useState(false);

  useEffect(() => {
    fetchAcademicYears();
  }, []);

  useEffect(() => {
    if (selectedYear && selectedTerm && (window.innerWidth > 768 || isFiltered)) {
      fetchReportSentStats();
    }
  }, [selectedYear, selectedTerm, isFiltered]);

  const toggleFilters = () => {
    setIsFiltered(!isFiltered);
  };

  const fetchAcademicYears = async () => {
    try {
      const token = localStorage.getItem('accessToken');

      // First, get the current active session
      const sessionInfoRes = await fetch('http://127.0.0.1:8000/api/schooladmin/session/info/', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      let currentYear = null;
      let currentTerm = null;

      if (sessionInfoRes.ok) {
        const sessionInfo = await sessionInfoRes.json();
        currentYear = sessionInfo.academic_year;
        currentTerm = sessionInfo.current_term;
      }

      // Then get all available sessions
      const response = await fetch('http://127.0.0.1:8000/api/academics/sessions/', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          const years = [...new Set(data.map(s => s.academic_year))].sort();
          const options = years.map(y => ({ value: y, label: y }));
          setAcademicYears(options);

          // Set the current active session as default
          if (currentYear) {
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
          } else if (options.length > 0) {
            // Fallback if no current session info
            setSelectedYear(options[options.length - 1]);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching academic years:', err);
    }
  };

  const fetchReportSentStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('accessToken');

      const params = new URLSearchParams();
      if (selectedYear) params.append('academic_year', selectedYear.value);
      if (selectedTerm) params.append('term', selectedTerm.value);

      const response = await fetch(`http://127.0.0.1:8000/api/schooladmin/analytics/reports-sent/?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      } else {
        const errorData = await response.json();
        setError(errorData.detail || 'Error fetching report sent statistics');
      }
    } catch (err) {
      console.error('Error:', err);
      setError('Failed to load report sent statistics');
    } finally {
      setLoading(false);
    }
  };

  const getPercentageColor = (percentage) => {
    if (percentage >= 80) return '#10b981';
    if (percentage >= 50) return '#f59e0b';
    return '#ef4444';
  };

  return (
    <div className={`report-sent-wrapper ${isFiltered ? 'rs-filters-active' : ''}`}>
      <div className="report-sent-card">
        <div className="report-sent-header">
          <Send size={28} color="#3b82f6" />
          <div>
            <h3>Reports Sent by Class</h3>
            <p>Track report delivery status</p>
          </div>
        </div>

        <div className="report-sent-filters">
          <Select
            options={academicYears}
            value={selectedYear}
            onChange={setSelectedYear}
            placeholder="Year"
            styles={selectStyles}
            className="rs-filter-select"
          />
          <Select
            options={termOptions}
            value={selectedTerm}
            onChange={setSelectedTerm}
            placeholder="Term"
            styles={selectStyles}
            className="rs-filter-select"
          />
          <button
            className="rs-filter-btn"
            onClick={toggleFilters}
          >
            Filter
          </button>
          <button
            className="rs-close-btn"
            onClick={toggleFilters}
          >
            Close
          </button>
        </div>

        {loading ? (
          <div className="report-sent-loading">
            <Loader size={32} className="rs-spinner" />
            <p>Loading statistics...</p>
          </div>
        ) : error ? (
          <div className="report-sent-error">
            <AlertCircle size={32} />
            <p>{error}</p>
          </div>
        ) : window.innerWidth <= 768 && !isFiltered ? (
          <div className="rs-no-data">
            <p>Click 'Filter' to view data</p>
          </div>
        ) : !stats || !stats.classes ? (
          <div className="report-sent-empty">
            <XCircle size={48} />
            <p>No data available</p>
          </div>
        ) : (
          <>
            <div className="report-sent-summary">
              <div className="summary-stat">
                <CheckCircle size={20} color="#10b981" />
                <span className="stat-value">{stats.total_sent}</span>
                <span className="stat-label">Sent</span>
              </div>
              <div className="summary-stat">
                <XCircle size={20} color="#ef4444" />
                <span className="stat-value">{stats.total_not_sent}</span>
                <span className="stat-label">Not Sent</span>
              </div>
              <div className="summary-stat">
                <span className="stat-percentage" style={{ color: getPercentageColor(stats.overall_percentage) }}>
                  {stats.overall_percentage}%
                </span>
                <span className="stat-label">Complete</span>
              </div>
            </div>

            <div className="report-sent-classes">
              {stats.classes.length === 0 ? (
                <div className="no-classes">
                  <p>No classes with students in current session</p>
                </div>
              ) : (
                stats.classes.map((cls) => (
                  <div
                    key={cls.class_session_id}
                    className="rs-class-item"
                    onClick={() => setSelectedClass(cls)}
                  >
                    <div className="rs-class-info">
                      <span className="rs-class-name">{cls.class_name}</span>
                      <span className="rs-class-stats">
                        {cls.sent} / {cls.total} sent
                      </span>
                    </div>
                    <div className="rs-progress-container">
                      <div className="rs-progress-bar">
                        <div
                          className="rs-progress-fill"
                          style={{
                            width: `${cls.percentage}%`,
                            backgroundColor: getPercentageColor(cls.percentage)
                          }}
                        />
                      </div>
                      <span className="rs-percentage">{cls.percentage}%</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {selectedClass && (
          <ReportSentModal
            classData={selectedClass}
            onClose={() => setSelectedClass(null)}
          />
        )}
      </div>
    </div>
  );
};

export default DashboardReportSentCard;
