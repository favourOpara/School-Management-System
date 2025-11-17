import React, { useState, useEffect } from 'react';
import { Trophy, Medal, Award, ChevronDown, ChevronUp, Flame, Crown, Star, User } from 'lucide-react';
import './AttendanceLeaderboard.css';

const AttendanceLeaderboard = () => {
  const [rankings, setRankings] = useState([]);
  const [classInfo, setClassInfo] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    fetchRankings();
  }, []);

  const fetchRankings = async () => {
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

  const getRankBadge = (rank) => {
    if (rank === 1) return <span className="rank-medal gold">1st</span>;
    if (rank === 2) return <span className="rank-medal silver">2nd</span>;
    if (rank === 3) return <span className="rank-medal bronze">3rd</span>;
    return null;
  };

  const getRankIcon = (rank) => {
    if (rank === 1) return <Crown className="rank-icon gold" />;
    if (rank === 2) return <Medal className="rank-icon silver" />;
    if (rank === 3) return <Award className="rank-icon bronze" />;
    return <span className="rank-number">#{rank}</span>;
  };

  const getRankEmoji = (rank) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    if (rank <= 5) return '🔥';
    return '';
  };

  const getScoreColor = (score) => {
    if (score >= 8) return 'score-excellent';
    if (score >= 6) return 'score-good';
    if (score >= 4) return 'score-average';
    return 'score-low';
  };

  const displayedRankings = showAll ? rankings : rankings.slice(0, 5);

  if (loading) {
    return (
      <div className="leaderboard-container">
        <div className="leaderboard-loading">
          <div className="loading-spinner-lb"></div>
          <p>Loading rankings...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="leaderboard-container">
        <div className="leaderboard-error">
          <p>Unable to load rankings</p>
        </div>
      </div>
    );
  }

  return (
    <div className="leaderboard-container">
      <div className="leaderboard-header">
        <div className="leaderboard-title">
          <Trophy className="trophy-icon" />
          <h3>Attendance Leaderboard</h3>
        </div>
        <div className="leaderboard-badge">
          <Flame className="flame-icon" />
          <span>Top {Math.min(5, rankings.length)}</span>
        </div>
      </div>

      <div className="leaderboard-subtitle">
        <span className="class-tag">{classInfo.className}</span>
        <span className="term-tag">{classInfo.term} • {classInfo.academicYear}</span>
      </div>

      <div className="leaderboard-list">
        {displayedRankings.map((student, index) => (
          <div
            key={student.student_id}
            className={`leaderboard-item ${student.is_current_user ? 'current-user' : ''} ${
              student.rank <= 3 ? `top-${student.rank}` : ''
            }`}
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            <div className="rank-badge with-avatar">
              {student.avatar_url ? (
                <img src={student.avatar_url} alt={student.student_name} className="student-avatar" />
              ) : (
                <User size={24} className="default-avatar-icon" />
              )}
              {getRankBadge(student.rank)}
              {student.rank > 3 && <span className="rank-number-overlay">#{student.rank}</span>}
            </div>

            <div className="student-info">
              <div className="student-name">
                <span className="student-name-text">{student.student_name}</span>
                {student.is_current_user && <span className="you-badge">YOU</span>}
                <span className="rank-emoji">{getRankEmoji(student.rank)}</span>
              </div>
              <div className="student-username">@{student.username}</div>
            </div>

            <div className="score-section">
              <div className={`score-value ${getScoreColor(student.attendance_score)}`}>
                {student.attendance_score}
              </div>
              <div className="score-bar">
                <div
                  className="score-fill"
                  style={{ width: `${Math.min(100, (student.attendance_score / 10) * 100)}%` }}
                ></div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {rankings.length > 5 && (
        <button
          className="show-more-btn"
          onClick={() => setShowAll(!showAll)}
        >
          {showAll ? (
            <>
              <ChevronUp size={18} />
              Show Less
            </>
          ) : (
            <>
              <ChevronDown size={18} />
              Show All ({rankings.length} students)
            </>
          )}
        </button>
      )}

      {rankings.length > 0 && !showAll && (
        <div className="your-position">
          {rankings.find(s => s.is_current_user) && (
            <p>
              Your rank: <strong>#{rankings.find(s => s.is_current_user)?.rank}</strong> out of {rankings.length}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default AttendanceLeaderboard;
