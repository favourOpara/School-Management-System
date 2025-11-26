import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Select from 'react-select';
import { CalendarCheck } from 'lucide-react';
import AttendanceStudentModal from './AttendanceStudentModal';
import API_BASE_URL from '../config';

import './DashboardAttendanceCard.css';

const termOptions = [
  { value: 'First Term', label: 'First Term' },
  { value: 'Second Term', label: 'Second Term' },
  { value: 'Third Term', label: 'Third Term' },
];

const getAttendanceBarColor = (pct) => {
  if (pct < 60) return '#d32f2f';  // Red for poor attendance
  if (pct < 75) return '#f9a825';  // Orange for fair attendance
  if (pct < 85) return '#fbc02d';  // Yellow for good attendance
  return '#388e3c';                // Green for excellent attendance
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

const DashboardAttendanceCard = () => {
  const [academicYears, setAcademicYears] = useState([]);
  const [selectedYear, setSelectedYear] = useState(null);
  const [selectedTerm, setSelectedTerm] = useState(termOptions[0]);
  const [classStats, setClassStats] = useState([]);
  const [modalClass, setModalClass] = useState(null);
  const [isFiltered, setIsFiltered] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
    const fetchAttendanceStats = async () => {
      if (!selectedYear || !selectedTerm || (window.innerWidth <= 768 && !isFiltered)) return;
      
      setLoading(true);
      setError('');
      
      try {
        // First, check if an attendance calendar exists for this academic year and term
        const calendarsRes = await axios.get(`${API_BASE_URL}/api/attendance/calendar/`, { headers });
        const attendanceCalendar = calendarsRes.data.find(
          cal => cal.academic_year === selectedYear.value && cal.term === selectedTerm.value
        );

        if (!attendanceCalendar) {
          console.log(`No attendance calendar found for ${selectedYear.value} - ${selectedTerm.value}`);
          setClassStats([]);
          setError(`No attendance calendar found for ${selectedYear.value} - ${selectedTerm.value}. Please create an attendance calendar first.`);
          return;
        }

        console.log('Found attendance calendar:', attendanceCalendar);

        // Get all sessions for the selected year and term
        const sessionsRes = await axios.get(`${API_BASE_URL}/api/academics/sessions/`, { headers });
        const sessions = sessionsRes.data.filter(s => 
          s.academic_year === selectedYear.value && s.term === selectedTerm.value
        );

        if (sessions.length === 0) {
          setClassStats([]);
          setError(`No class sessions found for ${selectedYear.value} - ${selectedTerm.value}.`);
          return;
        }

        console.log(`Found ${sessions.length} sessions for ${selectedYear.value} - ${selectedTerm.value}`);

        // Get attendance data for each session
        const attendancePromises = sessions.map(async (session) => {
          try {
            // Get students for this session
            const studentsRes = await axios.get(
              `${API_BASE_URL}/api/academics/session-students/${session.id}/`, 
              { headers }
            );
            const students = studentsRes.data;

            if (students.length === 0) {
              return {
                classId: session.classroom.id,
                className: session.classroom.name,
                sessionId: session.id,
                totalStudents: 0,
                attendancePercentage: 0,
                presentDays: 0,
                totalDays: 0,
                students: [],
                hasCalendar: true
              };
            }

            // Get attendance records for this session
            const attendanceRes = await axios.get(
              `${API_BASE_URL}/api/schooladmin/attendance/?class_session=${session.id}`,
              { headers }
            );
            const attendanceRecords = attendanceRes.data;

            console.log(`Session ${session.id} (${session.classroom.name}): ${attendanceRecords.length} attendance records`);

            // Calculate attendance statistics
            const studentStats = students.map(student => {
              const studentRecords = attendanceRecords.filter(r => r.student === student.id);
              const presentCount = studentRecords.filter(r => r.is_present).length;
              const totalRecords = studentRecords.length;
              const attendancePercentage = totalRecords > 0 ? Math.round((presentCount / totalRecords) * 100) : 0;

              return {
                studentId: student.id,
                studentName: `${student.first_name} ${student.last_name}`,
                username: student.username,
                presentDays: presentCount,
                totalDays: totalRecords,
                attendancePercentage
              };
            });

            // Calculate overall class statistics
            const totalPresentDays = studentStats.reduce((sum, s) => sum + s.presentDays, 0);
            const totalPossibleDays = studentStats.reduce((sum, s) => sum + s.totalDays, 0);
            const classAttendancePercentage = totalPossibleDays > 0 ? 
              Math.round((totalPresentDays / totalPossibleDays) * 100) : 0;

            return {
              classId: session.classroom.id,
              className: session.classroom.name,
              sessionId: session.id,
              totalStudents: students.length,
              attendancePercentage: classAttendancePercentage,
              presentDays: totalPresentDays,
              totalDays: totalPossibleDays,
              students: studentStats,
              hasCalendar: true
            };
          } catch (error) {
            console.error(`Error fetching attendance for session ${session.id}:`, error);
            return {
              classId: session.classroom.id,
              className: session.classroom.name,
              sessionId: session.id,
              totalStudents: 0,
              attendancePercentage: 0,
              presentDays: 0,
              totalDays: 0,
              students: [],
              hasCalendar: true
            };
          }
        });

        const results = await Promise.all(attendancePromises);
        
        // Filter out classes with no attendance data and sort by attendance percentage
        const validResults = results.filter(result => result.totalDays > 0);
        const sortedResults = validResults.sort((a, b) => a.attendancePercentage - b.attendancePercentage);
        
        setClassStats(sortedResults);
        
        if (validResults.length === 0) {
          setError(`No attendance records found for ${selectedYear.value} - ${selectedTerm.value}. Please mark attendance for classes first.`);
        }
        
      } catch (err) {
        console.error('Error fetching attendance stats:', err);
        setClassStats([]);
        if (err.response?.status === 404) {
          setError(`Attendance system not found for ${selectedYear.value} - ${selectedTerm.value}.`);
        } else {
          setError('Failed to load attendance data. Please try again.');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchAttendanceStats();
  }, [selectedYear, selectedTerm, isFiltered]);

  const toggleFilters = () => {
    setIsFiltered(!isFiltered);
    if (!isFiltered) {
      setError(''); // Clear error when opening filters
    }
  };

  const handleRetry = () => {
    setError('');
    // This will trigger the useEffect to refetch data
    setIsFiltered(prev => !prev);
    setTimeout(() => setIsFiltered(prev => !prev), 100);
  };

  return (
    <div className={`attendance-dashboard-wrapper ${isFiltered ? 'attendance-filters-active' : ''}`}>
      <div className="dashboard-card attendance-dashboard-card">
        <div className="attendance-card-header">
          <CalendarCheck size={28} color="#3b82f6" />
          <div>
            <h2>Attendance by Class</h2>
            <p>Track student attendance rates</p>
          </div>
        </div>

        <div className="attendance-filters">
          <Select
            options={academicYears}
            value={selectedYear}
            onChange={setSelectedYear}
            placeholder="Year"
            styles={selectStyles}
            className="attendance-filter-select"
          />
          <Select
            options={termOptions}
            value={selectedTerm}
            onChange={setSelectedTerm}
            placeholder="Term"
            styles={selectStyles}
            className="attendance-filter-select"
          />
          <button
            className="attendance-dashboard-filter-btn"
            onClick={toggleFilters}
          >
            Filter
          </button>
          <button
            className="attendance-dashboard-close-btn"
            onClick={toggleFilters}
          >
            Close
          </button>
        </div>

        <ul className="attendance-class-list">
          {loading ? (
            <li className="attendance-no-data">Loading attendance data...</li>
          ) : error ? (
            <li className="attendance-error-data">
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
            <li className="attendance-no-data">Select filters and click 'Filter' to view data</li>
          ) : classStats.length === 0 ? (
            <li className="attendance-no-data">
              {selectedYear && selectedTerm ? 
                `No attendance data available for ${selectedYear.label} - ${selectedTerm.label}` : 
                'No attendance data available'
              }
            </li>
          ) : (
            classStats.map(cls => (
              <li key={cls.classId} onClick={() => setModalClass(cls)}>
                <span className="attendance-class-name">
                  {cls.className}
                  {cls.totalDays === 0 && (
                    <span style={{ fontSize: '0.8rem', color: '#666', marginLeft: '8px' }}>
                      (No records)
                    </span>
                  )}
                </span>
                <div className="attendance-progress-bar">
                  <div
                    className="attendance-filled"
                    style={{
                      width: `${cls.attendancePercentage}%`,
                      backgroundColor: getAttendanceBarColor(cls.attendancePercentage)
                    }}
                  />
                </div>
                <span className="attendance-pct-label">{cls.attendancePercentage}%</span>
              </li>
            ))
          )}
        </ul>

        {classStats.length > 0 && (
          <div className="attendance-summary">
            <p className="attendance-summary-text">
              Overall: {classStats.reduce((sum, cls) => sum + cls.presentDays, 0)} present days out of{' '}
              {classStats.reduce((sum, cls) => sum + cls.totalDays, 0)} total possible days
            </p>
            <p style={{ fontSize: '0.85rem', color: '#666', marginTop: '5px' }}>
              Showing data for {selectedYear?.label} - {selectedTerm?.label}
            </p>
          </div>
        )}
      </div>

      {modalClass && (
        <AttendanceStudentModal
          data={{
            className: modalClass.className,
            students: modalClass.students,
            sessionId: modalClass.sessionId,
            academicYear: selectedYear?.value,
            term: selectedTerm?.value,
            totalStudents: modalClass.totalStudents,
            classAttendance: modalClass.attendancePercentage
          }}
          onClose={() => setModalClass(null)}
        />
      )}
    </div>
  );
};

export default DashboardAttendanceCard;