import React, { useState, useEffect } from 'react';
import API_BASE_URL from '../config';

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
      const response = await fetch(`${API_BASE_URL}/api/academics/student/my-classes/`, {
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
      "Your academic hub awaits. Notes? Check. Announcements? Check. Assignments? Let's not talk about those rn.",
      "POV: You're about to check if that assignment you forgot about is due today. Spoiler alert - it probably is 💀",
      "Main character energy activated! Time to ace these classes like the academic weapon you are.",
      "Your grades called, they want you to check on them. Also, your assignments are judging you from the corner 👀",
      "It's giving 'I'm going to be productive today' energy. Let's see how long that lasts bestie.",
      "Welcome to the chaos - I mean, your perfectly organized class schedule. May the curve be ever in your favor!",
      "Roses are red, violets are blue, your assignments are waiting, and so are your notes too 📚",
      "Breaking news: Local student enters portal to check grades. Will they survive? Find out by clicking on your subjects!",
      "Not me checking my grades at 3am like I didn't already know I was cooked 😭",
      "Bro really thought ignoring assignments would make them disappear. Anyway, they're all here waiting for you 💅",
      "Tell me why I have to open 47 different subjects just to find ONE note. Make it make sense.",
      "The way I RAN here to check if grades dropped. It's giving unhinged student behavior and I'm here for it.",
      "No because the audacity of these assignments thinking they're getting done on time. Respectfully, they can wait 🙄",
      "I fear your teacher might have posted something important. The delusion if you think you can skip reading announcements.",
      "Bestie you're in your academic weapon era! Time to slay these subjects and serve main character realness. Period.",
      "Hear me out... what if you actually did your homework this time? Revolutionary concept, I know 🤯",
      "Why did the student eat their homework? Because the teacher said it was a piece of cake! 🍰 (Your actual homework is here tho)",
      "Math pun alert: Why was six afraid of seven? Because seven eight nine! Now go check if YOU ate all those assignment deadlines 💀",
      "Your brain cells before exams: 'We ride at dawn.' Your brain cells during exams: 'Who rides where now?' 🤠",
      "They say 'shoot for the moon' but honestly I'd settle for just passing this class fr fr ✨",
      "Why don't scientists trust atoms? Because they make up everything! Unlike your excuses for missing assignments bestie 🧪",
      "Student: 'Can I go to the bathroom?' Teacher: 'I don't know, CAN you?' Me: Still wondering if I CAN pass this class 🚽",
      "Fun fact: 100% of students who check their classes daily have a slightly better idea of what's due. Science! 🔬",
      "What do you call a bear with no teeth? A gummy bear! What do you call a student with no assignments done? Me. I'm the student 🐻",
      "Teacher: 'Why is your homework late?' Me: 'My dog ate it.' Teacher: 'You don't have a dog.' Me: 'Exactly. The situation was complicated.' 🐕",
      "I'm not saying procrastination is good, but I AM saying you found this portal, so baby steps! 👏",
      "Plot twist: The notes you're looking for were actually inside you all along. JK they're in this portal, click your subjects 📝",
      "Parallel lines have so much in common... it's a shame they'll never meet. Unlike you and your assignments, which meet constantly 📐",
      "Why did the algebra book look so sad? Too many problems! Same bestie, same. But you got this! 💪",
      "Somewhere between 'I got this' and 'I don't got this' is where you'll find me refreshing this page for new grades 🔄",
      "What's a teacher's favorite nation? Expla-nation! What's a student's favorite nation? Procrastin-ation! 🌍",
      "The only thing standing between you and your dreams is... checking these assignments apparently 😤",
      "Why was the geometry book always stressed? It had too many angles to work out! Unlike YOU who's got all the right angles 📊",
      "Student survival kit: Caffeine ☕ + Delusion that you'll start studying early 🌟 + This portal = You're welcome",
      "What's the difference between a teacher and a train? A teacher says 'spit out your gum' and a train says 'chew chew!' 🚂",
      "I told my teacher I'd do better this semester. That was a lie. But your grades won't lie - check them here! 🎯",
      "Why don't eggs tell jokes? They'd crack each other up! Speaking of cracking under pressure, how are those deadlines? 🥚",
      "Teachers: 'You can do it!' My brain: 'We've been compromised.' My grades: 'Send help.' This portal: 'Here's what's due.' 🆘",
      "What do you call a fake noodle? An impasta! What do you call fake studying? Whatever I did last night 🍝",
      "Life is soup. I am fork. But also, you're here now so let's get this academic bread together! 🍲",
      "Why did the student bring a ladder to class? They wanted to go to HIGH school! You're already here so go higher! 🪜",
      "Teacher: 'Where's your assignment?' Me: 'It's in the cloud.' Teacher: 'Which cloud?' Me: 'The one of denial I've been living in.' ☁️",
      "Plot armor but make it academic. You WILL pass. The universe said so. (But also check your assignments to be sure) 🛡️",
      "What's the smartest insect? A spelling bee! What's the smartest thing you can do? Check this page daily! 🐝"
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
