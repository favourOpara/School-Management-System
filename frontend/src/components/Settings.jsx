// src/components/Settings.jsx
import React, { useState, useEffect } from 'react';
import { Save, AlertCircle, CheckCircle, Settings as SettingsIcon, Trash2, X } from 'lucide-react';
import API_BASE_URL from '../config';

import './Settings.css';

const Settings = () => {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, type: '', id: null, name: '' });

  // Grading Configuration State
  const [gradingConfigs, setGradingConfigs] = useState([]);
  const [gradingScales, setGradingScales] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [terms, setTerms] = useState([]);
  const [currentConfig, setCurrentConfig] = useState({
    academic_year: '',
    term: '',
    attendance_percentage: 10,
    assignment_percentage: 10,
    test_percentage: 30,
    exam_percentage: 50,
    grading_scale: ''
  });
  const [showValidation, setShowValidation] = useState(false);

  // New Grading Scale State
  const [newScale, setNewScale] = useState({
    name: '',
    description: '',
    academic_year: '',
    term: '',
    a_min_score: 90,
    b_min_score: 80,
    c_min_score: 70,
    d_min_score: 60
  });
  
  // Tab State
  const [activeTab, setActiveTab] = useState('grading-config');

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken');
      
      // Fetch sessions to get academic years and terms
      const sessionResponse = await fetch(`${API_BASE_URL}/api/academics/sessions/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (sessionResponse.ok) {
        const sessionData = await sessionResponse.json();
        setSessions(sessionData || []);
        
        const uniqueYears = [...new Set(sessionData.map(s => s.academic_year))];
        const uniqueTerms = [...new Set(sessionData.map(s => s.term))];
        setAcademicYears(uniqueYears);
        setTerms(uniqueTerms);
      }

      // Fetch grading configurations
      const configResponse = await fetch(`${API_BASE_URL}/api/schooladmin/grading/configurations/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (configResponse.ok) {
        const configData = await configResponse.json();
        setGradingConfigs(configData || []);
      }

      // Fetch grading scales
      const scaleResponse = await fetch(`${API_BASE_URL}/api/schooladmin/grading/scales/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (scaleResponse.ok) {
        const scaleData = await scaleResponse.json();
        setGradingScales(scaleData || []);
      }

    } catch (error) {
      showMessage('Error fetching data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (text, type) => {
    setMessage(text);
    setMessageType(type);
    setTimeout(() => {
      setMessage('');
      setMessageType('');
    }, 5000);
  };

  const showDeleteConfirmation = (type, id, name) => {
    setDeleteConfirm({ show: true, type, id, name });
  };

  const cancelDelete = () => {
    setDeleteConfirm({ show: false, type: '', id: null, name: '' });
  };

  const handleDeleteConfig = async () => {
    const { id } = deleteConfirm;
    
    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken');
      
      const response = await fetch(`${API_BASE_URL}/api/schooladmin/grading/configurations/${id}/`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        showMessage('Grading configuration deleted successfully!', 'success');
        fetchAllData();
      } else {
        const errorData = await response.json();
        showMessage(errorData.detail || 'Error deleting configuration', 'error');
      }
    } catch (error) {
      showMessage('Error deleting configuration', 'error');
    } finally {
      setLoading(false);
      cancelDelete();
    }
  };

  const handleDeleteScale = async () => {
    const { id } = deleteConfirm;
    
    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken');
      
      const response = await fetch(`${API_BASE_URL}/api/schooladmin/grading/scales/${id}/`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        showMessage('Grading scale deleted successfully!', 'success');
        fetchAllData();
      } else {
        const errorData = await response.json();
        showMessage(errorData.detail || 'Error deleting grading scale', 'error');
      }
    } catch (error) {
      showMessage('Error deleting grading scale', 'error');
    } finally {
      setLoading(false);
      cancelDelete();
    }
  };

  const confirmDelete = () => {
    if (deleteConfirm.type === 'config') {
      handleDeleteConfig();
    } else if (deleteConfirm.type === 'scale') {
      handleDeleteScale();
    }
  };

  // Validate percentage totals
  const validatePercentages = (config) => {
    const total = config.attendance_percentage + config.assignment_percentage + 
                  config.test_percentage + config.exam_percentage;
    return {
      isValid: total === 100,
      total: total,
      remaining: 100 - total,
      errors: [
        ...(config.attendance_percentage < 5 || config.attendance_percentage > 20 
          ? ['Attendance must be between 5% and 20%'] : []),
        ...(config.assignment_percentage < 5 || config.assignment_percentage > 20 
          ? ['Assignment must be between 5% and 20%'] : [])
      ]
    };
  };

  const handleConfigChange = (field, value) => {
    let processedValue = value;
    if (field.includes('percentage')) {
      processedValue = parseInt(value) || 0;
    }
    const newConfig = { ...currentConfig, [field]: processedValue };
    setCurrentConfig(newConfig);
    setShowValidation(true);
  };

  const handleCreateConfig = async () => {
    const validation = validatePercentages(currentConfig);
    if (!validation.isValid || validation.errors.length > 0) {
      showMessage('Please fix validation errors before saving', 'error');
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken');
      
      const response = await fetch(`${API_BASE_URL}/api/schooladmin/grading/configurations/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(currentConfig)
      });

      if (response.ok) {
        showMessage('Grading configuration created successfully!', 'success');
        setCurrentConfig({
          academic_year: '',
          term: '',
          attendance_percentage: 10,
          assignment_percentage: 10,
          test_percentage: 30,
          exam_percentage: 50,
          grading_scale: ''
        });
        setShowValidation(false);
        fetchAllData();
      } else {
        const errorData = await response.json();
        showMessage(errorData.detail || 'Error creating configuration', 'error');
      }
    } catch (error) {
      showMessage('Error creating configuration', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateScale = async () => {
    if (newScale.a_min_score <= newScale.b_min_score || 
        newScale.b_min_score <= newScale.c_min_score || 
        newScale.c_min_score <= newScale.d_min_score) {
      showMessage('Grade boundaries must be in descending order (A > B > C > D)', 'error');
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken');
      
      const response = await fetch(`${API_BASE_URL}/api/schooladmin/grading/scales/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newScale)
      });

      if (response.ok) {
        showMessage('Grading scale created successfully!', 'success');
        setNewScale({
          name: '',
          description: '',
          academic_year: '',
          term: '',
          a_min_score: 90,
          b_min_score: 80,
          c_min_score: 70,
          d_min_score: 60
        });
        fetchAllData();
      } else {
        const errorData = await response.json();
        showMessage(errorData.detail || 'Error creating grading scale', 'error');
      }
    } catch (error) {
      showMessage('Error creating grading scale', 'error');
    } finally {
      setLoading(false);
    }
  };

  const validation = showValidation ? validatePercentages(currentConfig) : null;

  return (
    <div className="settings-container">
      <div className="settings-header">
        <SettingsIcon size={32} />
        <div>
          <h2>School Settings</h2>
          <p>Configure grading system and academic settings</p>
        </div>
      </div>

      {message && (
        <div className={`message ${messageType}`}>
          {messageType === 'error' ? <AlertCircle size={20} /> : <CheckCircle size={20} />}
          {message}
        </div>
      )}

      <div className="settings-tabs">
        <button 
          className={activeTab === 'grading-config' ? 'active' : ''}
          onClick={() => setActiveTab('grading-config')}
        >
          Grading Configuration
        </button>
        <button 
          className={activeTab === 'grading-scales' ? 'active' : ''}
          onClick={() => setActiveTab('grading-scales')}
        >
          Grading Scales (A,B,C,D,F)
        </button>
      </div>

      <div className="settings-content">
        {activeTab === 'grading-config' && (
          <>
            <div className="settings-section">
              <h3>Grading Configuration</h3>
              <p>Set the percentage weights for attendance, assignments, tests, and exams. Total must equal 100%.</p>
              
              <div className="grading-config-form">
                <div className="form-row">
                  <div className="form-group">
                    <label>Academic Year</label>
                    <select
                      value={currentConfig.academic_year}
                      onChange={(e) => handleConfigChange('academic_year', e.target.value)}
                    >
                      <option value="">Select Academic Year</option>
                      {academicYears.map(year => (
                        <option key={year} value={year}>{year}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="form-group">
                    <label>Term</label>
                    <select
                      value={currentConfig.term}
                      onChange={(e) => handleConfigChange('term', e.target.value)}
                    >
                      <option value="">Select Term</option>
                      {terms.map(term => (
                        <option key={term} value={term}>{term}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="percentage-grid">
                  <div className="percentage-item">
                    <label>Attendance (%)</label>
                    <input
                      type="number"
                      min="5"
                      max="20"
                      value={currentConfig.attendance_percentage}
                      onChange={(e) => handleConfigChange('attendance_percentage', e.target.value)}
                    />
                    <small>5% - 20%</small>
                  </div>

                  <div className="percentage-item">
                    <label>Assignment (%)</label>
                    <input
                      type="number"
                      min="5"
                      max="20"
                      value={currentConfig.assignment_percentage}
                      onChange={(e) => handleConfigChange('assignment_percentage', e.target.value)}
                    />
                    <small>5% - 20%</small>
                  </div>

                  <div className="percentage-item">
                    <label>Test (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={currentConfig.test_percentage}
                      onChange={(e) => handleConfigChange('test_percentage', e.target.value)}
                    />
                  </div>

                  <div className="percentage-item">
                    <label>Exam (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={currentConfig.exam_percentage}
                      onChange={(e) => handleConfigChange('exam_percentage', e.target.value)}
                    />
                  </div>
                </div>

                {validation && (
                  <div className="validation-info">
                    <div className={`total-display ${validation.isValid ? 'valid' : 'invalid'}`}>
                      Total: {validation.total}% 
                      {!validation.isValid && (
                        <span> (Need {validation.remaining > 0 ? `${validation.remaining} more` : `${Math.abs(validation.remaining)} less`})</span>
                      )}
                    </div>
                    
                    {validation.errors.length > 0 && (
                      <div className="validation-errors">
                        {validation.errors.map((error, index) => (
                          <div key={index} className="error-item">{error}</div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="form-group">
                  <label>Grading Scale</label>
                  <select
                    value={currentConfig.grading_scale}
                    onChange={(e) => handleConfigChange('grading_scale', e.target.value)}
                  >
                    <option value="">Select Grading Scale</option>
                    {gradingScales.map(scale => (
                      <option key={scale.id} value={scale.id}>
                        {scale.name} (A:{scale.a_min_score}+, B:{scale.b_min_score}+, C:{scale.c_min_score}+, D:{scale.d_min_score}+)
                      </option>
                    ))}
                  </select>
                </div>

                <button 
                  className="save-config-btn"
                  onClick={handleCreateConfig}
                  disabled={loading || !validation?.isValid || validation?.errors.length > 0}
                >
                  <Save size={18} />
                  {loading ? 'Saving...' : 'Save Configuration'}
                </button>
              </div>
            </div>

            <div className="settings-section">
              <h3>Existing Configurations</h3>
              {gradingConfigs.length === 0 ? (
                <p>No grading configurations created yet.</p>
              ) : (
                <div className="configs-list">
                  {gradingConfigs.map(config => (
                    <div key={config.id} className="config-item">
                      <div className="config-header">
                        <h4>{config.academic_year} - {config.term}</h4>
                        <div className="config-actions">
                          <span className="config-status">Active</span>
                          <button 
                            className="delete-btn"
                            onClick={() => showDeleteConfirmation('config', config.id, `${config.academic_year} - ${config.term}`)}
                            title="Delete configuration"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                      <div className="config-details">
                        <span>Attendance: {config.attendance_percentage}%</span>
                        <span>Assignment: {config.assignment_percentage}%</span>
                        <span>Test: {config.test_percentage}%</span>
                        <span>Exam: {config.exam_percentage}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === 'grading-scales' && (
          <>
            <div className="settings-section">
              <h3>Create New Grading Scale</h3>
              <p>Set the minimum score boundaries for letter grades (A, B, C, D, F).</p>
              
              <div className="grading-scale-form">
                <div className="form-row">
                  <div className="form-group">
                    <label>Scale Name</label>
                    <input
                      type="text"
                      placeholder="e.g., Standard Scale"
                      value={newScale.name}
                      onChange={(e) => setNewScale({...newScale, name: e.target.value})}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Description</label>
                    <input
                      type="text"
                      placeholder="Description (optional)"
                      value={newScale.description}
                      onChange={(e) => setNewScale({...newScale, description: e.target.value})}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Academic Year</label>
                    <select
                      value={newScale.academic_year}
                      onChange={(e) => setNewScale({...newScale, academic_year: e.target.value})}
                    >
                      <option value="">Select Academic Year</option>
                      {academicYears.map(year => (
                        <option key={year} value={year}>{year}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="form-group">
                    <label>Term</label>
                    <select
                      value={newScale.term}
                      onChange={(e) => setNewScale({...newScale, term: e.target.value})}
                    >
                      <option value="">Select Term</option>
                      {terms.map(term => (
                        <option key={term} value={term}>{term}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grade-boundaries">
                  <div className="grade-item">
                    <label>Grade A (minimum %)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={newScale.a_min_score}
                      onChange={(e) => setNewScale({...newScale, a_min_score: parseInt(e.target.value)})}
                    />
                  </div>

                  <div className="grade-item">
                    <label>Grade B (minimum %)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={newScale.b_min_score}
                      onChange={(e) => setNewScale({...newScale, b_min_score: parseInt(e.target.value)})}
                    />
                  </div>

                  <div className="grade-item">
                    <label>Grade C (minimum %)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={newScale.c_min_score}
                      onChange={(e) => setNewScale({...newScale, c_min_score: parseInt(e.target.value)})}
                    />
                  </div>

                  <div className="grade-item">
                    <label>Grade D (minimum %)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={newScale.d_min_score}
                      onChange={(e) => setNewScale({...newScale, d_min_score: parseInt(e.target.value)})}
                    />
                  </div>
                </div>

                <div className="grade-preview">
                  <p><strong>Grade Preview:</strong></p>
                  <p>A: {newScale.a_min_score}% - 100%</p>
                  <p>B: {newScale.b_min_score}% - {newScale.a_min_score - 1}%</p>
                  <p>C: {newScale.c_min_score}% - {newScale.b_min_score - 1}%</p>
                  <p>D: {newScale.d_min_score}% - {newScale.c_min_score - 1}%</p>
                  <p>F: 0% - {newScale.d_min_score - 1}%</p>
                </div>

                <button 
                  className="save-config-btn"
                  onClick={handleCreateScale}
                  disabled={loading || !newScale.name || !newScale.academic_year || !newScale.term}
                >
                  <Save size={18} />
                  {loading ? 'Creating...' : 'Create Grading Scale'}
                </button>
              </div>
            </div>

            <div className="settings-section">
              <h3>Existing Grading Scales</h3>
              {gradingScales.length === 0 ? (
                <p>No grading scales created yet.</p>
              ) : (
                <div className="scales-list">
                  {gradingScales.map(scale => (
                    <div key={scale.id} className="scale-item">
                      <div className="scale-header">
                        <h4>{scale.name}</h4>
                        <div className="scale-actions">
                          <span className="scale-status">Active</span>
                          <button 
                            className="delete-btn"
                            onClick={() => showDeleteConfirmation('scale', scale.id, scale.name)}
                            title="Delete grading scale"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                      {scale.description && <p className="scale-description">{scale.description}</p>}
                      <div className="scale-session-info">
                        <span className="session-info">Academic Year: {scale.academic_year || 'Not Set'}</span>
                        <span className="session-info">Term: {scale.term || 'Not Set'}</span>
                      </div>
                      <div className="scale-details">
                        <span>A: {scale.a_min_score}%+</span>
                        <span>B: {scale.b_min_score}%+</span>
                        <span>C: {scale.c_min_score}%+</span>
                        <span>D: {scale.d_min_score}%+</span>
                        <span>F: Below {scale.d_min_score}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm.show && (
        <div className="delete-modal-overlay">
          <div className="delete-modal">
            <div className="delete-modal-header">
              <h3>Confirm Deletion</h3>
              <button className="close-modal-btn" onClick={cancelDelete}>
                <X size={20} />
              </button>
            </div>
            <div className="delete-modal-content">
              <p>Are you sure you want to delete <strong>{deleteConfirm.name}</strong>?</p>
              <p className="delete-warning">This action cannot be undone.</p>
            </div>
            <div className="delete-modal-actions">
              <button className="cancel-btn" onClick={cancelDelete} disabled={loading}>
                Cancel
              </button>
              <button className="confirm-delete-btn" onClick={confirmDelete} disabled={loading}>
                <Trash2 size={16} />
                {loading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;