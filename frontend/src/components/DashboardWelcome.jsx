import React from 'react';
import { Users, BookOpen, Calendar, CreditCard, BarChart3, Settings, Sparkles, Zap, Star, LayoutDashboard } from 'lucide-react';
import { useSchool } from '../contexts/SchoolContext';
import './DashboardWelcome.css';

const DashboardWelcome = ({ userName }) => {
  const { school } = useSchool();

  // Get time-based greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const accentColor = school?.accent_color || '#3b82f6';

  const quickActions = [
    {
      icon: Users,
      title: 'Manage Users',
      description: 'Create and manage students, teachers, and parents',
      color: '#3b82f6'
    },
    {
      icon: BookOpen,
      title: 'Academic Management',
      description: 'Handle classes, subjects, and sessions',
      color: '#10b981'
    },
    {
      icon: Calendar,
      title: 'Attendance',
      description: 'Track and manage student attendance',
      color: '#f59e0b'
    },
    {
      icon: CreditCard,
      title: 'Fee Management',
      description: 'Manage fee structures and payments',
      color: '#8b5cf6'
    },
    {
      icon: BarChart3,
      title: 'Results & Analytics',
      description: 'View performance reports and analytics',
      color: '#ef4444'
    },
    {
      icon: Settings,
      title: 'School Settings',
      description: 'Configure school data and announcements',
      color: '#6b7280'
    }
  ];

  return (
    <div className="dashboard-welcome-container">
      {/* Colored Welcome Banner */}
      <div className="dw-banner">
        <div className="dw-content-wrapper">
          <div className="dw-icons">
            <div className="dw-icon-left">
              <LayoutDashboard size={42} strokeWidth={1.5} color={accentColor} />
              <Sparkles className="dw-sparkle-icon dw-sparkle-left-1" size={14} />
              <Zap className="dw-sparkle-icon dw-sparkle-left-2" size={12} />
            </div>
            <div className="dw-icon-right">
              <LayoutDashboard size={42} strokeWidth={1.5} color={accentColor} />
              <Star className="dw-sparkle-icon dw-sparkle-right-1" size={14} />
              <Sparkles className="dw-sparkle-icon dw-sparkle-right-2" size={12} />
            </div>
          </div>
          <div className="dw-text-content">
            <h1 className="dw-greeting">{getGreeting()}, {userName}!</h1>
            <h2 className="dw-title">Welcome to Your Dashboard</h2>
            <p className="dw-subtitle">
              Manage your school activities efficiently from one centralized platform
            </p>
          </div>
        </div>
      </div>

      <div className="quick-stats-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ backgroundColor: '#dbeafe' }}>
            <Users size={24} color="#3b82f6" />
          </div>
          <div className="stat-content">
            <h3 className="stat-title">User Management</h3>
            <p className="stat-description">Create and manage all school users</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ backgroundColor: '#dcfce7' }}>
            <BookOpen size={24} color="#10b981" />
          </div>
          <div className="stat-content">
            <h3 className="stat-title">Academic Records</h3>
            <p className="stat-description">Handle classes, subjects, and sessions</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ backgroundColor: '#fef3c7' }}>
            <Calendar size={24} color="#f59e0b" />
          </div>
          <div className="stat-content">
            <h3 className="stat-title">Attendance Tracking</h3>
            <p className="stat-description">Monitor student attendance records</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ backgroundColor: '#ede9fe' }}>
            <CreditCard size={24} color="#8b5cf6" />
          </div>
          <div className="stat-content">
            <h3 className="stat-title">Financial Management</h3>
            <p className="stat-description">Track fees and payment records</p>
          </div>
        </div>
      </div>

      <div className="getting-started-section">
        <h2 className="section-title">Getting Started</h2>
        <p className="section-description">
          Use the sidebar to navigate through different sections of the school management system.
          Here are some key areas you can manage:
        </p>

        <div className="features-grid">
          {quickActions.map((action, index) => {
            const Icon = action.icon;
            return (
              <div key={index} className="feature-card">
                <div className="feature-icon-wrapper" style={{ backgroundColor: `${action.color}15` }}>
                  <Icon size={28} color={action.color} />
                </div>
                <h3 className="feature-title">{action.title}</h3>
                <p className="feature-description">{action.description}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="help-section">
        <div className="help-card">
          <h3 className="help-title">Need Help?</h3>
          <p className="help-description">
            If you need assistance navigating the dashboard or have any questions,
            please contact the system administrator or refer to the user guide.
          </p>
        </div>
      </div>
    </div>
  );
};

export default DashboardWelcome;
