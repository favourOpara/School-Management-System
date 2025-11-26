// src/pages/ParentDashboard.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { DollarSign, Users, AlertCircle, CheckCircle, Clock, Trophy, Lock, TrendingDown, ClipboardList } from 'lucide-react';
import RoleBasedSidebar from '../components/RoleBasedSidebar';
import ParentAttendanceReport from '../components/ParentAttendanceReport';
import ParentGradeReport from '../components/ParentGradeReport';
import ParentAnnouncements from '../components/ParentAnnouncements';
import FeesReceipt from '../components/FeesReceipt';
import NotificationPopup from '../components/NotificationPopup';
import TopHeader from '../components/TopHeader';
import PasswordChange from '../components/PasswordChange';
import API_BASE_URL from '../config';

import './ParentDashboard.css';

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

const ParentDashboard = () => {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [userName, setUserName] = useState('');
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [children, setChildren] = useState([]);
  const [selectedChild, setSelectedChild] = useState(null);
  const [feesData, setFeesData] = useState(null);
  const [academicData, setAcademicData] = useState(null);
  const [subjectGrades, setSubjectGrades] = useState(null);
  const [assignmentsData, setAssignmentsData] = useState(null);
  const [loadingChildren, setLoadingChildren] = useState(true);
  const [loadingFees, setLoadingFees] = useState(false);
  const [loadingAcademic, setLoadingAcademic] = useState(false);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const sidebarRef = useRef(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    if (tab) {
      setActiveTab(tab);
    }

    // Get user name from localStorage
    const storedUserName = localStorage.getItem('userName') || 'Parent';
    setUserName(storedUserName);

    // Fetch children data
    fetchChildren();
  }, [location.search]);

  useEffect(() => {
    if (selectedChild) {
      fetchFeesData(selectedChild.id);
      fetchAcademicData(selectedChild.id);
      fetchSubjectGrades(selectedChild.id);
      fetchAssignments(selectedChild.id);
    }
  }, [selectedChild]);

  const fetchChildren = async () => {
    try {
      setLoadingChildren(true);
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${API_BASE_URL}/api/schooladmin/parent/children/`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setChildren(data.children || []);
        if (data.children && data.children.length > 0) {
          setSelectedChild(data.children[0]);
        }
      }
    } catch (err) {
      console.error('Error fetching children:', err);
    } finally {
      setLoadingChildren(false);
    }
  };

  const fetchFeesData = async (childId) => {
    try {
      setLoadingFees(true);
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${API_BASE_URL}/api/schooladmin/parent/child/${childId}/fees/`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setFeesData(data);
      }
    } catch (err) {
      console.error('Error fetching fees:', err);
    } finally {
      setLoadingFees(false);
    }
  };

  const fetchAcademicData = async (childId) => {
    try {
      setLoadingAcademic(true);
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${API_BASE_URL}/api/schooladmin/parent/child/${childId}/academic/`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setAcademicData(data);
      }
    } catch (err) {
      console.error('Error fetching academic data:', err);
    } finally {
      setLoadingAcademic(false);
    }
  };

  const fetchSubjectGrades = async (childId) => {
    try {
      setLoadingSubjects(true);
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${API_BASE_URL}/api/schooladmin/parent/child/${childId}/subjects/`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setSubjectGrades(data);
      }
    } catch (err) {
      console.error('Error fetching subject grades:', err);
    } finally {
      setLoadingSubjects(false);
    }
  };

  const fetchAssignments = async (childId) => {
    try {
      setLoadingAssignments(true);
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${API_BASE_URL}/api/schooladmin/parent/child/${childId}/assignments/`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setAssignmentsData(data);
      }
    } catch (err) {
      console.error('Error fetching assignments:', err);
    } finally {
      setLoadingAssignments(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0
    }).format(amount || 0);
  };

  const getScoreColor = (score) => {
    if (score >= 70) return '#2e7d32'; // Green
    if (score >= 50) return '#f9a825'; // Yellow/Orange
    return '#c62828'; // Red
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <div className="parent-overview">
            <div className="parent-welcome-section">
              <h2 className="parent-dashboard-greeting">{getGreeting()}, {userName.split(' ')[0]}</h2>
              <p className="parent-dashboard-subtitle">
                Monitor your children's school activities, academic progress, and stay informed about their education journey.
              </p>
            </div>

            {/* Child Selector */}
            {children.length > 1 && (
              <div className="child-selector">
                <label>
                  <Users size={18} />
                  Select Child:
                </label>
                <select
                  value={selectedChild?.id || ''}
                  onChange={(e) => {
                    const child = children.find(c => c.id === parseInt(e.target.value));
                    setSelectedChild(child);
                  }}
                >
                  {children.map(child => (
                    <option key={child.id} value={child.id}>
                      {child.first_name} {child.last_name} - {child.class_name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {loadingChildren ? (
              <div className="loading-state">
                <Clock size={32} className="spin" />
                <p>Loading children's information...</p>
              </div>
            ) : children.length === 0 ? (
              <div className="no-children-state">
                <Users size={48} />
                <h3>No Children Linked</h3>
                <p>No children are currently linked to your account. Please contact the school administration.</p>
              </div>
            ) : (
              <div className="parent-dashboard-tiles">
                {/* Fees Information Tile */}
                <div className="parent-tile fees-tile">
                  <div className="tile-header">
                    <DollarSign size={24} />
                    <h3>School Fees</h3>
                  </div>

                  {selectedChild && (
                    <div className="child-info-badge">
                      {selectedChild.first_name} {selectedChild.last_name}
                    </div>
                  )}

                  {loadingFees ? (
                    <div className="tile-loading">
                      <Clock size={20} className="spin" />
                      <span>Loading fees...</span>
                    </div>
                  ) : feesData ? (
                    <div className="fees-details">
                      <div className="fee-item">
                        <span className="fee-label">Total School Fees</span>
                        <span className="fee-amount total">{formatCurrency(feesData.total_fees)}</span>
                      </div>
                      <div className="fee-item">
                        <span className="fee-label">Amount Paid</span>
                        <span className="fee-amount paid">{formatCurrency(feesData.amount_paid)}</span>
                      </div>
                      <div className="fee-item highlight">
                        <span className="fee-label">Outstanding Balance</span>
                        <span className={`fee-amount balance ${feesData.balance > 0 ? 'owing' : 'cleared'}`}>
                          {formatCurrency(feesData.balance)}
                        </span>
                      </div>
                      <div className="fee-status">
                        {feesData.balance === 0 ? (
                          <span className="status-badge paid">
                            <CheckCircle size={16} />
                            Fully Paid
                          </span>
                        ) : feesData.balance > 0 ? (
                          <span className="status-badge owing">
                            <AlertCircle size={16} />
                            Outstanding Balance
                          </span>
                        ) : null}
                      </div>
                      {feesData.last_payment_date && (
                        <div className="last-payment">
                          Last payment: {new Date(feesData.last_payment_date).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="no-fees-data">
                      <p>No fees information available</p>
                    </div>
                  )}
                </div>

                {/* Academic Position Tile */}
                <div className={`parent-tile academic-tile ${feesData && feesData.balance > 0 ? 'blurred' : ''}`}>
                  <div className="tile-header">
                    <Trophy size={24} />
                    <h3>Academic Position</h3>
                  </div>

                  {selectedChild && (
                    <div className="child-info-badge">
                      {selectedChild.first_name} {selectedChild.last_name}
                    </div>
                  )}

                  {feesData && feesData.balance > 0 ? (
                    <div className="tile-locked">
                      <Lock size={48} />
                      <h4>Content Locked</h4>
                      <p>Please complete fee payment to view academic position</p>
                      <span className="balance-reminder">
                        Outstanding: {formatCurrency(feesData.balance)}
                      </span>
                    </div>
                  ) : loadingAcademic ? (
                    <div className="tile-loading">
                      <Clock size={20} className="spin" />
                      <span>Loading academic data...</span>
                    </div>
                  ) : academicData ? (
                    <div className="academic-details">
                      <div className="position-display">
                        <span className="position-number">{academicData.position}</span>
                        <span className="position-suffix">
                          {academicData.position === 1 ? 'st' : academicData.position === 2 ? 'nd' : academicData.position === 3 ? 'rd' : 'th'}
                        </span>
                      </div>
                      <div className="position-label">
                        out of {academicData.total_students} students
                      </div>
                      <div className="average-display">
                        <span className="average-label">Average Score</span>
                        <span className="average-value">{academicData.average_percentage}%</span>
                      </div>
                      <div className="grade-display-parent">
                        <span className="grade-label">Overall Grade</span>
                        <span className={`grade-letter ${academicData.grade_letter}`}>
                          {academicData.grade_letter}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="no-academic-data">
                      <p>No academic data available yet</p>
                    </div>
                  )}
                </div>

                {/* Subjects Needing Improvement Tile */}
                <div className="parent-tile improvement-tile">
                  <div className="tile-header">
                    <TrendingDown size={24} />
                    <h3>Needs Improvement</h3>
                  </div>

                  {selectedChild && (
                    <div className="child-info-badge">
                      {selectedChild.first_name} {selectedChild.last_name}
                    </div>
                  )}

                  {loadingSubjects ? (
                    <div className="tile-loading">
                      <Clock size={20} className="spin" />
                      <span>Loading subjects...</span>
                    </div>
                  ) : subjectGrades && subjectGrades.lowest_subjects && subjectGrades.lowest_subjects.length > 0 ? (
                    <div className="improvement-list">
                      <p className="improvement-note">Focus on these subjects for better performance</p>
                      {subjectGrades.lowest_subjects.map((subject, index) => (
                        <div key={subject.subject_id} className="improvement-item">
                          <div className="improvement-rank">
                            <span className="rank-number">{index + 1}</span>
                          </div>
                          <div className="improvement-subject-info">
                            <h4 className="improvement-subject-name">{subject.subject_name}</h4>
                            <span className="improvement-teacher">{subject.teacher_name}</span>
                          </div>
                          <div className="improvement-score">
                            <span className="score-value" style={{ color: getScoreColor(subject.total_score) }}>
                              {subject.total_score.toFixed(1)}
                            </span>
                            <span className="score-max">/ 100</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="no-improvement-data">
                      <p>No subject data available or all subjects performing well</p>
                    </div>
                  )}
                </div>

                {/* Assignments Tile */}
                <div className="parent-tile assignments-tile">
                  <div className="tile-header">
                    <ClipboardList size={24} />
                    <h3>Pending Assignments</h3>
                  </div>

                  {selectedChild && (
                    <div className="child-info-badge">
                      {selectedChild.first_name} {selectedChild.last_name}
                    </div>
                  )}

                  {loadingAssignments ? (
                    <div className="tile-loading">
                      <Clock size={20} className="spin" />
                      <span>Loading assignments...</span>
                    </div>
                  ) : assignmentsData && assignmentsData.assignments && assignmentsData.assignments.length > 0 ? (
                    <div className="assignments-content">
                      <div className="assignments-summary">
                        {assignmentsData.total_overdue > 0 && (
                          <span className="summary-badge overdue">
                            <AlertCircle size={14} />
                            {assignmentsData.total_overdue} Overdue
                          </span>
                        )}
                        {assignmentsData.total_pending > 0 && (
                          <span className="summary-badge pending">
                            <Clock size={14} />
                            {assignmentsData.total_pending} Pending
                          </span>
                        )}
                      </div>
                      <div className="assignments-list">
                        {assignmentsData.assignments.slice(0, 3).map((assignment) => (
                          <div key={assignment.id} className={`assignment-item ${assignment.is_overdue ? 'overdue' : 'pending'}`}>
                            <div className="assignment-status-indicator">
                              {assignment.is_overdue ? (
                                <AlertCircle size={16} className="status-icon overdue" />
                              ) : (
                                <Clock size={16} className="status-icon pending" />
                              )}
                            </div>
                            <div className="assignment-info">
                              <h4 className="assignment-title">{assignment.title}</h4>
                              <div className="assignment-meta">
                                <span className="assignment-subject">{assignment.subject_name}</span>
                                {assignment.due_date && (
                                  <span className="assignment-due">
                                    Due: {new Date(assignment.due_date).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                              {assignment.is_overdue && assignment.days_overdue > 0 && (
                                <span className="overdue-badge">
                                  {assignment.days_overdue} {assignment.days_overdue === 1 ? 'day' : 'days'} overdue
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                      {assignmentsData.total_count > 3 && (
                        <div className="assignments-footer">
                          <span className="more-assignments">
                            +{assignmentsData.total_count - 3} more assignment{assignmentsData.total_count - 3 > 1 ? 's' : ''}
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="no-assignments-data">
                      <CheckCircle size={32} style={{ color: '#4caf50', marginBottom: '0.5rem' }} />
                      <p>All assignments completed!</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      case 'children-overview':
        return (
          <div className="parent-dashboard-section">
            <h2 className="parent-dashboard-section-title">Children Overview</h2>
            <p className="parent-dashboard-section-text">View detailed information about all your children.</p>
          </div>
        );
      case 'academic-progress':
        return (
          <div className="parent-dashboard-section">
            <h2 className="parent-dashboard-section-title">Academic Progress</h2>
            <p className="parent-dashboard-section-text">Track your children's academic performance and progress.</p>
          </div>
        );
      case 'grade-reports':
        return <ParentGradeReport />;
      case 'attendance-reports':
        return <ParentAttendanceReport />;
      case 'fee-receipts':
        return <FeesReceipt />;
      case 'messages':
        return (
          <div className="parent-dashboard-section">
            <h2 className="parent-dashboard-section-title">Messages</h2>
            <p className="parent-dashboard-section-text">View messages from teachers and school administration.</p>
          </div>
        );
      case 'announcements':
        return <ParentAnnouncements />;
      case 'profile':
        return (
          <div className="parent-dashboard-section">
            <h2 className="parent-dashboard-section-title">Profile</h2>
            <p className="parent-dashboard-section-text">Manage your profile information and contact details.</p>
          </div>
        );
      case 'settings':
        return (
          <div className="parent-dashboard-section">
            <h2 className="parent-dashboard-section-title">Settings</h2>
            <p className="parent-dashboard-section-text">Adjust your account settings and notification preferences.</p>
          </div>
        );
      default:
        return (
          <div className="parent-dashboard-section">
            <p className="parent-dashboard-section-text">Select a section from the sidebar.</p>
          </div>
        );
    }
  };

  return (
    <div className="parent-dashboard-container">
      <RoleBasedSidebar
        ref={sidebarRef}
        userRole="parent"
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />
      <TopHeader
        onMenuClick={() => sidebarRef.current?.openSidebar()}
        onPasswordChangeClick={() => setShowPasswordChange(true)}
      />
      <main className="parent-dashboard-main">
        {renderContent()}
      </main>
      <NotificationPopup />
      {showPasswordChange && (
        <PasswordChange onClose={() => setShowPasswordChange(false)} />
      )}
    </div>
  );
};

export default ParentDashboard;