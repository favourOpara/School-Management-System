// src/pages/ParentDashboard.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import RoleBasedSidebar from '../components/RoleBasedSidebar';
import ParentAttendanceReport from '../components/ParentAttendanceReport';
import ParentGradeReport from '../components/ParentGradeReport';
import TopHeader from '../components/TopHeader';
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
  }, [location.search]);

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <div>
            <h2 className="parent-dashboard-greeting">{getGreeting()}, {userName} 😊</h2>
            <p className="parent-dashboard-subtitle">Welcome to your parent dashboard.</p>
            <div className="parent-dashboard-grid">
              <div className="parent-dashboard-card">
                <h3 className="parent-dashboard-card-title">My Children</h3>
                <p className="parent-dashboard-card-text">View information about your children's academic progress.</p>
              </div>
              <div className="parent-dashboard-card">
                <h3 className="parent-dashboard-card-title">Academic Reports</h3>
                <p className="parent-dashboard-card-text">Check your children's grades and academic performance.</p>
              </div>
              <div className="parent-dashboard-card">
                <h3 className="parent-dashboard-card-title">Fee Payments</h3>
                <p className="parent-dashboard-card-text">View and manage school fee payments.</p>
              </div>
            </div>
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
      case 'fee-payments':
        return (
          <div className="parent-dashboard-section">
            <h2 className="parent-dashboard-section-title">Fee Payments</h2>
            <p className="parent-dashboard-section-text">Make payments for school fees and other charges.</p>
          </div>
        );
      case 'payment-history':
        return (
          <div className="parent-dashboard-section">
            <h2 className="parent-dashboard-section-title">Payment History</h2>
            <p className="parent-dashboard-section-text">View your complete payment history and receipts.</p>
          </div>
        );
      case 'messages':
        return (
          <div className="parent-dashboard-section">
            <h2 className="parent-dashboard-section-title">Messages</h2>
            <p className="parent-dashboard-section-text">View messages from teachers and school administration.</p>
          </div>
        );
      case 'announcements':
        return (
          <div className="parent-dashboard-section">
            <h2 className="parent-dashboard-section-title">Announcements</h2>
            <p className="parent-dashboard-section-text">Stay updated with school announcements and events.</p>
          </div>
        );
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
      <TopHeader onMenuClick={() => sidebarRef.current?.openSidebar()} />
      <main className="parent-dashboard-main">
        {renderContent()}
      </main>
    </div>
  );
};

export default ParentDashboard;