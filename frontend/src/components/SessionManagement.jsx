import React, { useState, useEffect } from 'react';
import './SessionManagement.css';

const SessionManagement = () => {
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

  useEffect(() => {
    fetchSessionInfo();
  }, []);

  const fetchSessionInfo = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      console.log('Fetching session info with token:', token ? 'exists' : 'missing');

      const response = await fetch('http://127.0.0.1:8000/api/schooladmin/session/info/', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('Session info response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('Session info data:', data);
        setSessionInfo(data);
      } else {
        const errorData = await response.text();
        console.error('Failed to fetch session info:', response.status, errorData);
        // Set a default state to show buttons are unavailable
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
      // Set a default state to show buttons are unavailable
      setSessionInfo({
        current_term: 'Unknown',
        academic_year: 'N/A',
        can_move_to_next_term: false,
        can_move_to_next_session: false,
        can_revert: false
      });
    }
  };

  const handleMoveToNextTerm = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch('http://127.0.0.1:8000/api/schooladmin/session/move-to-next-term/', {
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
        // Reload page to refresh all data
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
      const response = await fetch('http://127.0.0.1:8000/api/schooladmin/session/move-to-next-session/', {
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
        setShowMoveSessionDialog(false);
        fetchSessionInfo();
        // Reload page to refresh all data
        window.location.reload();
      } else {
        alert(`Error: ${data.detail || 'Failed to move to next session'}`);
      }
    } catch (error) {
      console.error('Error moving to next session:', error);
      alert('An error occurred while moving to next session');
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
      const response = await fetch('http://127.0.0.1:8000/api/schooladmin/session/revert/', {
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
        // Reload page to refresh all data
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

  if (!sessionInfo) {
    return <div className="session-management-loading">Loading...</div>;
  }

  // Don't show if no valid session info
  if (sessionInfo.academic_year === 'N/A') {
    return <div className="session-management-error">No active session configured</div>;
  }

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
          onClick={() => setShowMoveSessionDialog(true)}
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

      {/* Move to Next Session Dialog */}
      {showMoveSessionDialog && (
        <div className="session-modal-overlay" onClick={() => setShowMoveSessionDialog(false)}>
          <div className="session-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="session-modal-title">Move to New Academic Session</h3>
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

            <p className="session-modal-warning">
              ⚠️ Grades, results, attendance, and calendar events will NOT be copied.
            </p>

            <div className="session-modal-actions">
              <button
                className="session-modal-btn session-modal-btn-cancel"
                onClick={() => setShowMoveSessionDialog(false)}
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
