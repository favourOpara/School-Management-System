// src/pages/StudentDashboard.jsx
import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import RoleBasedSidebar from '../components/RoleBasedSidebar';
import ActivityLog from '../components/ActivityLog';
import StudentAssignments from '../components/StudentAssignments';
import MyGrades from '../components/MyGrades'; // NEW IMPORT
import AvailableAssessments from '../components/AvailableAssessments';
import './StudentDashboard.css';

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

const StudentDashboard = () => {
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
    const storedUserName = localStorage.getItem('userName') || 'Student';
    setUserName(storedUserName);
  }, [location.search]);

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <div>
            <h2 className="student-dashboard-greeting">{getGreeting()}, {userName}</h2>
            <p className="student-dashboard-subtitle">Welcome to your student dashboard.</p>
            <div className="student-dashboard-grid">
              <div className="student-dashboard-card">
                <h3 className="student-dashboard-card-title">My Classes</h3>
                <p className="student-dashboard-card-text">View your enrolled classes and schedules.</p>
              </div>
              <div className="student-dashboard-card">
                <h3 className="student-dashboard-card-title">My Grades</h3>
                <p className="student-dashboard-card-text">Check your academic performance and results.</p>
              </div>
              <div className="student-dashboard-card">
                <h3 className="student-dashboard-card-title">Attendance</h3>
                <p className="student-dashboard-card-text">View your attendance records.</p>
              </div>
              <div className="student-dashboard-card">
                <h3 className="student-dashboard-card-title">Notifications</h3>
                <p className="student-dashboard-card-text">Check your latest notifications and updates.</p>
              </div>
            </div>
          </div>
        );
      case 'my-classes':
        return (
          <div className="student-dashboard-section">
            <h2 className="student-dashboard-section-title">My Classes</h2>
            <p className="student-dashboard-section-text">Here you can view all your enrolled classes and class schedules.</p>
          </div>
        );
      case 'my-grades':
        return <MyGrades />; // USE THE NEW COMPONENT
      case 'assignments':
        return <StudentAssignments />;
      case 'assessments':
        return <AvailableAssessments />;
      case 'my-attendance':
        return (
          <div className="student-dashboard-section">
            <h2 className="student-dashboard-section-title">My Attendance</h2>
            <p className="student-dashboard-section-text">Track your attendance records.</p>
          </div>
        );
      case 'activity-logs':
        return <ActivityLog />;
      case 'profile':
        return (
          <div className="student-dashboard-section">
            <h2 className="student-dashboard-section-title">Profile</h2>
            <p className="student-dashboard-section-text">Manage your profile information.</p>
          </div>
        );
      case 'settings':
        return (
          <div className="student-dashboard-section">
            <h2 className="student-dashboard-section-title">Settings</h2>
            <p className="student-dashboard-section-text">Adjust your account settings and preferences.</p>
          </div>
        );
      default:
        return (
          <div className="student-dashboard-section">
            <p className="student-dashboard-section-text">Select a section from the sidebar.</p>
          </div>
        );
    }
  };

  return (
    <div className="student-dashboard-container">
      <RoleBasedSidebar 
        userRole="student" 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
      />
      <main className="student-dashboard-main">
        {renderContent()}
      </main>
    </div>
  );
};

export default StudentDashboard;