import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus, type LucideIcon } from 'lucide-react';

export type TrendDirection = 'up' | 'down' | 'neutral';

export interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  description?: string;
  icon?: LucideIcon;
  iconClassName?: string;
  valueClassName?: string;
  trend?: {
    direction: TrendDirection;
    label: string;
  };
  loading?: boolean;
  className?: string;
}

const trendConfig: Record<TrendDirection, { icon: LucideIcon; className: string }> = {
  up: { icon: TrendingUp, className: 'text-green-600' },
  down: { icon: TrendingDown, className: 'text-red-500' },
  neutral: { icon: Minus, className: 'text-gray-400' },
};

export function KPICard({
  title,
  value,
  subtitle,
  description,
  icon: Icon,
  iconClassName,
  trend,
  loading = false,
  className,
}: KPICardProps) {
  const TrendIcon = trend ? trendConfig[trend.direction].icon : null;
  const trendClass = trend ? trendConfig[trend.direction].className : '';

  if (loading) {
    return (
      <Card className={cn('animate-pulse', className)}>
        <CardContent className="p-6">
          <div className="h-4 bg-gray-200 rounded w-2/3 mb-3" />
          <div className="h-8 bg-gray-200 rounded w-1/2 mb-2" />
          <div className="h-3 bg-gray-200 rounded w-1/3" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('hover:shadow-md transition-shadow', className)}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-muted-foreground truncate">{title}</p>
            <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
            {subtitle && (
              <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
            )}
            {trend && TrendIcon && (
              <div className={cn('flex items-center gap-1 mt-2 text-xs font-medium', trendClass)}>
                <TrendIcon className="h-3 w-3" />
                <span>{trend.label}</span>
              </div>
            )}
            {description && (
              <p className="mt-1 text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          {Icon && (
            <div className={cn('ml-4 p-2 rounded-lg bg-primary/10', iconClassName)}>
              <Icon className="h-5 w-5 text-primary" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
