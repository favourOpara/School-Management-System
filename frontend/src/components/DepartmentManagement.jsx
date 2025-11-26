import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useLoading } from '../context/LoadingContext';
import './DepartmentManagement.css';

const DepartmentManagement = () => {
  const { showLoader, hideLoader } = useLoading();
  const token = localStorage.getItem('accessToken');

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [departments, setDepartments] = useState([]);
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [selectedDepartments, setSelectedDepartments] = useState([]);

  // Fetch departments
  const fetchDepartments = async () => {
    try {
      const res = await axios.get('http://127.0.0.1:8000/api/academics/departments/', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDepartments(res.data);
    } catch (err) {
      console.error('Error fetching departments:', err);
    }
  };

  // Fetch classes
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
    fetchDepartments();
    fetchClasses();
  }, []);

  // Handle class selection
  const handleClassSelect = (cls) => {
    setSelectedClass(cls);
    // Pre-select departments that are already assigned to this class
    const deptIds = cls.departments ? cls.departments.map(d => d.id) : [];
    setSelectedDepartments(deptIds);
    setMessage('');
    setError('');
  };

  // Handle department toggle
  const handleDepartmentToggle = (deptId) => {
    setSelectedDepartments(prev => {
      if (prev.includes(deptId)) {
        return prev.filter(id => id !== deptId);
      } else {
        return [...prev, deptId];
      }
    });
  };

  // Assign departments to class
  const handleAssignDepartments = async () => {
    if (!selectedClass) {
      setError('Please select a class first.');
      return;
    }

    setMessage('');
    setError('');
    showLoader();

    try {
      await axios.patch(
        `http://127.0.0.1:8000/api/academics/classes/${selectedClass.id}/`,
        { department_ids: selectedDepartments },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const deptsText = selectedDepartments.length > 0
        ? `${selectedDepartments.length} department(s)`
        : 'no departments';
      setMessage(`Successfully assigned ${deptsText} to ${selectedClass.name}`);

      // Refresh classes
      await fetchClasses();

      // Update selected class with new data
      const updatedClass = await axios.get(
        `http://127.0.0.1:8000/api/academics/classes/${selectedClass.id}/`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSelectedClass(updatedClass.data);
    } catch (err) {
      const errorMsg = err.response?.data?.detail || 'Failed to assign departments. Please try again.';
      setError(errorMsg);
    } finally {
      hideLoader();
    }
  };

  // Get department name by ID
  const getDepartmentName = (deptId) => {
    const dept = departments.find(d => d.id === deptId);
    return dept ? dept.name : '';
  };

  return (
    <div className="department-management-page">
      <div className="page-header">
        <h1>Department Assignment</h1>
        <p className="page-subtitle">
          Configure which classes use the department system (Science, Arts, Commercial).
          Junior classes (J.S.S) typically don't have departments, while Senior classes (S.S.S) do.
        </p>
      </div>

      {message && <div className="alert alert-success">{message}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      <div className="department-content">
        {/* Left panel - Classes */}
        <div className="department-panel">
          <div className="panel-header">
            <h2>Classes</h2>
            <p className="panel-subtitle">Select a class to configure its departments</p>
          </div>
          <div className="department-list">
            {classes.length === 0 ? (
              <div className="empty-state">
                <p>No classes found</p>
                <p className="empty-hint">Create classes in Class Management first</p>
              </div>
            ) : (
              classes.map(cls => (
                <div
                  key={cls.id}
                  className={`department-card ${selectedClass?.id === cls.id ? 'selected' : ''}`}
                  onClick={() => handleClassSelect(cls)}
                >
                  <div className="dept-name">{cls.name}</div>
                  <div className="dept-info">
                    {cls.has_departments ? (
                      <>
                        {cls.departments && cls.departments.length > 0 ? (
                          cls.departments.map(d => d.name).join(', ')
                        ) : (
                          'Has departments'
                        )}
                      </>
                    ) : (
                      'No departments'
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right panel - Department assignment */}
        <div className="classes-panel">
          {selectedClass ? (
            <>
              <div className="panel-header">
                <h2>Configure Departments for {selectedClass.name}</h2>
                <p className="panel-subtitle">
                  Select which departments are available in this class.
                  If no departments are selected, the class won't use the department system.
                </p>
              </div>

              <div className="classes-section">
                <h3>Available Departments</h3>
                <div className="department-checkboxes">
                  {departments.length === 0 ? (
                    <div className="empty-state">
                      <p>No departments available</p>
                      <p className="empty-hint">Departments: Science, Arts, Commercial</p>
                    </div>
                  ) : (
                    departments.map(dept => (
                      <label key={dept.id} className="department-checkbox-item">
                        <input
                          type="checkbox"
                          checked={selectedDepartments.includes(dept.id)}
                          onChange={() => handleDepartmentToggle(dept.id)}
                        />
                        <div className="department-checkbox-content">
                          <span className="department-checkbox-name">{dept.name}</span>
                          <span className="department-checkbox-desc">{dept.description}</span>
                        </div>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div className="assignment-summary">
                <div className="summary-info">
                  {selectedDepartments.length === 0 ? (
                    <span>No departments selected - this class will NOT use the department system</span>
                  ) : (
                    <span>
                      <strong>{selectedDepartments.length}</strong> department(s) selected: {' '}
                      {selectedDepartments.map(id => getDepartmentName(id)).join(', ')}
                    </span>
                  )}
                </div>
                <button
                  className="btn-primary"
                  onClick={handleAssignDepartments}
                >
                  Save Configuration
                </button>
              </div>

              <div className="info-box">
                <h4>How this works:</h4>
                <ul>
                  <li>If departments are assigned to this class, students and subjects in this class MUST select a department</li>
                  <li>If NO departments are assigned, this class operates without the department system</li>
                  <li>Typically, J.S.S classes don't have departments, while S.S.S classes do</li>
                </ul>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <p>Select a class from the left to configure its departments</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DepartmentManagement;
