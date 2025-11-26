import React, { useState } from 'react';
import { TrendingUp, TrendingDown, ChevronDown, ChevronUp } from 'lucide-react';
import API_BASE_URL from '../config';

import './MySubjectGrades.css';

const MySubjectGrades = ({ type = 'highest' }) => {
  const [grades, setGrades] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const fetchGrades = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${API_BASE_URL}/api/schooladmin/student/dashboard/my-grades/`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch grades');
      }

      const data = await response.json();
      setGrades(data.grades);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleExpand = () => {
    if (!isExpanded && grades.length === 0) {
      fetchGrades();
    }
    setIsExpanded(!isExpanded);
    if (isExpanded) {
      setShowAll(false);
    }
  };

  const getScoreColor = (score) => {
    if (score >= 90) return '#10b981';
    if (score >= 75) return '#06b6d4';
    if (score >= 60) return '#f59e0b';
    return '#ef4444';
  };

  const getGradeEmoji = (rank, isHighest) => {
    if (isHighest) {
      if (rank === 1) return '🏆';
      if (rank === 2) return '🥈';
      if (rank === 3) return '🥉';
      if (rank === 4) return '⭐';
    } else {
      if (rank === 1) return '📉';
      if (rank === 2) return '⚠️';
      if (rank === 3) return '💪';
      if (rank === 4) return '📚';
    }
    return '';
  };

  // Sort grades based on type
  const sortedGrades = type === 'highest'
    ? [...grades] // Already sorted highest to lowest
    : [...grades].reverse(); // Reverse for lowest to highest

  const displayedGrades = showAll ? sortedGrades : sortedGrades.slice(0, 4);

  const isHighest = type === 'highest';
  const Icon = isHighest ? TrendingUp : TrendingDown;
  const iconColor = isHighest ? '#10b981' : '#ef4444';
  const title = isHighest ? 'Highest Grades' : 'Lowest Grades';
  const subtitle = isHighest ? 'Your top performing subjects' : 'Subjects needing improvement';
  const buttonColor = isHighest ? 'highest' : 'lowest';

  return (
    <div className={`my-grades-card ${type}`}>
      <div className="my-grades-header">
        <Icon size={24} color={iconColor} />
        <div className="my-grades-title-section">
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
      </div>

      <button
        className={`my-grades-toggle-btn ${isExpanded ? 'close' : buttonColor}`}
        onClick={handleToggleExpand}
      >
        {isExpanded ? 'Close' : 'View Grades'}
      </button>

      {isExpanded && (
        <div className="my-grades-content">
          {loading ? (
            <div className="my-grades-loading">
              <div className={`loading-spinner-mg ${type}`}></div>
            </div>
          ) : error ? (
            <div className="my-grades-error">
              <p>Unable to load grades</p>
            </div>
          ) : grades.length === 0 ? (
            <div className="my-grades-empty">
              <p>No grades available yet</p>
            </div>
          ) : (
            <>
              <ul className="grades-list">
                {displayedGrades.map((grade, index) => (
                  <li key={grade.subject_id}>
                    <span className="grade-rank">#{index + 1}</span>
                    <span className="grade-subject">
                      {grade.subject_name}
                      <span className="grade-emoji">{getGradeEmoji(index + 1, isHighest)}</span>
                    </span>
                  </li>
                ))}
              </ul>

              {sortedGrades.length > 4 && (
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
                      Show All ({sortedGrades.length})
                    </>
                  )}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default MySubjectGrades;
