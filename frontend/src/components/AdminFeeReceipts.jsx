// src/components/AdminFeeReceipts.jsx
import React, { useState, useEffect } from 'react';
import { FileText, Search, Download, Calendar, Users, BookOpen, Loader, AlertCircle } from 'lucide-react';
import axios from 'axios';
import API_BASE_URL from '../config';

import './AdminFeeReceipts.css';

const AdminFeeReceipts = () => {
  const [loading, setLoading] = useState(true);
  const [receipts, setReceipts] = useState([]);
  const [filterData, setFilterData] = useState(null);

  // Filters
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const token = localStorage.getItem('accessToken');

  useEffect(() => {
    fetchReceipts();
  }, [selectedYear, selectedTerm, selectedClass]);

  const fetchReceipts = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedYear) params.append('academic_year', selectedYear);
      if (selectedTerm) params.append('term', selectedTerm);
      if (selectedClass) params.append('class_id', selectedClass);

      const url = `${API_BASE_URL}/api/schooladmin/admin/fee-receipts/?${params.toString()}`;
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setReceipts(response.data.receipts || []);
      setFilterData({
        available_sessions: response.data.available_sessions || [],
        classes: response.data.classes || []
      });

      // Set defaults if not already set
      if (!selectedYear && response.data.available_sessions?.length > 0) {
        setSelectedYear(response.data.available_sessions[0].academic_year);
      }
      if (!selectedTerm && response.data.available_sessions?.length > 0) {
        setSelectedTerm(response.data.available_sessions[0].term);
      }
    } catch (error) {
      console.error('Error fetching receipts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadReceipt = async (receiptId) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/schooladmin/admin/fee-receipts/${receiptId}/download/`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/pdf')) {
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `receipt_${receiptId}.pdf`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
        }
      } else {
        alert('Failed to download receipt');
      }
    } catch (error) {
      console.error('Error downloading receipt:', error);
      alert('Failed to download receipt');
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  // Filter receipts by search query
  const filteredReceipts = receipts.filter(receipt => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      receipt.student_name.toLowerCase().includes(query) ||
      receipt.student_username.toLowerCase().includes(query) ||
      receipt.receipt_number.toLowerCase().includes(query)
    );
  });

  return (
    <div className="admin-fee-receipts-container">
      <div className="admin-receipts-header">
        <div className="header-content">
          <FileText size={32} />
          <div>
            <h2>Fee Receipts Management</h2>
            <p>View and manage all generated fee receipts</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="admin-receipts-filters">
        <div className="filter-row">
          <div className="filter-group">
            <label>
              <Calendar size={18} />
              Academic Year
            </label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              disabled={loading}
            >
              <option value="">All Years</option>
              {filterData?.available_sessions?.map((session, index) => (
                <option key={`${session.academic_year}-${index}`} value={session.academic_year}>
                  {session.academic_year}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>
              <FileText size={18} />
              Term
            </label>
            <select
              value={selectedTerm}
              onChange={(e) => setSelectedTerm(e.target.value)}
              disabled={loading}
            >
              <option value="">All Terms</option>
              <option value="First Term">First Term</option>
              <option value="Second Term">Second Term</option>
              <option value="Third Term">Third Term</option>
            </select>
          </div>

          <div className="filter-group">
            <label>
              <BookOpen size={18} />
              Class
            </label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              disabled={loading}
            >
              <option value="">All Classes</option>
              {filterData?.classes?.map(cls => (
                <option key={cls.id} value={cls.id}>
                  {cls.name}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group search-group">
            <label>
              <Search size={18} />
              Search Student
            </label>
            <input
              type="text"
              placeholder="Search by name, username or receipt number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="admin-receipts-content">
        {loading ? (
          <div className="loading-state">
            <Loader size={32} className="spin" />
            <p>Loading receipts...</p>
          </div>
        ) : filteredReceipts.length === 0 ? (
          <div className="empty-state">
            <FileText size={64} />
            <h3>No Receipts Found</h3>
            <p>No fee receipts match the selected filters.</p>
          </div>
        ) : (
          <div className="receipts-table-container">
            <table className="receipts-table">
              <thead>
                <tr>
                  <th>Receipt #</th>
                  <th>Student</th>
                  <th>Class</th>
                  <th>Academic Year</th>
                  <th>Term</th>
                  <th>Total Fees</th>
                  <th>Amount Paid</th>
                  <th>Balance</th>
                  <th>Status</th>
                  <th>Date Issued</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredReceipts.map(receipt => (
                  <tr key={receipt.id}>
                    <td className="receipt-number">{receipt.receipt_number}</td>
                    <td>
                      <div className="student-cell">
                        <div className="student-name">{receipt.student_name}</div>
                        <div className="student-username">@{receipt.student_username}</div>
                      </div>
                    </td>
                    <td>{receipt.class_name}</td>
                    <td>{receipt.academic_year}</td>
                    <td>{receipt.term}</td>
                    <td className="amount">{formatCurrency(receipt.total_fees)}</td>
                    <td className="amount paid">{formatCurrency(receipt.amount_paid)}</td>
                    <td className="amount balance">{formatCurrency(receipt.balance)}</td>
                    <td>
                      <span className={`status-badge ${receipt.status}`}>
                        {receipt.status}
                      </span>
                    </td>
                    <td>{formatDate(receipt.date_issued)}</td>
                    <td>
                      <button
                        className="download-receipt-btn"
                        onClick={() => handleDownloadReceipt(receipt.id)}
                        title="Download PDF"
                      >
                        <Download size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && filteredReceipts.length > 0 && (
          <div className="receipts-summary">
            <p>Showing <strong>{filteredReceipts.length}</strong> receipt{filteredReceipts.length !== 1 ? 's' : ''}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminFeeReceipts;
