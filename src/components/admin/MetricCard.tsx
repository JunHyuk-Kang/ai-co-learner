import React from 'react';
import { LucideIcon } from 'lucide-react';
import { Card } from '../ui/Card';

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color: 'blue' | 'green' | 'purple' | 'orange' | 'teal' | 'red' | 'gray' | 'amber';
  change?: string;
  subtext?: string;
  alert?: boolean;
}

const colorClasses = {
  blue: {
    gradient: 'from-blue-900/20 to-blue-800/10',
    border: 'border-blue-700/50',
    icon: 'bg-blue-500/20 text-blue-400',
  },
  green: {
    gradient: 'from-green-900/20 to-green-800/10',
    border: 'border-green-700/50',
    icon: 'bg-green-500/20 text-green-400',
  },
  purple: {
    gradient: 'from-purple-900/20 to-purple-800/10',
    border: 'border-purple-700/50',
    icon: 'bg-purple-500/20 text-purple-400',
  },
  orange: {
    gradient: 'from-orange-900/20 to-orange-800/10',
    border: 'border-orange-700/50',
    icon: 'bg-orange-500/20 text-orange-400',
  },
  teal: {
    gradient: 'from-teal-900/20 to-teal-800/10',
    border: 'border-teal-700/50',
    icon: 'bg-teal-500/20 text-teal-400',
  },
  red: {
    gradient: 'from-red-900/20 to-red-800/10',
    border: 'border-red-700/50',
    icon: 'bg-red-500/20 text-red-400',
  },
  gray: {
    gradient: 'from-gray-900/20 to-gray-800/10',
    border: 'border-gray-700/50',
    icon: 'bg-gray-500/20 text-gray-400',
  },
  amber: {
    gradient: 'from-amber-900/20 to-amber-800/10',
    border: 'border-amber-700/50',
    icon: 'bg-amber-500/20 text-amber-400',
  },
};

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  icon: Icon,
  color,
  change,
  subtext,
  alert,
}) => {
  const colors = colorClasses[color];

  return (
    <Card className={`bg-gradient-to-br ${colors.gradient} ${colors.border}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs text-gray-400 mb-1">{title}</p>
          <h3 className="text-2xl font-bold text-white flex items-center gap-2">
            {value}
            {alert && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>}
          </h3>
          {change && (
            <p className="text-xs text-gray-400 mt-1">
              {change.startsWith('+') ? (
                <span className="text-green-400">{change}</span>
              ) : change.startsWith('-') ? (
                <span className="text-red-400">{change}</span>
              ) : (
                <span>{change}</span>
              )}
            </p>
          )}
          {subtext && !change && <p className="text-xs text-gray-500 mt-1">{subtext}</p>}
        </div>
        <div className={`p-2 rounded-lg ${colors.icon}`}>
          <Icon size={20} />
        </div>
      </div>
    </Card>
  );
};
