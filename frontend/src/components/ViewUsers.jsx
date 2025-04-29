import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Select from 'react-select';
import EditUserModal from './EditUserModal';
import EditParentModal from './EditParentModal';
import './ViewUsers.css';

const ViewUsers = () => {
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

  const token = localStorage.getItem('accessToken');

  useEffect(() => {
    axios.get('http://127.0.0.1:8000/api/academics/sessions/', {
      headers: { Authorization: `Bearer ${token}` }
    })
    .then(res => {
      const years = [...new Set(res.data.map(s => s.academic_year))];
      setAcademicYears(years);
    })
    .catch(err => console.error('Error loading academic years:', err));
  }, [token]);

  const handleFilter = async () => {
    try {
      if (userType === 'student') {
        let query = '';
        if (academicYear) query += `academic_year=${academicYear}`;
        if (term) query += `${query ? '&' : ''}term=${term}`;

        const res = await axios.get(`http://127.0.0.1:8000/api/users/students-with-subjects/?${query}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setUsers(res.data);
      } else if (userType === 'parent') {
        const res = await axios.get('http://127.0.0.1:8000/api/users/list-parents/', {
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

  const handleEdit = (user) => {
    setSelectedUser(user);
    setShowEditModal(true);
  };

  const handleDelete = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    try {
      await axios.delete(`http://127.0.0.1:8000/api/users/${userId}/`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setFilteredUsers(prev => prev.filter(u => u.id !== userId));
      alert('User deleted successfully.');
    } catch (err) {
      console.error('Error deleting user:', err);
      alert('Failed to delete user.');
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
            }}
            options={[
              { value: 'student', label: 'Student' },
              { value: 'teacher', label: 'Teacher' },
              { value: 'parent', label: 'Parent' }
            ]}
            placeholder="Select User Type"
            isClearable
          />

          {userType === 'student' && (
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

        {/* Student Table */}
        {userType === 'student' && users.length > 0 && (
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
                      <th>Parent</th>
                      <th>Phone</th>
                      <th>Email</th>
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
                        <td>{user.parent?.full_name || '—'}</td>
                        <td>{user.parent?.phone_number || '—'}</td>
                        <td>{user.parent?.email || '—'}</td>
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

        {/* Edit Modal */}
        {showEditModal && selectedUser && userType === 'student' && (
          <EditUserModal 
            user={selectedUser}
            onClose={() => setShowEditModal(false)}
            onUpdated={(updatedUser) => {
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
