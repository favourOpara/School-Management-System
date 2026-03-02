import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSchool } from '../contexts/SchoolContext';
import {
  Upload, Download, FileSpreadsheet, CheckCircle, XCircle, AlertCircle,
  ChevronRight, ChevronLeft, Loader2, X, Info
} from 'lucide-react';
import * as XLSX from 'xlsx';
import './ImportStudentsModal.css';

const ImportTeachersModal = ({ onClose, onSuccess }) => {
  const { buildApiUrl } = useSchool();
  const token = localStorage.getItem('accessToken');
  const fileInputRef = useRef(null);

  const [step, setStep] = useState(1);
  const [usernameMode, setUsernameMode] = useState('auto');

  const [hasImport, setHasImport] = useState(false);
  const [maxImportRows, setMaxImportRows] = useState(0);
  const [infoLoading, setInfoLoading] = useState(true);

  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  const [validating, setValidating] = useState(false);
  const [validationResults, setValidationResults] = useState(null);
  const [validationError, setValidationError] = useState('');

  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState(null);
  const [importError, setImportError] = useState('');

  useEffect(() => {
    const fetchInfo = async () => {
      try {
        const res = await fetch(buildApiUrl('/users/import-teachers/info/'), {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setHasImport(data.has_import);
        setMaxImportRows(data.max_import_rows || 0);
      } catch (err) {
        console.error('Failed to fetch import info:', err);
      } finally {
        setInfoLoading(false);
      }
    };
    fetchInfo();
  }, [buildApiUrl, token]);

  const handleDownloadTemplate = () => {
    const headers = ['first_name', 'last_name', 'email', 'gender'];
    if (usernameMode === 'xlsx') headers.push('username');
    headers.push('phone_number', 'middle_name', 'date_of_birth');

    const exampleRow = ['Jane', 'Smith', 'jane.smith@school.com', 'Female'];
    if (usernameMode === 'xlsx') exampleRow.push('jane.smith');
    exampleRow.push('08012345678', '', '');

    const ws = XLSX.utils.aoa_to_sheet([headers, exampleRow]);
    ws['!cols'] = headers.map(() => ({ wch: 22 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Teachers');
    XLSX.writeFile(wb, 'teacher_import_template.xlsx');
  };

  const handleFileDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped && (dropped.name.endsWith('.xlsx') || dropped.name.endsWith('.xls'))) {
      setFile(dropped);
    }
  }, []);

  const handleFileSelect = (e) => {
    const selected = e.target.files[0];
    if (selected) setFile(selected);
  };

  const handleValidate = async () => {
    if (!file) return;
    setValidating(true);
    setValidationError('');
    setValidationResults(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('username_mode', usernameMode);

    try {
      const res = await fetch(buildApiUrl('/users/import-teachers/validate/'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setValidationError(data.error || 'Validation failed');
      } else {
        setValidationResults(data);
        setStep(3);
      }
    } catch (err) {
      setValidationError(err.message || 'Network error');
    } finally {
      setValidating(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!file) return;
    setImporting(true);
    setImportError('');
    setImportResults(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('username_mode', usernameMode);

    try {
      const res = await fetch(buildApiUrl('/users/import-teachers/confirm/'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setImportError(data.error || 'Import failed');
      } else {
        setImportResults(data);
        setStep(4);
      }
    } catch (err) {
      setImportError(err.message || 'Network error');
    } finally {
      setImporting(false);
    }
  };

  if (infoLoading) {
    return (
      <div className="import-modal-overlay">
        <div className="import-modal">
          <div className="import-modal-loading">
            <Loader2 className="spin" size={32} />
            <p>Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!hasImport) {
    return (
      <div className="import-modal-overlay" onClick={onClose}>
        <div className="import-modal import-modal-small" onClick={e => e.stopPropagation()}>
          <div className="import-modal-header">
            <h2>Import Teachers</h2>
            <button className="import-modal-close" onClick={onClose}><X size={20} /></button>
          </div>
          <div className="import-upgrade-prompt">
            <AlertCircle size={48} />
            <h3>Feature Not Available</h3>
            <p>XLSX teacher import is available on Standard and Premium plans. Upgrade your subscription to access this feature.</p>
            <button className="import-btn-secondary" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="import-modal-overlay" onClick={onClose}>
      <div className="import-modal" onClick={e => e.stopPropagation()}>
        <div className="import-modal-header">
          <h2>Import Teachers via XLSX</h2>
          <button className="import-modal-close" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="import-steps">
          {['Configure', 'Upload', 'Preview', 'Results'].map((label, i) => (
            <div key={i} className={`import-step ${step === i + 1 ? 'active' : ''} ${step > i + 1 ? 'completed' : ''}`}>
              <span className="import-step-num">{step > i + 1 ? <CheckCircle size={16} /> : i + 1}</span>
              <span className="import-step-label">{label}</span>
            </div>
          ))}
        </div>

        <div className="import-modal-body">

          {step === 1 && (
            <div className="import-step-content">
              <h3>Configure Import Settings</h3>
              <p className="import-step-desc">Choose how usernames will be assigned for the imported teachers.</p>
              {maxImportRows > 0 && (
                <div className="import-limit-notice">
                  <Info size={16} />
                  <span>Your plan allows up to <strong>{maxImportRows} teachers</strong> per import.</span>
                </div>
              )}

              <div className="import-form-group">
                <label>Username Generation</label>
                <div className="import-radio-group">
                  <label className="import-radio">
                    <input type="radio" checked={usernameMode === 'auto'} onChange={() => setUsernameMode('auto')} />
                    <span>Auto-generate</span>
                    <small>Format: firstname.lastname (e.g. jane.smith)</small>
                  </label>
                  <label className="import-radio">
                    <input type="radio" checked={usernameMode === 'xlsx'} onChange={() => setUsernameMode('xlsx')} />
                    <span>From XLSX column</span>
                    <small>Include a "username" column in your file</small>
                  </label>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="import-step-content">
              <h3>Prepare & Upload Your File</h3>

              <div className="import-instructions">
                <div className="import-instruction-section">
                  <h4><Info size={16} /> Required Columns</h4>
                  <div className="import-columns-list">
                    <span className="import-col required">first_name</span>
                    <span className="import-col required">last_name</span>
                    <span className="import-col required">email</span>
                    <span className="import-col required">gender</span>
                    {usernameMode === 'xlsx' && <span className="import-col required">username</span>}
                  </div>
                </div>

                <div className="import-instruction-section">
                  <h4>Optional Columns</h4>
                  <div className="import-columns-list">
                    <span className="import-col optional">phone_number</span>
                    <span className="import-col optional">middle_name</span>
                    <span className="import-col optional">date_of_birth</span>
                  </div>
                </div>

                <div className="import-instruction-section">
                  <h4><AlertCircle size={16} /> Gender Values</h4>
                  <p>Must be exactly: <code>Male</code> or <code>Female</code></p>
                </div>

                <div className="import-instruction-section">
                  <h4>Date of Birth Format</h4>
                  <p>If included, use: <code>YYYY-MM-DD</code> (e.g. 1985-03-20)</p>
                </div>
              </div>

              <button className="import-btn-template" onClick={handleDownloadTemplate}>
                <Download size={16} />
                Download Template
              </button>

              <div
                className={`import-dropzone ${dragOver ? 'dragover' : ''} ${file ? 'has-file' : ''}`}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleFileDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileSelect}
                  hidden
                />
                {file ? (
                  <div className="import-file-info">
                    <FileSpreadsheet size={32} />
                    <span>{file.name}</span>
                    <small>{(file.size / 1024).toFixed(1)} KB</small>
                    <button className="import-remove-file" onClick={e => { e.stopPropagation(); setFile(null); }}>
                      <X size={16} /> Remove
                    </button>
                  </div>
                ) : (
                  <div className="import-dropzone-content">
                    <Upload size={32} />
                    <p>Drag and drop your XLSX file here</p>
                    <small>or click to browse</small>
                  </div>
                )}
              </div>

              {validationError && (
                <div className="import-error-msg">
                  <AlertCircle size={16} />
                  <span>{validationError}</span>
                </div>
              )}
            </div>
          )}

          {step === 3 && validationResults && (
            <div className="import-step-content">
              <h3>Review Import Preview</h3>

              <div className="import-summary">
                <div className="import-summary-item success">
                  <CheckCircle size={20} />
                  <span><strong>{validationResults.valid_count}</strong> teachers ready to import</span>
                </div>
                {validationResults.error_count > 0 && (
                  <div className="import-summary-item error">
                    <XCircle size={20} />
                    <span><strong>{validationResults.error_count}</strong> rows with errors (will be skipped)</span>
                  </div>
                )}
              </div>

              <div className="import-preview-table-wrapper">
                <table className="import-preview-table">
                  <thead>
                    <tr>
                      <th>Row</th>
                      <th>Status</th>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Gender</th>
                      <th>Username</th>
                      <th>Phone</th>
                      <th>Errors</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validationResults.results.map((r, i) => (
                      <tr key={i} className={r.valid ? 'row-valid' : 'row-error'}>
                        <td>{r.row}</td>
                        <td>
                          {r.valid
                            ? <CheckCircle size={16} className="icon-success" />
                            : <XCircle size={16} className="icon-error" />}
                        </td>
                        <td>{r.first_name} {r.last_name}</td>
                        <td>{r.email}</td>
                        <td>{r.gender}</td>
                        <td>{r.username}</td>
                        <td>{r.phone_number || '—'}</td>
                        <td className="import-errors-cell">
                          {r.errors.length > 0
                            ? r.errors.map((e, j) => <span key={j} className="import-error-tag">{e}</span>)
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {importError && (
                <div className="import-error-msg">
                  <AlertCircle size={16} />
                  <span>{importError}</span>
                </div>
              )}
            </div>
          )}

          {step === 4 && importResults && (
            <div className="import-step-content">
              <h3>Import Complete</h3>

              <div className="import-results-summary">
                <div className="import-result-card success">
                  <CheckCircle size={32} />
                  <h4>{importResults.created_count}</h4>
                  <p>Teachers Created</p>
                </div>
                {importResults.failed_count > 0 && (
                  <div className="import-result-card error">
                    <XCircle size={32} />
                    <h4>{importResults.failed_count}</h4>
                    <p>Failed</p>
                  </div>
                )}
              </div>

              {importResults.created_count > 0 && (
                <p className="import-results-note">
                  Verification emails have been sent to all created teachers. They will need to verify their email and set up a password before logging in.
                </p>
              )}

              {importResults.failed && importResults.failed.length > 0 && (
                <div className="import-failed-list">
                  <h4>Failed Rows</h4>
                  {importResults.failed.map((f, i) => (
                    <div key={i} className="import-failed-row">
                      <span>Row {f.row}:</span>
                      {f.errors.map((e, j) => <span key={j} className="import-error-tag">{e}</span>)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="import-modal-footer">
          {step === 1 && (
            <>
              <button className="import-btn-secondary" onClick={onClose}>Cancel</button>
              <button className="import-btn-primary" onClick={() => setStep(2)}>
                Next <ChevronRight size={16} />
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <button className="import-btn-secondary" onClick={() => { setStep(1); setFile(null); setValidationError(''); }}>
                <ChevronLeft size={16} /> Back
              </button>
              <button
                className="import-btn-primary"
                disabled={!file || validating}
                onClick={handleValidate}
              >
                {validating ? (
                  <><Loader2 className="spin" size={16} /> Validating...</>
                ) : (
                  <>Validate & Preview <ChevronRight size={16} /></>
                )}
              </button>
            </>
          )}

          {step === 3 && (
            <>
              <button
                className="import-btn-secondary"
                onClick={() => { setStep(2); setValidationResults(null); setFile(null); setImportError(''); }}
              >
                <ChevronLeft size={16} /> Re-upload
              </button>
              <button
                className="import-btn-primary"
                disabled={importing || !validationResults || validationResults.valid_count === 0}
                onClick={handleConfirmImport}
              >
                {importing ? (
                  <><Loader2 className="spin" size={16} /> Importing...</>
                ) : (
                  <>Confirm & Import {validationResults?.valid_count} Teachers</>
                )}
              </button>
            </>
          )}

          {step === 4 && (
            <button className="import-btn-primary" onClick={() => { onSuccess?.(); onClose(); }}>
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImportTeachersModal;
