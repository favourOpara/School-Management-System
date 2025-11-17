// src/components/DashboardReportAccessCard.jsx
import React, { useState, useEffect } from 'react';
import { FileCheck, FileX, DollarSign, AlertCircle, Send, Bell } from 'lucide-react';
import Select from 'react-select';
import './DashboardReportAccessCard.css';
import ReportAccessModal from './ReportAccessModal';
import IncompleteGradesModal from './IncompleteGradesModal';
import UnpaidFeesModal from './UnpaidFeesModal';
import BothIssuesModal from './BothIssuesModal';

const termOptions = [
  { value: 'First Term', label: 'First Term' },
  { value: 'Second Term', label: 'Second Term' },
  { value: 'Third Term', label: 'Third Term' },
];

const selectStyles = {
  control: (base) => ({
    ...base,
    fontSize: '0.85rem',
    minHeight: '32px',
    backgroundColor: '#fff',
    borderColor: '#ccc',
  }),
  singleValue: (base) => ({
    ...base,
    color: '#222',
  }),
  placeholder: (base) => ({
    ...base,
    color: '#555',
  }),
  menu: (base) => ({
    ...base,
    fontSize: '0.85rem',
    color: '#222',
    zIndex: 9999,
  }),
  valueContainer: (base) => ({
    ...base,
    padding: '0 6px',
  }),
  dropdownIndicator: (base) => ({
    ...base,
    padding: '4px',
  }),
};

const DashboardReportAccessCard = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  const [sending, setSending] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [sendResult, setSendResult] = useState(null);
  const [showDrillDown, setShowDrillDown] = useState(false);
  const [showIncompleteGrades, setShowIncompleteGrades] = useState(false);
  const [showUnpaidFees, setShowUnpaidFees] = useState(false);
  const [showBothIssues, setShowBothIssues] = useState(false);
  const [sendingNotifications, setSendingNotifications] = useState(false);
  const [sendingFeeNotifications, setSendingFeeNotifications] = useState(false);
  const [notificationResult, setNotificationResult] = useState(null);
  const [feeNotificationResult, setFeeNotificationResult] = useState(null);
  const [academicYears, setAcademicYears] = useState([]);
  const [selectedYear, setSelectedYear] = useState(null);
  const [selectedTerm, setSelectedTerm] = useState(termOptions[0]);
  const [isFiltered, setIsFiltered] = useState(false);

  useEffect(() => {
    fetchAcademicYears();
  }, []);

  useEffect(() => {
    if (selectedYear && selectedTerm && (window.innerWidth > 768 || isFiltered)) {
      fetchReportAccessStats();
    }
  }, [selectedYear, selectedTerm, isFiltered]);

  const toggleFilters = () => {
    setIsFiltered(!isFiltered);
  };

  const fetchAcademicYears = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch('http://127.0.0.1:8000/api/academics/sessions/', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          const years = [...new Set(data.map(s => s.academic_year))].sort();
          const options = years.map(y => ({ value: y, label: y }));
          setAcademicYears(options);
          if (options.length > 0) {
            setSelectedYear(options[options.length - 1]);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching academic years:', err);
    }
  };

  const fetchReportAccessStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('accessToken');

      const params = new URLSearchParams();
      if (selectedYear) params.append('academic_year', selectedYear.value);
      if (selectedTerm) params.append('term', selectedTerm.value);

      const response = await fetch(`http://127.0.0.1:8000/api/schooladmin/analytics/report-access/?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      } else {
        const errorData = await response.json();
        setError(errorData.detail || 'Error fetching report access statistics');
      }
    } catch (err) {
      console.error('Error:', err);
      setError('Failed to load report access statistics');
    } finally {
      setLoading(false);
    }
  };

  const handleSendReports = async () => {
    try {
      setSending(true);
      setSendResult(null);
      const token = localStorage.getItem('accessToken');

      const response = await fetch('http://127.0.0.1:8000/api/schooladmin/analytics/report-access/send/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          academic_year: stats.academic_year,
          term: stats.term
        })
      });

      if (response.ok) {
        const data = await response.json();
        setSendResult({
          success: true,
          message: data.message,
          details: data.details
        });
        // Refresh stats after sending
        fetchReportAccessStats();
      } else {
        const errorData = await response.json();
        setSendResult({
          success: false,
          message: errorData.detail || 'Error sending report sheets'
        });
      }
    } catch (err) {
      console.error('Error:', err);
      setSendResult({
        success: false,
        message: 'Failed to send report sheets'
      });
    } finally {
      setSending(false);
      setShowConfirm(false);
    }
  };

  const handleSendBulkNotifications = async () => {
    try {
      setSendingNotifications(true);
      setNotificationResult(null);
      const token = localStorage.getItem('accessToken');

      const response = await fetch('http://127.0.0.1:8000/api/schooladmin/analytics/incomplete-grades/notify-all/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setNotificationResult({
          success: true,
          message: data.message,
          count: data.notifications_sent
        });
      } else {
        const errorData = await response.json();
        setNotificationResult({
          success: false,
          message: errorData.detail || 'Error sending notifications'
        });
      }
    } catch (err) {
      console.error('Error:', err);
      setNotificationResult({
        success: false,
        message: 'Failed to send notifications'
      });
    } finally {
      setSendingNotifications(false);
    }
  };

  const handleSendBulkFeeNotifications = async () => {
    try {
      setSendingFeeNotifications(true);
      setFeeNotificationResult(null);
      const token = localStorage.getItem('accessToken');

      const response = await fetch('http://127.0.0.1:8000/api/schooladmin/analytics/unpaid-fees/notify-all/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setFeeNotificationResult({
          success: true,
          message: data.message,
          count: data.notifications_sent
        });
      } else {
        const errorData = await response.json();
        setFeeNotificationResult({
          success: false,
          message: errorData.detail || 'Error sending fee notifications'
        });
      }
    } catch (err) {
      console.error('Error:', err);
      setFeeNotificationResult({
        success: false,
        message: 'Failed to send fee notifications'
      });
    } finally {
      setSendingFeeNotifications(false);
    }
  };

  const { total_students, statistics } = stats || {};

  return (
    <div className={`report-access-wrapper ${isFiltered ? 'ra-filters-active' : ''}`}>
      <div className="report-access-card">
        <div className="report-access-header">
          <FileCheck size={28} color="#10b981" />
          <div>
            <h3>Report Sheet Access</h3>
            <p>Track student readiness for report sheets</p>
          </div>
        </div>

        <div className="report-access-filters">
          <Select
            options={academicYears}
            value={selectedYear}
            onChange={setSelectedYear}
            placeholder="Year"
            styles={selectStyles}
            className="ra-filter-select"
          />
          <Select
            options={termOptions}
            value={selectedTerm}
            onChange={setSelectedTerm}
            placeholder="Term"
            styles={selectStyles}
            className="ra-filter-select"
          />
          <button
            className="ra-filter-btn"
            onClick={toggleFilters}
          >
            Filter
          </button>
          <button
            className="ra-close-btn"
            onClick={toggleFilters}
          >
            Close
          </button>
        </div>

        {loading ? (
          <div className="report-access-loading">
            <div className="spinner-small"></div>
            <p>Loading statistics...</p>
          </div>
        ) : error ? (
          <div className="report-access-error">
            <AlertCircle size={32} />
            <p>{error}</p>
          </div>
        ) : window.innerWidth <= 768 && !isFiltered ? (
          <div className="ra-no-data">
            <p>Click 'Filter' to view data</p>
          </div>
        ) : !stats ? (
          <div className="report-access-empty">
            <FileX size={48} />
            <p>No data available</p>
          </div>
        ) : (
          <div className="report-access-stats">
            {/* Section 1: Complete (No Bar) */}
            <div
              className="report-access-section complete-section clickable"
              onClick={() => statistics.complete.count > 0 && setShowDrillDown(true)}
            >
              <div className="section-header">
                <div className="section-icon complete-icon">
                  <FileCheck size={20} />
                </div>
                <div className="section-info">
                  <h4>Complete</h4>
                  <p>Fees Paid & Grades Complete</p>
                </div>
              </div>
              <div className="section-count">
                <span className="count-value">{statistics.complete.count}</span>
                <span className="count-total">/ {total_students}</span>
              </div>
              {statistics.complete.count > 0 && (
                <button
                  className="send-report-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowConfirm(true);
                  }}
                  disabled={sending}
                >
                  <Send size={16} />
                  Send All Reports
                </button>
              )}
            </div>

            {/* Section 2: Fees Paid, Grades Incomplete */}
            <div
              className={`report-access-section ${statistics.fees_paid_grades_incomplete.count > 0 ? 'clickable' : ''}`}
              onClick={() => statistics.fees_paid_grades_incomplete.count > 0 && setShowIncompleteGrades(true)}
            >
              <div className="section-header">
                <div className="section-icon fees-paid-icon">
                  <DollarSign size={20} />
                </div>
                <div className="section-info">
                  <h4>Fees Paid, Grades Incomplete</h4>
                  <p>{statistics.fees_paid_grades_incomplete.count} students</p>
                </div>
              </div>
              <div className="section-bar">
                <div className="progress-bar">
                  <div
                    className="progress-fill fees-paid-fill"
                    style={{ width: `${statistics.fees_paid_grades_incomplete.percentage}%` }}
                  ></div>
                </div>
                <span className="percentage-text">{statistics.fees_paid_grades_incomplete.percentage}%</span>
              </div>
              {statistics.fees_paid_grades_incomplete.count > 0 && (
                <button
                  className="notify-all-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSendBulkNotifications();
                  }}
                  disabled={sendingNotifications}
                >
                  <Bell size={16} />
                  {sendingNotifications ? 'Sending...' : 'Notify All'}
                </button>
              )}
            </div>

            {/* Section 3: Fees Unpaid, Grades Complete */}
            <div
              className={`report-access-section ${statistics.fees_unpaid_grades_complete.count > 0 ? 'clickable' : ''}`}
              onClick={() => statistics.fees_unpaid_grades_complete.count > 0 && setShowUnpaidFees(true)}
            >
              <div className="section-header">
                <div className="section-icon fees-unpaid-icon">
                  <FileCheck size={20} />
                </div>
                <div className="section-info">
                  <h4>Fees Unpaid, Grades Complete</h4>
                  <p>{statistics.fees_unpaid_grades_complete.count} students</p>
                </div>
              </div>
              <div className="section-bar">
                <div className="progress-bar">
                  <div
                    className="progress-fill fees-unpaid-fill"
                    style={{ width: `${statistics.fees_unpaid_grades_complete.percentage}%` }}
                  ></div>
                </div>
                <span className="percentage-text">{statistics.fees_unpaid_grades_complete.percentage}%</span>
              </div>
              {statistics.fees_unpaid_grades_complete.count > 0 && (
                <button
                  className="notify-all-btn fee-notify-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSendBulkFeeNotifications();
                  }}
                  disabled={sendingFeeNotifications}
                >
                  <Bell size={16} />
                  {sendingFeeNotifications ? 'Sending...' : 'Notify All'}
                </button>
              )}
            </div>

            {/* Section 4: Fees Unpaid, Grades Incomplete */}
            <div
              className={`report-access-section ${statistics.fees_unpaid_grades_incomplete.count > 0 ? 'clickable' : ''}`}
              onClick={() => statistics.fees_unpaid_grades_incomplete.count > 0 && setShowBothIssues(true)}
            >
              <div className="section-header">
                <div className="section-icon incomplete-icon">
                  <AlertCircle size={20} />
                </div>
                <div className="section-info">
                  <h4>Fees Unpaid, Grades Incomplete</h4>
                  <p>{statistics.fees_unpaid_grades_incomplete.count} students</p>
                </div>
              </div>
              <div className="section-bar">
                <div className="progress-bar">
                  <div
                    className="progress-fill incomplete-fill"
                    style={{ width: `${statistics.fees_unpaid_grades_incomplete.percentage}%` }}
                  ></div>
                </div>
                <span className="percentage-text">{statistics.fees_unpaid_grades_incomplete.percentage}%</span>
              </div>
            </div>
          </div>
        )}

      {/* Success/Error Message */}
      {sendResult && (
        <div className={`send-result ${sendResult.success ? 'success' : 'error'}`}>
          <p>{sendResult.message}</p>
          {sendResult.success && sendResult.details && (
            <div className="send-details">
              <small>
                Students: {sendResult.details.students_sent} |
                Student Notifications: {sendResult.details.student_notifications} |
                Parent Notifications: {sendResult.details.parent_notifications}
              </small>
            </div>
          )}
          <button onClick={() => setSendResult(null)} className="close-result-btn">×</button>
        </div>
      )}

      {/* Notification Result Message */}
      {notificationResult && (
        <div className={`send-result ${notificationResult.success ? 'success' : 'error'}`}>
          <p>{notificationResult.message}</p>
          <button onClick={() => setNotificationResult(null)} className="close-result-btn">×</button>
        </div>
      )}

      {/* Fee Notification Result Message */}
      {feeNotificationResult && (
        <div className={`send-result ${feeNotificationResult.success ? 'success' : 'error'}`}>
          <p>{feeNotificationResult.message}</p>
          <button onClick={() => setFeeNotificationResult(null)} className="close-result-btn">×</button>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="modal-overlay">
          <div className="confirmation-modal">
            <h3>Send Report Sheets?</h3>
            <p>
              You are about to send report sheets to <strong>{statistics.complete.count} student(s)</strong> and their parents.
            </p>
            <p className="warning-text">
              This action cannot be undone. Each student and parent will receive a notification.
            </p>
            <div className="modal-actions">
              <button
                onClick={() => setShowConfirm(false)}
                className="cancel-btn"
                disabled={sending}
              >
                Cancel
              </button>
              <button
                onClick={handleSendReports}
                className="confirm-btn"
                disabled={sending}
              >
                {sending ? 'Sending...' : 'Send Reports'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Drill-down Modal for Classes and Students */}
      <ReportAccessModal
        isOpen={showDrillDown}
        onClose={() => setShowDrillDown(false)}
        onRefreshStats={fetchReportAccessStats}
      />

      {/* Incomplete Grades Modal */}
      <IncompleteGradesModal
        isOpen={showIncompleteGrades}
        onClose={() => setShowIncompleteGrades(false)}
      />

      {/* Unpaid Fees Modal */}
      <UnpaidFeesModal
        isOpen={showUnpaidFees}
        onClose={() => setShowUnpaidFees(false)}
      />

      {/* Both Issues Modal (Unpaid Fees + Incomplete Grades) */}
        <BothIssuesModal
          isOpen={showBothIssues}
          onClose={() => setShowBothIssues(false)}
        />
      </div>
    </div>
  );
};

export default DashboardReportAccessCard;
