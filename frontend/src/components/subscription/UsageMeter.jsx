import React from 'react';

function UsageMeter({ label, current, max, unit = '', warning = 80, critical = 95 }) {
  const isUnlimited = max === 0 || max === -1;
  const percentage = isUnlimited ? 0 : Math.min(100, (current / max) * 100);

  const getBarColor = () => {
    if (isUnlimited) return 'bg-green-500';
    if (percentage >= critical) return 'bg-red-500';
    if (percentage >= warning) return 'bg-yellow-500';
    return 'bg-blue-500';
  };

  const formatValue = (value) => {
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    }
    return value.toString();
  };

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-1">
        <span className="text-sm text-gray-600">{label}</span>
        <span className="text-sm font-medium">
          {formatValue(current)}{unit} / {isUnlimited ? '∞' : formatValue(max) + unit}
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={`${getBarColor()} h-2 rounded-full transition-all duration-300`}
          style={{ width: isUnlimited ? '100%' : `${percentage}%` }}
        />
      </div>
      {!isUnlimited && percentage >= warning && (
        <p className={`text-xs mt-1 ${percentage >= critical ? 'text-red-600' : 'text-yellow-600'}`}>
          {percentage >= critical ? 'Limit almost reached' : `${Math.round(percentage)}% used`}
        </p>
      )}
    </div>
  );
}

export default UsageMeter;
