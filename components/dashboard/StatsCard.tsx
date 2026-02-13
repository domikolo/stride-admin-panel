/**
 * Stats Card Component - displays metric with icon and optional clickable value
 */

'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LucideIcon, TrendingUp, TrendingDown, Minus, Info } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  change?: number;
  trend?: 'up' | 'down' | 'neutral';
  sparklineData?: number[];
  iconColor?: string;
  description?: string;
  valueHref?: string;
}

export default function StatsCard({
  title,
  value,
  icon: Icon,
  change,
  trend,
  sparklineData,
  iconColor = 'text-zinc-600',
  description,
  valueHref,
}: StatsCardProps) {
  const trendColor = trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-red-400' : 'text-zinc-400';
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const sparklineColor = trend === 'up' ? '#34d399' : trend === 'down' ? '#f87171' : '#71717a';

  const valueElement = valueHref ? (
    <Link href={valueHref}>
      <span className="text-2xl font-bold text-white tracking-tight hover:text-blue-400 transition-colors cursor-pointer">
        {value}
      </span>
    </Link>
  ) : (
    <span className="text-2xl font-bold text-white tracking-tight">{value}</span>
  );

  return (
    <Card className="glass-card hover:border-zinc-700 transition-colors duration-200">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-xs font-medium text-zinc-500 uppercase tracking-wide">{title}</CardTitle>
          {description && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Info size={14} className="text-zinc-700 hover:text-zinc-500 transition-colors cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-[250px]">
                <p>{description}</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        <Icon size={18} className={iconColor} />
      </CardHeader>
      <CardContent>
        <div className="flex items-end justify-between">
          <div>
            {valueElement}

            {change !== undefined && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className={`flex items-center gap-1 text-sm mt-2 cursor-help ${trendColor}`}>
                    <TrendIcon size={14} />
                    <span>{change > 0 ? '+' : ''}{change}%</span>
                    <span className="text-zinc-600 text-xs">vs last period</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Percentage change compared to the previous 30 days</p>
                </TooltipContent>
              </Tooltip>
            )}

          </div>

          {/* Sparkline */}
          {sparklineData && sparklineData.length > 0 && (
            <div className="w-20 h-10">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sparklineData.map((v, i) => ({ value: v, index: i }))}>
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke={sparklineColor}
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
