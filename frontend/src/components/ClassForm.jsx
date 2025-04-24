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
  const [classInput, setClassInput] = useState('');
  const [stagedClassNames, setStagedClassNames] = useState([]);
  const [sessionData, setSessionData] = useState({
    classrooms: [],
    academic_year: '',
    term: ''
  });

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

  const handleClassNameInput = (e) => setClassInput(e.target.value);

  const handleAddStagedClass = (e) => {
    e.preventDefault();
    if (classInput.trim() && !stagedClassNames.includes(classInput.trim())) {
      setStagedClassNames(prev => [...prev, classInput.trim()]);
      setClassInput('');
      setMessage('');
    }
  };

  const handleDeleteStagedClass = (name) => {
    setStagedClassNames(prev => prev.filter(n => n !== name));
  };

  const handleSubmitClass = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');
    showLoader();

    try {
      const promises = stagedClassNames.map(name =>
        axios.post('http://127.0.0.1:8000/api/academics/classes/', { name }, {
          headers: { Authorization: `Bearer ${token}` }
        })
      );
      await Promise.all(promises);
      setMessage('Class names added successfully.');
      setStagedClassNames([]);
      await fetchClasses();
    } catch (err) {
      if (err.response?.data) {
        const detail = typeof err.response.data === 'string'
          ? err.response.data
          : JSON.stringify(err.response.data);
        setError(`Failed to create class names: ${detail}`);
      } else {
        setError('Failed to create class names. Please try again.');
      }
    } finally {
      hideLoader();
    }
  };

  const handleSessionChange = (e) => {
    const { name, value, options } = e.target;
    if (name === 'classrooms') {
      const selected = Array.from(options).filter(o => o.selected).map(o => o.value);
      setSessionData(prev => ({ ...prev, classrooms: selected }));
    } else {
      setSessionData(prev => ({ ...prev, [name]: value }));
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
      const payloads = sessionData.classrooms.map(classId => ({
        classroom_id: classId,
        academic_year: sessionData.academic_year,
        term: sessionData.term
      }));

      const responses = await Promise.all(payloads.map(payload =>
        axios.post('http://127.0.0.1:8000/api/academics/sessions/', payload, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ));

      if (responses.every(res => res.status === 201)) {
        setMessage('Class sessions added successfully.');
        setSessionData({ classrooms: [], academic_year: '', term: '' });
      }
    } catch (err) {
      if (err.response?.data) {
        const detail = typeof err.response.data === 'string'
          ? err.response.data
          : JSON.stringify(err.response.data);
        setError(`Failed to create class sessions: ${detail}`);
      } else {
        setError('Failed to create class sessions. Please try again.');
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
              <div style={{ display: 'flex', gap: '10px' }}>
                <input
                  type="text"
                  name="classInput"
                  placeholder="Enter class name"
                  value={classInput}
                  onChange={handleClassNameInput}
                />
                <button onClick={handleAddStagedClass}>+</button>
              </div>

              {stagedClassNames.length > 0 && (
                <ul style={{ marginTop: '1rem' }}>
                  {stagedClassNames.map((name, index) => (
                    <li key={index} className="staged-class-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      {name}
                      <span style={{ cursor: 'pointer', color: 'red' }} onClick={() => handleDeleteStagedClass(name)}>✖</span>
                    </li>
                  ))}
                </ul>
              )}

              <button type="submit" disabled={stagedClassNames.length === 0}>Add Class(es)</button>
            </form>
          </>
        ) : (
          <>
            <h3>Add Class Session</h3>
            <form onSubmit={handleSubmitSession} className="class-form">
              <select name="classrooms" multiple value={sessionData.classrooms} onChange={handleSessionChange} required>
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

              <button type="submit">Add Session(s)</button>
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
