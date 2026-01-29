import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDuration } from "@/lib/utils"
import { SiteStats } from "@/domain/models"

interface StatsCardProps {
  stats: SiteStats;
  variant?: 'default' | 'compact';
}

export function StatsCard({ stats, variant = 'default' }: StatsCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">
          {stats.hostname}
        </CardTitle>
        {stats.favIconUrl && <img src={stats.favIconUrl} alt="" className="h-4 w-4" />}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{formatDuration(stats.timeSpentMs)}</div>
        <p className="text-xs text-muted-foreground">
          Today
        </p>
      </CardContent>
    </Card>
  )
}
