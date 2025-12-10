// src/components/ViewAttendance.jsx
import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import axios from 'axios';
import { Edit3 } from 'lucide-react';
import EditAttendanceCalendar from './EditAttendanceCalendar';
import API_BASE_URL from '../config';

import './attendance.css';

const selectStyles = {
  control: base => ({
    ...base,
    fontSize: '0.95rem',
    backgroundColor: '#fff',
    borderColor: '#e5e7eb',
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    color: '#000',
    minWidth: 200
  }),
  singleValue: base => ({ ...base, color: '#111827' }),
  placeholder: base => ({ ...base, color: '#9ca3af' }),
  menu: base => ({
    ...base,
    fontSize: '0.95rem',
    color: '#111827',
    backgroundColor: '#fff',
    zIndex: 9999,
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
  }),
  menuPortal: base => ({ ...base, zIndex: 9999 }),
  option: (base, state) => ({
    ...base,
    color: '#111827',
    backgroundColor: state.isSelected ? '#3b82f6' : state.isFocused ? '#f3f4f6' : '#fff',
    padding: '0.5rem 0.75rem'
  }),
};

const ViewAttendance = () => {
  const [academicYears, setAcademicYears] = useState([]);
  const [terms, setTerms] = useState([]);
  const [selectedYear, setSelectedYear] = useState(null);
  const [selectedTerm, setSelectedTerm] = useState(null);
  const [holidayDays, setHolidayDays] = useState([]);
  const [loading, setLoading] = useState(false);
  const [calendarExists, setCalendarExists] = useState(false);
  const [hasAttemptedLoad, setHasAttemptedLoad] = useState(false);
  const [showEditCalendar, setShowEditCalendar] = useState(false);
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
      }
    };

    fetchSessionOptions();
  }, [token]);

  const handleLoadData = async () => {
    if (!selectedYear || !selectedTerm) return;

    setLoading(true);
    setHasAttemptedLoad(true);

    try {
      const res = await axios.get(`${API_BASE_URL}/api/attendance/calendar/`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const calendar = res.data.find(
        cal => cal.academic_year === selectedYear.value && cal.term === selectedTerm.value
      );

      if (!calendar) {
        setHolidayDays([]);
        setSchoolDays([]);
        setCalendarExists(false); // Calendar doesn't exist
        setLoading(false);
        return;
      }

      // Calendar exists
      setCalendarExists(true);

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
    } catch (err) {
      console.error('Error loading attendance data:', err);
      setCalendarExists(false);
    } finally {
      setLoading(false);
    }
  };

  const handleEditCalendar = () => {
    setShowEditCalendar(true);
  };

  const handleCalendarUpdate = () => {
    // Refresh the data after calendar update
    handleLoadData();
  };

  return (
    <div className="view-attendance-wrapper">
      <div className="view-attendance-container">
        <div className="view-attendance-filters">
          <Select
            placeholder="Select Academic Year"
            options={academicYears}
            value={selectedYear}
            onChange={(val) => {
              setSelectedYear(val);
              setHasAttemptedLoad(false);
            }}
            styles={selectStyles}
            classNamePrefix="view-attendance-select"
            menuPortalTarget={document.body}
            menuPosition="fixed"
          />
          <Select
            placeholder="Select Term"
            options={terms}
            value={selectedTerm}
            onChange={(val) => {
              setSelectedTerm(val);
              setHasAttemptedLoad(false);
            }}
            styles={selectStyles}
            classNamePrefix="view-attendance-select"
            menuPortalTarget={document.body}
            menuPosition="fixed"
          />
          <button className="load-data-btn" onClick={handleLoadData}>
            Load Data
          </button>
          
          {/* Show Edit Calendar Button if year/term selected and calendar exists */}
          {selectedYear && selectedTerm && calendarExists && (
            <button className="edit-calendar-btn" onClick={handleEditCalendar}>
              <Edit3 size={16} />
              Edit Calendar
            </button>
          )}
        </div>

        {loading && <p className="loading-text">Loading attendance data...</p>}

        {/* Show message if no calendar exists - only after user clicks Load Data */}
        {selectedYear && selectedTerm && !loading && hasAttemptedLoad && !calendarExists && (
          <div className="no-calendar-message" style={{padding: '20px', background: '#f0f0f0', margin: '10px 0', borderRadius: '5px', color: '#333'}}>
            <h4 style={{color: '#333', marginBottom: '10px'}}>No Attendance Calendar Found</h4>
            <p style={{color: '#333', marginBottom: '5px'}}>No attendance calendar exists for <strong>{selectedYear.label} - {selectedTerm.label}</strong>.</p>
            <p style={{color: '#333'}}>Please create a calendar first before viewing attendance data.</p>
          </div>
        )}

        {calendarExists && (schoolDays.length > 0 || holidayDays.length > 0) && (
          <div className="calendar-summary-container">
            <h3 style={{ color: '#0d47a1', marginBottom: '1.5rem' }}>
              Attendance Calendar for {selectedYear?.label} - {selectedTerm?.label}
            </h3>

            <div className="attendance-calendar-stats">
              <div className="stat-card school-days-card">
                <h4>School Days</h4>
                <p className="stat-number">{schoolDays.length}</p>
                <small>Total school days in this term</small>
              </div>

              <div className="stat-card holiday-days-card">
                <h4>Holiday Days</h4>
                <p className="stat-number">{holidayDays.length}</p>
                <small>Total holidays in this term</small>
              </div>
            </div>

            {holidayDays.length > 0 && (
              <div className="holiday-details">
                <h4>Holiday Details:</h4>
                <ul className="holiday-list">
                  {holidayDays.map((holiday, index) => (
                    <li key={index} className="holiday-item">
                      <strong>{holiday.date}</strong>
                      <span className="holiday-label">{holiday.label}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {showEditCalendar && selectedYear && selectedTerm && (
        <EditAttendanceCalendar
          academicYear={selectedYear.value}
          term={selectedTerm.value}
          onClose={() => setShowEditCalendar(false)}
          onUpdate={handleCalendarUpdate}
        />
      )}
    </div>
  );
};

export default ViewAttendance;