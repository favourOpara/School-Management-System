// src/components/ViewAttendance.jsx
import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import axios from 'axios';
import { Edit3 } from 'lucide-react';
import AttendanceSubjectModal from './AttendanceSubjectModal';
import AttendanceStudentTable from './AttendanceStudentTable';
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
  const [classList, setClassList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [calendarExists, setCalendarExists] = useState(false);
  const [hasAttemptedLoad, setHasAttemptedLoad] = useState(false);

  const [selectedClass, setSelectedClass] = useState(null);
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [showEditCalendar, setShowEditCalendar] = useState(false);

  const [schoolDays, setSchoolDays] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState(null);

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
        setClassList([]);
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

      const classesRes = await axios.get(`${API_BASE_URL}/api/academics/classes/`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setClassList(classesRes.data);
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

  const handleClassClick = (cls) => {
    setSelectedClass(cls);
    setShowSubjectModal(true);
  };

  const handleSubjectSelect = async (subject) => {
    setSelectedSubject(subject);
    setShowSubjectModal(false);

    try {
      const res = await axios.get(
        `${API_BASE_URL}/api/attendance/records/?class_id=${selectedClass.id}&subject_id=${subject.id}&academic_year=${selectedYear.value}&term=${selectedTerm.value}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setStudents(res.data);
    } catch (err) {
      console.error('Failed to load student attendance:', err);
      setStudents([]);
    }
  };

  const handleUpdateAttendance = async (studentId, updatedDays) => {
    try {
      const res = await axios.patch(
        `${API_BASE_URL}/api/attendance/records/${studentId}/`,
        { attended_days: updatedDays },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setStudents(prev =>
        prev.map(student =>
          student.id === studentId
            ? { ...student, attended_days: updatedDays, ...res.data }
            : student
        )
      );
    } catch (err) {
      console.error('Error updating attendance:', err);
    }
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

        {holidayDays.length > 0 && (
          <div className="holiday-summary">
            <h4>Holidays:</h4>
            <ul>
              {holidayDays.map((holiday, index) => (
                <li key={index}>
                  <strong>{holiday.date}</strong> – {holiday.label}
                </li>
              ))}
            </ul>
          </div>
        )}

        {classList.length > 0 && (
          <div className="class-summary">
            <h4>
              Attendance for Classes in <span style={{ color: '#0d47a1' }}>
                {selectedYear?.label} - {selectedTerm?.label}
              </span>:
            </h4>
            <ul className="class-list">
              {classList.map(cls => (
                <li
                  key={cls.id}
                  className="class-name"
                  onClick={() => handleClassClick(cls)}
                >
                  {cls.name}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Student Table Section */}
        {students.length > 0 && selectedSubject && (
          <AttendanceStudentTable
            subjectName={selectedSubject.name}
            students={students}
            schoolDays={schoolDays}
            onUpdateAttendance={handleUpdateAttendance}
          />
        )}
      </div>

      {showSubjectModal && selectedClass && (
        <AttendanceSubjectModal
          classInfo={selectedClass}
          academicYear={selectedYear?.value}
          term={selectedTerm?.value}
          onClose={() => setShowSubjectModal(false)}
          onSubjectSelect={handleSubjectSelect}
        />
      )}

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