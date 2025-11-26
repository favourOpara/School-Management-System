import React, { useState, useEffect } from 'react';
import { BookOpen, ChevronDown, ChevronUp, Trophy, User } from 'lucide-react';
import API_BASE_URL from '../config';

import './SubjectRankings.css';

const SubjectRankings = () => {
  const [subjects, setSubjects] = useState([]);
  const [classInfo, setClassInfo] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [topStudents, setTopStudents] = useState([]);
  const [showAllStudents, setShowAllStudents] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);

  const fetchSubjects = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${API_BASE_URL}/api/schooladmin/student/dashboard/subject-rankings/`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch subjects');
      }

      const data = await response.json();
      setSubjects(data.subjects);
      setClassInfo({
        className: data.class_name,
        academicYear: data.academic_year,
        term: data.term,
        department: data.department
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchTopStudents = async (subjectId) => {
    setLoadingStudents(true);
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${API_BASE_URL}/api/schooladmin/student/dashboard/subject/${subjectId}/top-students/`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch rankings');
      }

      const data = await response.json();
      setTopStudents(data.rankings);
      setSelectedSubject({
        id: data.subject_id,
        name: data.subject_name,
        teacher: data.teacher,
        totalStudents: data.total_students
      });
    } catch (err) {
      console.error('Error fetching top students:', err);
    } finally {
      setLoadingStudents(false);
    }
  };

  const handleToggleExpand = () => {
    if (!isExpanded && subjects.length === 0) {
      fetchSubjects();
    }
    setIsExpanded(!isExpanded);
    if (isExpanded) {
      setSelectedSubject(null);
      setTopStudents([]);
      setShowAllStudents(false);
    }
  };

  const handleSubjectClick = (subject) => {
    if (selectedSubject?.id === subject.id) {
      setSelectedSubject(null);
      setTopStudents([]);
      setShowAllStudents(false);
    } else {
      fetchTopStudents(subject.id);
      setShowAllStudents(false);
    }
  };

  const getScoreColor = (score) => {
    if (score >= 90) return '#10b981';
    if (score >= 75) return '#06b6d4';
    if (score >= 60) return '#f59e0b';
    return '#ef4444';
  };

  const getRankBadge = (rank) => {
    if (rank === 1) return '1st';
    if (rank === 2) return '2nd';
    if (rank === 3) return '3rd';
    return `#${rank}`;
  };

  const displayedStudents = showAllStudents ? topStudents : topStudents.slice(0, 5);

  return (
    <div className="subject-rankings-card">
      <div className="subject-rankings-header">
        <BookOpen size={24} color="#0d9488" />
        <div className="subject-rankings-title-section">
          <h3>Subject Performance</h3>
          <p>View top students by subject</p>
        </div>
      </div>

      <button
        className={`subject-rankings-toggle-btn ${isExpanded ? 'close' : 'open'}`}
        onClick={handleToggleExpand}
      >
        {isExpanded ? 'Close' : 'View Rankings'}
      </button>

      {isExpanded && (
        <div className="subject-rankings-content">
          {loading ? (
            <div className="subject-rankings-loading">
              <div className="loading-spinner-sr"></div>
            </div>
          ) : error ? (
            <div className="subject-rankings-error">
              <p>Unable to load subjects</p>
            </div>
          ) : (
            <>
              <div className="subject-list">
                {subjects.map((subject) => (
                  <div key={subject.id} className="subject-wrapper">
                    <div
                      className={`subject-item ${selectedSubject?.id === subject.id ? 'active' : ''}`}
                      onClick={() => handleSubjectClick(subject)}
                    >
                      <span className="subject-name">{subject.name}</span>
                      <ChevronDown
                        size={16}
                        className={`subject-chevron ${selectedSubject?.id === subject.id ? 'rotated' : ''}`}
                      />
                    </div>

                    {selectedSubject?.id === subject.id && (
                      <div className="top-students-panel">
                        {loadingStudents ? (
                          <div className="students-loading">
                            <div className="loading-spinner-sr small"></div>
                          </div>
                        ) : (
                          <>
                            <ul className="students-list">
                              {displayedStudents.map((student) => (
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
                                </li>
                              ))}
                            </ul>

                            {topStudents.length > 5 && (
                              <button
                                className="show-more-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowAllStudents(!showAllStudents);
                                }}
                              >
                                {showAllStudents ? (
                                  <>
                                    <ChevronUp size={14} />
                                    Show Less
                                  </>
                                ) : (
                                  <>
                                    <ChevronDown size={14} />
                                    Show All ({topStudents.length})
                                  </>
                                )}
                              </button>
                            )}

                            {topStudents.find(s => s.is_current_user) && !showAllStudents && (
                              <div className="your-position">
                                Your rank: <strong>#{topStudents.find(s => s.is_current_user)?.rank}</strong> of {selectedSubject.totalStudents}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default SubjectRankings;
