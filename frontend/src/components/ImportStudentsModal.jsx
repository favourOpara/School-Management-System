import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSchool } from '../contexts/SchoolContext';
import {
  Upload, Download, FileSpreadsheet, CheckCircle, XCircle, AlertCircle,
  ChevronRight, ChevronLeft, Loader2, X, Info
} from 'lucide-react';
import * as XLSX from 'xlsx';
import './ImportStudentsModal.css';

const TERMS = ['First Term', 'Second Term', 'Third Term'];

const ImportStudentsModal = ({ onClose, onSuccess }) => {
  const { buildApiUrl } = useSchool();
  const token = localStorage.getItem('accessToken');
  const fileInputRef = useRef(null);

  // Step management
  const [step, setStep] = useState(1); // 1=configure, 2=instructions+upload, 3=preview, 4=results

  // Step 1: Config
  const [academicYears, setAcademicYears] = useState([]);
  const [academicYear, setAcademicYear] = useState('');
  const [term, setTerm] = useState('');
  const [usernameMode, setUsernameMode] = useState('auto');

  // Info from backend
  const [classes, setClasses] = useState([]);
  const [hasImport, setHasImport] = useState(false);
  const [maxImportRows, setMaxImportRows] = useState(0);
  const [infoLoading, setInfoLoading] = useState(true);

  // Step 2: Upload
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  // Step 3: Validation results
  const [validating, setValidating] = useState(false);
  const [validationResults, setValidationResults] = useState(null);
  const [validationError, setValidationError] = useState('');

  // Step 4: Import results
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState(null);
  const [importError, setImportError] = useState('');

  // Fetch info on mount
  useEffect(() => {
    const fetchInfo = async () => {
      try {
        const [infoRes, sessionsRes] = await Promise.all([
          fetch(buildApiUrl('/users/import-students/info/'), {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(buildApiUrl('/academics/sessions/'), {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        const infoData = await infoRes.json();
        const sessionsData = await sessionsRes.json();

        setHasImport(infoData.has_import);
        setMaxImportRows(infoData.max_import_rows || 0);
        setClasses(infoData.classes || []);

        const years = [...new Set(sessionsData.map(s => s.academic_year))];
        setAcademicYears(years);
      } catch (err) {
        console.error('Failed to fetch import info:', err);
      } finally {
        setInfoLoading(false);
      }
    };
    fetchInfo();
  }, [buildApiUrl, token]);

  const departmentClasses = classes.filter(c => c.has_departments);
  const nonDepartmentClasses = classes.filter(c => !c.has_departments);

  // Template download
  const handleDownloadTemplate = () => {
    const headers = ['first_name', 'last_name', 'email', 'gender', 'class'];
    if (usernameMode === 'xlsx') headers.push('username');
    headers.push('middle_name', 'phone_number', 'date_of_birth', 'department');

    const ws = XLSX.utils.aoa_to_sheet([headers]);
    // Set column widths
    ws['!cols'] = headers.map(() => ({ wch: 20 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Students');
    XLSX.writeFile(wb, 'student_import_template.xlsx');
  };

  // File handling
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

  // Validate
  const handleValidate = async () => {
    if (!file) return;
    setValidating(true);
    setValidationError('');
    setValidationResults(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('academic_year', academicYear);
    formData.append('term', term);
    formData.append('username_mode', usernameMode);

    try {
      const res = await fetch(buildApiUrl('/users/import-students/validate/'), {
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

  // Confirm import
  const handleConfirmImport = async () => {
    if (!file) return;
    setImporting(true);
    setImportError('');
    setImportResults(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('academic_year', academicYear);
    formData.append('term', term);
    formData.append('username_mode', usernameMode);

    try {
      const res = await fetch(buildApiUrl('/users/import-students/confirm/'), {
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
            <h2>Import Students</h2>
            <button className="import-modal-close" onClick={onClose}><X size={20} /></button>
          </div>
          <div className="import-upgrade-prompt">
            <AlertCircle size={48} />
            <h3>Feature Not Available</h3>
            <p>XLSX student import is available on Standard and Premium plans. Upgrade your subscription to access this feature.</p>
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
          <h2>Import Students via XLSX</h2>
          <button className="import-modal-close" onClick={onClose}><X size={20} /></button>
        </div>

        {/* Step Indicator */}
        <div className="import-steps">
          {['Configure', 'Upload', 'Preview', 'Results'].map((label, i) => (
            <div key={i} className={`import-step ${step === i + 1 ? 'active' : ''} ${step > i + 1 ? 'completed' : ''}`}>
              <span className="import-step-num">{step > i + 1 ? <CheckCircle size={16} /> : i + 1}</span>
              <span className="import-step-label">{label}</span>
            </div>
          ))}
        </div>

        <div className="import-modal-body">

          {/* STEP 1: Configure */}
          {step === 1 && (
            <div className="import-step-content">
              <h3>Configure Import Settings</h3>
              <p className="import-step-desc">Set the academic year and term for the students being imported. This determines when they join the platform.</p>
              {maxImportRows > 0 && (
                <div className="import-limit-notice">
                  <Info size={16} />
                  <span>Your plan allows up to <strong>{maxImportRows} students</strong> per import.</span>
                </div>
              )}

              <div className="import-form-group">
                <label>Academic Year <span className="required">*</span></label>
                <select value={academicYear} onChange={e => setAcademicYear(e.target.value)}>
                  <option value="">Select Academic Year</option>
                  {academicYears.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>

              <div className="import-form-group">
                <label>Term <span className="required">*</span></label>
                <select value={term} onChange={e => setTerm(e.target.value)}>
                  <option value="">Select Term</option>
                  {TERMS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div className="import-form-group">
                <label>Username Generation</label>
                <div className="import-radio-group">
                  <label className="import-radio">
                    <input type="radio" checked={usernameMode === 'auto'} onChange={() => setUsernameMode('auto')} />
                    <span>Auto-generate</span>
                    <small>Format: firstname.lastname (e.g. john.doe)</small>
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

          {/* STEP 2: Instructions & Upload */}
          {step === 2 && (
            <div className="import-step-content">
              <h3>Prepare & Upload Your File</h3>

              {/* Instructions */}
              <div className="import-instructions">
                <div className="import-instruction-section">
                  <h4><Info size={16} /> Required Columns</h4>
                  <div className="import-columns-list">
                    <span className="import-col required">first_name</span>
                    <span className="import-col required">last_name</span>
                    <span className="import-col required">email</span>
                    <span className="import-col required">gender</span>
                    <span className="import-col required">class</span>
                    {usernameMode === 'xlsx' && <span className="import-col required">username</span>}
                  </div>
                </div>

                <div className="import-instruction-section">
                  <h4>Optional Columns</h4>
                  <div className="import-columns-list">
                    <span className="import-col optional">middle_name</span>
                    <span className="import-col optional">phone_number</span>
                    <span className="import-col optional">date_of_birth</span>
                    <span className="import-col optional">department</span>
                  </div>
                </div>

                <div className="import-instruction-section">
                  <h4><AlertCircle size={16} /> Gender Values</h4>
                  <p>Must be exactly: <code>Male</code> or <code>Female</code></p>
                </div>

                <div className="import-instruction-section">
                  <h4><AlertCircle size={16} /> Class Names (use exact spelling)</h4>
                  <div className="import-class-list">
                    {classes.map(c => (
                      <span key={c.id} className={`import-class-tag ${c.has_departments ? 'dept' : ''}`}>
                        {c.name}
                      </span>
                    ))}
                  </div>
                  {classes.length === 0 && <p className="import-warning">No classes found. Please create classes first.</p>}
                </div>

                {departmentClasses.length > 0 && (
                  <div className="import-instruction-section">
                    <h4><AlertCircle size={16} /> Department Required Classes</h4>
                    <p>Students in these classes <strong>must</strong> have a department column:</p>
                    <div className="import-class-list">
                      {departmentClasses.map(c => (
                        <span key={c.id} className="import-class-tag dept">{c.name}</span>
                      ))}
                    </div>
                    <p>Department must be exactly: <code>Science</code>, <code>Arts</code>, or <code>Commercial</code></p>
                  </div>
                )}

                <div className="import-instruction-section">
                  <h4>Date of Birth Format</h4>
                  <p>If included, use: <code>YYYY-MM-DD</code> (e.g. 2008-05-15)</p>
                </div>
              </div>

              <button className="import-btn-template" onClick={handleDownloadTemplate}>
                <Download size={16} />
                Download Template
              </button>

              {/* Upload Area */}
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

          {/* STEP 3: Preview */}
          {step === 3 && validationResults && (
            <div className="import-step-content">
              <h3>Review Import Preview</h3>

              <div className="import-summary">
                <div className="import-summary-item success">
                  <CheckCircle size={20} />
                  <span><strong>{validationResults.valid_count}</strong> students ready to import</span>
                </div>
                {validationResults.error_count > 0 && (
                  <div className="import-summary-item error">
                    <XCircle size={20} />
                    <span><strong>{validationResults.error_count}</strong> rows with errors (will be skipped)</span>
                  </div>
                )}
                <div className="import-summary-item info">
                  <Info size={20} />
                  <span>Academic Year: <strong>{academicYear}</strong> | Term: <strong>{term}</strong></span>
                </div>
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
                      <th>Class</th>
                      <th>Username</th>
                      <th>Department</th>
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
                        <td>{r.class}</td>
                        <td>{r.username}</td>
                        <td>{r.department || '-'}</td>
                        <td className="import-errors-cell">
                          {r.errors.length > 0
                            ? r.errors.map((e, j) => <span key={j} className="import-error-tag">{e}</span>)
                            : '-'}
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

          {/* STEP 4: Results */}
          {step === 4 && importResults && (
            <div className="import-step-content">
              <h3>Import Complete</h3>

              <div className="import-results-summary">
                <div className="import-result-card success">
                  <CheckCircle size={32} />
                  <h4>{importResults.created_count}</h4>
                  <p>Students Created</p>
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
                  Verification emails have been sent to all created students. They will need to verify their email and set up a password before logging in.
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

        {/* Footer */}
        <div className="import-modal-footer">
          {step === 1 && (
            <>
              <button className="import-btn-secondary" onClick={onClose}>Cancel</button>
              <button
                className="import-btn-primary"
                disabled={!academicYear || !term}
                onClick={() => setStep(2)}
              >
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
                  <>Confirm & Import {validationResults?.valid_count} Students</>
                )}
              </button>
            </>
          )}

          {step === 4 && (
            <button
              className="import-btn-primary"
              onClick={() => { onSuccess?.(); onClose(); }}
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImportStudentsModal;
