import React, { useState, useEffect } from 'react';
import Calendar from 'react-calendar';
import { X, Trash2 } from 'lucide-react';
import 'react-calendar/dist/Calendar.css';
import './attendance.css';
import axios from 'axios';

const EditAttendanceCalendar = ({ academicYear, term, onClose, onUpdate }) => {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [excludeWeekends, setExcludeWeekends] = useState(false);
  const [selectedDates, setSelectedDates] = useState([]);
  const [holidays, setHolidays] = useState({});
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [calendarKey, setCalendarKey] = useState(0);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const token = localStorage.getItem('accessToken');

  // Helper function to format date consistently (avoid timezone issues)
  const formatDateString = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  useEffect(() => {
    console.log('EditAttendanceCalendar props:', { academicYear, term });
  }, [academicYear, term]);

  useEffect(() => {
    fetchExistingCalendar();
  }, [academicYear, term]);

  const fetchExistingCalendar = async () => {
    try {
      setLoading(true);
      console.log('Fetching calendar for:', academicYear, term);
      
      const res = await axios.get('http://127.0.0.1:8000/api/attendance/calendar/', {
        headers: { Authorization: `Bearer ${token}` },
      });

      console.log('Fetched calendars:', res.data);

      const existingCalendar = res.data.find(
        cal => cal.academic_year === academicYear && cal.term === term
      );

      console.log('Found existing calendar:', existingCalendar);

      if (existingCalendar) {
        const schoolDayDates = existingCalendar.school_days
          .filter(day => !day.holiday_label)
          .map(day => new Date(day.date + 'T00:00:00'));

        const holidayData = {};
        existingCalendar.school_days
          .filter(day => day.holiday_label)
          .forEach(day => {
            holidayData[day.date] = day.holiday_label.label;
          });

        setSelectedDates(schoolDayDates);
        setHolidays(holidayData);
        setCalendarKey(prevKey => prevKey + 1);

        if (schoolDayDates.length > 0) {
          const sortedDates = schoolDayDates.sort((a, b) => a - b);
          setFromDate(formatDateString(sortedDates[0]));
          setToDate(formatDateString(sortedDates[sortedDates.length - 1]));
        }
      }
    } catch (err) {
      console.error('Error loading existing calendar:', err);
      console.error("Error response:", err.response?.data);
      console.error("Error status:", err.response?.status);
      setMessage(`Failed to load existing calendar: ${err.response?.data?.error || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAutoPopulate = () => {
    if (!fromDate || !toDate) {
      alert("Please select both From and To dates.");
      return;
    }

    const start = new Date(fromDate + 'T00:00:00');
    const end = new Date(toDate + 'T00:00:00');
    const range = [];

    let current = new Date(start);
    while (current <= end) {
      const isWeekend = current.getDay() === 0 || current.getDay() === 6;
      if (!excludeWeekends || !isWeekend) {
        range.push(new Date(current));
      }
      current.setDate(current.getDate() + 1);
    }

    setSelectedDates(range);
    setCalendarKey(prevKey => prevKey + 1);
  };

  const toggleDate = (date) => {
    const dateStr = formatDateString(date);
    const isSelected = selectedDates.some(d => d.toDateString() === date.toDateString());
    const isHoliday = holidays[dateStr] !== undefined;

    if (!isSelected) {
      setSelectedDates([...selectedDates, date]);
    } else if (!isHoliday) {
      setHolidays(prev => ({ ...prev, [dateStr]: '' }));
    } else {
      const updated = { ...holidays };
      delete updated[dateStr];
      setHolidays(updated);
    }
  };

  const handleHolidayLabelChange = (dateStr, value) => {
    setHolidays(prev => ({ ...prev, [dateStr]: value }));
  };

  const tileClassName = ({ date }) => {
    const dateStr = formatDateString(date);
    if (holidays[dateStr] !== undefined) return 'holiday-day';
    if (selectedDates.some(d => d.toDateString() === date.toDateString())) return 'school-day';
    return null;
  };

  const handleSubmit = async () => {
    const school_days = selectedDates.map(date => formatDateString(date));

    console.log('Debug - academicYear:', academicYear);
    console.log('Debug - term:', term);
    console.log('Debug - selectedDates:', selectedDates);
    console.log('Debug - school_days:', school_days);
    console.log('Debug - holidays:', holidays);

    if (!academicYear || !term || school_days.length === 0) {
      alert(`Client validation failed:
        Academic Year: ${academicYear || 'undefined'}
        Term: ${term || 'undefined'}
        School Days: ${school_days.length} days selected`);
      return;
    }

    const formattedHolidays = Object.entries(holidays).map(([date, label]) => ({
      date,
      label: label || "Holiday",
    }));

    const payload = {
      academic_year: academicYear,
      term: term,
      school_days,
      holidays: formattedHolidays,
    };

    console.log('Update payload:', JSON.stringify(payload, null, 2));
    console.log('Using token:', token ? 'Token exists' : 'No token');

    setLoading(true);
    try {
      const response = await axios.put(`http://127.0.0.1:8000/api/attendance/calendar/update/`, payload, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
      });

      console.log('Update response:', response.data);
      setMessage("Attendance calendar updated successfully.");
      
      if (onUpdate) {
        onUpdate();
      }
      
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      console.error("Update failed", err);
      console.error("Error response:", err.response?.data);
      console.error("Error status:", err.response?.status);
      console.error("Full error object:", err);
      
      let errorMessage = 'Failed to update calendar.';
      if (err.response?.status === 404) {
        errorMessage = `Calendar for ${academicYear} - ${term} not found. Please create it first.`;
      } else if (err.response?.data?.error) {
        errorMessage = err.response.data.error;
      } else if (err.response?.data?.detail) {
        errorMessage = err.response.data.detail;
      }
      
      setMessage(errorMessage);
      alert(`${errorMessage} Status: ${err.response?.status}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCalendar = async () => {
    if (!academicYear || !term) {
      console.error('Missing academicYear or term for deletion:', { academicYear, term });
      setMessage('Error: Missing academic year or term information');
      setDeleting(false);
      setShowDeleteConfirm(false);
      return;
    }

    console.log('Starting delete process for:', academicYear, term);
    console.log('Using token:', token ? 'Token exists' : 'No token');

    setDeleting(true);
    
    try {
      const payload = {
        academic_year: academicYear,
        term: term,
      };

      console.log('Delete payload:', JSON.stringify(payload, null, 2));

      const response = await axios.delete(`http://127.0.0.1:8000/api/attendance/calendar/delete/`, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        data: payload
      });

      console.log('Delete response status:', response.status);
      console.log('Delete response data:', response.data);
      
      setMessage("Attendance calendar deleted successfully.");
      
      if (onUpdate) {
        onUpdate();
      }
      
      setTimeout(() => {
        onClose();
      }, 1500);
      
    } catch (err) {
      console.error("Delete failed", err);
      console.error("Error response:", err.response?.data);
      console.error("Error status:", err.response?.status);
      console.error("Full error object:", err);
      
      let errorMessage = 'Failed to delete calendar.';
      if (err.response?.status === 404) {
        errorMessage = `Calendar for ${academicYear} - ${term} not found.`;
      } else if (err.response?.data?.error) {
        errorMessage = err.response.data.error;
      } else if (err.response?.data?.detail) {
        errorMessage = err.response.data.detail;
      } else if (err.message) {
        errorMessage = `Network error: ${err.message}`;
      }
      
      setMessage(errorMessage);
      alert(`Delete failed: ${errorMessage} Status: ${err.response?.status}`);
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleDeleteClick = () => {
    console.log('Delete button clicked - showing confirmation');
    setShowDeleteConfirm(true);
  };

  const cancelDelete = () => {
    console.log('Delete cancelled by user');
    setShowDeleteConfirm(false);
  };

  const confirmDelete = () => {
    console.log('Delete confirmed by user');
    handleDeleteCalendar();
  };

  return (
    <>
      <div className="edit-calendar-overlay">
        <div className="edit-calendar-modal-container">
          <div className="edit-calendar-modal-header">
            <h2>Edit Attendance Calendar</h2>
            <button className="edit-calendar-close-btn" onClick={onClose}>
              <X size={24} />
            </button>
          </div>

          <div className="edit-calendar-modal-content">
            <div className="mobile-header-only">
              Academic Year: <strong>{academicYear}</strong><br />
              Term: <strong>{term}</strong>
            </div>

            <div className="create-attendance-vertical-layout">
              <div className="calendar-controls-column">
                <h3>Edit Attendance Calendar</h3>

                <div className="date-inputs-container">
                  <div className="date-input-group">
                    <label htmlFor="from-date" className="date-label">From:</label>
                    <input
                      type="date"
                      id="from-date"
                      className="date-field"
                      value={fromDate}
                      onChange={e => setFromDate(e.target.value)}
                    />
                  </div>

                  <div className="date-input-group">
                    <label htmlFor="to-date" className="date-label">To:</label>
                    <input
                      type="date"
                      id="to-date"
                      className="date-field"
                      value={toDate}
                      onChange={e => setToDate(e.target.value)}
                    />
                  </div>

                  <div className="control-actions">
                    <div className="exclude-weekends-group">
                      <input
                        type="checkbox"
                        id="exclude-weekends"
                        className="weekend-checkbox"
                        checked={excludeWeekends}
                        onChange={e => setExcludeWeekends(e.target.checked)}
                      />
                      <label htmlFor="exclude-weekends" className="weekend-label">Exclude Weekends</label>
                    </div>

                    <button type="button" className="auto-populate-btn" onClick={handleAutoPopulate}>
                      Auto Populate
                    </button>
                  </div>
                </div>
              </div>

              <div className="calendar-display-column">
                <Calendar
                  key={calendarKey}
                  tileClassName={tileClassName}
                  onClickDay={toggleDate}
                />
              </div>
            </div>

            {Object.keys(holidays).length > 0 && (
              <div className="holiday-labels">
                <h4>Label Holiday Days (Optional)</h4>
                <div className="holiday-inputs">
                  {Object.entries(holidays).map(([dateStr, label]) => (
                    <div key={dateStr} className="holiday-input-group">
                      <strong>{dateStr}:</strong>
                      <input
                        type="text"
                        value={label}
                        onChange={(e) => handleHolidayLabelChange(dateStr, e.target.value)}
                        placeholder="Holiday name"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="calendar-action-buttons">
              <button 
                className="submit-calendar-btn" 
                onClick={handleSubmit}
                disabled={loading || deleting}
              >
                {loading ? 'Updating Calendar...' : 'Update Calendar'}
              </button>

              <button 
                className="delete-calendar-btn" 
                onClick={handleDeleteClick}
                disabled={loading || deleting}
                style={{
                  marginTop: '10px',
                  padding: '0.9rem',
                  fontSize: '1rem',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  fontWeight: '500',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: loading || deleting ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  justifyContent: 'center',
                  width: '100%',
                  maxWidth: '200px',
                  alignSelf: 'flex-end'
                }}
              >
                <Trash2 size={16} />
                {deleting ? 'Deleting Calendar...' : 'Delete Calendar'}
              </button>
            </div>

            {message && (
              <p 
                className="form-message" 
                style={{
                  color: message.includes('Failed') || message.includes('Error') ? 'red' : 'green',
                  marginTop: '1rem',
                  padding: '0.75rem',
                  borderRadius: '6px',
                  fontWeight: '500',
                  textAlign: 'center',
                  backgroundColor: message.includes('Failed') || message.includes('Error') ? '#f8d7da' : '#d4edda',
                  border: message.includes('Failed') || message.includes('Error') ? '1px solid #f5c6cb' : '1px solid #c3e6cb'
                }}
              >
                {message}
              </p>
            )}
          </div>
        </div>
      </div>

      {showDeleteConfirm && (
        <div className="calendar-delete-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1100,
          padding: '1rem'
        }}>
          <div className="calendar-delete-modal" style={{
            backgroundColor: 'white',
            padding: '2rem',
            borderRadius: '10px',
            maxWidth: '500px',
            width: '100%',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)'
          }}>
            <h3 style={{
              color: '#dc3545',
              marginTop: 0,
              marginBottom: '1rem',
              fontSize: '1.3rem',
              fontWeight: '600'
            }}>
              Confirm Deletion
            </h3>
            <p style={{
              marginBottom: '1rem',
              color: '#333',
              lineHeight: '1.5'
            }}>
              Are you sure you want to delete the attendance calendar for <strong>{academicYear} - {term}</strong>?
            </p>
            <p className="calendar-delete-warning" style={{
              color: '#dc3545',
              fontWeight: '500',
              marginBottom: '1.5rem',
              fontSize: '0.9rem',
              lineHeight: '1.4'
            }}>
              This action cannot be undone and will permanently remove all school days, holidays, and attendance data for this academic period.
            </p>
            <div className="calendar-delete-actions" style={{
              display: 'flex',
              gap: '1rem',
              justifyContent: 'flex-end'
            }}>
              <button 
                className="calendar-cancel-btn" 
                onClick={cancelDelete}
                disabled={deleting}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '0.95rem',
                  fontWeight: '500',
                  cursor: deleting ? 'not-allowed' : 'pointer',
                  opacity: deleting ? 0.6 : 1
                }}
              >
                Cancel
              </button>
              <button 
                className="calendar-confirm-delete-btn" 
                onClick={confirmDelete}
                disabled={deleting}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '0.95rem',
                  fontWeight: '500',
                  cursor: deleting ? 'not-allowed' : 'pointer',
                  opacity: deleting ? 0.6 : 1
                }}
              >
                {deleting ? 'Deleting...' : 'Yes, Delete Calendar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default EditAttendanceCalendar;