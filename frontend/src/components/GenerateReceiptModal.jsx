// src/components/GenerateReceiptModal.jsx
import React, { useState, useEffect } from 'react';
import { X, FileText, Download, Send, Loader } from 'lucide-react';
import axios from 'axios';
import './GenerateReceiptModal.css';

const GenerateReceiptModal = ({ student, onClose, onGenerated }) => {
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [receiptData, setReceiptData] = useState(null);
  const [remarks, setRemarks] = useState('');

  const token = localStorage.getItem('accessToken');

  useEffect(() => {
    if (student) {
      fetchPaymentHistory();
    }
  }, [student]);

  const fetchPaymentHistory = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `http://127.0.0.1:8000/api/schooladmin/fee-records/${student.record_id}/payment-history/`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setPaymentHistory(response.data.history || []);
      setReceiptData(response.data);
    } catch (error) {
      console.error('Error fetching payment history:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReceipt = async () => {
    try {
      setGenerating(true);
      const response = await axios.post(
        `http://127.0.0.1:8000/api/schooladmin/fee-records/${student.record_id}/generate-receipt/`,
        { remarks },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      alert('Receipt generated and sent to parent successfully!');
      if (onGenerated) onGenerated();
      onClose();
    } catch (error) {
      console.error('Error generating receipt:', error);
      alert('Failed to generate receipt. Please try again.');
    } finally {
      setGenerating(false);
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
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!student) return null;

  return (
    <div className="generate-receipt-overlay">
      <div className="generate-receipt-modal">
        <div className="receipt-modal-header">
          <div className="header-left">
            <FileText size={28} />
            <div>
              <h2>Generate Fee Receipt</h2>
              <p>{student.full_name} - {student.username}</p>
            </div>
          </div>
          <button className="close-receipt-btn" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <div className="receipt-modal-body">
          {loading ? (
            <div className="receipt-loading">
              <Loader size={32} className="spin" />
              <p>Loading payment history...</p>
            </div>
          ) : (
            <>
              {/* Receipt Summary */}
              <div className="receipt-summary">
                <h3>Fee Summary</h3>
                <div className="summary-grid">
                  <div className="summary-item">
                    <span className="summary-label">Fee Name:</span>
                    <span className="summary-value">{student.fee_name}</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Total Fee:</span>
                    <span className="summary-value">{formatCurrency(student.fee_amount)}</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Total Paid:</span>
                    <span className="summary-value paid">{formatCurrency(student.amount_paid)}</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Balance:</span>
                    <span className={`summary-value ${student.outstanding > 0 ? 'outstanding' : 'cleared'}`}>
                      {formatCurrency(student.outstanding)}
                    </span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Status:</span>
                    <span className={`status-badge ${student.payment_status.toLowerCase()}`}>
                      {student.payment_status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Payment History */}
              <div className="payment-history-section">
                <h3>Payment History</h3>
                {paymentHistory.length === 0 ? (
                  <div className="no-history">
                    <p>No payment transactions recorded yet</p>
                  </div>
                ) : (
                  <div className="history-table-container">
                    <table className="history-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Type</th>
                          <th>Amount</th>
                          <th>Balance Before</th>
                          <th>Balance After</th>
                          <th>Recorded By</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paymentHistory.map((transaction, index) => (
                          <tr key={index}>
                            <td>{formatDate(transaction.transaction_date)}</td>
                            <td>
                              <span className={`transaction-type ${transaction.transaction_type}`}>
                                {transaction.transaction_type}
                              </span>
                            </td>
                            <td className="amount">{formatCurrency(transaction.amount)}</td>
                            <td>{formatCurrency(transaction.balance_before)}</td>
                            <td>{formatCurrency(transaction.balance_after)}</td>
                            <td>{transaction.recorded_by || 'System'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Remarks */}
              <div className="receipt-remarks-section">
                <label>Remarks (Optional)</label>
                <textarea
                  className="remarks-input"
                  placeholder="Add any additional notes or remarks for this receipt..."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  rows={3}
                />
              </div>
            </>
          )}
        </div>

        <div className="receipt-modal-footer">
          <button className="cancel-receipt-btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="generate-send-btn"
            onClick={handleGenerateReceipt}
            disabled={generating || loading}
          >
            {generating ? (
              <>
                <Loader size={18} className="spin" />
                Generating...
              </>
            ) : (
              <>
                <Send size={18} />
                Generate & Send to Parent
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GenerateReceiptModal;
