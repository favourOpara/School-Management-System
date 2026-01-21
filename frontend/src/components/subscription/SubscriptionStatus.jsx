import React from 'react';
import { CheckCircle, Clock, AlertTriangle, XCircle } from 'lucide-react';
import { useSchool } from '../../contexts/SchoolContext';

function SubscriptionStatus({ onUpgrade }) {
  const {
    subscription,
    featureLimits,
    isSubscriptionActive,
    isTrialPeriod,
    getTrialDaysLeft,
  } = useSchool();

  if (!subscription) {
    return null;
  }

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
      case 'past_due':
        return {
          color: 'bg-yellow-100 text-yellow-700',
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
