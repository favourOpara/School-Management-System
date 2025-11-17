// src/components/NotificationPopup.jsx
import React, { useState, useEffect } from 'react';
import { X, Bell, AlertTriangle, FileCheck, ChevronDown, ChevronUp } from 'lucide-react';
import './NotificationPopup.css';

const NotificationPopup = () => {
  const [notifications, setNotifications] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    fetchPendingNotifications();
  }, []);

  const fetchPendingNotifications = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch('http://127.0.0.1:8000/api/logs/notifications/pending-popups/', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.notifications && data.notifications.length > 0) {
          setNotifications(data.notifications);
          setIsVisible(true);
        }
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  };

  const handleClose = async () => {
    if (notifications.length === 0) return;

    const currentNotification = notifications[currentIndex];

    // Mark popup as shown
    try {
      const token = localStorage.getItem('accessToken');
      await fetch(`http://127.0.0.1:8000/api/logs/notifications/${currentNotification.id}/popup-shown/`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
    } catch (err) {
      console.error('Error marking popup as shown:', err);
    }

    // Move to next notification or close
    if (currentIndex < notifications.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setIsExpanded(false);
    } else {
      setIsVisible(false);
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'incomplete_grades':
        return <AlertTriangle size={20} color="#f59e0b" />;
      case 'report_release':
        return <FileCheck size={20} color="#10b981" />;
      default:
        return <Bell size={20} color="#3b82f6" />;
    }
  };

  const getPriorityClass = (priority) => {
    switch (priority) {
      case 'high':
        return 'priority-high';
      case 'medium':
        return 'priority-medium';
      default:
        return 'priority-low';
    }
  };

  const getShortMessage = (message) => {
    const firstLine = message.split('\n')[0];
    if (firstLine.length > 80) {
      return firstLine.substring(0, 80) + '...';
    }
    return firstLine;
  };

  if (!isVisible || notifications.length === 0) return null;

  const currentNotification = notifications[currentIndex];

  return (
    <div className="notification-popup-overlay">
      <div className={`notification-popup ${getPriorityClass(currentNotification.priority)} ${isExpanded ? 'expanded' : ''}`}>
        <button className="popup-close-btn" onClick={handleClose}>
          <X size={18} />
        </button>

        <div className="popup-header">
          <div className="popup-icon">
            {getNotificationIcon(currentNotification.notification_type)}
          </div>
          <div className="popup-title">
            <h3>{currentNotification.title}</h3>
            {notifications.length > 1 && (
              <span className="notification-counter">
                {currentIndex + 1}/{notifications.length}
              </span>
            )}
          </div>
        </div>

        <div className="popup-content">
          {!isExpanded ? (
            <p className="notification-message-short">{getShortMessage(currentNotification.message)}</p>
          ) : (
            <>
              <p className="notification-message-full">{currentNotification.message}</p>

              {currentNotification.extra_data && currentNotification.notification_type === 'incomplete_grades' && (
                <div className="incomplete-details">
                  <h4>Subjects:</h4>
                  <ul>
                    {currentNotification.extra_data.incomplete_subjects?.map((subject, idx) => (
                      <li key={idx}>
                        <strong>{subject.name}</strong>
                        <span className="missing-items">{subject.missing.join(', ')}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>

        <div className="popup-footer">
          <button className="show-more-btn" onClick={() => setIsExpanded(!isExpanded)}>
            {isExpanded ? (
              <>
                <ChevronUp size={16} />
                Show less
              </>
            ) : (
              <>
                <ChevronDown size={16} />
                Show more
              </>
            )}
          </button>
          <button className="dismiss-btn" onClick={handleClose}>
            {currentIndex < notifications.length - 1 ? 'Next' : 'Dismiss'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotificationPopup;
