// src/components/ViewResults.jsx
import React, { useState, useEffect } from 'react';
import { BookOpen, Filter, AlertCircle, CheckCircle, Search, Users } from 'lucide-react';
import GradesModal from './GradesModal';
import './ViewResults.css';
import { useDialog } from '../contexts/DialogContext';

import API_BASE_URL from '../config';

const ViewResults = () => {
  const { showConfirm } = useDialog();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  
  // Filter states
  const [academicYears, setAcademicYears] = useState([]);
  const [terms, setTerms] = useState([]);
  const [classes, setClasses] = useState([]);
  const [departments, setDepartments] = useState(['Science', 'Arts', 'Commercial']);
  
  // Selected filters
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [showDepartmentFilter, setShowDepartmentFilter] = useState(false);
  
  // Subjects list
  const [subjects, setSubjects] = useState([]);
  const [classSession, setClassSession] = useState(null);
  
  // Modal state
  const [showGradesModal, setShowGradesModal] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    // Check if selected class is senior (SSS)
    if (selectedClass) {
      const classObj = classes.find(c => c.id === parseInt(selectedClass));
      if (classObj && classObj.name.toUpperCase().startsWith('SSS')) {
        setShowDepartmentFilter(true);
      } else {
        setShowDepartmentFilter(false);
        setSelectedDepartment('');
      }
    }
  }, [selectedClass, classes]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken');
      
      // Fetch sessions for academic years and terms
      const sessionResponse = await fetch(`${API_BASE_URL}/api/academics/sessions/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (sessionResponse.ok) {
        const sessionData = await sessionResponse.json();
        const uniqueYears = [...new Set(sessionData.map(s => s.academic_year))].sort().reverse();
        const uniqueTerms = [...new Set(sessionData.map(s => s.term))];
        setAcademicYears(uniqueYears);
        setTerms(uniqueTerms);
      }
      
      // Fetch classes
      const classResponse = await fetch(`${API_BASE_URL}/api/academics/classes/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (classResponse.ok) {
        const classData = await classResponse.json();
        setClasses(classData);
      }
      
    } catch (error) {
      showMessage('Error fetching initial data', 'error');
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

  const handleSearchSubjects = async () => {
    if (!selectedYear || !selectedTerm || !selectedClass) {
      showMessage('Please select Academic Year, Term, and Class', 'error');
      return;
    }
    
    if (showDepartmentFilter && !selectedDepartment) {
      showMessage('Please select a Department for senior classes', 'error');
      return;
    }
    
    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken');
      
      let url = `${API_BASE_URL}/api/schooladmin/results/subjects/?academic_year=${selectedYear}&term=${selectedTerm}&class_id=${selectedClass}`;
      
      if (selectedDepartment) {
        url += `&department=${selectedDepartment}`;
      }
      
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setSubjects(data.subjects);
        setClassSession(data.class_session);
        showMessage(`Found ${data.subjects.length} subject(s)`, 'success');
      } else {
        const errorData = await response.json();
        showMessage(errorData.detail || 'Error fetching subjects', 'error');
        setSubjects([]);
        setClassSession(null);
      }
      
    } catch (error) {
      showMessage('Error fetching subjects', 'error');
      setSubjects([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubjectClick = (subject) => {
    setSelectedSubject(subject);
    setShowGradesModal(true);
  };

  const handleCloseModal = () => {
    setShowGradesModal(false);
    setSelectedSubject(null);
  };

  const handleSyncAttendance = async () => {
    if (!selectedYear || !selectedTerm) {
      showMessage('Please select Academic Year and Term first', 'error');
      return;
    }

    const confirmed = await showConfirm({
      title: 'Sync Attendance Grades',
      message: `Sync attendance grades for ${selectedYear} - ${selectedTerm}?\n\nThis will calculate attendance scores from your marked attendance records and update the grading system.`,
      confirmText: 'Sync',
      cancelText: 'Cancel',
      confirmButtonClass: 'confirm-btn-primary'
    });
    if (!confirmed) return;

    try {
      setSyncing(true);
      const token = localStorage.getItem('accessToken');

      const response = await fetch(`${API_BASE_URL}/api/schooladmin/results/sync-attendance/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          academic_year: selectedYear,
          term: selectedTerm
        })
      });

      if (response.ok) {
        const data = await response.json();
        showMessage(`${data.message}\nUpdated: ${data.updated_count}, Skipped: ${data.skipped_count}`, 'success');
      } else {
        const errorData = await response.json();
        showMessage(errorData.detail || 'Error syncing attendance', 'error');
      }
    } catch (error) {
      showMessage('Error syncing attendance grades', 'error');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="view-results-container">
      <div className="view-results-header">
        <BookOpen size={32} />
        <div>
          <h2>Student Results & Grades</h2>
          <p>View and manage student grades for all subjects</p>
        </div>
      </div>

      {message && (
        <div className={`message ${messageType}`}>
          {messageType === 'error' ? <AlertCircle size={20} /> : <CheckCircle size={20} />}
          {message}
        </div>
      )}

      {/* Filters Section */}
      <div className="filters-section">
        <div className="filters-header">
          <Filter size={20} />
          <h3>Filter Results</h3>
        </div>

        <div className="filters-grid">
          <div className="form-group">
            <label>Academic Year *</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
            >
              <option value="">Select Academic Year</option>
              {academicYears.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Term *</label>
            <select
              value={selectedTerm}
              onChange={(e) => setSelectedTerm(e.target.value)}
            >
              <option value="">Select Term</option>
              {terms.map(term => (
                <option key={term} value={term}>{term}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Class *</label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
            >
              <option value="">Select Class</option>
              {classes.map(cls => (
                <option key={cls.id} value={cls.id}>{cls.name}</option>
              ))}
            </select>
          </div>

          {showDepartmentFilter && (
            <div className="form-group">
              <label>Department *</label>
              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
              >
                <option value="">Select Department</option>
                {departments.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <button 
          className="search-btn"
          onClick={handleSearchSubjects}
          disabled={loading}
        >
          <Search size={18} />
          {loading ? 'Searching...' : 'Search Subjects'}
        </button>

        {selectedYear && selectedTerm && (
          <button 
            className="sync-btn"
            onClick={handleSyncAttendance}
            disabled={syncing || loading}
          >
            {syncing ? 'Syncing...' : 'Sync Attendance Grades'}
          </button>
        )}
      </div>

      {/* Class Session Info */}
      {classSession && (
        <div className="session-info">
          <h4>Session Information</h4>
          <div className="session-details">
            <span><strong>Class:</strong> {classSession.class_name}</span>
            <span><strong>Academic Year:</strong> {classSession.academic_year}</span>
            <span><strong>Term:</strong> {classSession.term}</span>
          </div>
        </div>
      )}

      {/* Subjects List */}
      {subjects.length > 0 && (
        <div className="subjects-section">
          <div className="subjects-header">
            <h3>Subjects ({subjects.length})</h3>
            <p>Click on a subject to view and edit student grades</p>
          </div>

          <div className="subjects-grid">
            {subjects.map(subject => (
              <div 
                key={subject.id} 
                className="subject-card"
                onClick={() => handleSubjectClick(subject)}
              >
                <div className="subject-card-header">
                  <BookOpen size={24} />
                  <h4>{subject.name}</h4>
                </div>
                <div className="subject-card-body">
                  {subject.code && <p><strong>Code:</strong> {subject.code}</p>}
                  <p><strong>Teacher:</strong> {subject.teacher}</p>
                  {subject.department && (
                    <p><strong>Department:</strong> {subject.department}</p>
                  )}
                  <div className="subject-card-footer">
                    <Users size={16} />
                    <span>{subject.student_count} students</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {subjects.length === 0 && classSession && (
        <div className="no-subjects">
          <BookOpen size={48} />
          <p>No subjects found for the selected filters</p>
        </div>
      )}

      {/* Grades Modal */}
      {showGradesModal && selectedSubject && (
        <GradesModal
          subject={selectedSubject}
          onClose={handleCloseModal}
          onUpdate={() => showMessage('Grades updated successfully', 'success')}
        />
      )}
    </div>
  );
};

export default ViewResults;