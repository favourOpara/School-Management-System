import React, { useState } from 'react';
import { Trophy, ChevronDown, ChevronUp, User } from 'lucide-react';
import './AttendanceLeaderboard.css';

const AttendanceLeaderboard = () => {
  const [rankings, setRankings] = useState([]);
  const [classInfo, setClassInfo] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const fetchRankings = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch('http://127.0.0.1:8000/api/schooladmin/student/dashboard/attendance-ranking/', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch rankings');
      }

      const data = await response.json();
      setRankings(data.rankings);
      setClassInfo({
        className: data.class_name,
        academicYear: data.academic_year,
        term: data.term,
        totalStudents: data.total_students
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleExpand = () => {
    if (!isExpanded && rankings.length === 0) {
      fetchRankings();
    }
    setIsExpanded(!isExpanded);
    if (isExpanded) {
      setShowAll(false);
    }
  };

  const getScoreColor = (score) => {
    if (score >= 8) return '#10b981';
    if (score >= 6) return '#06b6d4';
    if (score >= 4) return '#f59e0b';
    return '#ef4444';
  };

  const getRankBadge = (rank) => {
    if (rank === 1) return '1st';
    if (rank === 2) return '2nd';
    if (rank === 3) return '3rd';
    return `#${rank}`;
  };

  const displayedRankings = showAll ? rankings : rankings.slice(0, 5);

  return (
    <div className="attendance-leaderboard-card">
      <div className="attendance-leaderboard-header">
        <Trophy size={24} color="#f59e0b" />
        <div className="attendance-leaderboard-title-section">
          <h3>Attendance Leaderboard</h3>
          <p>Top students by attendance score</p>
        </div>
      </div>

      <button
        className={`attendance-leaderboard-toggle-btn ${isExpanded ? 'close' : 'open'}`}
        onClick={handleToggleExpand}
      >
        {isExpanded ? 'Close' : 'View Rankings'}
      </button>

      {isExpanded && (
        <div className="attendance-leaderboard-content">
          {loading ? (
            <div className="attendance-leaderboard-loading">
              <div className="loading-spinner-al"></div>
            </div>
          ) : error ? (
            <div className="attendance-leaderboard-error">
              <p>Unable to load rankings</p>
            </div>
          ) : (
            <>
              <div className="class-info-tags">
                <span className="info-tag">{classInfo.className}</span>
                <span className="info-tag">{classInfo.term}</span>
              </div>

              <ul className="rankings-list">
                {displayedRankings.map((student) => (
                  <li
                    key={student.student_id}
                    className={student.is_current_user ? 'current-user' : ''}
                  >
                    <span className="rank-badge">{getRankBadge(student.rank)}</span>
                    {student.avatar_url ? (
                      <img src={student.avatar_url} alt="" className="student-avatar" />
                    ) : (
                      <User size={16} className="default-avatar" />
                    )}
                    <span className="student-name">
                      {student.student_name}
                      {student.is_current_user && <span className="you-badge">YOU</span>}
                    </span>
                    <span
                      className="student-score"
                      style={{ color: getScoreColor(student.attendance_score) }}
                    >
                      {student.attendance_score}
                    </span>
                  </li>
                ))}
              </ul>

              {rankings.length > 5 && (
                <button
                  className="show-more-btn"
                  onClick={() => setShowAll(!showAll)}
                >
                  {showAll ? (
                    <>
                      <ChevronUp size={14} />
                      Show Less
                    </>
                  ) : (
                    <>
                      <ChevronDown size={14} />
                      Show All ({rankings.length})
                    </>
                  )}
                </button>
              )}

              {rankings.find(s => s.is_current_user) && !showAll && (
                <div className="your-position">
                  Your rank: <strong>#{rankings.find(s => s.is_current_user)?.rank}</strong> of {classInfo.totalStudents}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default AttendanceLeaderboard;
