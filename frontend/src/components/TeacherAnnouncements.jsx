// src/components/TeacherAnnouncements.jsx
import React, { useState, useEffect } from 'react';
import { Bell, AlertCircle, Info, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import API_BASE_URL from '../config';

import './TeacherAnnouncements.css';

const TeacherAnnouncements = () => {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, unread, high-priority
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${API_BASE_URL}/api/schooladmin/my-announcements/`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setAnnouncements(data.announcements || []);
      } else {
        setError('Failed to load announcements');
      }
    } catch (err) {
      console.error('Error fetching announcements:', err);
      setError('An error occurred while loading announcements');
    } finally {
      setLoading(false);
    }
  };

  const getNotificationIcon = (announcement) => {
    // Show icon based on notification type for system notifications
    if (announcement.type === 'notification') {
      switch (announcement.notification_type) {
        case 'teacher_grading_reminder':
          return <AlertTriangle size={20} />;
        case 'incomplete_grades':
          return <AlertCircle size={20} />;
        case 'report_release':
          return <CheckCircle size={20} />;
        default:
          return <Bell size={20} />;
      }
    }

    // Show icon based on priority for announcements
    switch (announcement.priority) {
      case 'urgent':
        return <AlertTriangle size={20} />;
      case 'high':
        return <AlertCircle size={20} />;
      case 'medium':
        return <Info size={20} />;
      case 'low':
        return <Bell size={20} />;
      default:
        return <Bell size={20} />;
    }
  };

  const getPriorityClass = (priority) => {
    switch (priority) {
      case 'urgent':
        return 'priority-urgent';
      case 'high':
        return 'priority-high';
      case 'medium':
        return 'priority-medium';
      case 'low':
        return 'priority-low';
      default:
        return '';
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      const diffInMinutes = Math.floor(diffInHours * 60);
      if (diffInMinutes < 60) {
        return `${diffInMinutes} minute${diffInMinutes !== 1 ? 's' : ''} ago`;
      }
      const hours = Math.floor(diffInHours);
      return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    } else if (diffInHours < 48) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
      });
    }
  };

  const filteredAnnouncements = announcements.filter(announcement => {
    if (filter === 'all') return true;
    if (filter === 'unread') return !announcement.is_read;
    if (filter === 'high-priority') return announcement.priority === 'high' || announcement.priority === 'urgent';
    return true;
  });

  if (loading) {
    return (
      <div className="teacher-announcements-loading">
        <Clock size={32} className="spin" />
        <p>Loading announcements...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="teacher-announcements-error">
        <AlertCircle size={32} />
        <p>{error}</p>
        <button onClick={fetchAnnouncements} className="retry-button">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="teacher-announcements-container">
      <div className="announcements-header">
        <div className="header-left">
          <Bell size={24} />
          <h2>Announcements</h2>
        </div>
        <div className="header-stats">
          <span className="unread-badge">
            {announcements.filter(a => !a.is_read).length} Unread
          </span>
        </div>
      </div>

      <div className="announcements-filters">
        <button
          className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All ({announcements.length})
        </button>
        <button
          className={`filter-btn ${filter === 'unread' ? 'active' : ''}`}
          onClick={() => setFilter('unread')}
        >
          Unread ({announcements.filter(a => !a.is_read).length})
        </button>
        <button
          className={`filter-btn ${filter === 'high-priority' ? 'active' : ''}`}
          onClick={() => setFilter('high-priority')}
        >
          High Priority ({announcements.filter(a => a.priority === 'high' || a.priority === 'urgent').length})
        </button>
      </div>

      <div className="announcements-list">
        {filteredAnnouncements.length === 0 ? (
          <div className="no-announcements">
            <CheckCircle size={48} style={{ color: '#4caf50' }} />
            <h3>No announcements to display</h3>
            <p>You're all caught up!</p>
          </div>
        ) : (
          filteredAnnouncements.map((announcement) => (
            <div
              key={announcement.id}
              className={`announcement-item ${announcement.is_read ? 'read' : 'unread'} ${getPriorityClass(announcement.priority)}`}
            >
              <div className="announcement-icon">
                {getNotificationIcon(announcement)}
              </div>
              <div className="announcement-content">
                <div className="announcement-header-row">
                  <h3 className="announcement-title">{announcement.title}</h3>
                  {!announcement.is_read && <span className="unread-dot"></span>}
                </div>
                <div className="announcement-meta">
                  <span className="priority-badge">{announcement.priority_display}</span>
                  <span className="created-by">From: {announcement.created_by}</span>
                </div>
                <p className="announcement-message">{announcement.message}</p>
                <div className="announcement-footer">
                  <span className="announcement-date">{formatDate(announcement.created_at)}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default TeacherAnnouncements;
