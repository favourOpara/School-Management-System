import React, { useEffect, useState } from 'react';
import axios from 'axios';
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
          axios.get('http://127.0.0.1:8000/api/academics/classes/', { headers: { Authorization: `Bearer ${token}` } }),
          axios.get('http://127.0.0.1:8000/api/academics/sessions/', { headers: { Authorization: `Bearer ${token}` } }),
          axios.get('http://127.0.0.1:8000/api/users/teachers/', { headers: { Authorization: `Bearer ${token}` } }),
          axios.get('http://127.0.0.1:8000/api/academics/subjects/', { headers: { Authorization: `Bearer ${token}` } }),
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

  const handleAssignmentChange = (e) => {
    const { name, value, options } = e.target;

    if (name === 'classes') {
      const selected = Array.from(options).filter(o => o.selected).map(o => o.value);
      setAssignmentData(prev => ({ ...prev, classes: selected }));

      const classNames = selected.map(id => {
        const cls = permanentClasses.find(c => c.id.toString() === id);
        return cls?.name;
      });

      const isSenior = classNames.some(name =>
        ['S.S.S.1', 'S.S.S.2', 'S.S.S.3'].includes(name)
      );
      setShowDepartment(isSenior);
    } else if (name === 'subjects' || name === 'departments') {
      const selected = Array.from(options).filter(o => o.selected).map(o => o.value);
      setAssignmentData(prev => ({ ...prev, [name]: selected }));
    } else {
      setAssignmentData(prev => ({ ...prev, [name]: value }));
    }
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
      classes.includes(String(sess.classroom?.id)) &&
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
          departments.forEach(dept => {
            payload.push({
              name: sub,
              teacher: teacher,
              class_session_id: session.id,
              department: dept
            });
          });
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
      await axios.post('http://127.0.0.1:8000/api/academics/subjects/', payload, {
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
              {duplicateWarning && (
                <p style={{ color: 'red', marginTop: '0.5rem' }}>{duplicateWarning}</p>
              )}
              {createdSubjects.length > 0 && (
                <ul className="created-subjects-list" style={{ marginTop: '1rem' }}>
                  {createdSubjects.map((sub, idx) => (
                    <li key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#333' }}>
                      {sub}
                      <span
                        style={{ color: 'red', cursor: 'pointer', marginLeft: '10px' }}
                        onClick={() => handleDeleteSubject(sub)}
                      >
                        &#x2716;
                      </span>
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
              <select name="subjects" multiple value={assignmentData.subjects} onChange={handleAssignmentChange} required>
                <option disabled value="">Select Subject(s)</option>
                {createdSubjects.map((sub, index) => (
                  <option key={index} value={sub}>{sub}</option>
                ))}
              </select>

              <select name="classes" multiple value={assignmentData.classes} onChange={handleAssignmentChange} required>
                <option disabled value="">Select Class(es)</option>
                {permanentClasses.map(cls => (
                  <option key={cls.id} value={cls.id}>{cls.name}</option>
                ))}
              </select>

              <select name="academic_year" value={assignmentData.academic_year} onChange={handleAssignmentChange} required>
                <option value="">Select Academic Year</option>
                {academicYears.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>

              <select name="term" value={assignmentData.term} onChange={handleAssignmentChange} required>
                <option value="">Select Term</option>
                <option value="First Term">First Term</option>
                <option value="Second Term">Second Term</option>
                <option value="Third Term">Third Term</option>
              </select>

              <select name="teacher" value={assignmentData.teacher} onChange={handleAssignmentChange} required>
                <option value="">Select Teacher</option>
                {teachers.map(t => (
                  <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>
                ))}
              </select>

              {showDepartment && (
                <select name="departments" multiple value={assignmentData.departments} onChange={handleAssignmentChange} required>
                  <option value="Science">Science</option>
                  <option value="Arts">Arts</option>
                  <option value="Commercial">Commercial</option>
                </select>
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
