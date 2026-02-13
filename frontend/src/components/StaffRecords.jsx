import React, { useState, useEffect, useCallback } from 'react';
import { useSchool } from '../contexts/SchoolContext';
import { Search } from 'lucide-react';

const StaffRecords = () => {
  const { buildApiUrl } = useSchool();
  const token = localStorage.getItem('accessToken');

  const [records, setRecords] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [teacherFilter, setTeacherFilter] = useState('');

  const headers = { Authorization: `Bearer ${token}` };

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(buildApiUrl('/schooladmin/staff/dashboard-stats/'), { headers });
      if (res.ok) setStats(await res.json());
    } catch (err) {
      console.error('Failed to load stats');
    }
  }, [buildApiUrl, token]);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      let url = '/schooladmin/staff/records/';
      const params = new URLSearchParams();
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo) params.append('date_to', dateTo);
      if (teacherFilter) params.append('teacher_id', teacherFilter);
      const qs = params.toString();
      if (qs) url += `?${qs}`;

      const res = await fetch(buildApiUrl(url), { headers });
      if (res.ok) {
        setRecords(await res.json());
      } else {
        setError('Failed to load records');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, [buildApiUrl, token, dateFrom, dateTo, teacherFilter]);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const getStatusBadge = (statusValue) => {
    if (!statusValue) return <span className="status-badge no-record">No Record</span>;
    if (statusValue === 'ON_TIME') return <span className="status-badge on-time">On Time</span>;
    if (statusValue === 'LATE') return <span className="status-badge late">Late</span>;
    return <span className="status-badge">{statusValue}</span>;
  };

  return (
    <div>
      {/* Stats Cards */}
      {stats && (
        <div className="staff-stats-grid">
          <div className="staff-stat-card">
            <div className="stat-value">{stats.total_assigned_teachers}</div>
            <div className="stat-label">Total Assigned</div>
          </div>
          <div className="staff-stat-card on-time">
            <div className="stat-value">{stats.today_booked_on}</div>
            <div className="stat-label">Booked On Today</div>
          </div>
          <div className="staff-stat-card on-time">
            <div className="stat-value">{stats.today_booked_off}</div>
            <div className="stat-label">Booked Off Today</div>
          </div>
          <div className="staff-stat-card late">
            <div className="stat-value">{stats.today_late}</div>
            <div className="stat-label">Late Today</div>
          </div>
          <div className="staff-stat-card no-record">
            <div className="stat-value">{stats.today_no_record}</div>
            <div className="stat-label">No Record</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="staff-filters">
        <div className="staff-form-group">
          <label>Date From</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        </div>
        <div className="staff-form-group">
          <label>Date To</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>
        <button className="staff-btn staff-btn-secondary" onClick={() => { setDateFrom(''); setDateTo(''); setTeacherFilter(''); }}>
          Clear Filters
        </button>
      </div>

      {error && <div className="staff-alert staff-alert-error">{error}</div>}

      {/* Records Table */}
      <div className="staff-table-wrapper">
        <table className="staff-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Teacher</th>
              <th>Group</th>
              <th>Scheduled</th>
              <th>Book On</th>
              <th>Book On Status</th>
              <th>Book Off</th>
              <th>Book Off Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ textAlign: 'center' }}>Loading...</td></tr>
            ) : records.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', color: '#94a3b8' }}>No records found</td></tr>
            ) : (
              records.map(r => (
                <tr key={r.id}>
                  <td>{r.date}</td>
                  <td>{r.teacher_name}</td>
                  <td>{r.schedule_group_name}</td>
                  <td>{r.scheduled_start} - {r.scheduled_end}</td>
                  <td>{r.book_on_time || '-'}</td>
                  <td>{getStatusBadge(r.book_on_status)}</td>
                  <td>{r.book_off_time || '-'}</td>
                  <td>{getStatusBadge(r.book_off_status)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default StaffRecords;
