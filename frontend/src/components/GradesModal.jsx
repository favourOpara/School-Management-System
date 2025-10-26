// src/components/GradesModal.jsx
import React, { useState, useEffect } from 'react';
import { X, Save, AlertCircle, CheckCircle, Edit2, Lock } from 'lucide-react';
import './GradesModal.css';

const GradesModal = ({ subject, onClose, onUpdate }) => {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  
  const [studentsData, setStudentsData] = useState([]);
  const [gradingConfig, setGradingConfig] = useState(null);
  const [classSessionInfo, setClassSessionInfo] = useState(null);
  const [subjectInfo, setSubjectInfo] = useState(null);
  
  // Track which cells are being edited
  const [editingCell, setEditingCell] = useState(null); // {studentId, component}
  const [editValue, setEditValue] = useState('');

  useEffect(() => {
    fetchStudentGrades();
  }, [subject.id]);

  const fetchStudentGrades = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken');
      
      const response = await fetch(
        `http://127.0.0.1:8000/api/schooladmin/results/subjects/${subject.id}/grades/`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        setStudentsData(data.students);
        setGradingConfig(data.grading_config);
        setClassSessionInfo(data.class_session);
        setSubjectInfo(data.subject);
      } else {
        const errorData = await response.json();
        showMessage(errorData.detail || 'Error fetching grades', 'error');
      }
      
    } catch (error) {
      showMessage('Error fetching student grades', 'error');
    } finally {
      setLoading(false);
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

  const handleEditClick = (studentId, component, currentValue) => {
    setEditingCell({ studentId, component });
    setEditValue(currentValue.toString());
  };

  const handleCancelEdit = () => {
    setEditingCell(null);
    setEditValue('');
  };

  const handleSaveGrade = async (student, component) => {
    const value = parseFloat(editValue);
    const maxPercentage = gradingConfig[`${component}_percentage`];
    
    // Validation
    if (isNaN(value)) {
      showMessage('Please enter a valid number', 'error');
      return;
    }
    
    if (value < 0 || value > maxPercentage) {
      showMessage(`${component.charAt(0).toUpperCase() + component.slice(1)} score must be between 0 and ${maxPercentage}%`, 'error');
      return;
    }
    
    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken');
      
      const response = await fetch(
        `http://127.0.0.1:8000/api/schooladmin/results/grade-summary/${student.grade_summary_id}/`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            component_type: component,
            score: value
          })
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        
        // Update local state
        setStudentsData(prevStudents => 
          prevStudents.map(s => 
            s.id === student.id 
              ? {
                  ...s,
                  [`${component}_score`]: data.grade_summary[`${component}_score`],
                  total_score: data.grade_summary.total_score,
                  letter_grade: data.grade_summary.letter_grade,
                  attendance_finalized: data.grade_summary.attendance_finalized
                }
              : s
          )
        );
        
        showMessage(data.message, 'success');
        setEditingCell(null);
        setEditValue('');
        onUpdate();
      } else {
        const errorData = await response.json();
        showMessage(errorData.detail || 'Error updating grade', 'error');
      }
      
    } catch (error) {
      showMessage('Error updating grade', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e, student, component) => {
    if (e.key === 'Enter') {
      handleSaveGrade(student, component);
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  const renderGradeCell = (student, component) => {
    const isEditing = editingCell?.studentId === student.id && editingCell?.component === component;
    const currentValue = student[`${component}_score`];
    const maxPercentage = gradingConfig[`${component}_percentage`];
    const isAttendanceFinalized = component === 'attendance' && student.attendance_finalized;
    
    if (isEditing) {
      return (
        <div className="edit-cell">
          <input
            type="number"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => handleKeyPress(e, student, component)}
            min="0"
            max={maxPercentage}
            step="0.1"
            autoFocus
            className="grade-input"
          />
          <div className="edit-actions">
            <button 
              className="save-btn-small"
              onClick={() => handleSaveGrade(student, component)}
              disabled={loading}
            >
              <Save size={14} />
            </button>
            <button 
              className="cancel-btn-small"
              onClick={handleCancelEdit}
            >
              <X size={14} />
            </button>
          </div>
        </div>
      );
    }
    
    return (
      <div className="grade-cell">
        <span className="grade-value">
          {currentValue !== null && currentValue !== undefined ? currentValue.toFixed(1) : '0.0'}
          <span className="max-value">/ {maxPercentage}</span>
        </span>
        {isAttendanceFinalized ? (
          <Lock size={14} className="lock-icon" title="Attendance finalized" />
        ) : (
          <button
            className="edit-btn-small"
            onClick={() => handleEditClick(student.id, component, currentValue)}
            title="Edit grade"
          >
            <Edit2 size={14} />
          </button>
        )}
      </div>
    );
  };

  if (loading && studentsData.length === 0) {
    return (
      <div className="modal-overlay">
        <div className="grades-modal loading-modal">
          <div className="loading-spinner">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="grades-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <h2>{subjectInfo?.name || subject.name}</h2>
            <p className="modal-subtitle">
              {classSessionInfo?.class_name} • {classSessionInfo?.academic_year} • {classSessionInfo?.term}
            </p>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        {message && (
          <div className={`message ${messageType}`}>
            {messageType === 'error' ? <AlertCircle size={20} /> : <CheckCircle size={20} />}
            {message}
          </div>
        )}

        {gradingConfig && (
          <div className="grading-config-info">
            <h4>Grading Configuration</h4>
            <div className="config-badges">
              <span className="config-badge">Attendance: {gradingConfig.attendance_percentage}%</span>
              <span className="config-badge">Assignment: {gradingConfig.assignment_percentage}%</span>
              <span className="config-badge">Test: {gradingConfig.test_percentage}%</span>
              <span className="config-badge">Exam: {gradingConfig.exam_percentage}%</span>
            </div>
          </div>
        )}

        <div className="modal-body">
          {studentsData.length === 0 ? (
            <div className="no-students">
              <p>No students found for this subject</p>
            </div>
          ) : (
            <div className="grades-table-container">
              <table className="grades-table">
                <thead>
                  <tr>
                    <th className="student-col">Student</th>
                    <th className="grade-col">Attendance</th>
                    <th className="grade-col">Assignment</th>
                    <th className="grade-col">Test</th>
                    <th className="grade-col">Exam</th>
                    <th className="total-col">Total</th>
                    <th className="grade-col">Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {studentsData.map(student => (
                    <tr key={student.id}>
                      <td className="student-info">
                        <div className="student-name">{student.full_name}</div>
                        <div className="student-details">{student.username}</div>
                      </td>
                      <td>{renderGradeCell(student, 'attendance')}</td>
                      <td>{renderGradeCell(student, 'assignment')}</td>
                      <td>{renderGradeCell(student, 'test')}</td>
                      <td>{renderGradeCell(student, 'exam')}</td>
                      <td className="total-score">
                        {student.total_score ? student.total_score.toFixed(2) : '0.00'}%
                      </td>
                      <td className="letter-grade">
                        <span className={`grade-badge grade-${student.letter_grade || 'F'}`}>
                          {student.letter_grade || 'F'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <p className="footer-note">
            Click the edit icon <Edit2 size={14} /> to modify individual grades. 
            Press Enter to save or Escape to cancel.
          </p>
        </div>
      </div>
    </div>
  );
};

export default GradesModal;