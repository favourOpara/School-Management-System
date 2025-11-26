import React, { useEffect, useState } from 'react';
import axios from 'axios';
import API_BASE_URL from '../config';

import './attendancesubjectmodal.css'; // Make sure this file is imported

const AttendanceSubjectModal = ({ classInfo, academicYear, term, onClose, onSubjectSelect }) => {
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);

  const token = localStorage.getItem('accessToken');

  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/academics/subjects/`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const filtered = res.data.filter(
          sub =>
            sub.class_session.classroom.id === classInfo.id &&
            sub.class_session.academic_year === academicYear &&
            sub.class_session.term === term
        );

        setSubjects(filtered);
      } catch (err) {
        console.error('Error fetching subjects:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSubjects();
  }, [classInfo, academicYear, term, token]);

  return (
    <div className="attendance-modal-overlay">
      <div className="attendance-modal">
        <h3>
          Subjects for {classInfo.name} ({academicYear} - {term})
        </h3>

        {loading ? (
          <p>Loading subjects...</p>
        ) : subjects.length === 0 ? (
          <p>No subjects assigned to this class.</p>
        ) : (
          <ul>
            {subjects.map(subject => (
              <li
                key={subject.id}
                onClick={() => {
                  onSubjectSelect(subject);
                  onClose();
                }}
              >
                <div className="attendance-subject-info">{subject.name}</div>
              </li>
            ))}
          </ul>
        )}

        <button className="close-attendance-modal-btn" onClick={onClose}>
          ×
        </button>
      </div>
    </div>
  );
};

export default AttendanceSubjectModal;
