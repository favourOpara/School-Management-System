import React, { useState, useEffect } from 'react';
import { BookOpen, Bell, Search, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import Select from 'react-select';
import SubjectIncompleteStudentsModal from './SubjectIncompleteStudentsModal';
import './DashboardSubjectGradingCard.css';

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

const getCompletionColor = (percentage) => {
  if (percentage >= 80) return '#10b981';
  if (percentage >= 50) return '#f59e0b';
  return '#ef4444';
};

const DashboardSubjectGradingCard = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  const [academicYears, setAcademicYears] = useState([]);
  const [selectedYear, setSelectedYear] = useState(null);
  const [selectedTerm, setSelectedTerm] = useState(termOptions[0]);
  const [isFiltered, setIsFiltered] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [sendingNotifications, setSendingNotifications] = useState(false);
  const [notificationResult, setNotificationResult] = useState(null);

  useEffect(() => {
    fetchAcademicYears();
  }, []);

  useEffect(() => {
    if (selectedYear && selectedTerm && (window.innerWidth > 768 || isFiltered)) {
      fetchSubjectGradingStats();
    }
  }, [selectedYear, selectedTerm, isFiltered]);

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

  const fetchSubjectGradingStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('accessToken');

      const params = new URLSearchParams();
      if (selectedYear) params.append('academic_year', selectedYear.value);
      if (selectedTerm) params.append('term', selectedTerm.value);

      const response = await fetch(`http://127.0.0.1:8000/api/schooladmin/analytics/subject-grading/?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      } else {
        const errorData = await response.json();
        setError(errorData.detail || 'Error fetching subject grading statistics');
      }
    } catch (err) {
      console.error('Error:', err);
      setError('Failed to load subject grading statistics');
    } finally {
      setLoading(false);
    }
  };

  const toggleFilters = () => {
    setIsFiltered(!isFiltered);
  };

  const handleNotifyTeachers = async () => {
    if (!selectedYear || !selectedTerm) return;

    try {
      setSendingNotifications(true);
      setNotificationResult(null);
      const token = localStorage.getItem('accessToken');

      const response = await fetch('http://127.0.0.1:8000/api/schooladmin/analytics/subject-grading/notify-teachers/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          academic_year: selectedYear.value,
          term: selectedTerm.value
        })
      });

      if (response.ok) {
        const data = await response.json();
        setNotificationResult({
          success: true,
          message: data.message
        });
      } else {
        const errorData = await response.json();
        setNotificationResult({
          success: false,
          message: errorData.detail || 'Error sending notifications'
        });
      }
    } catch (err) {
      console.error('Error:', err);
      setNotificationResult({
        success: false,
        message: 'Failed to send notifications'
      });
    } finally {
      setSendingNotifications(false);
    }
  };

  const getFilteredSubjects = () => {
    if (!stats || !stats.subjects) return [];

    let subjects = [...stats.subjects];

    // Filter by search term
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      subjects = subjects.filter(s =>
        s.subject_name.toLowerCase().includes(search) ||
        s.class_name.toLowerCase().includes(search) ||
        s.teacher_name.toLowerCase().includes(search)
      );
    }

    return subjects;
  };

  const getDisplayedSubjects = () => {
    const filtered = getFilteredSubjects();
    if (showAll || searchTerm) {
      return filtered;
    }
    return filtered.slice(0, 5);
  };

  const hasIncompleteGrades = (subject) => {
    return subject.incomplete_count > 0;
  };

  return (
    <div className={`subject-grading-wrapper ${isFiltered ? 'sg-filters-active' : ''}`}>
      <div className="subject-grading-card">
        <div className="subject-grading-header">
          <BookOpen size={28} color="#8b5cf6" />
          <div>
            <h3>Subject Grading Completion</h3>
            <p>Track grade entry progress by subject</p>
          </div>
        </div>

        <div className="subject-grading-filters">
          <Select
            options={academicYears}
            value={selectedYear}
            onChange={setSelectedYear}
            placeholder="Year"
            styles={selectStyles}
            className="sg-filter-select"
          />
          <Select
            options={termOptions}
            value={selectedTerm}
            onChange={setSelectedTerm}
            placeholder="Term"
            styles={selectStyles}
            className="sg-filter-select"
          />
          <button
            className="sg-filter-btn"
            onClick={toggleFilters}
          >
            Filter
          </button>
          <button
            className="sg-close-btn"
            onClick={toggleFilters}
          >
            Close
          </button>
        </div>

        {loading ? (
          <div className="sg-loading">
            <div className="sg-spinner"></div>
            <p>Loading statistics...</p>
          </div>
        ) : error ? (
          <div className="sg-error">
            <AlertCircle size={32} />
            <p>{error}</p>
          </div>
        ) : window.innerWidth <= 768 && !isFiltered ? (
          <div className="sg-no-data">
            <p>Click 'Filter' to view data</p>
          </div>
        ) : !stats || !stats.subjects ? (
          <div className="sg-empty">
            <BookOpen size={48} />
            <p>No data available</p>
          </div>
        ) : (
          <>
            <div className="sg-notify-section">
              <button
                className="sg-notify-btn"
                onClick={handleNotifyTeachers}
                disabled={sendingNotifications}
              >
                <Bell size={16} />
                {sendingNotifications ? 'Sending...' : 'Notify All Teachers'}
              </button>
              {notificationResult && (
                <div className={`sg-notification-result ${notificationResult.success ? 'success' : 'error'}`}>
                  <p>{notificationResult.message}</p>
                  <button onClick={() => setNotificationResult(null)} className="sg-close-result">×</button>
                </div>
              )}
            </div>

            {showAll && (
              <div className="sg-search-container">
                <Search size={16} className="sg-search-icon" />
                <input
                  type="text"
                  placeholder="Search subjects, classes, or teachers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="sg-search-input"
                />
              </div>
            )}

            <div className="sg-subjects-list">
              {getDisplayedSubjects().length === 0 ? (
                <div className="sg-no-results">
                  <p>No subjects found matching your search</p>
                </div>
              ) : (
                getDisplayedSubjects().map((subject) => (
                  <div
                    key={subject.subject_id}
                    className={`sg-subject-item ${hasIncompleteGrades(subject) ? 'clickable' : ''}`}
                    onClick={() => hasIncompleteGrades(subject) && setSelectedSubject(subject)}
                  >
                    <div className="sg-subject-info">
                      <div className="sg-subject-name">{subject.subject_name}</div>
                      <div className="sg-subject-details">
                        <span className="sg-class-name">{subject.class_name}</span>
                        <span className="sg-teacher-name">{subject.teacher_name}</span>
                      </div>
                    </div>
                    <div className="sg-subject-stats">
                      <div className="sg-progress-container">
                        <div className="sg-progress-bar">
                          <div
                            className="sg-progress-fill"
                            style={{
                              width: `${subject.completion_percentage}%`,
                              backgroundColor: getCompletionColor(subject.completion_percentage)
                            }}
                          />
                        </div>
                        <span className="sg-percentage">{subject.completion_percentage}%</span>
                      </div>
                      <div className="sg-counts">
                        <span className="sg-complete">{subject.complete_count} complete</span>
                        <span className="sg-incomplete">{subject.incomplete_count} incomplete</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {stats.subjects.length > 5 && !searchTerm && (
              <button
                className="sg-show-more-btn"
                onClick={() => setShowAll(!showAll)}
              >
                {showAll ? (
                  <>
                    <ChevronUp size={16} />
                    Show Less
                  </>
                ) : (
                  <>
                    <ChevronDown size={16} />
                    Show More ({stats.subjects.length - 5} more)
                  </>
                )}
              </button>
            )}

            <div className="sg-summary">
              <p>
                Total: {stats.total_subjects} subjects |
                Showing data for {selectedYear?.label} - {selectedTerm?.label}
              </p>
            </div>
          </>
        )}

        {selectedSubject && (
          <SubjectIncompleteStudentsModal
            subject={selectedSubject}
            onClose={() => setSelectedSubject(null)}
          />
        )}
      </div>
    </div>
  );
};

export default DashboardSubjectGradingCard;
