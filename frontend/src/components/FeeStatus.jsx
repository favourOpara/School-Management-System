import React, { useState } from 'react';
import { DollarSign, ChevronDown, ChevronUp } from 'lucide-react';
import API_BASE_URL from '../config';

import './FeeStatus.css';

const FeeStatus = () => {
  const [feeData, setFeeData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);

  const fetchFeeStatus = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${API_BASE_URL}/api/schooladmin/student/dashboard/fee-status/`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch fee status');
      }

      const data = await response.json();
      setFeeData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleExpand = () => {
    if (!isExpanded && !feeData) {
      fetchFeeStatus();
    }
    setIsExpanded(!isExpanded);
    if (isExpanded) {
      setShowBreakdown(false);
    }
  };

  const getStatusColor = (status) => {
    if (status === 'PAID') return '#10b981';
    if (status === 'PARTIAL') return '#f59e0b';
    return '#ef4444';
  };

  const getStatusText = (status) => {
    if (status === 'PAID') return 'Fully Paid';
    if (status === 'PARTIAL') return 'Partially Paid';
    return 'Unpaid';
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0
    }).format(amount);
  };

  return (
    <div className="fee-status-card">
      <div className="fee-status-header">
        <DollarSign size={24} color="#8b5cf6" />
        <div className="fee-status-title-section">
          <h3>School Fees</h3>
          <p>Payment status for current term</p>
        </div>
      </div>

      <button
        className={`fee-status-toggle-btn ${isExpanded ? 'close' : 'open'}`}
        onClick={handleToggleExpand}
      >
        {isExpanded ? 'Close' : 'View Status'}
      </button>

      {isExpanded && (
        <div className="fee-status-content">
          {loading ? (
            <div className="fee-status-loading">
              <div className="loading-spinner-fs"></div>
            </div>
          ) : error ? (
            <div className="fee-status-error">
              <p>Unable to load fee status</p>
            </div>
          ) : !feeData?.has_fees ? (
            <div className="fee-status-empty">
              <p>No fees assigned for current term</p>
            </div>
          ) : (
            <>
              <div className="fee-summary">
                <div className="fee-info-row">
                  <span className="fee-label">Total Fees:</span>
                  <span className="fee-value">{formatCurrency(feeData.total_fees)}</span>
                </div>
                <div className="fee-info-row">
                  <span className="fee-label">Amount Paid:</span>
                  <span className="fee-value paid">{formatCurrency(feeData.total_paid)}</span>
                </div>
                <div className="fee-info-row">
                  <span className="fee-label">Balance:</span>
                  <span className="fee-value balance">{formatCurrency(feeData.balance)}</span>
                </div>
              </div>

              <div className="fee-progress">
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${feeData.percentage_paid}%`,
                      backgroundColor: getStatusColor(feeData.overall_status)
                    }}
                  ></div>
                </div>
                <div className="progress-info">
                  <span className="percentage">{feeData.percentage_paid}% paid</span>
                  <span
                    className="status-badge"
                    style={{ backgroundColor: getStatusColor(feeData.overall_status) }}
                  >
                    {getStatusText(feeData.overall_status)}
                  </span>
                </div>
              </div>

              {feeData.fees_breakdown && feeData.fees_breakdown.length > 1 && (
                <button
                  className="show-breakdown-btn"
                  onClick={() => setShowBreakdown(!showBreakdown)}
                >
                  {showBreakdown ? (
                    <>
                      <ChevronUp size={14} />
                      Hide Breakdown
                    </>
                  ) : (
                    <>
                      <ChevronDown size={14} />
                      Show Breakdown
                    </>
                  )}
                </button>
              )}

              {showBreakdown && feeData.fees_breakdown && (
                <div className="fees-breakdown">
                  {feeData.fees_breakdown.map((fee, index) => (
                    <div key={index} className="breakdown-item">
                      <span className="breakdown-name">{fee.fee_name}</span>
                      <div className="breakdown-details">
                        <span>{formatCurrency(fee.amount_paid)} / {formatCurrency(fee.total_amount)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default FeeStatus;
