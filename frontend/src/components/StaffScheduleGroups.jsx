import React, { useState, useEffect, useCallback } from 'react';
import { useSchool } from '../contexts/SchoolContext';
import { Clock, Users, Trash2, Plus, Calendar } from 'lucide-react';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const StaffScheduleGroups = () => {
  const { buildApiUrl } = useSchool();
  const token = localStorage.getItem('accessToken');

  const [groups, setGroups] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [unassigned, setUnassigned] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state for creating a new group
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formDays, setFormDays] = useState([0, 1, 2, 3, 4]);
  const [formStartTime, setFormStartTime] = useState('08:00');
  const [formEndTime, setFormEndTime] = useState('16:00');
  const [formGrace, setFormGrace] = useState(30);

  // Assignment form
  const [assignGroupId, setAssignGroupId] = useState('');
  const [assignTeacherId, setAssignTeacherId] = useState('');

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const fetchData = useCallback(async () => {
    try {
      const [groupsRes, assignRes, unassignedRes] = await Promise.all([
        fetch(buildApiUrl('/schooladmin/staff/schedule-groups/'), { headers }),
        fetch(buildApiUrl('/schooladmin/staff/assignments/'), { headers }),
        fetch(buildApiUrl('/schooladmin/staff/unassigned-teachers/'), { headers }),
      ]);

      if (groupsRes.ok) setGroups(await groupsRes.json());
      if (assignRes.ok) setAssignments(await assignRes.json());
      if (unassignedRes.ok) setUnassigned(await unassignedRes.json());
    } catch (err) {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [buildApiUrl, token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      const res = await fetch(buildApiUrl('/schooladmin/staff/schedule-groups/'), {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: formName,
          days: formDays,
          start_time: formStartTime,
          end_time: formEndTime,
          grace_period_minutes: formGrace,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess('Schedule group created');
        setShowForm(false);
        setFormName('');
        setFormDays([0, 1, 2, 3, 4]);
        setFormStartTime('08:00');
        setFormEndTime('16:00');
        setFormGrace(30);
        fetchData();
      } else {
        setError(data.error || 'Failed to create group');
      }
    } catch (err) {
      setError('Network error');
    }
  };

  const handleDeleteGroup = async (groupId) => {
    if (!window.confirm('Delete this schedule group? All assignments will be removed.')) return;
    try {
      const res = await fetch(buildApiUrl(`/schooladmin/staff/schedule-groups/${groupId}/`), {
        method: 'DELETE',
        headers,
      });
      if (res.ok) {
        setSuccess('Schedule group deleted');
        fetchData();
      }
    } catch (err) {
      setError('Failed to delete group');
    }
  };

  const handleAssign = async () => {
    if (!assignGroupId || !assignTeacherId) return;
    setError('');
    setSuccess('');

    try {
      const res = await fetch(buildApiUrl('/schooladmin/staff/assignments/'), {
        method: 'POST',
        headers,
        body: JSON.stringify({
          teacher_id: parseInt(assignTeacherId),
          schedule_group_id: parseInt(assignGroupId),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess('Teacher assigned');
        setAssignTeacherId('');
        setAssignGroupId('');
        fetchData();
      } else {
        setError(data.error || 'Failed to assign');
      }
    } catch (err) {
      setError('Network error');
    }
  };

  const handleRemoveAssignment = async (assignmentId) => {
    try {
      const res = await fetch(buildApiUrl(`/schooladmin/staff/assignments/${assignmentId}/`), {
        method: 'DELETE',
        headers,
      });
      if (res.ok) {
        setSuccess('Assignment removed');
        fetchData();
      }
    } catch (err) {
      setError('Failed to remove assignment');
    }
  };

  const toggleDay = (day) => {
    setFormDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort()
    );
  };

  if (loading) return <p>Loading...</p>;

  return (
    <div>
      {error && <div className="staff-alert staff-alert-error">{error}</div>}
      {success && <div className="staff-alert staff-alert-success">{success}</div>}

      {/* Create Group Button */}
      <div style={{ marginBottom: '1rem' }}>
        <button className="staff-btn staff-btn-primary" onClick={() => setShowForm(!showForm)}>
          <Plus size={16} /> {showForm ? 'Cancel' : 'Create Schedule Group'}
        </button>
      </div>

      {/* Create Group Form */}
      {showForm && (
        <form className="staff-form" onSubmit={handleCreateGroup}>
          <h3>New Schedule Group</h3>
          <div className="staff-form-row">
            <div className="staff-form-group">
              <label>Group Name</label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g., Full-time"
                required
              />
            </div>
          </div>
          <div className="staff-form-row">
            <div className="staff-form-group">
              <label>Work Days</label>
              <div className="days-picker">
                {DAY_LABELS.map((label, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className={`day-btn ${formDays.includes(idx) ? 'selected' : ''}`}
                    onClick={() => toggleDay(idx)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="staff-form-row">
            <div className="staff-form-group">
              <label>Start Time</label>
              <input
                type="time"
                value={formStartTime}
                onChange={(e) => setFormStartTime(e.target.value)}
                required
              />
            </div>
            <div className="staff-form-group">
              <label>End Time</label>
              <input
                type="time"
                value={formEndTime}
                onChange={(e) => setFormEndTime(e.target.value)}
                required
              />
            </div>
            <div className="staff-form-group">
              <label>Grace Period (mins)</label>
              <input
                type="number"
                value={formGrace}
                onChange={(e) => setFormGrace(parseInt(e.target.value) || 30)}
                min="5"
                max="120"
              />
            </div>
          </div>
          <button type="submit" className="staff-btn staff-btn-primary">
            Create Group
          </button>
        </form>
      )}

      {/* Schedule Groups List */}
      {groups.length === 0 ? (
        <div className="staff-empty-state">
          <Calendar size={48} />
          <p>No schedule groups yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="schedule-group-cards">
          {groups.map(group => (
            <div key={group.id} className="schedule-group-card">
              <div className="schedule-group-card-header">
                <h4>{group.name}</h4>
                <button
                  className="staff-btn staff-btn-danger"
                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                  onClick={() => handleDeleteGroup(group.id)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="schedule-group-card-details">
                <div className="detail-row">
                  <Calendar size={14} />
                  <span>{group.days.map(d => DAY_LABELS[d]).join(', ')}</span>
                </div>
                <div className="detail-row">
                  <Clock size={14} />
                  <span>{group.start_time} - {group.end_time}</span>
                </div>
                <div className="detail-row">
                  <Users size={14} />
                  <span>{group.teacher_count} teacher{group.teacher_count !== 1 ? 's' : ''} assigned</span>
                </div>
                <div className="detail-row">
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                    Grace: {group.grace_period_minutes} mins
                  </span>
                </div>
              </div>
              {/* Teachers in this group */}
              <div className="schedule-group-card-actions" style={{ flexDirection: 'column', gap: '0.25rem' }}>
                {assignments
                  .filter(a => a.schedule_group_id === group.id && a.is_active)
                  .map(a => (
                    <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8125rem' }}>
                      <span>{a.teacher_name}</span>
                      <button
                        className="staff-btn staff-btn-secondary"
                        style={{ padding: '0.125rem 0.375rem', fontSize: '0.7rem' }}
                        onClick={() => handleRemoveAssignment(a.id)}
                      >
                        Remove
                      </button>
                    </div>
                  ))
                }
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Assign Teacher to Group */}
      {groups.length > 0 && unassigned.length > 0 && (
        <div className="staff-form">
          <h3>Assign Teacher to Group</h3>
          <div className="staff-form-row" style={{ alignItems: 'flex-end' }}>
            <div className="staff-form-group">
              <label>Teacher</label>
              <select value={assignTeacherId} onChange={(e) => setAssignTeacherId(e.target.value)}>
                <option value="">Select teacher...</option>
                {unassigned.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div className="staff-form-group">
              <label>Schedule Group</label>
              <select value={assignGroupId} onChange={(e) => setAssignGroupId(e.target.value)}>
                <option value="">Select group...</option>
                {groups.filter(g => g.is_active).map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
            <button
              className="staff-btn staff-btn-primary"
              onClick={handleAssign}
              disabled={!assignGroupId || !assignTeacherId}
            >
              Assign
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffScheduleGroups;
