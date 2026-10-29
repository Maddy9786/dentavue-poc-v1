import { SectionHeader } from './SectionHeader'
import { HealthMetricCard } from './HealthMetricCard'
import { healthMetrics } from '@/features/dashboard/mockDashboard'

/**
 * "Your mouth at a glance" — a 2-column grid of tracked areas.
 *
 * Card count is dynamic: it maps over whatever `healthMetrics` holds, so when
 * the AI supplies the findings (1–5, depending on what it spots) the grid and
 * the "N areas tracked" count follow automatically. Two-up from mobile to
 * desktop keeps the tiles a comfortable width rather than stretching.
 */
export function GlanceSection() {
  return (
    <section className="flex flex-col gap-md">
      <SectionHeader title="Your mouth at a glance" meta={`${healthMetrics.length} areas tracked`} />
      <ul className="grid grid-cols-2 gap-md">
        {healthMetrics.map((metric) => (
          <li key={metric.id}>
            <HealthMetricCard metric={metric} />
          </li>
        ))}
      </ul>
    </section>
  )
}
