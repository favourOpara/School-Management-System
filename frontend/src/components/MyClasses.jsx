import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  FileText,
  Bell,
  ClipboardList,
  GraduationCap,
  Clock,
  AlertCircle,
  User,
  X,
  Calculator,
  FlaskConical,
  Globe,
  Languages,
  Palette,
  Music,
  Dumbbell,
  History,
  BookMarked,
  Laptop,
  Leaf,
  Building2,
  Heart,
  Briefcase
} from 'lucide-react';
import './MyClasses.css';

const MyClasses = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [classData, setClassData] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [activeTab, setActiveTab] = useState('notes');

  useEffect(() => {
    fetchClassInfo();
  }, []);

  const fetchClassInfo = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken');
      const response = await fetch('http://127.0.0.1:8000/api/academics/student/my-classes/', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch class information');
      }

      const data = await response.json();
      setClassData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getSubjectIcon = (subjectName) => {
    const name = subjectName.toLowerCase();
    if (name.includes('math') || name.includes('algebra') || name.includes('calculus')) {
      return { icon: Calculator, color: '#3b82f6', bg: '#dbeafe' };
    }
    if (name.includes('science') || name.includes('physics') || name.includes('chemistry') || name.includes('biology')) {
      return { icon: FlaskConical, color: '#10b981', bg: '#d1fae5' };
    }
    if (name.includes('english') || name.includes('literature') || name.includes('language')) {
      return { icon: Languages, color: '#2563eb', bg: '#dbeafe' };
    }
    if (name.includes('history') || name.includes('social')) {
      return { icon: History, color: '#f59e0b', bg: '#fef3c7' };
    }
    if (name.includes('geography') || name.includes('geo')) {
      return { icon: Globe, color: '#06b6d4', bg: '#cffafe' };
    }
    if (name.includes('art') || name.includes('creative')) {
      return { icon: Palette, color: '#ec4899', bg: '#fce7f3' };
    }
    if (name.includes('music')) {
      return { icon: Music, color: '#f43f5e', bg: '#ffe4e6' };
    }
    if (name.includes('physical') || name.includes('sport') || name.includes('pe')) {
      return { icon: Dumbbell, color: '#ef4444', bg: '#fee2e2' };
    }
    if (name.includes('computer') || name.includes('ict') || name.includes('tech') || name.includes('data')) {
      return { icon: Laptop, color: '#1d4ed8', bg: '#dbeafe' };
    }
    if (name.includes('agric') || name.includes('farm')) {
      return { icon: Leaf, color: '#22c55e', bg: '#dcfce7' };
    }
    if (name.includes('civic') || name.includes('government')) {
      return { icon: Building2, color: '#64748b', bg: '#f1f5f9' };
    }
    if (name.includes('economic') || name.includes('commerce') || name.includes('business')) {
      return { icon: Briefcase, color: '#0891b2', bg: '#cffafe' };
    }
    if (name.includes('religious') || name.includes('moral') || name.includes('crk') || name.includes('irk')) {
      return { icon: Heart, color: '#3b82f6', bg: '#dbeafe' };
    }
    if (name.includes('home') || name.includes('food')) {
      return { icon: BookMarked, color: '#f97316', bg: '#ffedd5' };
    }
    // Default
    return { icon: BookOpen, color: '#2563eb', bg: '#dbeafe' };
  };

  const openSubjectModal = (subject) => {
    setSelectedSubject(subject);
    setActiveTab('notes');
  };

  const closeSubjectModal = () => {
    setSelectedSubject(null);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getSubmissionStatusBadge = (status) => {
    switch (status) {
      case 'graded':
        return <span className="status-badge graded">Graded</span>;
      case 'submitted':
        return <span className="status-badge submitted">Submitted</span>;
      case 'pending':
        return <span className="status-badge pending">Pending</span>;
      default:
        return <span className="status-badge not-submitted">Not Submitted</span>;
    }
  };

  const getGreeting = () => {
    const greetings = [
      "Welcome to your class",
      "What's good",
      "Yo",
      "Hey there"
    ];
    return greetings[Math.floor(Math.random() * greetings.length)];
  };

  const getGenZMessage = () => {
    const messages = [
      "This is where all the magic happens fr fr. Check out your notes, announcements, assignments, and see if you passed (no pressure lol).",
      "Your one-stop shop for notes, announcements, and assignments. Let's get this bread (academically speaking).",
      "Notes, announcements, assignments - it's giving organized student energy. You got this!",
      "All your class content is here. Time to lock in and level up your grades bestie.",
      "Your academic hub awaits. Notes? Check. Announcements? Check. Assignments? Let's not talk about those rn."
    ];
    return messages[Math.floor(Math.random() * messages.length)];
  };

  if (loading) {
    return (
      <div className="my-classes-container">
        <div className="loading-state">
          <div className="loading-spinner-mc"></div>
          <p>Loading your class info...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="my-classes-container">
        <div className="error-state">
          <AlertCircle size={48} color="#ef4444" />
          <p>{error}</p>
          <button onClick={fetchClassInfo} className="retry-btn">Try Again</button>
        </div>
      </div>
    );
  }

  if (!classData?.has_class) {
    return (
      <div className="my-classes-container">
        <div className="empty-state">
          <GraduationCap size={48} color="#6b7280" />
          <p>{classData?.message || 'You are not enrolled in any class'}</p>
        </div>
      </div>
    );
  }

  const firstName = classData.student_name.split(' ')[0];

  return (
    <div className="my-classes-container">
      {/* Header Section */}
      <div className="class-header">
        <div className="class-badge">
          <GraduationCap size={24} />
          <span>{classData.class_info.class_name}</span>
        </div>
        <div className="session-info">
          {classData.class_info.academic_year} • {classData.class_info.term}
        </div>
      </div>

      {/* Welcome Message */}
      <div className="welcome-section">
        <h2>{getGreeting()}, {firstName}!</h2>
        <p className="gen-z-message">{getGenZMessage()}</p>
      </div>

      {/* Subjects Grid */}
      <div className="subjects-grid">
        {classData.subjects.map((subject) => {
          const subjectStyle = getSubjectIcon(subject.name);
          const SubjectIcon = subjectStyle.icon;

          return (
            <div
              key={subject.id}
              className="subject-card"
              onClick={() => openSubjectModal(subject)}
            >
              <div className="subject-icon-wrapper" style={{ backgroundColor: subjectStyle.bg }}>
                <SubjectIcon size={32} color={subjectStyle.color} />
              </div>
              <div className="subject-card-info">
                <h3 className="subject-card-name">{subject.name}</h3>
                <div className="subject-teacher">
                  <User size={12} />
                  <span>{subject.teacher.name}</span>
                </div>
              </div>
              <div className="subject-card-stats">
                <div className="mini-stat">
                  <FileText size={12} />
                  <span>{subject.content_summary.notes}</span>
                </div>
                <div className="mini-stat">
                  <Bell size={12} />
                  <span>{subject.content_summary.announcements}</span>
                </div>
                <div className="mini-stat">
                  <ClipboardList size={12} />
                  <span>{subject.content_summary.assignments}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Subject Detail Modal */}
      {selectedSubject && (
        <div className="subject-modal-overlay" onClick={closeSubjectModal}>
          <div className="subject-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">
                {(() => {
                  const style = getSubjectIcon(selectedSubject.name);
                  const Icon = style.icon;
                  return <Icon size={24} color={style.color} />;
                })()}
                <h3>{selectedSubject.name}</h3>
              </div>
              <button className="modal-close" onClick={closeSubjectModal}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-teacher-info">
              <User size={14} />
              <span>Teacher: {selectedSubject.teacher.name}</span>
            </div>

            {/* Content Tabs */}
            <div className="content-tabs">
              <button
                className={`tab-btn ${activeTab === 'notes' ? 'active' : ''}`}
                onClick={() => setActiveTab('notes')}
              >
                <FileText size={14} />
                Notes ({selectedSubject.recent_notes.length})
              </button>
              <button
                className={`tab-btn ${activeTab === 'announcements' ? 'active' : ''}`}
                onClick={() => setActiveTab('announcements')}
              >
                <Bell size={14} />
                Announcements ({selectedSubject.recent_announcements.length})
              </button>
              <button
                className={`tab-btn ${activeTab === 'assignments' ? 'active' : ''}`}
                onClick={() => setActiveTab('assignments')}
              >
                <ClipboardList size={14} />
                Assignments ({selectedSubject.assignments_with_grades.length})
              </button>
            </div>

            {/* Tab Content */}
            <div className="modal-tab-content">
              {activeTab === 'notes' && (
                <div className="notes-list">
                  {selectedSubject.recent_notes.length === 0 ? (
                    <div className="empty-content">
                      <FileText size={32} color="#9ca3af" />
                      <p>No notes yet</p>
                    </div>
                  ) : (
                    selectedSubject.recent_notes.map((note) => (
                      <div key={note.id} className="content-item note-item">
                        <h4>{note.title}</h4>
                        <p className="content-description">{note.description}</p>
                        <div className="content-meta">
                          <Clock size={12} />
                          <span>{formatDate(note.created_at)}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'announcements' && (
                <div className="announcements-list">
                  {selectedSubject.recent_announcements.length === 0 ? (
                    <div className="empty-content">
                      <Bell size={32} color="#9ca3af" />
                      <p>No announcements yet</p>
                    </div>
                  ) : (
                    selectedSubject.recent_announcements.map((announcement) => (
                      <div key={announcement.id} className="content-item announcement-item">
                        <h4>{announcement.title}</h4>
                        <p className="content-description">{announcement.description}</p>
                        <div className="content-meta">
                          <Clock size={12} />
                          <span>{formatDate(announcement.created_at)}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'assignments' && (
                <div className="assignments-list">
                  {selectedSubject.assignments_with_grades.length === 0 ? (
                    <div className="empty-content">
                      <ClipboardList size={32} color="#9ca3af" />
                      <p>No assignments yet</p>
                    </div>
                  ) : (
                    selectedSubject.assignments_with_grades.map((assignment) => (
                      <div key={assignment.id} className="content-item assignment-item">
                        <div className="assignment-header">
                          <h4>{assignment.title}</h4>
                          {getSubmissionStatusBadge(assignment.submission_status)}
                        </div>
                        <p className="content-description">{assignment.description}</p>
                        <div className="assignment-details">
                          <div className="detail-row">
                            <span className="detail-label">Due:</span>
                            <span className="detail-value">{formatDateTime(assignment.due_date)}</span>
                          </div>
                          <div className="detail-row">
                            <span className="detail-label">Max Score:</span>
                            <span className="detail-value">{assignment.max_score}</span>
                          </div>
                          {assignment.grade_released && assignment.score !== null && (
                            <div className="detail-row grade-row">
                              <span className="detail-label">Your Score:</span>
                              <span className="detail-value score">
                                {assignment.score}/{assignment.max_score}
                                <span className="percentage">
                                  ({((assignment.score / assignment.max_score) * 100).toFixed(1)}%)
                                </span>
                              </span>
                            </div>
                          )}
                          {assignment.feedback && (
                            <div className="feedback-section">
                              <span className="feedback-label">Feedback:</span>
                              <p className="feedback-text">{assignment.feedback}</p>
                            </div>
                          )}
                        </div>
                        <div className="content-meta">
                          <Clock size={12} />
                          <span>Posted: {formatDate(assignment.created_at)}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyClasses;
