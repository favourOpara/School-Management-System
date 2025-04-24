import React, { useState, useEffect } from 'react';
import './SubjectModal.css';
import axios from 'axios';

const SubjectModal = ({ subjects, onClose, onUpdate, onDelete }) => {
  const [editingId, setEditingId] = useState(null);
  const [editedData, setEditedData] = useState({});
  const [teachers, setTeachers] = useState([]);
  const token = localStorage.getItem('accessToken');

  useEffect(() => {
    const fetchTeachers = async () => {
      try {
        const res = await axios.get('http://127.0.0.1:8000/api/users/teachers/', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setTeachers(res.data);
      } catch (err) {
        console.error('Failed to load teachers:', err);
      }
    };
    fetchTeachers();
  }, [token]);

  const handleEditClick = (subject) => {
    setEditingId(subject.id);
    setEditedData({
      name: subject.name || '',
      teacher: subject.teacher || '',
    });
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setEditedData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = () => {
    if (editedData.name && editedData.teacher) {
      onUpdate(editingId, editedData);
      setEditingId(null);
    }
  };

  const getTeacherName = (teacherId) => {
    const teacher = teachers.find(t => t.id === teacherId);
    return teacher ? `${teacher.first_name} ${teacher.last_name}` : 'N/A';
  };

  return (
    <div className="subject-modal-overlay">
      <div className="subject-modal">
      <button className="close-modal-btn" onClick={onClose}>×</button>  
        <h3>Subjects in Class</h3>
        <ul>
          {Array.isArray(subjects) && subjects.length > 0 ? (
            subjects.map(subject => (
              <li key={subject.id}>
                {editingId === subject.id ? (
                  <div className="edit-form">
                    <input
                      type="text"
                      name="name"
                      value={editedData.name}
                      onChange={handleChange}
                      placeholder="Subject name"
                    />
                    <select name="teacher" value={editedData.teacher} onChange={handleChange}>
                      <option value="">Select Teacher</option>
                      {teachers.map(t => (
                        <option key={t.id} value={t.id}>
                          {t.first_name} {t.last_name}
                        </option>
                      ))}
                    </select>
                    <div className="subject-modal-actions">
                      <button className="save-btn" onClick={handleSave}>Save</button>
                      <button className="cancel-btn" onClick={() => setEditingId(null)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="subject-info">
                    <strong>{subject.name || 'Unnamed Subject'}</strong> — {getTeacherName(subject.teacher)}
                    <div className="subject-modal-actions">
                      <button onClick={() => handleEditClick(subject)}>Edit</button>
                      <button onClick={() => onDelete(subject.id)}>Delete</button>
                    </div>
                  </div>
                )}
              </li>
            ))
          ) : (
            <li style={{ textAlign: 'center', padding: '1rem', color: '#777' }}>
              No subjects found or something went wrong.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
};

export default SubjectModal;
