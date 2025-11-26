import React, { useState, useEffect } from 'react';
import axios from 'axios';
import API_BASE_URL from '../config';

import './ActivityLog.css';

const ActivityLog = () => {
  const [notifications, setNotifications] = useState([]);
  const [directNotifications, setDirectNotifications] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [userRole, setUserRole] = useState(null);
  const [userInfo, setUserInfo] = useState(null);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [selectedDirectNotification, setSelectedDirectNotification] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);

  const token = localStorage.getItem('accessToken');

  // Decode JWT to get user info
  const getUserFromToken = () => {
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return {
        user_id: payload.user_id,
        role: payload.role,
        username: payload.username
      };
    } catch (error) {
      console.error('Error decoding token:', error);
      return null;
    }
  };

  // Fetch notifications based on user role
  const fetchNotifications = async () => {
    setLoading(true);
    setError('');
    
    const user = getUserFromToken();
    if (!user) {
      setError('User not authenticated');
      setLoading(false);
      return;
    }

    setUserRole(user.role);
    setUserInfo(user);

    try {
      let endpoint;
      if (user.role === 'admin') {
        endpoint = `${API_BASE_URL}/api/logs/admin/notifications/`;
      } else if (user.role === 'student') {
        endpoint = `${API_BASE_URL}/api/logs/student/notifications/`;
      } else {
        setError('Notifications not available for your role');
        setLoading(false);
        return;
      }

      const response = await axios.get(endpoint, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setNotifications(response.data.notifications || []);
      setSummary(response.data.summary || {});
    } catch (err) {
      console.error('Error fetching notifications:', err);
      setError('Failed to load notifications.');
    } finally {
      setLoading(false);
    }

    // Also fetch direct notifications for students (outside try-catch to ensure it runs)
    if (user && user.role === 'student') {
      fetchDirectNotifications();
    }
  };

  // Fetch direct notifications (Notification model)
  const fetchDirectNotifications = async () => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/logs/notifications/direct/`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      console.log('Direct notifications fetched:', response.data);
      setDirectNotifications(response.data.notifications || []);
    } catch (err) {
      console.error('Error fetching direct notifications:', err);
    }
  };

  // Mark direct notification as read
  const markDirectAsRead = async (notificationId) => {
    try {
      await axios.post(
        `${API_BASE_URL}/api/logs/notifications/${notificationId}/read-direct/`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setDirectNotifications(prev =>
        prev.map(notif =>
          notif.id === notificationId ? { ...notif, is_read: true } : notif
        )
      );
    } catch (error) {
      console.error('Error marking direct notification as read:', error);
    }
  };

  // Fetch notification details for preview
  const fetchNotificationDetails = async (notificationId) => {
    setModalLoading(true);
    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/logs/notifications/${notificationId}/detail/`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      setSelectedNotification(response.data);
    } catch (error) {
      console.error('Error fetching notification details:', error);
      setError('Failed to load notification details.');
    } finally {
      setModalLoading(false);
    }
  };

  // Open notification preview
  const openNotificationPreview = async (notificationId) => {
    await fetchNotificationDetails(notificationId);
  };

  // Close notification preview
  const closeNotificationPreview = () => {
    setSelectedNotification(null);
  };

  // Mark notification as read (students only)
  const markAsRead = async (notificationId) => {
    if (userRole !== 'student') return;

    try {
      await axios.post(
        `${API_BASE_URL}/api/logs/notifications/${notificationId}/read/`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setNotifications(prev =>
        prev.map(notif =>
          notif.id === notificationId ? { ...notif, is_new: false } : notif
        )
      );

      setSummary(prev => ({
        ...prev,
        unread_count: Math.max(0, prev.unread_count - 1)
      }));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  // Mark all notifications as read (students only)
  const markAllAsRead = async () => {
    if (userRole !== 'student') return;

    try {
      await axios.post(
        `${API_BASE_URL}/api/logs/notifications/read-all/`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setNotifications(prev =>
        prev.map(notif => ({ ...notif, is_new: false }))
      );

      setSummary(prev => ({
        ...prev,
        unread_count: 0
      }));
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const getContentIcon = (contentType) => {
    switch (contentType) {
      case 'assignment':
        return '📝';
      case 'note':
        return '📚';
      case 'announcement':
        return '📢';
      default:
        return '🔔';
    }
  };

  const getContentTypeClass = (contentType) => {
    switch (contentType) {
      case 'assignment':
        return 'content-type-assignment';
      case 'note':
        return 'content-type-note';
      case 'announcement':
        return 'content-type-announcement';
      case 'incomplete_grades':
        return 'content-type-alert';
      case 'report_release':
        return 'content-type-success';
      default:
        return 'content-type-default';
    }
  };

  const getDirectNotificationIcon = (type) => {
    switch (type) {
      case 'incomplete_grades':
        return '⚠️';
      case 'report_release':
        return '📋';
      case 'fee_reminder':
        return '💰';
      default:
        return '🔔';
    }
  };

  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} minutes ago`;
    if (hours < 24) return `${hours} hours ago`;
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
  };

  const filteredNotifications = notifications.filter(notif => {
    if (filter === 'all') return true;
    if (filter === 'unread') return notif.is_new;
    if (filter === 'direct') return false; // Direct notifications handled separately
    return notif.content_type === filter;
  });

  const filteredDirectNotifications = directNotifications.filter(notif => {
    if (filter === 'all' || filter === 'direct') return true;
    if (filter === 'unread') return !notif.is_read;
    return false;
  });

  if (loading) {
    return (
      <div className="activity-log-container">
        <div className="activity-log-loading-container">
          <div className="activity-log-spinner"></div>
          <p>Loading notifications...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="activity-log-container">
        <div className="activity-log-error-container">
          <h3>Error</h3>
          <p>{error}</p>
          <button onClick={fetchNotifications} className="activity-log-retry-btn">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="activity-log-container">
      {/* Header */}
      <div className="activity-log-header-section">
        <div className="notifications-header-left">
          <h1 className="notifications-main-title">
            🔔 {userRole === 'admin' ? 'All Notifications' : 'My Notifications'}
          </h1>
          {summary.unread_count > 0 && userRole === 'student' && (
            <span className="notifications-unread-badge">
              {summary.unread_count} new
            </span>
          )}
        </div>
        
        {summary.unread_count > 0 && userRole === 'student' && (
          <button onClick={markAllAsRead} className="notifications-mark-all-btn">
            Mark All Read
          </button>
        )}
      </div>

      {/* Summary Stats */}
      <div className="summary-stats">
        <div className="stat-card">
          <div className="stat-number">{summary.total_notifications || 0}</div>
          <div className="stat-label">Total Notifications</div>
        </div>
        {userRole === 'student' && (
          <div className="stat-card unread">
            <div className="stat-number">{summary.unread_count || 0}</div>
            <div className="stat-label">Unread</div>
          </div>
        )}
        {summary.content_breakdown?.map((item, index) => (
          <div key={index} className="stat-card">
            <div className="stat-number">{item.count}</div>
            <div className="stat-label">{item.content_type}s</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="filters">
        {['all', 'unread', 'direct', 'assignment', 'note', 'announcement'].map((filterType) => (
          <button
            key={filterType}
            onClick={() => setFilter(filterType)}
            className={`filter-btn ${filter === filterType ? 'active' : ''}`}
          >
            {filterType === 'direct' ? 'Alerts' : filterType.charAt(0).toUpperCase() + filterType.slice(1)}
          </button>
        ))}
      </div>

      {/* Notifications List */}
      <div className="notifications-list">
        {filteredNotifications.length === 0 && filteredDirectNotifications.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🔔</div>
            <h3>No notifications</h3>
            <p>
              {filter === 'unread'
                ? 'All caught up! No unread notifications.'
                : 'No notifications to display.'}
            </p>
          </div>
        ) : (
          <>
            {/* Direct Notifications (Alerts) */}
            {filteredDirectNotifications.map((notification) => (
              <div
                key={`direct-${notification.id}`}
                className={`notification-card ${!notification.is_read ? 'unread' : 'read'} direct-notification`}
                onClick={() => setSelectedDirectNotification(notification)}
              >
                <div className="notification-content">
                  <div className="notification-icon">
                    {getDirectNotificationIcon(notification.notification_type)}
                  </div>

                  <div className="notification-body">
                    <div className="notification-header">
                      <span className={`content-type ${getContentTypeClass(notification.notification_type)}`}>
                        {notification.notification_type.replace('_', ' ')}
                      </span>
                      {!notification.is_read && (
                        <span className="new-badge">NEW</span>
                      )}
                      <span className={`priority-badge priority-${notification.priority}`}>
                        {notification.priority}
                      </span>
                    </div>

                    <h3 className="notification-title">
                      {notification.title}
                    </h3>

                    <p className="notification-action">
                      {notification.message.split('\n')[0].substring(0, 100)}
                      {notification.message.length > 100 ? '...' : ''}
                    </p>

                    <div className="notification-meta">
                      <span className="meta-item">
                        🕐 {formatTimeAgo(notification.created_at)}
                      </span>
                    </div>
                  </div>

                  {!notification.is_read && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        markDirectAsRead(notification.id);
                      }}
                      className="mark-read-btn"
                      title="Mark as read"
                    >
                      ✓
                    </button>
                  )}
                </div>
              </div>
            ))}

            {/* Activity Log Notifications */}
            {filteredNotifications.map((notification) => (
              <div
                key={notification.id}
                className={`notification-card ${
                  notification.is_new && userRole === 'student' ? 'unread' : 'read'
                }`}
                onClick={() => openNotificationPreview(notification.id)}
              >
                <div className="notification-content">
                  <div className="notification-icon">
                    {getContentIcon(notification.content_type)}
                  </div>

                  <div className="notification-body">
                    <div className="notification-header">
                      <span className={`content-type ${getContentTypeClass(notification.content_type)}`}>
                        {notification.content_type}
                      </span>
                      {notification.is_new && userRole === 'student' && (
                        <span className="new-badge">NEW</span>
                      )}
                    </div>

                    <h3 className="notification-title">
                      {notification.content_title}
                    </h3>

                    <p className="notification-action">
                      {notification.action}
                    </p>

                    <div className="notification-meta">
                      <span className="meta-item">
                        📚 {notification.subject_name}
                      </span>
                      <span className="meta-item">
                        {notification.classroom_name}
                      </span>
                      {userRole === 'admin' && (
                        <span className="meta-item">
                          👨‍🏫 {notification.teacher_name || notification.user_full_name}
                        </span>
                      )}
                      <span className="meta-item">
                        🕐 {notification.time_ago}
                      </span>
                    </div>
                  </div>

                  {notification.is_new && userRole === 'student' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        markAsRead(notification.id);
                      }}
                      className="mark-read-btn"
                      title="Mark as read"
                    >
                      ✓
                    </button>
                  )}
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Load More Button */}
      {filteredNotifications.length > 0 && (
        <div className="load-more-container">
          <button className="load-more-btn">
            Load More Notifications
          </button>
        </div>
      )}

      {/* Notification Preview Modal */}
      {selectedNotification && (
        <div className="notification-modal-overlay" onClick={closeNotificationPreview}>
          <div className="notification-modal" onClick={(e) => e.stopPropagation()}>
            <div className="notification-modal-header">
              <h2 className="notification-modal-title">
                {getContentIcon(selectedNotification.content_type)} {selectedNotification.title}
              </h2>
              <button className="notification-modal-close" onClick={closeNotificationPreview}>
                ✕
              </button>
            </div>
            
            {modalLoading ? (
              <div className="notification-modal-loading">
                <div className="notifications-spinner"></div>
                <p>Loading details...</p>
              </div>
            ) : (
              <div className="notification-modal-content">
                <div className="notification-modal-info">
                  <div className="notification-modal-meta">
                    <span className={`content-type ${getContentTypeClass(selectedNotification.content_type)}`}>
                      {selectedNotification.content_type}
                    </span>
                    <span className="notification-modal-time">{selectedNotification.time_ago}</span>
                  </div>
                  
                  <div className="notification-modal-details">
                    <p><strong>Teacher:</strong> {selectedNotification.teacher?.name}</p>
                    <p><strong>Subject:</strong> {selectedNotification.subject?.name}</p>
                    <p><strong>Class:</strong> {selectedNotification.subject?.classroom}</p>
                    {selectedNotification.subject?.department && (
                      <p><strong>Department:</strong> {selectedNotification.subject.department}</p>
                    )}
                  </div>
                </div>

                {selectedNotification.content_details && (
                  <div className="notification-modal-body">
                    <h3>Content Details</h3>
                    <div className="content-description">
                      <p>{selectedNotification.content_details.description}</p>
                    </div>
                    
                    {selectedNotification.content_details.due_date && (
                      <div className="content-due-date">
                        <p><strong>Due Date:</strong> {new Date(selectedNotification.content_details.due_date).toLocaleString()}</p>
                      </div>
                    )}
                    
                    {selectedNotification.content_details.max_score && (
                      <div className="content-max-score">
                        <p><strong>Maximum Score:</strong> {selectedNotification.content_details.max_score}</p>
                      </div>
                    )}
                    
                    {selectedNotification.content_details.files && selectedNotification.content_details.files.length > 0 && (
                      <div className="content-files">
                        <h4>Attached Files ({selectedNotification.content_details.files.length})</h4>
                        <ul className="file-list">
                          {selectedNotification.content_details.files.map((file, index) => (
                            <li key={index} className="file-item">
                              <span className="file-name">{file.name}</span>
                              <span className="file-size">({file.size})</span>
                              {file.url && (
                                <a href={file.url} target="_blank" rel="noopener noreferrer" className="file-download">
                                  Download
                                </a>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Direct Notification Detail Modal */}
      {selectedDirectNotification && (
        <div className="notification-modal-overlay" onClick={() => setSelectedDirectNotification(null)}>
          <div className="notification-modal direct-modal" onClick={(e) => e.stopPropagation()}>
            <div className="notification-modal-header">
              <h2 className="notification-modal-title">
                {getDirectNotificationIcon(selectedDirectNotification.notification_type)} {selectedDirectNotification.title}
              </h2>
              <button className="notification-modal-close" onClick={() => setSelectedDirectNotification(null)}>
                ✕
              </button>
            </div>

            <div className="notification-modal-content">
              <div className="notification-modal-info">
                <div className="notification-modal-meta">
                  <span className={`content-type ${getContentTypeClass(selectedDirectNotification.notification_type)}`}>
                    {selectedDirectNotification.notification_type.replace('_', ' ')}
                  </span>
                  <span className={`priority-badge priority-${selectedDirectNotification.priority}`}>
                    {selectedDirectNotification.priority} priority
                  </span>
                  <span className="notification-modal-time">
                    {formatTimeAgo(selectedDirectNotification.created_at)}
                  </span>
                </div>
              </div>

              <div className="notification-modal-body">
                <div className="direct-notification-message">
                  {selectedDirectNotification.message}
                </div>

                {selectedDirectNotification.extra_data &&
                  selectedDirectNotification.notification_type === 'incomplete_grades' &&
                  selectedDirectNotification.extra_data.incomplete_subjects && (
                    <div className="incomplete-subjects-detail">
                      <h4>Incomplete Subjects:</h4>
                      <ul>
                        {selectedDirectNotification.extra_data.incomplete_subjects.map((subject, idx) => (
                          <li key={idx}>
                            <strong>{subject.name}</strong>
                            <span className="missing-scores">Missing: {subject.missing.join(', ')}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
              </div>

              {!selectedDirectNotification.is_read && (
                <div className="notification-modal-actions">
                  <button
                    onClick={() => {
                      markDirectAsRead(selectedDirectNotification.id);
                      setSelectedDirectNotification(null);
                    }}
                    className="mark-read-modal-btn"
                  >
                    Mark as Read
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActivityLog;