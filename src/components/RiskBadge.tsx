import React from 'react';
import { RiskLevel } from '../types';
import { ShieldAlert, ShieldCheck, AlertTriangle } from 'lucide-react';

interface RiskBadgeProps {
  level: RiskLevel;
  score?: number;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const RiskBadge: React.FC<RiskBadgeProps> = ({
  level,
  score,
  showIcon = true,
  size = 'md',
}) => {
  const configs = {
    LOW: {
      bg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      pill: 'bg-emerald-600 text-white',
      dot: 'bg-emerald-500',
      label: 'LOW RISK',
      icon: ShieldCheck,
    },
    MEDIUM: {
      bg: 'bg-amber-50 text-amber-800 border-amber-200',
      pill: 'bg-amber-600 text-white',
      dot: 'bg-amber-500',
      label: 'MEDIUM RISK',
      icon: AlertTriangle,
    },
    HIGH: {
      bg: 'bg-rose-50 text-rose-800 border-rose-200',
      pill: 'bg-rose-600 text-white',
      dot: 'bg-rose-600',
      label: 'HIGH RISK',
      icon: ShieldAlert,
    },
  };

  const current = configs[level] || configs.LOW;
  const Icon = current.icon;

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-xs font-semibold px-2.5 py-1 gap-1.5',
    lg: 'text-sm font-bold px-3 py-1.5 gap-2',
  };

  return (
    <span
      id={`risk-badge-${level.toLowerCase()}`}
      className={`inline-flex items-center rounded-full border shadow-xs transition-colors ${current.bg} ${sizeClasses[size]}`}
    >
      {showIcon && <Icon className={size === 'lg' ? 'w-4 h-4' : 'w-3.5 h-3.5'} />}
      <span>{current.label}</span>
      {score !== undefined && (
        <span
          className={`ml-0.5 rounded-full px-1.5 py-0.2 text-[10px] font-bold ${current.pill}`}
        >
          {score}/100
        </span>
      )}
    </span>
  );
};
