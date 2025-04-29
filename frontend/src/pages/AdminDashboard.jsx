import React, { useState } from 'react';
import Sidebar from '../components/Sidebar';
import ClassForm from '../components/ClassForm';
import ViewClasses from '../components/ViewClasses';
import CreateStudentForm from '../components/CreateStudentForm';
import CreateSubjectForm from '../components/CreateSubjectForm';
import CreateTeacherForm from '../components/CreateTeacherForm';
import CreateParentForm from '../components/CreateParentForm';
import ViewSubjects from '../components/ViewSubjects';
import ActivityLog from '../components/ActivityLog';
import ViewUsers from '../components/ViewUsers'; // ✅ Added this

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('dashboard');

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <div>
            <h2>{getGreeting()}, Admin</h2>
            <p>This is your admin dashboard.</p>
          </div>
        );
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
        return <ViewUsers />; // ✅ Replace placeholder with actual component
      case 'activity-logs':
        return <ActivityLog />;
      case 'profile':
        return <div><h2>Profile</h2><p>Your profile info here.</p></div>;
      case 'settings':
        return <div><h2>Settings</h2><p>Settings options here.</p></div>;
      case 'analytics':
        return <div><h2>Analytics</h2><p>Analytics content.</p></div>;
      case 'reports':
        return <div><h2>Reports</h2><p>Reports content.</p></div>;
      default:
        return <p>Select a section from the sidebar.</p>;
    }
  };

  return (
    <div style={{ display: 'flex',  }}>
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <div style={{ marginLeft: '100px', padding: '1rem', flex: 1 }}>
        {renderContent()}
      </div>
    </div>
  );
};

export default AdminDashboard;
