import React, { useState } from 'react';
import { X, Users, Calendar, TrendingUp, TrendingDown } from 'lucide-react';
import './AttendanceStudentModal.css';

const AttendanceStudentModal = ({ data, onClose }) => {
  const [sortBy, setSortBy] = useState('name'); // 'name', 'attendance', 'days'

  if (!data) return null;

  const getAttendanceColor = (percentage) => {
    if (percentage >= 85) return '#388e3c';
    if (percentage >= 75) return '#fbc02d';
    if (percentage >= 60) return '#f9a825';
    return '#d32f2f';
  };

  const getAttendanceStatus = (percentage) => {
    if (percentage >= 85) return 'Excellent';
    if (percentage >= 75) return 'Good';
    if (percentage >= 60) return 'Fair';
    return 'Poor';
  };

  const sortedStudents = [...data.students].sort((a, b) => {
    switch (sortBy) {
      case 'attendance':
        return b.attendancePercentage - a.attendancePercentage;
      case 'days':
        return b.presentDays - a.presentDays;
      case 'name':
      default:
        return a.studentName.localeCompare(b.studentName);
    }
  });

  const averageAttendance = data.students.length > 0 
    ? Math.round(data.students.reduce((sum, student) => sum + student.attendancePercentage, 0) / data.students.length)
    : 0;

  return (
    <div className="attendance-modal-overlay">
      <div className="attendance-modal">
        <div className="attendance-modal-header">
          <div className="modal-title-section">
            <h2>{data.className} - Attendance Details</h2>
            <p className="modal-subtitle">
              {data.academicYear} - {data.term}
            </p>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <div className="attendance-stats-section">
          <div className="stat-card">
            <Users size={20} />
            <div className="stat-info">
              <span className="stat-number">{data.totalStudents}</span>
              <span className="stat-label">Total Students</span>
            </div>
          </div>
          
          <div className="stat-card">
            <Calendar size={20} />
            <div className="stat-info">
              <span className="stat-number">{averageAttendance}%</span>
              <span className="stat-label">Average Attendance</span>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="attendance-trend">
              {data.classAttendance >= 75 ? (
                <TrendingUp size={20} color="#388e3c" />
              ) : (
                <TrendingDown size={20} color="#d32f2f" />
              )}
            </div>
            <div className="stat-info">
              <span className="stat-number">{data.classAttendance}%</span>
              <span className="stat-label">Class Average</span>
            </div>
          </div>
        </div>

        <div className="attendance-controls">
          <div className="sort-controls">
            <label>Sort by:</label>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="name">Student Name</option>
              <option value="attendance">Attendance %</option>
              <option value="days">Days Present</option>
            </select>
          </div>
        </div>

        <div className="students-attendance-list">
          {sortedStudents.length === 0 ? (
            <div className="no-students">
              <p>No students found for this class.</p>
            </div>
          ) : (
            <div className="students-grid">
              {sortedStudents.map((student, index) => (
                <div key={student.studentId} className="student-attendance-card">
                  <div className="student-rank">#{index + 1}</div>
                  
                  <div className="student-details">
                    <h4 className="student-name">{student.studentName}</h4>
                    <p className="student-username">@{student.username}</p>
                  </div>

                  <div className="attendance-metrics">
                    <div className="attendance-percentage">
                      <span 
                        className="percentage-value"
                        style={{ color: getAttendanceColor(student.attendancePercentage) }}
                      >
                        {student.attendancePercentage}%
                      </span>
                      <span 
                        className="attendance-status"
                        style={{ color: getAttendanceColor(student.attendancePercentage) }}
                      >
                        {getAttendanceStatus(student.attendancePercentage)}
                      </span>
                    </div>

                    <div className="days-count">
                      <span className="days-present">{student.presentDays}</span>
                      <span className="days-separator">/</span>
                      <span className="days-total">{student.totalDays}</span>
                      <span className="days-label">days</span>
                    </div>
                  </div>

                  <div className="attendance-bar">
                    <div 
                      className="attendance-progress"
                      style={{
                        width: `${student.attendancePercentage}%`,
                        backgroundColor: getAttendanceColor(student.attendancePercentage)
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <div className="attendance-legend">
            <div className="legend-item">
              <span className="legend-color excellent"></span>
              <span>Excellent (85%+)</span>
            </div>
            <div className="legend-item">
              <span className="legend-color good"></span>
              <span>Good (75-84%)</span>
            </div>
            <div className="legend-item">
              <span className="legend-color fair"></span>
              <span>Fair (60-74%)</span>
            </div>
            <div className="legend-item">
              <span className="legend-color poor"></span>
              <span>Poor (&lt;60%)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AttendanceStudentModal;