// src/pages/AdminDashboard.jsx
import React, { useState } from 'react';
import Sidebar from '../components/Sidebar';
import ClassForm from '../components/ClassForm';
import ViewClasses from '../components/ViewClasses';

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
      case 'create-class':
        return <ClassForm />;
      case 'view-classes':
        return <ViewClasses />;
      case 'dashboard':
        return (
          <div>
            <h2>{getGreeting()}, Admin</h2>
            <p>This is your admin dashboard.</p>
          </div>
        );
      case 'profile':
        return <div><h2>Profile</h2><p>Your profile info here.</p></div>;
      case 'settings':
        return <div><h2>Settings</h2><p>Settings options here.</p></div>;
      case 'analytics':
        return <div><h2>Analytics</h2><p>Analytics content.</p></div>;
      case 'reports':
        return <div><h2>Reports</h2><p>Reports content.</p></div>;
      case 'create-user':
        return <div><h2>Create User</h2><p>User creation form.</p></div>;
      case 'view-users':
        return <div><h2>View Users</h2><p>List of users.</p></div>;
      default:
        return <p>Select a section from the sidebar.</p>;
    }
  };

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <div style={{ marginLeft: '100px', padding: '1rem', flex: 1 }}>
        {renderContent()}
      </div>
    </div>
  );
};

export default AdminDashboard;
