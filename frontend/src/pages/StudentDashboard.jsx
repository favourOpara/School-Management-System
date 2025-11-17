// src/pages/StudentDashboard.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import RoleBasedSidebar from '../components/RoleBasedSidebar';
import ActivityLog from '../components/ActivityLog';
import StudentAssignments from '../components/StudentAssignments';
import MyGrades from '../components/MyGrades'; // NEW IMPORT
import AvailableAssessments from '../components/AvailableAssessments';
import StudentAttendanceReport from '../components/StudentAttendanceReport';
import StudentGradeReport from '../components/StudentGradeReport';
import NotificationPopup from '../components/NotificationPopup';
import TopHeader from '../components/TopHeader';
import AttendanceLeaderboard from '../components/AttendanceLeaderboard';
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
  const sidebarRef = useRef(null);

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
          <div className="student-home-dashboard">
            <div className="dashboard-welcome">
              <h2 className="student-dashboard-greeting">{getGreeting()}, {userName.split(' ')[0]} 👋</h2>
              <p className="student-dashboard-subtitle">Here's what's happening in your class</p>
            </div>

            <div className="dashboard-records-grid">
              <AttendanceLeaderboard />
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
        return <StudentAttendanceReport />;
      case 'activity-logs':
        return <ActivityLog />;
      case 'report-sheet':
        return <StudentGradeReport />;
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
        ref={sidebarRef}
        userRole="student"
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />
      <TopHeader onMenuClick={() => sidebarRef.current?.openSidebar()} />
      <main className="student-dashboard-main">
        {renderContent()}
      </main>
      <NotificationPopup />
    </div>
  );
};

export default StudentDashboard;