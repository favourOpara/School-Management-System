// src/components/FeesReceipt.jsx
import React, { useState, useEffect } from 'react';
import { FileText, Users, Calendar, Download, Receipt, Loader, AlertCircle } from 'lucide-react';
import API_BASE_URL from '../config';

import './FeesReceipt.css';

const FeesReceipt = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [receipts, setReceipts] = useState([]);
  const [filterData, setFilterData] = useState(null);

  // Selected filters
  const [selectedChild, setSelectedChild] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('');

  useEffect(() => {
    fetchReceipts();
  }, []);

  useEffect(() => {
    if (selectedChild || selectedYear || selectedTerm) {
      fetchReceipts();
    }
  }, [selectedChild, selectedYear, selectedTerm]);

  const fetchReceipts = async () => {
    try {
      setLoading(true);
      setError('');
      const token = localStorage.getItem('accessToken');

      // Build query params
      let url = `${API_BASE_URL}/api/schooladmin/parent/fee-receipts/`;
      const params = new URLSearchParams();
      if (selectedChild) params.append('child_id', selectedChild);
      if (selectedYear) params.append('academic_year', selectedYear);
      if (selectedTerm) params.append('term', selectedTerm);
      if (params.toString()) url += `?${params.toString()}`;

      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Receipts data received:', data);
        setReceipts(data.receipts || []);
        setFilterData({
          children: data.children || [],
          available_sessions: data.available_sessions || []
        });

        // Set defaults if not already set
        if (!selectedChild && data.children && data.children.length > 0) {
          setSelectedChild(data.children[0].id);
        }
        if (!selectedYear && data.available_sessions && data.available_sessions.length > 0) {
          setSelectedYear(data.available_sessions[0].academic_year);
        }
        if (!selectedTerm && data.available_sessions && data.available_sessions.length > 0) {
          setSelectedTerm(data.available_sessions[0].term);
        }
      } else {
        const errorData = await response.json();
        console.error('Error response:', errorData);
        setError(errorData.detail || 'Error fetching receipts');
      }
    } catch (error) {
      console.error('Error:', error);
      setError('Failed to load receipts');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadReceipt = async (receiptId) => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${API_BASE_URL}/api/schooladmin/parent/fee-receipts/${receiptId}/download/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        // Check if response is PDF
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/pdf')) {
          // Handle PDF download
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `receipt_${receiptId}.pdf`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
        } else {
          // Handle JSON response (fallback)
          const data = await response.json();
          alert(data.message || 'Receipt details retrieved successfully');
          console.log('Receipt data:', data.receipt);
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

  return (
    <div className="fees-receipt-container">
      <div className="fees-receipt-header">
        <div className="header-content">
          <Receipt size={32} />
          <div>
            <h2>Fee Receipts</h2>
            <p>View and download all fee receipts sent by the school administration</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="fees-receipt-filters">
        <div className="filter-group">
          <label>
            <Users size={18} />
            Child
          </label>
          <select
            value={selectedChild}
            onChange={(e) => setSelectedChild(e.target.value)}
            disabled={loading}
          >
            <option value="">All Children</option>
            {filterData?.children?.map(child => (
              <option key={child.id} value={child.id}>
                {child.first_name} {child.last_name} - {child.class_name}
              </option>
            ))}
          </select>
        </div>

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
      </div>

      {/* Content */}
      <div className="fees-receipt-content">
        {loading ? (
          <div className="loading-state">
            <Loader size={32} className="spin" />
            <p>Loading receipts...</p>
          </div>
        ) : error ? (
          <div className="error-state">
            <AlertCircle size={48} />
            <h3>Error</h3>
            <p>{error}</p>
          </div>
        ) : receipts.length === 0 ? (
          <div className="empty-state">
            <Receipt size={64} />
            <h3>No Receipts Found</h3>
            <p>No fee receipts have been sent for the selected filters.</p>
          </div>
        ) : (
          <div className="receipts-list">
            {receipts.map(receipt => (
              <div key={receipt.id} className="receipt-card">
                <div className="receipt-icon">
                  <Receipt size={24} />
                </div>
                <div className="receipt-details">
                  <div className="receipt-header-row">
                    <h3>Receipt #{receipt.receipt_number}</h3>
                    <span className={`receipt-status ${receipt.status}`}>
                      {receipt.status}
                    </span>
                  </div>
                  <div className="receipt-info">
                    <div className="info-item">
                      <Users size={16} />
                      <span>{receipt.student_name}</span>
                    </div>
                    <div className="info-item">
                      <Calendar size={16} />
                      <span>{receipt.academic_year} - {receipt.term}</span>
                    </div>
                    <div className="info-item">
                      <FileText size={16} />
                      <span>Date: {formatDate(receipt.date_issued)}</span>
                    </div>
                  </div>
                  <div className="receipt-amounts">
                    <div className="amount-item">
                      <span className="amount-label">Amount Paid:</span>
                      <span className="amount-value paid">{formatCurrency(receipt.amount_paid)}</span>
                    </div>
                    {receipt.balance > 0 && (
                      <div className="amount-item">
                        <span className="amount-label">Balance:</span>
                        <span className="amount-value balance">{formatCurrency(receipt.balance)}</span>
                      </div>
                    )}
                  </div>
                  {receipt.remarks && (
                    <div className="receipt-remarks">
                      <strong>Remarks:</strong> {receipt.remarks}
                    </div>
                  )}
                </div>
                <div className="receipt-actions">
                  <button
                    className="download-btn"
                    onClick={() => handleDownloadReceipt(receipt.id)}
                    title="Download PDF"
                  >
                    <Download size={18} />
                    Download
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FeesReceipt;
