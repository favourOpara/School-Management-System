import React, { useState, useEffect } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import './attendance.css';
import axios from 'axios';

const CreateAttendanceCalendar = ({ selectedYear, selectedTerm }) => {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [excludeWeekends, setExcludeWeekends] = useState(false);
  const [selectedDates, setSelectedDates] = useState([]);
  const [holidays, setHolidays] = useState({});
  const [message, setMessage] = useState('');
  const [calendarKey, setCalendarKey] = useState(0); // Add a key to force re-render

  const token = localStorage.getItem('accessToken');

  const handleAutoPopulate = () => {
    if (!fromDate || !toDate) {
      alert("Please select both From and To dates.");
      return;
    }

    const start = new Date(fromDate);
    const end = new Date(toDate);
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
    setCalendarKey(prevKey => prevKey + 1); // Force calendar to re-render
  };

  const toggleDate = (date) => {
    const dateStr = date.toISOString().split('T')[0];
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
    const dateStr = date.toISOString().split('T')[0];
    if (holidays[dateStr] !== undefined) return 'holiday-day';
    if (selectedDates.some(d => d.toDateString() === date.toDateString())) return 'school-day';
    return null;
  };

  const handleSubmit = async () => {
    const school_days = selectedDates.map(date => date.toISOString().split('T')[0]);

    if (!selectedYear || !selectedTerm || school_days.length === 0) {
      alert("Missing academic year, term or school days.");
      return;
    }

    const formattedHolidays = Object.entries(holidays).map(([date, label]) => ({
      date,
      label: label || "Holiday",
    }));

    const payload = {
      academic_year: selectedYear,
      term: selectedTerm,
      school_days,
      holidays: formattedHolidays,
    };

    try {
      await axios.post('http://127.0.0.1:8000/api/attendance/calendar/create/', payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setMessage("Attendance calendar submitted successfully.");
    } catch (err) {
      console.error("Submission failed", err);
      alert("Failed to submit calendar.");
    }
  };

  return (
    <>
      <div className="mobile-header-only">
        {selectedYear && selectedTerm && (
          <>
            Academic Year: <strong>{selectedYear}</strong><br />
            Term: <strong>{selectedTerm}</strong>
          </>
        )}
      </div>

      <div className="create-attendance-vertical-layout">
        <div className="calendar-controls-column">
          <h3>Create Attendance Calendar</h3>

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
            key={calendarKey} // Add key to force re-render
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

      <button className="submit-calendar-btn" onClick={handleSubmit}>
        Submit Calendar
      </button>

      {message && <p className="form-message success">{message}</p>}
    </>
  );
};

export default CreateAttendanceCalendar;