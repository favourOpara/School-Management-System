// src/pages/TeacherDashboard.jsx
import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import RoleBasedSidebar from '../components/RoleBasedSidebar';
import AssignedClasses from '../components/AssignedClasses';
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

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <div>
            <h2 className="teacher-dashboard-greeting">{getGreeting()}, {userName}</h2>
            <p className="teacher-dashboard-subtitle">Welcome to your teacher dashboard.</p>
            <div className="teacher-dashboard-grid">
              <div className="teacher-dashboard-card">
                <h3 className="teacher-dashboard-card-title">My Classes</h3>
                <p className="teacher-dashboard-card-text">Manage your assigned classes and students by navigating to the sidebar and selecting 'My Classes'.</p>
              </div>
              <div className="teacher-dashboard-card">
                <h3 className="teacher-dashboard-card-title">Grade Students</h3>
                <p className="teacher-dashboard-card-text">Record and manage student grades and assessments by navigating to sidebar and selecting 'Grading'.</p>
              </div>
              <div className="teacher-dashboard-card">
                <h3 className="teacher-dashboard-card-title">Attendance</h3>
                <p className="teacher-dashboard-card-text">Take and review student attendance records by navigating to sidebar and selecting 'Attendance'.</p>
              </div>
            </div>
          </div>
        );
      case 'assigned-classes':
        return <AssignedClasses />;
      case 'student-list':
        return (
          <div className="teacher-dashboard-section">
            <h2 className="teacher-dashboard-section-title">Student List</h2>
            <p className="teacher-dashboard-section-text">View all students in your classes.</p>
          </div>
        );
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
        userRole="teacher" 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
      />
      <main className="teacher-dashboard-main">
        {renderContent()}
      </main>
    </div>
  );
};

export default TeacherDashboard;