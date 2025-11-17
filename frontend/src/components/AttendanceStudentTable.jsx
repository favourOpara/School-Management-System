import React, { useState } from 'react';
import './attendancestudenttable.css';
import { useDialog } from '../contexts/DialogContext';

const AttendanceStudentTable = ({ subjectName, students, schoolDays, onUpdateAttendance }) => {
  const { showAlert } = useDialog();
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [calendarVisible, setCalendarVisible] = useState(false);

  const handleOpenCalendar = (student) => {
    setSelectedStudent(student);
    setCalendarVisible(true);
  };

  const handleToggleDate = (date) => {
    if (!selectedStudent || !onUpdateAttendance) return;

    const isMarked = selectedStudent.attended_days.includes(date);

    const updatedDays = isMarked
      ? selectedStudent.attended_days.filter(d => d !== date)
      : [...selectedStudent.attended_days, date];

    onUpdateAttendance(selectedStudent.id, updatedDays);
  };

  const handleCloseModal = () => {
    setSelectedStudent(null);
    setCalendarVisible(false);
  };

  const getDaysMissed = (attendedDays) =>
    schoolDays.filter(d => !attendedDays.includes(d));

  return (
    <div className="student-attendance-table-wrapper">
      <h3 className="student-attendance-header">Attendance Records – {subjectName}</h3>

      <table className="student-attendance-table">
        <thead>
          <tr>
            <th>Student Name</th>
            <th>Days Attended</th>
            <th>Days Missed</th>
            <th>Last Updated By</th>
            <th>Last Updated At</th>
          </tr>
        </thead>
        <tbody>
          {students.map(student => {
            const missedDays = getDaysMissed(student.attended_days);
            return (
              <tr key={student.id}>
                <td>{student.full_name}</td>
                <td>
                  <button
                    className="attendance-days-btn"
                    onClick={() => handleOpenCalendar(student)}
                  >
                    {student.attended_days.length}
                  </button>
                </td>
                <td>
                  <button
                    className="missed-days-btn"
                    onClick={() =>
                      showAlert({
                        type: 'info',
                        title: 'Missed Days',
                        message: `${missedDays.length} missed days:\n${missedDays.join('\n')}`,
                        autoClose: false
                      })
                    }
                  >
                    {missedDays.length}
                  </button>
                </td>
                <td>{student.last_updated_by}</td>
                <td>{student.last_updated_at}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Modal calendar */}
      {calendarVisible && selectedStudent && (
        <div className="attendance-calendar-modal-overlay">
          <div className="attendance-calendar-modal">
            <h3>
              Attendance for {selectedStudent.full_name}
            </h3>
            <div className="attendance-calendar-grid">
              {schoolDays.map(date => {
                const isSelected = selectedStudent.attended_days.includes(date);
                return (
                  <div
                    key={date}
                    className={`calendar-day-box ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleToggleDate(date)}
                  >
                    {date}
                  </div>
                );
              })}
            </div>
            <div className="attendance-calendar-actions">
              <button className="close-calendar-btn" onClick={handleCloseModal}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceStudentTable;
