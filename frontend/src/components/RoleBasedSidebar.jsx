// src/components/RoleBasedSidebar.jsx
import React, { useState, forwardRef, useImperativeHandle } from 'react';
import {
  Menu, X, User, LayoutDashboard, LogOut, Settings, Shield,
  BookOpen, Users, Calendar, DollarSign, FileText, MessageCircle,
  ClipboardCheck, GraduationCap, UserCheck, ClipboardList, Edit2, Bell, Clock,
  HelpCircle
} from 'lucide-react';
import { useSchool } from '../contexts/SchoolContext';
import './Sidebar.css';

const RoleBasedSidebar = forwardRef(({ activeTab, setActiveTab, userRole }, ref) => {
  const [isOpen, setIsOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null);
  const { school, hasFeature } = useSchool();

  useImperativeHandle(ref, () => ({
    openSidebar: () => setIsOpen(true)
  }));

  const handleLogout = () => {
    // Get the school slug before clearing
    const schoolSlug = school?.slug || localStorage.getItem('schoolSlug');

    // Clear school-specific auth data
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('schoolSlug');
    localStorage.removeItem('userName');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userId');
    localStorage.removeItem('firstTimeSetup');

    // Redirect to school login page
    window.location.href = `/${schoolSlug}`;
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
    switch (userRole) {
      case 'student':
        return [
          {
            key: 'dashboard',
            icon: <LayoutDashboard />,
            label: 'Dashboard',
            submenu: [
              { key: 'dashboard', icon: <LayoutDashboard />, label: 'Overview' },
              { key: 'activity-logs', icon: <ClipboardList />, label: 'Activity Logs' },
              { key: 'report-sheet', icon: <FileText />, label: 'Report Sheet' }
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
          },
          {
            key: 'help',
            icon: <HelpCircle />,
            label: 'Help',
            submenu: [
              { key: 'knowledge-base', icon: <BookOpen />, label: 'Knowledge Base' }
            ]
          }
        ];

      case 'teacher':
        return [
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
              { key: 'assigned-classes', icon: <BookOpen />, label: 'Assigned Classes' }
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
          },
          {
            key: 'communication',
            icon: <Bell />,
            label: 'Communication',
            submenu: [
              { key: 'announcements', icon: <Bell />, label: 'Announcements' }
            ]
          },
          ...(hasFeature('staff_management') ? [{
            key: 'staff',
            icon: <Clock />,
            label: 'Book On/Off',
            submenu: [
              { key: 'book-on-off', icon: <Clock />, label: 'Book On/Off' }
            ]
          }] : []),
          {
            key: 'help',
            icon: <HelpCircle />,
            label: 'Help',
            submenu: [
              { key: 'knowledge-base', icon: <BookOpen />, label: 'Knowledge Base' }
            ]
          }
        ];

      case 'parent':
        return [
          {
            key: 'dashboard',
            icon: <LayoutDashboard />,
            label: 'Dashboard',
            submenu: [
              { key: 'dashboard', icon: <LayoutDashboard />, label: 'Overview' }
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
              { key: 'fee-receipts', icon: <FileText />, label: 'Fee Receipts' }
            ]
          },
          {
            key: 'communication',
            icon: <MessageCircle />,
            label: 'Communication',
            submenu: [
              { key: 'announcements', icon: <FileText />, label: 'Announcements' }
            ]
          },
          {
            key: 'help',
            icon: <HelpCircle />,
            label: 'Help',
            submenu: [
              { key: 'knowledge-base', icon: <BookOpen />, label: 'Knowledge Base' }
            ]
          }
        ];

      default:
        return [];
    }
  };

  const menuItems = getMenuItems();

  // Apply accent color as CSS variable
  const sidebarStyle = school?.accent_color ? {
    '--sidebar-accent': school.accent_color,
    '--sidebar-accent-dark': school.secondary_color || school.accent_color,
  } : {};

  return (
    <>
      <div className={`sidebar ${isOpen ? 'open' : ''}`} style={sidebarStyle}>
        <button className="close-btn" onClick={() => setIsOpen(false)}>
          <X />
        </button>

        <div className="sidebar-top">
          {school?.logo ? (
            <img src={school.logo} alt={school.name || 'School Logo'} className="sidebar-logo" />
          ) : (
            <div className="sidebar-logo-placeholder">
              <GraduationCap size={32} />
              <span>{school?.name || 'School'}</span>
            </div>
          )}
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
      </div>
    </>
  );
});

export default RoleBasedSidebar;