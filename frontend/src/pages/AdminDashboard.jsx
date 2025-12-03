// src/pages/AdminDashboard.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import ClassForm from '../components/ClassForm';
import ViewClasses from '../components/ViewClasses';
import CreateStudentForm from '../components/CreateStudentForm';
import CreateSubjectForm from '../components/CreateSubjectForm';
import CreateTeacherForm from '../components/CreateTeacherForm';
import CreatePrincipalForm from '../components/CreatePrincipalForm';
import CreateParentForm from '../components/CreateParentForm';
import ViewSubjects from '../components/ViewSubjects';
import ActivityLog from '../components/ActivityLog';
import ViewUsers from '../components/ViewUsers';
import CreateFeeStructure from '../components/CreateFeeStructure';
import Analytics from '../components/Analytics';
import CreateAttendance from '../components/CreateAttendance';
import AttendanceMarking from '../components/AttendanceMarking';
import Settings from '../components/Settings';
import ViewResults from '../components/ViewResults'; // NEW IMPORT
import ReviewQuestions from '../components/ReviewQuestions';
import ReportSheet from '../components/ReportSheet';
import AdminFeeReceipts from '../components/AdminFeeReceipts';
import Announcements from '../components/Announcements';
import TopHeader from '../components/TopHeader';
import SessionManagement from '../components/SessionManagement';
import AdminProfileSettings from '../components/AdminProfileSettings';
import './AdminDashboard.css';

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

const AdminDashboard = () => {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('analytics');
  const [userName, setUserName] = useState('');
  const [showProfileSettings, setShowProfileSettings] = useState(false);
  const sidebarRef = useRef(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    if (tab) {
      setActiveTab(tab);
    }

    // Get user name from localStorage
    const storedUserName = localStorage.getItem('userName') || 'Admin';
    setUserName(storedUserName);
  }, [location.search]);

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <div>
            <p className="admin-dashboard-subtitle">Welcome to the admin dashboard. Manage your school's operations from here.</p>
            <div className="admin-dashboard-grid">
              <div className="admin-dashboard-card">
                <h3 className="admin-dashboard-card-title">User Management</h3>
                <p className="admin-dashboard-card-text">Create and manage students, teachers, and parents by clicking on 'manage users' in sidebar.</p>
              </div>
              <div className="admin-dashboard-card">
                <h3 className="admin-dashboard-card-title">Academic Management</h3>
                <p className="admin-dashboard-card-text">Manage classes, subjects, and academic sessions by using 'Manage classes' or 'Manage subjects' in the sidebar.</p>
              </div>
              <div className="admin-dashboard-card">
                <h3 className="admin-dashboard-card-title">School Data</h3>
                <p className="admin-dashboard-card-text">Handle attendance, fees, and academic results from the 'School data' option in the sidebar.</p>
              </div>
              <div className="admin-dashboard-card">
                <h3 className="admin-dashboard-card-title">Reports & Analytics</h3>
                <p className="admin-dashboard-card-text">View comprehensive reports and system analytics from 'Dashboard' option in the sidebar.</p>
              </div>
            </div>
          </div>
        );
      case 'analytics':
        return <Analytics />;
      case 'reports':
        return <ReportSheet />;
      case 'activity-logs':
        return <ActivityLog />;
      case 'profile':
        return (
          <div className="admin-dashboard-section">
            <h2 className="admin-dashboard-section-title">Profile</h2>
            <p className="admin-dashboard-section-text">Manage your admin profile information and account settings.</p>
          </div>
        );
      case 'settings':
        return <Settings />;
      case 'create-class':
        return <ClassForm />;
      case 'view-classes':
        return <ViewClasses />;
      case 'create-student':
        return <CreateStudentForm />;
      case 'create-parent':
        return <CreateParentForm />;
      case 'create-subject':
        return <CreateSubjectForm />;
      case 'create-teacher':
        return <CreateTeacherForm />;
      case 'create-principal':
        return <CreatePrincipalForm />;
      case 'view-subjects':
        return <ViewSubjects />;
      case 'view-users':
        return <ViewUsers />;
      case 'attendance':
        return <CreateAttendance />;
      case 'mark-attendance':
        return <AttendanceMarking />;
      case 'fees':
        return <CreateFeeStructure />;
      case 'fee-receipts':
        return <AdminFeeReceipts />;
      case 'results': // NEW CASE
        return <ViewResults />;
      case 'review-questions':
        return <ReviewQuestions />;
      case 'announcements':
        return <Announcements />;
      default:
        return (
          <div className="admin-dashboard-section">
            <p className="admin-dashboard-section-text">Select a section from the sidebar to get started.</p>
          </div>
        );
    }
  };

  return (
    <div className="admin-dashboard-container">
      <Sidebar ref={sidebarRef} activeTab={activeTab} setActiveTab={setActiveTab} />
      <TopHeader
        onMenuClick={() => sidebarRef.current?.openSidebar()}
        onSettingsClick={() => setShowProfileSettings(true)}
      />
      <main className="admin-dashboard-main">
        <div className="admin-dashboard-header-container">
          <div className="admin-dashboard-header-left">
            <h2 className="admin-dashboard-greeting">{getGreeting()}, {userName} 😊</h2>
          </div>
          <div className="admin-dashboard-header-right">
            <SessionManagement />
          </div>
        </div>
        {renderContent()}
      </main>

      {showProfileSettings && (
        <AdminProfileSettings onClose={() => setShowProfileSettings(false)} />
      )}
    </div>
  );
};

export default AdminDashboard;