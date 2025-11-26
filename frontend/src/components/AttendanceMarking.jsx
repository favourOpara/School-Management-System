// src/components/AttendanceMarking.jsx
import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import axios from 'axios';
import AttendanceMarkingModal from './AttendanceMarkingModal';
import API_BASE_URL from '../config';

import './attendance.css';

const selectStyles = {
  control: base => ({
    ...base,
    fontSize: '0.95rem',
    backgroundColor: '#fff',
    borderColor: '#ccc',
    color: '#222',
    minWidth: 180
  }),
  singleValue: base => ({ ...base, color: '#222' }),
  placeholder: base => ({ ...base, color: '#555' }),
  menu: base => ({ ...base, fontSize: '0.95rem', color: '#222' }),
};

const AttendanceMarking = () => {
  const [academicYears, setAcademicYears] = useState([]);
  const [terms, setTerms] = useState([]);
  const [selectedYear, setSelectedYear] = useState(null);
  const [selectedTerm, setSelectedTerm] = useState(null);
  const [holidayDays, setHolidayDays] = useState([]);
  const [classList, setClassList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [calendarExists, setCalendarExists] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [selectedClass, setSelectedClass] = useState(null);
  const [showMarkingModal, setShowMarkingModal] = useState(false);

  const [schoolDays, setSchoolDays] = useState([]);

  const token = localStorage.getItem('accessToken');

  useEffect(() => {
    const fetchSessionOptions = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/academics/sessions/`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const sessions = res.data;
        const years = [...new Set(sessions.map(s => s.academic_year))];
        const terms = [...new Set(sessions.map(s => s.term))];

        setAcademicYears(years.map(y => ({ label: y, value: y })));
        setTerms(terms.map(t => ({ label: t, value: t })));
      } catch (err) {
        console.error('Failed to load sessions:', err);
        setErrorMessage('Failed to load academic sessions');
      }
    };

    fetchSessionOptions();
  }, [token]);

  const handleLoadData = async () => {
    if (!selectedYear || !selectedTerm) return;

    setLoading(true);
    setErrorMessage('');

    try {
      // Fetch from the attendance calendar system
      const res = await axios.get(`${API_BASE_URL}/api/attendance/calendar/`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const calendar = res.data.find(
        cal => cal.academic_year === selectedYear.value && cal.term === selectedTerm.value
      );

      if (!calendar) {
        setHolidayDays([]);
        setClassList([]);
        setSchoolDays([]);
        setCalendarExists(false);
        setErrorMessage(`No attendance calendar found for ${selectedYear.value} - ${selectedTerm.value}. Please create a calendar first.`);
        setLoading(false);
        return;
      }

      // Calendar exists
      setCalendarExists(true);

      // Parse calendar data
      const holidays = calendar.school_days
        .filter(day => day.holiday_label)
        .map(day => ({
          date: day.date,
          label: day.holiday_label.label,
        }));

      const academicDays = calendar.school_days
        .filter(day => !day.holiday_label)
        .map(day => day.date);

      setHolidayDays(holidays);
      setSchoolDays(academicDays);

      // Fetch classes associated with this calendar
      const classesRes = await axios.get(`${API_BASE_URL}/api/academics/classes/`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // Filter classes that have sessions for this academic year and term
      const sessionsRes = await axios.get(`${API_BASE_URL}/api/academics/sessions/`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const relevantSessions = sessionsRes.data.filter(
        s => s.academic_year === selectedYear.value && s.term === selectedTerm.value
      );

      const relevantClassIds = relevantSessions.map(s => s.classroom.id);
      const filteredClasses = classesRes.data.filter(cls => relevantClassIds.includes(cls.id));

      setClassList(filteredClasses);

    } catch (err) {
      console.error('Error loading attendance data:', err);
      setErrorMessage('Error loading attendance data. Please try again.');
      setCalendarExists(false);
    } finally {
      setLoading(false);
    }
  };

  const handleClassClick = (cls) => {
    setSelectedClass(cls);
    setShowMarkingModal(true);
  };

  const handleModalClose = () => {
    setShowMarkingModal(false);
    setSelectedClass(null);
  };

  return (
    <div className="view-attendance-wrapper">
      <div className="view-attendance-container">
        <h2 className="attendance-section-header">Mark Attendance</h2>
        
        <div className="view-attendance-filters">
          <Select
            placeholder="Select Academic Year"
            options={academicYears}
            value={selectedYear}
            onChange={setSelectedYear}
            styles={selectStyles}
          />
          <Select
            placeholder="Select Term"
            options={terms}
            value={selectedTerm}
            onChange={setSelectedTerm}
            styles={selectStyles}
          />
          <button 
            className="load-data-btn" 
            onClick={handleLoadData}
            disabled={!selectedYear || !selectedTerm || loading}
          >
            {loading ? 'Loading...' : 'Load Data'}
          </button>
        </div>

        {loading && <p className="loading-text">Loading attendance data...</p>}

        {errorMessage && (
          <div className="error-message" style={{
            padding: '15px',
            background: '#ffe6e6',
            border: '1px solid #ff9999',
            borderRadius: '5px',
            color: '#cc0000',
            margin: '15px 0'
          }}>
            <strong>Error:</strong> {errorMessage}
          </div>
        )}

        {!calendarExists && selectedYear && selectedTerm && !loading && !errorMessage && (
          <div className="no-calendar-message" style={{
            padding: '20px',
            background: '#f0f8ff',
            border: '1px solid #cce7ff',
            borderRadius: '5px',
            color: '#0066cc',
            margin: '15px 0'
          }}>
            <h4 style={{color: '#0066cc', marginBottom: '10px'}}>No Attendance Calendar Found</h4>
            <p style={{marginBottom: '5px'}}>
              No attendance calendar exists for <strong>{selectedYear.label} - {selectedTerm.label}</strong>.
            </p>
            <p>Please create an attendance calendar first before marking attendance.</p>
          </div>
        )}

        {holidayDays.length > 0 && (
          <div className="holiday-summary">
            <h4>Holidays ({holidayDays.length}):</h4>
            <ul>
              {holidayDays.map((holiday, index) => (
                <li key={index}>
                  <strong>{holiday.date}</strong> – {holiday.label}
                </li>
              ))}
            </ul>
          </div>
        )}

        {classList.length > 0 && calendarExists && (
          <div className="class-summary">
            <h4>
              Mark Attendance for Classes in{' '}
              <span style={{ color: '#0d47a1' }}>
                {selectedYear?.label} - {selectedTerm?.label}
              </span>{' '}
              ({schoolDays.length} school days):
            </h4>
            <ul className="class-list">
              {classList.map(cls => (
                <li
                  key={cls.id}
                  className="class-name"
                  onClick={() => handleClassClick(cls)}
                  style={{ 
                    cursor: 'pointer', 
                    color: '#0d47a1', 
                    textDecoration: 'underline',
                    padding: '8px 0',
                    borderBottom: '1px solid #eee'
                  }}
                >
                  {cls.name}
                </li>
              ))}
            </ul>
            <p style={{ color: '#666', fontSize: '0.9rem', marginTop: '10px' }}>
              Click on a class name to open the attendance marking calendar.
            </p>
          </div>
        )}

        {classList.length === 0 && calendarExists && selectedYear && selectedTerm && !loading && (
          <div className="no-classes-message" style={{
            padding: '15px',
            background: '#fff3cd',
            border: '1px solid #ffeaa7',
            borderRadius: '5px',
            color: '#856404',
            margin: '15px 0'
          }}>
            <h4>No Classes Found</h4>
            <p>No classes have sessions for {selectedYear.label} - {selectedTerm.label}.</p>
          </div>
        )}
      </div>

      {showMarkingModal && selectedClass && (
        <AttendanceMarkingModal
          classInfo={selectedClass}
          academicYear={selectedYear?.value}
          term={selectedTerm?.value}
          schoolDays={schoolDays}
          holidayDays={holidayDays}
          onClose={handleModalClose}
        />
      )}
    </div>
  );
};

export default AttendanceMarking;