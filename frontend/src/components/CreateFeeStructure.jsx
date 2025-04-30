import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Select from 'react-select';
import EditFeeModal from './EditFeeModal';
import FeeStudentModal from './FeeStudentModal';
import './viewfees.css';
import './createfees.css';

const termOptions = [
  { value: 'First Term', label: 'First Term' },
  { value: 'Second Term', label: 'Second Term' },
  { value: 'Third Term', label: 'Third Term' },
];

const customSelectStyles = {
  control: (base) => ({
    ...base,
    borderColor: '#ccc',
    fontSize: '1rem',
  }),
  option: (base, state) => ({
    ...base,
    color: '#111',
    backgroundColor: state.isFocused ? '#f0f0f0' : '#fff',
  }),
  singleValue: (base) => ({
    ...base,
    color: '#111',
  }),
  multiValueLabel: (base) => ({
    ...base,
    color: '#111',
  }),
};

const CreateFeeStructure = () => {
  const [activeTab, setActiveTab] = useState('create');
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [academicYear, setAcademicYear] = useState(null);
  const [term, setTerm] = useState(termOptions[0]);
  const [selectedClasses, setSelectedClasses] = useState([]);
  const [allClasses, setAllClasses] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [fees, setFees] = useState([]);
  const [message, setMessage] = useState('');
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [feeToEdit, setFeeToEdit] = useState(null);
  const [expandedFee, setExpandedFee] = useState(null);
  const [classStudentsData, setClassStudentsData] = useState(null);
  const [selectedClassInfo, setSelectedClassInfo] = useState(null);

  const token = localStorage.getItem('accessToken');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [classRes, sessionRes, feeRes] = await Promise.all([
          axios.get('http://127.0.0.1:8000/api/academics/classes/', {
            headers: { Authorization: `Bearer ${token}` },
          }),
          axios.get('http://127.0.0.1:8000/api/academics/sessions/', {
            headers: { Authorization: `Bearer ${token}` },
          }),
          axios.get('http://127.0.0.1:8000/api/schooladmin/fees/', {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        setAllClasses(classRes.data);
        const years = sessionRes.data.map((s) => s.academic_year);
        setAcademicYears([...new Set(years)].map((y) => ({ value: y, label: y })));
        setFees(feeRes.data);
      } catch (err) {
        console.error('Error fetching data:', err);
      }
    };

    fetchData();
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');

    if (!name || !amount || !academicYear || selectedClasses.length === 0) {
      return setMessage('Please fill in all required fields and select at least one class.');
    }

    try {
      await axios.post(
        'http://127.0.0.1:8000/api/schooladmin/fees/create/',
        {
          name,
          amount,
          academic_year: academicYear.value,
          term: term.value,
          classes: selectedClasses.map((c) => c.value),
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setMessage('Fee structure created successfully!');
      setName('');
      setAmount('');
      setAcademicYear(null);
      setTerm(termOptions[0]);
      setSelectedClasses([]);

      const res = await axios.get('http://127.0.0.1:8000/api/schooladmin/fees/', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setFees(res.data);
    } catch (err) {
      console.error('Error creating fee:', err);
      setMessage('Something went wrong. Please try again.');
    }
  };

  const handleDelete = async (feeId) => {
    if (!window.confirm('Are you sure you want to delete this fee?')) return;

    try {
      await axios.delete(`http://127.0.0.1:8000/api/schooladmin/fees/${feeId}/delete/`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setFees((prev) => prev.filter((f) => f.id !== feeId));
      setMessage('Fee deleted successfully.');
    } catch (err) {
      console.error('Error deleting fee:', err);
      setMessage('Failed to delete fee.');
    }
  };

  const handleEditClick = (fee) => {
    setFeeToEdit(fee);
    setEditModalVisible(true);
  };

  const handleModalUpdate = (updatedFee) => {
    setFees((prev) => prev.map((f) => (f.id === updatedFee.id ? updatedFee : f)));
  };

  const handleFeeNameClick = async (fee) => {
    if (expandedFee === fee.id) {
      setExpandedFee(null);
    } else {
      setExpandedFee(fee.id);
      try {
        const res = await axios.get(`http://127.0.0.1:8000/api/schooladmin/fees/${fee.id}/students/`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setClassStudentsData(res.data);
      } catch (err) {
        console.error('Error fetching class-student data:', err);
      }
    }
  };

  const handleClassClick = (classInfo) => {
    setSelectedClassInfo(classInfo);
  };

  const filteredFees = fees.filter(
    (fee) =>
      (!academicYear || fee.academic_year === academicYear.value) &&
      (!term || fee.term === term.value)
  );

  return (
    <div className="create-fee-wrapper">
      <div className="create-fee-container">
        <div className="fee-tabs">
          <button className={activeTab === 'create' ? 'active-tab' : ''} onClick={() => setActiveTab('create')}>
            Create Fee
          </button>
          <button className={activeTab === 'view' ? 'active-tab' : ''} onClick={() => setActiveTab('view')}>
            View Fees
          </button>
        </div>

        {message && <p className="fee-message">{message}</p>}

        {activeTab === 'create' && (
          <form onSubmit={handleSubmit} className="fee-form">
            <input type="text" placeholder="e.g. First Term Tuition" value={name} onChange={(e) => setName(e.target.value)} />
            <input type="number" placeholder="Enter amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <div className="full-width">
              <label>Academic Year:</label>
              <Select options={academicYears} value={academicYear} onChange={setAcademicYear} placeholder="Select academic year" isSearchable styles={customSelectStyles} />
            </div>
            <div className="full-width">
              <label>Term:</label>
              <Select options={termOptions} value={term} onChange={setTerm} placeholder="Select term" styles={customSelectStyles} />
            </div>
            <div className="full-width">
              <label>Select Classes:</label>
              <Select
                isMulti
                options={allClasses.map((cls) => ({ value: cls.id, label: cls.name }))}
                value={selectedClasses}
                onChange={setSelectedClasses}
                placeholder="Select classes"
                styles={customSelectStyles}
              />
            </div>
            <button type="submit" className="submit-btn">Create Fee</button>
          </form>
        )}

        {activeTab === 'view' && (
          <div className="fee-list">
            <div className="fee-filter">
              <div className="filter-item">
                <label>Academic Year:</label>
                <Select options={academicYears} value={academicYear} onChange={setAcademicYear} placeholder="Filter by academic year" styles={customSelectStyles} />
              </div>
              <div className="filter-item">
                <label>Term:</label>
                <Select options={termOptions} value={term} onChange={setTerm} placeholder="Filter by term" styles={customSelectStyles} />
              </div>
            </div>

            {filteredFees.length === 0 ? (
              <p>No fees found for selected filters.</p>
            ) : (
              <div className="view-fees-table">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Amount</th>
                      <th>Academic Year</th>
                      <th>Term</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredFees.map((fee) => (
                      <tr key={fee.id}>
                        <td style={{ cursor: 'pointer', color: '#1565c0', fontWeight: 'bold' }} onClick={() => handleFeeNameClick(fee)}>
                          {fee.name}
                        </td>
                        <td>₦{fee.amount}</td>
                        <td>{fee.academic_year}</td>
                        <td>{fee.term}</td>
                        <td>
                          <button className="edit-btn" onClick={() => handleEditClick(fee)}>Edit</button>
                          <button className="delete-btn" onClick={() => handleDelete(fee.id)}>Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {expandedFee && classStudentsData && (
              <div className="class-details">
                <h3>Classes under {fees.find(f => f.id === expandedFee)?.name}</h3>
                <table>
                  <thead>
                    <tr>
                      <th>Class Name</th>
                      <th>Students</th>
                      <th>Paid</th>
                      <th>Outstanding</th>
                    </tr>
                  </thead>
                  <tbody>
                    {classStudentsData.map((c) => (
                      <tr key={c.classId} onClick={() => handleClassClick({ ...c, feeId: expandedFee })} style={{ cursor: 'pointer' }}>
                        <td>{c.className}</td>
                        <td>{c.students.length}</td>
                        <td>{c.paid}</td>
                        <td>{c.outstanding}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {editModalVisible && feeToEdit && (
          <EditFeeModal
            fee={feeToEdit}
            onClose={() => setEditModalVisible(false)}
            onUpdated={handleModalUpdate}
          />
        )}

        {selectedClassInfo && (
          <FeeStudentModal
            fee={{
              id: selectedClassInfo.feeId,
              name: fees.find(f => f.id === selectedClassInfo.feeId)?.name || '',
            }}
            onClose={() => setSelectedClassInfo(null)}
          />
        )}
      </div>
    </div>
  );
};

export default CreateFeeStructure;
