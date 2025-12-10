import React, { useState, useEffect } from 'react';
import SubjectContentManager from './SubjectContentManager';
import StudentSubmissionsModal from './StudentSubmissionsModal';
import API_BASE_URL from '../config';

import './AssignedClasses.css';

const AssignedClasses = () => {
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [students, setStudents] = useState([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [showContentManager, setShowContentManager] = useState(false);
  
  // Student submissions modal state
  const [showSubmissionsModal, setShowSubmissionsModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);

  useEffect(() => {
    fetchAssignedSubjects();
  }, []);

  const fetchAssignedSubjects = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken');
      
      const response = await fetch(`${API_BASE_URL}/api/academics/teacher/assigned-subjects/`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.status === 401) {
        setError('Authentication failed. Please log in again.');
        return;
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setSubjects(data.subjects_by_class || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchSubjectStudents = async (subjectId, subjectName) => {
    try {
      setStudentsLoading(true);
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${API_BASE_URL}/api/academics/teacher/subjects/${subjectId}/students/`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setStudents(data.students || []);
      setSelectedSubject({
        id: subjectId,
        name: subjectName,
        ...data.subject_info
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setStudentsLoading(false);
    }
  };

  const handleBackToSubjects = () => {
    setSelectedSubject(null);
    setStudents([]);
    setShowContentManager(false);
  };

  const handleManageContent = () => {
    setShowContentManager(true);
  };

  const handleBackToStudents = () => {
    setShowContentManager(false);
  };

  const handleViewProfile = (student) => {
    setSelectedStudent(student);
    setShowSubmissionsModal(true);
  };

  const handleCloseSubmissionsModal = () => {
    setShowSubmissionsModal(false);
    setSelectedStudent(null);
  };

  if (loading) {
    return (
      <div className="assigned-classes-container">
        <div className="assigned-classes-loading">
          <p>Loading your assigned subjects...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="assigned-classes-container">
        <div className="assigned-classes-error">
          <h2>Error Loading Subjects</h2>
          <p>{error}</p>
          <button onClick={fetchAssignedSubjects} className="retry-btn">
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Show content manager for selected subject
  if (selectedSubject && showContentManager) {
    return (
      <SubjectContentManager
        subjectId={selectedSubject.id}
        subjectInfo={selectedSubject}
        onBack={handleBackToStudents}
      />
    );
  }

  // Show student list for selected subject
  if (selectedSubject) {
    return (
      <div className="assigned-classes-container">
        <div className="subject-detail-header">
          <button onClick={handleBackToSubjects} className="back-btn">
            ← Back to Subjects
          </button>
          <div className="subject-detail-info">
            <h2>{selectedSubject.name}</h2>
            <p className="subject-detail-meta">
              {selectedSubject.classroom} - {selectedSubject.academic_year} {selectedSubject.term}
              {selectedSubject.department !== 'General' && (
                <span className="department-badge">{selectedSubject.department}</span>
              )}
            </p>
          </div>
          <button onClick={handleManageContent} className="manage-content-btn">
            📚 Manage Content
          </button>
        </div>

        {studentsLoading ? (
          <div className="assigned-classes-loading">
            <p>Loading students...</p>
          </div>
        ) : (
          <div className="ac-students-container">
            <h3>Students ({students.length})</h3>
            {students.length === 0 ? (
              <p className="ac-no-students">No students found for this subject.</p>
            ) : (
              <div className="ac-students-horizontal-grid">
                {students.map(student => (
                  <div key={student.id} className="ac-student-card-item">
                    <div className="ac-student-card-info">
                      <h4>{student.full_name}</h4>
                      <p className="ac-student-card-username">@{student.username}</p>
                      <div className="ac-student-card-details">
                        <span className="ac-student-badge-gender">{student.gender}</span>
                        {student.age && <span className="ac-student-badge-age">{student.age} years</span>}
                        {student.department && (
                          <span className="ac-student-badge-department">{student.department}</span>
                        )}
                      </div>
                    </div>
                    <div className="ac-student-card-actions">
                      <button
                        className="ac-action-button"
                        onClick={() => handleViewProfile(student)}
                      >
                        View Submissions
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Student Submissions Modal */}
        {showSubmissionsModal && selectedStudent && (
          <StudentSubmissionsModal
            student={selectedStudent}
            onClose={handleCloseSubmissionsModal}
          />
        )}
      </div>
    );
  }

  // Show subjects grouped by class
  return (
    <div className="assigned-classes-container">
      <div className="assigned-classes-header">
        <h2>My Assigned Subjects</h2>
        <p>Click on any subject to view students and manage class content</p>
      </div>

      {subjects.length === 0 ? (
        <div className="no-subjects">
          <h3>No Subjects Assigned</h3>
          <p>You haven't been assigned any subjects yet. Please contact your administrator.</p>
        </div>
      ) : (
        <div className="classes-grid-desktop">
          {subjects.map((classData, classIndex) => (
            <div key={classIndex} className="class-section">
              <div className="class-header">
                <h3>{classData.classroom}</h3>
                <p className="class-session">{classData.academic_year} - {classData.term}</p>
              </div>
              
              <div className="subjects-tiles">
                {classData.subjects.map(subject => (
                  <div 
                    key={subject.id} 
                    className="subject-tile"
                    onClick={() => fetchSubjectStudents(subject.id, subject.name)}
                  >
                    <div className="subject-tile-content">
                      <h4 className="subject-name">{subject.name}</h4>
                      {subject.department !== 'General' && (
                        <span className="subject-department">{subject.department}</span>
                      )}
                    </div>
                    <div className="subject-tile-arrow">→</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AssignedClasses;