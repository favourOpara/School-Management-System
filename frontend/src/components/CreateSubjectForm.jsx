// src/components/CreateSubjectForm.jsx
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './CreateSubjectForm.css';

const CreateSubjectForm = () => {
  const [formData, setFormData] = useState({
    name: '',
    classroom: '',
    teacher: '',
  });

  const [classrooms, setClassrooms] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [message, setMessage] = useState('');
  const token = localStorage.getItem('accessToken');

  // Fetch classrooms and teachers on mount
  useEffect(() => {
    const fetchClassrooms = async () => {
      try {
        const res = await axios.get('http://127.0.0.1:8000/api/academics/classes/', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setClassrooms(res.data);
      } catch (err) {
        console.error('Error fetching classrooms:', err);
      }
    };

    const fetchTeachers = async () => {
      try {
        const res = await axios.get('http://127.0.0.1:8000/api/users/teachers/', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const teacherList = res.data.filter(user => user.role === 'teacher');
        setTeachers(teacherList);
      } catch (err) {
        console.error('Error fetching teachers:', err);
      }
    };

    fetchClassrooms();
    fetchTeachers();
  }, [token]);

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');

    try {
      await axios.post('http://127.0.0.1:8000/api/academics/subjects/', formData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMessage('Subject created successfully.');
      setFormData({ name: '', classroom: '', teacher: '' });
    } catch (err) {
      console.error('Error creating subject:', err);
      setMessage('Failed to create subject. Check fields and try again.');
    }
  };

  return (
    <div className="create-subject-wrapper">
      <div className="create-subject-container">
        <h3>Create Subject</h3>
        <form onSubmit={handleSubmit} className="create-subject-form">
          <input
            type="text"
            name="name"
            placeholder="Subject Name"
            value={formData.name}
            onChange={handleChange}
            required
          />

          <select name="classroom" value={formData.classroom} onChange={handleChange} required>
            <option value="">Select Class</option>
            {classrooms.map(cls => (
              <option key={`class-${cls.id}`} value={cls.id}>
                {cls.name}
              </option>
            ))}
          </select>

          <select name="teacher" value={formData.teacher} onChange={handleChange} required>
            <option value="">Select Teacher</option>
            {teachers.map(t => (
              <option key={`teacher-${t.id}`} value={t.id}>
                {t.first_name} {t.last_name} ({t.username})
              </option>
            ))}
          </select>

          <button type="submit">Create Subject</button>
        </form>

        {message && (
          <p className={`form-message ${message.includes('successfully') ? 'success' : 'error'}`}>
            {message}
          </p>
        )}
      </div>
    </div>
  );
};

export default CreateSubjectForm;
