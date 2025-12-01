import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Select from 'react-select';
import EditUserModal from './EditUserModal';
import EditParentModal from './EditParentModal';
import EditTeacherModal from './EditTeacherModal';
import './ViewUsers.css';
import { useDialog } from '../contexts/DialogContext';

import API_BASE_URL from '../config';

const ViewUsers = () => {
  const { showConfirm, showAlert } = useDialog();
  const [userType, setUserType] = useState('');
  const [academicYear, setAcademicYear] = useState('');
  const [term, setTerm] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [academicYears, setAcademicYears] = useState([]);
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [classFilter, setClassFilter] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  
  // Student history state
  const [viewMode, setViewMode] = useState('current');
  const [studentHistory, setStudentHistory] = useState([]);
  const [selectedStudentHistory, setSelectedStudentHistory] = useState(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  const token = localStorage.getItem('accessToken');

  useEffect(() => {
    axios.get(`${API_BASE_URL}/api/academics/sessions/`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    .then(res => {
      const years = [...new Set(res.data.map(s => s.academic_year))];
      setAcademicYears(years);
    })
    .catch(err => console.error('Error loading academic years:', err));
  }, [token]);

  const fetchStudentHistory = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/users/student-history/`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStudentHistory(res.data);
      setUsers([]);
      setFilteredUsers([]);
    } catch (err) {
      console.error('Error fetching student history:', err);
      showAlert({
        type: 'error',
        message: 'Failed to load student history.'
      });
    }
  };

  const handleFilter = async () => {
    try {
      if (userType === 'student') {
        if (viewMode === 'history') {
          await fetchStudentHistory();
          return;
        }

        let query = '';
        if (academicYear) query += `academic_year=${academicYear}`;
        if (term) query += `${query ? '&' : ''}term=${term}`;

        const res = await axios.get(`${API_BASE_URL}/api/users/students-with-subjects/?${query}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setUsers(res.data);
      } else if (userType === 'teacher') {
        // Fetch teachers
        const res = await axios.get(`${API_BASE_URL}/api/users/list-teachers/`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setUsers(res.data);
      } else if (userType === 'parent') {
        const res = await axios.get(`${API_BASE_URL}/api/users/list-parents/`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        const parentsWithClassroom = res.data.map(parent => {
          let classroom = null;
          if (parent.children && parent.children.length > 0) {
            classroom = parent.children[0]?.classroom || null;
          }
          return {
            ...parent,
            classroom,
            phone_number: parent.phone_number || null,
            email: parent.email || null,
          };
        });

        setUsers(parentsWithClassroom);
      }

      setFilteredUsers([]);
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  };

  const applyInTableFilters = () => {
    const result = users.filter(user => {
      const matchesSearch = searchTerm.trim()
        ? user.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.username.toLowerCase().includes(searchTerm.toLowerCase())
        : true;
      const matchesClass = classFilter
        ? userType === 'student'
          ? user.classroom === classFilter
          : user.children?.some(child => child.classroom === classFilter)
        : true;
      const matchesSubject = userType === 'student' && subjectFilter
        ? user.subjects?.some(sub => sub.name === subjectFilter)
        : true;
      return matchesSearch && matchesClass && matchesSubject;
    });
    setFilteredUsers(result);
  };

  const applyHistoryFilters = () => {
    const result = studentHistory.filter(student => {
      const matchesSearch = searchTerm.trim()
        ? student.student_info.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          student.student_info.username.toLowerCase().includes(searchTerm.toLowerCase())
        : true;
      return matchesSearch;
    });
    setFilteredUsers(result);
  };

  const viewStudentHistory = async (studentId) => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/users/student-history/${studentId}/`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSelectedStudentHistory(res.data);
      setShowHistoryModal(true);
    } catch (err) {
      console.error('Error fetching individual student history:', err);
      showAlert({
        type: 'error',
        message: 'Failed to load student history.'
      });
    }
  };

  const handleEdit = (user) => {
    setSelectedUser(user);
    setShowEditModal(true);
  };

  const handleDelete = async (userId) => {
    const confirmed = await showConfirm({
      title: 'Delete User',
      message: 'Are you sure you want to delete this user? This action cannot be undone.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      confirmButtonClass: 'confirm-btn-danger'
    });
    if (!confirmed) return;

    try {
      await axios.delete(`${API_BASE_URL}/api/users/${userId}/`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsers(prev => prev.filter(u => u.id !== userId));
      setFilteredUsers(prev => prev.filter(u => u.id !== userId));
      showAlert({
        type: 'success',
        message: 'User deleted successfully.'
      });
    } catch (err) {
      console.error('Error deleting user:', err);
      showAlert({
        type: 'error',
        message: 'Failed to delete user.'
      });
    }
  };

  const uniqueSubjects = Array.from(new Set(users.flatMap(u => u.subjects?.map(s => s.name))));
  const uniqueClasses = Array.from(new Set(
    userType === 'student'
      ? users.map(u => u.classroom)
      : users.flatMap(p => p.children?.map(c => c.classroom))
  )).filter(Boolean);

  return (
    <div className="view-users-wrapper">
      <div className="view-users-container">
        <h2 className="section-header">View Users</h2>

        {/* Filters */}
        <div className="filters">
          <Select
            classNamePrefix="react-select"
            value={userType ? { value: userType, label: userType.charAt(0).toUpperCase() + userType.slice(1) } : null}
            onChange={(option) => {
              setUserType(option ? option.value : '');
              setAcademicYear('');
              setTerm('');
              setSearchTerm('');
              setClassFilter('');
              setSubjectFilter('');
              setUsers([]);
              setFilteredUsers([]);
              setStudentHistory([]);
              setViewMode('current');
            }}
            options={[
              { value: 'student', label: 'Student' },
              { value: 'teacher', label: 'Teacher' },
              { value: 'parent', label: 'Parent' }
            ]}
            placeholder="Select User Type"
            isClearable
          />

          {/* View Mode Toggle for Students */}
          {userType === 'student' && (
            <Select
              classNamePrefix="react-select"
              value={{ value: viewMode, label: viewMode === 'current' ? 'Current Students' : 'Student History' }}
              onChange={(option) => {
                setViewMode(option.value);
                setUsers([]);
                setFilteredUsers([]);
                setStudentHistory([]);
                if (option.value === 'current') {
                  setAcademicYear('');
                  setTerm('');
                }
              }}
              options={[
                { value: 'current', label: 'Current Students' },
                { value: 'history', label: 'Student History' }
              ]}
              placeholder="Select View Mode"
            />
          )}

          {userType === 'student' && viewMode === 'current' && (
            <>
              <Select
                classNamePrefix="react-select"
                value={academicYear ? { value: academicYear, label: academicYear } : null}
                onChange={(option) => setAcademicYear(option ? option.value : '')}
                options={academicYears.map(year => ({ value: year, label: year }))}
                placeholder="Select Academic Year"
                isClearable
              />

              <Select
                classNamePrefix="react-select"
                value={term ? { value: term, label: term } : null}
                onChange={(option) => setTerm(option ? option.value : '')}
                options={[
                  { value: 'First Term', label: 'First Term' },
                  { value: 'Second Term', label: 'Second Term' },
                  { value: 'Third Term', label: 'Third Term' }
                ]}
                placeholder="Select Term"
                isClearable
              />
            </>
          )}

          {userType === 'parent' && (
            <Select
              classNamePrefix="react-select"
              value={classFilter ? { value: classFilter, label: classFilter } : null}
              onChange={(option) => setClassFilter(option ? option.value : '')}
              options={[
                { value: '', label: 'All Classes' },
                ...uniqueClasses.map(cls => ({ value: cls, label: cls }))
              ]}
              placeholder="Filter by Class"
              isClearable={false}
            />
          )}

          <input
            type="text"
            placeholder={`Search ${userType}`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <button onClick={handleFilter}>Filter</button>
        </div>

        {/* Teacher Table */}
        {userType === 'teacher' && users.length > 0 && (
          <>
            <div className="filters table-subfilters">
              <button onClick={applyInTableFilters}>Apply Filters</button>
            </div>

            <div className="user-table">
              <table>
                <thead>
                  <tr>
                    <th>Full Name</th>
                    <th>Username</th>
                    <th>Gender</th>
                    <th>Email</th>
                    <th>Phone Number</th>
                    <th>Assigned Subjects</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(filteredUsers.length > 0 ? filteredUsers : users).map(teacher => (
                    <tr key={teacher.id}>
                      <td>{teacher.full_name}</td>
                      <td>{teacher.username}</td>
                      <td>{teacher.gender || '—'}</td>
                      <td>{teacher.email || '—'}</td>
                      <td>{teacher.phone_number || '—'}</td>
                      <td>
                        {teacher.assigned_subjects && teacher.assigned_subjects.length > 0 ? (
                          <div className="subjects-list">
                            {teacher.assigned_subjects.map((subject, index) => (
                              <div key={index} className="subject-item">
                                <strong>{subject.name}</strong> ({subject.classroom} - {subject.academic_year} {subject.term})
                                {subject.department !== 'General' && <span> - {subject.department}</span>}
                              </div>
                            ))}
                          </div>
                        ) : (
                          'No subjects assigned'
                        )}
                      </td>
                      <td>
                        <button onClick={() => handleEdit(teacher)}>Edit</button>
                        <button onClick={() => handleDelete(teacher.id)} className="delete-btn">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Student History Table */}
        {userType === 'student' && viewMode === 'history' && studentHistory.length > 0 && (
          <>
            <div className="filters table-subfilters">
              <button onClick={applyHistoryFilters}>Apply Filters</button>
            </div>

            {filteredUsers.length > 0 && (
              <div className="user-table">
                <table>
                  <thead>
                    <tr>
                      <th>Full Name</th>
                      <th>Username</th>
                      <th>Gender</th>
                      <th>Age</th>
                      <th>Department</th>
                      <th>Total Sessions</th>
                      <th>Current Session</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map(student => {
                      const currentSession = student.academic_sessions.find(s => s.is_active);
                      return (
                        <tr key={student.student_info.id}>
                          <td>{student.student_info.full_name}</td>
                          <td>{student.student_info.username}</td>
                          <td>{student.student_info.gender}</td>
                          <td>{student.student_info.age || '—'}</td>
                          <td>{student.student_info.department || '—'}</td>
                          <td>{student.academic_sessions.length}</td>
                          <td>
                            {currentSession 
                              ? `${currentSession.classroom} - ${currentSession.academic_year} - ${currentSession.term}`
                              : 'No active session'
                            }
                          </td>
                          <td>
                            <button onClick={() => viewStudentHistory(student.student_info.id)}>
                              View History
                            </button>
                            <button onClick={() => handleEdit(student.student_info)}>Edit</button>
                            <button onClick={() => handleDelete(student.student_info.id)} className="delete-btn">
                              Delete
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* Current Student Table */}
        {userType === 'student' && viewMode === 'current' && users.length > 0 && (
          <>
            <div className="filters table-subfilters">
              <Select
                classNamePrefix="react-select"
                value={classFilter ? { value: classFilter, label: classFilter } : null}
                onChange={(option) => setClassFilter(option ? option.value : '')}
                options={[
                  { value: '', label: 'All Classes' },
                  ...uniqueClasses.map(cls => ({ value: cls, label: cls }))
                ]}
                placeholder="Filter by Class"
                isClearable={false}
              />

              <Select
                classNamePrefix="react-select"
                value={subjectFilter ? { value: subjectFilter, label: subjectFilter } : null}
                onChange={(option) => setSubjectFilter(option ? option.value : '')}
                options={[
                  { value: '', label: 'All Subjects' },
                  ...uniqueSubjects.map(sub => ({ value: sub, label: sub }))
                ]}
                placeholder="Filter by Subject"
                isClearable={false}
              />

              <button onClick={applyInTableFilters}>Apply Filters</button>
            </div>

            {filteredUsers.length > 0 && (
              <div className="user-table">
                <table>
                  <thead>
                    <tr>
                      <th>Full Name</th>
                      <th>Middle Name</th>
                      <th>Username</th>
                      <th>Gender</th>
                      <th>Age</th>
                      <th>Class</th>
                      <th>Academic Year</th>
                      <th>Email</th>
                      <th>Parent</th>
                      <th>Phone</th>
                      <th>Department</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map(user => (
                      <tr key={user.id}>
                        <td>{user.full_name}</td>
                        <td>{user.middle_name}</td>
                        <td>{user.username}</td>
                        <td>{user.gender}</td>
                        <td>{user.age || '—'}</td>
                        <td>{user.classroom || '—'}</td>
                        <td>{user.academic_year}</td>
                        <td>{user.email || '—'}</td>
                        <td>{user.parent?.full_name || '—'}</td>
                        <td>{user.parent?.phone_number || '—'}</td>
                        <td>
                          {user.classroom?.startsWith('S.S.S.')
                            ? [...new Set(user.subjects?.map(sub => sub.department))].join(', ')
                            : '—'}
                        </td>
                        <td>
                          <button onClick={() => handleEdit(user)}>Edit</button>
                          <button onClick={() => handleDelete(user.id)} className="delete-btn">Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* Parent Table */}
        {userType === 'parent' && users.length > 0 && (
          <>
            <div className="filters table-subfilters">
              <button onClick={applyInTableFilters}>Apply Filters</button>
            </div>

            {filteredUsers.length > 0 && (
              <div className="user-table">
                <table>
                  <thead>
                    <tr>
                      <th>Full Name</th>
                      <th>Username</th>
                      <th>Phone</th>
                      <th>Email</th>
                      <th>Children</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map(parent => (
                      <tr key={parent.id}>
                        <td>{parent.first_name} {parent.last_name}</td>
                        <td>{parent.username}</td>
                        <td>{parent.phone_number || '—'}</td>
                        <td>{parent.email || '—'}</td>
                        <td>
                          {parent.children?.map(child => (
                            <div key={child.id}>
                              {child.full_name} ({child.username})
                            </div>
                          )) || '—'}
                        </td>
                        <td>
                          <button onClick={() => handleEdit(parent)}>Edit</button>
                          <button onClick={() => handleDelete(parent.id)} className="delete-btn">Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* Individual Student History Modal */}
        {showHistoryModal && selectedStudentHistory && (
          <div className="modal-overlay" onClick={() => setShowHistoryModal(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Academic History: {selectedStudentHistory.student_info.full_name}</h3>
                <button onClick={() => setShowHistoryModal(false)} className="close-btn">×</button>
              </div>
              <div className="modal-body">
                <div className="student-info">
                  <p><strong>Username:</strong> {selectedStudentHistory.student_info.username}</p>
                  <p><strong>Gender:</strong> {selectedStudentHistory.student_info.gender}</p>
                  <p><strong>Age:</strong> {selectedStudentHistory.student_info.age || 'N/A'}</p>
                  <p><strong>Department:</strong> {selectedStudentHistory.student_info.department || 'N/A'}</p>
                </div>
                
                <h4>Academic Sessions:</h4>
                <table className="history-table">
                  <thead>
                    <tr>
                      <th>Class</th>
                      <th>Academic Year</th>
                      <th>Term</th>
                      <th>Date Enrolled</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedStudentHistory.academic_sessions.map((session, index) => (
                      <tr key={index} className={session.is_active ? 'current-session' : 'historical-session'}>
                        <td>{session.classroom}</td>
                        <td>{session.academic_year}</td>
                        <td>{session.term}</td>
                        <td>{new Date(session.date_enrolled).toLocaleDateString()}</td>
                        <td>
                          <span className={`status ${session.is_active ? 'active' : 'inactive'}`}>
                            {session.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Edit Modals */}
        {showEditModal && selectedUser && userType === 'student' && (
          <EditUserModal 
            user={selectedUser}
            onClose={() => setShowEditModal(false)}
            onUpdated={(updatedUser) => {
              setUsers(prev =>
                prev.map(u => u.id === updatedUser.id ? { ...u, ...updatedUser } : u)
              );
              setFilteredUsers(prev =>
                prev.map(u => u.id === updatedUser.id ? { ...u, ...updatedUser } : u)
              );
            }}
          />
        )}

        {showEditModal && selectedUser && userType === 'teacher' && (
          <EditTeacherModal 
            user={selectedUser}
            onClose={() => setShowEditModal(false)}
            onUpdated={(updatedUser) => {
              setUsers(prev =>
                prev.map(u => u.id === updatedUser.id ? { ...u, ...updatedUser } : u)
              );
              setFilteredUsers(prev =>
                prev.map(u => u.id === updatedUser.id ? { ...u, ...updatedUser } : u)
              );
            }}
          />
        )}

        {showEditModal && selectedUser && userType === 'parent' && (
          <EditParentModal 
            user={selectedUser}
            onClose={() => setShowEditModal(false)}
            onUpdated={(updatedUser) => {
              setUsers(prev =>
                prev.map(u => u.id === updatedUser.id ? { ...u, ...updatedUser } : u)
              );
              setFilteredUsers(prev =>
                prev.map(u => u.id === updatedUser.id ? { ...u, ...updatedUser } : u)
              );
            }}
          />
        )}
      </div>
    </div>
  );
};

export default ViewUsers;