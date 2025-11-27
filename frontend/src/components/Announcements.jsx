// src/components/Announcements.jsx
import React, { useState, useEffect } from 'react';
import {
  Megaphone, Plus, Edit, Trash2, Users, AlertCircle,
  Eye, EyeOff, Loader, Search, Filter
} from 'lucide-react';
import axios from 'axios';
import API_BASE_URL from '../config';

import './Announcements.css';

const Announcements = () => {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Filters
  const [filterAudience, setFilterAudience] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterActive, setFilterActive] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Form data
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    audience: 'everyone',
    priority: 'medium',
    send_type: 'manual',
    scheduled_date: '',
    scheduled_time: '',
    parent_filter: 'all',
    student_filter: 'all',
    teacher_filter: 'all',
    grading_deadline: '',
    is_recurring: false,
    recurrence_days: '',
    specific_users: [],
    specific_classes: []
  });

  // Data for selects
  const [users, setUsers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [filteredUsers, setFilteredUsers] = useState([]);

  const token = localStorage.getItem('accessToken');

  useEffect(() => {
    fetchAnnouncements();
    fetchUsersAndClasses();
  }, [filterAudience, filterPriority, filterActive]);

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterAudience) params.append('audience', filterAudience);
      if (filterPriority) params.append('priority', filterPriority);
      if (filterActive) params.append('is_active', filterActive);

      const response = await axios.get(
        `${API_BASE_URL}/api/schooladmin/announcements/?${params.toString()}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setAnnouncements(response.data.announcements || []);
    } catch (error) {
      console.error('Error fetching announcements:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsersAndClasses = async (search = '') => {
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);

      const response = await axios.get(
        `${API_BASE_URL}/api/schooladmin/announcements/users-and-classes/?${params.toString()}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const fetchedUsers = response.data.users || [];
      setUsers(fetchedUsers);
      setFilteredUsers(fetchedUsers);
      setClasses(response.data.classes || []);
    } catch (error) {
      console.error('Error fetching users and classes:', error);
    }
  };

  // Filter users based on search query
  useEffect(() => {
    if (userSearchQuery.trim() === '') {
      setFilteredUsers(users);
    } else {
      const query = userSearchQuery.toLowerCase();
      const filtered = users.filter(user =>
        user.username.toLowerCase().includes(query) ||
        user.full_name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query) ||
        user.role.toLowerCase().includes(query)
      );
      setFilteredUsers(filtered);
    }
  }, [userSearchQuery, users]);

  const handleCreateNew = () => {
    setEditingAnnouncement(null);
    setFormData({
      title: '',
      message: '',
      audience: 'everyone',
      priority: 'medium',
      send_type: 'manual',
      scheduled_date: '',
      scheduled_time: '',
      parent_filter: 'all',
      student_filter: 'all',
      teacher_filter: 'all',
      grading_deadline: '',
      is_recurring: false,
      recurrence_days: '',
      specific_users: [],
      specific_classes: []
    });
    setUserSearchQuery('');
    setShowModal(true);
  };

  const handleEdit = (announcement) => {
    setEditingAnnouncement(announcement);
    setFormData({
      title: announcement.title,
      message: announcement.message,
      audience: announcement.audience,
      priority: announcement.priority,
      send_type: announcement.send_type || 'manual',
      scheduled_date: announcement.scheduled_date || '',
      scheduled_time: announcement.scheduled_time || '',
      parent_filter: announcement.parent_filter || 'all',
      student_filter: announcement.student_filter || 'all',
      teacher_filter: announcement.teacher_filter || 'all',
      grading_deadline: announcement.grading_deadline || '',
      is_recurring: announcement.is_recurring || false,
      recurrence_days: announcement.recurrence_days || '',
      specific_users: (announcement.specific_users || []).map(u => typeof u === 'object' ? u.id : u),
      specific_classes: (announcement.specific_classes || []).map(c => typeof c === 'object' ? c.id : c)
    });
    setUserSearchQuery('');
    setShowModal(true);
  };

  const handleUserToggle = (userId) => {
    setFormData(prev => {
      const isSelected = prev.specific_users.includes(userId);
      return {
        ...prev,
        specific_users: isSelected
          ? prev.specific_users.filter(id => id !== userId)
          : [...prev.specific_users, userId]
      };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate scheduling fields
    if (formData.send_type === 'scheduled' && (!formData.scheduled_date || !formData.scheduled_time)) {
      alert('Please provide both date and time for scheduled announcements');
      return;
    }

    // Validate recurrence fields
    if (formData.is_recurring && (!formData.recurrence_days || formData.recurrence_days < 1)) {
      alert('Please provide a valid number of days for recurring announcements');
      return;
    }

    // Validate teacher filter grading deadline
    if (formData.audience === 'teachers' && formData.teacher_filter === 'incomplete_grading' && !formData.grading_deadline) {
      alert('Please provide a grading deadline when targeting teachers with incomplete grading');
      return;
    }

    setSubmitting(true);
    try {
      // Sanitize data to ensure IDs are numbers, not objects
      const sanitizedData = {
        ...formData,
        specific_users: formData.specific_users.map(u => typeof u === 'object' ? u.id : u),
        specific_classes: formData.specific_classes.map(c => typeof c === 'object' ? c.id : c)
      };

      if (editingAnnouncement) {
        // Update
        await axios.put(
          `${API_BASE_URL}/api/schooladmin/announcements/${editingAnnouncement.id}/`,
          sanitizedData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        alert('Announcement updated successfully!');
      } else {
        // Create
        const response = await axios.post(
          `${API_BASE_URL}/api/schooladmin/announcements/`,
          sanitizedData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        alert(response.data.message || 'Announcement created successfully!');
      }
      setShowModal(false);
      fetchAnnouncements();
    } catch (error) {
      console.error('Error saving announcement:', error);
      alert(error.response?.data?.detail || 'Failed to save announcement');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this announcement?')) return;

    try {
      await axios.delete(
        `${API_BASE_URL}/api/schooladmin/announcements/${id}/`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert('Announcement deleted successfully!');
      fetchAnnouncements();
    } catch (error) {
      console.error('Error deleting announcement:', error);
      alert('Failed to delete announcement');
    }
  };

  const handleToggleActive = async (announcement) => {
    try {
      await axios.put(
        `${API_BASE_URL}/api/schooladmin/announcements/${announcement.id}/`,
        { ...announcement, is_active: !announcement.is_active },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchAnnouncements();
    } catch (error) {
      console.error('Error toggling active status:', error);
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent': return 'urgent';
      case 'high': return 'high';
      case 'medium': return 'medium';
      case 'low': return 'low';
      default: return 'medium';
    }
  };

  // Filter announcements by search query
  const filteredAnnouncements = announcements.filter(announcement => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      announcement.title.toLowerCase().includes(query) ||
      announcement.message.toLowerCase().includes(query) ||
      announcement.created_by.toLowerCase().includes(query)
    );
  });

  return (
    <div className="announcements-container">
      <div className="announcements-header">
        <div className="header-content">
          <Megaphone size={32} />
          <div>
            <h2>Announcements</h2>
            <p>Create and manage school-wide announcements</p>
          </div>
        </div>
        <button className="create-announcement-btn" onClick={handleCreateNew}>
          <Plus size={18} />
          Create Announcement
        </button>
      </div>

      {/* Filters */}
      <div className="announcements-filters">
        <div className="filter-row">
          <div className="filter-group">
            <label>
              <Filter size={16} />
              Audience
            </label>
            <select value={filterAudience} onChange={(e) => setFilterAudience(e.target.value)}>
              <option value="">All Audiences</option>
              <option value="everyone">Everyone</option>
              <option value="students">Students</option>
              <option value="teachers">Teachers</option>
              <option value="parents">Parents</option>
              <option value="specific">Specific Users</option>
            </select>
          </div>

          <div className="filter-group">
            <label>
              <AlertCircle size={16} />
              Priority
            </label>
            <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)}>
              <option value="">All Priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          <div className="filter-group">
            <label>
              <Eye size={16} />
              Status
            </label>
            <select value={filterActive} onChange={(e) => setFilterActive(e.target.value)}>
              <option value="">All Statuses</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>

          <div className="filter-group search-group">
            <label>
              <Search size={16} />
              Search
            </label>
            <input
              type="text"
              placeholder="Search by title, message, or creator..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Announcements List */}
      <div className="announcements-content">
        {loading ? (
          <div className="loading-state">
            <Loader size={32} className="spin" />
            <p>Loading announcements...</p>
          </div>
        ) : filteredAnnouncements.length === 0 ? (
          <div className="empty-state">
            <Megaphone size={64} />
            <h3>No Announcements Found</h3>
            <p>Create your first announcement to get started</p>
          </div>
        ) : (
          <div className="announcements-grid">
            {filteredAnnouncements.map((announcement) => (
              <div key={announcement.id} className={`announcement-card ${!announcement.is_active ? 'inactive' : ''}`}>
                <div className="announcement-card-header">
                  <div className="announcement-meta">
                    <span className={`priority-badge ${getPriorityColor(announcement.priority)}`}>
                      {announcement.priority_display}
                    </span>
                    <span className="audience-badge">
                      <Users size={14} />
                      {announcement.audience_display}
                    </span>
                  </div>
                  <div className="announcement-actions">
                    <button
                      className="icon-btn"
                      onClick={() => handleToggleActive(announcement)}
                      title={announcement.is_active ? 'Deactivate' : 'Activate'}
                    >
                      {announcement.is_active ? <Eye size={16} /> : <EyeOff size={16} />}
                    </button>
                    <button className="icon-btn" onClick={() => handleEdit(announcement)} title="Edit">
                      <Edit size={16} />
                    </button>
                    <button className="icon-btn delete" onClick={() => handleDelete(announcement.id)} title="Delete">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <h3 className="announcement-title">{announcement.title}</h3>
                <p className="announcement-message">{announcement.message}</p>

                <div className="announcement-footer">
                  <div className="announcement-stats">
                    <span>Recipients: <strong>{announcement.recipients_count}</strong></span>
                    <span>Read by: <strong>{announcement.read_count}</strong></span>
                  </div>
                  <div className="announcement-info">
                    <span className="creator">By {announcement.created_by}</span>
                    <span className="date">{new Date(announcement.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => !submitting && setShowModal(false)}>
          <div className="announcement-modal" onClick={(e) => e.stopPropagation()}>
            {submitting && (
              <div className="modal-loading-overlay">
                <div className="loading-content">
                  <Loader size={48} className="spin" />
                  <p>Sending announcement...</p>
                  <small>This may take a moment depending on the number of recipients</small>
                </div>
              </div>
            )}
            <div className="modal-header">
              <h3>{editingAnnouncement ? 'Edit Announcement' : 'Create Announcement'}</h3>
              <button className="close-modal-btn" onClick={() => setShowModal(false)} disabled={submitting}>×</button>
            </div>

            <form onSubmit={handleSubmit} className="announcement-form">
              <div className="form-group">
                <label>Title <span className="required">*</span></label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                  placeholder="Enter announcement title"
                />
              </div>

              <div className="form-group">
                <label>Message <span className="required">*</span></label>
                <textarea
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  required
                  rows="5"
                  placeholder="Enter announcement message"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Send Type <span className="required">*</span></label>
                  <select
                    value={formData.send_type}
                    onChange={(e) => setFormData({ ...formData, send_type: e.target.value })}
                  >
                    <option value="manual">Send Manually (Immediate)</option>
                    <option value="scheduled">Schedule for Later</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Priority <span className="required">*</span></label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              {formData.send_type === 'scheduled' && (
                <div className="form-row">
                  <div className="form-group">
                    <label>Scheduled Date <span className="required">*</span></label>
                    <input
                      type="date"
                      value={formData.scheduled_date}
                      onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                      min={new Date().toISOString().split('T')[0]}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Scheduled Time <span className="required">*</span></label>
                    <input
                      type="time"
                      value={formData.scheduled_time}
                      onChange={(e) => setFormData({ ...formData, scheduled_time: e.target.value })}
                      required
                    />
                  </div>
                </div>
              )}

              <div className="form-group">
                <label>Audience <span className="required">*</span></label>
                <select
                  value={formData.audience}
                  onChange={(e) => setFormData({ ...formData, audience: e.target.value })}
                >
                  <option value="everyone">Everyone</option>
                  <option value="students">All Students</option>
                  <option value="teachers">All Teachers</option>
                  <option value="parents">All Parents</option>
                  <option value="specific">Specific Users</option>
                </select>
              </div>

              {formData.audience === 'students' && (
                <div className="form-group">
                  <label>Student Targeting Filter</label>
                  <select
                    value={formData.student_filter}
                    onChange={(e) => setFormData({ ...formData, student_filter: e.target.value })}
                  >
                    <option value="all">All Students</option>
                    <option value="owing_fees">Students Owing Fees</option>
                    <option value="low_attendance">Students with Attendance Below 50%</option>
                    <option value="low_assignment">Students with Assignment Scores Below 50%</option>
                    <option value="low_test">Students with Test Scores Below 50%</option>
                  </select>
                  <small>Filter students based on specific criteria</small>
                </div>
              )}

              {formData.audience === 'parents' && (
                <div className="form-group">
                  <label>Parent Targeting Filter</label>
                  <select
                    value={formData.parent_filter}
                    onChange={(e) => setFormData({ ...formData, parent_filter: e.target.value })}
                  >
                    <option value="all">All Parents</option>
                    <option value="owing_fees">Parents with Students Owing Fees</option>
                    <option value="low_attendance">Parents with Students Having Attendance Below 50%</option>
                  </select>
                  <small>Filter parents based on their children's criteria</small>
                </div>
              )}

              {formData.audience === 'teachers' && (
                <div className="form-group">
                  <label>Teacher Targeting Filter</label>
                  <select
                    value={formData.teacher_filter}
                    onChange={(e) => setFormData({ ...formData, teacher_filter: e.target.value })}
                  >
                    <option value="all">All Teachers</option>
                    <option value="incomplete_grading">Teachers with Incomplete Grading After Deadline</option>
                  </select>
                  <small>Filter teachers based on grading completion status</small>
                </div>
              )}

              {formData.audience === 'teachers' && formData.teacher_filter === 'incomplete_grading' && (
                <div className="form-group">
                  <label>Grading Deadline (Exam End Date) <span className="required">*</span></label>
                  <input
                    type="date"
                    value={formData.grading_deadline}
                    onChange={(e) => setFormData({ ...formData, grading_deadline: e.target.value })}
                    max={new Date().toISOString().split('T')[0]}
                    required
                  />
                  <small>Teachers who haven't completed grading by this date will receive the notification</small>
                </div>
              )}

              {formData.audience === 'specific' && (
                <div className="form-group">
                  <label>Select Specific Users ({formData.specific_users.length} selected)</label>
                  <div className="user-search-container">
                    <input
                      type="text"
                      placeholder="Search users by name, username, email, or role..."
                      value={userSearchQuery}
                      onChange={(e) => setUserSearchQuery(e.target.value)}
                      className="user-search-input"
                    />
                    <Search size={18} className="search-icon" />
                  </div>
                  <div className="users-checkbox-list">
                    {filteredUsers.length === 0 ? (
                      <p className="no-users-message">No users found</p>
                    ) : (
                      filteredUsers.map(user => (
                        <label key={user.id} className="user-checkbox-item">
                          <input
                            type="checkbox"
                            checked={formData.specific_users.includes(user.id)}
                            onChange={() => handleUserToggle(user.id)}
                          />
                          <div className="user-info">
                            <span className="user-name">{user.full_name}</span>
                            <span className="user-meta">@{user.username} • {user.role}</span>
                          </div>
                        </label>
                      ))
                    )}
                  </div>
                  <small>{formData.specific_users.length} user(s) selected</small>
                </div>
              )}

              {(formData.audience === 'students' || formData.audience === 'parents') && (
                <div className="form-group">
                  <label>Filter by Classes (Optional)</label>
                  <select
                    multiple
                    value={formData.specific_classes}
                    onChange={(e) => {
                      const options = Array.from(e.target.selectedOptions);
                      setFormData({ ...formData, specific_classes: options.map(o => parseInt(o.value)) });
                    }}
                    size="5"
                  >
                    {classes.map(cls => (
                      <option key={cls.id} value={cls.id}>
                        {cls.name}
                      </option>
                    ))}
                  </select>
                  <small>Leave empty to send to all {formData.audience}</small>
                </div>
              )}

              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.is_recurring}
                    onChange={(e) => setFormData({ ...formData, is_recurring: e.target.checked })}
                  />
                  <span>Make this a recurring announcement</span>
                </label>
                <small>Send this announcement repeatedly at regular intervals</small>
              </div>

              {formData.is_recurring && (
                <div className="form-group">
                  <label>Recurrence Frequency (Days) <span className="required">*</span></label>
                  <input
                    type="number"
                    min="1"
                    value={formData.recurrence_days}
                    onChange={(e) => setFormData({ ...formData, recurrence_days: e.target.value })}
                    placeholder="e.g., 10 for every 10 days"
                    required={formData.is_recurring}
                  />
                  <small>
                    {formData.recurrence_days && formData.recurrence_days > 0
                      ? `This announcement will be sent every ${formData.recurrence_days} day(s)`
                      : 'Enter the number of days between each send'}
                  </small>
                </div>
              )}

              <div className="modal-actions">
                <button type="button" className="cancel-btn" onClick={() => setShowModal(false)} disabled={submitting}>
                  Cancel
                </button>
                <button type="submit" className="submit-btn" disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader size={16} className="spin" style={{ marginRight: '8px' }} />
                      Sending...
                    </>
                  ) : (
                    editingAnnouncement ? 'Update Announcement' : 'Create Announcement'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Announcements;
