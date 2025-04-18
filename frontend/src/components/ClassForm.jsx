import React, { useState } from 'react';
import axios from 'axios';
import { useLoading } from '../context/LoadingContext';
import './ClassForm.css';

const ClassForm = ({ onSuccess }) => {
  const { showLoader, hideLoader } = useLoading();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    academic_year: '',
    term: ''
  });

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const isValidAcademicYear = (year) => {
    const match = year.match(/^(\d{4})\/(\d{4})$/);
    if (!match) return { valid: false, message: 'Academic year must be in YYYY/YYYY format.' };

    const start = parseInt(match[1], 10);
    const end = parseInt(match[2], 10);

    if (end !== start + 1) {
      return { valid: false, message: 'The second year must follow the first (e.g. 2024/2025).' };
    }

    return { valid: true };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');

    const { valid, message: validationMsg } = isValidAcademicYear(formData.academic_year);
    if (!valid) {
      setError(validationMsg);
      return;
    }

    showLoader();

    try {
      const token = localStorage.getItem('accessToken');
      const response = await axios.post(
        'http://127.0.0.1:8000/api/academics/classes/',
        formData,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.status === 201) {
        setMessage('Class created successfully.');
        setFormData({ name: '', description: '', academic_year: '', term: '' });
        if (onSuccess) onSuccess();
      } else {
        setError('Unexpected response from the server.');
      }
    } catch (err) {
      if (err.response?.data) {
        const detail =
          typeof err.response.data === 'string'
            ? err.response.data
            : err.response.data.detail || JSON.stringify(err.response.data);
        setError(`Failed to create class: ${detail}`);
      } else {
        setError('Failed to create class. Please try again.');
      }
    } finally {
      hideLoader();
    }
  };

  return (
    <div className="class-form-wrapper">
      <div className="class-form-container">
        <h3>Create New Class</h3>
        <form onSubmit={handleSubmit} className="class-form">
          <select
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
          >
            <option value="">Select Class</option>
            <option value="J.S.S.1">J.S.S.1</option>
            <option value="J.S.S.2">J.S.S.2</option>
            <option value="J.S.S.3">J.S.S.3</option>
            <option value="S.S.S.1">S.S.S.1</option>
            <option value="S.S.S.2">S.S.S.2</option>
            <option value="S.S.S.3">S.S.S.3</option>
          </select>

          <textarea
            name="description"
            placeholder="Description"
            value={formData.description}
            onChange={handleChange}
          />

          <input
            type="text"
            name="academic_year"
            placeholder="Academic Year (e.g. 2024/2025)"
            value={formData.academic_year}
            onChange={handleChange}
            required
          />

          <select
            name="term"
            value={formData.term}
            onChange={handleChange}
            required
          >
            <option value="">Select Term</option>
            <option value="First Term">First Term</option>
            <option value="Second Term">Second Term</option>
            <option value="Third Term">Third Term</option>
          </select>

          <button type="submit">Create Class</button>
        </form>

        {message && <p className="form-message success">{message}</p>}
        {error && <p className="form-message error">{error}</p>}
      </div>
    </div>
  );
};

export default ClassForm;
