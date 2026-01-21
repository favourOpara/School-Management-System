import React, { useState, useEffect } from 'react';
import { Loader2, CheckCircle, XCircle, Clock } from 'lucide-react';
import { useSchool } from '../../contexts/SchoolContext';
import { API_ENDPOINTS } from '../../config';

function PaymentHistory() {
  const { schoolSlug } = useSchool();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchPayments();
  }, [schoolSlug]);

  const fetchPayments = async () => {
    if (!schoolSlug) return;

    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken');
      const response = await fetch(
        `${API_ENDPOINTS.base}/api/${schoolSlug}/billing/history/`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch payment history');
      }

      const data = await response.json();
      setPayments(data.payments || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusConfig = (status) => {
    switch (status) {
      case 'success':
        return {
          icon: <CheckCircle className="w-4 h-4 text-green-500" />,
          color: 'bg-green-100 text-green-700',
        };
      case 'pending':
        return {
          icon: <Clock className="w-4 h-4 text-yellow-500" />,
          color: 'bg-yellow-100 text-yellow-700',
        };
      case 'failed':
        return {
          icon: <XCircle className="w-4 h-4 text-red-500" />,
          color: 'bg-red-100 text-red-700',
        };
      default:
        return {
          icon: null,
          color: 'bg-gray-100 text-gray-700',
        };
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-NG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatAmount = (kobo) => {
    return `₦${(kobo / 100).toLocaleString()}`;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="bg-red-50 text-red-700 p-3 rounded-lg">{error}</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold">Payment History</h3>
      </div>

      {payments.length === 0 ? (
        <div className="p-6 text-center text-gray-500">
          No payment history available.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Plan
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Method
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {payments.map((payment) => {
                const statusConfig = getStatusConfig(payment.status);
                return (
                  <tr key={payment.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(payment.paid_at || payment.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{payment.plan_name}</div>
                      <div className="text-xs text-gray-500">{payment.billing_cycle}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {formatAmount(payment.amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{payment.payment_method || '-'}</div>
                      {payment.card_last4 && (
                        <div className="text-xs text-gray-500">****{payment.card_last4}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${statusConfig.color}`}>
                        {statusConfig.icon}
                        {payment.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default PaymentHistory;
