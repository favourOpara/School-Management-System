import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Select from 'react-select';
import './CreateParentForm.css';

const CreateParentForm = () => {
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
        const res = await axios.get('http://127.0.0.1:8000/api/users/list-students/', {
          headers: { Authorization: `Bearer ${token}` },
        });

        const formatted = res.data.map(student => ({
          value: student.id,
          label: `${student.full_name} (${student.username})`,
        }));

        setStudents(formatted);
      } catch (err) {
        console.error('Error fetching students:', err);
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');

    try {
      const res = await axios.post('http://127.0.0.1:8000/api/users/parent-signup/', formData, {
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
      if (err.response?.data) {
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
        <h2>Create Parent Account</h2>
        <form className="create-parent-form" onSubmit={handleSubmit}>
          <input type="text" name="username" placeholder="Username" value={formData.username} onChange={handleChange} required />
          <input type="password" name="password" placeholder="Password" value={formData.password} onChange={handleChange} required />
          <input type="text" name="first_name" placeholder="First Name" value={formData.first_name} onChange={handleChange} required />
          <input type="text" name="last_name" placeholder="Last Name" value={formData.last_name} onChange={handleChange} required />
          <input type="email" name="email" placeholder="Email (for contact)" value={formData.email} onChange={handleChange} />
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
    </div>
  );
};

export default CreateParentForm;
