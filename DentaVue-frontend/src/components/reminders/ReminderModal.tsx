'use client'

import { useState, useSyncExternalStore } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import {
  addReminder,
  deleteReminder,
  downloadCalendarIcs,
  formatReminderDate,
  getRemindersServerSnapshot,
  getRemindersSnapshot,
  subscribeReminders,
  toggleReminderDone,
  type ScanReminder,
} from '@/features/reminders/remindersStore'

const PRESETS = [
  { label: 'In 7 days', days: 7, tag: '1 week' },
  { label: 'In 14 days', days: 14, tag: 'Recommended' },
  { label: 'In 30 days', days: 30, tag: 'Monthly' },
] as const

function dateFromOffset(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  d.setHours(9, 0, 0, 0)
  return d.toISOString().slice(0, 10)
}

export function useReminders(): ScanReminder[] {
  return useSyncExternalStore(
    subscribeReminders,
    getRemindersSnapshot,
    getRemindersServerSnapshot,
  )
}

export function ReminderModal({
  open,
  onClose,
  defaultNote = 'Quick 4-photo mouth check to track your progress',
}: {
  open: boolean
  onClose: () => void
  defaultNote?: string
}) {
  const reminders = useReminders()
  const [selectedDays, setSelectedDays] = useState<number | 'custom'>(14)
  const [customDate, setCustomDate] = useState(() => dateFromOffset(14))
  const [note, setNote] = useState(defaultNote)
  const [savedBanner, setSavedBanner] = useState<ScanReminder | null>(null)

  const targetDateStr = selectedDays === 'custom' ? customDate : dateFromOffset(selectedDays)

  const handleSave = async () => {
    const dueIso = new Date(`${targetDateStr}T09:00:00`).toISOString()
    const created = addReminder({
      title: 'DentaVue Mouth Check-in',
      note: note.trim() || defaultNote,
      dueAt: dueIso,
    })
    setSavedBanner(created)

    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        await Notification.requestPermission().catch(() => undefined)
      }
      if (Notification.permission === 'granted') {
        new Notification('DentaVue Reminder Saved', {
          body: `We’ll remind you on ${formatReminderDate(dueIso)} for your check-in scan.`,
        })
      }
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        setSavedBanner(null)
        onClose()
      }}
      title="Check-in Reminders"
    >
      <div className="flex flex-col gap-md">
        {savedBanner ? (
          <div className="flex flex-col gap-sm rounded-3 border border-emerald-200 bg-emerald-50 p-md">
            <span className="text-h2 font-semibold text-emerald-800">
              ✓ Reminder set for {formatReminderDate(savedBanner.dueAt)}
            </span>
            <p className="text-body text-emerald-700">{savedBanner.note}</p>
            <div className="flex flex-wrap gap-sm pt-xs">
              <Button
                variant="secondary"
                className="text-surface"
                onClick={() => downloadCalendarIcs(savedBanner)}
              >
                Add to Phone / Google Calendar
              </Button>
              <Button
                variant="surface"
                onClick={() => {
                  setSavedBanner(null)
                  onClose()
                }}
              >
                Done
              </Button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-body text-foreground-secondary">
              Pick when you&apos;d like to take your next 4-photo mouth check so you can track how
              your gums and teeth are progressing.
            </p>

            {/* Quick schedule presets */}
            <div className="grid grid-cols-3 gap-xs">
              {PRESETS.map((preset) => {
                const active = selectedDays === preset.days
                return (
                  <button
                    key={preset.days}
                    type="button"
                    onClick={() => setSelectedDays(preset.days)}
                    className={cn(
                      'flex flex-col items-center rounded-3 border p-sm text-center transition-colors',
                      active
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-surface text-foreground hover:border-primary/40',
                    )}
                  >
                    <span className="text-body font-semibold">{preset.label}</span>
                    <span className="text-[11px] text-foreground-secondary">{preset.tag}</span>
                  </button>
                )
              })}
            </div>

            {/* Custom date */}
            <div className="flex items-center justify-between gap-sm rounded-3 border border-border bg-background px-md py-sm">
              <label htmlFor="reminder-date" className="text-body font-medium text-foreground">
                Or pick a date
              </label>
              <input
                id="reminder-date"
                type="date"
                value={targetDateStr}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => {
                  setSelectedDays('custom')
                  setCustomDate(e.target.value)
                }}
                className="rounded-2 border border-border bg-surface px-sm py-xs text-body text-foreground"
              />
            </div>

            {/* Note */}
            <div className="flex flex-col gap-2xs">
              <label htmlFor="reminder-note" className="text-nav font-medium text-foreground-secondary">
                Reminder note
              </label>
              <input
                id="reminder-note"
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Check gum comfort & tooth cleanliness"
                className="rounded-3 border border-border bg-surface px-md py-sm text-body text-foreground"
              />
            </div>

            <Button variant="primary" className="text-surface" onClick={handleSave}>
              Save Reminder ({formatReminderDate(`${targetDateStr}T09:00:00`)})
            </Button>
          </>
        )}

        {/* Saved reminders list */}
        {reminders.length > 0 && (
          <div className="mt-xs flex flex-col gap-xs border-t border-border pt-md">
            <span className="text-nav font-semibold text-foreground-secondary">
              Your scheduled reminders ({reminders.length})
            </span>
            <ul className="flex max-h-44 flex-col gap-xs overflow-y-auto">
              {reminders.map((rem) => (
                <li
                  key={rem.id}
                  className="flex items-center justify-between gap-sm rounded-3 border border-border bg-background px-sm py-xs"
                >
                  <button
                    type="button"
                    onClick={() => toggleReminderDone(rem.id)}
                    className="flex min-w-0 flex-1 flex-col text-left"
                  >
                    <span
                      className={cn(
                        'truncate text-body font-semibold',
                        rem.done ? 'line-through text-foreground-secondary' : 'text-foreground',
                      )}
                    >
                      {formatReminderDate(rem.dueAt)} · {rem.title}
                    </span>
                    <span className="truncate text-nav text-foreground-secondary">{rem.note}</span>
                  </button>
                  <div className="flex shrink-0 items-center gap-xs">
                    <button
                      type="button"
                      onClick={() => downloadCalendarIcs(rem)}
                      className="rounded-2 border border-border bg-surface px-xs py-2xs text-[11px] font-medium text-primary"
                    >
                      Calendar
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteReminder(rem.id)}
                      aria-label="Delete reminder"
                      className="rounded-2 px-xs py-2xs text-[11px] font-medium text-error"
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  )
}
