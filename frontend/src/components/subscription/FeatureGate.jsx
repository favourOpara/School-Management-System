import React from 'react';
import { Lock } from 'lucide-react';
import { useSchool } from '../../contexts/SchoolContext';
import { useNavigate } from 'react-router-dom';

function FeatureGate({ feature, children, fallback }) {
  const { hasFeature, subscription, schoolSlug } = useSchool();
  const navigate = useNavigate();

  const isAllowed = hasFeature(feature);

  if (isAllowed) {
    return children;
  }

  const handleUpgrade = () => {
    navigate(`/${schoolSlug}/admin/dashboard`, { state: { tab: 'billing' } });
  };

  const getFeatureMessage = () => {
    switch (feature) {
      case 'import':
        return {
          title: 'CSV Import Not Available',
          message: 'Upgrade to Standard or Premium to import students and data via CSV/Excel files.',
          plan: 'Standard or Premium',
        };
      case 'create_admin':
        return {
          title: 'Admin Limit Reached',
          message: `Your current plan allows ${subscription?.plan?.max_admin_accounts || 1} admin account(s). Upgrade to add more administrators.`,
          plan: 'Standard or Premium',
        };
      case 'send_email':
        return {
          title: 'Daily Email Limit Reached',
          message: 'You have reached your daily email limit. Upgrade for higher limits or wait until tomorrow.',
          plan: 'Standard or Premium',
        };
      default:
        return {
          title: 'Feature Not Available',
          message: 'This feature is not available on your current plan.',
          plan: 'Higher',
        };
    }
  };

  if (fallback) {
    return fallback;
  }

  const { title, message, plan } = getFeatureMessage();

  return (
    <div className="max-w-md mx-auto my-8">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
            <Lock className="w-8 h-8 text-gray-500" />
          </div>
          <h3 className="text-lg font-semibold">{title}</h3>
          <p className="text-sm text-gray-600">{message}</p>
          <button
            onClick={handleUpgrade}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Upgrade to {plan}
          </button>
        </div>
      </div>
    </div>
  );
}

export default FeatureGate;
