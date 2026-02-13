import React, { useState, useEffect, useCallback } from 'react';
import { useSchool } from '../contexts/SchoolContext';
import { CheckCircle, Clock, AlertCircle, LogIn, LogOut } from 'lucide-react';
import './ManageStaff.css';

const DAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const StaffBookOnOff = () => {
  const { buildApiUrl } = useSchool();
  const token = localStorage.getItem('accessToken');

  const [schedule, setSchedule] = useState(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const fetchSchedule = useCallback(async () => {
    try {
      const res = await fetch(buildApiUrl('/schooladmin/staff/my-schedule/'), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSchedule(data);
      }
    } catch (err) {
      setError('Failed to load schedule');
    } finally {
      setLoading(false);
    }
  }, [buildApiUrl, token]);

  const fetchRecords = useCallback(async () => {
    try {
      const res = await fetch(buildApiUrl('/schooladmin/staff/my-records/'), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setRecords(data);
      }
    } catch (err) {
      console.error('Failed to load records');
    }
  }, [buildApiUrl, token]);

  useEffect(() => { fetchSchedule(); fetchRecords(); }, [fetchSchedule, fetchRecords]);

  const handleBookOn = async () => {
    setBooking(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch(buildApiUrl('/schooladmin/staff/book-on/'), {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(data.message);
        fetchSchedule();
        fetchRecords();
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setBooking(false);
    }
  };

  const handleBookOff = async () => {
    setBooking(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch(buildApiUrl('/schooladmin/staff/book-off/'), {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(data.message);
        fetchSchedule();
        fetchRecords();
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setBooking(false);
    }
  };

  if (loading) return <p>Loading...</p>;

  if (!schedule || !schedule.has_schedule) {
    return (
      <div className="book-on-off-container">
        <h2>Book On/Off</h2>
        <div className="manage-staff-upgrade-prompt">
          <AlertCircle size={48} />
          <h3>No Schedule Assigned</h3>
          <p>You have not been assigned to a schedule group yet. Please contact your administrator.</p>
        </div>
      </div>
    );
  }

  const { schedule_group, today, windows } = schedule;
  const hasBookedOn = !!today.book_on_time;
  const hasBookedOff = !!today.book_off_time;
  const isWorkDay = today.is_work_day;

  const getStatusBadge = (statusValue) => {
    if (!statusValue) return null;
    if (statusValue === 'ON_TIME') return <span className="status-badge on-time">On Time</span>;
    if (statusValue === 'LATE') return <span className="status-badge late">Late</span>;
    return null;
  };

  return (
    <div className="book-on-off-container">
      <h2>Book On/Off</h2>

      {error && <div className="staff-alert staff-alert-error">{error}</div>}
      {success && <div className="staff-alert staff-alert-success">{success}</div>}

      {/* Schedule Info */}
      <div className="book-schedule-card">
        <h3>{schedule_group.name}</h3>
        <div className="book-schedule-info">
          <div className="info-item">
            <span className="info-label">Work Days</span>
            <span className="info-value">{schedule_group.days.map(d => DAY_LABELS[d]).join(', ')}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Working Hours</span>
            <span className="info-value">{schedule_group.start_time} - {schedule_group.end_time}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Grace Period</span>
            <span className="info-value">{schedule_group.grace_period_minutes} minutes</span>
          </div>
          <div className="info-item">
            <span className="info-label">Server Time</span>
            <span className="info-value">{schedule.server_time}</span>
          </div>
        </div>

        {/* Today's Status */}
        {!isWorkDay ? (
          <div className="book-status-display info" style={{ marginTop: '1rem' }}>
            <Clock size={18} />
            <span>Today is not a scheduled work day.</span>
          </div>
        ) : (
          <>
            {/* Book On Status */}
            {hasBookedOn && (
              <div className={`book-status-display ${today.book_on_status === 'ON_TIME' ? 'success' : 'warning'}`}>
                <CheckCircle size={18} />
                <span>Booked on at {today.book_on_time} {getStatusBadge(today.book_on_status)}</span>
              </div>
            )}

            {/* Book Off Status */}
            {hasBookedOff && (
              <div className={`book-status-display ${today.book_off_status === 'ON_TIME' ? 'success' : 'warning'}`}>
                <CheckCircle size={18} />
                <span>Booked off at {today.book_off_time} {getStatusBadge(today.book_off_status)}</span>
              </div>
            )}

            {/* Action Buttons */}
            {isWorkDay && (
              <div className="book-actions">
                {!hasBookedOn ? (
                  <button
                    className="book-btn book-btn-on"
                    onClick={handleBookOn}
                    disabled={booking}
                  >
                    <LogIn size={20} />
                    {booking ? 'Booking...' : 'Book On'}
                  </button>
                ) : (
                  <button className="book-btn book-btn-done" disabled>
                    <CheckCircle size={20} />
                    Booked On
                  </button>
                )}

                {hasBookedOn && !hasBookedOff ? (
                  <button
                    className="book-btn book-btn-off"
                    onClick={handleBookOff}
                    disabled={booking}
                  >
                    <LogOut size={20} />
                    {booking ? 'Booking...' : 'Book Off'}
                  </button>
                ) : hasBookedOff ? (
                  <button className="book-btn book-btn-done" disabled>
                    <CheckCircle size={20} />
                    Booked Off
                  </button>
                ) : (
                  <button className="book-btn book-btn-off" disabled>
                    <LogOut size={20} />
                    Book Off
                  </button>
                )}
              </div>
            )}

            {/* Window Info */}
            {windows && !hasBookedOn && (
              <div className="book-status-display info" style={{ marginTop: '0.5rem' }}>
                <Clock size={16} />
                <span>Book-on window: {windows.book_on_start} - {windows.book_on_end}</span>
              </div>
            )}
            {windows && hasBookedOn && !hasBookedOff && (
              <div className="book-status-display info" style={{ marginTop: '0.5rem' }}>
                <Clock size={16} />
                <span>Book-off window: {windows.book_off_start} - {windows.book_off_end}</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Attendance History */}
      {records.length > 0 && (
        <div>
          <h3 style={{ marginBottom: '0.75rem', fontSize: '1rem', fontWeight: 600, color: '#1e293b' }}>
            Recent Attendance
          </h3>
          <div className="staff-table-wrapper">
            <table className="staff-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Book On</th>
                  <th>Status</th>
                  <th>Book Off</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r, idx) => (
                  <tr key={idx}>
                    <td>{r.date}</td>
                    <td>{r.book_on_time || '-'}</td>
                    <td>
                      {r.book_on_status === 'ON_TIME' && <span className="status-badge on-time">On Time</span>}
                      {r.book_on_status === 'LATE' && <span className="status-badge late">Late</span>}
                      {!r.book_on_status && <span className="status-badge no-record">No Record</span>}
                    </td>
                    <td>{r.book_off_time || '-'}</td>
                    <td>
                      {r.book_off_status === 'ON_TIME' && <span className="status-badge on-time">On Time</span>}
                      {r.book_off_status === 'LATE' && <span className="status-badge late">Late</span>}
                      {!r.book_off_status && <span className="status-badge no-record">No Record</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffBookOnOff;
