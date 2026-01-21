import React, { useState, useEffect } from 'react';
import { X, Check, Loader2 } from 'lucide-react';
import { useSchool } from '../../contexts/SchoolContext';
import { API_ENDPOINTS } from '../../config';

function UpgradeModal({ open, onClose }) {
  const { schoolSlug, subscription, refreshSubscription } = useSchool();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [billingCycle, setBillingCycle] = useState('monthly');

  useEffect(() => {
    if (open) {
      fetchPlans();
      setBillingCycle(subscription?.billing_cycle || 'monthly');
    }
  }, [open, subscription]);

  const fetchPlans = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken');
      const response = await fetch(
        `${API_ENDPOINTS.base}/api/${schoolSlug}/subscription/plans/`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch plans');
      }

      const data = await response.json();
      setPlans(data.plans || []);
      setSelectedPlan(data.current_plan_id);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async () => {
    if (!selectedPlan) return;

    try {
      setSubmitting(true);
      setError(null);

      const token = localStorage.getItem('accessToken');
      const response = await fetch(
        `${API_ENDPOINTS.base}/api/${schoolSlug}/subscription/upgrade/`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            plan_id: selectedPlan,
            billing_cycle: billingCycle,
            callback_url: `${window.location.origin}/${schoolSlug}/admin/dashboard?tab=billing`,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to process upgrade');
      }

      if (data.payment?.authorization_url) {
        window.location.href = data.payment.authorization_url;
      } else {
        await refreshSubscription();
        onClose();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const formatPrice = (kobo) => {
    if (kobo === 0) return 'Free';
    return `₦${(kobo / 100).toLocaleString()}`;
  };

  const getPrice = (plan) => {
    return billingCycle === 'annual' ? plan.annual_price : plan.monthly_price;
  };

  const currentPlanId = subscription?.plan?.id;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto m-4">
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold">Change Subscription Plan</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div className="bg-red-50 text-red-700 p-3 rounded-lg mb-4">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : (
            <>
              {/* Billing Cycle Toggle */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Billing Cycle
                </label>
                <select
                  value={billingCycle}
                  onChange={(e) => setBillingCycle(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="monthly">Monthly</option>
                  <option value="annual">Annual (Save up to 17%)</option>
                </select>
              </div>

              {/* Plan Cards */}
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {plans.map((plan) => (
                  <div
                    key={plan.id}
                    onClick={() => setSelectedPlan(plan.id)}
                    className={`cursor-pointer border-2 rounded-lg p-4 transition-colors ${
                      selectedPlan === plan.id
                        ? 'border-blue-600 bg-blue-50'
                        : plan.id === currentPlanId
                        ? 'border-green-300 bg-green-50'
                        : 'border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold">{plan.display_name}</h3>
                      {plan.id === currentPlanId && (
                        <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full">
                          Current
                        </span>
                      )}
                    </div>

                    <p className="text-2xl font-bold text-blue-600 mb-2">
                      {formatPrice(getPrice(plan))}
                      {plan.monthly_price > 0 && (
                        <span className="text-sm text-gray-500 font-normal">
                          /{billingCycle === 'annual' ? 'year' : 'month'}
                        </span>
                      )}
                    </p>

                    <div className="space-y-1 text-sm">
                      <div className="flex items-center gap-1">
                        <Check className="w-4 h-4 text-green-500" />
                        <span>
                          {plan.max_admin_accounts} Admin{plan.max_admin_accounts > 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Check className="w-4 h-4 text-green-500" />
                        <span>
                          {plan.max_daily_emails === 0
                            ? 'Unlimited emails'
                            : `${plan.max_daily_emails} emails/day`}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        {plan.has_import_feature ? (
                          <Check className="w-4 h-4 text-green-500" />
                        ) : (
                          <X className="w-4 h-4 text-gray-300" />
                        )}
                        <span className={plan.has_import_feature ? '' : 'text-gray-400'}>
                          CSV Import
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-gray-600 hover:text-gray-900 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleUpgrade}
            disabled={submitting || !selectedPlan || selectedPlan === currentPlanId}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing...
              </>
            ) : (
              'Upgrade'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default UpgradeModal;
