// src/components/CreateStudentForm.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './CreateStudentForm.css';

const CreateStudentForm = ({ onSuccess }) => {
  const [formData, setFormData] = useState({
    first_name: '',
    middle_name: '',
    last_name: '',
    username: '',
    password: '',
    confirm_password: '',
    gender: '',
    classroom: '',
    academic_year: '',
    date_of_birth: ''
  });

  const [classrooms, setClassrooms] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [message, setMessage] = useState('');
  const token = localStorage.getItem('accessToken');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [classRes, sessionRes] = await Promise.all([
          axios.get('http://127.0.0.1:8000/api/academics/classes/', {
            headers: { Authorization: `Bearer ${token}` }
          }),
          axios.get('http://127.0.0.1:8000/api/academics/sessions/', {
            headers: { Authorization: `Bearer ${token}` }
          })
        ]);

        setClassrooms(classRes.data);

        const years = sessionRes.data.map(session => session.academic_year);
        const uniqueYears = [...new Set(years)];
        setAcademicYears(uniqueYears);
      } catch (err) {
        console.error('Error fetching classes or sessions:', err);
      }
    };

    fetchData();
  }, [token]);

  const handleChange = e => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setMessage('');

    if (formData.password !== formData.confirm_password) {
      setMessage('Passwords do not match.');
      return;
    }

    const payload = {
      ...formData,
      role: 'student'
    };

    try {
      await axios.post(
        'http://127.0.0.1:8000/api/users/create-user/',
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setMessage('Student created successfully.');
      setFormData({
        first_name: '',
        middle_name: '',
        last_name: '',
        username: '',
        password: '',
        confirm_password: '',
        gender: '',
        classroom: '',
        academic_year: '',
        date_of_birth: ''
      });

      if (onSuccess) onSuccess();
    } catch (err) {
      console.error('Error creating student:', err);
      if (err.response?.data) {
        const errors = Object.entries(err.response.data)
          .map(([field, msgs]) => `${field}: ${Array.isArray(msgs) ? msgs.join(', ') : msgs}`)
          .join('\n');
        setMessage(errors || 'Failed to create student. Please try again.');
      } else {
        setMessage('Failed to create student. Please try again.');
      }
    }
  };

  return (
    <div className="create-student-wrapper">
      <div className="create-student-container">
        <h3>Create Student</h3>
        <form onSubmit={handleSubmit} className="create-student-form">
          <input type="text" name="first_name" placeholder="First Name" value={formData.first_name} onChange={handleChange} required />
          <input type="text" name="middle_name" placeholder="Middle Name (optional)" value={formData.middle_name} onChange={handleChange} />
          <input type="text" name="last_name" placeholder="Last Name" value={formData.last_name} onChange={handleChange} required />
          <input type="text" name="username" placeholder="Username" value={formData.username} onChange={handleChange} required />
          <input type="password" name="password" placeholder="Password" value={formData.password} onChange={handleChange} required />
          <input type="password" name="confirm_password" placeholder="Confirm Password" value={formData.confirm_password} onChange={handleChange} required />

          <select name="gender" value={formData.gender} onChange={handleChange} required>
            <option value="">Select Gender</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>

          <select name="classroom" value={formData.classroom} onChange={handleChange} required>
            <option value="">Select Class</option>
            {classrooms.map(cls => (
              <option key={cls.id} value={cls.id}>{cls.name}</option>
            ))}
          </select>

          <select name="academic_year" value={formData.academic_year} onChange={handleChange} required>
            <option value="">Select Academic Year</option>
            {academicYears.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>

          <input type="date" name="date_of_birth" value={formData.date_of_birth} onChange={handleChange} required />

          <button type="submit">Create Student</button>
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

export default CreateStudentForm;
