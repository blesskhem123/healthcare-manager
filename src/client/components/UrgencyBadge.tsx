import React from 'react';

interface UrgencyBadgeProps {
  urgency?: 'Low' | 'Medium' | 'High' | string;
}

export const UrgencyBadge: React.FC<UrgencyBadgeProps> = ({ urgency = 'Low' }) => {
  let badgeStyle = 'bg-emerald-100 text-emerald-800 border-emerald-300';
  if (urgency === 'Medium') {
    badgeStyle = 'bg-amber-100 text-amber-800 border-amber-300';
  } else if (urgency === 'High') {
    badgeStyle = 'bg-rose-100 text-rose-800 border-rose-300';
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badgeStyle}`}>
      <span className={`w-1.5 h-1.5 mr-1.5 rounded-full ${urgency === 'High' ? 'bg-rose-500 animate-pulse' : urgency === 'Medium' ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
      Urgency: {urgency}
    </span>
  );
};
