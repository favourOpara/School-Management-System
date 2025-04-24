import React, { useState } from 'react';
import axios from 'axios';
import './CreateTeacherForm.css';

const CreateTeacherForm = ({ onSuccess }) => {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    first_name: '',
    last_name: ''
  });

  const [message, setMessage] = useState('');
  const token = localStorage.getItem('accessToken');

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');

    try {
      await axios.post('http://127.0.0.1:8000/api/users/teacher-signup/', formData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setMessage('Teacher created successfully.');
      setFormData({
        username: '',
        password: '',
        first_name: '',
        last_name: ''
      });

      if (onSuccess) onSuccess();
    } catch (err) {
      console.error('Error creating teacher:', err);
      if (err.response && err.response.data) {
        const errorDetails = JSON.stringify(err.response.data, null, 2);
        setMessage(`Failed to create teacher: ${errorDetails}`);
      } else {
        setMessage('Failed to create teacher. Please try again.');
      }
    }
  };

  return (
    <div className="create-teacher-wrapper">
      <div className="create-teacher-container">
        <h3>Create Teacher</h3>
        <form onSubmit={handleSubmit} className="create-teacher-form">
          <input
            type="text"
            name="first_name"
            placeholder="First Name"
            value={formData.first_name}
            onChange={handleChange}
            required
          />
          <input
            type="text"
            name="last_name"
            placeholder="Last Name"
            value={formData.last_name}
            onChange={handleChange}
            required
          />
          <input
            type="text"
            name="username"
            placeholder="Username"
            value={formData.username}
            onChange={handleChange}
            required
          />
          <input
            type="password"
            name="password"
            placeholder="Password"
            value={formData.password}
            onChange={handleChange}
            required
          />

          <button type="submit">Create Teacher</button>
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

export default CreateTeacherForm;
