// src/components/AttendanceMarkingModal.jsx
import React, { useState, useEffect } from 'react';
import Calendar from 'react-calendar';
import { X, Save, CheckCircle, XCircle, Users, AlertCircle } from 'lucide-react';
import axios from 'axios';
import 'react-calendar/dist/Calendar.css';
import './AttendanceMarkingModal.css';

const AttendanceMarkingModal = ({ 
  classInfo, 
  academicYear, 
  term, 
  schoolDays, 
  holidayDays, 
  onClose 
}) => {
  const [selectedDate, setSelectedDate] = useState(null);
  const [students, setStudents] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState({});
  const [existingRecords, setExistingRecords] = useState({});
  const [hasChanges, setHasChanges] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [sessionId, setSessionId] = useState(null);

  const token = localStorage.getItem('accessToken');

  useEffect(() => {
    fetchSessionAndStudents();
  }, []);

  useEffect(() => {
    if (selectedDate && sessionId) {
      fetchAttendanceForDate();
    }
  }, [selectedDate, sessionId]);

  const fetchSessionAndStudents = async () => {
    try {
      setLoading(true);
      
      const sessionResponse = await axios.get('http://127.0.0.1:8000/api/academics/sessions/', {
        headers: { Authorization: `Bearer ${token}` }
      });

      const session = sessionResponse.data.find(s => 
        s.classroom.id === classInfo.id && 
        s.academic_year === academicYear && 
        s.term === term
      );

      if (!session) {
        showMessage('No session found for this class and academic period', 'error');
        return;
      }

      setSessionId(session.id);

      const studentsResponse = await axios.get(`http://127.0.0.1:8000/api/academics/session-students/${session.id}/`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (studentsResponse.status === 200) {
        setStudents(studentsResponse.data || []);
      }
    } catch (error) {
      showMessage('Error fetching session and students', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchAttendanceForDate = async () => {
    if (!selectedDate || !sessionId) return;

    try {
      const dateStr = selectedDate.toISOString().split('T')[0];
      
      const attendanceResponse = await axios.get(
        `http://127.0.0.1:8000/api/schooladmin/attendance/?class_session=${sessionId}&date=${dateStr}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (attendanceResponse.status === 200) {
        const attendanceData = attendanceResponse.data;
        
        const existing = {};
        const current = {};
        
        attendanceData.forEach(record => {
          existing[record.student] = record;
          current[record.student] = record.is_present;
        });
        
        setExistingRecords(existing);
        setAttendanceRecords(current);
        setHasChanges(false);
      }
    } catch (error) {
      setExistingRecords({});
      setAttendanceRecords({});
      setHasChanges(false);
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

  const isDateValid = (date) => {
    const dateStr = date.toISOString().split('T')[0];
    
    const isHoliday = holidayDays.some(h => h.date === dateStr);
    if (isHoliday) return false;
    
    const isSchoolDay = schoolDays.includes(dateStr);
    return isSchoolDay;
  };

  const getDateStatus = (date) => {
    const dateStr = date.toISOString().split('T')[0];
    
    const holiday = holidayDays.find(h => h.date === dateStr);
    if (holiday) return { type: 'holiday', label: holiday.label };
    
    const isSchoolDay = schoolDays.includes(dateStr);
    if (isSchoolDay) return { type: 'school-day', label: 'School Day' };
    
    return { type: 'weekend', label: 'Weekend/Non-School Day' };
  };

  const handleDateClick = (date) => {
    if (isDateValid(date)) {
      setSelectedDate(date);
    }
  };

  const handleAttendanceChange = (studentId, isPresent) => {
    setAttendanceRecords(prev => ({
      ...prev,
      [studentId]: isPresent
    }));
    setHasChanges(true);
  };

  const markAllPresent = () => {
    const allPresent = {};
    students.forEach(student => {
      allPresent[student.id] = true;
    });
    setAttendanceRecords(allPresent);
    setHasChanges(true);
  };

  const markAllAbsent = () => {
    const allAbsent = {};
    students.forEach(student => {
      allAbsent[student.id] = false;
    });
    setAttendanceRecords(allAbsent);
    setHasChanges(true);
  };

  const saveAttendance = async () => {
    if (!selectedDate || !sessionId || students.length === 0) {
      showMessage('Please select a valid date and ensure students are loaded', 'error');
      return;
    }

    try {
      setLoading(true);
      
      const dateStr = selectedDate.toISOString().split('T')[0];
      const attendanceData = students.map(student => ({
        student: student.id,
        class_session: sessionId,
        date: dateStr,
        is_present: attendanceRecords[student.id] || false,
        recorded_by: null
      }));

      const response = await axios.post('http://127.0.0.1:8000/api/schooladmin/attendance/', {
        attendance_records: attendanceData
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.status === 201) {
        showMessage('Attendance saved successfully!', 'success');
        setHasChanges(false);
        fetchAttendanceForDate();
      }
    } catch (error) {
      console.error('Save attendance error:', error);
      showMessage('Error saving attendance', 'error');
    } finally {
      setLoading(false);
    }
  };

  const tileClassName = ({ date, view }) => {
    if (view !== 'month') return null;
    
    const dateStr = date.toISOString().split('T')[0];
    
    const isHoliday = holidayDays.some(h => h.date === dateStr);
    if (isHoliday) {
      return 'marking-modal-holiday-tile';
    }
    
    const isSchoolDay = schoolDays.includes(dateStr);
    if (isSchoolDay) {
      return 'marking-modal-school-tile';
    }
    
    return 'marking-modal-weekend-tile';
  };

  const tileDisabled = ({ date, view }) => {
    if (view !== 'month') return false;
    return !isDateValid(date);
  };

  const getAttendanceStats = () => {
    const total = students.length;
    const present = Object.values(attendanceRecords).filter(Boolean).length;
    const absent = total - present;
    return { total, present, absent };
  };

  const stats = getAttendanceStats();
  const selectedDateStatus = selectedDate ? getDateStatus(selectedDate) : null;

  return (
    <div className="marking-modal-overlay">
      <div className="marking-modal-container">
        <div className="marking-modal-header">
          <h2>Mark Attendance - {classInfo.name}</h2>
          <button className="marking-modal-close-btn" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        {message && (
          <div className={`marking-modal-message ${messageType}`}>
            {messageType === 'error' ? <AlertCircle size={16} /> : <CheckCircle size={16} />}
            {message}
          </div>
        )}

        <div className="marking-modal-content">
          <div className="marking-modal-calendar-section">
            <h3>Select Date</h3>
            <p className="marking-modal-instruction">
              Click on a school day to mark attendance. Holidays and weekends are disabled.
            </p>
            
            <Calendar
              onChange={handleDateClick}
              value={selectedDate}
              tileClassName={tileClassName}
              tileDisabled={tileDisabled}
              className="marking-modal-calendar"
              calendarType="gregory"
              showWeekNumbers={false}
              locale="en-US"
              formatShortWeekday={(locale, date) => {
                const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                return days[date.getDay()];
              }}
            />

            <div className="marking-modal-legend">
              <div className="marking-modal-legend-item">
                <span className="marking-modal-legend-color marking-modal-school-color"></span>
                School Days
              </div>
              <div className="marking-modal-legend-item">
                <span className="marking-modal-legend-color marking-modal-holiday-color"></span>
                Holidays
              </div>
              <div className="marking-modal-legend-item">
                <span className="marking-modal-legend-color marking-modal-weekend-color"></span>
                Weekends/Non-School
              </div>
            </div>

            {selectedDate && (
              <div className="marking-modal-selected-date">
                <h4>Selected: {selectedDate.toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}</h4>
                <p className={`marking-modal-date-status ${selectedDateStatus?.type}`}>
                  {selectedDateStatus?.label}
                </p>
              </div>
            )}
          </div>

          {selectedDate && isDateValid(selectedDate) && students.length > 0 && (
            <div className="marking-modal-students-section">
              <div className="marking-modal-students-header">
                <h3>Students ({students.length})</h3>
                {hasChanges && <span className="marking-modal-changes-indicator">Unsaved changes</span>}
              </div>

              <div className="marking-modal-stats">
                <div className="marking-modal-stat-item">
                  <Users size={16} />
                  <span>Total: {stats.total}</span>
                </div>
                <div className="marking-modal-stat-item marking-modal-present">
                  <CheckCircle size={16} />
                  <span>Present: {stats.present}</span>
                </div>
                <div className="marking-modal-stat-item marking-modal-absent">
                  <XCircle size={16} />
                  <span>Absent: {stats.absent}</span>
                </div>
              </div>

              <div className="marking-modal-bulk-actions">
                <button 
                  className="marking-modal-bulk-btn marking-modal-present-btn"
                  onClick={markAllPresent}
                  disabled={loading}
                >
                  Mark All Present
                </button>
                <button 
                  className="marking-modal-bulk-btn marking-modal-absent-btn"
                  onClick={markAllAbsent}
                  disabled={loading}
                >
                  Mark All Absent
                </button>
              </div>

              <div className="marking-modal-students-list">
                {students.map(student => {
                  const isPresent = attendanceRecords[student.id];
                  const hasExisting = existingRecords[student.id];
                  
                  return (
                    <div key={student.id} className="marking-modal-student-item">
                      <div className="marking-modal-student-info">
                        <h4>{student.first_name} {student.last_name}</h4>
                        <p>{student.username}</p>
                      </div>
                      
                      <div className="marking-modal-attendance-buttons">
                        <button
                          className={`marking-modal-attendance-btn marking-modal-present ${isPresent === true ? 'active' : ''}`}
                          onClick={() => handleAttendanceChange(student.id, true)}
                          disabled={loading}
                        >
                          <CheckCircle size={16} />
                          Present
                        </button>
                        <button
                          className={`marking-modal-attendance-btn marking-modal-absent ${isPresent === false ? 'active' : ''}`}
                          onClick={() => handleAttendanceChange(student.id, false)}
                          disabled={loading}
                        >
                          <XCircle size={16} />
                          Absent
                        </button>
                      </div>
                      
                      {hasExisting && (
                        <div className="marking-modal-existing-record">
                          Previously: {hasExisting.is_present ? 'Present' : 'Absent'}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="marking-modal-actions">
                <button
                  className="marking-modal-cancel-btn"
                  onClick={onClose}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  className="marking-modal-save-btn"
                  onClick={saveAttendance}
                  disabled={loading || !hasChanges}
                >
                  <Save size={16} />
                  {loading ? 'Saving...' : 'Save Attendance'}
                </button>
              </div>
            </div>
          )}

          {selectedDate && !isDateValid(selectedDate) && (
            <div className="marking-modal-invalid-date">
              <AlertCircle size={24} />
              <h3>Cannot mark attendance for this date</h3>
              <p>Please select a valid school day. Holidays and weekends are not available for attendance marking.</p>
            </div>
          )}

          {loading && !selectedDate && (
            <div className="marking-modal-loading">
              <p>Loading session and students...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AttendanceMarkingModal;