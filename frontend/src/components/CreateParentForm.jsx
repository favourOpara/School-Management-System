import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Select from 'react-select';
import API_BASE_URL from '../config';
import { useSchool } from '../contexts/SchoolContext';
import ImportParentsModal from './ImportParentsModal';

import './CreateParentForm.css';

const CreateParentForm = () => {
  const { buildApiUrl, featureLimits } = useSchool();
  const [showImportModal, setShowImportModal] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    first_name: '',
    last_name: '',
    email: '',
    phone_number: '',
    children: [],
  });

  const [students, setStudents] = useState([]);
  const [message, setMessage] = useState('');
  const token = localStorage.getItem('accessToken');

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const res = await axios.get(buildApiUrl('/users/list-students/'), {
          headers: { Authorization: `Bearer ${token}` },
        });

        const formatted = res.data.map(student => ({
          value: student.id,
          label: `${student.full_name} (${student.username})`,
        }));

        setStudents(formatted);
      } catch (err) {
        console.error('Error fetching students:', err);
        setMessage('Failed to load student list.');
      }
    };

    fetchStudents();
  }, [token]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleChildrenChange = (selectedOptions) => {
    setFormData(prev => ({
      ...prev,
      children: selectedOptions.map(option => option.value),
    }));
  };

  const validatePassword = (password) => {
    if (password.length < 8) return 'Password must be at least 8 characters.';
    if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter.';
    if (!/[a-z]/.test(password)) return 'Password must contain at least one lowercase letter.';
    if (!/[0-9]/.test(password)) return 'Password must contain at least one number.';
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');

    const pwError = validatePassword(formData.password);
    if (pwError) { setMessage(pwError); return; }

    try {
      const res = await axios.post(buildApiUrl('/users/parent-signup/'), formData, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setMessage(res.data.message || 'Parent account created successfully.');
      setFormData({
        username: '',
        password: '',
        first_name: '',
        last_name: '',
        email: '',
        phone_number: '',
        children: [],
      });
    } catch (err) {
      if (err.response?.data?.error) {
        setMessage(err.response.data.error);
      } else if (err.response?.data) {
        const errorDetails = Object.values(err.response.data).flat().join(' ');
        setMessage(`Error: ${errorDetails}`);
      } else {
        setMessage('An error occurred. Please try again.');
      }
    }
  };

  return (
    <div className="create-parent-wrapper">
      <div className="create-parent-container">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h2 style={{ margin: 0 }}>Create Parent Account</h2>
          <button type="button" className="import-students-btn" onClick={() => setShowImportModal(true)}>
            Import Parents
          </button>
        </div>
        {featureLimits?.max_parents > 0 && featureLimits.current_parents / featureLimits.max_parents >= 0.8 && (
          <div style={{
            padding: '0.6rem 0.9rem', borderRadius: '8px', marginBottom: '1rem',
            fontSize: '0.85rem',
            background: featureLimits.current_parents >= featureLimits.max_parents ? '#fee2e2' : '#fef3c7',
            color: featureLimits.current_parents >= featureLimits.max_parents ? '#991b1b' : '#92400e',
            border: `1px solid ${featureLimits.current_parents >= featureLimits.max_parents ? '#fca5a5' : '#fde68a'}`,
          }}>
            {featureLimits.current_parents >= featureLimits.max_parents
              ? `Parent limit reached (${featureLimits.current_parents}/${featureLimits.max_parents}). Upgrade your plan to add more.`
              : `Approaching parent limit: ${featureLimits.current_parents} of ${featureLimits.max_parents} used.`}
          </div>
        )}
        <form className="create-parent-form" onSubmit={handleSubmit}>
          <input type="text" name="username" placeholder="Username" value={formData.username} onChange={handleChange} required />
          <input type="password" name="password" placeholder="Password" value={formData.password} onChange={handleChange} required />
          <input type="text" name="first_name" placeholder="First Name" value={formData.first_name} onChange={handleChange} required />
          <input type="text" name="last_name" placeholder="Last Name" value={formData.last_name} onChange={handleChange} required />
          <input type="email" name="email" placeholder="Email" value={formData.email} onChange={handleChange} required />
          <input type="tel" name="phone_number" placeholder="Phone Number" value={formData.phone_number} onChange={handleChange} />

          <label className="field-label">Select Children</label>
          <Select
            isMulti
            name="children"
            options={students}
            onChange={handleChildrenChange}
            classNamePrefix="react-select"
            placeholder="Search and select children..."
            styles={{
              control: (base, state) => ({
                ...base,
                borderColor: state.isFocused ? '#0d47a1' : '#ccc',
                boxShadow: 'none',
                backgroundColor: '#fafafa',
                
              }),
              option: (base, { isFocused, isSelected }) => ({
                ...base,
                backgroundColor: isSelected ? '#0d47a1' : isFocused ? '#e3f2fd' : '#fff',
                color: isSelected ? '#fff' : '#333',
              }),
            }}
          />

          <button type="submit">Create Parent</button>
        </form>

        {message && <p className="form-message">{message}</p>}
      </div>

      {showImportModal && (
        <ImportParentsModal
          onClose={() => setShowImportModal(false)}
          onSuccess={() => setShowImportModal(false)}
        />
      )}
    </div>
  );
};

export default CreateParentForm;
