import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useLoading } from '../context/LoadingContext';
import './ClassForm.css';

const ClassManagementForm = () => {
  const { showLoader, hideLoader } = useLoading();
  const token = localStorage.getItem('accessToken');

  const [activeForm, setActiveForm] = useState('class');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [classData, setClassData] = useState({ name: '', description: '' });
  const [sessionData, setSessionData] = useState({ classroom: '', academic_year: '', term: '' });
  const [classes, setClasses] = useState([]);

  const fetchClasses = async () => {
    try {
      const res = await axios.get('http://127.0.0.1:8000/api/academics/classes/', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setClasses(res.data);
    } catch (err) {
      console.error('Error fetching classes:', err);
    }
  };

  useEffect(() => {
    fetchClasses();
  }, [token]);

  const isValidAcademicYear = (year) => {
    const match = year.match(/^(\d{4})\/(\d{4})$/);
    if (!match) return { valid: false, message: 'Academic year must be in YYYY/YYYY format.' };
    const start = parseInt(match[1], 10);
    const end = parseInt(match[2], 10);
    if (end !== start + 1) return { valid: false, message: 'The second year must follow the first.' };
    return { valid: true };
  };

  const handleClassChange = (e) => {
    setClassData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSessionChange = (e) => {
    setSessionData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmitClass = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');
    showLoader();

    try {
      const res = await axios.post('http://127.0.0.1:8000/api/academics/classes/', classData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.status === 201) {
        setMessage('Class name added successfully.');
        setClassData({ name: '', description: '' });
        await fetchClasses(); // Refresh dropdown list for sessions
      }
    } catch (err) {
      if (err.response?.data) {
        const detail = typeof err.response.data === 'string'
          ? err.response.data
          : JSON.stringify(err.response.data);
        setError(`Failed to create class name: ${detail}`);
      } else {
        setError('Failed to create class name. Please try again.');
      }
    } finally {
      hideLoader();
    }
  };

  const handleSubmitSession = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');

    const { valid, message: validationMsg } = isValidAcademicYear(sessionData.academic_year);
    if (!valid) {
      setError(validationMsg);
      return;
    }

    showLoader();

    try {
      const res = await axios.post('http://127.0.0.1:8000/api/academics/sessions/', {
        classroom_id: sessionData.classroom,
        academic_year: sessionData.academic_year,
        term: sessionData.term,
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });      

      if (res.status === 201) {
        setMessage('Class session added successfully.');
        setSessionData({ classroom: '', academic_year: '', term: '' });
      }
    } catch (err) {
      if (err.response?.data) {
        const detail = typeof err.response.data === 'string'
          ? err.response.data
          : JSON.stringify(err.response.data);
        setError(`Failed to create class session: ${detail}`);
      } else {
        setError('Failed to create class session. Please try again.');
      }
    } finally {
      hideLoader();
    }
  };

  return (
    <div className="class-form-wrapper">
      <div className="class-form-container">
        <div className="toggle-buttons">
          <button className={activeForm === 'class' ? 'active' : ''} onClick={() => setActiveForm('class')}>Add Class Name</button>
          <button className={activeForm === 'session' ? 'active' : ''} onClick={() => setActiveForm('session')}>Add Class Session</button>
        </div>

        {activeForm === 'class' ? (
          <>
            <h3>Add Class Name</h3>
            <form onSubmit={handleSubmitClass} className="class-form">
              <input
                type="text"
                name="name"
                placeholder="Class Name (e.g. J.S.S.1)"
                value={classData.name}
                onChange={handleClassChange}
                required
              />
              <textarea
                name="description"
                placeholder="Description"
                value={classData.description}
                onChange={handleClassChange}
              />
              <button type="submit">Add Class</button>
            </form>
          </>
        ) : (
          <>
            <h3>Add Class Session</h3>
            <form onSubmit={handleSubmitSession} className="class-form">
              <select name="classroom" value={sessionData.classroom} onChange={handleSessionChange} required>
                <option value="">Select Class</option>
                {classes.map(cls => (
                  <option key={cls.id} value={cls.id}>{cls.name}</option>
                ))}
              </select>

              <input
                type="text"
                name="academic_year"
                placeholder="Academic Year (e.g. 2024/2025)"
                value={sessionData.academic_year}
                onChange={handleSessionChange}
                required
              />

              <select name="term" value={sessionData.term} onChange={handleSessionChange} required>
                <option value="">Select Term</option>
                <option value="First Term">First Term</option>
                <option value="Second Term">Second Term</option>
                <option value="Third Term">Third Term</option>
              </select>

              <button type="submit">Add Session</button>
            </form>
          </>
        )}

        {message && <p className="form-message success">{message}</p>}
        {error && <p className="form-message error">{error}</p>}
      </div>
    </div>
  );
};

export default ClassManagementForm;
