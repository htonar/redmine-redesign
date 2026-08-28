import { ArrowDown, ArrowUp } from 'lucide-react'
import { Link } from 'react-router'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'

export interface StatCardProps {
  label: string
  value: string | number
  /** Изменение в процентах, например 9.2 или -3.4. Если не задано - тренд не показывается. */
  trend?: number
  trendPeriodLabel?: string
  /** Если задан - карточка становится ссылкой (issue #54). */
  to?: string
  className?: string
}

/**
 * Stat-карточка дашборда: число, подпись, опционально тренд (стрелка + %).
 * Компактный вариант (issue #54) - число text-2xl, минимум паддингов, чтобы
 * ряд из четырёх не занимал пол-экрана. С `to` кликается и ведёт на
 * отфильтрованный список.
 */
export function StatCard({
  label,
  value,
  trend,
  trendPeriodLabel,
  to,
  className,
}: StatCardProps) {
  const isPositive = (trend ?? 0) >= 0

  const card = (
    <Card
      className={cn(
        'gap-1 py-3',
        to &&
          'transition-colors hover:border-ring/40 hover:bg-accent/40',
        className
      )}
    >
      <CardContent className="px-4">
        {trend !== undefined && (
          <div
            className={cn(
              'mb-0.5 flex items-center gap-1 text-xs font-medium',
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
        <div className="text-2xl font-semibold tracking-tight text-foreground">
          {value}
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  )

  if (!to) return card

  return (
    <Link to={to} className="block rounded-xl focus-visible:outline-2 focus-visible:outline-ring">
      {card}
    </Link>
  )
}
