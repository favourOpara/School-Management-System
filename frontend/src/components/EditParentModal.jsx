// src/components/EditParentModal.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Select from 'react-select';
import './EditUserModal.css';
import { useDialog } from '../contexts/DialogContext';

import API_BASE_URL from '../config';

const EditParentModal = ({ user, onClose, onUpdated }) => {
  const { showAlert } = useDialog();
  const [allStudents, setAllStudents] = useState([]);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    middle_name: '',
    username: '',
    email: '',
    phone_number: '',
    children: [],
    password: '',
    confirm_password: ''
  });

  const token = localStorage.getItem('accessToken');

  useEffect(() => {
    setFormData({
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      middle_name: user.middle_name || '',
      username: user.username || '',
      email: user.email || '',
      phone_number: user.phone_number || '',
      children: user.children?.map(child => child.id) || [],
      password: '',
      confirm_password: ''
    });
  }, [user]);

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/users/list-students/`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setAllStudents(res.data);
      } catch (err) {
        console.error('Failed to fetch students:', err);
      }
    };
    fetchStudents();
  }, [token]);

  const handleChange = (e) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleMultiSelectChange = (selectedOptions, { name }) => {
    setFormData(prev => ({
      ...prev,
      [name]: selectedOptions ? selectedOptions.map(option => option.value) : []
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...formData };

      payload.role = 'parent';
      if (!payload.password) {
        delete payload.password;
        delete payload.confirm_password;
      }

      const res = await axios.put(`${API_BASE_URL}/api/users/${user.id}/`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      showAlert({
        type: 'success',
        message: 'Parent updated successfully.'
      });
      onClose();
      if (onUpdated) onUpdated(res.data);
    } catch (err) {
      console.error('Error updating parent:', err);
      showAlert({
        type: 'error',
        message: 'Failed to update parent.'
      });
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-container">
        <h3>Edit Parent</h3>
        <form onSubmit={handleSubmit} className="edit-user-form">
          <input type="text" name="first_name" value={formData.first_name} onChange={handleChange} placeholder="First Name" required />
          <input type="text" name="middle_name" value={formData.middle_name} onChange={handleChange} placeholder="Middle Name (Optional)" />
          <input type="text" name="last_name" value={formData.last_name} onChange={handleChange} placeholder="Last Name" required />
          <input type="text" name="username" value={formData.username} onChange={handleChange} placeholder="Username" required />
          <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="Email" required />
          <input type="text" name="phone_number" value={formData.phone_number} onChange={handleChange} placeholder="Phone Number" required />

          <Select
            classNamePrefix="react-select"
            isMulti
            name="children"
            value={allStudents.filter(student => formData.children.includes(student.id)).map(student => ({
              value: student.id,
              label: `${student.full_name} (${student.username})`
            }))}
            onChange={handleMultiSelectChange}
            options={allStudents.map(student => ({
              value: student.id,
              label: `${student.full_name} (${student.username})`
            }))}
            placeholder="Select Children"
          />

          <input type="password" name="password" value={formData.password} onChange={handleChange} placeholder="New Password (Optional)" />
          <input type="password" name="confirm_password" value={formData.confirm_password} onChange={handleChange} placeholder="Confirm Password" />

          <div className="button-group">
            <button type="submit" className="edit_user_save-btn">Save Changes</button>
            <button type="button" onClick={onClose} className="edit_user_close-btn">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditParentModal;
