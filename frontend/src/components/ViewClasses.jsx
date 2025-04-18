import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './ViewClasses.css';

const ViewClasses = () => {
  const [classes, setClasses] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [filters, setFilters] = useState({
    name: '',
    term: '',
    academic_year: '',
    department: '',
  });
  const [academicYears, setAcademicYears] = useState([]);
  const [showDepartment, setShowDepartment] = useState(false);

  const token = localStorage.getItem('accessToken');

  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const res = await axios.get('http://127.0.0.1:8000/api/academics/classes/', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setClasses(res.data);
      } catch (err) {
        console.error('Failed to load classes', err);
      }
    };

    fetchClasses();
  }, [token]);

  const classOptions = [...new Set(classes.map(cls => cls.name))];

  const handleChange = e => {
    const { name, value } = e.target;
    const newFilters = { ...filters, [name]: value };
    setFilters(newFilters);

    if (name === 'name') {
      setShowDepartment(['S.S.S.1', 'S.S.S.2', 'S.S.S.3'].includes(value));
      setFilters(prev => ({
        ...prev,
        department: '',
        academic_year: '',
        name: value,
      }));
    }

    if ((name === 'term' || name === 'name') && (newFilters.name && newFilters.term)) {
      const years = classes
        .filter(cls => cls.name === newFilters.name && cls.term === newFilters.term)
        .map(cls => cls.academic_year);
      const uniqueYears = [...new Set(years)];
      setAcademicYears(uniqueYears);
    }
  };

  const handleFilter = () => {
    const results = classes.filter(cls =>
      cls.name === filters.name &&
      cls.term === filters.term &&
      (!filters.academic_year || cls.academic_year === filters.academic_year) &&
      (!filters.department || cls.department === filters.department)
    );
    setFiltered(results);
  };

  return (
    <div className="view-classes-wrapper">
      <div className="view-classes-container">
        <h3>View Classes</h3>

        <div className="filters">
          <select name="name" value={filters.name} onChange={handleChange} required>
            <option value="">Select Class</option>
            {classOptions.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>

          <select name="term" value={filters.term} onChange={handleChange} required>
            <option value="">Select Term</option>
            <option value="First Term">First Term</option>
            <option value="Second Term">Second Term</option>
            <option value="Third Term">Third Term</option>
          </select>

          <select
            name="academic_year"
            value={filters.academic_year}
            onChange={handleChange}
          >
            <option value="">Select Academic Year</option>
            {academicYears.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>

          {showDepartment && (
            <select
              name="department"
              value={filters.department}
              onChange={handleChange}
            >
              <option value="">Select Department</option>
              <option value="Science">Science</option>
              <option value="Arts">Arts</option>
              <option value="Commercial">Commercial</option>
            </select>
          )}

          <button onClick={handleFilter}>Filter</button>
        </div>

        <div className="results">
          {filtered.length === 0 ? (
            <p>No classes found for selected filters.</p>
          ) : (
            <table className="class-table">
              <thead>
                <tr>
                  <th>Class</th>
                  <th>Academic Year</th>
                  <th>Term</th>
                  <th>Department</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(cls => (
                  <tr key={cls.id}>
                    <td>{cls.name}</td>
                    <td>{cls.academic_year}</td>
                    <td>{cls.term}</td>
                    <td>{cls.department || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default ViewClasses;
