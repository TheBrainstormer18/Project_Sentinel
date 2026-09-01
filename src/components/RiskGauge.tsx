import React from 'react';
import { RiskLevel } from '../types';

interface RiskGaugeProps {
  score: number;
  level: RiskLevel;
  delayProb?: number;
  costProb?: number;
  gap?: number;
  size?: 'sm' | 'md' | 'lg';
}

export const RiskGauge: React.FC<RiskGaugeProps> = ({
  score,
  level,
  delayProb,
  costProb,
  gap,
  size = 'md',
}) => {
  const clampedScore = Math.max(0, Math.min(100, score));

  // Determine color theme
  let colorStroke = '#10b981'; // emerald
  let textColor = 'text-emerald-600';
  let ringBg = 'stroke-emerald-100';

  if (level === 'HIGH' || clampedScore >= 61) {
    colorStroke = '#e11d48'; // rose
    textColor = 'text-rose-600';
    ringBg = 'stroke-rose-100';
  } else if (level === 'MEDIUM' || clampedScore >= 31) {
    colorStroke = '#d97706'; // amber
    textColor = 'text-amber-600';
    ringBg = 'stroke-amber-100';
  }

  const radius = size === 'lg' ? 54 : size === 'sm' ? 28 : 42;
  const strokeWidth = size === 'lg' ? 9 : size === 'sm' ? 5 : 7;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (clampedScore / 100) * circumference;
  const dimension = (radius + strokeWidth) * 2;

  return (
    <div id="risk-gauge-container" className="flex flex-col items-center justify-center">
      <div className="relative flex items-center justify-center">
        <svg
          width={dimension}
          height={dimension}
          className="transform -rotate-90 transition-all duration-700 ease-out"
        >
          {/* Background Track */}
          <circle
            cx={dimension / 2}
            cy={dimension / 2}
            r={radius}
            fill="transparent"
            strokeWidth={strokeWidth}
            className={ringBg}
          />
          {/* Progress Arc */}
          <circle
            cx={dimension / 2}
            cy={dimension / 2}
            r={radius}
            fill="transparent"
            stroke={colorStroke}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>

        <div className="absolute flex flex-col items-center justify-center text-center">
          <span className={`font-extrabold tracking-tight ${size === 'lg' ? 'text-3xl' : size === 'sm' ? 'text-base' : 'text-2xl'} ${textColor}`}>
            {clampedScore}
          </span>
          <span className="text-[10px] uppercase font-bold text-slate-400">/ 100</span>
        </div>
      </div>

      {(delayProb !== undefined || costProb !== undefined) && size !== 'sm' && (
        <div className="mt-3 grid grid-cols-2 gap-2 w-full text-center text-xs">
          {delayProb !== undefined && (
            <div className="rounded-lg bg-slate-50 border border-slate-200/60 p-1.5">
              <div className="text-[10px] font-semibold text-slate-500 uppercase">Delay Prob</div>
              <div className="text-sm font-bold text-slate-800">{delayProb}%</div>
            </div>
          )}
          {costProb !== undefined && (
            <div className="rounded-lg bg-slate-50 border border-slate-200/60 p-1.5">
              <div className="text-[10px] font-semibold text-slate-500 uppercase">Cost Prob</div>
              <div className="text-sm font-bold text-slate-800">{costProb}%</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
