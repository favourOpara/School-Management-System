// src/pages/StudentDashboard.jsx
import React, { useState, useEffect, useRef, Suspense } from 'react';
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
import PasswordChange from '../components/PasswordChange';
import AttendanceLeaderboard from '../components/AttendanceLeaderboard';
import SubjectRankings from '../components/SubjectRankings';
import MySubjectGrades from '../components/MySubjectGrades';
import FeeStatus from '../components/FeeStatus';
import MyClasses from '../components/MyClasses';
import StudentWelcome from '../components/StudentWelcome';
import StudentLessonNotes from '../components/StudentLessonNotes';
import { useSchool } from '../contexts/SchoolContext';
import './StudentDashboard.css';

const UserGuide = React.lazy(() => import('../components/UserGuide'));

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

const StudentDashboard = () => {
  const location = useLocation();
  const { school } = useSchool();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [userName, setUserName] = useState('');
  const [showPasswordChange, setShowPasswordChange] = useState(false);
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
            <StudentWelcome userName={userName} />

            <div className="dashboard-records-grid">
              <AttendanceLeaderboard />
              <SubjectRankings />
              <MySubjectGrades type="highest" />
              <MySubjectGrades type="lowest" />
              <FeeStatus />
            </div>
          </div>
        );
      case 'my-classes':
        return <MyClasses />;
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
      case 'lesson-notes':
        return <StudentLessonNotes />;
      case 'user-guide':
        return (
          <Suspense fallback={<div className="kb-loading">Loading...</div>}>
            <UserGuide userRole="student" />
          </Suspense>
        );
      default:
        return (
          <div className="student-dashboard-section">
            <p className="student-dashboard-section-text">Select a section from the sidebar.</p>
          </div>
        );
    }
  };

  // Apply accent color as CSS variable at the container level
  const containerStyle = school?.accent_color ? {
    '--accent-color': school.accent_color,
    '--accent-color-dark': school.secondary_color || school.accent_color,
    '--sidebar-accent': school.accent_color,
    '--sidebar-accent-dark': school.secondary_color || school.accent_color,
  } : {};

  return (
    <div className="student-dashboard-container" style={containerStyle}>
      <RoleBasedSidebar
        ref={sidebarRef}
        userRole="student"
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />
      <TopHeader
        onMenuClick={() => sidebarRef.current?.openSidebar()}
        onPasswordChangeClick={() => setShowPasswordChange(true)}
      />
      <main className="student-dashboard-main">
        {renderContent()}
      </main>
      <NotificationPopup />
      {showPasswordChange && (
        <PasswordChange onClose={() => setShowPasswordChange(false)} />
      )}
    </div>
  );
};

export default StudentDashboard;