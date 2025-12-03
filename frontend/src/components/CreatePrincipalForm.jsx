import React, { useState } from 'react';
import axios from 'axios';
import API_BASE_URL from '../config';

import './CreateTeacherForm.css';

const CreatePrincipalForm = ({ onSuccess }) => {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    first_name: '',
    last_name: '',
    email: '',
    phone_number: ''
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
      // Use the generic user creation endpoint with role='principal'
      await axios.post(`${API_BASE_URL}/api/users/create-user/`, {
        ...formData,
        role: 'principal'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setMessage('Principal created successfully.');
      setFormData({
        username: '',
        password: '',
        first_name: '',
        last_name: '',
        email: '',
        phone_number: ''
      });

      if (onSuccess) onSuccess();
    } catch (err) {
      console.error('Error creating principal:', err);
      if (err.response && err.response.data) {
        const errorDetails = JSON.stringify(err.response.data, null, 2);
        setMessage(`Failed to create principal: ${errorDetails}`);
      } else {
        setMessage('Failed to create principal. Please try again.');
      }
    }
  };

  return (
    <div className="create-teacher-wrapper">
      <div className="create-teacher-container">
        <h3>Create Principal</h3>
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
          <input
            type="email"
            name="email"
            placeholder="Email"
            value={formData.email}
            onChange={handleChange}
            required
          />
          <input
            type="tel"
            name="phone_number"
            placeholder="Phone Number (optional)"
            value={formData.phone_number}
            onChange={handleChange}
          />

          <button type="submit">Create Principal</button>
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

export default CreatePrincipalForm;
