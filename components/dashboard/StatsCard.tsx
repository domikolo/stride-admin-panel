/**
 * Stats Card Component - displays metric with icon, optional sparkline, and count-up animation
 */

'use client';

import { useEffect, useRef, useState } from 'react';
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

/** Map icon text color to matching bg color */
function getIconBg(iconColor: string): string {
  if (iconColor.includes('blue')) return 'bg-blue-500/10';
  if (iconColor.includes('amber')) return 'bg-amber-500/10';
  if (iconColor.includes('red')) return 'bg-red-500/10';
  if (iconColor.includes('emerald')) return 'bg-emerald-500/10';
  if (iconColor.includes('purple')) return 'bg-purple-500/10';
  if (iconColor.includes('green')) return 'bg-green-500/10';
  return 'bg-white/[0.04]';
}

/** Animated count-up for numeric values */
function AnimatedValue({ value }: { value: string | number }) {
  const [display, setDisplay] = useState('0');
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const str = String(value);
    // Extract numeric part (handles "12", "45.2", "$12.50", "85%", "3.2 min", etc.)
    const match = str.match(/(\d+\.?\d*)/);
    if (!match) {
      setDisplay(str);
      return;
    }

    const target = parseFloat(match[1]);
    const prefix = str.slice(0, match.index);
    const suffix = str.slice((match.index || 0) + match[0].length);
    const hasDecimal = match[0].includes('.');
    const decimalPlaces = hasDecimal ? (match[0].split('.')[1]?.length || 0) : 0;

    const duration = 600; // ms
    const start = performance.now();

    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = target * eased;

      setDisplay(`${prefix}${hasDecimal ? current.toFixed(decimalPlaces) : Math.round(current)}${suffix}`);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value]);

  return <>{display}</>;
}

export default function StatsCard({
  title,
  value,
  icon: Icon,
  change,
  trend,
  sparklineData,
  iconColor = 'text-zinc-400',
  description,
  valueHref,
}: StatsCardProps) {
  const trendColor = trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-red-400' : 'text-zinc-400';
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const sparklineColor = trend === 'up' ? '#34d399' : trend === 'down' ? '#f87171' : '#3b82f6';
  const iconBg = getIconBg(iconColor);

  const valueContent = <AnimatedValue value={value} />;

  const valueElement = valueHref ? (
    <Link href={valueHref}>
      <span className="text-3xl font-bold text-white tracking-tight hover:text-blue-400 transition-colors cursor-pointer">
        {valueContent}
      </span>
    </Link>
  ) : (
    <span className="text-3xl font-bold text-white tracking-tight">{valueContent}</span>
  );

  return (
    <Card className="glass-card">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-xs font-medium text-zinc-500">{title}</CardTitle>
          {description && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Info size={14} className="text-zinc-500 hover:text-zinc-400 transition-colors cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-[280px]">
                <p>{description}</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        <div className={`w-7 h-7 rounded-md ${iconBg} flex items-center justify-center`}>
          <Icon size={14} className={iconColor} />
        </div>
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
                    <span className="text-zinc-600 text-xs">vs poprzedni okres</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Zmiana procentowa vs poprzednie 30 dni</p>
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
