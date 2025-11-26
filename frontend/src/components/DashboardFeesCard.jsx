import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Select from 'react-select';
import { DollarSign } from 'lucide-react';
import FeeStudentModal from './FeeStudentModal';
import './DashboardCards.css';

const termOptions = [
  { value: 'First Term', label: 'First Term' },
  { value: 'Second Term', label: 'Second Term' },
  { value: 'Third Term', label: 'Third Term' },
];

const getBarColor = (pct) => {
  if (pct < 50) return '#d32f2f';
  if (pct < 70) return '#f9a825';
  if (pct < 80) return '#fbc02d';
  return '#388e3c';
};

const selectStyles = {
  control: (base) => ({
    ...base,
    fontSize: '0.95rem',
    color: '#222',
    backgroundColor: '#fff',
    borderColor: '#ccc',
  }),
  singleValue: (base) => ({
    ...base,
    color: '#222',
  }),
  placeholder: (base) => ({
    ...base,
    color: '#555',
  }),
  menu: (base) => ({
    ...base,
    fontSize: '0.95rem',
    color: '#222',
  }),
};

const DashboardFeesCard = () => {
  const [academicYears, setAcademicYears] = useState([]);
  const [selectedYear, setSelectedYear] = useState(null);
  const [selectedTerm, setSelectedTerm] = useState(termOptions[0]);
  const [classStats, setClassStats] = useState([]);
  const [modalClass, setModalClass] = useState(null);
  const [isFiltered, setIsFiltered] = useState(false); // For mobile filter

  const token = localStorage.getItem('accessToken');
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    const fetchYears = async () => {
      try {
        // First, get the current active session
        const sessionInfoRes = await axios.get('http://127.0.0.1:8000/api/schooladmin/session/info/', { headers });
        const currentYear = sessionInfoRes.data.academic_year;
        const currentTerm = sessionInfoRes.data.current_term;

        // Then get all available sessions
        const res = await axios.get('http://127.0.0.1:8000/api/academics/sessions/', { headers });
        if (Array.isArray(res.data)) {
          const years = [...new Set(res.data.map(s => s.academic_year))].sort();
          const options = years.map(y => ({ value: y, label: y }));
          setAcademicYears(options);

          // Set the current active session as default
          const currentYearOption = options.find(opt => opt.value === currentYear);
          if (currentYearOption) {
            setSelectedYear(currentYearOption);
            const currentTermOption = termOptions.find(opt => opt.value === currentTerm);
            if (currentTermOption) {
              setSelectedTerm(currentTermOption);
            }
          } else if (options.length > 0) {
            // Fallback to the last year if current year is not found
            setSelectedYear(options[options.length - 1]);
          }
        }
      } catch (err) {
        console.error('Error fetching academic years:', err);
      }
    };
    fetchYears();
  }, []);

  useEffect(() => {
    const fetchStats = async () => {
      if (!selectedYear || !selectedTerm || (window.innerWidth <= 768 && !isFiltered)) return;
      
      try {
        const res = await axios.get(
          `http://127.0.0.1:8000/api/schooladmin/fees/dashboard/?academic_year=${selectedYear.value}&term=${selectedTerm.value}`,
          { headers }
        );
        if (Array.isArray(res.data)) {
          const enriched = res.data.map(c => {
            const total = c.paid + c.outstanding;
            const pct = total > 0 ? Math.round((c.paid / total) * 100) : 0;
            return { ...c, pct };
          }).sort((a, b) => a.pct - b.pct);
          setClassStats(enriched);
        } else {
          setClassStats([]);
        }
      } catch (err) {
        console.error('Error fetching class fee stats:', err);
        setClassStats([]);
      }
    };
    fetchStats();
  }, [selectedYear, selectedTerm, isFiltered]);

  // Toggle filter state
  const toggleFilters = () => {
    setIsFiltered(!isFiltered);
  };

  return (
    <div className={`dashboard-cards ${isFiltered ? 'filters-active' : ''}`}>
      <div className="dashboard-card">
        <div className="card-header">
          <DollarSign size={28} color="#10b981" />
          <div>
            <h2>Fees by Class</h2>
            <p>Track fee payment status</p>
          </div>
        </div>

        <div className="card-filters">
          <Select
            options={academicYears}
            value={selectedYear}
            onChange={setSelectedYear}
            placeholder="Year"
            styles={selectStyles}
            className="card-filter-select"
          />
          <Select
            options={termOptions}
            value={selectedTerm}
            onChange={setSelectedTerm}
            placeholder="Term"
            styles={selectStyles}
            className="card-filter-select"
          />
          {/* Mobile-only filter button */}
          <button
            className="dashboard-filter-btn"
            onClick={toggleFilters}
          >
            Filter
          </button>
          {/* Mobile-only close button */}
          <button
            className="dashboard-close-btn"
            onClick={toggleFilters}
          >
            Close
          </button>
        </div>

        <ul className="class-list">
          {window.innerWidth <= 768 && !isFiltered ? (
            <li className="no-data">Select filters and click 'Filter' to view data</li>
          ) : classStats.length === 0 ? (
            <li className="no-data">No data</li>
          ) : (
            classStats.map(cls => (
              <li key={cls.classId} onClick={() => setModalClass(cls)}>
                <span className="class-name">{cls.className}</span>
                <div className="progress-bar">
                  <div
                    className="filled"
                    style={{
                      width: `${cls.pct}%`,
                      backgroundColor: getBarColor(cls.pct)
                    }}
                  />
                </div>
                <span className="pct-label">{cls.pct}%</span>
              </li>
            ))
          )}
        </ul>
      </div>

      {modalClass && (
        <FeeStudentModal
          data={{
            className: modalClass.className,
            students: modalClass.students || [],
            feeId: modalClass.fee_structure_id
          }}
          onClose={() => setModalClass(null)}
        />
      )}
    </div>
  );
};

export default DashboardFeesCard;