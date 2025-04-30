import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Select from 'react-select';
import * as XLSX from 'xlsx';
import './feestudentmodal.css';

const paymentStatusOptions = [
  { value: 'ALL', label: 'All' },
  { value: 'PAID', label: 'Paid' },
  { value: 'UNPAID', label: 'Unpaid' }
];

const FeeStudentModal = ({ fee, onClose }) => {
  const token = localStorage.getItem('accessToken');
  const [records, setRecords] = useState([]);
  const [filteredRecords, setFilteredRecords] = useState([]);
  const [selectedStatus, setSelectedStatus] = useState(paymentStatusOptions[0]);

  // Prevent errors if `fee` or `fee.name` is missing
  const feeName = fee?.name || 'Unknown Fee';

  useEffect(() => {
    const fetchRecords = async () => {
      try {
        const res = await axios.get(`http://127.0.0.1:8000/api/schooladmin/fee-students/${fee.id}/`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setRecords(res.data);
        setFilteredRecords(res.data);
      } catch (err) {
        console.error('Error fetching student fee records:', err);
      }
    };

    fetchRecords();
  }, [fee.id, token]);

  useEffect(() => {
    if (selectedStatus.value === 'ALL') {
      setFilteredRecords(records);
    } else {
      const filtered = records.filter(rec => rec.payment_status === selectedStatus.value);
      setFilteredRecords(filtered);
    }
  }, [selectedStatus, records]);

  const exportToExcel = () => {
    const data = filteredRecords.map(rec => ({
      Student: rec.student_name,
      Fee: rec.fee_name,
      AmountPaid: rec.amount_paid,
      DatePaid: rec.date_paid || 'N/A',
      PaymentStatus: rec.payment_status
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'FeeRecords');
    XLSX.writeFile(workbook, `${feeName.replace(/\s+/g, '_')}_Records.xlsx`);
  };

  return (
    <div className="fee-student-modal-overlay">
      <div className="fee-student-modal">
        <h3>{feeName} — Student Records</h3>

        <div className="filter-export-row">
          <div className="status-filter">
            <label>Filter by Payment Status:</label>
            <Select
              options={paymentStatusOptions}
              value={selectedStatus}
              onChange={setSelectedStatus}
              styles={{ control: base => ({ ...base, fontSize: '0.9rem' }) }}
            />
          </div>
          <button className="export-btn" onClick={exportToExcel}>Export to Excel</button>
        </div>

        <div className="student-fee-table-container">
          <table className="student-fee-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Fee</th>
                <th>Amount Paid</th>
                <th>Date Paid</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.length === 0 ? (
                <tr><td colSpan="5" style={{ textAlign: 'center' }}>No records match selected filter.</td></tr>
              ) : (
                filteredRecords.map(rec => (
                  <tr key={rec.student_id}>
                    <td>{rec.student_name}</td>
                    <td>{rec.fee_name}</td>
                    <td>₦{rec.amount_paid}</td>
                    <td>{rec.date_paid || '—'}</td>
                    <td>{rec.payment_status}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <button className="close-modal-btn" onClick={onClose}>Close</button>
      </div>
    </div>
  );
};

export default FeeStudentModal;
