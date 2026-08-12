import { ArrowDown, ArrowUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'

export interface StatCardProps {
  label: string
  value: string | number
  /** Изменение в процентах, например 9.2 или -3.4. Если не задано - тренд не показывается. */
  trend?: number
  trendPeriodLabel?: string
  className?: string
}

/**
 * Stat-карточка дашборда: крупное число, подпись, тренд (стрелка + %).
 * См. docs/design.md, блок "Tasks This Year" / "UI Elements".
 */
export function StatCard({
  label,
  value,
  trend,
  trendPeriodLabel,
  className,
}: StatCardProps) {
  const isPositive = (trend ?? 0) >= 0

  return (
    <Card className={cn('gap-3 py-4', className)}>
      <CardContent className="px-4">
        {trend !== undefined && (
          <div
            className={cn(
              'mb-1 flex items-center gap-1 text-xs font-medium',
              isPositive ? 'text-success' : 'text-destructive'
            )}
          >
            {isPositive ? (
              <ArrowUp className="size-3.5" />
            ) : (
              <ArrowDown className="size-3.5" />
            )}
            {Math.abs(trend).toFixed(1)}%
            {trendPeriodLabel && (
              <span className="font-normal text-muted-foreground">
                {trendPeriodLabel}
              </span>
            )}
          </div>
        )}
        <div className="text-3xl font-semibold tracking-tight text-foreground">
          {value}
        </div>
        <div className="mt-1 text-sm text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  )
}
