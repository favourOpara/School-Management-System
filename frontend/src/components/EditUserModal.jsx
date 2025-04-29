import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Select from 'react-select';
import './EditUserModal.css';

const EditUserModal = ({ user, onClose, onUpdated }) => {
  const [classrooms, setClassrooms] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    middle_name: '',
    gender: '',
    username: '',
    password: '',
    confirm_password: '',
    classroom: '',
    academic_year: '',
    term: '',
    date_of_birth: '',
    department: '',
  });

  const token = localStorage.getItem('accessToken');

  useEffect(() => {
    setFormData({
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      middle_name: user.middle_name || '',
      gender: user.gender || '',
      username: user.username || '',
      classroom: user.classroom || '',
      academic_year: user.academic_year || '',
      term: user.term || '',
      date_of_birth: user.date_of_birth || '',
      department: user.department || '',
      password: '',
      confirm_password: '',
    });
  }, [user]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const classRes = await axios.get('http://127.0.0.1:8000/api/academics/classes/', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setClassrooms(classRes.data);

        const sessionRes = await axios.get('http://127.0.0.1:8000/api/academics/sessions/', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const years = [...new Set(sessionRes.data.map(s => s.academic_year))];
        setAcademicYears(years);
      } catch (err) {
        console.error('Error fetching data:', err);
      }
    };

    fetchData();
  }, [token]);

  const handleChange = (e) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSelectChange = (selectedOption, { name }) => {
    setFormData(prev => ({
      ...prev,
      [name]: selectedOption ? selectedOption.value : ''
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...formData };

      payload.role = 'student';

      if (payload.classroom === '') {
        payload.classroom = null;
      }

      if (!payload.password) {
        delete payload.password;
        delete payload.confirm_password;
      }

      if (!payload.date_of_birth) {
        delete payload.date_of_birth;
      }

      if (!payload.department) {
        delete payload.department;
      }

      const res = await axios.put(`http://127.0.0.1:8000/api/users/${user.id}/`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      alert('User updated successfully.');
      onClose();
      if (onUpdated) onUpdated(res.data);
    } catch (err) {
      console.error('Error updating user:', err);
      alert('Failed to update user.');
    }
  };

  const selectedClassroomName = classrooms.find(c => c.id === formData.classroom)?.name || '';

  return (
    <div className="modal-overlay">
      <div className="modal-container">
        <h3>Edit Student</h3>
        <form onSubmit={handleSubmit} className="edit-user-form">
          <input type="text" name="first_name" value={formData.first_name} onChange={handleChange} placeholder="First Name" required />
          <input type="text" name="middle_name" value={formData.middle_name} onChange={handleChange} placeholder="Middle Name (Optional)" />
          <input type="text" name="last_name" value={formData.last_name} onChange={handleChange} placeholder="Last Name" required />
          <input type="text" name="username" value={formData.username} onChange={handleChange} placeholder="Username" required />

          {/* Gender Select */}
          <Select
            classNamePrefix="react-select"
            name="gender"
            value={formData.gender ? { value: formData.gender, label: formData.gender } : null}
            onChange={handleSelectChange}
            options={[
              { value: 'Male', label: 'Male' },
              { value: 'Female', label: 'Female' }
            ]}
            placeholder="Select Gender"
            isClearable
          />

          {/* Classroom Select */}
          <Select
            classNamePrefix="react-select"
            name="classroom"
            value={formData.classroom ? { value: formData.classroom, label: classrooms.find(c => c.id === formData.classroom)?.name || 'Class' } : null}
            onChange={handleSelectChange}
            options={classrooms.map(c => ({ value: c.id, label: c.name }))}
            placeholder="Select Class"
            isClearable
          />

          {/* Department Select */}
          {selectedClassroomName.startsWith('S.S.S.') && (
            <Select
              classNamePrefix="react-select"
              name="department"
              value={formData.department ? { value: formData.department, label: formData.department } : null}
              onChange={handleSelectChange}
              options={[
                { value: 'Science', label: 'Science' },
                { value: 'Arts', label: 'Arts' },
                { value: 'Commercial', label: 'Commercial' }
              ]}
              placeholder="Select Department"
              isClearable
            />
          )}

          {/* Academic Year Select */}
          <Select
            classNamePrefix="react-select"
            name="academic_year"
            value={formData.academic_year ? { value: formData.academic_year, label: formData.academic_year } : null}
            onChange={handleSelectChange}
            options={academicYears.map(year => ({ value: year, label: year }))}
            placeholder="Select Academic Year"
            isClearable
          />

          {/* Term Select */}
          <Select
            classNamePrefix="react-select"
            name="term"
            value={formData.term ? { value: formData.term, label: formData.term } : null}
            onChange={handleSelectChange}
            options={[
              { value: 'First Term', label: 'First Term' },
              { value: 'Second Term', label: 'Second Term' },
              { value: 'Third Term', label: 'Third Term' }
            ]}
            placeholder="Select Term"
            isClearable
          />

          <input type="date" name="date_of_birth" value={formData.date_of_birth} onChange={handleChange} placeholder="Date of Birth" />

          {/* Password Fields */}
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

export default EditUserModal;
