// src/components/CreateAttendance.jsx
import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import axios from 'axios';
import CreateAttendanceCalendar from './CreateAttendanceCalendar';
import ViewAttendance from './ViewAttendance'; // Placeholder for the upcoming view attendance section
import './attendance.css';

const selectStyles = {
  control: base => ({
    ...base,
    fontSize: '0.95rem',
    backgroundColor: '#fff',
    borderColor: '#ccc',
    color: '#222',
  }),
  singleValue: base => ({ ...base, color: '#222' }),
  placeholder: base => ({ ...base, color: '#555' }),
  menu: base => ({ ...base, fontSize: '0.95rem', color: '#222' }),
};

const CreateAttendance = () => {
  const [academicYears, setAcademicYears] = useState([]);
  const [terms, setTerms] = useState([]);
  const [selectedYear, setSelectedYear] = useState(null);
  const [selectedTerm, setSelectedTerm] = useState(null);
  const [sessionExists, setSessionExists] = useState(false);
  const [activeTab, setActiveTab] = useState('create');

  const token = localStorage.getItem('accessToken');

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const res = await axios.get('http://127.0.0.1:8000/api/academics/sessions/', {
          headers: { Authorization: `Bearer ${token}` },
        });

        const sessions = res.data;
        const uniqueYears = [...new Set(sessions.map(s => s.academic_year))];
        const uniqueTerms = [...new Set(sessions.map(s => s.term))];

        setAcademicYears(uniqueYears.map(y => ({ label: y, value: y })));
        setTerms(uniqueTerms.map(t => ({ label: t, value: t })));
      } catch (err) {
        console.error('Error fetching sessions:', err);
      }
    };

    fetchSessions();
  }, [token]);

  useEffect(() => {
    const verifySession = async () => {
      if (!selectedYear || !selectedTerm) return;
      try {
        const res = await axios.get('http://127.0.0.1:8000/api/academics/sessions/', {
          headers: { Authorization: `Bearer ${token}` },
        });

        const exists = res.data.some(
          s => s.academic_year === selectedYear.value && s.term === selectedTerm.value
        );
        setSessionExists(exists);
      } catch (err) {
        console.error('Error verifying session existence:', err);
      }
    };

    verifySession();
  }, [selectedYear, selectedTerm]);

  return (
    <div className="create-attendance-wrapper">
      <div className="create-attendance-container">
        <div className="attendance-tabs">
          <button
            className={activeTab === 'create' ? 'active-tab' : ''}
            onClick={() => setActiveTab('create')}
          >
            Create Attendance
          </button>
          <button
            className={activeTab === 'view' ? 'active-tab' : ''}
            onClick={() => setActiveTab('view')}
          >
            View Attendance
          </button>
        </div>

        {activeTab === 'create' && (
          <>
            <h2 className="attendance-section-header">Create Attendance</h2>

            <div className="attendance-form">
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

              {!sessionExists && selectedYear && selectedTerm && (
                <p className="attendance-error-msg">
                  This term hasn’t been created for the selected academic year. Please create a session first.
                </p>
              )}
            </div>

            {sessionExists && selectedYear && selectedTerm && (
              <CreateAttendanceCalendar
                selectedYear={selectedYear.value}
                selectedTerm={selectedTerm.value}
              />
            )}
          </>
        )}

        {activeTab === 'view' && (
          <>
            <h2 className="attendance-section-header">View Attendance</h2>
            <ViewAttendance />
          </>
        )}
      </div>
    </div>
  );
};

export default CreateAttendance;
