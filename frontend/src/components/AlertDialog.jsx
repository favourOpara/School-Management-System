import React, { useEffect } from 'react';
import './AlertDialog.css';

const AlertDialog = ({
  isOpen,
  type = 'info', // 'success', 'error', 'warning', 'info'
  title,
  message,
  onClose,
  autoClose = true,
  duration = 4000
}) => {
  useEffect(() => {
    if (isOpen && autoClose) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [isOpen, autoClose, duration, onClose]);

  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case 'success':
        return '✓';
      case 'error':
        return '✕';
      case 'warning':
        return '⚠';
      case 'info':
      default:
        return 'ℹ';
    }
  };

  const getTitle = () => {
    if (title) return title;
    switch (type) {
      case 'success':
        return 'Success';
      case 'error':
        return 'Error';
      case 'warning':
        return 'Warning';
      case 'info':
      default:
        return 'Information';
    }
  };

  return (
    <div className="alert-dialog-overlay" onClick={onClose}>
      <div
        className={`alert-dialog-content alert-${type}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="alert-dialog-icon">
          {getIcon()}
        </div>
        <div className="alert-dialog-text">
          <h4 className="alert-dialog-title">{getTitle()}</h4>
          <p className="alert-dialog-message">{message}</p>
        </div>
        <button
          className="alert-dialog-close"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
      </div>
    </div>
  );
};

export default AlertDialog;
