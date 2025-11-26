// src/components/ParentAnnouncements.jsx
import React, { useState, useEffect } from 'react';
import { Bell, AlertCircle, Info, CheckCircle, Clock, FileText, DollarSign, BookOpen } from 'lucide-react';
import './ParentAnnouncements.css';

const ParentAnnouncements = () => {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, unread, direct, activity
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken');
      const response = await fetch('http://127.0.0.1:8000/api/schooladmin/parent/announcements/', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setAnnouncements(data.notifications || []);
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

  const getNotificationIcon = (notificationType) => {
    switch (notificationType) {
      case 'report_release':
        return <FileText size={20} />;
      case 'fee_reminder':
        return <DollarSign size={20} />;
      case 'incomplete_grades':
        return <AlertCircle size={20} />;
      case 'assignment':
      case 'note':
      case 'announcement':
        return <BookOpen size={20} />;
      default:
        return <Bell size={20} />;
    }
  };

  const getPriorityClass = (priority) => {
    switch (priority) {
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
    if (filter === 'direct') return announcement.type === 'direct';
    if (filter === 'activity') return announcement.type === 'activity';
    return true;
  });

  if (loading) {
    return (
      <div className="parent-announcements-loading">
        <Clock size={32} className="spin" />
        <p>Loading announcements...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="parent-announcements-error">
        <AlertCircle size={32} />
        <p>{error}</p>
        <button onClick={fetchAnnouncements} className="retry-button">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="parent-announcements-container">
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
          className={`filter-btn ${filter === 'direct' ? 'active' : ''}`}
          onClick={() => setFilter('direct')}
        >
          Direct ({announcements.filter(a => a.type === 'direct').length})
        </button>
        <button
          className={`filter-btn ${filter === 'activity' ? 'active' : ''}`}
          onClick={() => setFilter('activity')}
        >
          Activities ({announcements.filter(a => a.type === 'activity').length})
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
                {getNotificationIcon(announcement.notification_type)}
              </div>
              <div className="announcement-content">
                <div className="announcement-header-row">
                  <h3 className="announcement-title">{announcement.title}</h3>
                  {!announcement.is_read && <span className="unread-dot"></span>}
                </div>
                {announcement.child_name && (
                  <div className="announcement-child-badge">
                    <Info size={14} />
                    {announcement.child_name}
                  </div>
                )}
                <p className="announcement-message">{announcement.message}</p>
                <div className="announcement-footer">
                  <span className="announcement-date">{formatDate(announcement.created_at)}</span>
                  {announcement.extra_data?.subject_name && (
                    <span className="announcement-subject">
                      {announcement.extra_data.subject_name}
                    </span>
                  )}
                  {announcement.extra_data?.classroom && (
                    <span className="announcement-classroom">
                      {announcement.extra_data.classroom}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ParentAnnouncements;
