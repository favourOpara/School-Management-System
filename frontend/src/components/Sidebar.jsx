import React, { useState } from 'react';
import {
  Menu, X,
  User, LayoutDashboard, Users, BookOpen,
  LogOut, Settings, Shield, PlusCircle, Eye, Book
} from 'lucide-react';
import './Sidebar.css';

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

const Sidebar = ({ activeTab, setActiveTab }) => {
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
            <li onClick={() => handleDropdownToggle('account')}>
              <User />
              <span>Account</span>
            </li>
            {openDropdown === 'account' && (
              <ul className="sidebar-submenu">
                <li onClick={() => handleTabClick('profile')}>
                  <Shield /><span>Profile</span>
                </li>
                <li onClick={() => handleTabClick('settings')}>
                  <Settings /><span>Settings</span>
                </li>
              </ul>
            )}

            <li onClick={() => handleDropdownToggle('dashboard')}>
              <LayoutDashboard />
              <span>Dashboard</span>
            </li>
            {openDropdown === 'dashboard' && (
              <ul className="sidebar-submenu">
                <li onClick={() => handleTabClick('analytics')}>
                  <Eye /><span>Analytics</span>
                </li>
                <li onClick={() => handleTabClick('reports')}>
                  <Eye /><span>Reports</span>
                </li>
              </ul>
            )}

            <li onClick={() => handleDropdownToggle('users')}>
              <Users />
              <span>Manage Users</span>
            </li>
            {openDropdown === 'users' && (
              <ul className="sidebar-submenu">
                <li onClick={() => handleTabClick('create-teacher')}>
                  <PlusCircle /><span>Create Teacher</span>
                </li>
                <li onClick={() => handleTabClick('create-student')}>
                  <PlusCircle /><span>Create Student</span>
                </li>
                <li onClick={() => handleTabClick('view-users')}>
                  <Eye /><span>View Users</span>
                </li>
              </ul>
            )}

            <li onClick={() => handleDropdownToggle('classes')}>
              <BookOpen />
              <span>Manage Classes</span>
            </li>
            {openDropdown === 'classes' && (
              <ul className="sidebar-submenu">
                <li onClick={() => handleTabClick('create-class')}>
                  <PlusCircle /><span>Create Class</span>
                </li>
                <li onClick={() => handleTabClick('view-classes')}>
                  <Eye /><span>View Classes</span>
                </li>
              </ul>
            )}

            {/* 🔥 NEW Manage Subjects Section */}
            <li onClick={() => handleDropdownToggle('subjects')}>
              <Book />
              <span>Manage Subjects</span>
            </li>
            {openDropdown === 'subjects' && (
              <ul className="sidebar-submenu">
                <li onClick={() => handleTabClick('create-subject')}>
                  <PlusCircle /><span>Create Subject</span>
                </li>
                <li onClick={() => handleTabClick('view-subjects')}>
                  <Eye /><span>View Subjects</span>
                </li>
              </ul>
            )}
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

export default Sidebar;
