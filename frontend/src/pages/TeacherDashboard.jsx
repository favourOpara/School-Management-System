// src/pages/TeacherDashboard.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import RoleBasedSidebar from '../components/RoleBasedSidebar';
import AssignedClasses from '../components/AssignedClasses';
import SetTest from '../components/SetTest';
import SetExam from '../components/SetExam';
import ViewQuestions from '../components/ViewQuestions';
import ManualGrading from '../components/ManualGrading';
import TeacherAnnouncements from '../components/TeacherAnnouncements';
import NotificationPopup from '../components/NotificationPopup';
import TopHeader from '../components/TopHeader';
import PasswordChange from '../components/PasswordChange';
import './TeacherDashboard.css';

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

const TeacherDashboard = () => {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [userName, setUserName] = useState('');
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [gradingStats, setGradingStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedTestSubject, setSelectedTestSubject] = useState(null);
  const [selectedExamSubject, setSelectedExamSubject] = useState(null);
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [modalStudents, setModalStudents] = useState([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalInfo, setModalInfo] = useState({ subjectName: '', className: '', assessmentType: '', isGraded: false });
  const sidebarRef = useRef(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    if (tab) {
      setActiveTab(tab);
    }

    // Get user name from localStorage
    const storedUserName = localStorage.getItem('userName') || 'Teacher';
    setUserName(storedUserName);
  }, [location.search]);

  useEffect(() => {
    if (activeTab === 'dashboard') {
      fetchGradingStats();
    }
  }, [activeTab]);

  const fetchGradingStats = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken');
      const response = await fetch('http://127.0.0.1:8000/api/schooladmin/teacher/grading-stats/', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setGradingStats(data);
        // Set initial selected subjects (first subject or null)
        if (data.subjects && data.subjects.length > 0) {
          setSelectedTestSubject(data.subjects[0].id);
          setSelectedExamSubject(data.subjects[0].id);
        }
      }
    } catch (error) {
      console.error('Error fetching grading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewStudents = async (subjectId, assessmentType, isGraded) => {
    try {
      setModalLoading(true);
      setShowStudentModal(true);

      const subject = gradingStats.subjects.find(s => s.id === subjectId);
      setModalInfo({
        subjectName: subject.name,
        className: subject.class_name,
        assessmentType: assessmentType === 'test' ? 'Test' : 'Exam',
        isGraded: isGraded
      });

      const token = localStorage.getItem('accessToken');
      const endpoint = isGraded ? 'graded-students' : 'incomplete-students';
      const response = await fetch(
        `http://127.0.0.1:8000/api/schooladmin/teacher/${endpoint}/?subject_id=${subjectId}&assessment_type=${assessmentType}`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setModalStudents(data.students);
      } else {
        console.error('Error fetching students');
        setModalStudents([]);
      }
    } catch (error) {
      console.error('Error fetching students:', error);
      setModalStudents([]);
    } finally {
      setModalLoading(false);
    }
  };

  const closeModal = () => {
    setShowStudentModal(false);
    setModalStudents([]);
    setModalInfo({ subjectName: '', className: '', assessmentType: '', isGraded: false });
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <div className="td-main-wrapper">
            <div className="td-page-header">
              <h2>{getGreeting()}, {userName} 😊</h2>
              <p>Here's your grading overview for the current academic session</p>
            </div>

            {loading ? (
              <div className="td-loading">Loading grading statistics...</div>
            ) : gradingStats && gradingStats.subjects && gradingStats.subjects.length > 0 ? (
              <>
              <div className="grading-tiles-container">
                {/* Test Grading Tile */}
                <div className="grading-tile">
                  <div className="grading-tile-header">
                    <h3>Test Grading</h3>
                    <span className="session-badge">{gradingStats.current_session}</span>
                  </div>

                  {gradingStats.subjects.length > 1 && (
                    <div className="subject-selector">
                      <label>Subject:</label>
                      <select
                        value={selectedTestSubject || ''}
                        onChange={(e) => setSelectedTestSubject(parseInt(e.target.value))}
                        className="subject-dropdown"
                      >
                        {gradingStats.subjects.map(subject => (
                          <option key={subject.id} value={subject.id}>
                            {subject.name} - {subject.class_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {(() => {
                    const subject = gradingStats.subjects.find(s => s.id === selectedTestSubject);
                    if (!subject) return null;

                    return (
                      <>
                        {/* Section 1: Graded */}
                        <div
                          className={`grading-section ${subject.test.graded > 0 ? 'clickable' : ''}`}
                          onClick={() => subject.test.graded > 0 && handleViewStudents(subject.id, 'test', true)}
                        >
                          <div className="section-title">Graded</div>
                          <p className="count-display">{subject.test.graded}</p>
                          <p className="section-description">
                            {subject.test.graded > 0
                              ? `student${subject.test.graded !== 1 ? 's' : ''} graded - Click to view`
                              : 'No students graded yet'}
                          </p>
                        </div>

                        {/* Section 2: Awaiting Grading or Not Done */}
                        <div
                          className={`grading-section ${subject.test.awaiting_or_not_done > 0 ? 'clickable' : ''}`}
                          onClick={() => subject.test.awaiting_or_not_done > 0 && handleViewStudents(subject.id, 'test', false)}
                        >
                          <div className="section-title">Awaiting Grading / Not Done</div>
                          <p className="count-display">{subject.test.awaiting_or_not_done}</p>
                          <p className="section-description">
                            {subject.test.awaiting_or_not_done > 0
                              ? `student${subject.test.awaiting_or_not_done !== 1 ? 's' : ''} - Click to view`
                              : 'All graded ✓'}
                          </p>
                        </div>
                      </>
                    );
                  })()}
                </div>

                {/* Exam Grading Tile */}
                <div className="grading-tile">
                  <div className="grading-tile-header">
                    <h3>Exam Grading</h3>
                    <span className="session-badge">{gradingStats.current_session}</span>
                  </div>

                  {gradingStats.subjects.length > 1 && (
                    <div className="subject-selector">
                      <label>Subject:</label>
                      <select
                        value={selectedExamSubject || ''}
                        onChange={(e) => setSelectedExamSubject(parseInt(e.target.value))}
                        className="subject-dropdown"
                      >
                        {gradingStats.subjects.map(subject => (
                          <option key={subject.id} value={subject.id}>
                            {subject.name} - {subject.class_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {(() => {
                    const subject = gradingStats.subjects.find(s => s.id === selectedExamSubject);
                    if (!subject) return null;

                    return (
                      <>
                        {/* Section 1: Graded */}
                        <div
                          className={`grading-section ${subject.exam.graded > 0 ? 'clickable' : ''}`}
                          onClick={() => subject.exam.graded > 0 && handleViewStudents(subject.id, 'exam', true)}
                        >
                          <div className="section-title">Graded</div>
                          <p className="count-display">{subject.exam.graded}</p>
                          <p className="section-description">
                            {subject.exam.graded > 0
                              ? `student${subject.exam.graded !== 1 ? 's' : ''} graded - Click to view`
                              : 'No students graded yet'}
                          </p>
                        </div>

                        {/* Section 2: Awaiting Grading or Not Done */}
                        <div
                          className={`grading-section ${subject.exam.awaiting_or_not_done > 0 ? 'clickable' : ''}`}
                          onClick={() => subject.exam.awaiting_or_not_done > 0 && handleViewStudents(subject.id, 'exam', false)}
                        >
                          <div className="section-title">Awaiting Grading / Not Done</div>
                          <p className="count-display">{subject.exam.awaiting_or_not_done}</p>
                          <p className="section-description">
                            {subject.exam.awaiting_or_not_done > 0
                              ? `student${subject.exam.awaiting_or_not_done !== 1 ? 's' : ''} - Click to view`
                              : 'All graded ✓'}
                          </p>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Second Row - Top 3 and Bottom 3 Students */}
              <div className="grading-tiles-row-2">
                {/* Top 3 Students Tile */}
                <div className="grading-tile">
                  <div className="grading-tile-header">
                    <h3>Top 3 Students</h3>
                    <span className="session-badge">{gradingStats.current_session}</span>
                  </div>

                  {gradingStats.subjects.length > 1 && (
                    <div className="subject-selector">
                      <label>Subject:</label>
                      <select
                        value={selectedTestSubject || ''}
                        onChange={(e) => setSelectedTestSubject(parseInt(e.target.value))}
                        className="subject-dropdown"
                      >
                        {gradingStats.subjects.map(subject => (
                          <option key={subject.id} value={subject.id}>
                            {subject.name} - {subject.class_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {(() => {
                    const subject = gradingStats.subjects.find(s => s.id === selectedTestSubject);
                    if (!subject) return null;

                    const topStudents = subject.test.top_3 || [];
                    return topStudents.length > 0 ? (
                      <ul className="students-ranking-list">
                        {topStudents.map((student, index) => (
                          <li key={student.id}>
                            <div className="rank-number top">{index + 1}</div>
                            <div className="student-info">
                              <div className="name">{student.full_name}</div>
                              <div className="username">@{student.username}</div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="no-rankings-message">
                        No graded students yet
                      </div>
                    );
                  })()}
                </div>

                {/* Bottom 3 Students Tile */}
                <div className="grading-tile">
                  <div className="grading-tile-header">
                    <h3>Bottom 3 Students</h3>
                    <span className="session-badge">{gradingStats.current_session}</span>
                  </div>

                  {gradingStats.subjects.length > 1 && (
                    <div className="subject-selector">
                      <label>Subject:</label>
                      <select
                        value={selectedExamSubject || ''}
                        onChange={(e) => setSelectedExamSubject(parseInt(e.target.value))}
                        className="subject-dropdown"
                      >
                        {gradingStats.subjects.map(subject => (
                          <option key={subject.id} value={subject.id}>
                            {subject.name} - {subject.class_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {(() => {
                    const subject = gradingStats.subjects.find(s => s.id === selectedExamSubject);
                    if (!subject) return null;

                    const bottomStudents = subject.test.bottom_3 || [];
                    return bottomStudents.length > 0 ? (
                      <ul className="students-ranking-list">
                        {bottomStudents.map((student, index) => (
                          <li key={student.id}>
                            <div className="rank-number bottom">{index + 1}</div>
                            <div className="student-info">
                              <div className="name">{student.full_name}</div>
                              <div className="username">@{student.username}</div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="no-rankings-message">
                        No graded students yet
                      </div>
                    );
                  })()}
                </div>
              </div>
              </>
            ) : (
              <div className="td-no-data">No grading data available</div>
            )}
          </div>
        );
      case 'assigned-classes':
        return <AssignedClasses />;
      case 'set-test':
        return <SetTest />;
      case 'set-exam':
        return <SetExam />;
      case 'view-questions':
        return <ViewQuestions />;
      case 'manual-grading':
        return <ManualGrading />;
      case 'announcements':
        return <TeacherAnnouncements />;
      case 'grade-students':
        return (
          <div className="teacher-dashboard-section">
            <h2 className="teacher-dashboard-section-title">Grade Students</h2>
            <p className="teacher-dashboard-section-text">Enter and update student grades and assessments.</p>
          </div>
        );
      case 'view-grades':
        return (
          <div className="teacher-dashboard-section">
            <h2 className="teacher-dashboard-section-title">View Grades</h2>
            <p className="teacher-dashboard-section-text">Review all student grades and performance reports.</p>
          </div>
        );
      case 'take-attendance':
        return (
          <div className="teacher-dashboard-section">
            <h2 className="teacher-dashboard-section-title">Take Attendance</h2>
            <p className="teacher-dashboard-section-text">Record daily attendance for your classes.</p>
          </div>
        );
      case 'attendance-reports':
        return (
          <div className="teacher-dashboard-section">
            <h2 className="teacher-dashboard-section-title">Attendance Reports</h2>
            <p className="teacher-dashboard-section-text">View attendance summaries and reports.</p>
          </div>
        );
      case 'profile':
        return (
          <div className="teacher-dashboard-section">
            <h2 className="teacher-dashboard-section-title">Profile</h2>
            <p className="teacher-dashboard-section-text">Manage your profile information.</p>
          </div>
        );
      case 'settings':
        return (
          <div className="teacher-dashboard-section">
            <h2 className="teacher-dashboard-section-title">Settings</h2>
            <p className="teacher-dashboard-section-text">Adjust your account settings and preferences.</p>
          </div>
        );
      default:
        return (
          <div className="teacher-dashboard-section">
            <p className="teacher-dashboard-section-text">Select a section from the sidebar.</p>
          </div>
        );
    }
  };

  return (
    <div className="teacher-dashboard-container">
      <RoleBasedSidebar
        ref={sidebarRef}
        userRole="teacher"
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />
      <TopHeader
        onMenuClick={() => sidebarRef.current?.openSidebar()}
        onPasswordChangeClick={() => setShowPasswordChange(true)}
      />
      <main className="teacher-dashboard-main">
        {renderContent()}
      </main>

      {/* Student List Modal */}
      {showStudentModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>
                  {modalInfo.isGraded
                    ? `Students Who Have Been Graded - ${modalInfo.assessmentType}`
                    : `Students Awaiting Grading / Not Done - ${modalInfo.assessmentType}`
                  }
                </h3>
                <p className="modal-subtitle">{modalInfo.subjectName} - {modalInfo.className}</p>
              </div>
              <button className="modal-close-btn" onClick={closeModal}>×</button>
            </div>
            <div className="modal-body">
              {modalLoading ? (
                <div className="modal-loading">Loading students...</div>
              ) : modalStudents.length > 0 ? (
                <div className="students-list">
                  <table className="modal-students-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Name</th>
                        <th>Username</th>
                        {!modalInfo.isGraded && <th>Status</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {modalStudents.map((student, index) => (
                        <tr key={student.id}>
                          <td>{index + 1}</td>
                          <td>{student.full_name}</td>
                          <td>{student.username}</td>
                          {!modalInfo.isGraded && (
                            <td>
                              <span className={`status-badge ${student.status === 'Not Done' ? 'status-not-done' : 'status-awaiting'}`}>
                                {student.status}
                              </span>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="modal-footer">
                    <p>Total: {modalStudents.length} student{modalStudents.length !== 1 ? 's' : ''}</p>
                  </div>
                </div>
              ) : (
                <div className="modal-no-data">
                  All students have completed the {modalInfo.assessmentType.toLowerCase()}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      <NotificationPopup />
      {showPasswordChange && (
        <PasswordChange onClose={() => setShowPasswordChange(false)} />
      )}
    </div>
  );
};

export default TeacherDashboard;