import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Select from 'react-select';
import EditFeeModal from './EditFeeModal';
import FeeStudentModal from './FeeStudentModal';
import './viewfees.css';
import './createfees.css';
import { useDialog } from '../contexts/DialogContext';

import API_BASE_URL from '../config';

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
    backgroundColor: '#fff',
  }),
  option: (base, state) => ({
    ...base,
    color: '#000',
    backgroundColor: state.isFocused ? '#f3f4f6' : '#fff',
  }),
  singleValue: (base) => ({
    ...base,
    color: '#000',
  }),
  multiValueLabel: (base) => ({
    ...base,
    color: '#000',
  }),
  placeholder: (base) => ({
    ...base,
    color: '#9ca3af',
  }),
  menu: (base) => ({
    ...base,
    backgroundColor: '#fff',
    zIndex: 1000,
  }),
};

const CreateFeeStructure = () => {
  const { showConfirm } = useDialog();
  const [activeTab, setActiveTab] = useState('create');

  // form state
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [academicYear, setAcademicYear] = useState(null);
  const [term, setTerm] = useState(termOptions[0]);
  const [selectedClasses, setSelectedClasses] = useState([]);

  // lookups
  const [allClasses, setAllClasses] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [fees, setFees] = useState([]);

  // messages
  const [message, setMessage] = useState('');

  // edit‐fee modal
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [feeToEdit, setFeeToEdit] = useState(null);

  // expand a fee to show its classes
  const [expandedFee, setExpandedFee] = useState(null);
  const [classStudentsData, setClassStudentsData] = useState(null);

  // click on one class to open FeeStudentModal
  const [selectedClassInfo, setSelectedClassInfo] = useState(null);

  const token = localStorage.getItem('accessToken');

  // fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [classRes, sessionRes, feeRes] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/academics/classes/`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          axios.get(`${API_BASE_URL}/api/academics/sessions/`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          axios.get(`${API_BASE_URL}/api/schooladmin/fees/`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        setAllClasses(classRes.data || []);

        // sessionRes.data might not be an array
        const sessions = Array.isArray(sessionRes.data) ? sessionRes.data : [];
        const years = sessions.map(s => s.academic_year);
        const unique = [...new Set(years)];
        setAcademicYears(unique.map(y => ({ value: y, label: y })));

        setFees(feeRes.data || []);
      } catch (err) {
        console.error('Error fetching data:', err);
      }
    };

    fetchData();
  }, [token]);

  // Reset class‐student details whenever you collapse the fee list
  useEffect(() => {
    if (expandedFee === null) {
      setClassStudentsData(null);
      setSelectedClassInfo(null);
    }
  }, [expandedFee]);

  // handle create form
  const handleSubmit = async e => {
    e.preventDefault();
    setMessage('');
    if (!name || !amount || !academicYear || selectedClasses.length === 0) {
      return setMessage('Please fill in all fields and select at least one class.');
    }
    try {
      await axios.post(
        `${API_BASE_URL}/api/schooladmin/fees/create/`,
        {
          name,
          amount,
          academic_year: academicYear.value,
          term: term.value,
          classes: selectedClasses.map(c => c.value),
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessage('Fee structure created successfully.');
      // reset form
      setName('');
      setAmount('');
      setAcademicYear(null);
      setTerm(termOptions[0]);
      setSelectedClasses([]);
      // refresh list
      const res = await axios.get(`${API_BASE_URL}/api/schooladmin/fees/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setFees(res.data || []);
    } catch (err) {
      console.error(err);
      setMessage('Something went wrong.');
    }
  };

  const handleDelete = async feeId => {
    const confirmed = await showConfirm({
      title: 'Delete Fee Structure',
      message: 'Are you sure you want to delete this fee structure? This action cannot be undone.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      confirmButtonClass: 'confirm-btn-danger'
    });
    if (!confirmed) return;

    try {
      await axios.delete(`${API_BASE_URL}/api/schooladmin/fees/${feeId}/delete/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setFees(f => f.filter(x => x.id !== feeId));
      setMessage('Deleted.');
    } catch (err) {
      console.error(err);
      setMessage('Delete failed.');
    }
  };

  const handleEditClick = fee => {
    setFeeToEdit(fee);
    setEditModalVisible(true);
  };
  const handleModalUpdate = updated => {
    setFees(f => f.map(x => (x.id === updated.id ? updated : x)));
  };

  // expand/collapse fee → load its classes
  const handleFeeNameClick = async fee => {
    if (expandedFee === fee.id) {
      setExpandedFee(null);
    } else {
      setExpandedFee(fee.id);
      setSelectedClassInfo(null);
      try {
        const res = await axios.get(
          `${API_BASE_URL}/api/schooladmin/fees/${fee.id}/students/`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        // ensure array
        setClassStudentsData(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error('Error loading students by class:', err);
        setClassStudentsData([]);
      }
    }
  };

  // click on one class row
  const handleClassClick = info => {
    setSelectedClassInfo(info);
  };

  // filter the fee list by year+term
  const filteredFees = fees.filter(fee =>
    (!academicYear || fee.academic_year === academicYear.value) &&
    (!term || fee.term === term.value)
  );

  return (
    <div className="create-fee-wrapper">
      <div className="create-fee-container">
        <div className="fee-tabs">
          <button className={activeTab==='create' ? 'active-tab':''} onClick={()=>setActiveTab('create')}>Create Fee</button>
          <button className={activeTab==='view'   ? 'active-tab':''} onClick={()=>setActiveTab('view')}>View Fees</button>
        </div>

        {message && <p className="fee-message">{message}</p>}

        {activeTab==='create' && (
          <form onSubmit={handleSubmit} className="fee-form">
            <input type="text" placeholder="e.g. First Term Tuition" value={name} onChange={e=>setName(e.target.value)}/>
            <input type="number" placeholder="Amount" value={amount} onChange={e=>setAmount(e.target.value)}/>
            <div className="full-width">
              <label>Academic Year</label>
              <Select
                options={academicYears}
                value={academicYear}
                onChange={setAcademicYear}
                placeholder="Select year"
                isSearchable
                styles={customSelectStyles}
              />
            </div>
            <div className="full-width">
              <label>Term</label>
              <Select options={termOptions} value={term} onChange={setTerm} styles={customSelectStyles}/>
            </div>
            <div className="full-width">
              <label>Classes</label>
              <Select
                isMulti
                options={allClasses.map(c=>({value:c.id,label:c.name}))}
                value={selectedClasses}
                onChange={setSelectedClasses}
                styles={customSelectStyles}
              />
            </div>
            <button type="submit" className="submit-btn">Create Fee</button>
          </form>
        )}

        {activeTab==='view' && (
          <div className="fee-list">
            <div className="fee-filter">
              <div className="filter-item">
                <label>Year:</label>
                <Select
                  options={academicYears}
                  value={academicYear}
                  onChange={setAcademicYear}
                  placeholder="Filter by year"
                  styles={customSelectStyles}
                />
              </div>
              <div className="filter-item">
                <label>Term:</label>
                <Select
                  options={termOptions}
                  value={term}
                  onChange={setTerm}
                  placeholder="Filter by term"
                  styles={customSelectStyles}
                />
              </div>
            </div>

            {filteredFees.length===0
              ? <p>No fees for these filters.</p>
              : <div className="view-fees-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Name</th><th>Amt</th><th>Year</th><th>Term</th><th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredFees.map(fee=>(
                        <tr key={fee.id}>
                          <td
                            style={{cursor:'pointer',color:'#1565c0',fontWeight:'bold'}}
                            onClick={()=>handleFeeNameClick(fee)}
                          >{fee.name}</td>
                          <td>₦{fee.amount}</td>
                          <td>{fee.academic_year}</td>
                          <td>{fee.term}</td>
                          <td>
                            <span className="fee-edit-text"   onClick={()=>handleEditClick(fee)}>Edit</span>
                            <span className="fee-delete-text" onClick={()=>handleDelete(fee.id)}>Delete</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
            }

            {/* class‐details only if array */}
            {expandedFee != null && Array.isArray(classStudentsData) && (
              <div className="class-details">
                <h3>Classes under “{fees.find(f=>f.id===expandedFee)?.name}”</h3>
                <table>
                  <thead>
                    <tr>
                      <th>Class</th><th>#Students</th><th>Paid</th><th>Outstanding</th>
                    </tr>
                  </thead>
                  <tbody>
                    {classStudentsData.map(c=>(
                      <tr
                        key={c.classId}
                        onClick={()=>handleClassClick({...c,feeId:expandedFee})}
                        style={{cursor:'pointer'}}
                      >
                        <td>{c.className}</td>
                        <td>{Array.isArray(c.students)?c.students.length:0}</td>
                        <td>₦{c.paid}</td>
                        <td>₦{c.outstanding}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {/* if it’s non‐array (error?) */}
            {expandedFee != null && !Array.isArray(classStudentsData) && (
              <p className="no-match-message">Failed to load classes</p>
            )}
          </div>
        )}

        {editModalVisible && feeToEdit && (
          <EditFeeModal
            fee={feeToEdit}
            onClose={()=>setEditModalVisible(false)}
            onUpdated={handleModalUpdate}
          />
        )}

        {selectedClassInfo && (
          <FeeStudentModal
            data={{
              className:    selectedClassInfo.className,
              students:     selectedClassInfo.students,
              paid:         selectedClassInfo.paid,
              outstanding:  selectedClassInfo.outstanding,
              feeId:        selectedClassInfo.feeId
            }}
            onClose={()=>setSelectedClassInfo(null)}
          />
        )}
      </div>
    </div>
  );
};

export default CreateFeeStructure;
