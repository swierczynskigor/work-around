import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDuration } from "@/lib/utils"
import { SiteStats, LimitRule } from "@/domain/models"
import { getFaviconUrl } from "@/lib/favicon"
import { Translations } from "@/lib/i18n"

interface StatsCardProps {
  stats: SiteStats;
  limit?: LimitRule | null;
  translations?: Translations;
  variant?: 'default' | 'compact';
}

export function StatsCard({ stats, limit, translations, variant = 'default' }: StatsCardProps) {
  const t = translations?.popup;
  const hasLimit = limit && limit.dailyLimitMs > 0;
  const percentUsed = hasLimit 
    ? Math.min(100, (stats.timeSpentMs / limit.dailyLimitMs) * 100)
    : 0;
  const remainingMs = hasLimit 
    ? Math.max(0, limit.dailyLimitMs - stats.timeSpentMs)
    : 0;

  // Progress bar color based on usage
  const getProgressColor = () => {
    if (percentUsed >= 90) return 'bg-red-500';
    if (percentUsed >= 70) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <img 
            src={getFaviconUrl(stats.hostname, 16)} 
            alt="" 
            className="w-4 h-4"
          />
          {stats.hostname}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <div className="text-2xl font-bold">{formatDuration(stats.timeSpentMs)}</div>
          <p className="text-xs text-muted-foreground">
            {t?.today || 'Today'}
          </p>
        </div>
        
        {hasLimit && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{t?.remaining || 'Remaining'}: {formatDuration(remainingMs)}</span>
              <span>{Math.round(percentUsed)}% {t?.used || 'used'}</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div 
                className={`h-full transition-all duration-300 ${getProgressColor()}`}
                style={{ width: `${percentUsed}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {t?.limit || 'Limit'}: {formatDuration(limit.dailyLimitMs)}
            </p>
          </div>
        )}
        
        {!hasLimit && (
          <p className="text-xs text-muted-foreground italic">
            {t?.noLimit || 'No limit set'}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
