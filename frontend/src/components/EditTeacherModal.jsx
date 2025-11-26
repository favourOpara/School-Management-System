// src/components/EditTeacherModal.jsx
import React, { useState } from 'react';
import axios from 'axios';
import './EditUserModal.css';
import { useDialog } from '../contexts/DialogContext';

import API_BASE_URL from '../config';

const EditTeacherModal = ({ user, onClose, onUpdated }) => {
  const { showAlert } = useDialog();
  const [formData, setFormData] = useState({
    first_name: user.first_name || '',
    last_name: user.last_name || '',
    username: user.username || '',
    gender: user.gender || '',
    phone_number: user.phone_number || '',
    email: user.email || '',
    role: 'teacher',
    password: ''
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const token = localStorage.getItem('accessToken');

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const dataToSend = { ...formData };
      if (!dataToSend.password) {
        delete dataToSend.password;
      }

      const response = await axios.put(
        `${API_BASE_URL}/api/users/${user.id}/`,
        dataToSend,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      onUpdated(response.data);
      showAlert({
        type: 'success',
        message: 'Teacher updated successfully!'
      });
      onClose();
    } catch (err) {
      console.error('Error updating teacher:', err);
      setError(err.response?.data?.detail || 'Failed to update teacher. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Edit Teacher</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="edit-form">
          {error && <div className="error-message">{error}</div>}

          <div className="form-row">
            <div className="form-group">
              <label>First Name *</label>
              <input
                type="text"
                name="first_name"
                value={formData.first_name}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label>Last Name *</label>
              <input
                type="text"
                name="last_name"
                value={formData.last_name}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Username *</label>
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label>Gender</label>
              <select
                name="gender"
                value={formData.gender}
                onChange={handleChange}
              >
                <option value="">Select Gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Phone Number</label>
              <input
                type="tel"
                name="phone_number"
                value={formData.phone_number}
                onChange={handleChange}
                placeholder="Optional"
              />
            </div>

            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="Optional"
              />
            </div>
          </div>

          <div className="form-group">
            <label>New Password (leave blank to keep current)</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Enter new password or leave blank"
            />
          </div>

          <div className="form-actions">
            <button type="button" onClick={onClose} className="cancel-button">
              Cancel
            </button>
            <button type="submit" className="save-button" disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditTeacherModal;