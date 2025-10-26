// src/pages/AdminDashboard.jsx
import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import ClassForm from '../components/ClassForm';
import ViewClasses from '../components/ViewClasses';
import CreateStudentForm from '../components/CreateStudentForm';
import CreateSubjectForm from '../components/CreateSubjectForm';
import CreateTeacherForm from '../components/CreateTeacherForm';
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
import './AdminDashboard.css';

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

const AdminDashboard = () => {
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
    const storedUserName = localStorage.getItem('userName') || 'Admin';
    setUserName(storedUserName);
  }, [location.search]);

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <div>
            <h2 className="admin-dashboard-greeting">{getGreeting()}, {userName}</h2>
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
        return (
          <div className="admin-dashboard-section">
            <h2 className="admin-dashboard-section-title">Reports</h2>
            <p className="admin-dashboard-section-text">Generate and view comprehensive reports for your school.</p>
          </div>
        );
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
      case 'results': // NEW CASE
        return <ViewResults />;
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
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <main className="admin-dashboard-main">
        {renderContent()}
      </main>
    </div>
  );
};

export default AdminDashboard;