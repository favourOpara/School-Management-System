import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import axios from 'axios';
import API_BASE_URL from '../config';

import './EditFeeModal.css';

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

const EditFeeModal = ({ fee, onClose, onUpdated }) => {
  const token = localStorage.getItem('accessToken');
  const [name, setName] = useState(fee.name);
  const [amount, setAmount] = useState(fee.amount);
  const [academicYear, setAcademicYear] = useState({ value: fee.academic_year, label: fee.academic_year });
  const [term, setTerm] = useState(termOptions.find(opt => opt.value === fee.term));
  const [allClasses, setAllClasses] = useState([]);
  const [selectedClasses, setSelectedClasses] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [classRes, sessionRes] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/academics/classes/`, {
            headers: { Authorization: `Bearer ${token}` }
          }),
          axios.get(`${API_BASE_URL}/api/academics/sessions/`, {
            headers: { Authorization: `Bearer ${token}` }
          }),
        ]);

        const formattedClassOptions = classRes.data.map(c => ({ value: c.id, label: c.name }));
        setAllClasses(formattedClassOptions);

        const years = sessionRes.data.map(s => s.academic_year);
        const uniqueYears = [...new Set(years)].map(year => ({ value: year, label: year }));
        setAcademicYears(uniqueYears);

        const preselected = formattedClassOptions.filter(cls => fee.classes.includes(cls.value));
        setSelectedClasses(preselected);

      } catch (err) {
        console.error('Error loading edit modal data:', err);
      }
    };

    fetchInitialData();
  }, [fee.classes, fee.term, fee.academic_year, token]);

  const handleUpdate = async (e) => {
    e.preventDefault();
    setMessage('');

    try {
      const response = await axios.put(
        `${API_BASE_URL}/api/schooladmin/fees/${fee.id}/edit/`,
        {
          name,
          amount,
          academic_year: academicYear.value,
          term: term.value,
          classes: selectedClasses.map(c => c.value),
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      setMessage('Fee updated successfully.');
      onUpdated(response.data);
      onClose();
    } catch (err) {
      console.error('Error updating fee:', err);
      setMessage('Failed to update fee.');
    }
  };

  return (
    <div className="edit-fee-modal-overlay">
      <div className="edit-fee-modal">
        <h3>Edit Fee Structure</h3>
        {message && <p className="modal-message">{message}</p>}
        <form onSubmit={handleUpdate} className="edit-fee-form">
          <input
            type="text"
            placeholder="Fee Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <input
            type="number"
            placeholder="Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />

          <Select
            options={academicYears}
            value={academicYear}
            onChange={setAcademicYear}
            placeholder="Select Academic Year"
            styles={customSelectStyles}
          />

          <Select
            options={termOptions}
            value={term}
            onChange={setTerm}
            placeholder="Select Term"
            styles={customSelectStyles}
          />

          <Select
            isMulti
            options={allClasses}
            value={selectedClasses}
            onChange={setSelectedClasses}
            placeholder="Select Classes"
            styles={customSelectStyles}
          />

          <div className="modal-actions">
            <button type="submit" className="save-btn">Save</button>
            <button type="button" className="cancel-btn" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditFeeModal;
