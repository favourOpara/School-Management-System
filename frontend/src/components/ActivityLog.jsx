import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './ActivityLog.css'; // Ensure you create this CSS file for styling

const ActivityLog = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const token = localStorage.getItem('accessToken');

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const response = await axios.get('http://127.0.0.1:8000/api/logs/activities/', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        setLogs(response.data);
      } catch (err) {
        console.error('Error fetching activity logs:', err);
        setError('Failed to load activity logs.');
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, [token]);

  if (loading) return <p>Loading activity logs...</p>;
  if (error) return <p className="error">{error}</p>;

  return (
    <div className="activity-log-container">
      <h2>Activity Logs</h2>
      {logs.length === 0 ? (
        <p>No activity logs available.</p>
      ) : (
        <table className="activity-log-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>User</th>
              <th>Role</th>
              <th>Action</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id}>
                <td>{new Date(log.timestamp).toLocaleString()}</td>
                <td>{log.user}</td>
                <td>{log.role}</td>
                <td>{log.action_type}</td>
                <td>{log.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default ActivityLog;
