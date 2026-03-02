import React, { useState, useEffect, useCallback } from 'react';
import { X, Check, Loader2, CreditCard } from 'lucide-react';
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
  const [saveCard, setSaveCard] = useState(false);
  const [proration, setProration] = useState(null);
  const [prorationLoading, setProrationLoading] = useState(false);

  useEffect(() => {
    if (open) {
      fetchPlans();
      setBillingCycle(subscription?.billing_cycle || 'monthly');
      setSaveCard(subscription?.has_saved_card || false);
      setProration(null);
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

  const fetchProration = useCallback(async (planId, cycle) => {
    if (!planId || planId === currentPlanId) {
      setProration(null);
      return;
    }

    const plan = plans.find(p => p.id === planId);
    const price = cycle === 'annual' ? plan?.annual_price : plan?.monthly_price;
    if (!price || price === 0) {
      setProration(null);
      return;
    }

    try {
      setProrationLoading(true);
      const token = localStorage.getItem('accessToken');
      const response = await fetch(
        `${API_ENDPOINTS.base}/api/${schoolSlug}/subscription/upgrade/preview/?plan_id=${planId}&billing_cycle=${cycle}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setProration(data);
      } else {
        setProration(null);
      }
    } catch {
      setProration(null);
    } finally {
      setProrationLoading(false);
    }
  }, [plans, schoolSlug]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!loading && selectedPlan) {
      fetchProration(selectedPlan, billingCycle);
    }
  }, [selectedPlan, billingCycle, loading]); // eslint-disable-line react-hooks/exhaustive-deps

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
            save_card: saveCard,
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
    if (kobo === 0) return 'Contact Sales';
    return `₦${(kobo / 100).toLocaleString()}`;
  };

  const getPrice = (plan) => {
    return billingCycle === 'annual' ? plan.annual_price : plan.monthly_price;
  };

  const currentPlanId = subscription?.plan?.id;
  const currentPlanOrder = subscription?.plan?.display_order ?? -1;
  const periodEnd = subscription?.current_period_end;
  const periodActive = periodEnd && new Date(periodEnd) > new Date();

  const isPlanDowngrade = (plan) => periodActive && plan.display_order < currentPlanOrder;

  if (!open) return null;

  const selectedPlanData = plans.find(p => p.id === selectedPlan);
  const showProration = proration && proration.credit_kobo > 0 && selectedPlan !== currentPlanId;

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

              {/* Save Card Option — only shown when a paid plan is selected */}
              {selectedPlan && plans.find(p => p.id === selectedPlan && (billingCycle === 'annual' ? p.annual_price : p.monthly_price) > 0) && (
                <div className="mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
                  <label className="flex items-start gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={saveCard}
                      onChange={(e) => setSaveCard(e.target.checked)}
                      className="mt-0.5 w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                    />
                    <div>
                      <div className="flex items-center gap-2 font-medium text-gray-800">
                        <CreditCard className="w-4 h-4 text-blue-600" />
                        Save card for automatic renewal
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5">
                        Your card is stored securely by Paystack. We'll auto-charge at renewal so you never lose access.
                        You can disable this anytime from Billing settings.
                      </p>
                    </div>
                  </label>
                </div>
              )}

              {/* Plan Cards */}
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {plans.map((plan) => {
                  const isDowngrade = isPlanDowngrade(plan);
                  return (
                  <div
                    key={plan.id}
                    onClick={() => !isDowngrade && setSelectedPlan(plan.id)}
                    title={isDowngrade ? `Available after your current plan expires on ${new Date(periodEnd).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}` : undefined}
                    className={`border-2 rounded-lg p-4 transition-colors ${
                      isDowngrade
                        ? 'opacity-50 cursor-not-allowed border-gray-200 bg-gray-50'
                        : selectedPlan === plan.id
                        ? 'cursor-pointer border-blue-600 bg-blue-50'
                        : plan.id === currentPlanId
                        ? 'cursor-pointer border-green-300 bg-green-50'
                        : 'cursor-pointer border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold">{plan.display_name}</h3>
                      {plan.id === currentPlanId ? (
                        <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full">
                          Current
                        </span>
                      ) : isDowngrade ? (
                        <span className="bg-gray-100 text-gray-500 text-xs px-2 py-1 rounded-full">
                          Locked
                        </span>
                      ) : null}
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
                  );
                })}
              </div>
            </>
          )}
        </div>

        <div className="p-6 border-t border-gray-200">
          {/* Proration breakdown */}
          {prorationLoading && (
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
              <Loader2 className="w-4 h-4 animate-spin" />
              Calculating price...
            </div>
          )}

          {showProration && !prorationLoading && selectedPlanData && (
            <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
              <p className="font-medium text-blue-900 mb-2">Price breakdown</p>
              <div className="space-y-1 text-gray-700">
                <div className="flex justify-between">
                  <span>{selectedPlanData.display_name} ({billingCycle})</span>
                  <span>{formatPrice(proration.full_price_kobo)}</span>
                </div>
                <div className="flex justify-between text-green-700">
                  <span>Unused credit ({proration.remaining_days} days remaining)</span>
                  <span>-{formatPrice(proration.credit_kobo)}</span>
                </div>
                <div className="flex justify-between font-semibold text-blue-900 border-t border-blue-200 pt-1 mt-1">
                  <span>You pay today</span>
                  <span>{formatPrice(proration.charge_kobo)}</span>
                </div>
              </div>
            </div>
          )}

          {!showProration && !prorationLoading && selectedPlan && selectedPlan !== currentPlanId && proration && proration.credit_kobo === 0 && selectedPlanData && getPrice(selectedPlanData) > 0 && (
            <div className="mb-4 bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-600">
              Full price applies — no active billing period to credit.
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-gray-600 hover:text-gray-900 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleUpgrade}
              disabled={submitting || !selectedPlan || selectedPlan === currentPlanId || isPlanDowngrade(plans.find(p => p.id === selectedPlan) || {})}
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
    </div>
  );
}

export default UpgradeModal;
