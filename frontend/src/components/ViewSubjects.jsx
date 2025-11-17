// src/components/ViewSubjects.jsx
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Select from 'react-select';
import './ViewSubjects.css';
import SubjectModal from './SubjectModal';
import { useDialog } from '../contexts/DialogContext';

const ViewSubjects = () => {
  const { showConfirm, showAlert } = useDialog();
  const token = localStorage.getItem('accessToken');
  const [academicYears, setAcademicYears] = useState([]);
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('');
  const [classes, setClasses] = useState([]);
  const [filteredClasses, setFilteredClasses] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [modalSubjects, setModalSubjects] = useState([]);
  const [modalClassName, setModalClassName] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [classSessionRes, classRes] = await Promise.all([
          axios.get('http://127.0.0.1:8000/api/academics/sessions/', {
            headers: { Authorization: `Bearer ${token}` },
          }),
          axios.get('http://127.0.0.1:8000/api/academics/classes/', {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        const years = [...new Set(classSessionRes.data.map(sess => sess.academic_year))];
        setAcademicYears(years);
        setClasses(classRes.data);
      } catch (err) {
        console.error('❌ Error loading class or session data:', err);
      }
    };

    fetchData();
  }, [token]);

  const handleFilter = async () => {
    try {
      const res = await axios.get('http://127.0.0.1:8000/api/academics/sessions/', {
        headers: { Authorization: `Bearer ${token}` },
      });

      const matchedSessions = res.data.filter(
        sess => sess.academic_year === selectedYear && sess.term === selectedTerm
      );

      const matchedClassIds = matchedSessions.map(sess => sess.classroom.id);
      const filtered = classes.filter(cls => matchedClassIds.includes(cls.id));
      setFilteredClasses(filtered);
    } catch (err) {
      console.error('❌ Failed to filter classes:', err);
    }
  };

  const handleClassClick = async (classObj) => {
    const classId = classObj.id;

    try {
      const res = await axios.get('http://127.0.0.1:8000/api/academics/subjects/', {
        headers: { Authorization: `Bearer ${token}` },
      });

      const filteredSubjects = res.data.filter(sub => {
        const session = sub.class_session;
        if (!session || !session.classroom) return false;

        return (
          session.classroom.id === classId &&
          session.academic_year === selectedYear &&
          session.term === selectedTerm
        );
      });

      setModalSubjects(filteredSubjects);
      setModalClassName(classObj.name);
      setShowModal(true);
    } catch (err) {
      console.error('❌ Error fetching subjects:', err);
    }
  };

  const handleSubjectDelete = async (subjectId, subjectName) => {
    // Show confirmation dialog before deleting
    const confirmed = await showConfirm({
      title: 'Delete Subject',
      message: 'Are you sure you want to delete this subject? This action cannot be undone.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      confirmButtonClass: 'confirm-btn-danger'
    });

    if (!confirmed) {
      return; // User cancelled
    }

    try {
      await axios.delete(`http://127.0.0.1:8000/api/academics/subjects/${subjectId}/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setModalSubjects(prev => prev.filter(sub => sub.id !== subjectId));
    } catch (err) {
      console.error('❌ Error deleting subject:', err);
      showAlert({
        type: 'error',
        message: 'Failed to delete subject. Please try again.'
      });
    }
  };

  const handleSubjectEdit = async (subjectId, updatedData) => {
    try {
      await axios.put(`http://127.0.0.1:8000/api/academics/subjects/${subjectId}/`, updatedData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setModalSubjects(prev => prev.map(sub =>
        sub.id === subjectId ? { ...sub, ...updatedData } : sub
      ));
    } catch (err) {
      console.error('❌ Error editing subject:', err);
    }
  };

  return (
    <div className="view-subjects-page-wrapper">
      <div className="view-subjects-page-container">
        <h2 className="section-header">View Subjects</h2>

        <div className="filter-section">
          <Select
            className="filter-select"
            classNamePrefix="react-select"
            value={selectedYear ? { value: selectedYear, label: selectedYear } : null}
            onChange={(option) => setSelectedYear(option ? option.value : '')}
            options={academicYears.map(year => ({ value: year, label: year }))}
            placeholder="Select Academic Year"
            isClearable
          />

          <Select
            className="filter-select"
            classNamePrefix="react-select"
            value={selectedTerm ? { value: selectedTerm, label: selectedTerm } : null}
            onChange={(option) => setSelectedTerm(option ? option.value : '')}
            options={[
              { value: 'First Term', label: 'First Term' },
              { value: 'Second Term', label: 'Second Term' },
              { value: 'Third Term', label: 'Third Term' }
            ]}
            placeholder="Select Term"
            isClearable
          />

          <button onClick={handleFilter}>Filter</button>
        </div>

        <div className="class-list">
          {filteredClasses.map(cls => (
            <div key={cls.id} className="class-card" onClick={() => handleClassClick(cls)}>
              <h4>{cls.name}</h4>
            </div>
          ))}
        </div>

        {showModal && (
          <SubjectModal
            subjects={modalSubjects}
            onClose={() => setShowModal(false)}
            onUpdate={handleSubjectEdit}
            onDelete={handleSubjectDelete}
            modalClassName="view-subjects-modal"
            overlayClassName="view-subjects-modal-overlay"
          />
        )}
      </div>
    </div>
  );
};

export default ViewSubjects;