import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import axios from 'axios';
import * as XLSX from 'xlsx';
import './feestudentmodal.css';

const paymentStatusOptions = [
  { value: 'ALL', label: 'All' },
  { value: 'PAID', label: 'Paid' },
  { value: 'UNPAID', label: 'Unpaid' },
];

const FeeStudentModal = ({ data = {}, onClose }) => {
  const {
    className = 'Class',
    students = [],
  } = data;

  const token = localStorage.getItem('accessToken');

  // Local state copy so we can edit in-place
  const [records, setRecords] = useState([]);
  const [selectedStatus, setSelectedStatus] = useState(paymentStatusOptions[0]);
  const [filteredRecords, setFilteredRecords] = useState([]);
  const [editedPaid, setEditedPaid] = useState({});
  const [saving, setSaving] = useState(false);

  // 1) Initialize when `students` arrives
  useEffect(() => {
    setRecords(students);
    const initPaid = {};
    students.forEach(s => {
      if (s.record_id != null) initPaid[s.record_id] = s.amount_paid;
    });
    setEditedPaid(initPaid);
  }, [students]);

  // 2) Recompute filteredRecords on status or data change
  useEffect(() => {
    setFilteredRecords(
      selectedStatus.value === 'ALL'
        ? records
        : records.filter(r => r.payment_status === selectedStatus.value)
    );
  }, [records, selectedStatus]);

  // 3) Handle inline edits
  const handlePaidChange = (recordId, value) => {
    setEditedPaid(prev => ({
      ...prev,
      [recordId]: value === '' ? '' : parseFloat(value)
    }));
  };

  // 4) Save only changed records, then update local state
  const handleSave = async () => {
    setSaving(true);
    try {
      // figure out which ones actually changed
      const toUpdate = Object.entries(editedPaid).filter(([rid, amt]) => {
        const original = records.find(r => r.record_id === +rid)?.amount_paid;
        return amt !== original;
      });

      // batch PATCH
      await Promise.all(toUpdate.map(([rid, amount_paid]) =>
        axios.patch(
          `http://127.0.0.1:8000/api/schooladmin/fee-records/${rid}/update/`,
          { amount_paid },
          { headers: { Authorization: `Bearer ${token}` } }
        )
      ));

      // update UI immediately
      setRecords(prev =>
        prev.map(r => {
          const rid = r.record_id;
          if (editedPaid[rid] !== undefined) {
            const newPaid = editedPaid[rid];
            return {
              ...r,
              amount_paid: newPaid,
              outstanding: r.fee_amount - newPaid,
              payment_status: newPaid >= r.fee_amount ? 'PAID' : r.payment_status,
            };
          }
          return r;
        })
      );

      alert('Payment records updated successfully.');
    } catch (err) {
      console.error(err);
      alert('Failed to update one or more records.');
    }
    setSaving(false);
  };

  // 5) Export current filter to Excel
  const exportToExcel = () => {
    const sheetData = filteredRecords.map(r => ({
      Student: r.full_name,
      Username: r.username,
      Fee: r.fee_name,
      AmountPaid: editedPaid[r.record_id],
      Outstanding: r.outstanding,
      PaymentStatus: r.payment_status,
    }));
    const ws = XLSX.utils.json_to_sheet(sheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Students');
    XLSX.writeFile(wb, `${className.replace(/\s+/g, '_')}_Students.xlsx`);
  };

  return (
    <div className="fee-student-modal-overlay">
      <div className="fee-student-modal">
        <h3>{className} — Student Fee Records</h3>

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
          <button className="export-btn" onClick={exportToExcel}>
            Export to Excel
          </button>
        </div>

        <div className="student-fee-table-container">
          <table className="student-fee-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Username</th>
                <th>Fee</th>
                <th>Paid</th>
                <th>Outstanding</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center' }}>
                    No records match selected filter.
                  </td>
                </tr>
              ) : (
                filteredRecords.map(r => (
                  <tr key={r.record_id}>
                    <td>{r.full_name}</td>
                    <td>{r.username}</td>
                    <td>{r.fee_name}</td>
                    <td>
                      <input
                        type="number"
                        className="edit-paid-input"
                        placeholder="₦0"
                        min="0"
                        value={editedPaid[r.record_id] ?? ''}
                        onChange={e => handlePaidChange(r.record_id, e.target.value)}
                      />
                    </td>
                    <td>₦{r.outstanding}</td>
                    <td>{r.payment_status}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="modal-footer-buttons">
          <button
            className="save-btn"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            className="fee_student_close-btn"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default FeeStudentModal;
