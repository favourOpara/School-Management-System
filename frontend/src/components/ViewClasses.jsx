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
  
  // NEW: Multi-select state for classes
  const [selectedClasses, setSelectedClasses] = useState([]);

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

  // NEW: Handle class checkbox selection
  const handleClassSelect = (className) => {
    setSelectedClasses(prev => 
      prev.includes(className) 
        ? prev.filter(name => name !== className)
        : [...prev, className]
    );
  };

  const handleFilterSession = () => {
    setMessage('');
    setError('');
    
    // For multi-select, we need term and academic_year to filter properly
    if (activeView === 'session' && selectedClasses.length > 0) {
      if (!filters.term || !filters.academic_year) {
        setError('Please select both Term and Academic Year when using multi-select.');
        return;
      }
      
      const matches = sessions.filter(sess =>
        selectedClasses.includes(sess.classroom?.name) &&
        sess.term === filters.term &&
        sess.academic_year === filters.academic_year
      );

      if (matches.length > 0) {
        setMessage(`${matches.length} session${matches.length > 1 ? 's' : ''} found for selected classes.`);
      } else {
        setError('No matching sessions found for selected classes.');
      }
      return;
    }

    // Original single-select logic
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

  // UPDATED: Handle multiple session deletion
  const handleSessionDelete = async () => {
    setMessage('');
    setError('');

    let sessionsToDelete = [];

    if (selectedClasses.length > 0) {
      // Multi-select mode
      if (!filters.term || !filters.academic_year) {
        setError('Please select both Term and Academic Year.');
        return;
      }

      sessionsToDelete = sessions.filter(sess =>
        selectedClasses.includes(sess.classroom?.name) &&
        sess.term === filters.term &&
        sess.academic_year === filters.academic_year
      );

      if (sessionsToDelete.length === 0) {
        setError('No matching sessions found for selected classes.');
        return;
      }

      const confirmMessage = `Delete ${sessionsToDelete.length} class session${sessionsToDelete.length > 1 ? 's' : ''} from ${filters.academic_year} - ${filters.term}?\n\n` +
        sessionsToDelete.map(sess => sess.classroom.name).join(', ');

      if (!window.confirm(confirmMessage)) return;
    } else {
      // Single-select mode (original logic)
      const match = sessions.find(sess =>
        sess.classroom?.name === filters.name &&
        sess.term === filters.term &&
        sess.academic_year === filters.academic_year
      );

      if (!match) return setError('No matching session to delete.');
      if (!window.confirm(`Delete ${match.classroom.name} (${match.term}, ${match.academic_year})?`)) return;
      
      sessionsToDelete = [match];
    }

    try {
      // Delete all selected sessions
      const deletePromises = sessionsToDelete.map(sess =>
        axios.delete(`http://127.0.0.1:8000/api/academics/sessions/${sess.id}/`, {
          headers: { Authorization: `Bearer ${token}` },
        })
      );

      await Promise.all(deletePromises);
      
      // Update local state
      const deletedIds = sessionsToDelete.map(sess => sess.id);
      setSessions(prev => prev.filter(sess => !deletedIds.includes(sess.id)));
      setSelectedClasses([]);
      
      setMessage(`${sessionsToDelete.length} class session${sessionsToDelete.length > 1 ? 's' : ''} deleted successfully.`);
    } catch (err) {
      setError('Failed to delete some sessions. They may be linked to other records.');
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
              {/* Multi-select checkboxes for classes */}
              <div className="multi-select-classes">
                <label>Select Classes:</label>
                <div className="checkbox-container">
                  {classOptions.map(name => (
                    <label key={name} className="checkbox-item">
                      <input
                        type="checkbox"
                        checked={selectedClasses.includes(name)}
                        onChange={() => handleClassSelect(name)}
                      />
                      {name}
                    </label>
                  ))}
                </div>
                {selectedClasses.length > 0 && (
                  <p className="selected-count">{selectedClasses.length} class{selectedClasses.length > 1 ? 'es' : ''} selected</p>
                )}
              </div>

              <select name="term" value={filters.term} onChange={handleChange} required>
                <option value="">Select Term</option>
                <option value="First Term">First Term</option>
                <option value="Second Term">Second Term</option>
                <option value="Third Term">Third Term</option>
              </select>

              <select name="academic_year" value={filters.academic_year} onChange={handleChange} required>
                <option value="">Select Academic Year</option>
                {[...new Set(sessions.map(s => s.academic_year))].map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>

              <button type="button" onClick={handleFilterSession}>Filter Session</button>
              <button type="submit">Delete Class Session{selectedClasses.length > 1 ? 's' : ''}</button>
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