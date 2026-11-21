'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { SectionHeader } from '@/components/dashboard/SectionHeader'
import { cn } from '@/lib/cn'
import type { Annotation, Band, ScoredParameter } from '@/features/scan/analysisApi'

type ArchZoneId =
  | 'upper-left'
  | 'upper-front'
  | 'upper-right'
  | 'lower-left'
  | 'lower-front'
  | 'lower-right'
  | 'tongue'

interface ZoneSummary {
  id: ArchZoneId
  label: string
  status: 'clear' | 'mild' | 'watch'
  notes: string[]
}

const ZONE_ORDER: { id: ArchZoneId; label: string; arch: 'upper' | 'lower' | 'center' }[] = [
  { id: 'upper-right', label: 'Upper Right', arch: 'upper' },
  { id: 'upper-front', label: 'Upper Front', arch: 'upper' },
  { id: 'upper-left', label: 'Upper Left', arch: 'upper' },
  { id: 'tongue', label: 'Tongue & Tissue', arch: 'center' },
  { id: 'lower-right', label: 'Lower Right', arch: 'lower' },
  { id: 'lower-front', label: 'Lower Front', arch: 'lower' },
  { id: 'lower-left', label: 'Lower Left', arch: 'lower' },
]

function classifyZones(
  annotations: Annotation[],
  parameters: ScoredParameter[],
): Record<ArchZoneId, ZoneSummary> {
  const zones: Record<ArchZoneId, ZoneSummary> = {
    'upper-right': { id: 'upper-right', label: 'Upper Right', status: 'clear', notes: [] },
    'upper-front': { id: 'upper-front', label: 'Upper Front', status: 'clear', notes: [] },
    'upper-left': { id: 'upper-left', label: 'Upper Left', status: 'clear', notes: [] },
    tongue: { id: 'tongue', label: 'Tongue & Tissue', status: 'clear', notes: [] },
    'lower-right': { id: 'lower-right', label: 'Lower Right', status: 'clear', notes: [] },
    'lower-front': { id: 'lower-front', label: 'Lower Front', status: 'clear', notes: [] },
    'lower-left': { id: 'lower-left', label: 'Lower Left', status: 'clear', notes: [] },
  }

  const bandByParam = new Map<string, Band>()
  for (const p of parameters) {
    bandByParam.set(p.parameter, p.band)
  }

  const elevate = (zone: ZoneSummary, band: Band, note: string) => {
    if (!zone.notes.includes(note)) zone.notes.push(note)
    if (band === 'moderate' || band === 'marked') {
      zone.status = 'watch'
    } else if (band === 'mild' && zone.status === 'clear') {
      zone.status = 'mild'
    }
  }

  for (const ann of annotations) {
    const band = bandByParam.get(ann.parameter) ?? 'mild'
    const text = ann.label.toLowerCase()

    if (ann.position === 2 || text.includes('tongue') || text.includes('cheek')) {
      elevate(zones.tongue, band, ann.label)
      continue
    }

    const isUpper = ann.position === 1 || text.includes('upper')
    const isLower = ann.position === 3 || text.includes('lower')
    const isLeft = text.includes('left')
    const isRight = text.includes('right')

    if (isUpper) {
      if (isLeft) elevate(zones['upper-left'], band, ann.label)
      else if (isRight) elevate(zones['upper-right'], band, ann.label)
      else elevate(zones['upper-front'], band, ann.label)
    } else if (isLower) {
      if (isLeft) elevate(zones['lower-left'], band, ann.label)
      else if (isRight) elevate(zones['lower-right'], band, ann.label)
      else elevate(zones['lower-front'], band, ann.label)
    } else {
      // Frame 0 (front teeth)
      if (isLeft) elevate(zones['upper-left'], band, ann.label)
      else if (isRight) elevate(zones['upper-right'], band, ann.label)
      else elevate(zones['upper-front'], band, ann.label)
    }
  }

  // Fallback for tongue parameter if no annotation specifically hit frame 2
  const tissueBand = bandByParam.get('tissueAppearance')
  if (tissueBand && tissueBand !== 'none' && zones.tongue.notes.length === 0) {
    elevate(zones.tongue, tissueBand, 'Light everyday tongue coating observed')
  }

  return zones
}

function toothFill(status: ZoneSummary['status'], selected: boolean): string {
  if (status === 'watch') return selected ? '#EA580C' : '#F97316'
  if (status === 'mild') return selected ? '#D97706' : '#FBBF24'
  return selected ? '#059669' : '#34D399'
}

export function ToothArchMap({
  annotations,
  parameters,
}: {
  annotations: Annotation[]
  parameters: ScoredParameter[]
}) {
  const zones = classifyZones(annotations, parameters)
  const firstFlagged =
    ZONE_ORDER.find((z) => zones[z.id].status !== 'clear')?.id ?? 'upper-front'
  const [selectedZone, setSelectedZone] = useState<ArchZoneId>(firstFlagged)

  const active = zones[selectedZone]

  // 10-tooth arch coordinates (Upper & Lower) grouped into Right / Front / Left
  const upperTeeth: { x: number; y: number; zone: ArchZoneId }[] = [
    { x: 34, y: 82, zone: 'upper-right' },
    { x: 52, y: 58, zone: 'upper-right' },
    { x: 76, y: 40, zone: 'upper-right' },
    { x: 106, y: 28, zone: 'upper-front' },
    { x: 138, y: 24, zone: 'upper-front' },
    { x: 170, y: 24, zone: 'upper-front' },
    { x: 202, y: 28, zone: 'upper-front' },
    { x: 232, y: 40, zone: 'upper-left' },
    { x: 256, y: 58, zone: 'upper-left' },
    { x: 274, y: 82, zone: 'upper-left' },
  ]

  const lowerTeeth: { x: number; y: number; zone: ArchZoneId }[] = [
    { x: 34, y: 158, zone: 'lower-right' },
    { x: 52, y: 182, zone: 'lower-right' },
    { x: 76, y: 200, zone: 'lower-right' },
    { x: 106, y: 212, zone: 'lower-front' },
    { x: 138, y: 216, zone: 'lower-front' },
    { x: 170, y: 216, zone: 'lower-front' },
    { x: 202, y: 212, zone: 'lower-front' },
    { x: 232, y: 200, zone: 'lower-left' },
    { x: 256, y: 182, zone: 'lower-left' },
    { x: 274, y: 158, zone: 'lower-left' },
  ]

  return (
    <section className="flex flex-col gap-md">
      <SectionHeader title="Interactive mouth map" meta="Tap any zone" />

      <Card className="flex flex-col gap-md p-md">
        {/* Legend */}
        <div className="flex flex-wrap items-center justify-between gap-xs text-[11px] font-medium text-foreground-secondary">
          <span className="inline-flex items-center gap-1">
            <span className="size-2.5 rounded-full bg-emerald-400" /> Clear
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-2.5 rounded-full bg-amber-400" /> Mild note
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-2.5 rounded-full bg-orange-500" /> Needs care
          </span>
        </div>

        {/* Anatomical Upper & Lower Arch SVG */}
        <div className="mx-auto w-full max-w-[320px]">
          <svg viewBox="0 0 320 250" className="w-full" role="img" aria-label="Upper and lower tooth map">
            {/* Upper & Lower Arch labels */}
            <text x="160" y="12" textAnchor="middle" fill="#736B61" fontSize="10" fontWeight="600">
              UPPER TEETH &amp; GUMS
            </text>
            <text x="160" y="245" textAnchor="middle" fill="#736B61" fontSize="10" fontWeight="600">
              LOWER TEETH &amp; GUMS
            </text>
            <text x="8" y="130" fill="#736B61" fontSize="9" fontWeight="600">
              R
            </text>
            <text x="304" y="130" fill="#736B61" fontSize="9" fontWeight="600">
              L
            </text>

            {/* Tongue center button */}
            <g
              onClick={() => setSelectedZone('tongue')}
              className="cursor-pointer"
              role="button"
              tabIndex={0}
              aria-label="Inspect tongue and oral tissue"
            >
              <ellipse
                cx="160"
                cy="126"
                rx="44"
                ry="28"
                fill={toothFill(zones.tongue.status, selectedZone === 'tongue')}
                fillOpacity={selectedZone === 'tongue' ? 0.3 : 0.18}
                stroke={toothFill(zones.tongue.status, selectedZone === 'tongue')}
                strokeWidth={selectedZone === 'tongue' ? 2.5 : 1.5}
              />
              <text
                x="160"
                y="130"
                textAnchor="middle"
                fill="#221E19"
                fontSize="11"
                fontWeight="600"
              >
                Tongue
              </text>
            </g>

            {/* Upper teeth */}
            {upperTeeth.map((t, i) => {
              const z = zones[t.zone]
              const isSel = selectedZone === t.zone
              return (
                <rect
                  key={`u-${i}`}
                  x={t.x}
                  y={t.y}
                  width="22"
                  height="24"
                  rx="7"
                  fill={toothFill(z.status, isSel)}
                  fillOpacity={isSel ? 0.95 : 0.72}
                  stroke={isSel ? '#221E19' : '#FFFFFF'}
                  strokeWidth={isSel ? 2 : 1.5}
                  className="cursor-pointer transition-all"
                  onClick={() => setSelectedZone(t.zone)}
                />
              )
            })}

            {/* Lower teeth */}
            {lowerTeeth.map((t, i) => {
              const z = zones[t.zone]
              const isSel = selectedZone === t.zone
              return (
                <rect
                  key={`l-${i}`}
                  x={t.x}
                  y={t.y}
                  width="22"
                  height="24"
                  rx="7"
                  fill={toothFill(z.status, isSel)}
                  fillOpacity={isSel ? 0.95 : 0.72}
                  stroke={isSel ? '#221E19' : '#FFFFFF'}
                  strokeWidth={isSel ? 2 : 1.5}
                  className="cursor-pointer transition-all"
                  onClick={() => setSelectedZone(t.zone)}
                />
              )
            })}
          </svg>
        </div>

        {/* Zone detail box */}
        <div
          className={cn(
            'flex flex-col gap-2xs rounded-3 border p-sm',
            active.status === 'watch'
              ? 'border-orange-300 bg-orange-50/60'
              : active.status === 'mild'
                ? 'border-amber-200 bg-amber-50/50'
                : 'border-emerald-200 bg-emerald-50/50',
          )}
        >
          <div className="flex items-center justify-between gap-xs">
            <span className="text-body font-semibold text-foreground">{active.label}</span>
            <span
              className={cn(
                'rounded-full px-xs py-2xs text-[11px] font-semibold',
                active.status === 'watch'
                  ? 'bg-orange-100 text-orange-800'
                  : active.status === 'mild'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-emerald-100 text-emerald-800',
              )}
            >
              {active.status === 'watch'
                ? 'Needs care'
                : active.status === 'mild'
                  ? 'Mild note'
                  : 'All clear'}
            </span>
          </div>
          <p className="text-nav text-foreground-secondary">
            {active.notes.length > 0
              ? active.notes.join(' · ')
              : 'No visible redness, buildup, or surface wear spotted in this zone.'}
          </p>
        </div>
      </Card>
    </section>
  )
}
