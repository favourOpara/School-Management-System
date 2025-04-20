// src/components/ViewClasses.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './ViewClasses.css';

const ViewClasses = () => {
  const token = localStorage.getItem('accessToken');
  const [activeView, setActiveView] = useState('class'); // class | session
  const [permanentClasses, setPermanentClasses] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [filters, setFilters] = useState({ name: '', term: '', academic_year: '', department: '' });
  const [academicYears, setAcademicYears] = useState([]);
  const [showDepartment, setShowDepartment] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [classRes, sessionRes] = await Promise.all([
          axios.get('http://127.0.0.1:8000/api/academics/classes/', {
            headers: { Authorization: `Bearer ${token}` },
          }),
          axios.get('http://127.0.0.1:8000/api/academics/sessions/', {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);
        setPermanentClasses(classRes.data);
        setSessions(sessionRes.data);
      } catch (err) {
        console.error('Error loading data:', err);
        setError('Failed to load class data.');
      }
    };

    fetchData();
  }, [token]);

  const classOptions = [...new Set(permanentClasses.map(cls => cls.name))];

  const handleChange = (e) => {
    const { name, value } = e.target;
    const updated = { ...filters, [name]: value };
    setFilters(updated);
    setMessage('');
    setError('');

    if (name === 'name') {
      const showDept = ['S.S.S.1', 'S.S.S.2', 'S.S.S.3'].includes(value);
      setShowDepartment(showDept);
      setFilters(prev => ({ ...prev, department: '', academic_year: '', name: value }));
    }

    if ((name === 'term' || name === 'name') && updated.name && updated.term) {
      const years = sessions
        .filter(sess => sess.classroom?.name === updated.name && sess.term === updated.term)
        .map(sess => sess.academic_year);
      setAcademicYears([...new Set(years)]);
    }
  };

  const handleFilterSession = () => {
    setMessage('');
    setError('');
    const matches = sessions.filter(sess =>
      sess.classroom?.name === filters.name &&
      sess.term === filters.term &&
      (!filters.academic_year || sess.academic_year === filters.academic_year) &&
      (!filters.department || sess.department === filters.department)
    );

    if (matches.length > 0) {
      setMessage(`${matches.length} session${matches.length > 1 ? 's' : ''} found.`);
    } else {
      setError('No matching class session found.');
    }
  };

  const handleSessionDelete = async () => {
    setMessage('');
    setError('');
    const match = sessions.find(sess =>
      sess.classroom?.name === filters.name &&
      sess.term === filters.term &&
      sess.academic_year === filters.academic_year
    );

    if (!match) return setError('No matching session to delete.');
    if (!window.confirm(`Delete ${match.classroom.name} (${match.term}, ${match.academic_year})?`)) return;

    try {
      await axios.delete(`http://127.0.0.1:8000/api/academics/sessions/${match.id}/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSessions(prev => prev.filter(sess => sess.id !== match.id));
      setMessage('Class session deleted successfully.');
    } catch (err) {
      setError('Failed to delete class session. It may be linked to other records.');
    }
  };

  const handlePermanentDelete = async () => {
    setMessage('');
    setError('');
    const match = permanentClasses.find(cls => cls.name === filters.name);
    if (!match) return setError('No matching permanent class to delete.');
    if (!window.confirm(`Delete ${match.name}? All sessions will be removed.`)) return;

    try {
      await axios.delete(`http://127.0.0.1:8000/api/academics/classes/${match.id}/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setPermanentClasses(prev => prev.filter(cls => cls.id !== match.id));
      setSessions(prev => prev.filter(sess => sess.classroom?.id !== match.id));
      setMessage('Class name deleted successfully.');
    } catch (err) {
      setError('Failed to delete class name. Ensure it has no active records.');
    }
  };

  return (
    <div className="class-form-wrapper">
      <div className="class-form-container">
        <div className="toggle-buttons">
          <button className={activeView === 'class' ? 'active' : ''} onClick={() => setActiveView('class')}>View/Delete Class Name</button>
          <button className={activeView === 'session' ? 'active' : ''} onClick={() => setActiveView('session')}>View/Delete Class Session</button>
        </div>

        {activeView === 'class' ? (
          <>
            <h3>Delete Class Name</h3>
            <form className="class-form" onSubmit={e => { e.preventDefault(); handlePermanentDelete(); }}>
              <select name="name" value={filters.name} onChange={handleChange} required>
                <option value="">Select Class Name</option>
                {classOptions.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
              <button type="submit">Delete Class Name</button>
            </form>
          </>
        ) : (
          <>
            <h3>Delete Class Session</h3>
            <form className="class-form" onSubmit={e => { e.preventDefault(); handleSessionDelete(); }}>
              <select name="name" value={filters.name} onChange={handleChange} required>
                <option value="">Select Class</option>
                {classOptions.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>

              <select name="term" value={filters.term} onChange={handleChange} required>
                <option value="">Select Term</option>
                <option value="First Term">First Term</option>
                <option value="Second Term">Second Term</option>
                <option value="Third Term">Third Term</option>
              </select>

              <select name="academic_year" value={filters.academic_year} onChange={handleChange}>
                <option value="">Select Academic Year</option>
                {academicYears.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>

              {showDepartment && (
                <select name="department" value={filters.department} onChange={handleChange}>
                  <option value="">Select Department</option>
                  <option value="Science">Science</option>
                  <option value="Arts">Arts</option>
                  <option value="Commercial">Commercial</option>
                </select>
              )}

              <button type="button" onClick={handleFilterSession}>Filter Session</button>
              <button type="submit">Delete Class Session</button>
            </form>
          </>
        )}

        {message && <p className="form-message success">{message}</p>}
        {error && <p className="form-message error">{error}</p>}
      </div>
    </div>
  );
};

export default ViewClasses;
