import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './ActivityLog.css';

const ActivityLog = () => {
  const [notifications, setNotifications] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [userRole, setUserRole] = useState(null);
  const [userInfo, setUserInfo] = useState(null);
  const [selectedNotification, setSelectedNotification] = useState(null);
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
        endpoint = 'http://127.0.0.1:8000/api/logs/admin/notifications/';
      } else if (user.role === 'student') {
        endpoint = 'http://127.0.0.1:8000/api/logs/student/notifications/';
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
  };

  // Fetch notification details for preview
  const fetchNotificationDetails = async (notificationId) => {
    setModalLoading(true);
    try {
      const response = await axios.get(
        `http://127.0.0.1:8000/api/logs/notifications/${notificationId}/detail/`,
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
        `http://127.0.0.1:8000/api/logs/notifications/${notificationId}/read/`,
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
        'http://127.0.0.1:8000/api/logs/notifications/read-all/',
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
      default:
        return 'content-type-default';
    }
  };

  const filteredNotifications = notifications.filter(notif => {
    if (filter === 'all') return true;
    if (filter === 'unread') return notif.is_new;
    return notif.content_type === filter;
  });

  if (loading) {
    return (
      <div className="notifications-main-wrapper">
        <div className="notifications-loading-container">
          <div className="notifications-spinner"></div>
          <p>Loading notifications...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="notifications-main-wrapper">
        <div className="notifications-error-container">
          <h3>Error</h3>
          <p>{error}</p>
          <button onClick={fetchNotifications} className="notifications-retry-btn">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="notifications-main-wrapper">
      {/* Header */}
      <div className="notifications-header-section">
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
        {['all', 'unread', 'assignment', 'note', 'announcement'].map((filterType) => (
          <button
            key={filterType}
            onClick={() => setFilter(filterType)}
            className={`filter-btn ${filter === filterType ? 'active' : ''}`}
          >
            {filterType.charAt(0).toUpperCase() + filterType.slice(1)}
          </button>
        ))}
      </div>

      {/* Notifications List */}
      <div className="notifications-list">
        {filteredNotifications.length === 0 ? (
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
          filteredNotifications.map((notification) => (
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
          ))
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
    </div>
  );
};

export default ActivityLog;