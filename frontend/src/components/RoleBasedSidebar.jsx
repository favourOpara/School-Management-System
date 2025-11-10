// src/components/RoleBasedSidebar.jsx
import React, { useState } from 'react';
import {
  Menu, X, User, LayoutDashboard, LogOut, Settings, Shield,
  BookOpen, Users, Calendar, DollarSign, FileText, MessageCircle,
  ClipboardCheck, GraduationCap, UserCheck, ClipboardList, Edit2
} from 'lucide-react';
import './Sidebar.css';

const RoleBasedSidebar = ({ activeTab, setActiveTab, userRole }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null);

  const handleLogout = () => {
    localStorage.clear();
    window.location.href = '/';
  };

  const handleDropdownToggle = (key) => {
    setOpenDropdown(prev => (prev === key ? null : key));
  };

  const handleTabClick = (tab) => {
    setActiveTab(tab);
    setIsOpen(false);
    setOpenDropdown(null);
  };

  // Define menu items based on user role
  const getMenuItems = () => {
    const commonItems = [
      {
        key: 'account',
        icon: <User />,
        label: 'Account',
        submenu: [
          { key: 'profile', icon: <Shield />, label: 'Profile' },
          { key: 'settings', icon: <Settings />, label: 'Settings' }
        ]
      }
    ];

    switch (userRole) {
      case 'student':
        return [
          ...commonItems,
          {
            key: 'dashboard',
            icon: <LayoutDashboard />,
            label: 'Dashboard',
            submenu: [
              { key: 'dashboard', icon: <LayoutDashboard />, label: 'Overview' },
              { key: 'activity-logs', icon: <ClipboardList />, label: 'Activity Logs' }
            ]
          },
          {
            key: 'academics',
            icon: <BookOpen />,
            label: 'Academics',
            submenu: [
              { key: 'my-classes', icon: <BookOpen />, label: 'My Classes' },
              { key: 'my-grades', icon: <FileText />, label: 'My Grades' },
              { key: 'assignments', icon: <ClipboardCheck />, label: 'Assignments' },
              { key: 'assessments', icon: <GraduationCap />, label: 'Tests & Exams' }
            ]
          },
          {
            key: 'attendance',
            icon: <Calendar />,
            label: 'Attendance',
            submenu: [
              { key: 'my-attendance', icon: <UserCheck />, label: 'My Attendance' }
            ]
          }
        ];

      case 'teacher':
        return [
          ...commonItems,
          {
            key: 'dashboard',
            icon: <LayoutDashboard />,
            label: 'Dashboard',
            submenu: [
              { key: 'dashboard', icon: <LayoutDashboard />, label: 'Overview' }
            ]
          },
          {
            key: 'classes',
            icon: <BookOpen />,
            label: 'My Classes',
            submenu: [
              { key: 'assigned-classes', icon: <BookOpen />, label: 'Assigned Classes' },
              { key: 'student-list', icon: <Users />, label: 'Student List' }
            ]
          },
          {
            key: 'set-questions',
            icon: <GraduationCap />,
            label: 'Set Questions',
            submenu: [
              { key: 'set-test', icon: <FileText />, label: 'Test' },
              { key: 'set-exam', icon: <ClipboardCheck />, label: 'Exam' },
              { key: 'view-questions', icon: <ClipboardList />, label: 'View Questions' }
            ]
          },
          {
            key: 'grading',
            icon: <Edit2 />,
            label: 'Grading',
            submenu: [
              { key: 'manual-grading', icon: <Edit2 />, label: 'Manual Grading' }
            ]
          }
        ];

      case 'parent':
        return [
          ...commonItems,
          {
            key: 'dashboard',
            icon: <LayoutDashboard />,
            label: 'Dashboard',
            submenu: [
              { key: 'dashboard', icon: <LayoutDashboard />, label: 'Overview' }
            ]
          },
          {
            key: 'children',
            icon: <Users />,
            label: 'My Children',
            submenu: [
              { key: 'children-overview', icon: <Users />, label: 'Children Overview' },
              { key: 'academic-progress', icon: <GraduationCap />, label: 'Academic Progress' }
            ]
          },
          {
            key: 'reports',
            icon: <FileText />,
            label: 'Reports',
            submenu: [
              { key: 'grade-reports', icon: <FileText />, label: 'Grade Reports' },
              { key: 'attendance-reports', icon: <Calendar />, label: 'Attendance Reports' }
            ]
          },
          {
            key: 'fees',
            icon: <DollarSign />,
            label: 'Fees',
            submenu: [
              { key: 'fee-payments', icon: <DollarSign />, label: 'Fee Payments' },
              { key: 'payment-history', icon: <FileText />, label: 'Payment History' }
            ]
          },
          {
            key: 'communication',
            icon: <MessageCircle />,
            label: 'Communication',
            submenu: [
              { key: 'messages', icon: <MessageCircle />, label: 'Messages' },
              { key: 'announcements', icon: <FileText />, label: 'Announcements' }
            ]
          }
        ];

      default:
        return commonItems;
    }
  };

  const menuItems = getMenuItems();

  return (
    <>
      <div className="mobile-header">
        <button className="hamburger" onClick={() => setIsOpen(true)}>
          <Menu />
        </button>
      </div>

      <div className={`sidebar ${isOpen ? 'open' : ''}`}>
        <button className="close-btn" onClick={() => setIsOpen(false)}>
          <X />
        </button>

        <div className="sidebar-top">
          <img src="/logo.png" alt="School Logo" className="sidebar-logo" />
        </div>

        <nav className="sidebar-nav">
          <ul className={openDropdown ? 'collapsed' : ''}>
            {menuItems.map((item) => (
              <React.Fragment key={item.key}>
                <li onClick={() => handleDropdownToggle(item.key)}>
                  {item.icon}
                  <span>{item.label}</span>
                </li>
                {openDropdown === item.key && item.submenu && (
                  <ul className="sidebar-submenu">
                    {item.submenu.map((subItem) => (
                      <li key={subItem.key} onClick={() => handleTabClick(subItem.key)}>
                        {subItem.icon}
                        <span>{subItem.label}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </React.Fragment>
            ))}
          </ul>
        </nav>

        <button className="logout-btn" onClick={handleLogout}>
          <LogOut style={{ marginBottom: '0.3rem' }} />
          Logout
        </button>
      </div>
    </>
  );
};

export default RoleBasedSidebar;