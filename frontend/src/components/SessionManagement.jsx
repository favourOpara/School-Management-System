import React, { useState, useEffect } from 'react';
import API_BASE_URL from '../config';
import { useSchool } from '../contexts/SchoolContext';

import './SessionManagement.css';

const SessionManagement = () => {
  const { buildApiUrl } = useSchool();
  const [sessionInfo, setSessionInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showMoveTermDialog, setShowMoveTermDialog] = useState(false);
  const [showMoveSessionDialog, setShowMoveSessionDialog] = useState(false);
  const [showRevertDialog, setShowRevertDialog] = useState(false);
  const [moveOptions, setMoveOptions] = useState({
    copy_students: true,
    copy_teachers: true,
    copy_subjects: true,
    copy_fees: true,
    copy_grading_config: true
  });
  const [progressionData, setProgressionData] = useState(null);
  const [progressionLoading, setProgressionLoading] = useState(false);

  // Graduation email quota state
  const [gradEmailPreview, setGradEmailPreview] = useState(null);
  const [gradEmailPreviewLoading, setGradEmailPreviewLoading] = useState(false);
  const [graduationEmailMode, setGraduationEmailMode] = useState('send_all');

  // Result panel state (shown inside modal after move completes)
  const [sessionMoveResult, setSessionMoveResult] = useState(null);

  useEffect(() => {
    fetchSessionInfo();
  }, []);

  const fetchSessionInfo = async () => {
    try {
      const token = localStorage.getItem('accessToken');

      const response = await fetch(buildApiUrl('/schooladmin/session/info/'), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setSessionInfo(data);
      } else {
        setSessionInfo({
          current_term: 'Unknown',
          academic_year: 'N/A',
          can_move_to_next_term: false,
          can_move_to_next_session: false,
          can_revert: false
        });
      }
    } catch (error) {
      console.error('Error fetching session info:', error);
      setSessionInfo({
        current_term: 'Unknown',
        academic_year: 'N/A',
        can_move_to_next_term: false,
        can_move_to_next_session: false,
        can_revert: false
      });
    }
  };

  const fetchProgressionChain = async () => {
    setProgressionLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(buildApiUrl('/academics/classes/progression/'), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (response.ok) {
        const data = await response.json();
        setProgressionData(data);
      } else {
        setProgressionData(null);
      }
    } catch (error) {
      console.error('Error fetching progression chain:', error);
      setProgressionData(null);
    } finally {
      setProgressionLoading(false);
    }
  };

  const fetchGraduationEmailPreview = async () => {
    setGradEmailPreviewLoading(true);
    setGradEmailPreview(null);
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(buildApiUrl('/schooladmin/session/graduation-email-preview/'), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (response.ok) {
        const data = await response.json();
        setGradEmailPreview(data);
        // Default mode based on quota
        if (data.has_graduating_students && !data.quota_sufficient) {
          setGraduationEmailMode('send_now_queue_rest');
        } else {
          setGraduationEmailMode('send_all');
        }
      }
    } catch (error) {
      console.error('Error fetching graduation email preview:', error);
    } finally {
      setGradEmailPreviewLoading(false);
    }
  };

  const handleMoveToNextTerm = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(buildApiUrl('/schooladmin/session/move-to-next-term/'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(moveOptions)
      });

      const data = await response.json();

      if (response.ok) {
        alert(`Success! Moved to ${data.new_term} ${data.academic_year}`);
        setShowMoveTermDialog(false);
        fetchSessionInfo();
        window.location.reload();
      } else {
        alert(`Error: ${data.detail || 'Failed to move to next term'}`);
      }
    } catch (error) {
      console.error('Error moving to next term:', error);
      alert('An error occurred while moving to next term');
    } finally {
      setLoading(false);
    }
  };

  const handleMoveToNextSession = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(buildApiUrl('/schooladmin/session/move-to-next-session/'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...moveOptions,
          graduation_email_mode: graduationEmailMode,
        })
      });

      const data = await response.json();

      if (response.ok) {
        setSessionMoveResult({ success: true, data });
      } else {
        setSessionMoveResult({ success: false, message: data.detail || 'Failed to move to next session' });
      }
    } catch (error) {
      console.error('Error moving to next session:', error);
      setSessionMoveResult({ success: false, message: 'An error occurred while moving to next session' });
    } finally {
      setLoading(false);
    }
  };

  const handleRevertToPreviousSession = async () => {
    const confirmRevert = window.confirm(
      'Are you sure you want to revert to the previous session? This will DELETE all data in the current session!'
    );

    if (!confirmRevert) return;

    setLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(buildApiUrl('/schooladmin/session/revert/'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (response.ok) {
        alert(`Success! Reverted to ${data.term} ${data.academic_year}`);
        setShowRevertDialog(false);
        fetchSessionInfo();
        window.location.reload();
      } else {
        alert(`Error: ${data.detail || 'Failed to revert to previous session'}`);
      }
    } catch (error) {
      console.error('Error reverting to previous session:', error);
      alert('An error occurred while reverting to previous session');
    } finally {
      setLoading(false);
    }
  };

  const handleOptionChange = (option) => {
    setMoveOptions(prev => ({
      ...prev,
      [option]: !prev[option]
    }));
  };

  const openMoveSessionDialog = () => {
    setSessionMoveResult(null);
    setShowMoveSessionDialog(true);
    fetchProgressionChain();
    fetchGraduationEmailPreview();
  };

  const handleMoveSessionClose = () => {
    setShowMoveSessionDialog(false);
    setSessionMoveResult(null);
    setGradEmailPreview(null);
  };

  if (!sessionInfo) {
    return <div className="session-management-loading">Loading...</div>;
  }

  if (sessionInfo.academic_year === 'N/A') {
    return <div className="session-management-error">No active session configured</div>;
  }

  // ── Graduation Email Panel ────────────────────────────────────────────────
  const renderGraduationEmailPanel = () => {
    if (gradEmailPreviewLoading) {
      return (
        <div style={{ background: '#f5f5f5', borderRadius: 8, padding: '12px 16px', marginBottom: 4, fontSize: '0.85rem', color: '#666' }}>
          Checking graduation email quota...
        </div>
      );
    }

    if (!gradEmailPreview || !gradEmailPreview.has_graduating_students) {
      return null;
    }

    const { graduating_count, graduating_class_names, emails_needed, quota_remaining, quota_sufficient, can_send_now, deferred_count } = gradEmailPreview;

    const classLabel = graduating_class_names.length > 0
      ? graduating_class_names.join(', ')
      : 'graduating class';

    if (quota_sufficient) {
      return (
        <div style={{
          background: '#e8f5e9',
          border: '1px solid #a5d6a7',
          borderRadius: 8,
          padding: '12px 16px',
          marginBottom: 4,
        }}>
          <div style={{ fontWeight: 600, color: '#2e7d32', marginBottom: 4, fontSize: '0.9rem' }}>
            Graduation Emails Will Be Sent
          </div>
          <div style={{ fontSize: '0.85rem', color: '#388e3c', lineHeight: 1.5 }}>
            {graduating_count} student{graduating_count !== 1 ? 's' : ''} in <strong>{classLabel}</strong> will
            graduate. <strong>{emails_needed}</strong> graduation email{emails_needed !== 1 ? 's' : ''} will be
            sent to students and their parents automatically.
            {quota_remaining !== -1 && (
              <span> ({quota_remaining} emails remaining in today&apos;s quota.)</span>
            )}
          </div>
        </div>
      );
    }

    // Quota insufficient — present choice
    return (
      <div style={{
        background: '#fff8e1',
        border: '1px solid #ffcc80',
        borderRadius: 8,
        padding: '14px 16px',
        marginBottom: 4,
      }}>
        <div style={{ fontWeight: 600, color: '#e65100', marginBottom: 6, fontSize: '0.9rem' }}>
          Email Quota Insufficient
        </div>
        <div style={{ fontSize: '0.85rem', color: '#5d4037', lineHeight: 1.5, marginBottom: 10 }}>
          {graduating_count} student{graduating_count !== 1 ? 's' : ''} in <strong>{classLabel}</strong> will
          graduate, requiring <strong>{emails_needed}</strong> graduation emails. Your quota today only
          allows <strong>{can_send_now}</strong> more email{can_send_now !== 1 ? 's' : ''}.
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{
            display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer',
            background: graduationEmailMode === 'send_now_queue_rest' ? '#fff3e0' : 'transparent',
            borderRadius: 6, padding: '8px 10px',
            border: graduationEmailMode === 'send_now_queue_rest' ? '1.5px solid #ffb74d' : '1.5px solid transparent',
          }}>
            <input
              type="radio"
              name="graduation_email_mode"
              value="send_now_queue_rest"
              checked={graduationEmailMode === 'send_now_queue_rest'}
              onChange={() => setGraduationEmailMode('send_now_queue_rest')}
              style={{ marginTop: 2 }}
            />
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#bf360c' }}>
                Send {can_send_now} now, queue {deferred_count} for tomorrow
              </div>
              <div style={{ fontSize: '0.8rem', color: '#795548', marginTop: 2 }}>
                The first {can_send_now} emails will be sent immediately. The remaining {deferred_count} will be queued and sent automatically when your quota resets.
              </div>
            </div>
          </label>

          <label style={{
            display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer',
            background: graduationEmailMode === 'queue_all' ? '#fff3e0' : 'transparent',
            borderRadius: 6, padding: '8px 10px',
            border: graduationEmailMode === 'queue_all' ? '1.5px solid #ffb74d' : '1.5px solid transparent',
          }}>
            <input
              type="radio"
              name="graduation_email_mode"
              value="queue_all"
              checked={graduationEmailMode === 'queue_all'}
              onChange={() => setGraduationEmailMode('queue_all')}
              style={{ marginTop: 2 }}
            />
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#bf360c' }}>
                Wait — send all {emails_needed} emails when quota resets
              </div>
              <div style={{ fontSize: '0.8rem', color: '#795548', marginTop: 2 }}>
                No graduation emails sent now. All {emails_needed} emails will be queued and sent the next day once your daily quota resets.
              </div>
            </div>
          </label>
        </div>
      </div>
    );
  };

  // ── Result Panel ──────────────────────────────────────────────────────────
  const renderResultPanel = () => {
    if (!sessionMoveResult) return null;

    if (!sessionMoveResult.success) {
      return (
        <div style={{ padding: '0 4px' }}>
          <div style={{
            background: '#ffebee', border: '1px solid #ef9a9a', borderRadius: 8,
            padding: '16px', marginBottom: 16,
          }}>
            <div style={{ fontWeight: 700, color: '#c62828', marginBottom: 6 }}>Move Failed</div>
            <div style={{ fontSize: '0.9rem', color: '#b71c1c' }}>{sessionMoveResult.message}</div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="session-modal-btn session-modal-btn-cancel" onClick={handleMoveSessionClose}>
              Close
            </button>
          </div>
        </div>
      );
    }

    const { data } = sessionMoveResult;
    const emailSummary = data.graduation_email_summary || {};
    const hasGraduates = data.graduated_students_count > 0;

    return (
      <div style={{ padding: '0 4px' }}>
        {/* Success banner */}
        <div style={{
          background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 8,
          padding: '14px 16px', marginBottom: 12,
        }}>
          <div style={{ fontWeight: 700, color: '#2e7d32', fontSize: '1rem' }}>
            Session moved successfully!
          </div>
          <div style={{ fontSize: '0.875rem', color: '#388e3c', marginTop: 4 }}>
            Now in <strong>{data.new_term} {data.academic_year}</strong>.
          </div>
        </div>

        {/* Graduation email summary */}
        {hasGraduates && (
          <div style={{
            background: '#f5f5f5', border: '1px solid #e0e0e0', borderRadius: 8,
            padding: '14px 16px', marginBottom: 12,
          }}>
            <div style={{ fontWeight: 600, color: '#333', marginBottom: 8, fontSize: '0.9rem' }}>
              Graduation Summary — {data.graduated_students_count} student{data.graduated_students_count !== 1 ? 's' : ''} graduated
            </div>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
              {emailSummary.sent_count > 0 && (
                <div style={{ background: '#e8f5e9', border: '1px solid #c8e6c9', borderRadius: 6, padding: '6px 12px', fontSize: '0.82rem', color: '#2e7d32' }}>
                  ✓ {emailSummary.sent_count} email{emailSummary.sent_count !== 1 ? 's' : ''} sent
                </div>
              )}
              {emailSummary.deferred_count > 0 && (
                <div style={{ background: '#fff8e1', border: '1px solid #ffe082', borderRadius: 6, padding: '6px 12px', fontSize: '0.82rem', color: '#f57f17' }}>
                  ⏳ {emailSummary.deferred_count} queued for tomorrow
                </div>
              )}
              {emailSummary.failed_count > 0 && (
                <div style={{ background: '#ffebee', border: '1px solid #ffcdd2', borderRadius: 6, padding: '6px 12px', fontSize: '0.82rem', color: '#c62828' }}>
                  ✗ {emailSummary.failed_count} failed
                </div>
              )}
            </div>

            {emailSummary.failed_count > 0 && emailSummary.failed_names && emailSummary.failed_names.length > 0 && (
              <div style={{ fontSize: '0.8rem', color: '#c62828', marginBottom: 6 }}>
                <strong>Failed:</strong> {emailSummary.failed_names.join(', ')}
              </div>
            )}

            {emailSummary.deferred_count > 0 && emailSummary.deferred_names && emailSummary.deferred_names.length > 0 && (
              <div style={{ fontSize: '0.8rem', color: '#8d6e63' }}>
                <strong>Queued:</strong>{' '}
                {emailSummary.deferred_names.slice(0, 8).join(', ')}
                {emailSummary.deferred_names.length > 8 ? ` and ${emailSummary.deferred_names.length - 8} more...` : ''}
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            className="session-modal-btn session-modal-btn-confirm"
            onClick={() => window.location.reload()}
          >
            Continue
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="session-management">
      <span className="session-info-text">
        {sessionInfo.academic_year} - {sessionInfo.current_term}
      </span>

      <div className="session-buttons">
        {sessionInfo.can_move_to_next_term && (
          <button
            className="session-btn session-btn-primary"
            onClick={() => setShowMoveTermDialog(true)}
            disabled={loading}
          >
            Move to Next Term
          </button>
        )}

        <button
          className={`session-btn session-btn-success ${!sessionInfo.can_move_to_next_session ? 'session-btn-disabled' : ''}`}
          onClick={openMoveSessionDialog}
          disabled={loading || !sessionInfo.can_move_to_next_session}
        >
          Move to New Session
        </button>

        {sessionInfo.can_revert && (
          <button
            className="session-btn session-btn-danger"
            onClick={() => setShowRevertDialog(true)}
            disabled={loading}
          >
            Revert to Previous
          </button>
        )}
      </div>

      {/* Move to Next Term Dialog */}
      {showMoveTermDialog && (
        <div className="session-modal-overlay" onClick={() => setShowMoveTermDialog(false)}>
          <div className="session-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="session-modal-title">Move to Next Term</h3>
            <p className="session-modal-description">
              Select what data to copy to the next term:
            </p>

            <div className="session-options">
              <label className="session-option">
                <input
                  type="checkbox"
                  checked={moveOptions.copy_students}
                  onChange={() => handleOptionChange('copy_students')}
                />
                <span>Copy Students</span>
              </label>

              <label className="session-option">
                <input
                  type="checkbox"
                  checked={moveOptions.copy_teachers}
                  onChange={() => handleOptionChange('copy_teachers')}
                />
                <span>Copy Teachers</span>
              </label>

              <label className="session-option">
                <input
                  type="checkbox"
                  checked={moveOptions.copy_subjects}
                  onChange={() => handleOptionChange('copy_subjects')}
                />
                <span>Copy Subjects</span>
              </label>

              <label className="session-option">
                <input
                  type="checkbox"
                  checked={moveOptions.copy_fees}
                  onChange={() => handleOptionChange('copy_fees')}
                />
                <span>Copy Fees (amounts only)</span>
              </label>

              <label className="session-option">
                <input
                  type="checkbox"
                  checked={moveOptions.copy_grading_config}
                  onChange={() => handleOptionChange('copy_grading_config')}
                />
                <span>Copy Grading Configuration</span>
              </label>
            </div>

            <p className="session-modal-warning">
              ⚠️ Grades, results, attendance, and calendar events will NOT be copied.
            </p>

            <div className="session-modal-actions">
              <button
                className="session-modal-btn session-modal-btn-cancel"
                onClick={() => setShowMoveTermDialog(false)}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                className="session-modal-btn session-modal-btn-confirm"
                onClick={handleMoveToNextTerm}
                disabled={loading}
              >
                {loading ? 'Processing...' : 'Confirm Move'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Move to New Session Dialog */}
      {showMoveSessionDialog && (
        <div className="session-modal-overlay" onClick={sessionMoveResult ? undefined : handleMoveSessionClose}>
          <div className="session-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="session-modal-title">Move to New Academic Session</h3>

            {/* Result panel replaces the form after the move completes */}
            {sessionMoveResult ? (
              renderResultPanel()
            ) : (
              <>
                <p className="session-modal-description">
                  Select what data to copy to the new academic year:
                </p>

                <div className="session-options">
                  <label className="session-option">
                    <input
                      type="checkbox"
                      checked={moveOptions.copy_students}
                      onChange={() => handleOptionChange('copy_students')}
                    />
                    <span>Copy Students</span>
                  </label>

                  <label className="session-option">
                    <input
                      type="checkbox"
                      checked={moveOptions.copy_teachers}
                      onChange={() => handleOptionChange('copy_teachers')}
                    />
                    <span>Copy Teachers</span>
                  </label>

                  <label className="session-option">
                    <input
                      type="checkbox"
                      checked={moveOptions.copy_subjects}
                      onChange={() => handleOptionChange('copy_subjects')}
                    />
                    <span>Copy Subjects</span>
                  </label>

                  <label className="session-option">
                    <input
                      type="checkbox"
                      checked={moveOptions.copy_fees}
                      onChange={() => handleOptionChange('copy_fees')}
                    />
                    <span>Copy Fees (amounts only)</span>
                  </label>

                  <label className="session-option">
                    <input
                      type="checkbox"
                      checked={moveOptions.copy_grading_config}
                      onChange={() => handleOptionChange('copy_grading_config')}
                    />
                    <span>Copy Grading Configuration</span>
                  </label>
                </div>

                {/* Student progression chain */}
                {moveOptions.copy_students && (
                  <div style={{
                    background: '#f0f7ff',
                    border: '1px solid #bbdefb',
                    borderRadius: '8px',
                    padding: '14px',
                    marginBottom: '4px'
                  }}>
                    <div style={{
                      fontSize: '0.9rem',
                      fontWeight: 600,
                      color: '#1565c0',
                      marginBottom: '10px'
                    }}>
                      Student Promotions:
                    </div>
                    {progressionLoading ? (
                      <div style={{ fontSize: '0.85rem', color: '#666' }}>Loading class progression...</div>
                    ) : progressionData && progressionData.chains && progressionData.chains.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {progressionData.chains.map((chain, idx) => (
                          <div key={idx} style={{
                            fontSize: '0.85rem',
                            color: '#333',
                            fontWeight: 500,
                            display: 'flex',
                            flexWrap: 'wrap',
                            alignItems: 'center',
                            gap: '4px',
                            lineHeight: '1.6'
                          }}>
                            {chain.map((cls, clsIdx) => (
                              <React.Fragment key={cls.id}>
                                <span style={{
                                  background: cls.is_final_class ? '#e8f5e9' : '#fff',
                                  border: cls.is_final_class ? '1px solid #a5d6a7' : '1px solid #e0e0e0',
                                  borderRadius: '4px',
                                  padding: '2px 8px'
                                }}>
                                  {cls.name}
                                </span>
                                {clsIdx < chain.length - 1 && (
                                  <span style={{ color: '#90a4ae', margin: '0 2px' }}>{'\u2192'}</span>
                                )}
                                {cls.is_final_class && (
                                  <>
                                    <span style={{ color: '#90a4ae', margin: '0 2px' }}>{'\u2192'}</span>
                                    <span style={{
                                      background: '#fff3e0',
                                      border: '1px solid #ffcc80',
                                      borderRadius: '4px',
                                      padding: '2px 8px',
                                      fontWeight: 600,
                                      color: '#e65100'
                                    }}>
                                      GRADUATION
                                    </span>
                                  </>
                                )}
                              </React.Fragment>
                            ))}
                          </div>
                        ))}
                        {progressionData.unconfigured && progressionData.unconfigured.length > 0 && (
                          <div style={{
                            fontSize: '0.8rem',
                            color: '#888',
                            fontStyle: 'italic',
                            marginTop: '4px'
                          }}>
                            Unconfigured (students stay in same class):{' '}
                            {progressionData.unconfigured.map(cls => cls.name).join(', ')}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.85rem', color: '#888' }}>
                        No class progression configured. Students will remain in their current classes.
                      </div>
                    )}
                  </div>
                )}

                {/* Graduation email quota panel */}
                {renderGraduationEmailPanel()}

                <p className="session-modal-warning">
                  ⚠️ Grades, results, attendance, and calendar events will NOT be copied.
                </p>

                <div className="session-modal-actions">
                  <button
                    className="session-modal-btn session-modal-btn-cancel"
                    onClick={handleMoveSessionClose}
                    disabled={loading}
                  >
                    Cancel
                  </button>
                  <button
                    className="session-modal-btn session-modal-btn-confirm"
                    onClick={handleMoveToNextSession}
                    disabled={loading}
                  >
                    {loading ? 'Processing...' : 'Confirm Move'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Revert Dialog */}
      {showRevertDialog && (
        <div className="session-modal-overlay" onClick={() => setShowRevertDialog(false)}>
          <div className="session-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="session-modal-title">Revert to Previous Session</h3>
            <p className="session-modal-description">
              Are you sure you want to revert to the previous session?
            </p>

            <p className="session-modal-warning">
              ⚠️ This will PERMANENTLY DELETE all data in the current session including classes, students, grades, and attendance!
            </p>

            <div className="session-modal-actions">
              <button
                className="session-modal-btn session-modal-btn-cancel"
                onClick={() => setShowRevertDialog(false)}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                className="session-modal-btn session-modal-btn-danger"
                onClick={handleRevertToPreviousSession}
                disabled={loading}
              >
                {loading ? 'Processing...' : 'Confirm Revert'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SessionManagement;
