// src/components/ReportSentModal.jsx
import React, { useState, useEffect } from 'react';
import { X, Loader, CheckCircle, XCircle, AlertTriangle, DollarSign, BookOpen, HelpCircle } from 'lucide-react';
import './ReportSentModal.css';

const ReportSentModal = ({ classData, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [students, setStudents] = useState([]);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (classData) {
      fetchStudents();
    }
  }, [classData]);

  const fetchStudents = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('accessToken');

      const response = await fetch(
        `http://127.0.0.1:8000/api/schooladmin/analytics/reports-sent/class/${classData.class_session_id}/students/`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setStudents(data.students || []);
      } else {
        const errorData = await response.json();
        setError(errorData.detail || 'Error fetching students');
      }
    } catch (err) {
      console.error('Error:', err);
      setError('Failed to load students');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'sent':
        return <CheckCircle size={18} color="#10b981" />;
      case 'incomplete_fees':
        return <DollarSign size={18} color="#ef4444" />;
      case 'incomplete_grades':
        return <BookOpen size={18} color="#f59e0b" />;
      case 'both_issues':
        return <AlertTriangle size={18} color="#dc2626" />;
      case 'not_sent':
      default:
        return <XCircle size={18} color="#6b7280" />;
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'sent':
        return 'Report Sent';
      case 'incomplete_fees':
        return 'Unpaid Fees';
      case 'incomplete_grades':
        return 'Incomplete Grades';
      case 'both_issues':
        return 'Fees & Grades Issues';
      case 'not_sent':
      default:
        return 'Not Sent';
    }
  };

  const getStatusClass = (status) => {
    switch (status) {
      case 'sent':
        return 'status-sent';
      case 'incomplete_fees':
        return 'status-fees';
      case 'incomplete_grades':
        return 'status-grades';
      case 'both_issues':
        return 'status-both';
      case 'not_sent':
      default:
        return 'status-not-sent';
    }
  };

  const filteredStudents = students.filter(student => {
    if (filter === 'all') return true;
    return student.status === filter;
  });

  const statusCounts = {
    all: students.length,
    sent: students.filter(s => s.status === 'sent').length,
    incomplete_fees: students.filter(s => s.status === 'incomplete_fees').length,
    incomplete_grades: students.filter(s => s.status === 'incomplete_grades').length,
    both_issues: students.filter(s => s.status === 'both_issues').length,
    not_sent: students.filter(s => s.status === 'not_sent').length
  };

  if (!classData) return null;

  return (
    <div className="rsm-overlay">
      <div className="rsm-modal">
        <div className="rsm-header">
          <h2>{classData.class_name} - Report Status</h2>
          <button className="rsm-close" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <div className="rsm-summary">
          <div className="rsm-summary-item sent">
            <CheckCircle size={16} />
            <span>{statusCounts.sent} Sent</span>
          </div>
          <div className="rsm-summary-item not-sent">
            <XCircle size={16} />
            <span>{statusCounts.incomplete_fees + statusCounts.incomplete_grades + statusCounts.both_issues + statusCounts.not_sent} Not Sent</span>
          </div>
        </div>

        <div className="rsm-filters">
          <button
            className={`rsm-filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All ({statusCounts.all})
          </button>
          <button
            className={`rsm-filter-btn ${filter === 'sent' ? 'active' : ''}`}
            onClick={() => setFilter('sent')}
          >
            Sent ({statusCounts.sent})
          </button>
          <button
            className={`rsm-filter-btn ${filter === 'incomplete_fees' ? 'active' : ''}`}
            onClick={() => setFilter('incomplete_fees')}
          >
            Unpaid Fees ({statusCounts.incomplete_fees})
          </button>
          <button
            className={`rsm-filter-btn ${filter === 'incomplete_grades' ? 'active' : ''}`}
            onClick={() => setFilter('incomplete_grades')}
          >
            Incomplete Grades ({statusCounts.incomplete_grades})
          </button>
          <button
            className={`rsm-filter-btn ${filter === 'both_issues' ? 'active' : ''}`}
            onClick={() => setFilter('both_issues')}
          >
            Both Issues ({statusCounts.both_issues})
          </button>
          <button
            className={`rsm-filter-btn ${filter === 'not_sent' ? 'active' : ''}`}
            onClick={() => setFilter('not_sent')}
          >
            Not Sent ({statusCounts.not_sent})
          </button>
        </div>

        <div className="rsm-content">
          {loading ? (
            <div className="rsm-loading">
              <Loader size={32} className="rsm-spinner" />
              <p>Loading students...</p>
            </div>
          ) : error ? (
            <div className="rsm-error">
              <AlertTriangle size={32} />
              <p>{error}</p>
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="rsm-empty">
              <HelpCircle size={48} />
              <p>No students found with this status</p>
            </div>
          ) : (
            <div className="rsm-students-list">
              {filteredStudents.map((student) => (
                <div key={student.student_id} className="rsm-student-card">
                  <div className="rsm-student-info">
                    <div className="rsm-student-name">{student.student_name}</div>
                    <div className="rsm-student-username">@{student.username}</div>
                  </div>
                  <div className={`rsm-status-badge ${getStatusClass(student.status)}`}>
                    {getStatusIcon(student.status)}
                    <span>{getStatusLabel(student.status)}</span>
                  </div>
                  {student.sent_date && (
                    <div className="rsm-sent-date">
                      <small>Sent: {new Date(student.sent_date).toLocaleDateString()}</small>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReportSentModal;
