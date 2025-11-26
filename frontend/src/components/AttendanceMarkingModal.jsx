// src/components/AttendanceMarkingModal.jsx
import React, { useState, useEffect } from 'react';
import Calendar from 'react-calendar';
import { X, Search, AlertCircle } from 'lucide-react';
import 'react-calendar/dist/Calendar.css';
import './attendance.css';
import axios from 'axios';

import API_BASE_URL from '../config';

const AttendanceMarkingModal = ({ classInfo, academicYear, term, schoolDays, holidayDays, onClose }) => {
  const [selectedDate, setSelectedDate] = useState(null);
  const [students, setStudents] = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [attendanceData, setAttendanceData] = useState({});
  const [existingAttendance, setExistingAttendance] = useState({});
  const [classSession, setClassSession] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [warningMessage, setWarningMessage] = useState('');

  const token = localStorage.getItem('accessToken');

  // Fetch class session and students
  useEffect(() => {
    const fetchClassData = async () => {
      try {
        setLoading(true);

        // Get the class session for this class, academic year, and term
        const sessionsRes = await axios.get(`${API_BASE_URL}/api/academics/sessions/`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const session = sessionsRes.data.find(
          s => s.classroom.id === classInfo.id && 
               s.academic_year === academicYear && 
               s.term === term
        );

        if (!session) {
          setMessage('Class session not found for this academic year and term.');
          return;
        }

        setClassSession(session);

        // Fetch students in this class session
        const studentsRes = await axios.get(
          `${API_BASE_URL}/api/academics/session-students/${session.id}/`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        setStudents(studentsRes.data);
        setFilteredStudents(studentsRes.data);

        // Fetch existing attendance records for this session
        const attendanceRes = await axios.get(
          `${API_BASE_URL}/api/schooladmin/attendance/?class_session=${session.id}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        // Organize existing attendance by date and student
        const existingData = {};
        attendanceRes.data.forEach(record => {
          const dateKey = record.date;
          if (!existingData[dateKey]) {
            existingData[dateKey] = {};
          }
          existingData[dateKey][record.student] = record.is_present;
        });

        setExistingAttendance(existingData);

      } catch (err) {
        console.error('Error fetching class data:', err);
        setMessage('Failed to load class data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchClassData();
  }, [classInfo.id, academicYear, term, token]);

  // Filter students based on search term
  useEffect(() => {
    if (!searchTerm) {
      setFilteredStudents(students);
    } else {
      const filtered = students.filter(student => {
        const fullName = `${student.first_name} ${student.last_name}`.toLowerCase();
        const username = student.username.toLowerCase();
        const search = searchTerm.toLowerCase();
        return fullName.includes(search) || username.includes(search);
      });
      setFilteredStudents(filtered);
    }
  }, [searchTerm, students]);

  // Helper function to format date consistently (avoid timezone issues)
  const formatDateString = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Check if date is a school day, weekend, or holiday
  const isSchoolDay = (date) => {
    const dateStr = formatDateString(date);
    return schoolDays.includes(dateStr);
  };

  const isHoliday = (date) => {
    const dateStr = formatDateString(date);
    const result = holidayDays.some(h => h.date === dateStr);
    // Debug logging - remove after fixing
    if (result) {
      console.log(`Holiday match found: ${dateStr}`, holidayDays.find(h => h.date === dateStr));
    }
    return result;
  };

  const getHolidayLabel = (date) => {
    const dateStr = formatDateString(date);
    const holiday = holidayDays.find(h => h.date === dateStr);
    return holiday ? holiday.label : '';
  };

  const isWeekend = (date) => {
    return date.getDay() === 0 || date.getDay() === 6;
  };

  // Handle date click on calendar
  const handleDateClick = (date) => {
    setWarningMessage('');
    
    if (isHoliday(date)) {
      const holidayLabel = getHolidayLabel(date);
      setWarningMessage(`${date.toLocaleDateString()} is a holiday: ${holidayLabel}`);
      return;
    }

    if (!isSchoolDay(date)) {
      setWarningMessage(`${date.toLocaleDateString()} is not a school day.`);
      return;
    }

    // Valid school day - select it
    setSelectedDate(date);
    setWarningMessage('');

    // Load existing attendance for this date if available
    const dateStr = date.toISOString().split('T')[0];
    if (existingAttendance[dateStr]) {
      setAttendanceData(existingAttendance[dateStr]);
    } else {
      // Initialize with all students marked as absent (false)
      const initialData = {};
      students.forEach(student => {
        initialData[student.id] = false;
      });
      setAttendanceData(initialData);
    }
  };

  // Handle attendance toggle for a student
  const toggleAttendance = (studentId) => {
    setAttendanceData(prev => ({
      ...prev,
      [studentId]: !prev[studentId]
    }));
  };

  // Mark all students as present
  const markAllPresent = () => {
    const allPresent = {};
    filteredStudents.forEach(student => {
      allPresent[student.id] = true;
    });
    setAttendanceData(prev => ({ ...prev, ...allPresent }));
  };

  // Mark all students as absent
  const markAllAbsent = () => {
    const allAbsent = {};
    filteredStudents.forEach(student => {
      allAbsent[student.id] = false;
    });
    setAttendanceData(prev => ({ ...prev, ...allAbsent }));
  };

  // Save attendance to backend
  const handleSaveAttendance = async () => {
    if (!selectedDate || !classSession) {
      setMessage('Please select a date and ensure class session is loaded.');
      return;
    }

    const dateStr = formatDateString(selectedDate);

    // Prepare attendance records
    const attendanceRecords = students.map(student => ({
      student: student.id,
      class_session: classSession.id,
      date: dateStr,
      is_present: attendanceData[student.id] || false,
    }));

    setSaving(true);
    setMessage('');

    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/schooladmin/attendance/`,
        { attendance_records: attendanceRecords },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setMessage(`Attendance saved successfully for ${dateStr}`);

      // Update existing attendance cache
      setExistingAttendance(prev => ({
        ...prev,
        [dateStr]: { ...attendanceData }
      }));

      // Clear selection after a delay
      setTimeout(() => {
        setSelectedDate(null);
        setAttendanceData({});
        setMessage('');
      }, 2000);

    } catch (err) {
      console.error('Error saving attendance:', err);
      setMessage('Failed to save attendance. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Calendar tile styling
  const tileClassName = ({ date }) => {
    const dateStr = formatDateString(date);
    
    if (isHoliday(date)) return 'holiday-day';
    if (isSchoolDay(date)) {
      // Check if attendance has been marked for this day
      if (existingAttendance[dateStr]) {
        return 'marked-attendance-day';
      }
      return 'school-day';
    }
    return null;
  };

  return (
    <div className="attendance-marking-overlay">
      <div className="attendance-marking-modal-container">
        {/* Modal Header */}
        <div className="attendance-marking-modal-header">
          <div>
            <h2>Mark Attendance - {classInfo.name}</h2>
            <p style={{ fontSize: '0.9rem', color: '#666', marginTop: '5px' }}>
              {academicYear} - {term}
            </p>
          </div>
          <button className="attendance-marking-close-btn" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        {/* Modal Content */}
        <div className="attendance-marking-modal-content">
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center' }}>
              <p>Loading class data...</p>
            </div>
          ) : (
            <>
              {/* Calendar Section */}
              <div className="attendance-marking-calendar-section">
                <h3>Select a School Day</h3>
                <Calendar
                  tileClassName={tileClassName}
                  onClickDay={handleDateClick}
                  value={selectedDate}
                />
                <div className="calendar-legend" style={{
                  display: 'flex',
                  gap: '15px',
                  marginTop: '10px',
                  fontSize: '0.85rem',
                  flexWrap: 'wrap'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <div style={{ width: '15px', height: '15px', backgroundColor: '#e3f2fd', border: '1px solid #90caf9' }}></div>
                    <span>School Day</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <div style={{ width: '15px', height: '15px', backgroundColor: '#fff3cd', border: '1px solid #ffc107' }}></div>
                    <span>Holiday</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <div style={{ width: '15px', height: '15px', backgroundColor: '#c8e6c9', border: '1px solid #4caf50' }}></div>
                    <span>Marked</span>
                  </div>
                </div>
              </div>

              {/* Warning Message */}
              {warningMessage && (
                <div className="warning-message" style={{
                  padding: '12px',
                  backgroundColor: '#fff3cd',
                  border: '1px solid #ffc107',
                  borderRadius: '6px',
                  color: '#856404',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  marginTop: '15px'
                }}>
                  <AlertCircle size={20} />
                  <span>{warningMessage}</span>
                </div>
              )}

              {/* Student List Section */}
              {selectedDate && (
                <div className="attendance-student-section">
                  <div className="selected-date-header">
                    <h3>Marking Attendance for: {selectedDate.toLocaleDateString('en-US', { 
                      weekday: 'long', 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}</h3>
                  </div>

                  {/* Search Bar */}
                  <div className="student-search-bar" style={{
                    position: 'relative',
                    marginBottom: '15px'
                  }}>
                    <Search 
                      size={18} 
                      style={{
                        position: 'absolute',
                        left: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: '#666'
                      }}
                    />
                    <input
                      type="text"
                      placeholder="Search students by name or username..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 10px 10px 40px',
                        fontSize: '0.95rem',
                        border: '1px solid #ccc',
                        borderRadius: '6px',
                        outline: 'none'
                      }}
                    />
                  </div>

                  {/* Bulk Actions */}
                  <div className="bulk-actions" style={{
                    display: 'flex',
                    gap: '10px',
                    marginBottom: '15px'
                  }}>
                    <button
                      onClick={markAllPresent}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: '#4caf50',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '0.9rem',
                        cursor: 'pointer'
                      }}
                    >
                      Mark All Present
                    </button>
                    <button
                      onClick={markAllAbsent}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: '#f44336',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '0.9rem',
                        cursor: 'pointer'
                      }}
                    >
                      Mark All Absent
                    </button>
                  </div>

                  {/* Students List */}
                  <div className="students-list" style={{
                    maxHeight: '400px',
                    overflowY: 'auto',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    padding: '10px'
                  }}>
                    {filteredStudents.length === 0 ? (
                      <p style={{ textAlign: 'center', color: '#666', padding: '20px' }}>
                        No students found
                      </p>
                    ) : (
                      filteredStudents.map(student => (
                        <div
                          key={student.id}
                          className="student-attendance-item"
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '12px',
                            borderBottom: '1px solid #eee',
                            cursor: 'pointer',
                            backgroundColor: attendanceData[student.id] ? '#e8f5e9' : '#ffebee'
                          }}
                          onClick={() => toggleAttendance(student.id)}
                        >
                          <div>
                            <div style={{ fontWeight: '500', color: '#333' }}>
                              {student.first_name} {student.last_name}
                            </div>
                            <div style={{ fontSize: '0.85rem', color: '#666' }}>
                              {student.username}
                            </div>
                          </div>
                          <div style={{
                            padding: '6px 16px',
                            borderRadius: '20px',
                            fontSize: '0.85rem',
                            fontWeight: '500',
                            backgroundColor: attendanceData[student.id] ? '#4caf50' : '#f44336',
                            color: 'white'
                          }}>
                            {attendanceData[student.id] ? 'Present' : 'Absent'}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Summary */}
                  <div className="attendance-summary" style={{
                    marginTop: '15px',
                    padding: '12px',
                    backgroundColor: '#f5f5f5',
                    borderRadius: '6px',
                    display: 'flex',
                    justifyContent: 'space-between'
                  }}>
                    <span>
                      Present: <strong style={{ color: '#4caf50' }}>
                        {Object.values(attendanceData).filter(v => v === true).length}
                      </strong>
                    </span>
                    <span>
                      Absent: <strong style={{ color: '#f44336' }}>
                        {Object.values(attendanceData).filter(v => v === false).length}
                      </strong>
                    </span>
                    <span>
                      Total: <strong>{students.length}</strong>
                    </span>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="attendance-action-buttons" style={{
                display: 'flex',
                gap: '10px',
                marginTop: '20px',
                justifyContent: 'flex-end'
              }}>
                <button
                  onClick={onClose}
                  disabled={saving}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '1rem',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    opacity: saving ? 0.6 : 1
                  }}
                >
                  Close
                </button>
                {selectedDate && (
                  <button
                    onClick={handleSaveAttendance}
                    disabled={saving}
                    style={{
                      padding: '12px 24px',
                      backgroundColor: '#007bff',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '1rem',
                      fontWeight: '500',
                      cursor: saving ? 'not-allowed' : 'pointer',
                      opacity: saving ? 0.6 : 1
                    }}
                  >
                    {saving ? 'Saving...' : 'Save Attendance'}
                  </button>
                )}
              </div>

              {/* Success/Error Message */}
              {message && (
                <div style={{
                  marginTop: '15px',
                  padding: '12px',
                  borderRadius: '6px',
                  textAlign: 'center',
                  backgroundColor: message.includes('Failed') ? '#f8d7da' : '#d4edda',
                  color: message.includes('Failed') ? '#721c24' : '#155724',
                  border: message.includes('Failed') ? '1px solid #f5c6cb' : '1px solid #c3e6cb'
                }}>
                  {message}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AttendanceMarkingModal;