import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, Lock, Save } from 'lucide-react';
import API_BASE_URL from '../config';

import './ManualGrading.css';

const ManualGrading = () => {
  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [students, setStudents] = useState([]);
  const [gradingConfig, setGradingConfig] = useState(null);
  const [gradeType, setGradeType] = useState('test'); // 'test' or 'exam'
  const [grades, setGrades] = useState({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');

  useEffect(() => {
    fetchTeacherSubjects();
  }, []);

  const fetchTeacherSubjects = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${API_BASE_URL}/api/schooladmin/teacher/grading/subjects/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setSubjects(data.subjects);
      } else {
        showMessage('Error fetching subjects', 'error');
      }
    } catch (error) {
      showMessage('Error fetching subjects', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchStudentsForSubject = async (subjectId) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken');
      const response = await fetch(
        `${API_BASE_URL}/api/schooladmin/teacher/grading/subjects/${subjectId}/students/`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setStudents(data.students);
        setGradingConfig(data.grading_config);
        setSelectedSubject(data.subject);

        // Initialize grades object
        const initialGrades = {};
        data.students.forEach(student => {
          initialGrades[student.id] = {
            test_score: student.test_score,
            exam_score: student.exam_score
          };
        });
        setGrades(initialGrades);
      } else {
        showMessage('Error fetching students', 'error');
      }
    } catch (error) {
      showMessage('Error fetching students', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubjectSelect = (subject) => {
    fetchStudentsForSubject(subject.id);
  };

  const handleGradeChange = (studentId, value) => {
    setGrades(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [`${gradeType}_score`]: value
      }
    }));
  };

  const handleSaveGrade = async (studentId) => {
    const score = grades[studentId]?.[`${gradeType}_score`];

    // Validate score
    if (!score || score === '' || isNaN(parseFloat(score))) {
      showMessage('Please enter a valid grade', 'error');
      return;
    }

    const maxScore = gradeType === 'test' ? gradingConfig?.test_percentage : gradingConfig?.exam_percentage;
    const scoreValue = parseFloat(score);

    if (scoreValue < 0 || scoreValue > maxScore) {
      showMessage(`Score must be between 0 and ${maxScore}`, 'error');
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken');
      const response = await fetch(
        `${API_BASE_URL}/api/schooladmin/teacher/grading/subjects/${selectedSubject.id}/save/`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            grade_type: gradeType,
            grades: [{
              student_id: parseInt(studentId),
              score: scoreValue
            }]
          })
        }
      );

      if (response.ok) {
        const data = await response.json();
        showMessage(data.message, 'success');

        // Refresh students to get updated locked status
        fetchStudentsForSubject(selectedSubject.id);
      } else {
        const errorData = await response.json();
        showMessage(errorData.detail || 'Error saving grade', 'error');
      }
    } catch (error) {
      showMessage('Error saving grade', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (text, type) => {
    setMessage(text);
    setMessageType(type);
    setTimeout(() => {
      setMessage('');
      setMessageType('');
    }, 5000);
  };

  const getSelectedSubjectData = () => {
    return subjects.find(s => s.id === selectedSubject?.id);
  };

  const canGrade = () => {
    const subjectData = getSelectedSubjectData();
    if (!subjectData) return false;
    return gradeType === 'test' ? subjectData.can_grade_test : subjectData.can_grade_exam;
  };

  const getUnlockedCount = () => {
    if (students.length === 0) return 0;
    const lockField = gradeType === 'test' ? 'test_locked' : 'exam_locked';
    return students.filter(s => !s[lockField]).length;
  };

  const getLockedCount = () => {
    if (students.length === 0) return 0;
    const lockField = gradeType === 'test' ? 'test_locked' : 'exam_locked';
    return students.filter(s => s[lockField]).length;
  };

  if (loading && subjects.length === 0) {
    return <div className="manual-grading-loading">Loading...</div>;
  }

  return (
    <div className="mg-main-wrapper">
      <div className="mg-page-header">
        <h2>Manual Grading</h2>
        <p>Enter test and exam scores for students when no online assessments are set</p>
      </div>

      {message && (
        <div className={`message ${messageType}`}>
          {messageType === 'error' ? <AlertCircle size={20} /> : <CheckCircle size={20} />}
          {message}
        </div>
      )}

      {!selectedSubject ? (
        <div className="subjects-grid">
          {subjects.length === 0 ? (
            <div className="no-subjects">
              <p>No subjects assigned to you</p>
            </div>
          ) : (
            subjects.map(subject => (
              <div key={subject.id} className="subject-card" onClick={() => handleSubjectSelect(subject)}>
                <h3 className="subject-name">{subject.name}</h3>
                <p className="subject-session">{subject.academic_year} - {subject.term}</p>
                <div className="grade-status">
                  {subject.can_grade_test ? (
                    <span className="status-badge available">Test: Can Grade</span>
                  ) : (
                    <span className="status-badge locked">Test: Auto-Graded</span>
                  )}
                  {subject.can_grade_exam ? (
                    <span className="status-badge available">Exam: Can Grade</span>
                  ) : (
                    <span className="status-badge locked">Exam: Auto-Graded</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="mg-grading-container">
          <div className="grading-controls">
            <button className="back-btn" onClick={() => setSelectedSubject(null)}>
              ← Back to Subjects
            </button>
            <div className="grade-type-selector">
              <button
                className={`grade-type-btn ${gradeType === 'test' ? 'active' : ''}`}
                onClick={() => setGradeType('test')}
              >
                Test Scores
              </button>
              <button
                className={`grade-type-btn ${gradeType === 'exam' ? 'active' : ''}`}
                onClick={() => setGradeType('exam')}
              >
                Exam Scores
              </button>
            </div>
          </div>

          <div className="subject-info-banner">
            <h3>{selectedSubject.name}</h3>
            <p>{selectedSubject.class_name} • {selectedSubject.academic_year} - {selectedSubject.term}</p>
            {gradingConfig && (
              <p className="max-score-info">
                Maximum {gradeType === 'test' ? 'Test' : 'Exam'} Score: {gradeType === 'test' ? gradingConfig.test_percentage : gradingConfig.exam_percentage}%
              </p>
            )}
          </div>

          {!canGrade() ? (
            <div className="cannot-grade-message">
              <Lock size={48} />
              <h3>Cannot Manually Grade</h3>
              <p>
                Online {gradeType === 'test' ? 'tests' : 'exams'} have been set for this subject.
                Scores are automatically calculated from student submissions.
              </p>
            </div>
          ) : (
            <>
              {getLockedCount() > 0 && (
                <div className="grading-info">
                  <p className="info-text">
                    {getUnlockedCount()} student(s) can be graded • {getLockedCount()} student(s) already graded and locked
                  </p>
                </div>
              )}

              <div className="students-table-container">
                <table className="students-table">
                  <thead>
                    <tr>
                      <th>Student Name</th>
                      <th>Username</th>
                      <th>{gradeType === 'test' ? 'Test' : 'Exam'} Score</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map(student => {
                      const isLocked = gradeType === 'test' ? student.test_locked : student.exam_locked;
                      return (
                        <tr key={student.id}>
                          <td>{student.full_name}</td>
                          <td>{student.username}</td>
                          <td>
                            {isLocked ? (
                              <div className="locked-score">
                                {grades[student.id]?.[`${gradeType}_score`] || 0}
                                <Lock size={14} />
                              </div>
                            ) : (
                              <input
                                type="number"
                                min="0"
                                max={gradeType === 'test' ? gradingConfig?.test_percentage : gradingConfig?.exam_percentage}
                                step="0.1"
                                value={grades[student.id]?.[`${gradeType}_score`] || ''}
                                onChange={(e) => handleGradeChange(student.id, e.target.value)}
                                className="grade-input"
                              />
                            )}
                          </td>
                          <td>
                            {isLocked ? (
                              <span className="locked-badge">
                                <Lock size={14} /> Locked
                              </span>
                            ) : (
                              <button
                                className="save-grade-btn"
                                onClick={() => handleSaveGrade(student.id)}
                                disabled={loading}
                                title="Save grade for this student"
                              >
                                <Save size={16} />
                                Save
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="info-section">
                <p className="warning-text">
                  ⚠️ Warning: Grades can only be entered once per student. After saving, that student's grade cannot be edited.
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default ManualGrading;
