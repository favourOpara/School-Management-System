import React, { useState } from 'react';
import { Clock, X } from 'lucide-react';
import { useSchool } from '../../contexts/SchoolContext';
import { useNavigate } from 'react-router-dom';

function TrialBanner() {
  const { isTrialPeriod, getTrialDaysLeft, schoolSlug } = useSchool();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);

  if (!isTrialPeriod() || dismissed) {
    return null;
  }

  const daysLeft = getTrialDaysLeft();

  const getBannerColor = () => {
    if (daysLeft <= 3) return 'bg-red-500';
    if (daysLeft <= 7) return 'bg-yellow-500';
    return 'bg-blue-600';
  };

  const handleUpgrade = () => {
    navigate(`/${schoolSlug}/admin/dashboard`, { state: { tab: 'billing' } });
  };

  return (
    <div className={`${getBannerColor()} text-white py-2 px-4`}>
      <div className="max-w-7xl mx-auto flex items-center justify-center flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4" />
          <span className="text-sm">
            {daysLeft === 0
              ? 'Your trial ends today!'
              : daysLeft === 1
              ? '1 day left in your trial'
              : `${daysLeft} days left in your trial`}
          </span>
        </div>
        <button
          onClick={handleUpgrade}
          className="bg-white text-blue-600 px-3 py-1 rounded text-sm font-medium hover:bg-blue-50 transition-colors"
        >
          Upgrade Now
        </button>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-white/20 rounded"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export default TrialBanner;
