import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Select from 'react-select';
import API_BASE_URL from '../config';

import './CreateSubjectForm.css';

const CreateSubjectForm = () => {
  const [activeForm, setActiveForm] = useState('create');
  const [createdSubjects, setCreatedSubjects] = useState([]);
  const [existingSubjects, setExistingSubjects] = useState([]);
  const [subjectName, setSubjectName] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState('');
  const [assignmentData, setAssignmentData] = useState({
    subjects: [],
    classes: [],
    academic_year: '',
    term: '',
    teacher: '',
    departments: []
  });

  const [permanentClasses, setPermanentClasses] = useState([]);
  const [classSessions, setClassSessions] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [showDepartment, setShowDepartment] = useState(false);
  const [message, setMessage] = useState('');
  const token = localStorage.getItem('accessToken');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [classRes, sessionRes, teacherRes, subjectRes] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/academics/classes/`, { headers: { Authorization: `Bearer ${token}` } }),
          axios.get(`${API_BASE_URL}/api/academics/sessions/`, { headers: { Authorization: `Bearer ${token}` } }),
          axios.get(`${API_BASE_URL}/api/users/teachers/`, { headers: { Authorization: `Bearer ${token}` } }),
          axios.get(`${API_BASE_URL}/api/academics/subjects/`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);

        setPermanentClasses(classRes.data);
        setClassSessions(sessionRes.data);
        setTeachers(teacherRes.data.filter(user => user.role === 'teacher'));
        setExistingSubjects(subjectRes.data);

        const years = new Set(sessionRes.data.map(s => s.academic_year));
        setAcademicYears([...years]);
      } catch (err) {
        console.error('Error fetching data:', err);
      }
    };

    fetchData();
  }, [token]);

  useEffect(() => {
    if (subjectName.trim()) {
      const existsInStaged = createdSubjects.some(s => s.toLowerCase() === subjectName.toLowerCase());
      const existsInBackend = existingSubjects.some(s => s.name.toLowerCase() === subjectName.toLowerCase());
      if (existsInStaged || existsInBackend) {
        setDuplicateWarning('Subject already exists.');
      } else {
        setDuplicateWarning('');
      }
    } else {
      setDuplicateWarning('');
    }
  }, [subjectName, createdSubjects, existingSubjects]);

  const handleAddSubject = (e) => {
    e.preventDefault();
    setMessage('');

    if (!subjectName.trim()) {
      setMessage('Subject name cannot be empty.');
      return;
    }

    if (duplicateWarning) {
      setMessage('Cannot add duplicate subject.');
      return;
    }

    setCreatedSubjects(prev => [...prev, subjectName.trim()]);
    setSubjectName('');
    setMessage('Subject added to list.');
  };

  const handleDeleteSubject = (nameToDelete) => {
    setCreatedSubjects(prev => prev.filter(name => name !== nameToDelete));
    setAssignmentData(prev => ({
      ...prev,
      subjects: prev.subjects.filter(s => s !== nameToDelete)
    }));
  };

  const handleAssignmentSelectChange = (selectedOptions, name) => {
    const values = selectedOptions ? selectedOptions.map(opt => opt.value) : [];
    setAssignmentData(prev => {
      const updated = { ...prev, [name]: values };

      if (name === 'classes') {
        const selectedNames = values.map(id => {
          const cls = permanentClasses.find(c => c.id === id);
          return cls?.name;
        });
        const isSenior = selectedNames.some(name => ['S.S.S.1', 'S.S.S.2', 'S.S.S.3'].includes(name));
        setShowDepartment(isSenior);
      }

      return updated;
    });
  };

  const handleSingleChange = (option, name) => {
    setAssignmentData(prev => ({ ...prev, [name]: option ? option.value : '' }));
  };

  const handleAssignSubjects = async (e) => {
    e.preventDefault();
    setMessage('');

    const { subjects, classes, academic_year, term, teacher, departments } = assignmentData;

    if (!subjects.length || !classes.length || !academic_year || !term || !teacher) {
      setMessage('All fields are required.');
      return;
    }

    const matchedSessions = classSessions.filter(sess =>
      classes.includes(sess.classroom?.id) &&
      sess.academic_year === academic_year &&
      sess.term === term
    );

    if (!matchedSessions.length) {
      setMessage('No matching class sessions found.');
      return;
    }

    const payload = [];

    subjects.forEach((sub) => {
      matchedSessions.forEach(session => {
        if (showDepartment && departments.length > 0) {
          if (departments.includes('General')) {
            payload.push({
              name: sub,
              teacher: teacher,
              class_session_id: session.id,
              department: 'General'
            });
          } else {
            departments.forEach(dept => {
              payload.push({
                name: sub,
                teacher: teacher,
                class_session_id: session.id,
                department: dept
              });
            });
          }
        } else {
          payload.push({
            name: sub,
            teacher: teacher,
            class_session_id: session.id
          });
        }
      });
    });

    try {
      await axios.post(`${API_BASE_URL}/api/academics/subjects/`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setMessage('Subjects assigned successfully.');
      setAssignmentData({
        subjects: [],
        classes: [],
        academic_year: '',
        term: '',
        teacher: '',
        departments: []
      });
    } catch (err) {
      console.error('Error assigning subjects:', err);
      setMessage('Failed to assign subjects.');
    }
  };

  const allSubjectOptions = [
    ...createdSubjects,
    ...existingSubjects.map(sub => sub.name)
  ]
    .filter((value, index, self) => self.indexOf(value) === index)
    .map(name => ({ value: name, label: name }));

  return (
    <div className="create-subject-wrapper">
      <div className="create-subject-container">
        <div className="toggle-buttons">
          <button className={activeForm === 'create' ? 'active' : ''} onClick={() => setActiveForm('create')}>Create Subject</button>
          <button className={activeForm === 'assign' ? 'active' : ''} onClick={() => setActiveForm('assign')}>Add Subjects</button>
        </div>

        {activeForm === 'create' ? (
          <>
            <h3>Create Subject</h3>
            <form onSubmit={handleAddSubject} className="create-subject-form">
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input
                  type="text"
                  name="name"
                  placeholder="Enter subject name"
                  value={subjectName}
                  onChange={(e) => setSubjectName(e.target.value)}
                  required
                />
                <button type="submit" disabled={!!duplicateWarning}>+</button>
              </div>
              {duplicateWarning && <p className="error-msg">{duplicateWarning}</p>}
              {createdSubjects.length > 0 && (
                <ul className="created-subjects-list">
                  {createdSubjects.map((sub, idx) => (
                    <li key={idx}>
                      {sub}
                      <span onClick={() => handleDeleteSubject(sub)}>&#x2716;</span>
                    </li>
                  ))}
                </ul>
              )}
            </form>
          </>
        ) : (
          <>
            <h3>Add Subjects</h3>
            <form onSubmit={handleAssignSubjects} className="create-subject-form">
              <Select
                isMulti
                name="subjects"
                value={assignmentData.subjects.map(val => ({ value: val, label: val }))}
                onChange={(selected) => handleAssignmentSelectChange(selected, 'subjects')}
                options={allSubjectOptions}
                placeholder="Select Subject(s)"
              />

              <Select
                isMulti
                name="classes"
                value={assignmentData.classes.map(val => ({
                  value: val,
                  label: permanentClasses.find(c => c.id === val)?.name || val
                }))}
                onChange={(selected) => handleAssignmentSelectChange(selected, 'classes')}
                options={permanentClasses.map(cls => ({ value: cls.id, label: cls.name }))}
                placeholder="Select Class(es)"
              />

              <Select
                name="academic_year"
                value={assignmentData.academic_year ? { value: assignmentData.academic_year, label: assignmentData.academic_year } : null}
                onChange={(option) => handleSingleChange(option, 'academic_year')}
                options={academicYears.map(y => ({ value: y, label: y }))}
                placeholder="Select Academic Year"
              />

              <Select
                name="term"
                value={assignmentData.term ? { value: assignmentData.term, label: assignmentData.term } : null}
                onChange={(option) => handleSingleChange(option, 'term')}
                options={[
                  { value: 'First Term', label: 'First Term' },
                  { value: 'Second Term', label: 'Second Term' },
                  { value: 'Third Term', label: 'Third Term' }
                ]}
                placeholder="Select Term"
              />

              <Select
                name="teacher"
                value={assignmentData.teacher ? {
                  value: assignmentData.teacher,
                  label: teachers.find(t => t.id === assignmentData.teacher)?.first_name + ' ' + teachers.find(t => t.id === assignmentData.teacher)?.last_name
                } : null}
                onChange={(option) => handleSingleChange(option, 'teacher')}
                options={teachers.map(t => ({ value: t.id, label: `${t.first_name} ${t.last_name}` }))}
                placeholder="Select Teacher"
              />

              {showDepartment && (
                <Select
                  isMulti
                  name="departments"
                  value={assignmentData.departments.map(val => ({ value: val, label: val }))}
                  onChange={(selected) => handleAssignmentSelectChange(selected, 'departments')}
                  options={[
                    { value: 'General', label: 'General' },
                    { value: 'Science', label: 'Science' },
                    { value: 'Arts', label: 'Arts' },
                    { value: 'Commercial', label: 'Commercial' }
                  ]}
                  placeholder="Select Department(s)"
                />
              )}

              <button type="submit">Add Subjects</button>
            </form>
          </>
        )}

        {message && (
          <p className={`form-message ${message.includes('successfully') ? 'success' : 'error'}`}>
            {message}
          </p>
        )}
      </div>
    </div>
  );
};

export default CreateSubjectForm;
