import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useLoading } from '../context/LoadingContext';
import './ClassForm.css';

const ClassManagementForm = () => {
  const { showLoader, hideLoader } = useLoading();
  const token = localStorage.getItem('accessToken');

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [classInput, setClassInput] = useState('');
  const [stagedClassNames, setStagedClassNames] = useState([]);
  const [stagedClassesWithDept, setStagedClassesWithDept] = useState({});
  const [sessionData, setSessionData] = useState({
    classrooms: [],
    academic_year: '',
    term: ''
  });

  const [classes, setClasses] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [inheritanceData, setInheritanceData] = useState({
    source_academic_year: '',
    source_term: '',
    target_academic_year: '',
    target_term: '',
    copy_students: false,
    copy_subjects: false,
    promote_students: false
  });

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

  const fetchSessions = async () => {
    try {
      const res = await axios.get('http://127.0.0.1:8000/api/academics/sessions/', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSessions(res.data);
    } catch (err) {
      console.error('Error fetching sessions:', err);
    }
  };

  useEffect(() => {
    fetchClasses();
    fetchSessions();
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
      const className = classInput.trim();
      setStagedClassNames(prev => [...prev, className]);
      setStagedClassesWithDept(prev => ({ ...prev, [className]: false }));
      setClassInput('');
      setMessage('');
    }
  };

  const handleDeleteStagedClass = (name) => {
    setStagedClassNames(prev => prev.filter(n => n !== name));
    setStagedClassesWithDept(prev => {
      const updated = { ...prev };
      delete updated[name];
      return updated;
    });
  };

  const handleDepartmentToggle = (className) => {
    setStagedClassesWithDept(prev => ({
      ...prev,
      [className]: !prev[className]
    }));
  };

  const handleSubmitClass = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');
    showLoader();

    try {
      const promises = stagedClassNames.map(name =>
        axios.post('http://127.0.0.1:8000/api/academics/classes/', {
          name,
          has_departments: stagedClassesWithDept[name] || false
        }, {
          headers: { Authorization: `Bearer ${token}` }
        })
      );
      await Promise.all(promises);
      setMessage('Class names added successfully.');
      setStagedClassNames([]);
      setStagedClassesWithDept({});
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
        await fetchSessions(); // Refresh sessions after creating new ones
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

  const handleInheritanceChange = (e) => {
    const { name, value, type, checked } = e.target;
    setInheritanceData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmitInheritance = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');

    if (!inheritanceData.copy_students && !inheritanceData.copy_subjects) {
      setError('Please select at least one option: Copy Students or Copy Subjects.');
      return;
    }

    showLoader();

    try {
      const response = await axios.post('http://127.0.0.1:8000/api/academics/sessions/inherit/', inheritanceData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.status === 200) {
        let successMsg = response.data.message;
        const details = response.data.details;

        if (details.students_promoted > 0) {
          successMsg += ` Students promoted: ${details.students_promoted}`;
          if (details.students_graduated > 0) {
            successMsg += `, Graduated: ${details.students_graduated}`;
          }
        } else {
          successMsg += ` Students copied: ${details.students_copied}`;
        }

        if (details.subjects_copied > 0) {
          successMsg += `, Subjects copied: ${details.subjects_copied}`;
        }

        setMessage(successMsg);
        setInheritanceData({
          source_academic_year: '',
          source_term: '',
          target_academic_year: '',
          target_term: '',
          copy_students: false,
          copy_subjects: false,
          promote_students: false
        });
        await fetchSessions(); // Refresh sessions after copying
      }
    } catch (err) {
      if (err.response?.data) {
        const detail = typeof err.response.data === 'string'
          ? err.response.data
          : JSON.stringify(err.response.data);
        setError(`Failed to copy data: ${detail}`);
      } else {
        setError('Failed to copy data. Please try again.');
      }
    } finally {
      hideLoader();
    }
  };

  return (
    <div className="class-management-page">
      <div className="page-header">
        <h1>Class Management</h1>
        <p className="page-subtitle">Configure classes, sessions, and term transitions</p>
      </div>

      {/* Messages */}
      {message && <div className="alert alert-success">{message}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      {/* Section 1: Add Class Name */}
      <div className="class-mgmt-section">
        <div className="class-section-header">
          <h2>Class Names</h2>
          <p className="section-description">Create and manage class names (e.g., J.S.S.1, S.S.S.2)</p>
        </div>
        <div className="section-content">
          <form onSubmit={handleSubmitClass} className="settings-form">
            <div className="form-row">
              <div className="form-group-inline">
                <input
                  type="text"
                  name="classInput"
                  placeholder="Enter class name (e.g., J.S.S.1)"
                  value={classInput}
                  onChange={handleClassNameInput}
                  className="form-input"
                />
                <button type="button" onClick={handleAddStagedClass} className="btn-secondary">Add</button>
              </div>
            </div>

            {stagedClassNames.length > 0 && (
              <div className="staged-items">
                {stagedClassNames.map((name, index) => (
                  <div key={index} className="staged-item">
                    <div className="staged-item-content">
                      <span className="staged-name">{name}</span>
                      <label className="department-checkbox">
                        <input
                          type="checkbox"
                          checked={stagedClassesWithDept[name] || false}
                          onChange={() => handleDepartmentToggle(name)}
                        />
                        <span className="checkbox-label">Department-based class?</span>
                      </label>
                    </div>
                    <button type="button" className="btn-remove" onClick={() => handleDeleteStagedClass(name)}>Remove</button>
                  </div>
                ))}
              </div>
            )}

            <div className="form-actions">
              <button type="submit" className="btn-primary" disabled={stagedClassNames.length === 0}>
                Create {stagedClassNames.length} Class{stagedClassNames.length !== 1 ? 'es' : ''}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Section 2: Add Class Session */}
      <div className="class-mgmt-section">
        <div className="class-section-header">
          <h2>Class Sessions</h2>
          <p className="section-description">Create sessions for specific classes, academic years, and terms</p>
        </div>
        <div className="section-content">
          <form onSubmit={handleSubmitSession} className="settings-form">
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Select Classes</label>
                <select name="classrooms" multiple value={sessionData.classrooms} onChange={handleSessionChange} required className="form-input form-select-multiple">
                  {classes.map(cls => (
                    <option key={cls.id} value={cls.id}>{cls.name}</option>
                  ))}
                </select>
                <span className="form-hint">Hold Ctrl (or Cmd) to select multiple classes</span>
              </div>
            </div>

            <div className="form-row-grid">
              <div className="form-group">
                <label className="form-label">Academic Year</label>
                <input
                  type="text"
                  name="academic_year"
                  placeholder="2024/2025"
                  value={sessionData.academic_year}
                  onChange={handleSessionChange}
                  required
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Term</label>
                <select name="term" value={sessionData.term} onChange={handleSessionChange} required className="form-input">
                  <option value="">Select Term</option>
                  <option value="First Term">First Term</option>
                  <option value="Second Term">Second Term</option>
                  <option value="Third Term">Third Term</option>
                </select>
              </div>
            </div>

            <div className="form-actions">
              <button type="submit" className="btn-primary">Create Session(s)</button>
            </div>
          </form>
        </div>
      </div>

      {/* Section 3: Copy from Previous Session */}
      <div className="class-mgmt-section">
        <div className="class-section-header">
          <h2>Session Migration</h2>
          <p className="section-description">Copy students and subjects from a previous session to a new one</p>
        </div>
        <div className="section-content">
          <form onSubmit={handleSubmitInheritance} className="settings-form">
            <div className="subsection">
              <h3 className="subsection-title">Source Session</h3>
              <div className="form-row-grid">
                <div className="form-group">
                  <label className="form-label">Academic Year</label>
                  <select name="source_academic_year" value={inheritanceData.source_academic_year} onChange={handleInheritanceChange} required className="form-input">
                    <option value="">Select Academic Year</option>
                    {[...new Set(sessions.map(s => s.academic_year))].map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Term</label>
                  <select name="source_term" value={inheritanceData.source_term} onChange={handleInheritanceChange} required className="form-input">
                    <option value="">Select Term</option>
                    {inheritanceData.source_academic_year &&
                      [...new Set(sessions
                        .filter(s => s.academic_year === inheritanceData.source_academic_year)
                        .map(s => s.term))].map(term => (
                          <option key={term} value={term}>{term}</option>
                        ))
                    }
                  </select>
                </div>
              </div>
            </div>

            <div className="subsection">
              <h3 className="subsection-title">Target Session</h3>
              <div className="form-row-grid">
                <div className="form-group">
                  <label className="form-label">Academic Year</label>
                  <select name="target_academic_year" value={inheritanceData.target_academic_year} onChange={handleInheritanceChange} required className="form-input">
                    <option value="">Select Academic Year</option>
                    {[...new Set(sessions.map(s => s.academic_year))].map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Term</label>
                  <select name="target_term" value={inheritanceData.target_term} onChange={handleInheritanceChange} required className="form-input">
                    <option value="">Select Term</option>
                    {inheritanceData.target_academic_year &&
                      [...new Set(sessions
                        .filter(s => s.academic_year === inheritanceData.target_academic_year)
                        .map(s => s.term))].map(term => (
                          <option key={term} value={term}>{term}</option>
                        ))
                    }
                  </select>
                </div>
              </div>
            </div>

            <div className="subsection">
              <h3 className="subsection-title">Migration Options</h3>
              <div className="checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="copy_students"
                    checked={inheritanceData.copy_students}
                    onChange={handleInheritanceChange}
                    className="checkbox-input"
                  />
                  <div className="checkbox-content">
                    <span className="checkbox-title">Copy Students</span>
                    <span className="checkbox-description">Migrate all enrolled students to the new session</span>
                  </div>
                </label>

                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="copy_subjects"
                    checked={inheritanceData.copy_subjects}
                    onChange={handleInheritanceChange}
                    className="checkbox-input"
                  />
                  <div className="checkbox-content">
                    <span className="checkbox-title">Copy Subjects</span>
                    <span className="checkbox-description">Duplicate subject assignments and teacher mappings</span>
                  </div>
                </label>

                {inheritanceData.source_term === 'Third Term' && inheritanceData.copy_students && (
                  <label className="checkbox-label" style={{ backgroundColor: '#fff8e1', padding: '1rem', border: '1px solid #ffc107', borderRadius: '6px' }}>
                    <input
                      type="checkbox"
                      name="promote_students"
                      checked={inheritanceData.promote_students}
                      onChange={handleInheritanceChange}
                      className="checkbox-input"
                      style={{ accentColor: '#ff9800' }}
                    />
                    <div className="checkbox-content">
                      <span className="checkbox-title" style={{ color: '#e65100' }}>Promote Students to Next Class</span>
                      <span className="checkbox-description">Move students to the next grade level (J.S.S.1 → J.S.S.2, J.S.S.3 → S.S.S.1, etc.)</span>
                    </div>
                  </label>
                )}
              </div>
            </div>

            <div className="form-actions">
              <button type="submit" className="btn-primary">Migrate Data</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ClassManagementForm;