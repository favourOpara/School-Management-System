// src/components/ParentAttendanceReport.jsx
import React, { useState, useEffect } from 'react';
import { Calendar, Users, BookOpen, Sunset, TrendingUp, ChevronDown } from 'lucide-react';
import './ParentAttendanceReport.css';

const ParentAttendanceReport = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reportData, setReportData] = useState(null);

  // Selected filters
  const [selectedChild, setSelectedChild] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('');

  useEffect(() => {
    fetchAttendanceReport();
  }, []);

  useEffect(() => {
    if (selectedChild || selectedYear || selectedTerm) {
      fetchAttendanceReport();
    }
  }, [selectedChild, selectedYear, selectedTerm]);

  const fetchAttendanceReport = async () => {
    try {
      setLoading(true);
      setError('');
      const token = localStorage.getItem('accessToken');

      // Build query params
      let url = 'http://127.0.0.1:8000/api/users/parent/attendance-report/';
      const params = new URLSearchParams();
      if (selectedChild) params.append('child_id', selectedChild);
      if (selectedYear) params.append('academic_year', selectedYear);
      if (selectedTerm) params.append('term', selectedTerm);
      if (params.toString()) url += `?${params.toString()}`;

      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setReportData(data);

        // Set defaults if not already set
        if (!selectedChild && data.child) {
          setSelectedChild(data.child.id);
        }
        if (!selectedYear && data.session) {
          setSelectedYear(data.session.academic_year);
        }
        if (!selectedTerm && data.session) {
          setSelectedTerm(data.session.term);
        }
      } else {
        const errorData = await response.json();
        setError(errorData.detail || 'Error fetching attendance report');
      }
    } catch (error) {
      console.error('Error:', error);
      setError('Failed to load attendance report');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="parent-attendance-loading">
        <div className="spinner"></div>
        <p>Loading attendance report...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="parent-attendance-error">
        <p>{error}</p>
      </div>
    );
  }

  if (!reportData) {
    return (
      <div className="parent-attendance-empty">
        <Calendar size={64} />
        <h3>No Attendance Data</h3>
        <p>No attendance data available for your child</p>
      </div>
    );
  }

  const { child, session, statistics, attendance_records, holidays, children, available_sessions } = reportData;

  return (
    <div className="parent-attendance-container">
      <div className="parent-attendance-header">
        <Calendar size={32} color="#1e3a8a" />
        <div>
          <h2>Attendance Report</h2>
          <p>Track your child's school attendance</p>
        </div>
      </div>

      {/* Filters */}
      <div className="attendance-filters">
        {children && children.length > 1 && (
          <div className="filter-group">
            <label>
              <Users size={18} />
              Select Child
            </label>
            <select
              value={selectedChild}
              onChange={(e) => setSelectedChild(e.target.value)}
            >
              {children.map(c => (
                <option key={c.id} value={c.id}>
                  {c.full_name} ({c.username})
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="filter-group">
          <label>
            <BookOpen size={18} />
            Academic Year
          </label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
          >
            {available_sessions && [...new Set(available_sessions.map(s => s.academic_year))].map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>
            <Calendar size={18} />
            Term
          </label>
          <select
            value={selectedTerm}
            onChange={(e) => setSelectedTerm(e.target.value)}
          >
            {available_sessions && [...new Set(available_sessions.map(s => s.term))].map(term => (
              <option key={term} value={term}>{term}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Current Selection Info */}
      <div className="attendance-info-card">
        <div className="info-item">
          <span className="info-label">Student:</span>
          <span className="info-value">{child.full_name}</span>
        </div>
        <div className="info-item">
          <span className="info-label">Class:</span>
          <span className="info-value">{child.classroom || 'N/A'}</span>
        </div>
        <div className="info-item">
          <span className="info-label">Session:</span>
          <span className="info-value">{session.academic_year} - {session.term}</span>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="attendance-stats-grid">
        <div className="stat-card stat-success">
          <div className="stat-icon">
            <Calendar size={24} />
          </div>
          <div className="stat-content">
            <h3>{statistics.days_attended}</h3>
            <p>Days Attended</p>
          </div>
        </div>

        <div className="stat-card stat-danger">
          <div className="stat-icon">
            <Calendar size={24} />
          </div>
          <div className="stat-content">
            <h3>{statistics.days_not_attended}</h3>
            <p>Days Absent</p>
          </div>
        </div>

        <div className="stat-card stat-info">
          <div className="stat-icon">
            <BookOpen size={24} />
          </div>
          <div className="stat-content">
            <h3>{statistics.total_school_days}</h3>
            <p>Total School Days</p>
          </div>
        </div>

        <div className="stat-card stat-warning">
          <div className="stat-icon">
            <Sunset size={24} />
          </div>
          <div className="stat-content">
            <h3>{statistics.total_holidays}</h3>
            <p>Holidays</p>
          </div>
        </div>

        <div className="stat-card stat-primary">
          <div className="stat-icon">
            <TrendingUp size={24} />
          </div>
          <div className="stat-content">
            <h3>{statistics.attendance_percentage}%</h3>
            <p>Attendance Rate</p>
          </div>
        </div>
      </div>

      {/* Days Absent Records */}
      {attendance_records && attendance_records.length > 0 && (
        <div className="attendance-records-section">
          <h3>Days Absent</h3>
          <div className="records-list">
            {attendance_records.map((record, index) => (
              <div key={index} className="record-item">
                <div className="record-date">
                  <Calendar size={18} />
                  <span>{new Date(record.date).toLocaleDateString('en-US', {
                    weekday: 'short',
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                  })}</span>
                </div>
                <div className="record-subjects">
                  <span className="subject-count">Marked as absent</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Holidays */}
      {holidays && holidays.length > 0 && (
        <div className="holidays-section">
          <h3>
            <Sunset size={20} />
            Holidays ({holidays.length})
          </h3>
          <div className="holidays-list">
            {holidays.map((holiday, index) => (
              <div key={index} className="holiday-item">
                <div className="holiday-date">
                  {new Date(holiday.date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric'
                  })}
                </div>
                <div className="holiday-info">
                  <span className="holiday-label">{holiday.label}</span>
                  <span className="holiday-type">{holiday.type}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ParentAttendanceReport;
