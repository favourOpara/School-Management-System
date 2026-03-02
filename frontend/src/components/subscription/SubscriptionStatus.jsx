import React, { useState } from 'react';
import { CheckCircle, Clock, AlertTriangle, XCircle, CreditCard, ToggleLeft, ToggleRight, Trash2, Loader2 } from 'lucide-react';
import { useSchool } from '../../contexts/SchoolContext';
import { API_ENDPOINTS } from '../../config';

function SubscriptionStatus({ onUpgrade }) {
  const {
    subscription,
    featureLimits,
    isSubscriptionActive,
    isTrialPeriod,
    getTrialDaysLeft,
    schoolSlug,
    refreshSubscription,
  } = useSchool();

  const [autoDebitLoading, setAutoDebitLoading] = useState(false);
  const [removeCardLoading, setRemoveCardLoading] = useState(false);
  const [removeCardConfirm, setRemoveCardConfirm] = useState(false);
  const [actionError, setActionError] = useState(null);

  if (!subscription) {
    return null;
  }

  const handleToggleAutoDebit = async () => {
    try {
      setAutoDebitLoading(true);
      setActionError(null);
      const token = localStorage.getItem('accessToken');
      const res = await fetch(
        `${API_ENDPOINTS.base}/api/${schoolSlug}/billing/auto-debit/toggle/`,
        { method: 'POST', headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update auto-renewal');
      await refreshSubscription();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setAutoDebitLoading(false);
    }
  };

  const handleRemoveCard = async () => {
    if (!removeCardConfirm) {
      setRemoveCardConfirm(true);
      return;
    }
    try {
      setRemoveCardLoading(true);
      setActionError(null);
      const token = localStorage.getItem('accessToken');
      const res = await fetch(
        `${API_ENDPOINTS.base}/api/${schoolSlug}/billing/saved-card/remove/`,
        { method: 'POST', headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to remove card');
      setRemoveCardConfirm(false);
      await refreshSubscription();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setRemoveCardLoading(false);
    }
  };

  const getStatusConfig = () => {
    switch (subscription.status) {
      case 'active':
        return {
          color: 'bg-green-100 text-green-700',
          icon: <CheckCircle className="w-4 h-4" />,
        };
      case 'trial':
        return {
          color: 'bg-blue-100 text-blue-700',
          icon: <Clock className="w-4 h-4" />,
        };
      case 'pending':
        return {
          color: 'bg-yellow-100 text-yellow-700',
          icon: <Clock className="w-4 h-4" />,
        };
      case 'past_due':
        return {
          color: 'bg-yellow-100 text-yellow-700',
          icon: <AlertTriangle className="w-4 h-4" />,
        };
      case 'grace_period':
        return {
          color: 'bg-orange-100 text-orange-700',
          icon: <AlertTriangle className="w-4 h-4" />,
        };
      case 'cancelled':
      case 'expired':
        return {
          color: 'bg-red-100 text-red-700',
          icon: <XCircle className="w-4 h-4" />,
        };
      default:
        return {
          color: 'bg-gray-100 text-gray-700',
          icon: null,
        };
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-NG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const statusConfig = getStatusConfig();
  const trialDaysLeft = getTrialDaysLeft();
  const trialProgress = ((30 - trialDaysLeft) / 30) * 100;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Subscription</h3>
        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm ${statusConfig.color}`}>
          {statusConfig.icon}
          {subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1)}
        </span>
      </div>

      <div className="mb-4">
        <p className="text-xl font-bold text-blue-600">
          {subscription.plan?.display_name || 'Unknown Plan'}
        </p>
        <p className="text-sm text-gray-500">
          {subscription.billing_cycle === 'annual' ? 'Annual' : 'Monthly'} billing
        </p>
      </div>

      {isTrialPeriod() && (
        <div className="mb-4 p-3 bg-blue-50 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-blue-600" />
            <span className="font-medium text-blue-700">{trialDaysLeft} days left in trial</span>
          </div>
          <div className="w-full bg-blue-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{ width: `${trialProgress}%` }}
            />
          </div>
        </div>
      )}

      <div className="border-t border-gray-200 pt-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Admin Accounts</span>
          <span className="font-medium">
            {featureLimits?.current_admins || 0} / {featureLimits?.max_admins || 1}
          </span>
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Emails Today</span>
          <span className="font-medium">
            {featureLimits?.emails_sent_today || 0} /{' '}
            {featureLimits?.max_daily_emails === 0
              ? 'Unlimited'
              : featureLimits?.max_daily_emails || 300}
          </span>
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-gray-500">CSV Import</span>
          <span className="font-medium">
            {featureLimits?.has_import ? 'Available' : 'Not Available'}
          </span>
        </div>

        {subscription.current_period_end && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">
              {isTrialPeriod() ? 'Trial Ends' : 'Next Billing'}
            </span>
            <span className="font-medium">{formatDate(subscription.current_period_end)}</span>
          </div>
        )}
      </div>

      {!isSubscriptionActive() && (
        <div className="mt-4 p-3 bg-red-50 rounded-lg">
          <p className="text-sm text-red-700">
            Your subscription is not active. Please renew to continue using all features.
          </p>
        </div>
      )}

      {/* Auto-Renewal Section */}
      <div className="border-t border-gray-200 mt-4 pt-4">
        <div className="flex items-center gap-2 mb-3">
          <CreditCard className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Auto-Renewal</span>
        </div>

        {actionError && (
          <p className="text-xs text-red-600 mb-2">{actionError}</p>
        )}

        {subscription.has_saved_card ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  {subscription.auto_debit_enabled ? 'Auto-renewal is on' : 'Auto-renewal is off'}
                </p>
                <p className="text-xs text-gray-500">Card saved securely via Paystack</p>
              </div>
              <button
                onClick={handleToggleAutoDebit}
                disabled={autoDebitLoading}
                className="flex items-center gap-1 text-blue-600 hover:text-blue-700 disabled:opacity-50"
                title={subscription.auto_debit_enabled ? 'Disable auto-renewal' : 'Enable auto-renewal'}
              >
                {autoDebitLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : subscription.auto_debit_enabled ? (
                  <ToggleRight className="w-8 h-8 text-blue-600" />
                ) : (
                  <ToggleLeft className="w-8 h-8 text-gray-400" />
                )}
              </button>
            </div>
            <button
              onClick={handleRemoveCard}
              disabled={removeCardLoading}
              className="flex items-center gap-1 text-sm text-red-500 hover:text-red-700 disabled:opacity-50"
            >
              {removeCardLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Trash2 className="w-3.5 h-3.5" />
              )}
              {removeCardConfirm ? 'Confirm remove card?' : 'Remove saved card'}
            </button>
          </div>
        ) : (
          <p className="text-xs text-gray-500">
            No saved card. On your next payment, check "Save card for automatic renewal" to enable auto-renewal.
          </p>
        )}
      </div>

      {onUpgrade && (
        <button
          onClick={onUpgrade}
          className="w-full mt-4 bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          {isTrialPeriod() ? 'Upgrade Now' : 'Change Plan'}
        </button>
      )}
    </div>
  );
}

export default SubscriptionStatus;
